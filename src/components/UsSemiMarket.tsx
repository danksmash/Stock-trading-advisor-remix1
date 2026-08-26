import React from 'react';
import { Cpu, DollarSign, Calendar, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';
import { UsSemiQuote } from '../types';

interface UsSemiMarketProps {
  quotes: UsSemiQuote[];
}

export const UsSemiMarket: React.FC<UsSemiMarketProps> = ({ quotes }) => {
  const nvda = quotes.find((q) => q.symbol === 'NVDA');
  const mu = quotes.find((q) => q.symbol === 'MU');
  const sndk = quotes.find((q) => q.symbol === 'SNDK');
  const sox = quotes.find((q) => q.symbol === '^SOX');
  const otherQuotes = quotes.filter((q) => !['NVDA', 'MU', 'SNDK', '^SOX'].includes(q.symbol));

  const getFreshnessBadge = (freshness: string) => {
    switch (freshness) {
      case 'LIVE':
        return <span className="text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1 py-0.2 rounded font-mono">🟢 最新</span>;
      case 'MINUTES_AGO':
        return <span className="text-[8px] bg-yellow-950 text-yellow-400 border border-yellow-800/60 px-1 py-0.2 rounded font-mono">🟡 数分前</span>;
      default:
        return <span className="text-[8px] bg-gray-800 text-gray-400 px-1 py-0.2 rounded font-mono">🟠 遅延</span>;
    }
  };

  return (
    <section id="us-semi-market-section" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
      {/* Section Title */}
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-800">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-green-400" />
          <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">
            米国半導体 & マクロ市況（リアルタイム連動）
          </h2>
        </div>
        <span className="text-[9px] text-gray-500 font-mono">
          {quotes[0]?.lastUpdated ? `更新: ${quotes[0].lastUpdated}` : '米国株式・為替 (EDT/EST)'}
        </span>
      </div>

      {/* Primary Semiconductor Focus: NVIDIA Card */}
      {nvda && (
        <div className="bg-[#0D1117] border border-emerald-800/40 rounded p-2 mb-2">
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-black font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700/60">
                NVDA
              </span>
              <span className="text-xs font-bold text-gray-200 truncate">NVIDIA Corporation</span>
            </div>
            {getFreshnessBadge(nvda.freshness)}
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-1 mt-1.5 min-w-0">
            <div className="min-w-0">
              <span className="text-xl font-black font-mono text-white">${nvda.price.toFixed(2)}</span>
              <span className={`text-xs font-bold font-mono ml-1.5 ${nvda.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {nvda.change >= 0 ? `+${nvda.change.toFixed(2)}` : nvda.change.toFixed(2)} ({nvda.changePercent >= 0 ? `+${nvda.changePercent.toFixed(2)}` : nvda.changePercent.toFixed(2)}%)
              </span>
            </div>
            {nvda.afterHoursPrice && (
              <div className="text-right text-[10px] font-mono text-gray-400">
                時間外: <strong className={nvda.afterHoursChangePercent && nvda.afterHoursChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${nvda.afterHoursPrice} ({nvda.afterHoursChangePercent && nvda.afterHoursChangePercent >= 0 ? `+${nvda.afterHoursChangePercent}` : nvda.afterHoursChangePercent}%)</strong>
              </div>
            )}
          </div>

          {/* NVIDIA Consensus & Earnings Details */}
          {nvda.details && (
            <div className="mt-1.5 pt-1.5 border-t border-gray-800/80 grid grid-cols-2 gap-1 text-[9px] font-mono text-gray-400">
              <div>
                次回決算日: <strong className="text-gray-200">{nvda.details.nextEarningsDate}</strong>
              </div>
              <div className="text-right">
                売上予想: <strong className="text-gray-200">{nvda.details.revenueConsensus}</strong>
              </div>
              <div>
                EPS予想: <strong className="text-gray-200">{nvda.details.epsConsensus}</strong>
              </div>
              <div className="text-right text-gray-500">
                出所: {nvda.details.source}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Memory Peers & SOX Index */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 mb-2 min-w-0">
        {/* SOX Index */}
        {sox && (
          <div className="bg-[#0D1117] p-1.5 rounded border border-gray-800 flex justify-between items-center min-w-0 gap-1">
            <div className="min-w-0">
              <div className="text-[10px] font-bold font-mono text-blue-400">SOX 半導体指数</div>
              <div className="text-xs font-black font-mono text-white">{sox.price.toLocaleString()}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-[10px] font-mono font-bold ${sox.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{sox.changePercent >= 0 ? '+' : ''}{sox.changePercent.toFixed(2)}%</div>
              {getFreshnessBadge(sox.freshness)}
            </div>
          </div>
        )}

        {/* Micron (MU) */}
        {mu && (
          <div className="bg-[#0D1117] p-1.5 rounded border border-gray-800 flex justify-between items-center min-w-0 gap-1">
            <div className="min-w-0">
              <div className="text-[10px] font-bold font-mono text-purple-400">Micron (MU)</div>
              <div className="text-xs font-black font-mono text-white">${mu.price.toFixed(2)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-[10px] font-mono font-bold ${mu.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{mu.changePercent >= 0 ? '+' : ''}{mu.changePercent.toFixed(2)}%</div>
              <span className="text-[8px] text-gray-500 font-mono">DRAM/NAND</span>
            </div>
          </div>
        )}

        {/* Sandisk (independent company since 2025) */}
        {sndk && (
          <div className="bg-[#0D1117] p-1.5 rounded border border-gray-800 flex justify-between items-center min-w-0 gap-1">
            <div className="min-w-0">
              <div className="text-[10px] font-bold font-mono text-cyan-400 truncate">Sandisk (SNDK)</div>
              <div className="text-xs font-black font-mono text-white whitespace-nowrap">${sndk.price.toFixed(2)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-[10px] font-mono font-bold ${sndk.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {sndk.changePercent >= 0 ? '+' : ''}{sndk.changePercent.toFixed(2)}%
              </div>
              <span className="text-[8px] text-gray-500 font-mono">NAND / SSD</span>
            </div>
          </div>
        )}
      </div>

      {/* Dense List for other US Equities, Indices and FX */}
      <div className="space-y-1">
        <div className="text-[9px] font-bold uppercase text-gray-500 tracking-wider">主要マクロ指標・指数・為替</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px] font-mono">
          {otherQuotes.map((q) => {
            const isPos = q.changePercent >= 0;
            return (
              <div
                key={q.symbol}
                className="bg-[#0D1117] px-2 py-1 rounded border border-gray-800/80 flex justify-between items-center min-w-0 gap-1"
              >
                <div className="truncate">
                  <span className="font-bold text-gray-300 mr-1">{q.symbol}</span>
                  <span className="text-[9px] text-gray-500 hidden xl:inline">{q.name.split(' ')[0]}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-gray-200 font-semibold mr-1.5">
                    {q.symbol === 'USD/JPY' ? `${q.price.toFixed(2)}円` : q.symbol === 'US10Y' ? `${q.price.toFixed(2)}%` : q.price.toLocaleString()}
                  </span>
                  <span className={`font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPos ? `+${q.changePercent.toFixed(2)}%` : `${q.changePercent.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
