import type { Request, Response } from 'express';
// The custom build creates dist/server.cjs from server.ts before Vercel packages
// this function. Import the generated CommonJS bundle so the function does not
// depend on TypeScript source files outside /api at runtime.
// @ts-ignore - generated at build time by `npm run build`
import serverModule from '../dist/server.cjs';

const app: any = (serverModule as any)?.default ?? serverModule;

type DailyBar = { open: number; close: number; timestamp?: number; time?: string };
type MinuteBar = {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  ma20?: number;
  ma75?: number;
};

function buildNextOpenDailyStatistics(daily: DailyBar[]) {
  if (!Array.isArray(daily) || daily.length < 40) return null;
  const latestIndex = daily.length - 1;
  const previousClose = daily[latestIndex - 1]?.close || 0;
  const latestClose = daily[latestIndex]?.close || 0;
  if (previousClose <= 0 || latestClose <= 0) return null;
  const latestReturnPct = ((latestClose / previousClose) - 1) * 100;
  const collect = (bandPct: number) => {
    const observations: number[] = [];
    for (let i = 1; i < daily.length - 1; i++) {
      const prev = daily[i - 1]?.close || 0;
      const close = daily[i]?.close || 0;
      const nextOpen = daily[i + 1]?.open || 0;
      if (prev <= 0 || close <= 0 || nextOpen <= 0) continue;
      const dayReturnPct = ((close / prev) - 1) * 100;
      if (Math.abs(dayReturnPct - latestReturnPct) > bandPct) continue;
      observations.push(((nextOpen / close) - 1) * 100);
    }
    return observations;
  };
  let band = 1.25;
  let observations = collect(band);
  if (observations.length < 20) { band = 2.5; observations = collect(band); }
  if (observations.length < 10) return null;
  const up = observations.filter((v) => v > 0.5).length;
  const down = observations.filter((v) => v < -0.5).length;
  const flat = observations.length - up - down;
  const upPercent = Math.round((up / observations.length) * 100);
  const flatPercent = Math.round((flat / observations.length) * 100);
  const downPercent = 100 - upPercent - flatPercent;
  return {
    directionText: `東証の日足実績から、当日騰落率 ${latestReturnPct >= 0 ? '+' : ''}${latestReturnPct.toFixed(2)}% に近い過去局面（±${band.toFixed(2)}pt）を抽出しました。PTS→翌朝の実測ペアはまだ十分に蓄積されていないため、現段階では東証日足ベースの参考統計です。`,
    disclaimer: '過去の日足統計は翌営業日の寄り付き価格を保証するものではありません。',
    sampleCount: observations.length,
    isSufficientSample: observations.length >= 20,
    historicalStats: { upPercent, flatPercent, downPercent },
  };
}

const jstParts = (timestampMs: number) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p: Record<string, string> = {};
  formatter.formatToParts(new Date(timestampMs)).forEach(({ type, value }) => { p[type] = value; });
  let hour = Number(p.hour || 0);
  if (hour === 24) hour = 0;
  const minute = Number(p.minute || 0);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    minuteOfDay: hour * 60 + minute,
  };
};

const sma = (values: number[], index: number, period: number) => {
  const start = Math.max(0, index - period + 1);
  const slice = values.slice(start, index + 1);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
};

async function fetchKioxiaThreeTradingDays1m(): Promise<MinuteBar[]> {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/285A.T?interval=1m&range=5d&includePrePost=false&events=div%2Csplits';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Yahoo 1m chart responded ${response.status}`);
  const json: any = await response.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps.length || !quote) throw new Error('Yahoo 1m chart returned no usable data');

  const raw = timestamps.map((ts, i) => {
    const timestamp = Number(ts) * 1000;
    const parts = jstParts(timestamp);
    return {
      timestamp, date: parts.date, time: parts.time, minuteOfDay: parts.minuteOfDay,
      open: Number(quote.open?.[i]), high: Number(quote.high?.[i]), low: Number(quote.low?.[i]),
      close: Number(quote.close?.[i]), volume: Number(quote.volume?.[i] || 0),
    };
  }).filter((b) =>
    Number.isFinite(b.open) && b.open > 0 && Number.isFinite(b.high) && b.high > 0 &&
    Number.isFinite(b.low) && b.low > 0 && Number.isFinite(b.close) && b.close > 0 &&
    ((b.minuteOfDay >= 540 && b.minuteOfDay <= 690) || (b.minuteOfDay >= 750 && b.minuteOfDay <= 930))
  );

  const dates = [...new Set(raw.map((b) => b.date))].sort();
  const lastThreeDates = dates.slice(-3);
  const selected = raw.filter((b) => lastThreeDates.includes(b.date));
  if (!selected.length) throw new Error('No regular-session 1m bars found for last three trading days');

  const closes = selected.map((b) => b.close);
  const cumulativeByDate = new Map<string, { pv: number; vol: number }>();
  return selected.map((b, index) => {
    const state = cumulativeByDate.get(b.date) || { pv: 0, vol: 0 };
    if (b.volume > 0) { state.pv += b.close * b.volume; state.vol += b.volume; }
    cumulativeByDate.set(b.date, state);
    const vwap = state.vol > 0 ? state.pv / state.vol : b.close;
    return {
      time: b.time, timestamp: b.timestamp, open: Math.round(b.open), high: Math.round(b.high),
      low: Math.round(b.low), close: Math.round(b.close), volume: Math.max(0, Math.round(b.volume)),
      vwap: Math.round(vwap), ma20: Math.round(sma(closes, index, 20)), ma75: Math.round(sma(closes, index, 75)),
    };
  });
}

export default async function handler(req: Request, res: Response) {
  const rawPath = req.query.path;
  const pathValue = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');

  if (pathValue) {
    const query = { ...req.query } as Record<string, unknown>;
    delete query.path;
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) for (const item of value) search.append(key, String(item));
      else if (value !== undefined && value !== null) search.append(key, String(value));
    }
    req.url = `/api/${pathValue}${search.size ? `?${search.toString()}` : ''}`;
  }

  if (pathValue === 'market/kioxia-intraday-1m') {
    try {
      const data = await fetchKioxiaThreeTradingDays1m();
      const dates = [...new Set(data.map((b) => jstParts(b.timestamp).date))];
      return res.status(200).json({ data, dates, interval: '1m', tradingDays: dates.length, source: 'Yahoo Finance chart API (285A.T)' });
    } catch (error) {
      console.error('[KIOXIA 1m/3d] endpoint failed:', error instanceof Error ? error.message : String(error));
      return res.status(502).json({ data: [], dates: [], interval: '1m', tradingDays: 0, error: '1分足データを取得できませんでした' });
    }
  }

  let intraday1m3d: MinuteBar[] = [];
  if (pathValue === 'market/kioxia') {
    try { intraday1m3d = await fetchKioxiaThreeTradingDays1m(); }
    catch (error) { console.warn('[KIOXIA 1m/3d] fetch failed:', error instanceof Error ? error.message : String(error)); }

    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (body && intraday1m3d.length) body.intraday1m3d = intraday1m3d;
      if (body?.ptsMarketInfo && Array.isArray(body?.daily1d)) {
        const existing = body.ptsMarketInfo.nextDayOpenAnalysis;
        if (!existing?.isSufficientSample) {
          const dailyStats = buildNextOpenDailyStatistics(body.daily1d);
          if (dailyStats) body.ptsMarketInfo.nextDayOpenAnalysis = dailyStats;
        }
      }
      return originalJson(body);
    }) as typeof res.json;
  }

  return app(req, res);
}
