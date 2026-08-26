export type SignalType = 'STRONG BUY' | 'BUY' | 'WAIT' | 'AVOID' | 'DATA UNAVAILABLE';
export type NewsSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
export type DataQuality = 'LIVE' | 'MINUTES_AGO' | 'DELAYED' | 'FAILED' | 'DEMO' | 'UNAVAILABLE';
export type MarketSessionStatus = 'TOKYO MARKET OPEN' | 'TOKYO MARKET CLOSED' | 'PTS SESSION' | 'US MARKET OPEN' | 'US MARKET CLOSED' | 'PRE-MARKET';

export interface OHLCV { time: string; timestamp: number; open: number; high: number; low: number; close: number; volume: number; vwap?: number; ma20?: number; ma75?: number; }
export interface PrevCloseInfo { price: number; date: string; benchmarkDescription: string; source: string; }
export interface TokyoMarketPriceInfo { price: number; change: number; changePercent: number; open: number; high: number; low: number; volume: number; vwap: number; lastUpdated: string; dataQuality: DataQuality; source: string; isMarketOpen: boolean; }
export interface PTSMarketData {
  isAvailable: boolean; market?: string; price: number; change?: number | null; changePercent?: number | null; changeVsPrevClose: number; changePercentVsPrevClose: number; diffVsTokyoPrice: number; diffPercentVsTokyoPrice: number; open?: number | null; high?: number | null; low?: number | null; volume?: number | null; turnover?: number | null; tradeTimestamp?: string | null; tradeTime: string; fetchedAt?: string; lastUpdated: string; cachedAt?: number; cacheAgeSeconds?: number; marketName: string; source: string; status?: string; dataQuality: DataQuality; closeStatus: string; unavailableReason?: string; ptsSignal: string; surgeOrDropStatus: string; surgePercent?: number; historicalPoints: any[]; validSampleCount?: number; debugInfo?: any;
  driverClassification?: { type: 'NEWS' | 'US_SEMI' | 'UNKNOWN'; title: string; explanation: string; };
  nextDayOpenAnalysis?: { directionText: string; disclaimer: string; sampleCount: number; isSufficientSample: boolean; historicalStats?: { upPercent: number; flatPercent: number; downPercent: number; }; };
}
export type PtsMarketPriceInfo = PTSMarketData;
export interface KioxiaMarketData {
  symbol: string; name: string; price: number; change: number; changePercent: number; open: number; high: number; low: number; prevClose: number; vwap: number; volume: number; avg20dVolume: number; volumeRatioVs20d: number; rsi14: number;
  macd: { macdLine: number; signalLine: number; histogram: number; };
  ma5: number; ma20: number; ma25: number; ma75: number; atr14: number; prevHigh: number; prevLow: number; intraday5m: OHLCV[]; hourly1h: OHLCV[]; daily1d: OHLCV[]; dataFreshness: DataQuality; lastUpdated: string; isMarketOpen: boolean; isPreMarket: boolean; marketSession: MarketSessionStatus; prevCloseInfo: PrevCloseInfo; tokyoMarketInfo: TokyoMarketPriceInfo; ptsMarketInfo: PtsMarketPriceInfo;
}
export interface UsSemiQuote {
  symbol: string; name: string; price: number; change: number; changePercent: number; afterHoursPrice?: number; afterHoursChangePercent?: number; lastUpdated: string; freshness: 'LIVE' | 'MINUTES_AGO' | 'DELAYED' | 'FAILED' | 'DEMO'; category: 'CHIP' | 'MEMORY' | 'INDEX' | 'MACRO' | 'FX';
  details?: { nextEarningsDate?: string; revenueConsensus?: string; epsConsensus?: string; source?: string; updatedAt?: string; };
}
export interface NewsItem {
  id: string; title: string; translatedTitle?: string; summary: string; source: string; publishedAt: string; sentiment: NewsSentiment; importance: 'HIGH' | 'MEDIUM' | 'LOW'; kioxiaImpact: string; tags: string[]; url?: string;
}
export interface ScoreBreakdown {
  technical: number; technicalMax: 40; usSemi: number; usSemiMax: 25; aiMemory: number; aiMemoryMax: 15; japanFx: number; japanFxMax: 10; news: number; newsMax: 10; total: number;
  details: { technicalNotes: string[]; usSemiNotes: string[]; aiMemoryNotes: string[]; japanFxNotes: string[]; newsNotes: string[]; };
}
export interface BuyCandidates { primaryMin: number; primaryMax: number; primaryRationale: string; secondaryMin: number; secondaryMax: number; secondaryRationale: string; }
export interface ChasingRiskAssessment { isHighRisk: boolean; recommendation: string; }
export interface DropAssessment { isDrop: boolean; reason: string; analysis: string; }
export interface AiCommentResult { comment: string; rationale: string[]; keyRisks: string[]; confidence: number; generatedAt: string; }
