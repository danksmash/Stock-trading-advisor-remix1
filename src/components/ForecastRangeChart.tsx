import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BrainCircuit, ShieldCheck, TriangleAlert } from 'lucide-react';
import { KioxiaMarketData } from '../types';

type ForecastApiPoint = {
  horizonMinutes: number;
  predictedReturnPct: number;
  lower68ReturnPct: number;
  upper68ReturnPct: number;
  lower90ReturnPct: number;
  upper90ReturnPct: number;
  upProbability: number;
  neighborCount: number;
  avgDistance: number;
};

type ForecastResponse = {
  model: string;
  generatedAt: string;
  historicalBarCount: number;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  horizons: ForecastApiPoint[];
  backtest: {
    samples: number;
    maePct: number | null;
    directionAccuracyPct: number | null;
    interval68CoveragePct: number | null;
    methodology: string;
  };
  crossMarket: {
    score: number;
    adjustmentPerHourPct: number;
    coverage: number;
  };
};

interface ForecastRangeChartProps {
  kioxia: KioxiaMarketData;
}

function formatFutureTime(minutesAhead: number) {
  const d = new Date(Date.now() + minutesAhead * 60_000);
  return d.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function yen(v: number) {
  return `¥${Math.round(v).toLocaleString('ja-JP')}`;
}

export const ForecastRangeChart: React.FC<ForecastRangeChartProps> = ({ kioxia }) => {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/forecast/kioxia', { cache: 'no-store' });
        if (!res.ok) throw new Error(`forecast HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setForecast(json);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '予測モデルの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const isPtsAnchor =
    kioxia.marketSession === 'PTS SESSION' &&
    kioxia.ptsMarketInfo?.isAvailable &&
    Number(kioxia.ptsMarketInfo.price) > 0;

  const basePrice = isPtsAnchor ? Number(kioxia.ptsMarketInfo.price) : kioxia.price;
  const baseLabel = isPtsAnchor ? 'PTS現在値' : '東証現在値';

  const chartData = useMemo(() => {
    if (!forecast || !basePrice) return [];
    const rows: any[] = [
      {
        label: '現在',
        predicted: basePrice,
        lower68: basePrice,
        upper68: basePrice,
        lower90: basePrice,
        upper90: basePrice,
        upProbability: 50,
      },
    ];

    for (const h of forecast.horizons) {
      const priceFromReturn = (pct: number) => basePrice * (1 + pct / 100);
      rows.push({
        label: formatFutureTime(h.horizonMinutes),
        horizonMinutes: h.horizonMinutes,
        predicted: priceFromReturn(h.predictedReturnPct),
        lower68: priceFromReturn(h.lower68ReturnPct),
        upper68: priceFromReturn(h.upper68ReturnPct),
        lower90: priceFromReturn(h.lower90ReturnPct),
        upper90: priceFromReturn(h.upper90ReturnPct),
        upProbability: h.upProbability,
      });
    }
    return rows;
  }, [forecast, basePrice]);

  const priceDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'] as const;
    const vals = chartData.flatMap((r) => [r.lower90, r.upper90]).filter(Number.isFinite);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.12, basePrice * 0.002);
    return [Math.floor(min - pad), Math.ceil(max + pad)] as [number, number];
  }, [chartData, basePrice]);

  if (loading && !forecast) {
    return (
      <section className="bg-[#161B22] border border-gray-800 rounded p-3 text-xs text-gray-400">
        定量予測モデルを計算中...
      </section>
    );
  }

  if (error && !forecast) {
    return (
      <section className="bg-[#161B22] border border-amber-900/50 rounded p-3 flex gap-2 items-center text-xs text-amber-300">
        <TriangleAlert className="w-4 h-4" />
        予測モデルは一時利用できません。市場データ表示には影響ありません。
      </section>
    );
  }

  if (!forecast) return null;

  const last = chartData[chartData.length - 1];
  const confidenceText = forecast.confidence === 'HIGH' ? '高' : forecast.confidence === 'MODERATE' ? '中' : '低';

  return (
    <section id="forecast-range-chart" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-1.5">
            <BrainCircuit className="w-4 h-4 text-cyan-400" />
            <h2 className="text-[11px] font-bold text-gray-200 tracking-wide">定量モデル・予想株価レンジ</h2>
          </div>
          <p className="text-[9px] text-gray-500 mt-1">
            285A 5分足の過去類似局面 + 時間帯 + OHLCV + 米国半導体連動。点予測ではなく確率レンジを表示。
          </p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className="px-1.5 py-0.5 rounded border border-cyan-800/60 text-cyan-300 bg-cyan-950/30">
            履歴 {forecast.historicalBarCount.toLocaleString()}本
          </span>
          <span className="px-1.5 py-0.5 rounded border border-gray-700 text-gray-300">
            信頼度 {confidenceText}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-[#0D1117] border border-gray-800 rounded p-2">
          <div className="text-[9px] text-gray-500">基準</div>
          <div className="text-sm font-mono font-bold text-white">{yen(basePrice)}</div>
          <div className="text-[9px] text-cyan-400">{baseLabel}</div>
        </div>
        <div className="bg-[#0D1117] border border-gray-800 rounded p-2">
          <div className="text-[9px] text-gray-500">2時間中心予測</div>
          <div className="text-sm font-mono font-bold text-white">{last ? yen(last.predicted) : '---'}</div>
          <div className="text-[9px] text-gray-400">上昇確率 {last?.upProbability?.toFixed?.(1) ?? '---'}%</div>
        </div>
        <div className="bg-[#0D1117] border border-gray-800 rounded p-2">
          <div className="text-[9px] text-gray-500">Walk-forward MAE</div>
          <div className="text-sm font-mono font-bold text-white">{forecast.backtest.maePct != null ? `${forecast.backtest.maePct.toFixed(2)}%` : '---'}</div>
          <div className="text-[9px] text-gray-400">n={forecast.backtest.samples}</div>
        </div>
        <div className="bg-[#0D1117] border border-gray-800 rounded p-2">
          <div className="text-[9px] text-gray-500">方向的中率</div>
          <div className="text-sm font-mono font-bold text-white">{forecast.backtest.directionAccuracyPct != null ? `${forecast.backtest.directionAccuracyPct.toFixed(1)}%` : '---'}</div>
          <div className="text-[9px] text-gray-400">未来データ不使用</div>
        </div>
      </div>

      <div className="h-[260px] w-full bg-[#0D1117] border border-gray-800 rounded p-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252b34" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={{ stroke: '#374151' }} tickLine={false} />
            <YAxis
              domain={priceDomain as any}
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
              tickFormatter={(v) => `¥${Math.round(Number(v) / 100) * 100}`}
              width={62}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 10 }}
              formatter={(value: any, name: any) => [yen(Number(value)), name]}
              labelStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Line type="monotone" dataKey="upper90" name="90%上限" stroke="#6b7280" strokeDasharray="3 4" dot={false} strokeWidth={1} />
            <Line type="monotone" dataKey="upper68" name="68%上限" stroke="#22d3ee" strokeDasharray="4 3" dot={false} strokeWidth={1.2} />
            <Line type="monotone" dataKey="predicted" name="中心予測" stroke="#f8fafc" dot={{ r: 3 }} strokeWidth={2.3} />
            <Line type="monotone" dataKey="lower68" name="68%下限" stroke="#22d3ee" strokeDasharray="4 3" dot={false} strokeWidth={1.2} />
            <Line type="monotone" dataKey="lower90" name="90%下限" stroke="#6b7280" strokeDasharray="3 4" dot={false} strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[9px]">
        <div className="flex items-start gap-1.5 text-gray-400">
          <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          類似局面は時刻±90分で絞り、直近モメンタム・変動率・レンジ・出来高・日中位置を正規化して近傍検索します。
        </div>
        <div className="flex items-start gap-1.5 text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          検証はwalk-forward方式で、各テスト時点より後のデータを学習側に混ぜません。
        </div>
        <div className="flex items-start gap-1.5 text-gray-400">
          <TriangleAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          予測レンジは確率的推定であり保証価格ではありません。PTS時は最新PTS値に予測リターンを再アンカーします。
        </div>
      </div>
    </section>
  );
};
