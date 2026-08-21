import React from 'react';
import { ArrowUpRight, ArrowDownRight, Activity, TrendingUp, BarChart, Layers } from 'lucide-react';
import { KioxiaMarketData } from '../types';

interface PriceKeyMetricsProps {
  kioxia: KioxiaMarketData;
}

export const PriceKeyMetrics: React.FC<PriceKeyMetricsProps> = ({ kioxia }) => {
  const isPositive = kioxia.change >= 0;
  const isAboveVwap = kioxia.price >= kioxia.vwap;
  const vwapDiff = kioxia.price - kioxia.vwap;
  const vwapDiffPercent = Number(((vwapDiff / kioxia.vwap) * 100).toFixed(2));

  return (
    <section id="price-key-metrics" className="bg-[#161B22] border border-gray-800 rounded p-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {/* 1. Price */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800/80 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>現在値 (285A)</span>
            <span className="text-[9px] text-gray-500 font-mono">TSE Prime</span>
          </div>
          <div className="my-0.5">
            <span className="text-2xl font-black text-white font-mono tracking-tight">
              {kioxia.price > 0 ? kioxia.price.toLocaleString() : '---'}
            </span>
            <span className="text-xs text-gray-400 ml-1 font-mono">円</span>
          </div>
          <div className={`text-xs font-bold font-mono flex items-center ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {kioxia.price > 0 ? (
              <>
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 inline mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 inline mr-0.5" />}
                <span>{isPositive ? `+${kioxia.change}` : kioxia.change} ({isPositive ? `+${kioxia.changePercent}` : kioxia.changePercent}%)</span>
              </>
            ) : (
              <span className="text-gray-500">データ受信待機中</span>
            )}
          </div>
        </div>

        {/* 2. VWAP */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800/80 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>VWAP (売買高加重平均)</span>
            <Activity className="w-3 h-3 text-yellow-400" />
          </div>
          <div className="my-0.5">
            <span className="text-2xl font-black text-yellow-400 font-mono tracking-tight">
              {kioxia.vwap.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 ml-1 font-mono">円</span>
          </div>
          <div className="text-[11px] font-bold font-mono">
            <span className={isAboveVwap ? 'text-emerald-400' : 'text-rose-400'}>
              {isAboveVwap ? `Price > VWAP (+${vwapDiffPercent}%)` : `Price < VWAP (${vwapDiffPercent}%)`}
            </span>
          </div>
        </div>

        {/* 3. Volume vs 20d Avg */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800/80 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>当日出来高</span>
            <BarChart className="w-3 h-3 text-blue-400" />
          </div>
          <div className="my-0.5">
            <span className="text-2xl font-black text-white font-mono tracking-tight">
              {(kioxia.volume / 10000).toFixed(1)}
            </span>
            <span className="text-xs text-gray-400 ml-1 font-mono">万株</span>
          </div>
          <div className="text-[11px] font-bold font-mono text-emerald-400">
            +{kioxia.volumeRatioVs20d.toFixed(1)}% vs 20日平均
          </div>
        </div>

        {/* 4. RSI(14) */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800/80 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>RSI (14期間)</span>
            <TrendingUp className="w-3 h-3 text-amber-400" />
          </div>
          <div className="my-0.5">
            <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              {kioxia.rsi14.toFixed(1)}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono">
            {kioxia.rsi14 >= 70 ? '過熱圏 (70+)' : kioxia.rsi14 <= 30 ? '売られすぎ (30-)' : '健全上昇ゾーン'}
          </div>
        </div>

        {/* 5. MACD & Moving Averages */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800/80 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>MACD / トレンド</span>
            <Layers className="w-3 h-3 text-purple-400" />
          </div>
          <div className="my-0.5">
            <span className="text-base font-bold text-emerald-400 font-mono">
              +{kioxia.macd.histogram.toFixed(1)}
            </span>
            <span className="text-[10px] text-gray-400 ml-1 font-mono">Hist</span>
          </div>
          <div className="text-[10px] text-gray-300 font-mono truncate">
            5MA &gt; 20MA &gt; 75MA (PO)
          </div>
        </div>

        {/* 6. Intraday Range / ATR */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800/80 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center justify-between">
            <span>日中レンジ / ATR</span>
            <span className="text-[9px] text-gray-500 font-mono">14D: {kioxia.atr14}円</span>
          </div>
          <div className="my-0.5 text-[11px] font-mono text-gray-300 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-gray-500">始値:</span>
              <span>{kioxia.open.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">高値/安値:</span>
              <span className="text-emerald-400">{kioxia.high}</span>
              <span className="text-gray-600">/</span>
              <span className="text-rose-400">{kioxia.low}</span>
            </div>
          </div>
          <div className="text-[10px] text-gray-400 font-mono">
            値幅: {kioxia.high - kioxia.low}円 ({(((kioxia.high - kioxia.low) / kioxia.open) * 100).toFixed(1)}%)
          </div>
        </div>
      </div>
    </section>
  );
};
