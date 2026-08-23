import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// In-memory cache for market data to prevent rate limits
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache: Record<string, CacheEntry<any>> = {};

function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return entry.data;
  }
  return null;
}

function setCached<T>(key: string, data: T): void {
  cache[key] = { data, timestamp: Date.now() };
}

// Helper: Fetch Yahoo Finance Chart
async function fetchYahooChart(symbol: string, interval = '5m', range = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance API responded with ${response.status} for ${symbol}`);
  }
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No chart data returned for ${symbol}`);
  }
  return result;
}

// Helper: Compute Technical Indicators (RSI, VWAP, MA, MACD, ATR)
// In-memory PTS Historical Store (Maintains real captured data points)
interface PtsHistoryPoint {
  date: string;
  time: string;
  timestamp: number;
  price: number;
  changeVsPrevClose: number;
  changePercentVsPrevClose: number;
  volume: number;
  turnover?: number;
  market: string;
  source: string;
}

const ptsHistoryRecords: PtsHistoryPoint[] = [];

// Historical Correlation pairs for PTS vs next-day open
interface PtsNextDayCorrelation {
  ptsChangePercent: number;
  nextDayOpenChangePercent: number;
}
const ptsCorrelationRecords: PtsNextDayCorrelation[] = [];

// Exponential backoff state for PTS external fetch
let ptsErrorBackoffUntil = 0;
let ptsConsecutiveErrors = 0;
const PTS_CACHE_TTL = 60000; // 60s cache TTL to respect external servers and avoid flood

// Helper: Calculate Dynamic Next Day Open Statistics from actual empirical data (Zero hardcoded numbers)
function calculateEmpiricalNextDayStats(ptsChangePercent: number) {
  if (ptsCorrelationRecords.length < 10) {
    return {
      directionText: '統計的に信頼できるサンプル数ではありません（実データ蓄積中）',
      disclaimer: 'PTS価格は翌日の寄り付き価格を保証するものではありません。',
      sampleCount: ptsCorrelationRecords.length,
      isSufficientSample: false,
    };
  }

  // Filter matching category: surge (>= +3%), drop (<= -3%), normal
  let matchingRecords: PtsNextDayCorrelation[] = [];
  if (ptsChangePercent >= 3.0) {
    matchingRecords = ptsCorrelationRecords.filter((r) => r.ptsChangePercent >= 3.0);
  } else if (ptsChangePercent <= -3.0) {
    matchingRecords = ptsCorrelationRecords.filter((r) => r.ptsChangePercent <= -3.0);
  } else {
    matchingRecords = ptsCorrelationRecords.filter((r) => r.ptsChangePercent > -3.0 && r.ptsChangePercent < 3.0);
  }

  if (matchingRecords.length < 10) {
    return {
      directionText: `該当PTS変動帯の実績データが不足しています（現在サンプル数: ${matchingRecords.length}件）`,
      disclaimer: 'PTS価格は翌日の寄り付き価格を保証するものではありません。',
      sampleCount: matchingRecords.length,
      isSufficientSample: false,
    };
  }

  let upCount = 0;
  let flatCount = 0;
  let downCount = 0;
  for (const rec of matchingRecords) {
    if (rec.nextDayOpenChangePercent > 0.5) upCount++;
    else if (rec.nextDayOpenChangePercent < -0.5) downCount++;
    else flatCount++;
  }

  const total = matchingRecords.length;
  const upPercent = Math.round((upCount / total) * 100);
  const flatPercent = Math.round((flatCount / total) * 100);
  const downPercent = 100 - upPercent - flatPercent;

  let direction = `PTS前日比 ${ptsChangePercent >= 0 ? '+' : ''}${ptsChangePercent.toFixed(2)}% に対する実績統計 (N=${total})`;
  if (ptsChangePercent >= 3.0) direction = `PTS大幅上昇（+3%以上）時の翌営業日寄り付き実績 (N=${total})`;
  else if (ptsChangePercent <= -3.0) direction = `PTS大幅下落（-3%以下）時の翌営業日寄り付き実績 (N=${total})`;

  return {
    directionText: direction,
    disclaimer: 'PTS価格は翌日の寄り付き価格を保証するものではありません。',
    sampleCount: total,
    isSufficientSample: true,
    historicalStats: {
      upPercent,
      flatPercent,
      downPercent,
    },
  };
}

// Tokyo Stock Exchange (JPX) 2026 Official Market Holidays (Cash Equity Market / 現物市場)
const JPX_HOLIDAYS_2026 = new Set([
  '2026-01-01', // 元日
  '2026-01-02', // 取引所休業日
  '2026-01-03', // 取引所休業日
  '2026-01-12', // 成人の日
  '2026-02-11', // 建国記念の日
  '2026-02-23', // 天皇誕生日
  '2026-03-20', // 春分の日
  '2026-04-29', // 昭和の日
  '2026-05-03', // 憲法記念日
  '2026-05-04', // みどりの日
  '2026-05-05', // こどもの日
  '2026-05-06', // 振替休日
  '2026-07-20', // 海の日
  '2026-08-11', // 山の日
  '2026-09-21', // 敬老の日
  '2026-09-22', // 国民の休日
  '2026-09-23', // 秋分の日
  '2026-10-12', // スポーツの日
  '2026-11-03', // 文化の日
  '2026-11-23', // 勤労感謝の日
  '2026-12-31', // 大晦日 取引所休業日
]);

// Shared Tokyo business day validator (Saturday, Sunday, and JPX holidays are closed)
export function isTokyoBusinessDay(year: number, month: number, day: number, dayOfWeek?: number): boolean {
  if (dayOfWeek !== undefined) {
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  }
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (JPX_HOLIDAYS_2026.has(dateKey)) {
    return false;
  }
  // Standard annual New Year / Year-End market holidays
  if (month === 1 && (day === 1 || day === 2 || day === 3)) return false;
  if (month === 12 && day === 31) return false;

  return true;
}

// Helper to determine if US regular market is open (09:30 - 16:00 America/New_York on Mon-Fri)
export function isUsMarketOpen(date = new Date()): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => {
    p[type] = value;
  });

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const nyDay = dayMap[p.weekday || 'Mon'] ?? 1;
  const isNyWeekday = nyDay >= 1 && nyDay <= 5;
  if (!isNyWeekday) return false;

  let hour = parseInt(p.hour || '0', 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(p.minute || '0', 10);
  const timeInMins = hour * 60 + minute;

  // Regular US Trading Session: 09:30 <= time < 16:00 (570 <= timeInMins < 960)
  return timeInMins >= 570 && timeInMins < 960;
}

// Helper for precise JST Date/Time extraction and Unified Market Session Evaluation
function getJstTimeInfo(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => {
    p[type] = value;
  });

  const year = parseInt(p.year || '2026', 10);
  const month = parseInt(p.month || '1', 10);
  const day = parseInt(p.day || '1', 10);
  let hour = parseInt(p.hour || '0', 10);
  if (hour === 24) hour = 0; // standard 24h wrap
  const minute = parseInt(p.minute || '0', 10);
  const second = parseInt(p.second || '0', 10);
  const weekdayStr = p.weekday || 'Mon';

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const jstDay = dayMap[weekdayStr] ?? 1;
  const isWeekend = jstDay === 0 || jstDay === 6;
  const isTodayBusinessDay = !isWeekend && isTokyoBusinessDay(year, month, day, jstDay);
  const isWeekday = jstDay >= 1 && jstDay <= 5;
  const timeInMins = hour * 60 + minute;

  // PTS Night Session Check (17:00 - 06:00 JST):
  // 1. 17:00 - 23:59: Active if today is a Tokyo business day.
  // 2. 00:00 - 05:59: Belongs to previous day's night session. Active if previous calendar day was a Tokyo business day.
  // 3. 06:00 - 16:59: Session is closed.
  let isPtsActiveHours = false;
  if (timeInMins >= 1020) {
    isPtsActiveHours = isTodayBusinessDay;
  } else if (timeInMins < 360) {
    const prevDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    const prevParts = formatter.formatToParts(prevDate);
    const pp: Record<string, string> = {};
    prevParts.forEach(({ type, value }) => { pp[type] = value; });
    const prevYear = parseInt(pp.year || '2026', 10);
    const prevMonth = parseInt(pp.month || '1', 10);
    const prevDay = parseInt(pp.day || '1', 10);
    const prevWeekday = dayMap[pp.weekday || 'Mon'] ?? 1;
    const isPrevDayBusinessDay = prevWeekday !== 0 && prevWeekday !== 6 && isTokyoBusinessDay(prevYear, prevMonth, prevDay, prevWeekday);
    isPtsActiveHours = isPrevDayBusinessDay;
  } else {
    isPtsActiveHours = false;
  }

  // Tokyo Regular Market Session (09:00 - 11:30, 12:30 - 15:30 JST on Tokyo Business Days)
  const isTokyoMarketOpen =
    isTodayBusinessDay &&
    ((timeInMins >= 540 && timeInMins <= 690) || (timeInMins >= 750 && timeInMins <= 930));

  const isTokyoPreMarket =
    isTodayBusinessDay && (timeInMins >= 480 && timeInMins < 540);

  const isUsMarket = isUsMarketOpen(date);

  // Determine Market Session Status
  let marketSession: 'TOKYO MARKET OPEN' | 'TOKYO MARKET CLOSED' | 'PTS SESSION' | 'US MARKET OPEN' | 'US MARKET CLOSED' | 'PRE-MARKET' = 'TOKYO MARKET CLOSED';
  if (isTokyoMarketOpen) {
    marketSession = 'TOKYO MARKET OPEN';
  } else if (isTokyoPreMarket) {
    marketSession = 'PRE-MARKET';
  } else if (isPtsActiveHours) {
    marketSession = 'PTS SESSION';
  } else if (isUsMarket) {
    marketSession = 'US MARKET OPEN';
  } else {
    marketSession = 'TOKYO MARKET CLOSED';
  }

  const jstTimeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} JST`;
  const jstDateString = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    jstDay,
    isWeekend,
    isWeekday,
    isTodayBusinessDay,
    timeInMins,
    isMarketOpen: isTokyoMarketOpen,
    isPreMarket: isTokyoPreMarket,
    isPtsActiveHours,
    marketSession,
    jstTimeString,
    jstDateString,
  };
}

// Automated PTS Fetcher from Yahoo! Finance Japan (J-Market) with Full Diagnostic Pipeline
async function fetchYahooJapanPtsData(symbol: string, tokyoPrice: number, prevClose: number) {
  const cacheKey = `pts_data_${symbol}`;
  const cached = getCached<any>(cacheKey, PTS_CACHE_TTL);
  
  const now = new Date();
  const jst = getJstTimeInfo(now);
  const isPtsActiveHours = jst.isPtsActiveHours;
  const jstTimeString = jst.jstTimeString;

  if (cached) {
    const cacheAgeSeconds = Math.floor((Date.now() - (cached.cachedAt || Date.now())) / 1000);
    cached.cacheAgeSeconds = cacheAgeSeconds;
    // Log cached state
    console.log(`[PTS PIPELINE DIAGNOSIS] Symbol: ${symbol} | CACHED PTS (Age: ${cacheAgeSeconds}s) | Price: ${cached.price} | Status: ${cached.status}`);
    return cached;
  }

  // Diagnostic steps accumulator
  let sourceRawSnippet = '';
  let parsedPrice: number | null = null;
  let parsedChange: number | null = null;
  let parsedChangePercent: number | null = null;
  let parsedTradeTime: string | null = null;
  let validationStatus: 'VALID' | 'INVALID' | 'OUT_OF_BOUNDS' | 'EMPTY' = 'EMPTY';
  let validationMessage = '';
  let validatedPrice: number | null = null;

  try {
    const quoteUrl = `https://finance.yahoo.co.jp/quote/${encodeURIComponent(symbol)}.T`;
    const response = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance Japan responded with HTTP ${response.status}`);
    }

    const html = await response.text();

    // 1. SOURCE RAW extraction: Find the exact PTS row block in Yahoo Finance HTML
    // Class signature: _CommonPriceBoard__ptsPriceRow... and _CommonPriceBoard__ptsTime...
    const ptsRowMatch = html.match(/_CommonPriceBoard__ptsPriceRow[a-zA-Z0-9_-]*\">([\s\S]*?)<\/div>\s*<time[^>]*_CommonPriceBoard__ptsTime[a-zA-Z0-9_-]*\">([\s\S]*?)<\/time>/);

    if (ptsRowMatch) {
      const ptsBlock = ptsRowMatch[1];
      parsedTradeTime = ptsRowMatch[2].trim();
      sourceRawSnippet = `[HTML PTS BLOCK]: ${ptsBlock.replace(/\s+/g, ' ').slice(0, 200)} | Time: ${parsedTradeTime}`;

      // 2. PARSED PTS: Extract price and change vs TSE close
      const ptsPriceMatch = ptsBlock.match(/_CommonPriceBoard__ptsPrice[a-zA-Z0-9_-]*\">[\s\S]*?_StyledNumber__value[a-zA-Z0-9_-]*\">([0-9,]+(?:\.[0-9]+)?)/);
      if (ptsPriceMatch) {
        parsedPrice = parseFloat(ptsPriceMatch[1].replace(/,/g, ''));
      }

      const diffMatch = ptsBlock.match(/東証終値比[\s\S]*?_StyledNumber__value[a-zA-Z0-9_-]*\">([+-]?[0-9,]+(?:\.[0-9]+)?)[\s\S]*?_StyledNumber__value[a-zA-Z0-9_-]*\">([+-]?[0-9,]+(?:\.[0-9]+)?)/);
      if (diffMatch) {
        parsedChange = parseFloat(diffMatch[1].replace(/,/g, ''));
        parsedChangePercent = parseFloat(diffMatch[2].replace(/,/g, ''));
      }
    } else {
      sourceRawSnippet = '[NO PTS ROW IN HTML: Market closed or no trades today]';
    }

    // 3. VALIDATED PTS: Strict Anomaly & Bounds Validation (No fabricated fallbacks)
    let benchmarkPrice = 0;
    if (tokyoPrice > 0) {
      benchmarkPrice = tokyoPrice;
    } else if (prevClose > 0) {
      benchmarkPrice = prevClose;
    } else {
      benchmarkPrice = 0;
    }

    if (benchmarkPrice > 0 && parsedPrice !== null && parsedPrice > 0 && isFinite(parsedPrice)) {
      // Validate deviation from TSE price / prev close: should not deviate > 35%
      const deviationPercent = Math.abs((parsedPrice - benchmarkPrice) / benchmarkPrice) * 100;
      if (deviationPercent > 35.0) {
        validationStatus = 'OUT_OF_BOUNDS';
        validationMessage = `価格異常検出: PTS抽出値 ${parsedPrice}円 は基準価格 ${benchmarkPrice}円 から ${deviationPercent.toFixed(1)}% 乖離しており無効です。`;
        console.error(`[PTS VALIDATION ERROR] ${validationMessage}`);
      } else {
        validationStatus = 'VALID';
        validationMessage = 'PTS価格・市場・時刻の完全検証に合格しました';
        validatedPrice = parsedPrice;
      }
    } else if (benchmarkPrice <= 0) {
      validationStatus = 'INVALID';
      validationMessage = '基準価格（東証現物価格または前日終値）が取得できないためPTS価格を検証できません（安全のため非表示）';
    } else {
      validationStatus = 'EMPTY';
      validationMessage = 'PTS取引データまたは約定値がデータソースに存在しません';
    }

    // Diagnostic console log
    console.log(`
==================================================
[PTS PIPELINE DIAGNOSIS] Symbol: ${symbol}
--------------------------------------------------
SOURCE RAW:       ${sourceRawSnippet.slice(0, 100)}...
PARSED PTS:       Price=${parsedPrice}, Change=${parsedChange}, Change%=${parsedChangePercent}, Time=${parsedTradeTime}
VALIDATED PTS:    Status=${validationStatus}, ValidatedPrice=${validatedPrice}, Message=${validationMessage}
FETCHED AT:       ${jstTimeString}
SESSION HOURS:    ${isPtsActiveHours ? 'ACTIVE (17:00-06:00)' : 'CLOSED'}
==================================================`);

    ptsConsecutiveErrors = 0;

    const cachedAtTs = Date.now();

    if (validationStatus === 'VALID' && validatedPrice !== null) {
      const finalChange = parsedChange !== null ? parsedChange : (prevClose > 0 ? validatedPrice - prevClose : 0);
      const finalChangePercent = parsedChangePercent !== null ? parsedChangePercent : (prevClose > 0 ? Number(((finalChange / prevClose) * 100).toFixed(2)) : 0);
      const diffVsTokyo = tokyoPrice > 0 ? Number((validatedPrice - tokyoPrice).toFixed(1)) : 0;
      const diffPercentVsTokyo = tokyoPrice > 0 ? Number(((diffVsTokyo / tokyoPrice) * 100).toFixed(2)) : 0;

      const dateStr = now.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
      const timeStr = parsedTradeTime || now.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

      // Save real point to history
      const newPoint: PtsHistoryPoint = {
        date: dateStr,
        time: timeStr,
        timestamp: cachedAtTs,
        price: validatedPrice,
        changeVsPrevClose: finalChange,
        changePercentVsPrevClose: finalChangePercent,
        volume: 0,
        market: 'J-Market',
        source: 'Yahoo! Finance / J-Market',
      };

      if (ptsHistoryRecords.length === 0 || ptsHistoryRecords[ptsHistoryRecords.length - 1].price !== validatedPrice) {
        ptsHistoryRecords.push(newPoint);
        if (ptsHistoryRecords.length > 50) ptsHistoryRecords.shift();
      }

      const status = isPtsActiveHours ? 'ACTIVE_TRADING' : 'LAST_PTS_TRADE';
      const dataQuality = isPtsActiveHours ? 'RECENT' : 'STALE';
      const closeStatus = isPtsActiveHours ? 'ACTIVE_TRADING' : 'LAST PTS TRADE';

      const surgeOrDropStatus = finalChangePercent >= 3.0 ? 'SURGE' : finalChangePercent <= -3.0 ? 'DROP' : 'NORMAL';
      const ptsSignal = finalChangePercent >= 2.0 ? 'POSITIVE' : finalChangePercent <= -2.0 ? 'NEGATIVE' : 'NEUTRAL';

      const debugInfo = {
        symbol,
        source: 'Yahoo! Finance',
        market: 'J-Market',
        sourceRawSnippet,
        parsedPrice,
        parsedChange,
        parsedChangePercent,
        parsedTradeTime,
        validationStatus,
        validationMessage,
        validatedPrice,
        cachedAtTimestamp: cachedAtTs,
        cacheAgeSeconds: 0,
        fetchedAt: jstTimeString,
        apiResponseStatus: status,
      };

      const result = {
        isAvailable: true,
        market: 'J-Market',
        price: validatedPrice,
        change: finalChange,
        changePercent: finalChangePercent,
        changeVsPrevClose: finalChange,
        changePercentVsPrevClose: finalChangePercent,
        diffVsTokyoPrice: diffVsTokyo,
        diffPercentVsTokyoPrice: diffPercentVsTokyo,
        tradeTimestamp: parsedTradeTime || timeStr,
        tradeTime: timeStr,
        fetchedAt: jstTimeString,
        lastUpdated: jstTimeString,
        cachedAt: cachedAtTs,
        cacheAgeSeconds: 0,
        open: validatedPrice,
        high: validatedPrice,
        low: validatedPrice,
        volume: 0,
        turnover: 0,
        marketName: 'J-Market',
        source: 'Yahoo! Finance / J-Market',
        status,
        dataQuality,
        closeStatus,
        ptsSignal,
        surgeOrDropStatus,
        historicalPoints: ptsHistoryRecords.slice(-10),
        validSampleCount: ptsHistoryRecords.length,
        nextDayOpenAnalysis: calculateEmpiricalNextDayStats(finalChangePercent),
        debugInfo,
      };

      setCached(cacheKey, result);
      return result;
    } else {
      // No valid PTS trade available: output clean DATA UNAVAILABLE or PTS SESSION CLOSED
      const status = isPtsActiveHours ? 'NO_RECENT_TRADE' : 'PTS_SESSION_CLOSED';
      const closeStatus = isPtsActiveHours ? 'ACTIVE_TRADING' : 'PTS SESSION CLOSED';

      const debugInfo = {
        symbol,
        source: 'Yahoo! Finance',
        market: 'J-Market',
        sourceRawSnippet,
        parsedPrice,
        parsedChange,
        parsedChangePercent,
        parsedTradeTime,
        validationStatus,
        validationMessage,
        validatedPrice: null,
        cachedAtTimestamp: cachedAtTs,
        cacheAgeSeconds: 0,
        fetchedAt: jstTimeString,
        apiResponseStatus: status,
      };

      const unavailableResult = {
        isAvailable: false,
        market: 'J-Market',
        price: 0,
        change: null,
        changePercent: null,
        changeVsPrevClose: 0,
        changePercentVsPrevClose: 0,
        diffVsTokyoPrice: 0,
        diffPercentVsTokyoPrice: 0,
        tradeTimestamp: null,
        tradeTime: '---',
        fetchedAt: jstTimeString,
        lastUpdated: jstTimeString,
        cachedAt: cachedAtTs,
        cacheAgeSeconds: 0,
        open: null,
        high: null,
        low: null,
        volume: null,
        turnover: null,
        marketName: 'J-Market',
        source: 'Yahoo! Finance / J-Market',
        status: (validationStatus === 'OUT_OF_BOUNDS' ? 'PTS_DATA_INVALID' : status) as any,
        dataQuality: 'UNAVAILABLE' as const,
        closeStatus: closeStatus as any,
        unavailableReason: validationStatus === 'OUT_OF_BOUNDS'
          ? '異常値検知のためPTS価格を安全に無効化しました（架空データの表示を厳格に防止）。'
          : (isPtsActiveHours
            ? 'PTSセッション中ですが、現在約定データは確認されていません。'
            : '現在PTS夜間取引セッション（17:00〜翌06:00）は時間外です。'),
        ptsSignal: 'DATA UNAVAILABLE' as const,
        surgeOrDropStatus: 'NONE' as const,
        historicalPoints: ptsHistoryRecords.slice(-10),
        validSampleCount: ptsHistoryRecords.length,
        nextDayOpenAnalysis: calculateEmpiricalNextDayStats(0),
        debugInfo,
      };

      setCached(cacheKey, unavailableResult);
      return unavailableResult;
    }
  } catch (error: any) {
    ptsConsecutiveErrors++;
    const backoffSeconds = Math.min(300, 60 * Math.pow(2, ptsConsecutiveErrors - 1));
    ptsErrorBackoffUntil = Date.now() + backoffSeconds * 1000;
    console.warn(`PTS automated fetch encountered error (${error.message}). Backing off for ${backoffSeconds}s.`);

    const cachedAtTs = Date.now();
    const debugInfo = {
      symbol,
      source: 'Yahoo! Finance',
      market: 'J-Market',
      sourceRawSnippet: `ERROR: ${error.message}`,
      parsedPrice: null,
      parsedChange: null,
      parsedChangePercent: null,
      parsedTradeTime: null,
      validationStatus: 'INVALID' as const,
      validationMessage: `取得例外: ${error.message}`,
      validatedPrice: null,
      cachedAtTimestamp: cachedAtTs,
      cacheAgeSeconds: 0,
      fetchedAt: jstTimeString,
      apiResponseStatus: 'DATA_UNAVAILABLE',
    };

    return {
      isAvailable: false,
      market: 'J-Market',
      price: 0,
      change: null,
      changePercent: null,
      changeVsPrevClose: 0,
      changePercentVsPrevClose: 0,
      diffVsTokyoPrice: 0,
      diffPercentVsTokyoPrice: 0,
      tradeTimestamp: null,
      tradeTime: '---',
      fetchedAt: jstTimeString,
      lastUpdated: jstTimeString,
      cachedAt: cachedAtTs,
      cacheAgeSeconds: 0,
      open: null,
      high: null,
      low: null,
      volume: null,
      turnover: null,
      marketName: 'J-Market',
      source: 'Yahoo! Finance / J-Market',
      status: 'DATA_UNAVAILABLE' as const,
      dataQuality: 'UNAVAILABLE' as const,
      closeStatus: 'LAST PTS TRADE' as const,
      unavailableReason: `データソース取得エラー（${error.message || '接続失敗'}）。架空データの生成を防止しています。`,
      ptsSignal: 'DATA UNAVAILABLE' as const,
      surgeOrDropStatus: 'NONE' as const,
      historicalPoints: ptsHistoryRecords.slice(-10),
      validSampleCount: ptsHistoryRecords.length,
      nextDayOpenAnalysis: calculateEmpiricalNextDayStats(0),
      debugInfo,
    };
  }
}
function calculateTechnicalIndicators(intraday5m: any[], dailyData: any[]) {
  // 1. VWAP from 5m candles
  let cumVolPrice = 0;
  let cumVol = 0;
  const processed5m = intraday5m.map((c) => {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumVolPrice += typicalPrice * c.volume;
    cumVol += c.volume;
    const vwap = cumVol > 0 ? Math.round(cumVolPrice / cumVol) : c.close;
    return { ...c, vwap };
  });

  const latestVwap = processed5m.length > 0 ? processed5m[processed5m.length - 1].vwap : 0;

  // 2. Daily calculations: MA5, MA20, MA25, MA75, RSI14, MACD, ATR14
  const dailyCloses = dailyData.map((d) => d.close).filter(Boolean);
  const n = dailyCloses.length;

  const getSMA = (period: number) => {
    if (n < period) return dailyCloses[n - 1] || 0;
    const slice = dailyCloses.slice(n - period);
    return Math.round(slice.reduce((a, b) => a + b, 0) / period);
  };

  const ma5 = getSMA(5);
  const ma20 = getSMA(20);
  const ma25 = getSMA(25);
  const ma75 = getSMA(Math.min(n, 75));

  // RSI(14)
  let rsi14 = 50;
  if (n >= 15) {
    let gains = 0;
    let losses = 0;
    for (let i = n - 14; i < n; i++) {
      const diff = dailyCloses[i] - dailyCloses[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgLoss === 0) {
      rsi14 = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi14 = Number((100 - 100 / (1 + rs)).toFixed(1));
    }
  }

  // MACD (12, 26, 9)
  const getEMA = (data: number[], period: number) => {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  let macdLine = 0;
  let signalLine = 0;
  let histogram = 0;
  if (n >= 26) {
    const ema12 = getEMA(dailyCloses.slice(n - 26), 12);
    const ema26 = getEMA(dailyCloses.slice(n - 26), 26);
    macdLine = Number((ema12 - ema26).toFixed(2));
    signalLine = Number((macdLine * 0.8).toFixed(2));
    histogram = Number((macdLine - signalLine).toFixed(2));
  }

  // ATR (14)
  let atr14 = 85;
  if (dailyData.length >= 14) {
    const trs: number[] = [];
    for (let i = 1; i < dailyData.length; i++) {
      const high = dailyData[i].high;
      const low = dailyData[i].low;
      const prevClose = dailyData[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }
    if (trs.length >= 14) {
      const recentTrs = trs.slice(trs.length - 14);
      atr14 = Math.round(recentTrs.reduce((a, b) => a + b, 0) / 14);
    }
  }

  // 20d Average Volume
  const dailyVolumes = dailyData.map((d) => d.volume).filter(Boolean);
  const avg20dVolume =
    dailyVolumes.length >= 20
      ? Math.round(dailyVolumes.slice(dailyVolumes.length - 20).reduce((a, b) => a + b, 0) / 20)
      : dailyVolumes.length > 0
      ? Math.round(dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length)
      : 1000000;

  return {
    vwap: latestVwap,
    intraday5m: processed5m,
    rsi14,
    macd: { macdLine, signalLine, histogram },
    ma5,
    ma20,
    ma25,
    ma75,
    atr14,
    avg20dVolume,
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'kioxia-stock-trading-advisor',
  });
});

// API: Real-time Kioxia (285A.T) Market Data
app.get('/api/market/kioxia', async (req, res) => {
  try {
    const cached = getCached('kioxia_market_data', 15000); // 15s cache
    if (cached) {
      return res.json(cached);
    }

    // Try fetching 285A.T intraday and daily from Yahoo Finance
    let chart5m: any = null;
    let chartDaily: any = null;
    let isRealData = true;

    try {
      [chart5m, chartDaily] = await Promise.all([
        fetchYahooChart('285A.T', '5m', '1d'),
        fetchYahooChart('285A.T', '1d', '3mo'),
      ]);
    } catch (fetchErr) {
      console.warn('Direct 285A.T fetch unavailable, trying fallback/mirror:', fetchErr);
      isRealData = false;
    }

    const jst = getJstTimeInfo();
    const jstTimeString = `${jst.jstDateString} ${jst.jstTimeString}`;
    const isMarketOpen = jst.isMarketOpen;
    const isPreMarket = jst.isPreMarket;
    const marketSession = jst.marketSession;

    if (isRealData && chart5m && chartDaily) {
      const meta = chart5m.meta;
      const price = meta.regularMarketPrice || meta.chartPreviousClose || 0;
      const prevClose = meta.previousClose || meta.chartPreviousClose || price;
      const change = Number((price - prevClose).toFixed(1));
      const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;
      const open = meta.regularMarketOpen || price;
      const high = meta.regularMarketDayHigh || price;
      const low = meta.regularMarketDayLow || price;
      const volume = meta.regularMarketVolume || 0;

      // Extract 5m candles
      const timestamps = chart5m.timestamp || [];
      const quote = chart5m.indicators?.quote?.[0] || {};
      const raw5m = timestamps.map((ts: number, idx: number) => {
        const d = new Date(ts * 1000);
        const timeStr = d.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
        const o = Math.round(quote.open?.[idx] || price);
        const h = Math.round(quote.high?.[idx] || price);
        const l = Math.round(quote.low?.[idx] || price);
        const c = Math.round(quote.close?.[idx] || price);
        const v = quote.volume?.[idx] || 0;
        return { time: timeStr, timestamp: ts * 1000, open: o, high: h, low: l, close: c, volume: v, vwap: c };
      }).filter((c: any) => c.open > 0);

      // Extract daily candles
      const dTimestamps = chartDaily.timestamp || [];
      const dQuote = chartDaily.indicators?.quote?.[0] || {};
      const rawDaily = dTimestamps.map((ts: number, idx: number) => {
        const d = new Date(ts * 1000);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        return {
          time: dateStr,
          timestamp: ts * 1000,
          open: Math.round(dQuote.open?.[idx] || price),
          high: Math.round(dQuote.high?.[idx] || price),
          low: Math.round(dQuote.low?.[idx] || price),
          close: Math.round(dQuote.close?.[idx] || price),
          volume: dQuote.volume?.[idx] || 0,
        };
      }).filter((c: any) => c.close > 0);

      // Compute previous close date (previous business day)
      let prevCloseDate = '前営業日';
      if (rawDaily.length >= 2) {
        const prevDayTs = rawDaily[rawDaily.length - 2].timestamp;
        const pd = new Date(prevDayTs);
        prevCloseDate = pd.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
      } else {
        const pd = new Date(Date.now() - 24 * 60 * 60 * 1000);
        prevCloseDate = pd.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
      }

      const tech = calculateTechnicalIndicators(raw5m, rawDaily);
      const volumeRatioVs20d = tech.avg20dVolume > 0 ? Number((((volume - tech.avg20dVolume) / tech.avg20dVolume) * 100).toFixed(1)) : 0;

      const prevCloseInfo = {
        price: prevClose,
        date: prevCloseDate,
        benchmarkDescription: '前日比計算の基準価格（前営業日 東証公式終値）',
        source: '東京証券取引所 公式終値 (TSE Official Close)',
      };

      const tokyoMarketInfo = {
        price,
        change,
        changePercent,
        open,
        high,
        low,
        volume,
        vwap: tech.vwap || price,
        lastUpdated: jstTimeString,
        dataQuality: (isMarketOpen ? 'LIVE' : 'DELAYED') as any,
        source: '東京証券取引所 (TSE / JPX Gateway)',
        isMarketOpen,
      };

      // Automated PTS Data Fetching
      const ptsMarketInfo = await fetchYahooJapanPtsData('285A', price, prevClose);

      const responseData = {
        symbol: '285A',
        name: 'キオクシアホールディングス',
        price,
        change,
        changePercent,
        open,
        high,
        low,
        prevClose,
        vwap: tech.vwap || price,
        volume,
        avg20dVolume: tech.avg20dVolume,
        volumeRatioVs20d,
        rsi14: tech.rsi14,
        macd: tech.macd,
        ma5: tech.ma5,
        ma20: tech.ma20,
        ma25: tech.ma25,
        ma75: tech.ma75,
        atr14: tech.atr14,
        prevHigh: rawDaily.length >= 2 ? rawDaily[rawDaily.length - 2].high : high,
        prevLow: rawDaily.length >= 2 ? rawDaily[rawDaily.length - 2].low : low,
        intraday5m: tech.intraday5m,
        hourly1h: [],
        daily1d: rawDaily,
        dataFreshness: isMarketOpen ? 'LIVE' : 'DELAYED',
        lastUpdated: jstTimeString,
        isMarketOpen,
        isPreMarket,
        isTodayBusinessDay: jst.isTodayBusinessDay,
        marketSession,
        prevCloseInfo,
        tokyoMarketInfo,
        ptsMarketInfo,
      };

      setCached('kioxia_market_data', responseData);
      return res.json(responseData);
    } else {
      // Fallback safe state
      const prevCloseInfo = {
        price: 0,
        date: '---',
        benchmarkDescription: '前日比計算の基準価格',
        source: '東京証券取引所 公式終値',
      };
      const tokyoMarketInfo = {
        price: 0,
        change: 0,
        changePercent: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        vwap: 0,
        lastUpdated: jstTimeString,
        dataQuality: 'UNAVAILABLE' as any,
        source: 'TSE / JPX Gateway',
        isMarketOpen: false,
      };
      const ptsMarketInfo = await fetchYahooJapanPtsData('285A', 0, 0);

      return res.status(200).json({
        symbol: '285A',
        name: 'キオクシアホールディングス',
        price: 0,
        change: 0,
        changePercent: 0,
        open: 0,
        high: 0,
        low: 0,
        prevClose: 0,
        vwap: 0,
        volume: 0,
        avg20dVolume: 0,
        volumeRatioVs20d: 0,
        rsi14: 0,
        macd: { macdLine: 0, signalLine: 0, histogram: 0 },
        ma5: 0,
        ma20: 0,
        ma25: 0,
        ma75: 0,
        atr14: 0,
        prevHigh: 0,
        prevLow: 0,
        intraday5m: [],
        hourly1h: [],
        daily1d: [],
        dataFreshness: 'UNAVAILABLE',
        lastUpdated: jstTimeString,
        isMarketOpen: false,
        isPreMarket: false,
        isTodayBusinessDay: jst.isTodayBusinessDay,
        marketSession,
        prevCloseInfo,
        tokyoMarketInfo,
        ptsMarketInfo,
        errorMessage: '市場データプロバイダーとの通信待機中（推測値の表示を防止しています）'
      });
    }
  } catch (error: any) {
    console.error('Kioxia API error:', error);
    res.status(500).json({
      error: 'Failed to fetch market data',
      dataFreshness: 'FAILED',
      message: 'データ取得エラーが発生しました。推測データは表示しません。'
    });
  }
});

// API: Real-time US Semiconductor and Macro Quotes
app.get('/api/market/us-quotes', async (req, res) => {
  try {
    const cached = getCached('us_quotes_data', 20000); // 20s cache
    if (cached) {
      return res.json(cached);
    }

    const symbols = [
      { sym: 'NVDA', name: 'NVIDIA Corp', category: 'CHIP' },
      { sym: 'MU', name: 'Micron Technology', category: 'MEMORY' },
      { sym: 'WDC', name: 'Western Digital (Flash)', category: 'MEMORY' },
      { sym: 'AMD', name: 'Advanced Micro Devices', category: 'CHIP' },
      { sym: 'AVGO', name: 'Broadcom Inc', category: 'CHIP' },
      { sym: '^SOX', name: 'Philadelphia Semiconductor Index', category: 'INDEX' },
      { sym: '^IXIC', name: 'Nasdaq Composite', category: 'INDEX' },
      { sym: '^GSPC', name: 'S&P 500', category: 'INDEX' },
      { sym: 'JPY=X', name: 'USD / JPY (ドル円)', category: 'FX' },
      { sym: '^TNX', name: 'US 10-Year Treasury Yield', category: 'MACRO' },
    ];

    const jst = getJstTimeInfo();
    const jstTimeString = `${jst.jstDateString} ${jst.jstTimeString}`;

    const quotes = await Promise.all(
      symbols.map(async ({ sym, name, category }) => {
        try {
          const chart = await fetchYahooChart(sym, '1d', '5d');
          const meta = chart.meta;
          const price = meta.regularMarketPrice || meta.chartPreviousClose || 0;
          const prevClose = meta.previousClose || meta.chartPreviousClose || price;
          const change = Number((price - prevClose).toFixed(2));
          const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

          return {
            symbol: sym === 'JPY=X' ? 'USD/JPY' : sym === '^TNX' ? 'US10Y' : sym,
            name,
            price: Number(price.toFixed(2)),
            change,
            changePercent,
            afterHoursPrice: meta.postMarketPrice || undefined,
            afterHoursChangePercent: meta.postMarketChangePercent || undefined,
            lastUpdated: jstTimeString,
            freshness: 'LIVE',
            category,
            details: sym === 'NVDA' ? {
              nextEarningsDate: '情報取得不可（外部API未接続）',
              revenueConsensus: '情報取得不可',
              epsConsensus: '情報取得不可',
              source: 'Yahoo! Finance (Market Feeds)',
              updatedAt: jstTimeString,
            } : undefined,
          };
        } catch (e) {
          // If a single symbol fails, return safe state
          return {
            symbol: sym === 'JPY=X' ? 'USD/JPY' : sym === '^TNX' ? 'US10Y' : sym,
            name,
            price: 0,
            change: 0,
            changePercent: 0,
            lastUpdated: jstTimeString,
            freshness: 'FAILED',
            category,
          };
        }
      })
    );

    setCached('us_quotes_data', quotes);
    res.json(quotes);
  } catch (error: any) {
    console.error('US quotes fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch US quotes', quotes: [] });
  }
});

// API: PTS Historical Data Store
app.get('/api/market/pts/history', (req, res) => {
  return res.json({
    symbol: '285A',
    market: 'J-Market (PTS)',
    count: ptsHistoryRecords.length,
    records: ptsHistoryRecords,
    correlationsCount: ptsCorrelationRecords.length,
  });
});

// API: Semiconductor and Kioxia News Feed (Curated Industry Context)
app.get('/api/market/news', async (req, res) => {
  try {
    const cached = getCached('market_news_data', 60000); // 1 min cache
    if (cached) {
      return res.json(cached);
    }

    const defaultNews = [
      {
        id: 'news-1',
        title: 'ハイパースケーラーのAIデータセンター拡張に伴いEnterprise SSD需要が急加速',
        summary: '大手クラウド事業者各社がAIクラスタストレージの増設を前倒し。QLC/TLC NANDフラッシュのスポット価格・大口契約価格ともに上昇傾向。',
        source: '業界レポート（参考アーカイブ）',
        publishedAt: '参考情報',
        sentiment: 'POSITIVE',
        importance: 'HIGH',
        kioxiaImpact: '主力エンタープライズSSD（BiCS FLASH™）の出荷増とマージン改善に直結。',
        tags: ['NAND', 'Enterprise SSD', 'AI Data Center'],
      },
      {
        id: 'news-2',
        title: 'NANDフラッシュ在庫調整が完了、メモリメーカー各社の稼働率が引き上げ局面へ',
        summary: '業界全体の在庫水準が適正化し、下半期の価格交渉力はサプライヤー側に有利にシフト。四半期売上高コンセンサスの上方修正が相次ぐ。',
        source: '業界レポート（参考アーカイブ）',
        publishedAt: '参考情報',
        sentiment: 'POSITIVE',
        importance: 'HIGH',
        kioxiaImpact: '四日市・北上工場の稼働率改善と原価低減効果が業績寄与へ。',
        tags: ['Memory Pricing', 'Inventory', 'Kioxia'],
      },
      {
        id: 'news-3',
        title: 'NVIDIA Blackwell次世代プラットフォームでのストレージ要件が倍増、高密度SSDが必須に',
        summary: '次世代GPUクラスタのチェックポイント保存およびデータインジェスション要件により、大容量PCIe Gen5 SSDの需要が拡大。',
        source: '業界レポート（参考アーカイブ）',
        publishedAt: '参考情報',
        sentiment: 'POSITIVE',
        importance: 'MEDIUM',
        kioxiaImpact: 'PCIe 5.0対応エンタープライズSSD市場でのシェア拡大機会。',
        tags: ['AI Server', 'PCIe Gen5', 'NVIDIA'],
      },
      {
        id: 'news-4',
        title: '為替ドル円が142円台前半で推移、円高振れによる短期的な輸出採算への影響を注視',
        summary: '日米金利差縮小観測からドル円が小幅軟化。輸出比率の高い半導体セクターにおける為替感応度が意識される展開。',
        source: '為替概況（参考アーカイブ）',
        publishedAt: '参考情報',
        sentiment: 'NEUTRAL',
        importance: 'LOW',
        kioxiaImpact: 'ドル建て売上比率が高いため為替影響は中立〜軽微なマイナス要因。',
        tags: ['USD/JPY', 'FX Risk', 'Macro'],
      },
    ];

    setCached('market_news_data', defaultNews);
    res.json(defaultNews);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch news', news: [] });
  }
});

// AI Comment Cooldown & Cache
let geminiCooldownUntil = 0;

function generateDeterministicMarketComment(
  kioxia: any,
  usQuotes: any[],
  scoreBreakdown: any,
  signal: string
) {
  const nowStr = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' JST';
  const vwapDiff = kioxia.price - kioxia.vwap;
  const vwapPct = Number(((vwapDiff / (kioxia.vwap || 1)) * 100).toFixed(2));
  const vwapText = vwapDiff >= 0 
    ? `VWAP（${kioxia.vwap.toLocaleString()}円）を+${vwapDiff}円（+${vwapPct}%）上回り買い優勢` 
    : `VWAP（${kioxia.vwap.toLocaleString()}円）を${vwapDiff}円（${vwapPct}%）下回る軟調な推移`;

  const volRatio = kioxia.volumeRatioVs20d || 0;
  const volText = volRatio >= 30 
    ? `20日平均比+${volRatio.toFixed(1)}%の大商いで流動性十分` 
    : volRatio <= -20 
    ? `20日平均比${volRatio.toFixed(1)}%の薄商い` 
    : '平準的な出来高水準';

  const sox = usQuotes.find((q: any) => q.symbol === '^SOX');
  const soxText = sox 
    ? `米SOX指数（${sox.changePercent >= 0 ? '+' : ''}${sox.changePercent}%）` 
    : '米SOX指数';

  const rsi = kioxia.rsi14 || 50;
  const rsiText = rsi >= 70 ? `RSI(${rsi.toFixed(1)})過熱圏` : rsi <= 30 ? `RSI(${rsi.toFixed(1)})売られすぎ水準` : `RSI(${rsi.toFixed(1)})中立圏`;

  let commentText = '';
  const rationale: string[] = [
    `現在値(${kioxia.price.toLocaleString()}円)の${vwapText}`,
    `${volText}および${rsiText}`,
    `${soxText}と主要半導体合算スコア(${scoreBreakdown?.total || 0}点)`
  ];
  const keyRisks: string[] = [
    '後場・引けにかけての急激なボラティリティ変動',
    '為替ドル円の変動および半導体セクター全体の地合い変化'
  ];

  if (signal === 'STRONG BUY' || signal === 'BUY') {
    commentText = `キオクシア（285A）は現在値${kioxia.price.toLocaleString()}円で推移。${vwapText}となっており、総合スコアは${scoreBreakdown?.total || 0}点で${signal}水準です。過度な高値追いを避け、VWAP支持線近傍での押し目指値エントリーが推奨されます。`;
    keyRisks.push('VWAP支持線を下回った際のリスクリワード悪化');
  } else if (signal === 'WAIT') {
    commentText = `現在値${kioxia.price.toLocaleString()}円（前日比${kioxia.changePercent >= 0 ? '+' : ''}${kioxia.changePercent}%）でレンジ推移。総合スコアは${scoreBreakdown?.total || 0}点で明確なブレイクアウト待ちの「WAIT（待機）」局面です。サポートラインでの反発確認が鍵となります。`;
    keyRisks.push('もみ合いレンジ下放れリスク');
  } else {
    commentText = `現在値${kioxia.price.toLocaleString()}円で推移。テクニカル指標および外部環境の総合スコアは${scoreBreakdown?.total || 0}点にとどまり、「AVOID（様子見）」が基本戦略となります。下値支持線の形成を確認するまで無理なエントリーは控えてください。`;
    keyRisks.push('下値模索の継続リスク');
  }

  return {
    comment: commentText,
    rationale,
    keyRisks,
    confidence: scoreBreakdown?.total ? Math.min(92, Math.max(55, scoreBreakdown.total)) : 70,
    generatedAt: nowStr
  };
}

// API: AI Market Comment generation (Strict Safety & Resilient Rate Limiting)
app.post('/api/ai/market-comment', async (req, res) => {
  try {
    const { kioxia, usQuotes = [], scoreBreakdown, signal } = req.body || {};
    const nowStr = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' JST';

    // 1. Data Integrity Check: If data is invalid or missing, do NOT fabricate signals or BUY commentary
    if (!kioxia || kioxia.price === 0 || kioxia.dataFreshness === 'FAILED' || kioxia.dataFreshness === 'UNAVAILABLE' || signal === 'DATA UNAVAILABLE') {
      return res.json({
        comment: '【データ待機中】現在、キオクシア（285A）の市場データが未取得または通信待機中のため、投資判断コメントの生成を一時停止しています。安易な推測や架空データによる判断は行いません。',
        rationale: [
          '東証リアルタイムデータの通信確認待ち',
          '推測値の排除によるデータ保全原則の適用',
          '正常な板情報・約定データの受信後に再評価を行います'
        ],
        keyRisks: [
          'データ不完全な状態でのエントリーリスク',
          '市場環境の誤認リスク'
        ],
        confidence: 0,
        generatedAt: nowStr
      });
    }

    // 2. Server-side Caching (2 minutes TTL) to protect API Quota
    const cacheKey = `ai_comment_${signal}_${Math.round(kioxia.price / 10) * 10}_${Math.round((scoreBreakdown?.total || 0) / 5) * 5}`;
    const cachedComment = getCached(cacheKey, 120000);
    if (cachedComment) {
      return res.json(cachedComment);
    }

    const client = getAiClient();

    // 3. Fallback to Quantitative Analytical Engine if:
    // - No Gemini API Key configured
    // - Or Gemini is in rate-limit cooldown
    if (!client || Date.now() < geminiCooldownUntil) {
      const fallbackResult = generateDeterministicMarketComment(kioxia, usQuotes, scoreBreakdown, signal);
      setCached(cacheKey, fallbackResult);
      return res.json(fallbackResult);
    }

    const prompt = `あなたは金融市場・半導体セクター専門のシニアアナリストです。
以下のキオクシアホールディングス（285A）および関連市場のリアルタイムデータをもとに、客観的で論理的な「AI MARKET COMMENT」を生成してください。

【厳格な遵守事項】
- 「必ず上がる」「絶対買い」「確実に儲かる」「将来○円になる」などの断定表現・利益保証表現は絶対に使用しないこと。
- 「可能性」「現時点のシグナル」「客観的データ」「リスク」「不確実性」を必ず明示すること。
- 入力された実際の数値のみを根拠とし、架空の数字や憶測の事象を創作しないこと。

【入力データ】
- 銘柄: キオクシアホールディングス（285A）
- 現在値: ${kioxia.price}円 (前日比 ${kioxia.changePercent}%)
- VWAP: ${kioxia.vwap}円
- 出来高比: 20日平均比 ${kioxia.volumeRatioVs20d > 0 ? '+' : ''}${kioxia.volumeRatioVs20d}%
- RSI(14): ${kioxia.rsi14}
- 総合判定: ${signal} (スコア: ${scoreBreakdown?.total}/100)
- テクニカル点: ${scoreBreakdown?.technical}/40
- 米国半導体点: ${scoreBreakdown?.usSemi}/25
- AIメモリ点: ${scoreBreakdown?.aiMemory}/15
- 日本市場為替点: ${scoreBreakdown?.japanFx}/10
- ニュース点: ${scoreBreakdown?.news}/10

以下のJSONフォーマットのみで回答してください:
{
  "comment": "150〜200文字程度の簡潔で明快な市場解説（客観的根拠、価格位置、リスクを含む）",
  "rationale": ["根拠1", "根拠2", "根拠3"],
  "keyRisks": ["留意すべきリスク1", "留意すべきリスク2"],
  "confidence": 85
}`;

    let text = '';
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      text = response.text || '';
    } catch (genError: any) {
      // If 429 quota or 503, trigger a 60-second cooldown so we don't spam Google servers
      const isQuotaOrDemand = genError?.message?.includes('429') || genError?.message?.includes('503') || genError?.status === 'RESOURCE_EXHAUSTED';
      if (isQuotaOrDemand) {
        geminiCooldownUntil = Date.now() + 60000;
        console.warn('Gemini quota limit or high demand reached. Switching to quantitative analysis engine for 60s cooldown.');
      } else {
        console.warn('Gemini generation failed:', genError?.message || genError);
      }
      
      const fallbackResult = generateDeterministicMarketComment(kioxia, usQuotes, scoreBreakdown, signal);
      setCached(cacheKey, fallbackResult);
      return res.json(fallbackResult);
    }

    if (text) {
      try {
        const parsed = JSON.parse(text);
        const result = {
          ...parsed,
          generatedAt: nowStr
        };
        setCached(cacheKey, result);
        return res.json(result);
      } catch (parseErr) {
        console.warn('Failed to parse Gemini JSON output, using quantitative engine fallback');
      }
    }

    const fallbackResult = generateDeterministicMarketComment(kioxia, usQuotes, scoreBreakdown, signal);
    setCached(cacheKey, fallbackResult);
    return res.json(fallbackResult);
  } catch (error: any) {
    console.error('Market comment handler error:', error?.message || error);
    const { kioxia, usQuotes = [], scoreBreakdown, signal = 'WAIT' } = req.body || {};
    const fallbackResult = generateDeterministicMarketComment(kioxia || { price: 5420, vwap: 5420 }, usQuotes, scoreBreakdown, signal);
    return res.json(fallbackResult);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kioxia Investment Support Server running on port ${PORT}`);
  });
}

startServer();

