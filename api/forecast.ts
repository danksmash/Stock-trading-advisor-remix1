type Bar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dateKey: string;
  minutes: number;
};

type Feature = number[];

const SCALE = [1.2, 2.0, 3.0, 5.0, 1.6, 2.0, 1.2, 1.6, 3.0, 1.2];

async function fetchYahooChart(symbol: string, interval: string, range: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Yahoo chart HTTP ${response.status} for ${symbol}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);
  return result;
}

function fastJst(ms: number) {
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return {
    dateKey: `${y}-${m}-${day}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

function parseBars(chart: any): Bar[] {
  const timestamps: number[] = chart?.timestamp || [];
  const q = chart?.indicators?.quote?.[0] || {};
  return timestamps
    .map((ts, i) => {
      const timestamp = ts * 1000;
      const jst = fastJst(timestamp);
      return {
        timestamp,
        open: Number(q.open?.[i]),
        high: Number(q.high?.[i]),
        low: Number(q.low?.[i]),
        close: Number(q.close?.[i]),
        volume: Number(q.volume?.[i] || 0),
        dateKey: jst.dateKey,
        minutes: jst.minutes,
      };
    })
    .filter((b) => Number.isFinite(b.open) && Number.isFinite(b.high) && Number.isFinite(b.low) && Number.isFinite(b.close) && b.close > 0);
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function std(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function clip(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function buildFeatures(bars: Bar[]) {
  const features: Feature[] = new Array(bars.length);
  let dayStart = 0;

  for (let i = 0; i < bars.length; i++) {
    if (i === 0 || bars[i].dateKey !== bars[i - 1].dateKey) dayStart = i;
    const c = bars[i].close;
    const ret = (n: number) => i >= n && bars[i - n].close > 0 ? ((c / bars[i - n].close) - 1) * 100 : 0;

    const oneBarReturns: number[] = [];
    for (let k = Math.max(1, i - 11); k <= i; k++) {
      oneBarReturns.push(((bars[k].close / bars[k - 1].close) - 1) * 100);
    }

    const recent = bars.slice(Math.max(0, i - 11), i + 1);
    const meanClose = mean(recent.map((b) => b.close)) || c;
    const meanRange = mean(recent.slice(-6).map((b) => ((b.high - b.low) / b.close) * 100));
    const volWindow = bars.slice(Math.max(0, i - 59), i + 1).map((b) => b.volume);
    const volMean = mean(volWindow);
    const volStd = std(volWindow) || 1;
    const volumeZ = (bars[i].volume - volMean) / volStd;
    const dayOpen = bars[dayStart]?.open || c;
    const dayReturn = ((c / dayOpen) - 1) * 100;
    const sessionProgress = clip((bars[i].minutes - 540) / 390, 0, 1);

    features[i] = [
      ret(1),
      ret(3),
      ret(6),
      ret(12),
      std(oneBarReturns),
      meanRange,
      ((c / meanClose) - 1) * 100,
      clip(volumeZ, -4, 4),
      dayReturn,
      sessionProgress,
    ];
  }

  return features;
}

function distance(a: Feature, b: Feature) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] - b[i]) / SCALE[i];
    sum += d * d;
  }
  return Math.sqrt(sum / a.length);
}

function weightedQuantile(values: { value: number; weight: number }[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, x) => s + x.weight, 0);
  let acc = 0;
  for (const x of sorted) {
    acc += x.weight;
    if (acc >= total * q) return x.value;
  }
  return sorted[sorted.length - 1].value;
}

function makeTargets(bars: Bar[], horizonBars: number) {
  const targets: Array<number | null> = new Array(bars.length).fill(null);
  for (let i = 0; i + horizonBars < bars.length; i++) {
    const j = i + horizonBars;
    if (bars[i].dateKey !== bars[j].dateKey) continue;
    targets[i] = ((bars[j].close / bars[i].close) - 1) * 100;
  }
  return targets;
}

function nearestDistribution(
  bars: Bar[],
  features: Feature[],
  targets: Array<number | null>,
  testIndex: number,
  horizonBars: number,
  maxNeighbors = 60
) {
  const current = features[testIndex];
  const currentTime = bars[testIndex].minutes;
  const candidates: { dist: number; target: number }[] = [];
  const stop = testIndex - horizonBars;

  for (let i = 60; i < stop; i++) {
    const target = targets[i];
    if (target === null || !Number.isFinite(target)) continue;
    if (Math.abs(bars[i].minutes - currentTime) > 90) continue;
    candidates.push({ dist: distance(current, features[i]), target });
  }

  candidates.sort((a, b) => a.dist - b.dist);
  const k = Math.min(maxNeighbors, Math.max(20, Math.floor(Math.sqrt(candidates.length) * 1.5)));
  const nearest = candidates.slice(0, k);
  const weighted = nearest.map((x) => ({ value: x.target, weight: 1 / (0.08 + x.dist * x.dist) }));
  return { nearest, weighted };
}

function forecastOne(
  bars: Bar[],
  features: Feature[],
  targets: Array<number | null>,
  currentIndex: number,
  horizonBars: number,
  crossAdjustmentPerHourPct: number
) {
  const { nearest, weighted } = nearestDistribution(bars, features, targets, currentIndex, horizonBars, 70);
  const q10 = weightedQuantile(weighted, 0.10);
  const q16 = weightedQuantile(weighted, 0.16);
  const q50 = weightedQuantile(weighted, 0.50);
  const q84 = weightedQuantile(weighted, 0.84);
  const q90 = weightedQuantile(weighted, 0.90);
  const totalW = weighted.reduce((s, x) => s + x.weight, 0) || 1;
  const upW = weighted.filter((x) => x.value > 0).reduce((s, x) => s + x.weight, 0);
  const horizonMinutes = horizonBars * 5;
  const adj = crossAdjustmentPerHourPct * (horizonMinutes / 60);

  return {
    horizonMinutes,
    predictedReturnPct: Number((q50 + adj).toFixed(3)),
    lower68ReturnPct: Number((q16 + adj).toFixed(3)),
    upper68ReturnPct: Number((q84 + adj).toFixed(3)),
    lower90ReturnPct: Number((q10 + adj).toFixed(3)),
    upper90ReturnPct: Number((q90 + adj).toFixed(3)),
    upProbability: Number(((upW / totalW) * 100).toFixed(1)),
    neighborCount: nearest.length,
    avgDistance: nearest.length ? Number(mean(nearest.map((x) => x.dist)).toFixed(3)) : 99,
  };
}

async function getCrossMarketAdjustment() {
  const symbols = [
    ['^SOX', 0.30],
    ['NVDA', 0.20],
    ['MU', 0.15],
    ['SNDK', 0.15],
    ['^IXIC', 0.15],
    ['JPY=X', 0.05],
  ] as const;
  let weighted = 0;
  let weightTotal = 0;
  const details: Record<string, number> = {};

  await Promise.all(symbols.map(async ([symbol, w]) => {
    try {
      const chart = await fetchYahooChart(symbol, '1d', '5d');
      const meta = chart.meta || {};
      const price = Number(meta.regularMarketPrice || meta.chartPreviousClose || 0);
      const prev = Number(meta.previousClose || meta.chartPreviousClose || 0);
      if (price > 0 && prev > 0) {
        let pct = ((price / prev) - 1) * 100;
        if (symbol === 'JPY=X') pct *= 0.5;
        pct = clip(pct, -8, 8);
        weighted += pct * w;
        weightTotal += w;
        details[symbol] = Number(pct.toFixed(2));
      }
    } catch {
      // Missing inputs lower coverage instead of creating substitute values.
    }
  }));

  const score = weightTotal ? weighted / weightTotal : 0;
  return {
    score: Number(score.toFixed(3)),
    adjustmentPerHourPct: Number(clip(score * 0.035, -0.25, 0.25).toFixed(3)),
    details,
    coverage: Number(weightTotal.toFixed(2)),
  };
}

function walkForwardBacktest(bars: Bar[], features: Feature[], targets: Array<number | null>, horizonBars: number) {
  const eligible: number[] = [];
  for (let i = 180; i < bars.length - horizonBars; i++) {
    if (targets[i] !== null) eligible.push(i);
  }
  const tests = eligible.slice(-32);
  const errors: number[] = [];
  let correctDirection = 0;
  let covered68 = 0;
  let used = 0;

  for (const testIndex of tests) {
    const { nearest, weighted } = nearestDistribution(bars, features, targets, testIndex, horizonBars, 40);
    if (nearest.length < 15) continue;
    const pred = weightedQuantile(weighted, 0.50);
    const lo = weightedQuantile(weighted, 0.16);
    const hi = weightedQuantile(weighted, 0.84);
    const actual = targets[testIndex]!;
    errors.push(Math.abs(pred - actual));
    if ((pred >= 0) === (actual >= 0)) correctDirection++;
    if (actual >= lo && actual <= hi) covered68++;
    used++;
  }

  return {
    samples: used,
    maePct: used ? Number(mean(errors).toFixed(3)) : null,
    directionAccuracyPct: used ? Number(((correctDirection / used) * 100).toFixed(1)) : null,
    interval68CoveragePct: used ? Number(((covered68 / used) * 100).toFixed(1)) : null,
    methodology: 'walk-forward only; each prediction uses strictly earlier observations',
  };
}

export default async function handler(_req: any, res: any) {
  try {
    const [chart, cross] = await Promise.all([
      fetchYahooChart('285A.T', '5m', '30d'),
      getCrossMarketAdjustment(),
    ]);

    const bars = parseBars(chart);
    if (bars.length < 250) {
      return res.status(503).json({ error: 'Insufficient 5-minute history', barCount: bars.length });
    }

    const features = buildFeatures(bars);
    const currentIndex = bars.length - 1;
    const horizonBarsList = [6, 12, 24];
    const targetMap = new Map<number, Array<number | null>>();
    for (const h of horizonBarsList) targetMap.set(h, makeTargets(bars, h));

    const horizons = horizonBarsList.map((h) =>
      forecastOne(bars, features, targetMap.get(h)!, currentIndex, h, cross.adjustmentPerHourPct)
    );

    const backtestTargets = targetMap.get(12)!;
    const backtest = walkForwardBacktest(bars, features, backtestTargets, 12);
    const avgDistance = mean(horizons.map((h) => h.avgDistance));

    let confidence: 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
    if (bars.length >= 1200 && (backtest.samples || 0) >= 25 && (backtest.directionAccuracyPct || 0) >= 54 && avgDistance < 1.8) confidence = 'HIGH';
    else if (bars.length >= 600 && (backtest.samples || 0) >= 20 && avgDistance < 2.5) confidence = 'MODERATE';

    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=120');
    return res.status(200).json({
      model: 'KIOXIA Multi-Horizon Ensemble Forecast v1.1',
      generatedAt: new Date().toISOString(),
      source: 'Yahoo Finance 285A.T 5-minute history + current cross-market overlay',
      sourceRange: '30d',
      historicalBarCount: bars.length,
      currentReferencePrice: bars[currentIndex].close,
      currentReferenceTime: bars[currentIndex].timestamp,
      horizons,
      backtest,
      confidence,
      crossMarket: cross,
      notes: [
        'Core model uses time-of-day matched nearest-neighbor analogs on 5-minute OHLCV features.',
        'Prediction bands are empirical weighted quantiles, not guaranteed limits.',
        'Cross-market adjustment is capped to limit overreaction.',
        'PTS display can re-anchor the return forecast to the latest validated PTS price.',
      ],
    });
  } catch (error: any) {
    console.error('Forecast API error:', error);
    return res.status(500).json({ error: 'Forecast model failed', message: error?.message || String(error) });
  }
}
