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
  return { dateKey: `${y}-${m}-${day}`, minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function parseBars(chart: any): Bar[] {
  const timestamps: number[] = chart?.timestamp || [];
  const q = chart?.indicators?.quote?.[0] || {};
  return timestamps.map((ts, i) => {
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
  }).filter((b) => Number.isFinite(b.open) && Number.isFinite(b.high) && Number.isFinite(b.low) && Number.isFinite(b.close) && b.close > 0);
}

function mean(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function std(values: number[]) { if (values.length < 2) return 0; const m = mean(values); return Math.sqrt(mean(values.map((v) => (v - m) ** 2))); }
function clip(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function buildFeatures(bars: Bar[]) {
  const features: Feature[] = new Array(bars.length);
  let dayStart = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i === 0 || bars[i].dateKey !== bars[i - 1].dateKey) dayStart = i;
    const c = bars[i].close;
    const ret = (n: number) => i >= n && bars[i - n].close > 0 ? ((c / bars[i - n].close) - 1) * 100 : 0;
    const oneBarReturns: number[] = [];
    for (let k = Math.max(1, i - 11); k <= i; k++) oneBarReturns.push(((bars[k].close / bars[k - 1].close) - 1) * 100);
    const recent = bars.slice(Math.max(0, i - 11), i + 1);
    const meanClose = mean(recent.map((b) => b.close)) || c;
    const meanRange = mean(recent.slice(-6).map((b) => ((b.high - b.low) / b.close) * 100));
    const volWindow = bars.slice(Math.max(0, i - 59), i + 1).map((b) => b.volume);
    const volMean = mean(volWindow);
    const volStd = std(volWindow) || 1;
    const dayOpen = bars[dayStart]?.open || c;
    features[i] = [
      ret(1), ret(3), ret(6), ret(12), std(oneBarReturns), meanRange,
      ((c / meanClose) - 1) * 100,
      clip((bars[i].volume - volMean) / volStd, -4, 4),
      ((c / dayOpen) - 1) * 100,
      clip((bars[i].minutes - 540) / 390, 0, 1),
    ];
  }
  return features;
}

function distance(a: Feature, b: Feature) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = (a[i] - b[i]) / SCALE[i]; sum += d * d; }
  return Math.sqrt(sum / a.length);
}

function weightedQuantile(values: { value: number; weight: number }[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, x) => s + x.weight, 0);
  let acc = 0;
  for (const x of sorted) { acc += x.weight; if (acc >= total * q) return x.value; }
  return sorted[sorted.length - 1].value;
}

function summarizeDistribution(weighted: { value: number; weight: number }[], adjustmentPct: number) {
  const totalW = weighted.reduce((s, x) => s + x.weight, 0) || 1;
  const upW = weighted.filter((x) => x.value + adjustmentPct > 0).reduce((s, x) => s + x.weight, 0);
  return {
    predictedReturnPct: Number((weightedQuantile(weighted, 0.50) + adjustmentPct).toFixed(3)),
    lower68ReturnPct: Number((weightedQuantile(weighted, 0.16) + adjustmentPct).toFixed(3)),
    upper68ReturnPct: Number((weightedQuantile(weighted, 0.84) + adjustmentPct).toFixed(3)),
    lower90ReturnPct: Number((weightedQuantile(weighted, 0.10) + adjustmentPct).toFixed(3)),
    upper90ReturnPct: Number((weightedQuantile(weighted, 0.90) + adjustmentPct).toFixed(3)),
    upProbability: Number(((upW / totalW) * 100).toFixed(1)),
  };
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

function nearestDistribution(bars: Bar[], features: Feature[], targets: Array<number | null>, testIndex: number, horizonBars: number, maxNeighbors = 60) {
  const current = features[testIndex];
  const currentTime = bars[testIndex].minutes;
  const candidates: { dist: number; target: number }[] = [];
  for (let i = 60; i < testIndex - horizonBars; i++) {
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

function forecastIntraday(bars: Bar[], features: Feature[], crossAdjustmentPerHourPct: number) {
  const currentIndex = bars.length - 1;
  const possible = [6, 12, 18, 24].filter((h) => bars[currentIndex].minutes + h * 5 <= 930);
  const horizons: any[] = [];
  const targetMap = new Map<number, Array<number | null>>();
  for (const h of possible) {
    const targets = makeTargets(bars, h);
    targetMap.set(h, targets);
    const { nearest, weighted } = nearestDistribution(bars, features, targets, currentIndex, h, 70);
    if (nearest.length < 15) continue;
    horizons.push({
      horizonMinutes: h * 5,
      label: `+${h * 5}分`,
      ...summarizeDistribution(weighted, crossAdjustmentPerHourPct * ((h * 5) / 60)),
      neighborCount: nearest.length,
      avgDistance: Number(mean(nearest.map((x) => x.dist)).toFixed(3)),
    });
  }

  const evalH = possible.includes(12) ? 12 : possible[0];
  let backtest: any = { samples: 0, maePct: null, directionAccuracyPct: null, interval68CoveragePct: null, methodology: 'walk-forward only' };
  if (evalH) {
    const targets = targetMap.get(evalH) || makeTargets(bars, evalH);
    const eligible = bars.map((_, i) => i).filter((i) => i > 180 && i < currentIndex - evalH && targets[i] !== null && Math.abs(bars[i].minutes - bars[currentIndex].minutes) <= 90).slice(-32);
    const errors: number[] = []; let dir = 0; let covered = 0; let used = 0;
    for (const testIndex of eligible) {
      const { nearest, weighted } = nearestDistribution(bars, features, targets, testIndex, evalH, 40);
      if (nearest.length < 12) continue;
      const pred = weightedQuantile(weighted, 0.5); const lo = weightedQuantile(weighted, 0.16); const hi = weightedQuantile(weighted, 0.84); const actual = targets[testIndex]!;
      errors.push(Math.abs(pred - actual)); if ((pred >= 0) === (actual >= 0)) dir++; if (actual >= lo && actual <= hi) covered++; used++;
    }
    backtest = {
      samples: used,
      maePct: used ? Number(mean(errors).toFixed(3)) : null,
      directionAccuracyPct: used ? Number(((dir / used) * 100).toFixed(1)) : null,
      interval68CoveragePct: used ? Number(((covered / used) * 100).toFixed(1)) : null,
      methodology: 'walk-forward only; test predictions use strictly earlier observations',
    };
  }
  return { horizons, backtest, anchor: 'CURRENT_TSE' };
}

function buildDayGroups(bars: Bar[]) {
  const groups: { dateKey: string; indices: number[] }[] = [];
  for (let i = 0; i < bars.length; i++) {
    const last = groups[groups.length - 1];
    if (!last || last.dateKey !== bars[i].dateKey) groups.push({ dateKey: bars[i].dateKey, indices: [i] });
    else last.indices.push(i);
  }
  return groups.filter((g) => g.indices.length >= 20);
}

function findClosestIndex(bars: Bar[], indices: number[], targetMinutes: number) {
  let best = indices[0]; let bestDiff = Infinity;
  for (const i of indices) { const d = Math.abs(bars[i].minutes - targetMinutes); if (d < bestDiff) { bestDiff = d; best = i; } }
  return best;
}

function forecastAfterHours(bars: Bar[], features: Feature[], crossScore: number) {
  const groups = buildDayGroups(bars);
  const currentGroup = groups[groups.length - 1];
  const currentEnd = currentGroup.indices[currentGroup.indices.length - 1];
  const targets = [
    { minutes: 540, label: '翌営業日 寄付' },
    { minutes: 570, label: '翌営業日 9:30' },
    { minutes: 600, label: '翌営業日 10:00' },
  ];
  const horizons: any[] = [];
  const crossOvernightAdjustment = clip(crossScore * 0.12, -0.8, 0.8);

  for (const targetDef of targets) {
    const candidates: { dist: number; target: number; groupIndex: number }[] = [];
    for (let g = 0; g < groups.length - 1; g++) {
      const end = groups[g].indices[groups[g].indices.length - 1];
      const nextIndex = findClosestIndex(bars, groups[g + 1].indices, targetDef.minutes);
      const target = ((bars[nextIndex].close / bars[end].close) - 1) * 100;
      candidates.push({ dist: distance(features[currentEnd], features[end]), target, groupIndex: g });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const nearest = candidates.slice(0, Math.min(18, candidates.length));
    const weighted = nearest.map((x) => ({ value: x.target, weight: 1 / (0.12 + x.dist * x.dist) }));
    if (nearest.length < 8) continue;
    horizons.push({
      horizonMinutes: null,
      label: targetDef.label,
      ...summarizeDistribution(weighted, crossOvernightAdjustment),
      neighborCount: nearest.length,
      avgDistance: Number(mean(nearest.map((x) => x.dist)).toFixed(3)),
    });
  }

  const tests = groups.slice(8, -1).slice(-16);
  const errors: number[] = []; let dir = 0; let covered = 0; let used = 0;
  for (const testGroup of tests) {
    const testGroupIndex = groups.findIndex((g) => g.dateKey === testGroup.dateKey);
    const testEnd = testGroup.indices[testGroup.indices.length - 1];
    const nextOpenIndex = findClosestIndex(bars, groups[testGroupIndex + 1].indices, 540);
    const actual = ((bars[nextOpenIndex].close / bars[testEnd].close) - 1) * 100;
    const pool: { dist: number; target: number }[] = [];
    for (let g = 0; g < testGroupIndex - 1; g++) {
      const end = groups[g].indices[groups[g].indices.length - 1];
      const openIdx = findClosestIndex(bars, groups[g + 1].indices, 540);
      pool.push({ dist: distance(features[testEnd], features[end]), target: ((bars[openIdx].close / bars[end].close) - 1) * 100 });
    }
    pool.sort((a, b) => a.dist - b.dist);
    const nearest = pool.slice(0, Math.min(14, pool.length));
    if (nearest.length < 7) continue;
    const weighted = nearest.map((x) => ({ value: x.target, weight: 1 / (0.12 + x.dist * x.dist) }));
    const pred = weightedQuantile(weighted, 0.5); const lo = weightedQuantile(weighted, 0.16); const hi = weightedQuantile(weighted, 0.84);
    errors.push(Math.abs(pred - actual)); if ((pred >= 0) === (actual >= 0)) dir++; if (actual >= lo && actual <= hi) covered++; used++;
  }

  return {
    horizons,
    anchor: 'TSE_CLOSE',
    backtest: {
      samples: used,
      maePct: used ? Number(mean(errors).toFixed(3)) : null,
      directionAccuracyPct: used ? Number(((dir / used) * 100).toFixed(1)) : null,
      interval68CoveragePct: used ? Number(((covered / used) * 100).toFixed(1)) : null,
      methodology: 'walk-forward next-session validation; future days never enter the training pool',
    },
  };
}

async function getCrossMarketAdjustment() {
  const symbols = [['^SOX', 0.30], ['NVDA', 0.20], ['MU', 0.15], ['SNDK', 0.15], ['^IXIC', 0.15], ['JPY=X', 0.05]] as const;
  let weighted = 0; let weightTotal = 0; const details: Record<string, number> = {};
  await Promise.all(symbols.map(async ([symbol, w]) => {
    try {
      const chart = await fetchYahooChart(symbol, '1d', '5d'); const meta = chart.meta || {};
      const price = Number(meta.regularMarketPrice || meta.chartPreviousClose || 0); const prev = Number(meta.previousClose || meta.chartPreviousClose || 0);
      if (price > 0 && prev > 0) { let pct = ((price / prev) - 1) * 100; if (symbol === 'JPY=X') pct *= 0.5; pct = clip(pct, -8, 8); weighted += pct * w; weightTotal += w; details[symbol] = Number(pct.toFixed(2)); }
    } catch { /* missing inputs reduce coverage */ }
  }));
  const score = weightTotal ? weighted / weightTotal : 0;
  return { score: Number(score.toFixed(3)), adjustmentPerHourPct: Number(clip(score * 0.035, -0.25, 0.25).toFixed(3)), details, coverage: Number(weightTotal.toFixed(2)) };
}

export default async function handler(_req: any, res: any) {
  try {
    const [chart, cross] = await Promise.all([fetchYahooChart('285A.T', '5m', '30d'), getCrossMarketAdjustment()]);
    const bars = parseBars(chart);
    if (bars.length < 250) return res.status(503).json({ error: 'Insufficient 5-minute history', barCount: bars.length });
    const features = buildFeatures(bars);
    const now = fastJst(Date.now());
    const latest = bars[bars.length - 1];
    const intradayNow = now.dateKey === latest.dateKey && now.minutes >= 540 && now.minutes <= 930;
    const result = intradayNow ? forecastIntraday(bars, features, cross.adjustmentPerHourPct) : forecastAfterHours(bars, features, cross.score);
    const avgDistance = result.horizons.length ? mean(result.horizons.map((h: any) => h.avgDistance)) : 99;
    let confidence: 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
    const bt = result.backtest;
    if ((bt.samples || 0) >= 12 && (bt.directionAccuracyPct || 0) >= 55 && avgDistance < 1.8) confidence = 'HIGH';
    else if ((bt.samples || 0) >= 8 && avgDistance < 2.8) confidence = 'MODERATE';

    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=120');
    return res.status(200).json({
      model: 'KIOXIA Multi-Horizon Ensemble Forecast v1.2',
      generatedAt: new Date().toISOString(),
      mode: intradayNow ? 'INTRADAY' : 'NEXT_SESSION',
      anchor: result.anchor,
      source: 'Yahoo Finance 285A.T 5-minute history + current cross-market overlay',
      sourceRange: '30d',
      historicalBarCount: bars.length,
      currentReferencePrice: latest.close,
      currentReferenceTime: latest.timestamp,
      horizons: result.horizons,
      backtest: result.backtest,
      confidence,
      crossMarket: cross,
      notes: [
        intradayNow ? 'Intraday forecasts use time-matched 5-minute analogs.' : 'After-hours mode forecasts the next Tokyo session from prior closing-state analogs; it does not fabricate PTS intraday history.',
        'Prediction bands are empirical weighted quantiles, not guaranteed limits.',
        'Cross-market adjustment is capped to limit overreaction.',
        'Current PTS is shown as a separate reference; next-session forecasts remain anchored to the TSE close because historical PTS samples are insufficient for training.',
      ],
    });
  } catch (error: any) {
    console.error('Forecast API error:', error);
    return res.status(500).json({ error: 'Forecast model failed', message: error?.message || String(error) });
  }
}
