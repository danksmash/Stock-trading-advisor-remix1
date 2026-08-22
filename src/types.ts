export type SignalType = 'BUY' | 'STRONG BUY' | 'WAIT' | 'AVOID' | 'DATA UNAVAILABLE';

export type MarketRegime = 'RISK ON' | 'NEUTRAL' | 'RISK OFF' | 'PRE-MARKET' | 'MARKET CLOSED';

export type MarketSessionStatus = 
  | 'TOKYO MARKET OPEN' 
  | 'TOKYO MARKET CLOSED' 
  | 'PTS SESSION' 
  | 'US MARKET OPEN' 
  | 'US MARKET CLOSED'
  | 'PRE-MARKET';

export type PtsSignalType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'DATA UNAVAILABLE';

export type DataQuality = 'LIVE' | 'RECENT' | 'DELAYED' | 'STALE' | 'ERROR' | 'UNAVAILABLE' | 'DEMO';

export type PtsDataQuality = 'LIVE' | 'RECENT' | 'STALE' | 'ERROR' | 'UNAVAILABLE' | 'DEMO';

export type NewsSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export type DropReason = 'NEWS-DRIVEN DROP' | 'MARKET-WIDE DROP' | 'TECHNICAL DROP' | 'UNKNOWN' | 'NONE';

export interface OHLCV {
  time: string; // "09:00", "09:05", etc.
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  ma20?: number;
  ma75?: number;
}

// 1. Official Previous Day Close (Independent Object)
export interface PreviousCloseData {
  price: number;
  date: string; // e.g. "2026/08/20"
  benchmarkDescription: string; // "前日比計算の基準価格（前営業日の東証公式終値）"
  source: string; // "東京証券取引所 公式終値 (TSE Official Close)"
}
export type PrevCloseInfo = PreviousCloseData;

// 2. Tokyo Regular Market Price (Independent Object - NEVER shares price with PTS)
export interface TokyoMarketData {
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  vwap: number;
  lastUpdated: string;
  dataQuality: DataQuality;
  source: string;
  isMarketOpen: boolean;
}
export type TokyoMarketPriceInfo = TokyoMarketData;

// PTS Diagnostic Pipeline Debug Log
export interface PTSDebugPipelineInfo {
  symbol: string;
  source: string;
  market: string;
  sourceRawSnippet: string;
  parsedPrice: number | null;
  parsedChange: number | null;
  parsedChangePercent: number | null;
  parsedTradeTime: string | null;
  validationStatus: 'VALID' | 'INVALID' | 'OUT_OF_BOUNDS' | 'EMPTY';
  validationMessage: string;
  validatedPrice: number | null;
  cachedAtTimestamp: number;
  cacheAgeSeconds: number;
  fetchedAt: string;
  apiResponseStatus: string;
}

// PTS Record Point for history
export interface PtsHistoryPoint {
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

// 3. PTS (Proprietary Trading System / J-Market) Price (Independent Object)
export interface PTSMarketData {
  isAvailable: boolean;
  market: string; // "J-Market"
  price: number; // PTS取引値
  change: number | null; // 東証終値比 変動額
  changePercent: number | null; // 東証終値比 変動率 (%)
  changeVsPrevClose: number; // 互換性維持用
  changePercentVsPrevClose: number; // 互換性維持用
  diffVsTokyoPrice: number; // 東証現在値との価格差
  diffPercentVsTokyoPrice: number;
  tradeTimestamp: string | null; // PTSで実際に取引された時刻 (e.g. "8/21 22:08" or "22:08")
  tradeTime: string; // 互換用 (e.g. "22:08 JST")
  fetchedAt: string; // アプリがデータを取得した時刻 (e.g. "22:08:15 JST")
  lastUpdated: string; // 表示用更新時刻
  cachedAt?: number; // キャッシュ作成タイムスタンプ (ms)
  cacheAgeSeconds?: number; // キャッシュ経過秒数
  open: number | null; // PTS始値
  high: number | null; // PTS高値
  low: number | null; // PTS安値
  volume: number | null; // PTS出来高
  turnover: number | null; // PTS売買代金
  marketName: string; // "J-Market"
  source: string; // "Yahoo! Finance / J-Market"
  status: 'ACTIVE_TRADING' | 'LAST_PTS_TRADE' | 'PTS_SESSION_CLOSED' | 'DATA_UNAVAILABLE' | 'NO_RECENT_TRADE' | 'PTS_DATA_INVALID';
  dataQuality: 'LIVE' | 'RECENT' | 'STALE' | 'UNAVAILABLE' | 'INVALID';
  closeStatus: 'ACTIVE_TRADING' | 'PTS SESSION CLOSE' | 'LAST PTS TRADE' | 'PTS SESSION CLOSED';
  unavailableReason?: string;
  warningNote?: string;
  ptsSignal: PtsSignalType;
  surgeOrDropStatus: 'SURGE' | 'DROP' | 'NORMAL' | 'NONE';
  surgePercent?: number;
  historicalPoints?: PtsHistoryPoint[];
  validSampleCount?: number;
  debugInfo?: PTSDebugPipelineInfo;
  driverClassification?: {
    type: 'NEWS' | 'US_SEMI' | 'UNKNOWN';
    title: string;
    explanation: string;
  };
  nextDayOpenAnalysis?: {
    directionText: string;
    disclaimer: string;
    sampleCount: number;
    isSufficientSample: boolean;
    historicalStats?: {
      upPercent: number;
      flatPercent: number;
      downPercent: number;
    };
  };
}
export type PtsMarketPriceInfo = PTSMarketData;

export interface KioxiaMarketData {
  symbol: string;
  name: string;
  price: number; // Tokyo price or latest official
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  vwap: number;
  volume: number;
  avg20dVolume: number;
  volumeRatioVs20d: number; // e.g. +72.4%
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  ma5: number;
  ma20: number;
  ma25: number;
  ma75: number;
  atr14: number;
  prevHigh: number;
  prevLow: number;
  intraday5m: OHLCV[];
  hourly1h: OHLCV[];
  daily1d: OHLCV[];
  dataFreshness: DataQuality;
  lastUpdated: string;
  isMarketOpen: boolean;
  isPreMarket: boolean;
  marketSession: MarketSessionStatus;
  // Distinct 3 Prices Architecture
  prevCloseInfo: PrevCloseInfo;
  tokyoMarketInfo: TokyoMarketPriceInfo;
  ptsMarketInfo: PtsMarketPriceInfo;
}

export interface UsSemiQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  afterHoursPrice?: number;
  afterHoursChangePercent?: number;
  lastUpdated: string;
  freshness: 'LIVE' | 'MINUTES_AGO' | 'DELAYED' | 'FAILED' | 'DEMO';
  category: 'CHIP' | 'MEMORY' | 'INDEX' | 'MACRO' | 'FX';
  details?: {
    nextEarningsDate?: string;
    revenueConsensus?: string;
    epsConsensus?: string;
    source?: string;
    updatedAt?: string;
  };
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  sentiment: NewsSentiment;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  kioxiaImpact: string;
  tags: string[];
}

export interface ScoreBreakdown {
  technical: number; // max 40
  technicalMax: 40;
  usSemi: number; // max 25
  usSemiMax: 25;
  aiMemory: number; // max 15
  aiMemoryMax: 15;
  japanFx: number; // max 10
  japanFxMax: 10;
  news: number; // max 10
  newsMax: 10;
  total: number; // 0 - 100
  details: {
    technicalNotes: string[];
    usSemiNotes: string[];
    aiMemoryNotes: string[];
    japanFxNotes: string[];
    newsNotes: string[];
  };
}

export interface BuyCandidates {
  primaryMin: number;
  primaryMax: number;
  primaryRationale: string;
  secondaryMin: number;
  secondaryMax: number;
  secondaryRationale: string;
}

export interface ChasingRiskAssessment {
  isHighRisk: boolean;
  score: number; // 0-100
  triggers: string[];
  recommendation: string;
}

export interface DropAssessment {
  isDrop: boolean;
  reason: DropReason;
  dropPercent: number;
  analysis: string;
}

export interface DayTimeCell {
  day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
  timeSlot: string; // "09:00", "09:30", etc.
  avgReturnToClose: number; // e.g. +1.4%
  winRate: number; // e.g. 68%
  sampleCount: number;
  avgVolatility: number;
}

export interface DayStats {
  dayName: string;
  avgReturn: number;
  winRate: number;
  avgRange: number;
  avgVolume: number;
  first30mReturn: number;
  first60mReturn: number;
  morningReturn: number;
  afternoonReturn: number;
  eodReturn: number;
}

export interface SimilarScenarioResult {
  matchConditions: {
    day: string;
    time: string;
    kioxiaGainPercent: number;
    vwapRelation: 'ABOVE' | 'BELOW';
    volumeSpikeRatio: number;
    soxGainPercent: number;
    nvdaGainPercent: number;
  };
  sampleCount: number;
  isSampleSufficient: boolean;
  outcomes: {
    plus30m: { avgReturn: number; winRate: number };
    plus60m: { avgReturn: number; winRate: number };
    plus120m: { avgReturn: number; winRate: number };
    eod: { avgReturn: number; winRate: number };
  };
}

export interface AiCommentResult {
  comment: string;
  rationale: string[];
  keyRisks: string[];
  confidence: number;
  generatedAt: string;
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  buyPrice: number;
  shares: number;
  currentPrice: number;
  note?: string;
}

export interface AlertRule {
  id: string;
  type: 'PRICE_BELOW' | 'PRICE_ABOVE' | 'SCORE_ABOVE' | 'VOLUME_SPIKE' | 'NVDA_SPIKE';
  threshold: number;
  enabled: boolean;
  label: string;
}

export type DataOrigin = 'REAL' | 'SYNTHETIC' | 'SIMULATED' | 'DEMO' | 'MOCK' | 'ESTIMATED' | 'UNKNOWN';

export interface RealPtsRecord {
  date: string;
  symbol: string;
  market: string;
  ptsPrice: number;
  previousClose: number;
  ptsChangePercent: number;
  tradeTimestamp: string;
  nextTradingDay: string;
  nextOpen: number;
  nextClose: number;
  source: string;
  status: 'VALID' | 'STALE' | 'UNAVAILABLE' | 'OUT_OF_BOUNDS';
  dataOrigin: DataOrigin;
  triggerScore?: number;
}

export interface PtsBinBacktest {
  rangeLabel: string;
  sampleCount: number;
  guRate: number;
  gdRate: number;
  flatRate: number;
  avgReturn: number;
  medianReturn: number;
  maxGain: number;
  maxLoss: number;
  confidenceStatus: 'INSUFFICIENT SAMPLE' | 'LOW CONFIDENCE' | 'STATISTICALLY USABLE';
}

export interface SignalComparisonSummary {
  signal: 'BUY' | 'WAIT' | 'SELL';
  count: number;
  winRate: number;
  avgReturn: number;
  medianReturn: number;
  maxDrawdown: number;
  confidenceStatus: 'INSUFFICIENT SAMPLE' | 'LOW CONFIDENCE' | 'STATISTICALLY USABLE';
}

export interface BacktestResult {
  period: '1M' | '3M' | '6M' | '1Y';
  sampleCount: number;
  winRate: number;
  avgReturn: number;
  medianReturn: number;
  totalReturn: number;
  maxProfit: number;
  maxLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  expectedValue: number;
  sharpeRatio: number;
  confidenceStatus: 'INSUFFICIENT SAMPLE' | 'LOW CONFIDENCE' | 'STATISTICALLY USABLE';
  feePercent: number;
  slippagePercent: number;
  ptsBins: PtsBinBacktest[];
  signalComparisons: SignalComparisonSummary[];
  equityCurve: { date: string; equity: number }[];
  trades: {
    date: string;
    entryPrice: number;
    exitPrice: number;
    pnlPercent: number;
    holdingHours: number;
    triggerScore: number;
    ptsChangePercent: number;
  }[];
}
