import React, { useState } from 'react';
import { OHLCV } from '../types';

interface CandleChartProps {
  intraday5m: OHLCV[];
  hourly1h: OHLCV[];
  daily1d: OHLCV[];
  currentPrice: number;
  currentVwap: number;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  intraday5m,
  hourly1h,
  daily1d,
  currentPrice,
  currentVwap,
}) => {
  const [timeframe, setTimeframe] = useState<'5m' | '1h' | '1d'>('5m');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const data = timeframe === '5m' ? intraday5m : timeframe === '1h' ? hourly1h : daily1d;

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#161B22] border border-gray-800 rounded p-4 text-center text-gray-500 text-xs">
        チャートデータ取得中...
      </div>
    );
  }

  // Calculate scales
  const prices = data.flatMap((d) => [d.high, d.low, d.vwap, d.ma20 || d.close, d.ma75 || d.close]);
  const minPrice = Math.min(...prices) * 0.998;
  const maxPrice = Math.max(...prices) * 1.002;
  const priceRange = maxPrice - minPrice || 1;

  const maxVolume = Math.max(...data.map((d) => d.volume)) * 1.15 || 1;

  const width = 600;
  const mainHeight = 150;
  const volHeight = 40;
  const paddingX = 30;

  const getX = (index: number) => {
    if (data.length <= 1) return paddingX;
    return paddingX + (index / (data.length - 1)) * (width - paddingX * 2);
  };

  const getY = (val: number) => {
    return mainHeight - ((val - minPrice) / priceRange) * (mainHeight - 15) - 8;
  };

  const getVolY = (vol: number) => {
    return volHeight - (vol / maxVolume) * volHeight;
  };

  // Build SVG Path for VWAP
  const vwapPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.vwap)}`)
    .join(' ');

  // Build SVG Path for MA20
  const ma20Path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.ma20 || d.close)}`)
    .join(' ');

  // Build SVG Path for MA75
  const ma75Path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.ma75 || d.close)}`)
    .join(' ');

  const activeItem = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : data[data.length - 1];

  return (
    <section id="kioxia-candle-chart" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
      {/* Chart Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 pb-1 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            キオクシア テクニカルチャート
          </span>

          {/* Timeframe selector */}
          <div className="flex bg-[#0B0E11] p-0.5 rounded border border-gray-800">
            <button
              onClick={() => setTimeframe('5m')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                timeframe === '5m' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              5分足 (5m)
            </button>
            <button
              onClick={() => setTimeframe('1h')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                timeframe === '1h' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              1時間足 (1h)
            </button>
            <button
              onClick={() => setTimeframe('1d')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                timeframe === '1d' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              日足 (1D)
            </button>
          </div>
        </div>

        {/* Legend Indicators */}
        <div className="flex items-center gap-3 text-[9px] font-mono">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-0.5 bg-yellow-400"></div>
            <span className="text-yellow-400 font-semibold">VWAP ({activeItem.vwap}円)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-0.5 bg-blue-400"></div>
            <span className="text-blue-400">20MA</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-0.5 bg-purple-400"></div>
            <span className="text-purple-400">75MA</span>
          </div>
        </div>
      </div>

      {/* Active Candle Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-gray-400 bg-[#0D1117] px-2 py-1 rounded mb-1">
        <span>時刻: <strong className="text-gray-200">{activeItem.time}</strong></span>
        <span>始値: <strong className="text-gray-200">{activeItem.open}</strong></span>
        <span>高値: <strong className="text-emerald-400">{activeItem.high}</strong></span>
        <span>安値: <strong className="text-rose-400">{activeItem.low}</strong></span>
        <span>終値: <strong className={activeItem.close >= activeItem.open ? 'text-emerald-400' : 'text-rose-400'}>{activeItem.close}</strong></span>
        <span>出来高: <strong className="text-gray-200">{activeItem.volume.toLocaleString()}</strong></span>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${mainHeight + volHeight + 15}`}
          className="w-full h-auto cursor-crosshair"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Horizontal Grid lines */}
          {[0.2, 0.5, 0.8].map((ratio) => {
            const y = mainHeight * ratio;
            const priceVal = Math.round(maxPrice - ratio * priceRange);
            return (
              <g key={ratio}>
                <line x1={0} y1={y} x2={width} y2={y} stroke="#1F2937" strokeDasharray="3 3" />
                <text x={width - 5} y={y - 2} fill="#6B7280" fontSize="8" textAnchor="end" fontFamily="monospace">
                  {priceVal}
                </text>
              </g>
            );
          })}

          {/* Subchart divider */}
          <line x1={0} y1={mainHeight} x2={width} y2={mainHeight} stroke="#374151" strokeWidth="1" />

          {/* MA Curves */}
          <path d={ma75Path} fill="none" stroke="#A855F7" strokeWidth="1.2" opacity="0.75" />
          <path d={ma20Path} fill="none" stroke="#38BDF8" strokeWidth="1.5" opacity="0.9" />
          <path d={vwapPath} fill="none" stroke="#FACC15" strokeWidth="1.8" />

          {/* Candlesticks and Volume Bars */}
          {data.map((d, i) => {
            const x = getX(i);
            const isUp = d.close >= d.open;
            const bodyColor = isUp ? '#22C55E' : '#EF4444';
            const highY = getY(d.high);
            const lowY = getY(d.low);
            const openY = getY(d.open);
            const closeY = getY(d.close);
            const topY = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
            const candleWidth = Math.max(3, (width - paddingX * 2) / data.length * 0.7);

            // Volume bar in subchart
            const volY = mainHeight + 5 + getVolY(d.volume);
            const volH = Math.max(1, (mainHeight + volHeight + 5) - volY);

            return (
              <g
                key={i}
                onMouseEnter={() => setHoverIndex(i)}
                className="hover:opacity-80 transition-opacity"
              >
                {/* Candle Wick */}
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={bodyColor} strokeWidth="1" />
                {/* Candle Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={topY}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={bodyColor}
                  stroke={bodyColor}
                  strokeWidth="0.5"
                  rx="0.5"
                />

                {/* Volume Bar */}
                <rect
                  x={x - candleWidth / 2}
                  y={volY}
                  width={candleWidth}
                  height={volH}
                  fill={isUp ? '#22C55E44' : '#EF444444'}
                  stroke={bodyColor}
                  strokeWidth="0.5"
                />

                {/* X-axis labels */}
                {i % Math.ceil(data.length / 7) === 0 && (
                  <text
                    x={x}
                    y={mainHeight + volHeight + 12}
                    fill="#9CA3AF"
                    fontSize="7.5"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {d.time}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover Crosshair */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={0}
              x2={getX(hoverIndex)}
              y2={mainHeight + volHeight}
              stroke="#60A5FA"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}
        </svg>
      </div>
    </section>
  );
};
