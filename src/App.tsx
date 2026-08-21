import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ThreeTierPricePanel } from './components/ThreeTierPricePanel';
import { SignalScoreCard } from './components/SignalScoreCard';
import { PriceKeyMetrics } from './components/PriceKeyMetrics';
import { CandleChart } from './components/CandleChart';
import { HeatmapMatrix } from './components/HeatmapMatrix';
import { SimilarScenarioCard } from './components/SimilarScenarioCard';
import { AiCommentCard } from './components/AiCommentCard';
import { UsSemiMarket } from './components/UsSemiMarket';
import { NewsFeed } from './components/NewsFeed';
import { PortfolioModal } from './components/PortfolioModal';
import { BacktestModal } from './components/BacktestModal';
import { ScoreBreakdownModal } from './components/ScoreBreakdownModal';
import { AlertSettingsModal } from './components/AlertSettingsModal';
import { DataSourcesModal } from './components/DataSourcesModal';
import { DisclaimerFooter } from './components/DisclaimerFooter';

import {
  RealApiMarketDataProvider,
  RealNewsProvider,
} from './services/marketData';
import {
  calculateScoreBreakdown,
  determineSignal,
  determineMarketRegime,
  calculateBuyCandidates,
  assessChasingRisk,
  assessRapidDrop,
} from './services/analysisEngine';
import { findSimilarScenarios } from './services/statisticsEngine';
import {
  KioxiaMarketData,
  UsSemiQuote,
  NewsItem,
  AiCommentResult,
} from './types';

const marketDataProvider = new RealApiMarketDataProvider();
const newsProvider = new RealNewsProvider();

export default function App() {
  const [kioxia, setKioxia] = useState<KioxiaMarketData | null>(null);
  const [usQuotes, setUsQuotes] = useState<UsSemiQuote[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [aiComment, setAiComment] = useState<AiCommentResult | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Modal States
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isBacktestOpen, setIsBacktestOpen] = useState(false);
  const [isScoreBreakdownOpen, setIsScoreBreakdownOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);

  // Fetch initial data
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

  // Ref to track last AI fetch to prevent rapid quota depletion
  const lastAiFetchRef = React.useRef<{ time: number; key: string }>({ time: 0, key: '' });

  // Fetch AI comment from backend
  const fetchAiComment = useCallback(
    async (
      kData: KioxiaMarketData,
      quotes: UsSemiQuote[],
      scoreBreakdown: any,
      signal: string,
      force = false
    ) => {
      const now = Date.now();
      const currentKey = `${signal}_${Math.round(kData.price / 20) * 20}_${Math.round((scoreBreakdown?.total || 0) / 10) * 10}`;

      // Throttle: don't re-fetch unless forced, or 60s has passed, or key changed
      if (!force && lastAiFetchRef.current.key === currentKey && now - lastAiFetchRef.current.time < 60000) {
        return;
      }

      lastAiFetchRef.current = { time: now, key: currentKey };
      setIsAiLoading(true);
      try {
        const res = await fetch('/api/ai/market-comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kioxia: kData,
            usQuotes: quotes,
            scoreBreakdown,
            signal,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAiComment(data);
        }
      } catch (err) {
        console.error('AI comment API error:', err);
      } finally {
        setIsAiLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(isDemoMode);
  }, [fetchData, isDemoMode]);

  // Trigger AI analysis when market data updates (with intelligent throttling)
  useEffect(() => {
    if (kioxia && usQuotes.length > 0) {
      const isDataValid = kioxia.price > 0 && kioxia.dataFreshness !== 'FAILED' && kioxia.dataFreshness !== 'UNAVAILABLE';
      const breakdown = calculateScoreBreakdown(kioxia, usQuotes, news);
      const sig = determineSignal(breakdown.total, kioxia, isDataValid);
      fetchAiComment(kioxia, usQuotes, breakdown, sig.signal, false);
    }
  }, [kioxia, usQuotes, news, fetchAiComment]);

  // Auto polling simulation (every 30 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData(isDemoMode);
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchData, isDemoMode]);

  if (!kioxia) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0E11] text-gray-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xs font-mono text-gray-400">
            KIOXIA SIGNAL リアルタイム市場エンジン起動中...
          </div>
        </div>
      </div>
    );
  }

  // Real-time Calculations
  const isDataValid = kioxia.price > 0 && kioxia.dataFreshness !== 'FAILED';
  const scoreBreakdown = calculateScoreBreakdown(kioxia, usQuotes, news);
  const signalInfo = determineSignal(scoreBreakdown.total, kioxia, isDataValid);
  const marketRegime = determineMarketRegime(usQuotes);
  const buyCandidates = calculateBuyCandidates(kioxia);
  const chasingRisk = assessChasingRisk(kioxia);
  const dropAssessment = assessRapidDrop(kioxia, usQuotes, news);
  const similarScenario = findSimilarScenarios(kioxia, usQuotes);

  return (
    <div className="min-h-screen w-full bg-[#0B0E11] text-gray-200 font-sans flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* 1. Header Toolbar */}
      <Header
        kioxia={kioxia}
        marketRegime={marketRegime}
        isRefreshing={isRefreshing}
        onRefresh={() => fetchData(isDemoMode)}
        onOpenPortfolio={() => setIsPortfolioOpen(true)}
        onOpenBacktest={() => setIsBacktestOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenBreakdown={() => setIsScoreBreakdownOpen(true)}
        onOpenDataSources={() => setIsDataSourcesOpen(true)}
        isLiveMode={!isDemoMode}
        onToggleLiveMode={() => {
          const nextMode = !isDemoMode;
          setIsDemoMode(nextMode);
          fetchData(nextMode);
        }}
      />

      {/* 2. Main Dashboard Layout */}
      <main className="flex-1 p-2 md:p-3 max-w-[1720px] w-full mx-auto flex flex-col gap-2.5">
        {/* 3-Tier Price Architecture Panel (Previous Close, Tokyo Live, PTS Live) */}
        <ThreeTierPricePanel
          kioxia={kioxia}
          usQuotes={usQuotes}
          news={news}
          isDemoMode={isDemoMode}
        />

        {/* 3-Column Detailed Analysis Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
          {/* Left Column (3 Cols): Giant Signal, Score Breakdown, Target Buy Zones */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-2.5">
            <SignalScoreCard
              signalInfo={signalInfo}
              scoreBreakdown={scoreBreakdown}
              buyCandidates={buyCandidates}
              chasingRisk={chasingRisk}
              dropAssessment={dropAssessment}
              onOpenBreakdown={() => setIsScoreBreakdownOpen(true)}
            />

            {/* AI Market Comment on Left or Desktop */}
            <AiCommentCard
              aiComment={aiComment}
              isLoading={isAiLoading}
              onRefreshComment={() =>
                fetchAiComment(kioxia, usQuotes, scoreBreakdown, signalInfo.signal, true)
              }
            />
          </div>

          {/* Center Column (6 Cols): Price Metrics, Candlestick Chart, Heatmap Matrix, Similar Scenarios */}
          <div className="lg:col-span-8 xl:col-span-6 flex flex-col gap-2.5">
            {/* Key Technical Indicators & VWAP Metrics */}
            <PriceKeyMetrics kioxia={kioxia} />

            {/* Candlestick & VWAP Chart */}
            <CandleChart
              intraday5m={kioxia.intraday5m}
              hourly1h={kioxia.hourly1h}
              daily1d={kioxia.daily1d}
              currentPrice={kioxia.price}
              currentVwap={kioxia.vwap}
            />

            {/* Day x Time Matrix & Day Statistics */}
            <HeatmapMatrix />

            {/* Similar Pattern Outcomes (+30m, +60m, +120m, EOD) */}
            <SimilarScenarioCard scenario={similarScenario} />
          </div>

          {/* Right Column (3 Cols): US Semiconductor, NVDA, Memory News */}
          <div className="lg:col-span-12 xl:col-span-3 flex flex-col gap-2.5">
            {/* US Semiconductor & NVDA & SOX */}
            <UsSemiMarket quotes={usQuotes} />

            {/* NAND / Enterprise SSD / AI Storage News */}
            <NewsFeed news={news} />
          </div>
        </div>
      </main>

      {/* 3. Legal Disclaimers & Timestamp Footer */}
      <DisclaimerFooter lastUpdated={kioxia.lastUpdated} />

      {/* Interactive Modals */}
      <PortfolioModal
        isOpen={isPortfolioOpen}
        onClose={() => setIsPortfolioOpen(false)}
        kioxiaCurrentPrice={kioxia.price}
      />

      <BacktestModal
        isOpen={isBacktestOpen}
        onClose={() => setIsBacktestOpen(false)}
      />

      <ScoreBreakdownModal
        isOpen={isScoreBreakdownOpen}
        onClose={() => setIsScoreBreakdownOpen(false)}
        breakdown={scoreBreakdown}
      />

      <AlertSettingsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        kioxiaPrice={kioxia.price}
      />

      <DataSourcesModal
        isOpen={isDataSourcesOpen}
        onClose={() => setIsDataSourcesOpen(false)}
        isLiveMode={!isDemoMode}
      />
    </div>
  );
}

