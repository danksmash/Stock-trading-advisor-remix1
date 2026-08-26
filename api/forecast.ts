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

type DailyBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dateKey: string;
};

type WeightedValue = { value: number; weight: number };

type BacktestResult = {
  samples: number;
  maePct: number | null;
  baselineMaePct: number | null;
  skillVsZeroPct: number | null;
  directionAccuracyPct: number | null;
  interval68CoveragePct: number | null;
  methodology: string;
};

const INTRADAY_SCALE = [1.2, 2.0, 3.0, 5.0, 1.6, 2.0, 1.2, 1.6, 3.0, 1.2];
const DAILY_SCALE = [5, 9, 14, 22, 8, 6, 2.2, 10, 18, 10];

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

function parse5m(chart: any): Bar[] {
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
  }).filter((b) => [b.open, b.high, b.low, b.close].every(Number.isFinite) && b.close > 0);
}

function parseDaily(chart: any): DailyBar[] {
  const timestamps: number[] = chart?.timestamp || [];
  const q = chart?.indicators?.quote?.[0] || {};
  return timestamps.map((ts, i) => {
    const timestamp = ts * 1000;
    return {
      timestamp,
      open: Number(q.open?.[i]),
      high: Number(q.high?.[i]),
      low: Number(q.low?.[i]),
      close: Number(q.close?.[i]),
      volume: Number(q.volume?.[i] || 0),
      dateKey: fastJst(timestamp).dateKey,
    };
  }).filter((b) => [b.open, b.high, b.low, b.close].every(Number.isFinite) && b.close > 0);
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

function distance(a: number[], b: number[], scale: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] - b[i]) / scale[i];
    sum += d * d;
  }
  return Math.sqrt(sum / a.length);
}

function weightedQuantile(values: WeightedValue[], q: number) {
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

function summarize(weighted: WeightedValue[], adjustmentPct = 0) {
  if (!weighted.length) return null;
  const total = weighted.reduce((s, x) => s + x.weight, 0) || 1;
  const up = weighted.filter((x) => x.value + adjustmentPct > 0).reduce((s, x) => s + x.weight, 0);
  return {
    predictedReturnPct: Number((weightedQuantile(weighted, 0.50) + adjustmentPct).toFixed(3)),
    lower68ReturnPct: Number((weightedQuantile(weighted, 0.16) + adjustmentPct).toFixed(3)),
    upper68ReturnPct: Number((weightedQuantile(weighted, 0.84) + adjustmentPct).toFixed(3)),
    lower90ReturnPct: Number((weightedQuantile(weighted, 0.10) + adjustmentPct).toFixed(3)),
    upper90ReturnPct: Number((weightedQuantile(weighted, 0.90) + adjustmentPct).toFixed(3)),
    upProbability: Number(((up / total) * 100).toFixed(1)),
  };
}

function buildIntradayFeatures(bars: Bar[]) {
  const out: number[][] = new Array(bars.length);
  let dayStart = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i === 0 || bars[i].dateKey !== bars[i - 1].dateKey) dayStart = i;
    const c = bars[i].close;
    const ret = (n: number) => i >= n && bars[i - n].close > 0 ? ((c / bars[i - n].close) - 1) * 100 : 0;
    const barReturns: number[] = [];
    for (let k = Math.max(1, i - 11); k <= i; k++) barReturns.push(((bars[k].close / bars[k - 1].close) - 1) * 100);
    const recent = bars.slice(Math.max(0, i - 11), i + 1);
    const meanClose = mean(recent.map((b) => b.close)) || c;
    const meanRange = mean(recent.slice(-6).map((b) => ((b.high - b.low) / b.close) * 100));
    const vols = bars.slice(Math.max(0, i - 59), i + 1).map((b) => b.volume);
    const volMean = mean(vols);
    const volStd = std(vols) || 1;
    const dayOpen = bars[dayStart]?.open || c;
    out[i] = [
      ret(1), ret(3), ret(6), ret(12), std(barReturns), meanRange,
      ((c / meanClose) - 1) * 100,
      clip((bars[i].volume - volMean) / volStd, -4, 4),
      ((c / dayOpen) - 1) * 100,
      clip((bars[i].minutes - 540) / 390, 0, 1),
    ];
  }
  return out;
}

function buildDailyFeatures(daily: DailyBar[]) {
  const out: number[][] = new Array(daily.length);
  for (let i = 0; i < daily.length; i++) {
    const c = daily[i].close;
    const ret = (n: number) => i >= n && daily[i - n].close > 0 ? ((c / daily[i - n].close) - 1) * 100 : 0;
    const rangePct = ((daily[i].high - daily[i].low) / c) * 100;
    const bodyPct = ((daily[i].close - daily[i].open) / daily[i].open) * 100;
    const vols = daily.slice(Math.max(0, i - 19), i + 1).map((b) => b.volume);
    const volumeZ = (daily[i].volume - mean(vols)) / (std(vols) || 1);
    const ma5 = mean(daily.slice(Math.max(0, i - 4), i + 1).map((b) => b.close)) || c;
    const ma20 = mean(daily.slice(Math.max(0, i - 19), i + 1).map((b) => b.close)) || c;
    const ranges = daily.slice(Math.max(0, i - 9), i + 1).map((b) => ((b.high - b.low) / b.close) * 100);
    out[i] = [
      ret(1), ret(3), ret(5), ret(10), rangePct, bodyPct,
      clip(volumeZ, -4, 4),
      ((c / ma5) - 1) * 100,
      ((c / ma20) - 1) * 100,
      mean(ranges),
    ];
  }
  return out;
}

function intradayTarget(bars: Bar[], i: number, horizonBars: number) {
  const j = i + horizonBars;
  if (j >= bars.length || bars[i].dateKey !== bars[j].dateKey) return null;
  return ((bars[j].close / bars[i].close) - 1) * 100;
}

function intradayDistribution(bars: Bar[], features: number[][], testIndex: number, horizonBars: number, maxNeighbors = 60) {
  const candidates: { dist: number; target: number }[] = [];
  for (let i = 60; i < testIndex - horizonBars; i++) {
    const target = intradayTarget(bars, i, horizonBars);
    if (target === null) continue;
    if (Math.abs(bars[i].minutes - bars[testIndex].minutes) > 90) continue;
    candidates.push({ dist: distance(features[testIndex], features[i], INTRADAY_SCALE), target });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const nearest = candidates.slice(0, Math.min(maxNeighbors, Math.max(18, Math.floor(Math.sqrt(candidates.length) * 1.5))));
  return {
    nearest,
    weighted: nearest.map((x) => ({ value: x.target, weight: 1 / (0.08 + x.dist * x.dist) })),
  };
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

function closestIndex(bars: Bar[], indices: number[], targetMinutes: number) {
  let best = indices[0];
  let bestDiff = Infinity;
  for (const i of indices) {
    const diff = Math.abs(bars[i].minutes - targetMinutes);
    if (diff < bestDiff) { best = i; bestDiff = diff; }
  }
  return best;
}

function nextSessionIntradayDistribution(bars: Bar[], features: number[][], targetMinutes: number) {
  const groups = buildDayGroups(bars);
  const currentGroup = groups[groups.length - 1];
  const currentEnd = currentGroup.indices[currentGroup.indices.length - 1];
  const candidates: { dist: number; target: number }[] = [];
  for (let g = 0; g < groups.length - 1; g++) {
    const end = groups[g].indices[groups[g].indices.length - 1];
    const targetIdx = closestIndex(bars, groups[g + 1].indices, targetMinutes);
    candidates.push({
      dist: distance(features[currentEnd], features[end], INTRADAY_SCALE),
      target: ((bars[targetIdx].close / bars[end].close) - 1) * 100,
    });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const nearest = candidates.slice(0, Math.min(18, candidates.length));
  return {
    nearest,
    weighted: nearest.map((x) => ({ value: x.target, weight: 1 / (0.12 + x.dist * x.dist) })),
  };
}

function dailyOpenDistribution(daily: DailyBar[], features: number[][], testIndex: number, maxNeighbors = 50) {
  const candidates: { dist: number; target: number }[] = [];
  for (let i = 25; i < testIndex; i++) {
    if (i + 1 >= daily.length) break;
    const target = ((daily[i + 1].open / daily[i].close) - 1) * 100;
    candidates.push({ dist: distance(features[testIndex], features[i], DAILY_SCALE), target });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const k = Math.min(maxNeighbors, Math.max(28, Math.floor(Math.sqrt(candidates.length) * 2.2)));
  const nearest = candidates.slice(0, k);
  return {
    nearest,
    weighted: nearest.map((x) => ({ value: x.target, weight: 1 / (0.10 + x.dist * x.dist) })),
  };
}

function backtestDailyOpen(daily: DailyBar[], features: number[][]): BacktestResult {
  const eligible = Array.from({ length: daily.length - 1 }, (_, i) => i).filter((i) => i >= 70).slice(-80);
  const errors: number[] = [];
  const baselineErrors: number[] = [];
  let direction = 0;
  let covered = 0;
  let used = 0;

  for (const testIndex of eligible) {
    const { nearest, weighted } = dailyOpenDistribution(daily, features, testIndex, 45);
    if (nearest.length < 25) continue;
    const pred = weightedQuantile(weighted, 0.50);
    const lo = weightedQuantile(weighted, 0.16);
    const hi = weightedQuantile(weighted, 0.84);
    const actual = ((daily[testIndex + 1].open / daily[testIndex].close) - 1) * 100;
    errors.push(Math.abs(pred - actual));
    baselineErrors.push(Math.abs(actual));
    if ((pred >= 0) === (actual >= 0)) direction++;
    if (actual >= lo && actual <= hi) covered++;
    used++;
  }

  const mae = used ? mean(errors) : 0;
  const baseline = used ? mean(baselineErrors) : 0;
  return {
    samples: used,
    maePct: used ? Number(mae.toFixed(3)) : null,
    baselineMaePct: used ? Number(baseline.toFixed(3)) : null,
    skillVsZeroPct: used && baseline > 0 ? Number(((1 - mae / baseline) * 100).toFixed(1)) : null,
    directionAccuracyPct: used ? Number(((direction / used) * 100).toFixed(1)) : null,
    interval68CoveragePct: used ? Number(((covered / used) * 100).toFixed(1)) : null,
    methodology: '80-point walk-forward next-open validation; every test prediction uses only earlier daily observations',
  };
}

function backtestIntraday(bars: Bar[], features: number[][], horizonBars: number): BacktestResult {
  const eligible = Array.from({ length: bars.length }, (_, i) => i)
    .filter((i) => i > 180 && i < bars.length - horizonBars && intradayTarget(bars, i, horizonBars) !== null)
    .slice(-36);
  const errors: number[] = [];
  const baselineErrors: number[] = [];
  let direction = 0;
  let covered = 0;
  let used = 0;
  for (const testIndex of eligible) {
    const { nearest, weighted } = intradayDistribution(bars, features, testIndex, horizonBars, 40);
    if (nearest.length < 12) continue;
    const pred = weightedQuantile(weighted, 0.50);
    const lo = weightedQuantile(weighted, 0.16);
    const hi = weightedQuantile(weighted, 0.84);
    const actual = intradayTarget(bars, testIndex, horizonBars)!;
    errors.push(Math.abs(pred - actual));
    baselineErrors.push(Math.abs(actual));
    if ((pred >= 0) === (actual >= 0)) direction++;
    if (actual >= lo && actual <= hi) covered++;
    used++;
  }
  const mae = used ? mean(errors) : 0;
  const baseline = used ? mean(baselineErrors) : 0;
  return {
    samples: used,
    maePct: used ? Number(mae.toFixed(3)) : null,
    baselineMaePct: used ? Number(baseline.toFixed(3)) : null,
    skillVsZeroPct: used && baseline > 0 ? Number(((1 - mae / baseline) * 100).toFixed(1)) : null,
    directionAccuracyPct: used ? Number(((direction / used) * 100).toFixed(1)) : null,
    interval68CoveragePct: used ? Number(((covered / used) * 100).toFixed(1)) : null,
    methodology: 'walk-forward intraday validation; each prediction uses strictly earlier 5-minute observations',
  };
}

async function getCrossMarket() {
  const symbols = [['^SOX', 0.30], ['NVDA', 0.20], ['MU', 0.15], ['SNDK', 0.15], ['^IXIC', 0.15], ['JPY=X', 0.05]] as const;
  let weighted = 0;
  let totalWeight = 0;
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
        totalWeight += w;
        details[symbol] = Number(pct.toFixed(2));
      }
    } catch { /* missing source lowers coverage */ }
  }));
  const score = totalWeight ? weighted / totalWeight : 0;
  return {
    score: Number(score.toFixed(3)),
    intradayAdjustmentPerHourPct: Number(clip(score * 0.035, -0.25, 0.25).toFixed(3)),
    overnightAdjustmentPct: Number(clip(score * 0.10, -0.65, 0.65).toFixed(3)),
    details,
    coverage: Number(totalWeight.toFixed(2)),
  };
}

function confidenceFromBacktest(bt: BacktestResult, avgDistance: number) {
  const n = bt.samples || 0;
  const dir = bt.directionAccuracyPct ?? 0;
  const skill = bt.skillVsZeroPct ?? -100;
  const mae = bt.maePct ?? 99;
  if (n >= 50 && dir >= 55 && skill >= 5 && mae <= 3.0 && avgDistance < 2.0) return 'HIGH' as const;
  if (n >= 25 && dir >= 50 && skill >= 0 && mae <= 4.0 && avgDistance < 2.8) return 'MODERATE' as const;
  return 'LOW' as const;
}

export default async function handler(_req: any, res: any) {
  try {
    const [chart5m, chartDaily, cross] = await Promise.all([
      fetchYahooChart('285A.T', '5m', '30d'),
      fetchYahooChart('285A.T', '1d', '2y'),
      getCrossMarket(),
    ]);

    const bars = parse5m(chart5m);
    const daily = parseDaily(chartDaily);
    if (bars.length < 250 || daily.length < 100) {
      return res.status(503).json({ error: 'Insufficient history', intradayBars: bars.length, dailyBars: daily.length });
    }

    const intradayFeatures = buildIntradayFeatures(bars);
    const dailyFeatures = buildDailyFeatures(daily);
    const now = fastJst(Date.now());
    const latest5m = bars[bars.length - 1];
    const isIntraday = now.dateKey === latest5m.dateKey && now.minutes >= 540 && now.minutes <= 930;

    let horizons: any[] = [];
    let backtest: BacktestResult;
    let anchor: 'CURRENT_TSE' | 'TSE_CLOSE';
    let avgDistance = 99;

    if (isIntraday) {
      anchor = 'CURRENT_TSE';
      const possible = [6, 12, 18, 24].filter((h) => latest5m.minutes + h * 5 <= 930);
      for (const h of possible) {
        const dist = intradayDistribution(bars, intradayFeatures, bars.length - 1, h, 70);
        if (dist.nearest.length < 15) continue;
        const summary = summarize(dist.weighted, cross.intradayAdjustmentPerHourPct * ((h * 5) / 60));
        if (!summary) continue;
        horizons.push({
          horizonMinutes: h * 5,
          label: `+${h * 5}分`,
          ...summary,
          neighborCount: dist.nearest.length,
          avgDistance: Number(mean(dist.nearest.map((x) => x.dist)).toFixed(3)),
          modelSource: '5分足・時間帯類似局面',
        });
      }
      backtest = backtestIntraday(bars, intradayFeatures, possible.includes(12) ? 12 : (possible[0] || 6));
      avgDistance = horizons.length ? mean(horizons.map((h) => h.avgDistance)) : 99;
    } else {
      anchor = 'TSE_CLOSE';
      const dailyDist = dailyOpenDistribution(daily, dailyFeatures, daily.length - 1, 55);
      const openSummary = summarize(dailyDist.weighted, cross.overnightAdjustmentPct);
      if (openSummary) {
        horizons.push({
          horizonMinutes: null,
          label: '翌営業日 寄付',
          ...openSummary,
          neighborCount: dailyDist.nearest.length,
          avgDistance: Number(mean(dailyDist.nearest.map((x) => x.dist)).toFixed(3)),
          modelSource: '2年日足類似局面 + 米国半導体オーバーレイ',
        });
      }

      for (const target of [{ minutes: 570, label: '翌営業日 9:30' }, { minutes: 600, label: '翌営業日 10:00' }]) {
        const d = nextSessionIntradayDistribution(bars, intradayFeatures, target.minutes);
        if (d.nearest.length < 8) continue;
        const s = summarize(d.weighted, cross.overnightAdjustmentPct);
        if (!s) continue;
        horizons.push({
          horizonMinutes: null,
          label: target.label,
          ...s,
          neighborCount: d.nearest.length,
          avgDistance: Number(mean(d.nearest.map((x) => x.dist)).toFixed(3)),
          modelSource: '30日5分足・引け状態類似局面 + 米国半導体オーバーレイ',
        });
      }
      backtest = backtestDailyOpen(daily, dailyFeatures);
      avgDistance = dailyDist.nearest.length ? mean(dailyDist.nearest.map((x) => x.dist)) : 99;
    }

    const confidence = confidenceFromBacktest(backtest, avgDistance);

    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=120');
    return res.status(200).json({
      model: 'KIOXIA Multi-Horizon Ensemble Forecast v2.0',
      generatedAt: new Date().toISOString(),
      mode: isIntraday ? 'INTRADAY' : 'NEXT_SESSION',
      anchor,
      source: 'Yahoo Finance: 285A.T 5-minute 30d + daily 2y + current semiconductor/macro overlay',
      historicalBarCount: bars.length,
      historicalDailyCount: daily.length,
      currentReferencePrice: latest5m.close,
      currentReferenceTime: latest5m.timestamp,
      horizons,
      backtest,
      confidence,
      crossMarket: cross,
      notes: [
        isIntraday
          ? 'Intraday forecasts use time-matched 5-minute analogs and empirical return quantiles.'
          : 'Next-open forecast uses a two-year daily analog model; 9:30/10:00 use 30-day 5-minute close-state analogs.',
        'Walk-forward validation is benchmarked against a zero-return forecast; confidence is downgraded when the model does not beat that baseline.',
        'Cross-market overlay is capped and is not counted as validated historical skill in the walk-forward score.',
        'PTS remains a separate current reference until a sufficiently large timestamped PTS history is accumulated.',
        'Prediction bands are empirical probability ranges, not guaranteed prices.',
      ],
    });
  } catch (error: any) {
    console.error('Forecast API error:', error);
    return res.status(500).json({ error: 'Forecast model failed', message: error?.message || String(error) });
  }
}
