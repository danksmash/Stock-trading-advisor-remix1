import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Building2,
  Moon,
  Sun,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  BarChart2,
  Layers,
  Sparkles,
  Zap,
  Globe,
  Terminal,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  KioxiaMarketData,
  UsSemiQuote,
  NewsItem,
  MarketSessionStatus,
} from '../types';
import {
  evaluatePtsSignal,
  classifyPtsDriver,
  getPtsNextDayOpenAnalysis,
} from '../services/analysisEngine';

interface ThreeTierPricePanelProps {
  kioxia: KioxiaMarketData;
  usQuotes: UsSemiQuote[];
  news: NewsItem[];
  isDemoMode: boolean;
}

export const ThreeTierPricePanel: React.FC<ThreeTierPricePanelProps> = ({
  kioxia,
  usQuotes,
  news,
  isDemoMode,
}) => {
  const [activeSessionTab, setActiveSessionTab] = useState<'AUTO' | 'TOKYO' | 'PTS' | 'US'>('AUTO');
  const [showPtsLogModal, setShowPtsLogModal] = useState(false);
  const [showPtsDebugModal, setShowPtsDebugModal] = useState(false);

  const prevClose = kioxia.prevCloseInfo || {
    price: kioxia.prevClose || 0,
    date: '前営業日',
    benchmarkDescription: '前日比計算の基準価格（前営業日の東証公式終値）',
    source: '東京証券取引所 公式終値 (TSE Official Close)',
  };

  const tokyo = kioxia.tokyoMarketInfo || {
    price: kioxia.price,
    change: kioxia.change,
    changePercent: kioxia.changePercent,
    open: kioxia.open,
    high: kioxia.high,
    low: kioxia.low,
    volume: kioxia.volume,
    vwap: kioxia.vwap,
    lastUpdated: kioxia.lastUpdated,
    dataQuality: kioxia.dataFreshness,
    source: '東京証券取引所 (TSE / JPX Gateway)',
    isMarketOpen: kioxia.isMarketOpen,
  };

  const pts = kioxia.ptsMarketInfo;

  // PTS Analysis
  const ptsSignalInfo = evaluatePtsSignal(pts, kioxia, usQuotes, news);
  const ptsDriver = classifyPtsDriver(pts?.changePercentVsPrevClose || 0, usQuotes, news);
  const nextDayAnalysis = getPtsNextDayOpenAnalysis(pts?.changePercentVsPrevClose || 0, pts);

  // Market Session resolution
  const sessionStatus = kioxia.marketSession || 'TOKYO MARKET OPEN';

  // Determine which tab is visually emphasized
  const resolvedFocus =
    activeSessionTab !== 'AUTO'
      ? activeSessionTab
      : sessionStatus === 'TOKYO MARKET OPEN' || sessionStatus === 'PRE-MARKET'
      ? 'TOKYO'
      : sessionStatus === 'PTS SESSION'
      ? 'PTS'
      : sessionStatus === 'US MARKET OPEN'
      ? 'US'
      : 'TOKYO';

  const isTokyoPositive = tokyo.change >= 0;
  const isPtsPositiveVsPrev = (pts?.changeVsPrevClose || 0) >= 0;
  const isPtsPositiveVsTokyo = (pts?.diffVsTokyoPrice || 0) >= 0;

  // Status mapping
  const ptsDisplayStatus = pts?.status || (pts?.isAvailable ? 'LAST_PTS_TRADE' : 'PTS_SESSION_CLOSED');

  return (
    <section id="three-tier-price-panel" className="bg-[#161B22] border border-gray-800 rounded p-3 space-y-3">
      {/* ─────────────────────────────────────────────────────────────
          1. Top Session & Mode Bar
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            3-Tier Price Architecture
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950/40 text-blue-400 border border-blue-800/50">
            東証285A キオクシア
          </span>

          {/* Market Session Status Badge */}
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
              sessionStatus === 'TOKYO MARKET OPEN'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/60'
                : sessionStatus === 'PTS SESSION'
                ? 'bg-purple-950/60 text-purple-300 border border-purple-700/60'
                : sessionStatus === 'US MARKET OPEN'
                ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-700/60'
                : 'bg-gray-900 text-gray-400 border border-gray-700'
            }`}
          >
            <Clock className="w-3 h-3" />
            {sessionStatus}
          </span>
        </div>

        {/* View Focus Tabs */}
        <div className="flex items-center gap-1 bg-[#0B0E11] p-0.5 rounded border border-gray-800 text-[11px] font-medium">
          <button
            onClick={() => setActiveSessionTab('AUTO')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeSessionTab === 'AUTO' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            AUTO (時間帯自動)
          </button>
          <button
            onClick={() => setActiveSessionTab('TOKYO')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeSessionTab === 'TOKYO' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            東京市場重視
          </button>
          <button
            onClick={() => setActiveSessionTab('PTS')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeSessionTab === 'PTS' ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            PTS夜間重視
          </button>
          <button
            onClick={() => setActiveSessionTab('US')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeSessionTab === 'US' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            米国連動重視
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. The 3 Distinct Prices: Side-by-Side Separation
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* ============================================================
            CARD 1: 【1. 前日終値 (Official Previous Close)】
        ============================================================ */}
        <div
          id="card-prev-close"
          className="bg-[#0D1117] p-3 rounded border border-gray-800 flex flex-col justify-between relative overflow-hidden"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              <span className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                1. 前日終値
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">
              基準日: {prevClose.date}
            </span>
          </div>

          <div className="my-2 text-center py-1">
            <div className="text-3xl lg:text-4xl font-black text-gray-200 font-mono tracking-tight">
              {prevClose.price > 0 ? prevClose.price.toLocaleString() : '---'}
              <span className="text-sm text-gray-400 ml-1 font-mono font-normal">円</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1 font-medium">
              前日比計算の公式基準価格
            </div>
          </div>

          <div className="bg-[#161B22] p-2 rounded border border-gray-800/80 text-[10px] text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">取引所:</span>
              <span className="text-gray-300 font-mono">東京証券取引所 (東証)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ステータス:</span>
              <span className="text-gray-300 font-mono">前営業日 確定終値</span>
            </div>
            <div className="text-[9px] text-gray-500 pt-0.5 border-t border-gray-800 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
              <span>当日値を前日終値として使用することを禁止</span>
            </div>
          </div>

          {/* Data Source Footer */}
          <div className="mt-2 pt-1 border-t border-gray-800/60 text-[9px] text-gray-500 flex justify-between items-center font-mono">
            <span>DATA SOURCE</span>
            <span className="text-gray-400">{prevClose.source}</span>
          </div>
        </div>

        {/* ============================================================
            CARD 2: 【2. 東京市場リアルタイム価格】
        ============================================================ */}
        <div
          id="card-tokyo-live"
          className={`bg-[#0D1117] p-3 rounded border flex flex-col justify-between relative overflow-hidden transition-all ${
            resolvedFocus === 'TOKYO'
              ? 'border-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30'
              : 'border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/60">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${tokyo.isMarketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`}></span>
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wide flex items-center gap-1">
                2. 東京市場 現在値
                {resolvedFocus === 'TOKYO' && (
                  <span className="text-[9px] px-1 py-0.2 bg-blue-600 text-white rounded font-mono font-normal">MAIN</span>
                )}
              </span>
            </div>
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                tokyo.dataQuality === 'LIVE'
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                  : tokyo.dataQuality === 'DELAYED'
                  ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {tokyo.dataQuality}
            </span>
          </div>

          <div className="my-2 text-center py-1">
            <div className="text-3xl lg:text-4xl font-black text-white font-mono tracking-tight">
              {tokyo.price > 0 ? tokyo.price.toLocaleString() : '---'}
              <span className="text-sm text-gray-400 ml-1 font-mono font-normal">円</span>
            </div>
            <div
              className={`text-xs font-bold font-mono mt-1 flex items-center justify-center gap-1 ${
                isTokyoPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {tokyo.price > 0 ? (
                <>
                  {isTokyoPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>
                    前日比 {isTokyoPositive ? `+${tokyo.change}` : tokyo.change}円 ({isTokyoPositive ? `+${tokyo.changePercent}` : tokyo.changePercent}%)
                  </span>
                </>
              ) : (
                <span className="text-gray-500">データ受信待機中</span>
              )}
            </div>
          </div>

          {/* Tokyo Key Intraday Metrics */}
          <div className="bg-[#161B22] p-2 rounded border border-gray-800/80 text-[10px] font-mono text-gray-300 space-y-1">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-500">始値:</span>
                <span>{tokyo.open > 0 ? `${tokyo.open.toLocaleString()}円` : '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">VWAP:</span>
                <span className="text-yellow-400 font-bold">{tokyo.vwap > 0 ? `${tokyo.vwap.toLocaleString()}円` : '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">高値:</span>
                <span className="text-emerald-400">{tokyo.high > 0 ? `${tokyo.high.toLocaleString()}円` : '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">出来高:</span>
                <span>{tokyo.volume > 0 ? `${(tokyo.volume / 10000).toFixed(1)}万株` : '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">安値:</span>
                <span className="text-rose-400">{tokyo.low > 0 ? `${tokyo.low.toLocaleString()}円` : '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新時刻:</span>
                <span className="text-gray-400">{tokyo.lastUpdated.split(' ')[0] || '---'}</span>
              </div>
            </div>
          </div>

          {/* Data Source Footer */}
          <div className="mt-2 pt-1 border-t border-gray-800/60 text-[9px] text-gray-500 flex justify-between items-center font-mono">
            <span>DATA SOURCE</span>
            <span className="text-gray-400 truncate max-w-[180px]">{tokyo.source}</span>
          </div>
        </div>

        {/* ============================================================
            CARD 3: 【3. PTSリアルタイム価格 (PTS / J-Market)】
        ============================================================ */}
        <div
          id="card-pts-live"
          className={`bg-[#0D1117] p-3 rounded border flex flex-col justify-between relative overflow-hidden transition-all ${
            resolvedFocus === 'PTS'
              ? 'border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30'
              : 'border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/60">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${pts?.isAvailable && pts.price > 0 ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`}></span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wide flex items-center gap-1">
                  3. PTS / J-Market
                  {resolvedFocus === 'PTS' && (
                    <span className="text-[9px] px-1 py-0.2 bg-purple-600 text-white rounded font-mono font-normal">MAIN</span>
                  )}
                </span>
                <span className="text-[9px] text-gray-400 font-mono">市場: {pts?.market || pts?.marketName || 'J-Market'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  ptsDisplayStatus === 'ACTIVE_TRADING'
                    ? 'bg-purple-950/70 text-purple-300 border-purple-700/80 animate-pulse'
                    : ptsDisplayStatus === 'LAST_PTS_TRADE'
                    ? 'bg-blue-950/60 text-blue-300 border-blue-700/60'
                    : 'bg-gray-900 text-gray-400 border-gray-700'
                }`}
              >
                {ptsDisplayStatus === 'ACTIVE_TRADING'
                  ? 'ACTIVE TRADING'
                  : ptsDisplayStatus === 'LAST_PTS_TRADE'
                  ? 'LAST PTS TRADE'
                  : ptsDisplayStatus === 'PTS_SESSION_CLOSED'
                  ? 'PTS CLOSED'
                  : 'DATA UNAVAILABLE'}
              </span>
            </div>
          </div>

          {pts?.isAvailable && pts.price > 0 ? (
            <>
              <div className="my-2 text-center py-1">
                <div className="text-[10px] text-gray-400 font-mono mb-0.5">
                  {ptsDisplayStatus === 'ACTIVE_TRADING' ? 'PTS 現在取引値' : '最終PTS取引値'}
                </div>
                <div className="text-3xl lg:text-4xl font-black text-purple-300 font-mono tracking-tight">
                  {pts.price.toLocaleString()}
                  <span className="text-sm text-gray-400 ml-1 font-mono font-normal">円</span>
                </div>
                <div
                  className={`text-xs font-bold font-mono mt-1 flex items-center justify-center gap-1 ${
                    isPtsPositiveVsPrev ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isPtsPositiveVsPrev ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>
                    東証終値比 {isPtsPositiveVsPrev ? `+${pts.changeVsPrevClose}` : pts.changeVsPrevClose}円 ({isPtsPositiveVsPrev ? `+${pts.changePercentVsPrevClose}` : pts.changePercentVsPrevClose}%)
                  </span>
                </div>
              </div>

              {/* PTS Strict Timestamp and Execution Metrics */}
              <div className="bg-[#161B22] p-2 rounded border border-gray-800/80 text-[10px] font-mono text-gray-300 space-y-1">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">PTS取引時刻:</span>
                    <span className="text-purple-300 font-bold">{pts.tradeTimestamp || pts.tradeTime || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">データ取得時刻:</span>
                    <span className="text-gray-300">{pts.fetchedAt || pts.lastUpdated || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">キャッシュ経過:</span>
                    <span className="text-gray-400">{pts.cacheAgeSeconds !== undefined ? `${pts.cacheAgeSeconds}秒前` : '最新'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">東証終値差:</span>
                    <span className={isPtsPositiveVsTokyo ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {isPtsPositiveVsTokyo ? `+${pts.diffVsTokyoPrice}` : pts.diffVsTokyoPrice}円 ({isPtsPositiveVsTokyo ? `+${pts.diffPercentVsTokyoPrice}` : pts.diffPercentVsTokyoPrice}%)
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="my-2 py-3 text-center space-y-2">
              <div className="text-2xl font-black text-gray-500 font-mono tracking-tight">
                DATA UNAVAILABLE
              </div>
              <p className="text-[10px] text-gray-400 bg-gray-900/80 p-2 rounded border border-gray-800 text-left leading-relaxed">
                {pts?.unavailableReason || '無料の自動PTSデータソース（Yahoo! Finance J-Market）で現在有効な取引データが確認できないため、PTS価格は表示していません。'}
              </p>
              <div className="text-[9px] text-gray-500 font-mono">
                ※架空価格・推定値の自動生成は規約により厳格に禁止されています。
              </div>
            </div>
          )}

          {/* Data Source Footer & Pipeline Debug Trigger */}
          <div className="mt-2 pt-1 border-t border-gray-800/60 text-[9px] text-gray-500 flex justify-between items-center font-mono">
            <span>DATA SOURCE</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 truncate max-w-[130px]">
                {pts?.source || 'Yahoo! Finance / J-Market'}
              </span>
              <button
                onClick={() => setShowPtsDebugModal(true)}
                className="px-1.5 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 text-[8px] font-mono font-bold transition-colors flex items-center gap-1"
                title="PTS自動取得パイプラインの診断・生データを確認"
              >
                <Terminal className="w-2.5 h-2.5" />
                PTS DEBUG
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. PTS vs Tokyo Direct Comparison & Spread Strip
      ───────────────────────────────────────────────────────────── */}
      {pts?.isAvailable && pts.price > 0 && (
        <div className="bg-[#0D1117] p-2.5 rounded border border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-gray-400 font-sans font-bold flex items-center gap-1 text-[11px]">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              市場間サヤ比較:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">東京市場:</span>
              <span className="text-white font-bold">{tokyo.price.toLocaleString()}円</span>
            </div>
            <span className="text-gray-600">⇄</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">PTS:</span>
              <span className="text-purple-300 font-bold">{pts.price.toLocaleString()}円</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
              <span className="text-gray-500">PTS差:</span>
              <span className={`font-bold ${isPtsPositiveVsTokyo ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPtsPositiveVsTokyo ? `+${pts.diffVsTokyoPrice}` : pts.diffVsTokyoPrice}円 ({isPtsPositiveVsTokyo ? `+${pts.diffPercentVsTokyoPrice}` : pts.diffPercentVsTokyoPrice}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-900 border border-gray-800">
              <span className="text-gray-500">PTS差(vs前日比):</span>
              <span className={`font-bold ${isPtsPositiveVsPrev ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPtsPositiveVsPrev ? `+${pts.changePercentVsPrevClose}` : pts.changePercentVsPrevClose}%
              </span>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 font-sans">
            ※夜間PTSは出来高が薄いためスプレッドが拡大しやすい傾向があります
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. PTS Signal, Surge/Drop Driver & Next Day Open Empirical Stats
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* PTS Signal & Surge Driver Card */}
        <div className="bg-[#0D1117] p-3 rounded border border-gray-800 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/80">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-bold text-gray-200">PTS SIGNAL & 要因分類</span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${ptsSignalInfo.badgeClass}`}>
              {ptsSignalInfo.signal}
            </span>
          </div>

          {pts?.isAvailable && pts.price > 0 ? (
            <div className="space-y-2 text-[11px]">
              {/* Driver Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    ptsDriver.status === 'SURGE'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80'
                      : ptsDriver.status === 'DROP'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {ptsDriver.title}
                </span>
                <span className="text-[10px] text-gray-400">
                  分類: {ptsDriver.type === 'NEWS' ? '個別好悪材料' : ptsDriver.type === 'US_SEMI' ? '米国半導体連動' : '材料未確認・流動性要因'}
                </span>
              </div>

              {/* Driver Explanation */}
              <p className="text-gray-300 leading-relaxed bg-[#161B22] p-2 rounded border border-gray-800/80">
                {ptsDriver.explanation}
              </p>

              {/* Evaluation Notes */}
              <div className="space-y-1 text-[10px] text-gray-400">
                {ptsSignalInfo.notes.map((note, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>

              {/* Strict Rule Notice */}
              <div className="p-2 rounded bg-amber-950/20 border border-amber-800/40 text-[10px] text-amber-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">【規約】PTS単体を理由にBUY判定にすることはありません：</span>
                  <span className="text-gray-400 ml-1">
                    PTS急騰＝翌日上昇という単純化を排除し、SOX・NVIDIA・ファンダメンタルズと複合評価します。
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-gray-500 font-mono">
              無料リアルタイムPTSデータ待機中のためPTSシグナル評価は停止されています。
            </div>
          )}
        </div>

        {/* Next Day Open Empirical Statistics */}
        <div className="bg-[#0D1117] p-3 rounded border border-gray-800 space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/80">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-gray-200">翌営業日 寄り付き参考動向（過去統計）</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">
                サンプル数: {nextDayAnalysis.sampleCount}件
              </span>
            </div>

            <div className="mt-2 space-y-2">
              <div className="text-[11px] text-gray-200 font-medium bg-[#161B22] p-2 rounded border border-gray-800/80">
                {nextDayAnalysis.directionText}
              </div>

              {nextDayAnalysis.isSufficientSample && nextDayAnalysis.historicalStats ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-gray-400 font-mono flex justify-between">
                    <span>類似PTS変動時の翌日寄り付き結果:</span>
                    <span>N={nextDayAnalysis.sampleCount}</span>
                  </div>

                  {/* Horizontal Bar Breakdown */}
                  <div className="w-full bg-gray-900 h-4 rounded overflow-hidden flex font-mono text-[9px] font-bold text-white text-center leading-4">
                    <div
                      style={{ width: `${nextDayAnalysis.historicalStats.upPercent}%` }}
                      className="bg-emerald-600"
                      title={`上昇 ${nextDayAnalysis.historicalStats.upPercent}%`}
                    >
                      上昇 {nextDayAnalysis.historicalStats.upPercent}%
                    </div>
                    <div
                      style={{ width: `${nextDayAnalysis.historicalStats.flatPercent}%` }}
                      className="bg-yellow-600"
                      title={`横ばい ${nextDayAnalysis.historicalStats.flatPercent}%`}
                    >
                      横ばい {nextDayAnalysis.historicalStats.flatPercent}%
                    </div>
                    <div
                      style={{ width: `${nextDayAnalysis.historicalStats.downPercent}%` }}
                      className="bg-rose-600"
                      title={`下落 ${nextDayAnalysis.historicalStats.downPercent}%`}
                    >
                      下落 {nextDayAnalysis.historicalStats.downPercent}%
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] font-mono text-gray-400 pt-0.5">
                    <span className="text-emerald-400">● 寄り付き上昇: {nextDayAnalysis.historicalStats.upPercent}%</span>
                    <span className="text-yellow-400">● 寄り付き横ばい: {nextDayAnalysis.historicalStats.flatPercent}%</span>
                    <span className="text-rose-400">● 寄り付き下落: {nextDayAnalysis.historicalStats.downPercent}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-400 p-2 bg-amber-950/20 rounded border border-amber-800/40">
                  統計的に信頼できるサンプル数ではありません
                </div>
              )}
            </div>
          </div>

          {/* Mandatory Disclaimer */}
          <div className="mt-2 pt-2 border-t border-gray-800/80 text-[10px] text-gray-400 flex items-start gap-1 font-sans">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-gray-300">免責事項: </strong>
              {nextDayAnalysis.disclaimer} PTSは取引参加者が限られるため、翌日の寄り付き価格とは大きく乖離する場合があります。
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. PTS Full Diagnostic Pipeline Modal (PTS DEBUG)
      ───────────────────────────────────────────────────────────── */}
      {showPtsDebugModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-gray-700 rounded-lg max-w-3xl w-full p-4 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white font-mono">
                  PTS 自動取得・解析・検証 全パイプライン診断 (285A)
                </h3>
              </div>
              <button
                onClick={() => setShowPtsDebugModal(false)}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded font-mono"
              >
                ✕ 閉じる
              </button>
            </div>

            {/* Pipeline Stage Cards */}
            <div className="space-y-2 font-mono text-[11px]">
              {/* STAGE 1: SOURCE RAW */}
              <div className="bg-[#0D1117] p-2.5 rounded border border-gray-800 space-y-1">
                <div className="flex items-center justify-between text-gray-400 font-bold border-b border-gray-800 pb-1">
                  <span>1. 外部データ取得 (SOURCE RAW)</span>
                  <span className="text-purple-400">Yahoo! Finance (285A.T)</span>
                </div>
                <div className="text-gray-300 text-[10px] break-all bg-black/40 p-1.5 rounded">
                  {pts?.debugInfo?.sourceRawSnippet || '未取得またはキャッシュ中'}
                </div>
              </div>

              {/* STAGE 2: PARSED PTS */}
              <div className="bg-[#0D1117] p-2.5 rounded border border-gray-800 space-y-1">
                <div className="flex items-center justify-between text-gray-400 font-bold border-b border-gray-800 pb-1">
                  <span>2. HTML/レスポンス解析 (PARSED PTS)</span>
                  <span className="text-blue-400">正規表現/DOM抽出</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-gray-300">
                  <div className="bg-gray-900/80 p-1.5 rounded">
                    <span className="text-gray-500 block">抽出価格:</span>
                    <span className="text-white font-bold">{pts?.debugInfo?.parsedPrice ? `${pts.debugInfo.parsedPrice.toLocaleString()}円` : 'null'}</span>
                  </div>
                  <div className="bg-gray-900/80 p-1.5 rounded">
                    <span className="text-gray-500 block">東証終値比:</span>
                    <span className="text-white font-bold">{pts?.debugInfo?.parsedChange !== null && pts?.debugInfo?.parsedChange !== undefined ? `${pts.debugInfo.parsedChange}円` : 'null'}</span>
                  </div>
                  <div className="bg-gray-900/80 p-1.5 rounded">
                    <span className="text-gray-500 block">東証終値比率:</span>
                    <span className="text-white font-bold">{pts?.debugInfo?.parsedChangePercent !== null && pts?.debugInfo?.parsedChangePercent !== undefined ? `${pts.debugInfo.parsedChangePercent}%` : 'null'}</span>
                  </div>
                  <div className="bg-gray-900/80 p-1.5 rounded">
                    <span className="text-gray-500 block">取引時刻:</span>
                    <span className="text-purple-300 font-bold">{pts?.debugInfo?.parsedTradeTime || 'null'}</span>
                  </div>
                </div>
              </div>

              {/* STAGE 3: VALIDATED PTS */}
              <div className="bg-[#0D1117] p-2.5 rounded border border-gray-800 space-y-1">
                <div className="flex items-center justify-between text-gray-400 font-bold border-b border-gray-800 pb-1">
                  <span>3. データ検証 (VALIDATED PTS)</span>
                  <div className="flex items-center gap-1">
                    {pts?.debugInfo?.validationStatus === 'VALID' ? (
                      <span className="text-emerald-400 flex items-center gap-0.5 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> 合格 (VALID)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-0.5 font-bold">
                        <XCircle className="w-3 h-3" /> {pts?.debugInfo?.validationStatus || 'EMPTY'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-gray-300 bg-gray-900/80 p-1.5 rounded">
                  {pts?.debugInfo?.validationMessage || 'バリデーション待機中'}
                </div>
              </div>

              {/* STAGE 4: CACHED PTS & API RESPONSE */}
              <div className="bg-[#0D1117] p-2.5 rounded border border-gray-800 space-y-1">
                <div className="flex items-center justify-between text-gray-400 font-bold border-b border-gray-800 pb-1">
                  <span>4. キャッシュ & API レスポンス</span>
                  <span className="text-yellow-400">TTL 60s / 過負荷保護</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-gray-300">
                  <div className="bg-gray-900/80 p-1.5 rounded">
                    <span className="text-gray-500 block">キャッシュ経過秒:</span>
                    <span className="text-white font-bold">{pts?.cacheAgeSeconds !== undefined ? `${pts.cacheAgeSeconds}秒` : '0秒'}</span>
                  </div>
                  <div className="bg-gray-900/80 p-1.5 rounded">
                    <span className="text-gray-500 block">取得時刻 (fetchedAt):</span>
                    <span className="text-white font-bold">{pts?.fetchedAt || '---'}</span>
                  </div>
                  <div className="bg-gray-900/80 p-1.5 rounded">
                    <span className="text-gray-500 block">APIステータス:</span>
                    <span className="text-purple-300 font-bold">{pts?.status || 'DATA_UNAVAILABLE'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Real Points Log Table */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-gray-300 font-mono">
                <span>自動蓄積されたPTS実測レコード (架空データ排除)</span>
                <span className="text-gray-500 text-[10px]">{pts?.historicalPoints?.length || 0} 件</span>
              </div>
              <div className="max-h-36 overflow-y-auto border border-gray-800 rounded">
                <table className="w-full text-[10px] font-mono text-left">
                  <thead className="bg-[#0D1117] text-gray-400 border-b border-gray-800 sticky top-0">
                    <tr>
                      <th className="p-1">日付</th>
                      <th className="p-1">取引時刻</th>
                      <th className="p-1 text-right">PTS価格</th>
                      <th className="p-1 text-right">東証終値比</th>
                      <th className="p-1">市場</th>
                      <th className="p-1">ソース</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-gray-200">
                    {pts?.historicalPoints && pts.historicalPoints.length > 0 ? (
                      pts.historicalPoints.map((pt, idx) => (
                        <tr key={idx} className="hover:bg-gray-800/40">
                          <td className="p-1">{pt.date}</td>
                          <td className="p-1 text-purple-300 font-bold">{pt.time}</td>
                          <td className="p-1 text-right font-bold text-white">{pt.price.toLocaleString()}円</td>
                          <td className={`p-1 text-right font-bold ${pt.changePercentVsPrevClose >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pt.changePercentVsPrevClose >= 0 ? '+' : ''}{pt.changePercentVsPrevClose}%
                          </td>
                          <td className="p-1 text-gray-400">{pt.market}</td>
                          <td className="p-1 text-gray-400 truncate max-w-[100px]">{pt.source}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-3 text-center text-gray-500">
                          実データ待機中（まだPTS取引ログは記録されていません）
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowPtsDebugModal(false)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold font-mono"
              >
                診断完了
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
