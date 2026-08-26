type Bar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ForecastPoint = {
  horizonMinutes: number;
  predictedReturnPct: number;
  lower68ReturnPct: number;
  upper68ReturnPct: number;
  lower90ReturnPct: number;
  upper90ReturnPct: number;
  upProbability: number;
};

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

function parseBars(chart: any): Bar[] {
  const timestamps: number[] = chart?.timestamp || [];
  const q = chart?.indicators?.quote?.[0] || {};
  return timestamps
    .map((ts, i) => ({
      timestamp: ts * 1000,
      open: Number(q.open?.[i]),
      high: Number(q.high?.[i]),
      low: Number(q.low?.[i]),
      close: Number(q.close?.[i]),
      volume: Number(q.volume?.[i] || 0),
    }))
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

function jstParts(ms: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  let hour = Number(p.hour || 0);
  if (hour === 24) hour = 0;
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    minutes: hour * 60 + Number(p.minute || 0),
  };
}

function featureVector(bars: Bar[], i: number) {
  const c = bars[i].close;
  const ret = (n: number) => i >= n && bars[i - n].close > 0 ? ((c / bars[i - n].close) - 1) * 100 : 0;
  const oneBarReturns: number[] = [];
  for (let k = Math.max(1, i - 11); k <= i; k++) {
    oneBarReturns.push(((bars[k].close / bars[k - 1].close) - 1) * 100);
  }
  const recent = bars.slice(Math.max(0, i - 11), i + 1);
  const meanClose = mean(recent.map((b) => b.close));
  const meanRange = mean(recent.slice(-6).map((b) => ((b.high - b.low) / b.close) * 100));
  const volWindow = bars.slice(Math.max(0, i - 59), i + 1).map((b) => b.volume);
  const volMean = mean(volWindow);
  const volStd = std(volWindow) || 1;
  const volumeZ = (bars[i].volume - volMean) / volStd;
  const currentJst = jstParts(bars[i].timestamp);
  let dayStart = i;
  while (dayStart > 0 && jstParts(bars[dayStart - 1].timestamp).dateKey === currentJst.dateKey) dayStart--;
  const dayOpen = bars[dayStart]?.open || c;
  const dayReturn = ((c / dayOpen) - 1) * 100;
  const sessionProgress = clip((currentJst.minutes - 540) / 390, 0, 1);

  return [
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

function distance(a: number[], b: number[]) {
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

function candidateTarget(bars: Bar[], i: number, horizonBars: number) {
  const j = i + horizonBars;
  if (j >= bars.length) return null;
  const a = jstParts(bars[i].timestamp);
  const b = jstParts(bars[j].timestamp);
  if (a.dateKey !== b.dateKey) return null;
  return ((bars[j].close / bars[i].close) - 1) * 100;
}

function buildForecast(bars: Bar[], currentIndex: number, horizonBars: number, crossAdjustmentPct: number) {
  const currentFeature = featureVector(bars, currentIndex);
  const currentTime = jstParts(bars[currentIndex].timestamp).minutes;
  const candidates: { dist: number; target: number }[] = [];

  for (let i = 60; i < currentIndex - horizonBars; i++) {
    const target = candidateTarget(bars, i, horizonBars);
    if (target === null || !Number.isFinite(target)) continue;
    const t = jstParts(bars[i].timestamp).minutes;
    if (Math.abs(t - currentTime) > 90) continue;
    candidates.push({ dist: distance(currentFeature, featureVector(bars, i)), target });
  }

  candidates.sort((a, b) => a.dist - b.dist);
  const k = Math.min(80, Math.max(24, Math.floor(Math.sqrt(candidates.length) * 2)));
  const nearest = candidates.slice(0, k);
  const weighted = nearest.map((x) => ({ value: x.target, weight: 1 / (0.08 + x.dist * x.dist) }));
  const q10 = weightedQuantile(weighted, 0.10);
  const q16 = weightedQuantile(weighted, 0.16);
  const q50 = weightedQuantile(weighted, 0.50);
  const q84 = weightedQuantile(weighted, 0.84);
  const q90 = weightedQuantile(weighted, 0.90);
  const totalW = weighted.reduce((s, x) => s + x.weight, 0) || 1;
  const upW = weighted.filter((x) => x.value > 0).reduce((s, x) => s + x.weight, 0);
  const horizonMinutes = horizonBars * 5;
  const adj = crossAdjustmentPct * (horizonMinutes / 60);

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
      // Missing cross-market inputs reduce confidence but never fabricate data.
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

function walkForwardBacktest(bars: Bar[], horizonBars: number) {
  const eligible: number[] = [];
  for (let i = 120; i < bars.length - horizonBars; i++) {
    if (candidateTarget(bars, i, horizonBars) !== null) eligible.push(i);
  }
  const tests = eligible.slice(-80);
  const errors: number[] = [];
  let correctDirection = 0;
  let covered68 = 0;
  let used = 0;

  for (const testIndex of tests) {
    const testFeature = featureVector(bars, testIndex);
    const testTime = jstParts(bars[testIndex].timestamp).minutes;
    const pool: { dist: number; target: number }[] = [];
    for (let i = 60; i < testIndex - horizonBars; i++) {
      const target = candidateTarget(bars, i, horizonBars);
      if (target === null) continue;
      if (Math.abs(jstParts(bars[i].timestamp).minutes - testTime) > 90) continue;
      pool.push({ dist: distance(testFeature, featureVector(bars, i)), target });
    }
    pool.sort((a, b) => a.dist - b.dist);
    const nearest = pool.slice(0, 50);
    if (nearest.length < 15) continue;
    const weighted = nearest.map((x) => ({ value: x.target, weight: 1 / (0.08 + x.dist * x.dist) }));
    const pred = weightedQuantile(weighted, 0.5);
    const lo = weightedQuantile(weighted, 0.16);
    const hi = weightedQuantile(weighted, 0.84);
    const actual = candidateTarget(bars, testIndex, horizonBars)!;
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
    let chart: any;
    let sourceRange = '60d';
    try {
      chart = await fetchYahooChart('285A.T', '5m', '60d');
    } catch {
      sourceRange = '30d';
      chart = await fetchYahooChart('285A.T', '5m', '30d');
    }

    const bars = parseBars(chart);
    if (bars.length < 250) {
      return res.status(503).json({ error: 'Insufficient 5-minute history', barCount: bars.length });
    }

    const currentIndex = bars.length - 1;
    const cross = await getCrossMarketAdjustment();
    const horizons = [6, 12, 24].map((h) => buildForecast(bars, currentIndex, h, cross.adjustmentPerHourPct)) as Array<ForecastPoint & { neighborCount: number; avgDistance: number }>;
    const backtest = walkForwardBacktest(bars, 12);
    const avgDistance = mean(horizons.map((h) => h.avgDistance));
    let confidence: 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
    if (bars.length >= 1500 && (backtest.samples || 0) >= 40 && (backtest.directionAccuracyPct || 0) >= 54 && avgDistance < 1.8) confidence = 'HIGH';
    else if (bars.length >= 700 && (backtest.samples || 0) >= 25 && avgDistance < 2.4) confidence = 'MODERATE';

    return res.status(200).json({
      model: 'KIOXIA Multi-Horizon Ensemble Forecast v1',
      generatedAt: new Date().toISOString(),
      source: 'Yahoo Finance 285A.T 5-minute history + current cross-market overlay',
      sourceRange,
      historicalBarCount: bars.length,
      currentReferencePrice: bars[currentIndex].close,
      currentReferenceTime: bars[currentIndex].timestamp,
      horizons,
      backtest,
      confidence,
      crossMarket: cross,
      notes: [
        'Core model is time-of-day matched k-nearest-neighbor analog forecasting on 5-minute OHLCV features.',
        'Prediction bands are empirical neighbor quantiles, not guaranteed price limits.',
        'Cross-market adjustment is deliberately capped to reduce overreaction to US market moves.',
        'PTS display may re-anchor return forecasts to the latest validated PTS price; PTS-specific historical sample remains limited.',
      ],
    });
  } catch (error: any) {
    console.error('Forecast API error:', error);
    return res.status(500).json({ error: 'Forecast model failed', message: error?.message || String(error) });
  }
}
