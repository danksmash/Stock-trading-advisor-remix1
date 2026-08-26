import React, { useState } from 'react';
import { OHLCV } from '../types';

interface CandleChartProps {
  intraday5m: OHLCV[];
  hourly1h: OHLCV[];
  daily1d: OHLCV[];
  currentPrice: number;
  currentVwap: number;
}

const formatJstDate = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '日付不明';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).format(new Date(timestamp));
};

const formatJstDateTime = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(timestamp));
};

export const CandleChart: React.FC<CandleChartProps> = ({ intraday5m, hourly1h, daily1d }) => {
  const [timeframe, setTimeframe] = useState<'5m' | '1h' | '1d'>('5m');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const data = timeframe === '5m' ? intraday5m : timeframe === '1h' ? hourly1h : daily1d;

  if (!data || data.length === 0) return <div className="bg-[#161B22] border border-gray-800 rounded p-4 text-center text-gray-500 text-xs">チャートデータ取得中...</div>;

  const prices = data.flatMap((d) => [d.high, d.low, d.vwap, d.ma20 || d.close, d.ma75 || d.close]);
  const minPrice = Math.min(...prices) * 0.998;
  const maxPrice = Math.max(...prices) * 1.002;
  const priceRange = maxPrice - minPrice || 1;
  const maxVolume = Math.max(...data.map((d) => d.volume)) * 1.15 || 1;
  const width = 600, mainHeight = 150, volHeight = 40, paddingX = 30;
  const getX = (i: number) => data.length <= 1 ? paddingX : paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
  const getY = (v: number) => mainHeight - ((v - minPrice) / priceRange) * (mainHeight - 15) - 8;
  const getVolY = (v: number) => volHeight - (v / maxVolume) * volHeight;
  const vwapPath = data.map((d,i)=>`${i===0?'M':'L'} ${getX(i)} ${getY(d.vwap)}`).join(' ');
  const ma20Path = data.map((d,i)=>`${i===0?'M':'L'} ${getX(i)} ${getY(d.ma20 || d.close)}`).join(' ');
  const ma75Path = data.map((d,i)=>`${i===0?'M':'L'} ${getX(i)} ${getY(d.ma75 || d.close)}`).join(' ');
  const activeItem = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : data[data.length - 1];
  const first = data[0], last = data[data.length - 1];
  const periodLabel = timeframe === '5m'
    ? `${formatJstDate(last.timestamp)} 東証取引日` 
    : `${formatJstDate(first.timestamp)} ～ ${formatJstDate(last.timestamp)}`;

  return (
    <section id="kioxia-candle-chart" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1 pb-1 border-b border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">キオクシア テクニカルチャート</span>
          <div className="flex bg-[#0B0E11] p-0.5 rounded border border-gray-800">
            {([['5m','5分足 (5m)'],['1h','1時間足 (1h)'],['1d','日足 (1D)']] as const).map(([key,label]) => <button key={key} onClick={()=>{setTimeframe(key);setHoverIndex(null);}} className={`text-[10px] font-mono px-2 py-0.5 rounded ${timeframe===key?'bg-blue-600 text-white font-bold':'text-gray-400 hover:text-gray-200'}`}>{label}</button>)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono">
          <span className="text-yellow-400 font-semibold">━ VWAP ({activeItem.vwap}円)</span><span className="text-blue-400">━ 20MA</span><span className="text-purple-400">━ 75MA</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded border border-cyan-900/60 bg-cyan-950/20 px-2 py-1.5 mb-1.5 text-[10px]">
        <div><span className="font-bold text-cyan-300">表示データ：</span><span className="font-semibold text-gray-100">{periodLabel}</span></div>
        <div className="text-gray-400">最新足：<strong className="text-gray-200">{formatJstDateTime(last.timestamp)} JST</strong>　｜　{data.length.toLocaleString()}本</div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-gray-400 bg-[#0D1117] px-2 py-1 rounded mb-1">
        <span>{timeframe==='5m'?'時刻':'日時'}: <strong className="text-gray-200">{timeframe==='5m'?activeItem.time:formatJstDateTime(activeItem.timestamp)}</strong></span>
        <span>始値: <strong className="text-gray-200">{activeItem.open}</strong></span><span>高値: <strong className="text-emerald-400">{activeItem.high}</strong></span><span>安値: <strong className="text-rose-400">{activeItem.low}</strong></span><span>終値: <strong className={activeItem.close>=activeItem.open?'text-emerald-400':'text-rose-400'}>{activeItem.close}</strong></span><span>出来高: <strong className="text-gray-200">{activeItem.volume.toLocaleString()}</strong></span>
      </div>

      <div className="relative w-full overflow-hidden select-none">
        <svg viewBox={`0 0 ${width} ${mainHeight+volHeight+15}`} className="w-full h-auto cursor-crosshair" onMouseLeave={()=>setHoverIndex(null)}>
          {[0.2,0.5,0.8].map(r=>{const y=mainHeight*r;const pv=Math.round(maxPrice-r*priceRange);return <g key={r}><line x1={0} y1={y} x2={width} y2={y} stroke="#1F2937" strokeDasharray="3 3"/><text x={width-5} y={y-2} fill="#6B7280" fontSize="8" textAnchor="end" fontFamily="monospace">{pv}</text></g>})}
          <line x1={0} y1={mainHeight} x2={width} y2={mainHeight} stroke="#374151" strokeWidth="1"/>
          <path d={ma75Path} fill="none" stroke="#A855F7" strokeWidth="1.2" opacity="0.75"/><path d={ma20Path} fill="none" stroke="#38BDF8" strokeWidth="1.5" opacity="0.9"/><path d={vwapPath} fill="none" stroke="#FACC15" strokeWidth="1.8"/>
          {data.map((d,i)=>{const x=getX(i),up=d.close>=d.open,c=up?'#22C55E':'#EF4444',hy=getY(d.high),ly=getY(d.low),oy=getY(d.open),cy=getY(d.close),ty=Math.min(oy,cy),bh=Math.max(1.5,Math.abs(cy-oy)),cw=Math.max(3,(width-paddingX*2)/data.length*0.7),vy=mainHeight+5+getVolY(d.volume),vh=Math.max(1,(mainHeight+volHeight+5)-vy);return <g key={i} onMouseEnter={()=>setHoverIndex(i)} className="hover:opacity-80 transition-opacity"><line x1={x} y1={hy} x2={x} y2={ly} stroke={c} strokeWidth="1"/><rect x={x-cw/2} y={ty} width={cw} height={bh} fill={c} stroke={c} strokeWidth="0.5" rx="0.5"/><rect x={x-cw/2} y={vy} width={cw} height={vh} fill={up?'#22C55E44':'#EF444444'} stroke={c} strokeWidth="0.5"/>{i%Math.ceil(data.length/7)===0&&<text x={x} y={mainHeight+volHeight+12} fill="#9CA3AF" fontSize="7.5" textAnchor="middle" fontFamily="monospace">{timeframe==='5m'?d.time:formatJstDate(d.timestamp).replace(/年|月/g,'/').replace('日','')}</text>}</g>})}
          {hoverIndex!==null&&<line x1={getX(hoverIndex)} y1={0} x2={getX(hoverIndex)} y2={mainHeight+volHeight} stroke="#60A5FA" strokeDasharray="2 2" strokeWidth="1"/>}
        </svg>
      </div>
    </section>
  );
};
