import React, { useEffect, useMemo, useState } from 'react';
import { OHLCV } from '../types';

interface CandleChartProps {
  intraday5m: OHLCV[];
  hourly1h: OHLCV[];
  daily1d: OHLCV[];
  currentPrice: number;
  currentVwap: number;
}

type Timeframe = '1m3d' | '1h' | '1d';

const formatJstDate = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '日付不明';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).format(new Date(timestamp));
};

const formatJstShortDate = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '--/--';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit',
  }).format(new Date(timestamp));
};

const formatJstDateTime = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(timestamp));
};

const jstDateKey = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'unknown';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.year}-${p.month}-${p.day}`;
};

export const CandleChart: React.FC<CandleChartProps> = ({ hourly1h, daily1d }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('1m3d');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [minuteData, setMinuteData] = useState<OHLCV[]>([]);
  const [minuteLoading, setMinuteLoading] = useState(true);
  const [minuteError, setMinuteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setMinuteLoading(true);
      setMinuteError('');
      try {
        const response = await fetch('/api/market/kioxia-intraday-1m', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!cancelled) {
          const bars = Array.isArray(payload?.data) ? payload.data : [];
          setMinuteData(bars);
          if (!bars.length) setMinuteError('直近3取引日の1分足データがありません');
        }
      } catch (error) {
        if (!cancelled) setMinuteError(`1分足データ取得失敗: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (!cancelled) setMinuteLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const data = timeframe === '1m3d' ? minuteData : timeframe === '1h' ? hourly1h : daily1d;

  const dayGroups = useMemo(() => {
    if (!data?.length) return [] as { key: string; start: number; end: number; timestamp: number }[];
    const groups: { key: string; start: number; end: number; timestamp: number }[] = [];
    data.forEach((bar, index) => {
      const key = jstDateKey(bar.timestamp);
      const previous = groups[groups.length - 1];
      if (!previous || previous.key !== key) groups.push({ key, start: index, end: index, timestamp: bar.timestamp });
      else previous.end = index;
    });
    return groups;
  }, [data]);

  if (timeframe === '1m3d' && minuteLoading && !minuteData.length) {
    return <div className="bg-[#161B22] border border-gray-800 rounded p-4 text-center text-gray-400 text-xs">直近3取引日の1分足を取得中...</div>;
  }
  if (!data || data.length === 0) {
    return <div className="bg-[#161B22] border border-gray-800 rounded p-4 text-center text-rose-300 text-xs">{minuteError || 'チャートデータを取得できません'}</div>;
  }

  // Price axis is recalculated from the high/low of the data currently displayed.
  // This avoids a fixed scale and keeps the chart readable as the price regime changes.
  const rawMin = Math.min(...data.map((d) => d.low));
  const rawMax = Math.max(...data.map((d) => d.high));
  const rawSpan = Math.max(1, rawMax - rawMin);
  const padding = Math.max(30, rawSpan * 0.08, rawMax * 0.001);
  const minPrice = Math.max(0, Math.floor((rawMin - padding) / 10) * 10);
  const maxPrice = Math.ceil((rawMax + padding) / 10) * 10;
  const priceRange = Math.max(1, maxPrice - minPrice);
  const maxVolume = Math.max(...data.map((d) => d.volume), 1) * 1.12;

  const width = 900;
  const mainHeight = 240;
  const volHeight = 52;
  const bottomLabelHeight = 26;
  const paddingX = 42;
  const chartWidth = width - paddingX * 2;
  const getX = (i: number) => data.length <= 1 ? paddingX : paddingX + (i / (data.length - 1)) * chartWidth;
  const getY = (v: number) => mainHeight - ((v - minPrice) / priceRange) * (mainHeight - 20) - 10;
  const getVolY = (v: number) => volHeight - (v / maxVolume) * volHeight;

  const segmentedPath = (getter: (bar: OHLCV) => number) => data.map((d, i) => {
    const startsNewDay = i === 0 || jstDateKey(data[i - 1].timestamp) !== jstDateKey(d.timestamp);
    return `${startsNewDay ? 'M' : 'L'} ${getX(i)} ${getY(getter(d))}`;
  }).join(' ');
  const vwapPath = segmentedPath((d) => d.vwap);
  const ma20Path = segmentedPath((d) => d.ma20 || d.close);
  const ma75Path = segmentedPath((d) => d.ma75 || d.close);

  const activeItem = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : data[data.length - 1];
  const first = data[0];
  const last = data[data.length - 1];
  const periodLabel = timeframe === '1m3d'
    ? `${dayGroups.length}取引日：${formatJstDate(first.timestamp)} ～ ${formatJstDate(last.timestamp)}`
    : `${formatJstDate(first.timestamp)} ～ ${formatJstDate(last.timestamp)}`;

  const candleWidth = timeframe === '1m3d'
    ? Math.max(0.45, Math.min(1.2, (chartWidth / data.length) * 0.78))
    : Math.max(1.2, Math.min(5, (chartWidth / data.length) * 0.72));

  return (
    <section id="kioxia-candle-chart" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1 pb-1 border-b border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">キオクシア テクニカルチャート</span>
          <div className="flex bg-[#0B0E11] p-0.5 rounded border border-gray-800">
            {([['1m3d','1分足・直近3取引日'],['1h','1時間足 (1h)'],['1d','日足 (1D)']] as const).map(([key,label]) => (
              <button key={key} onClick={() => { setTimeframe(key); setHoverIndex(null); }} className={`text-[10px] font-mono px-2 py-0.5 rounded ${timeframe===key?'bg-blue-600 text-white font-bold':'text-gray-400 hover:text-gray-200'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono">
          <span className="rounded border border-cyan-900/60 bg-cyan-950/30 px-1.5 py-0.5 text-cyan-300">価格軸：自動 ¥{minPrice.toLocaleString()}～¥{maxPrice.toLocaleString()}</span>
          <span className="text-yellow-400 font-semibold">━ VWAP</span><span className="text-blue-400">━ 20MA</span><span className="text-purple-400">━ 75MA</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded border border-cyan-900/60 bg-cyan-950/20 px-2 py-1.5 mb-1.5 text-[10px]">
        <div><span className="font-bold text-cyan-300">表示データ：</span><span className="font-semibold text-gray-100">{periodLabel}</span></div>
        <div className="text-gray-400">最新足：<strong className="text-gray-200">{formatJstDateTime(last.timestamp)} JST</strong>　｜　{data.length.toLocaleString()}本</div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-gray-400 bg-[#0D1117] px-2 py-1 rounded mb-1">
        <span>日時: <strong className="text-gray-200">{formatJstDateTime(activeItem.timestamp)}</strong></span>
        <span>始値: <strong className="text-gray-200">{activeItem.open.toLocaleString()}</strong></span>
        <span>高値: <strong className="text-emerald-400">{activeItem.high.toLocaleString()}</strong></span>
        <span>安値: <strong className="text-rose-400">{activeItem.low.toLocaleString()}</strong></span>
        <span>終値: <strong className={activeItem.close>=activeItem.open?'text-emerald-400':'text-rose-400'}>{activeItem.close.toLocaleString()}</strong></span>
        <span>出来高: <strong className="text-gray-200">{activeItem.volume.toLocaleString()}</strong></span>
      </div>

      <div className="relative w-full overflow-hidden select-none">
        <svg viewBox={`0 0 ${width} ${mainHeight + volHeight + bottomLabelHeight}`} className="w-full h-auto cursor-crosshair" onMouseLeave={() => setHoverIndex(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = 10 + (mainHeight - 20) * ratio;
            const priceVal = Math.round(maxPrice - ratio * priceRange);
            return <g key={ratio}><line x1={paddingX} y1={y} x2={width-paddingX} y2={y} stroke="#1F2937" strokeDasharray="3 3"/><text x={width-4} y={y+3} fill="#9CA3AF" fontSize="8" textAnchor="end" fontFamily="monospace">¥{priceVal.toLocaleString()}</text></g>;
          })}

          {timeframe === '1m3d' && dayGroups.slice(1).map((group) => {
            const x = getX(group.start);
            return <line key={group.key} x1={x} y1={4} x2={x} y2={mainHeight+volHeight+4} stroke="#64748B" strokeWidth="1" strokeDasharray="5 4" opacity="0.75"/>;
          })}

          <line x1={paddingX} y1={mainHeight} x2={width-paddingX} y2={mainHeight} stroke="#374151" strokeWidth="1"/>
          <path d={ma75Path} fill="none" stroke="#A855F7" strokeWidth="1.2" opacity="0.7"/>
          <path d={ma20Path} fill="none" stroke="#38BDF8" strokeWidth="1.25" opacity="0.85"/>
          <path d={vwapPath} fill="none" stroke="#FACC15" strokeWidth="1.5" opacity="0.95"/>

          {data.map((d, i) => {
            const x = getX(i), up = d.close >= d.open, color = up ? '#22C55E' : '#EF4444';
            const highY = getY(d.high), lowY = getY(d.low), openY = getY(d.open), closeY = getY(d.close);
            const topY = Math.min(openY, closeY), bodyHeight = Math.max(timeframe==='1m3d'?0.55:1.2, Math.abs(closeY-openY));
            const volY = mainHeight + 4 + getVolY(d.volume), volH = Math.max(0.6, mainHeight + volHeight + 4 - volY);
            return <g key={`${d.timestamp}-${i}`} onMouseEnter={() => setHoverIndex(i)}>
              <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth={timeframe==='1m3d'?0.55:0.9}/>
              <rect x={x-candleWidth/2} y={topY} width={candleWidth} height={bodyHeight} fill={color}/>
              <rect x={x-candleWidth/2} y={volY} width={candleWidth} height={volH} fill={up?'#22C55E55':'#EF444455'}/>
            </g>;
          })}

          {timeframe === '1m3d' ? dayGroups.map((group) => {
            const center = getX((group.start + group.end) / 2);
            return <text key={`label-${group.key}`} x={center} y={mainHeight+volHeight+20} fill="#CBD5E1" fontSize="9" textAnchor="middle" fontFamily="monospace">{formatJstShortDate(group.timestamp)}</text>;
          }) : data.map((d, i) => i % Math.ceil(data.length/7) === 0 ? <text key={`x-${i}`} x={getX(i)} y={mainHeight+volHeight+20} fill="#9CA3AF" fontSize="8" textAnchor="middle" fontFamily="monospace">{formatJstShortDate(d.timestamp)}</text> : null)}

          {hoverIndex !== null && <line x1={getX(hoverIndex)} y1={0} x2={getX(hoverIndex)} y2={mainHeight+volHeight} stroke="#60A5FA" strokeDasharray="2 2" strokeWidth="1"/>}
        </svg>
      </div>

      {timeframe === '1m3d' && minuteError && <div className="mt-1 text-[9px] text-amber-300">更新時の注意: {minuteError}（直前に取得済みのデータを表示しています）</div>}
    </section>
  );
};
