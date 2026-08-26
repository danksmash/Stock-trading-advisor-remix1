import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ThreeTierPricePanel } from './components/ThreeTierPricePanel';
import { SignalScoreCard } from './components/SignalScoreCard';
import { PriceKeyMetrics } from './components/PriceKeyMetrics';
import { CandleChart } from './components/CandleChart';
import { AiCommentCard } from './components/AiCommentCard';
import { UsSemiMarket } from './components/UsSemiMarket';
import { NewsFeed } from './components/NewsFeed';
import { PortfolioModal } from './components/PortfolioModal';
import { BacktestModal } from './components/BacktestModal';
import { ScoreBreakdownModal } from './components/ScoreBreakdownModal';
import { AlertSettingsModal } from './components/AlertSettingsModal';
import { DataSourcesModal } from './components/DataSourcesModal';
import { DisclaimerFooter } from './components/DisclaimerFooter';

import { RealApiMarketDataProvider, RealNewsProvider } from './services/marketData';
import {
  calculateScoreBreakdown,
  determineSignal,
  determineMarketRegime,
  calculateBuyCandidates,
  assessChasingRisk,
  assessRapidDrop,
} from './services/analysisEngine';
import { KioxiaMarketData, UsSemiQuote, NewsItem, AiCommentResult } from './types';

const ForecastRangeChart = React.lazy(() =>
  import('./components/ForecastRangeChart').then((m) => ({ default: m.ForecastRangeChart }))
);

const marketDataProvider = new RealApiMarketDataProvider();
const newsProvider = new RealNewsProvider();

const FONT_SCALE_OPTIONS = [
  { label: 80, scale: 1.2 },
  { label: 90, scale: 1.35 },
  { label: 100, scale: 1.5 },
  { label: 110, scale: 1.65 },
  { label: 120, scale: 1.8 },
] as const;
const STANDARD_FONT_SCALE_INDEX = 2;
const FONT_STORAGE_KEY = 'kioxia-font-scale-v2';

export default function App() {
  const [kioxia, setKioxia] = useState<KioxiaMarketData | null>(null);
  const [usQuotes, setUsQuotes] = useState<UsSemiQuote[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [aiComment, setAiComment] = useState<AiCommentResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [fontScaleIndex, setFontScaleIndex] = useState(() => {
    if (typeof window === 'undefined') return STANDARD_FONT_SCALE_INDEX;
    const saved = Number(window.localStorage.getItem(FONT_STORAGE_KEY));
    return Number.isInteger(saved) && saved >= 0 && saved < FONT_SCALE_OPTIONS.length
      ? saved
      : STANDARD_FONT_SCALE_INDEX;
  });
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isBacktestOpen, setIsBacktestOpen] = useState(false);
  const [isScoreBreakdownOpen, setIsScoreBreakdownOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-scale', String(FONT_SCALE_OPTIONS[fontScaleIndex].scale));
    window.localStorage.setItem(FONT_STORAGE_KEY, String(fontScaleIndex));
  }, [fontScaleIndex]);

  const fetchData = useCallback(async (demoMode = isDemoMode) => {
    setIsRefreshing(true);
    try {
      const [kData, usData, nData] = await Promise.all([
        marketDataProvider.getKioxiaData(demoMode),
        marketDataProvider.getUsSemiQuotes(demoMode),
        newsProvider.getSectorNews(),
      ]);
      setKioxia(kData);
      setUsQuotes(usData);
      setNews(nData);
    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isDemoMode]);

  const lastAiFetchRef = React.useRef<{ time: number; key: string }>({ time: 0, key: '' });
  const fetchAiComment = useCallback(async (kData: KioxiaMarketData, quotes: UsSemiQuote[], scoreBreakdown: any, signal: string, force = false) => {
    const now = Date.now();
    const currentKey = `${signal}_${Math.round(kData.price / 20) * 20}_${Math.round((scoreBreakdown?.total || 0) / 10) * 10}`;
    if (!force && lastAiFetchRef.current.key === currentKey && now - lastAiFetchRef.current.time < 60000) return;
    lastAiFetchRef.current = { time: now, key: currentKey };
    setIsAiLoading(true);
    try {
      // Send only the scalar fields used by the comment endpoint. Intraday/daily
      // candle arrays are intentionally excluded so 3-day 1m history never
      // inflates the request body or triggers Express/Vercel body-size errors.
      const marketCommentInput = {
        price: kData.price,
        change: kData.change,
        changePercent: kData.changePercent,
        vwap: kData.vwap,
        volume: kData.volume,
        volumeRatioVs20d: kData.volumeRatioVs20d,
        rsi14: kData.rsi14,
        macd: kData.macd,
        ma5: kData.ma5,
        ma20: kData.ma20,
        ma25: kData.ma25,
        ma75: kData.ma75,
        atr14: kData.atr14,
        dataFreshness: kData.dataFreshness,
        marketSession: kData.marketSession,
      };
      const compactQuotes = quotes.map(({ symbol, name, price, change, changePercent, freshness, category }) => ({
        symbol, name, price, change, changePercent, freshness, category,
      }));
      const res = await fetch('/api/ai/market-comment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kioxia: marketCommentInput, usQuotes: compactQuotes, scoreBreakdown, signal }),
      });
      if (res.ok) setAiComment(await res.json());
    } catch (err) { console.error('AI comment API error:', err); }
    finally { setIsAiLoading(false); }
  }, []);

  useEffect(() => { fetchData(isDemoMode); }, [fetchData, isDemoMode]);
  useEffect(() => {
    if (kioxia && usQuotes.length > 0) {
      const valid = kioxia.price > 0 && kioxia.dataFreshness !== 'FAILED' && kioxia.dataFreshness !== 'UNAVAILABLE';
      const breakdown = calculateScoreBreakdown(kioxia, usQuotes, news);
      const sig = determineSignal(breakdown.total, kioxia, valid);
      fetchAiComment(kioxia, usQuotes, breakdown, sig.signal, false);
    }
  }, [kioxia, usQuotes, news, fetchAiComment]);
  useEffect(() => {
    const timer = setInterval(() => fetchData(isDemoMode), 30000);
    return () => clearInterval(timer);
  }, [fetchData, isDemoMode]);

  if (!kioxia) return <div className="flex items-center justify-center min-h-screen bg-[#0B0E11] text-gray-200"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><div className="text-xs font-mono text-gray-400">KIOXIA SIGNAL リアルタイム市場エンジン起動中...</div></div></div>;

  const isDataValid = kioxia.price > 0 && kioxia.dataFreshness !== 'FAILED';
  const scoreBreakdown = calculateScoreBreakdown(kioxia, usQuotes, news);
  const signalInfo = determineSignal(scoreBreakdown.total, kioxia, isDataValid);
  const marketRegime = determineMarketRegime(usQuotes);
  const buyCandidates = calculateBuyCandidates(kioxia);
  const chasingRisk = assessChasingRisk(kioxia);
  const dropAssessment = assessRapidDrop(kioxia, usQuotes, news);

  return (
    <div className="min-h-screen w-full bg-[#0B0E11] text-gray-200 font-sans flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      <Header kioxia={kioxia} marketRegime={marketRegime} isRefreshing={isRefreshing} onRefresh={() => fetchData(isDemoMode)} onOpenPortfolio={() => setIsPortfolioOpen(true)} onOpenBacktest={() => setIsBacktestOpen(true)} onOpenAlerts={() => setIsAlertsOpen(true)} onOpenBreakdown={() => setIsScoreBreakdownOpen(true)} onOpenDataSources={() => setIsDataSourcesOpen(true)} isLiveMode={!isDemoMode} onToggleLiveMode={() => { const nextMode = !isDemoMode; setIsDemoMode(nextMode); fetchData(nextMode); }} />

      <main className="flex-1 p-2 max-w-[1720px] w-full mx-auto flex flex-col gap-2">
        <ThreeTierPricePanel kioxia={kioxia} usQuotes={usQuotes} news={news} isDemoMode={isDemoMode} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-2">
            <SignalScoreCard signalInfo={signalInfo} scoreBreakdown={scoreBreakdown} buyCandidates={buyCandidates} chasingRisk={chasingRisk} dropAssessment={dropAssessment} onOpenBreakdown={() => setIsScoreBreakdownOpen(true)} />
            <AiCommentCard aiComment={aiComment} isLoading={isAiLoading} onRefreshComment={() => fetchAiComment(kioxia, usQuotes, scoreBreakdown, signalInfo.signal, true)} />
          </div>
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-2 min-w-0">
            <PriceKeyMetrics kioxia={kioxia} />
            <CandleChart intraday5m={kioxia.intraday5m} hourly1h={kioxia.hourly1h} daily1d={kioxia.daily1d} currentPrice={kioxia.price} currentVwap={kioxia.vwap} />
            <React.Suspense fallback={<section className="bg-[#161B22] border border-gray-800 rounded p-3 text-xs text-gray-400">定量予測グラフを読み込み中...</section>}><ForecastRangeChart kioxia={kioxia} /></React.Suspense>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <UsSemiMarket quotes={usQuotes} />
          <NewsFeed news={news} />
        </div>
      </main>

      <div className="fixed right-3 bottom-3 z-50 flex items-center gap-1 rounded-md border border-gray-700 bg-[#161B22]/95 p-1 shadow-lg backdrop-blur" aria-label="文字サイズ変更">
        <span className="px-1 text-[10px] text-gray-400">文字</span>
        <button type="button" onClick={() => setFontScaleIndex((i) => Math.max(0, i - 1))} disabled={fontScaleIndex === 0} className="min-w-8 rounded border border-gray-700 px-2 py-1 text-sm font-bold hover:bg-gray-700 disabled:opacity-30" aria-label="文字を小さくする">A−</button>
        <button type="button" onClick={() => setFontScaleIndex(STANDARD_FONT_SCALE_INDEX)} className="min-w-10 rounded border border-gray-700 px-2 py-1 text-xs hover:bg-gray-700" aria-label="標準の文字サイズに戻す">標準</button>
        <button type="button" onClick={() => setFontScaleIndex((i) => Math.min(FONT_SCALE_OPTIONS.length - 1, i + 1))} disabled={fontScaleIndex === FONT_SCALE_OPTIONS.length - 1} className="min-w-8 rounded border border-gray-700 px-2 py-1 text-base font-bold hover:bg-gray-700 disabled:opacity-30" aria-label="文字を大きくする">A＋</button>
        <span className="min-w-10 px-1 text-center text-xs tabular-nums text-blue-300">{FONT_SCALE_OPTIONS[fontScaleIndex].label}%</span>
      </div>

      <DisclaimerFooter lastUpdated={kioxia.lastUpdated} />
      <PortfolioModal isOpen={isPortfolioOpen} onClose={() => setIsPortfolioOpen(false)} kioxiaCurrentPrice={kioxia.price} />
      <BacktestModal isOpen={isBacktestOpen} onClose={() => setIsBacktestOpen(false)} />
      <ScoreBreakdownModal isOpen={isScoreBreakdownOpen} onClose={() => setIsScoreBreakdownOpen(false)} breakdown={scoreBreakdown} />
      <AlertSettingsModal isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} kioxiaPrice={kioxia.price} />
      <DataSourcesModal isOpen={isDataSourcesOpen} onClose={() => setIsDataSourcesOpen(false)} isLiveMode={!isDemoMode} />
    </div>
  );
}
