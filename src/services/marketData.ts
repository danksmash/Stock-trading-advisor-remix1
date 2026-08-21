import {
  KioxiaMarketData,
  UsSemiQuote,
  NewsItem,
  OHLCV,
  PTSMarketData,
} from '../types';

export interface IMarketDataProvider {
  getKioxiaData(isDemoMode?: boolean): Promise<KioxiaMarketData>;
  getUsSemiQuotes(isDemoMode?: boolean): Promise<UsSemiQuote[]>;
}

export interface INewsProvider {
  getSectorNews(): Promise<NewsItem[]>;
}

// Realistic simulation fallback generator ONLY when user explicitly toggles Demo mode
function generateDemoIntraday5mData(basePrice: number): OHLCV[] {
  const times = [
    '09:00', '09:05', '09:10', '09:15', '09:20', '09:25', '09:30', '09:35', '09:40', '09:45',
    '09:50', '09:55', '10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30', '10:45',
    '11:00', '11:15', '11:30', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00',
    '14:15', '14:30', '14:45', '15:00'
  ];

  let current = basePrice - 60;
  let cumVolPrice = 0;
  let cumVol = 0;
  const history: OHLCV[] = [];

  times.forEach((t, i) => {
    const delta = (Math.sin(i * 0.4) * 20) + ((Math.random() - 0.45) * 15);
    const open = Math.round(current);
    const close = Math.round(current + delta);
    const high = Math.round(Math.max(open, close) + Math.random() * 12);
    const low = Math.round(Math.min(open, close) - Math.random() * 12);
    const volume = Math.round(45000 + Math.random() * 50000 + (i < 5 ? 80000 : 0));

    const typicalPrice = (high + low + close) / 3;
    cumVolPrice += typicalPrice * volume;
    cumVol += volume;
    const vwap = Math.round(cumVolPrice / cumVol);

    history.push({
      time: t,
      timestamp: Date.now() - (times.length - i) * 5 * 60 * 1000,
      open,
      high,
      low,
      close,
      volume,
      vwap,
      ma20: Math.round(typicalPrice - 10),
      ma75: Math.round(typicalPrice - 30),
    });

    current = close;
  });

  return history;
}

function generateDemoDailyData(basePrice: number): OHLCV[] {
  const dates = ['08/08', '08/12', '08/13', '08/14', '08/15', '08/18', '08/19', '08/20', '08/21'];
  let current = basePrice - 300;
  return dates.map((d, i) => {
    const delta = 40 + (Math.random() - 0.4) * 60;
    const open = Math.round(current);
    const close = Math.round(current + delta);
    const high = Math.round(Math.max(open, close) + 40);
    const low = Math.round(Math.min(open, close) - 30);
    const volume = Math.round(1500000 + Math.random() * 600000);
    current = close;
    return {
      time: d,
      timestamp: Date.now() - (dates.length - i) * 24 * 60 * 60 * 1000,
      open,
      high,
      low,
      close,
      volume,
      vwap: Math.round(open + 10),
    };
  });
}

export class RealApiMarketDataProvider implements IMarketDataProvider {
  async getKioxiaData(isDemoMode = false): Promise<KioxiaMarketData> {
    const now = new Date();
    const jstString = now.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' JST';

    if (isDemoMode) {
      // Benchmark: Official Previous Day Close
      const prevClosePrice = 52950;
      const prevCloseDate = '2026/08/20';

      // Tokyo Regular Market Live Price
      const tokyoPrice = 54320;
      const tokyoChange = tokyoPrice - prevClosePrice; // +1,370
      const tokyoChangePercent = Number(((tokyoChange / prevClosePrice) * 100).toFixed(2)); // +2.59%
      const intraday5m = generateDemoIntraday5mData(tokyoPrice);
      const daily1d = generateDemoDailyData(tokyoPrice);

      // PTS Real-Time Price
      const ptsPrice = 54855;
      const ptsChangeVsPrev = ptsPrice - prevClosePrice; // +1,905 (+535 vs TSE)
      const ptsChangePercentVsPrev = Number(((ptsChangeVsPrev / prevClosePrice) * 100).toFixed(2)); // +3.60%
      const ptsDiffVsTokyo = ptsPrice - tokyoPrice; // +535
      const ptsDiffPercentVsTokyo = Number(((ptsDiffVsTokyo / tokyoPrice) * 100).toFixed(2)); // +0.98%

      const prevCloseInfo = {
        price: prevClosePrice,
        date: prevCloseDate,
        benchmarkDescription: '前日比計算の基準価格（前営業日 東証公式終値）',
        source: '東京証券取引所 公式終値 (TSE Official Close)',
      };

      const tokyoMarketInfo = {
        price: tokyoPrice,
        change: tokyoChange,
        changePercent: tokyoChangePercent,
        open: 51950,
        high: 55470,
        low: 51910,
        volume: 39845000,
        vwap: 54100,
        lastUpdated: '15:30:00 JST (東証大引け)',
        dataQuality: 'DELAYED' as const,
        source: '東京証券取引所 (TSE / JPX Gateway)',
        isMarketOpen: false,
      };

      const ptsMarketInfo = {
        isAvailable: true,
        market: 'J-Market',
        price: ptsPrice,
        change: 535,
        changePercent: 0.98,
        changeVsPrevClose: ptsChangeVsPrev,
        changePercentVsPrevClose: ptsChangePercentVsPrev,
        diffVsTokyoPrice: ptsDiffVsTokyo,
        diffPercentVsTokyoPrice: ptsDiffPercentVsTokyo,
        open: 54800,
        high: 54900,
        low: 54750,
        volume: 12400,
        turnover: 680000000,
        tradeTimestamp: '8/21 22:08',
        tradeTime: '8/21 22:08',
        fetchedAt: '22:08:15 JST',
        lastUpdated: '22:08:15 JST',
        cachedAt: Date.now(),
        cacheAgeSeconds: 12,
        marketName: 'J-Market',
        source: 'Yahoo! Finance / J-Market',
        status: 'LAST_PTS_TRADE' as const,
        dataQuality: 'RECENT' as const,
        closeStatus: 'LAST PTS TRADE' as const,
        ptsSignal: 'POSITIVE' as const,
        surgeOrDropStatus: 'SURGE' as const,
        surgePercent: ptsChangePercentVsPrev,
        historicalPoints: [
          {
            date: '2026/08/21',
            time: '22:08',
            timestamp: Date.now() - 300000,
            price: ptsPrice,
            changeVsPrevClose: ptsChangeVsPrev,
            changePercentVsPrevClose: ptsChangePercentVsPrev,
            volume: 12400,
            market: 'J-Market',
            source: 'Yahoo! Finance / J-Market',
          }
        ],
        validSampleCount: 1,
        driverClassification: {
          type: 'NEWS' as const,
          title: 'PTS夜間取引（Enterprise SSD需要好感 & 米Micron/WDC連動）',
          explanation: 'AIデータセンター向け大容量SSD需要増の報道と、米半導体高に連動した取引。',
        },
        nextDayOpenAnalysis: {
          directionText: '統計的に信頼できるサンプル数ではありません（実データ蓄積中）',
          disclaimer: 'PTS価格は翌日の寄り付き価格を保証するものではありません。',
          sampleCount: 1,
          isSufficientSample: false,
        },
        debugInfo: {
          symbol: '285A',
          source: 'Yahoo! Finance',
          market: 'J-Market',
          sourceRawSnippet: '<div class="_CommonPriceBoard__ptsPriceRow..."><span class="_StyledNumber__value...">54,855</span>...</div>',
          parsedPrice: ptsPrice,
          parsedChange: 535,
          parsedChangePercent: 0.98,
          parsedTradeTime: '8/21 22:08',
          validationStatus: 'VALID' as const,
          validationMessage: 'PTS価格・市場・時刻の完全検証に合格しました',
          validatedPrice: ptsPrice,
          cachedAtTimestamp: Date.now(),
          cacheAgeSeconds: 12,
          fetchedAt: '22:08:15 JST',
          apiResponseStatus: 'LAST_PTS_TRADE',
        }
      };

      return {
        symbol: '285A',
        name: 'キオクシアホールディングス',
        price: tokyoPrice,
        change: tokyoChange,
        changePercent: tokyoChangePercent,
        open: 51950,
        high: 55470,
        low: 51910,
        prevClose: prevClosePrice,
        vwap: 54100,
        volume: 39845000,
        avg20dVolume: 28000000,
        volumeRatioVs20d: 42.3,
        rsi14: 64.5,
        macd: { macdLine: 28.2, signalLine: 19.5, histogram: 8.7 },
        ma5: 53800,
        ma20: 52400,
        ma25: 52100,
        ma75: 48900,
        atr14: 1850,
        prevHigh: 53800,
        prevLow: 51200,
        intraday5m,
        hourly1h: [],
        daily1d,
        dataFreshness: 'LIVE',
        lastUpdated: `${jstString} (DEMO SIMULATION)`,
        isMarketOpen: false,
        isPreMarket: false,
        marketSession: 'PTS SESSION',
        prevCloseInfo,
        tokyoMarketInfo,
        ptsMarketInfo,
      };
    }

    try {
      const res = await fetch('/api/market/kioxia');
      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }
      const data = await res.json();

      // If backend returned valid live/delayed price
      if (data && data.price > 0 && data.dataFreshness !== 'FAILED' && data.dataFreshness !== 'UNAVAILABLE') {
        return data;
      }

      // If market is closed or 285A feed is quiet, return clear non-fabricated state
      const prevCloseInfo = data?.prevCloseInfo || {
        price: data?.prevClose || 0,
        date: '前営業日',
        benchmarkDescription: '前日比計算の基準価格（前営業日の東証公式終値）',
        source: '東京証券取引所 公式終値',
      };
      const tokyoMarketInfo = data?.tokyoMarketInfo || {
        price: data?.price || 0,
        change: data?.change || 0,
        changePercent: data?.changePercent || 0,
        open: data?.open || 0,
        high: data?.high || 0,
        low: data?.low || 0,
        volume: data?.volume || 0,
        vwap: data?.vwap || 0,
        lastUpdated: data?.lastUpdated || jstString,
        dataQuality: 'UNAVAILABLE',
        source: '東京証券取引所 (TSE / JPX Gateway)',
        isMarketOpen: false,
      };
      const ptsMarketInfo = data?.ptsMarketInfo || {
        isAvailable: false,
        price: 0,
        changeVsPrevClose: 0,
        changePercentVsPrevClose: 0,
        diffVsTokyoPrice: 0,
        diffPercentVsTokyoPrice: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        tradeTime: '---',
        lastUpdated: jstString,
        marketName: 'J-Market',
        source: 'Yahoo! Finance / J-Market',
        dataQuality: 'UNAVAILABLE',
        closeStatus: 'LAST PTS TRADE',
        unavailableReason: '無料の自動PTSデータソース（Yahoo! Finance J-Market）で現在有効な取引データが確認できないため、PTS価格は表示していません。',
        ptsSignal: 'DATA UNAVAILABLE',
        surgeOrDropStatus: 'NONE',
        historicalPoints: [],
        nextDayOpenAnalysis: {
          directionText: '統計的に信頼できるサンプル数ではありません',
          disclaimer: 'PTS価格は翌日の寄り付き価格を保証するものではありません。',
          sampleCount: 0,
          isSufficientSample: false,
        },
      };

      return {
        symbol: '285A',
        name: 'キオクシアホールディングス',
        price: data?.price || 0,
        change: data?.change || 0,
        changePercent: data?.changePercent || 0,
        open: data?.open || 0,
        high: data?.high || 0,
        low: data?.low || 0,
        prevClose: data?.prevClose || 0,
        vwap: data?.vwap || 0,
        volume: data?.volume || 0,
        avg20dVolume: data?.avg20dVolume || 0,
        volumeRatioVs20d: data?.volumeRatioVs20d || 0,
        rsi14: data?.rsi14 || 0,
        macd: data?.macd || { macdLine: 0, signalLine: 0, histogram: 0 },
        ma5: data?.ma5 || 0,
        ma20: data?.ma20 || 0,
        ma25: data?.ma25 || 0,
        ma75: data?.ma75 || 0,
        atr14: data?.atr14 || 0,
        prevHigh: data?.prevHigh || 0,
        prevLow: data?.prevLow || 0,
        intraday5m: data?.intraday5m || [],
        hourly1h: [],
        daily1d: data?.daily1d || [],
        dataFreshness: data?.dataFreshness || 'UNAVAILABLE',
        lastUpdated: data?.lastUpdated || jstString,
        isMarketOpen: data?.isMarketOpen || false,
        isPreMarket: data?.isPreMarket || false,
        marketSession: data?.marketSession || 'TOKYO MARKET CLOSED',
        prevCloseInfo,
        tokyoMarketInfo,
        ptsMarketInfo,
      };
    } catch (err) {
      console.warn('Could not reach /api/market/kioxia, returning safe UNAVAILABLE status', err);
      const prevCloseInfo = {
        price: 0,
        date: '前営業日',
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
        lastUpdated: jstString,
        dataQuality: 'UNAVAILABLE' as const,
        source: '東京証券取引所',
        isMarketOpen: false,
      };
      const ptsMarketInfo: PTSMarketData = {
        isAvailable: false,
        market: 'J-Market',
        price: 0,
        change: null,
        changePercent: null,
        changeVsPrevClose: 0,
        changePercentVsPrevClose: 0,
        diffVsTokyoPrice: 0,
        diffPercentVsTokyoPrice: 0,
        open: null,
        high: null,
        low: null,
        volume: null,
        turnover: null,
        tradeTimestamp: null,
        tradeTime: '---',
        fetchedAt: jstString,
        lastUpdated: jstString,
        cachedAt: Date.now(),
        cacheAgeSeconds: 0,
        marketName: 'J-Market',
        source: 'Yahoo! Finance / J-Market',
        status: 'DATA_UNAVAILABLE' as const,
        dataQuality: 'UNAVAILABLE' as const,
        closeStatus: 'PTS SESSION CLOSED' as const,
        unavailableReason: '無料の自動PTSデータソース（Yahoo! Finance J-Market）で現在有効な取引データが確認できないため、PTS価格は表示していません。',
        ptsSignal: 'DATA UNAVAILABLE' as const,
        surgeOrDropStatus: 'NONE' as const,
        historicalPoints: [],
        debugInfo: {
          symbol: '285A',
          source: 'Yahoo! Finance Japan (285A.T)',
          market: 'J-Market',
          sourceRawSnippet: 'なし（通信待機中またはエラー）',
          parsedPrice: null,
          parsedChange: null,
          parsedChangePercent: null,
          parsedTradeTime: null,
          validationStatus: 'EMPTY',
          validationMessage: 'データ未取得',
          validatedPrice: null,
          cachedAtTimestamp: Date.now(),
          cacheAgeSeconds: 0,
          fetchedAt: jstString,
          apiResponseStatus: 'DATA_UNAVAILABLE',
        },
        nextDayOpenAnalysis: {
          directionText: '統計的に信頼できるサンプル数ではありません',
          disclaimer: 'PTS価格は翌日の寄り付き価格を保証するものではありません。',
          sampleCount: 0,
          isSufficientSample: false,
        },
      };

      return {
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
        lastUpdated: jstString,
        isMarketOpen: false,
        isPreMarket: false,
        marketSession: 'TOKYO MARKET CLOSED',
        prevCloseInfo,
        tokyoMarketInfo,
        ptsMarketInfo,
      };
    }
  }

  async getUsSemiQuotes(isDemoMode = false): Promise<UsSemiQuote[]> {
    if (isDemoMode) {
      const now = new Date();
      const jstString = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }) + ' JST';
      return [
        { symbol: 'NVDA', name: 'NVIDIA Corp', price: 148.52, change: 4.61, changePercent: 3.21, afterHoursPrice: 149.10, afterHoursChangePercent: 0.39, lastUpdated: jstString, freshness: 'LIVE', category: 'CHIP' },
        { symbol: 'MU', name: 'Micron Technology', price: 112.40, change: 5.23, changePercent: 4.88, afterHoursPrice: 112.85, afterHoursChangePercent: 0.40, lastUpdated: jstString, freshness: 'LIVE', category: 'MEMORY' },
        { symbol: 'WDC', name: 'Western Digital (Flash)', price: 78.90, change: 2.85, changePercent: 3.75, lastUpdated: jstString, freshness: 'LIVE', category: 'MEMORY' },
        { symbol: 'AMD', name: 'Advanced Micro Devices', price: 162.30, change: 3.45, changePercent: 2.17, lastUpdated: jstString, freshness: 'LIVE', category: 'CHIP' },
        { symbol: 'AVGO', name: 'Broadcom Inc', price: 178.60, change: 4.20, changePercent: 2.41, lastUpdated: jstString, freshness: 'LIVE', category: 'CHIP' },
        { symbol: '^SOX', name: 'Philadelphia Semiconductor Index', price: 5420.10, change: 102.30, changePercent: 1.92, lastUpdated: jstString, freshness: 'LIVE', category: 'INDEX' },
        { symbol: '^IXIC', name: 'Nasdaq Composite', price: 18450.20, change: 215.40, changePercent: 1.18, lastUpdated: jstString, freshness: 'LIVE', category: 'INDEX' },
        { symbol: '^GSPC', name: 'S&P 500', price: 5640.80, change: 42.10, changePercent: 0.75, lastUpdated: jstString, freshness: 'LIVE', category: 'INDEX' },
        { symbol: 'USD/JPY', name: 'USD / JPY (ドル円)', price: 142.15, change: -0.18, changePercent: -0.12, lastUpdated: jstString, freshness: 'LIVE', category: 'FX' },
        { symbol: 'US10Y', name: 'US 10-Year Treasury Yield', price: 3.84, change: -0.04, changePercent: -1.03, lastUpdated: jstString, freshness: 'LIVE', category: 'MACRO' },
      ];
    }

    try {
      const res = await fetch('/api/market/us-quotes');
      if (res.ok) {
        const quotes = await res.json();
        if (Array.isArray(quotes) && quotes.length > 0) {
          return quotes;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch US quotes from API', err);
    }
    return [];
  }
}

export class RealNewsProvider implements INewsProvider {
  async getSectorNews(): Promise<NewsItem[]> {
    try {
      const res = await fetch('/api/market/news');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch news from API', err);
    }
    return [];
  }
}

export const defaultMarketDataProvider = new RealApiMarketDataProvider();
export const defaultNewsProvider = new RealNewsProvider();
