import type { Request, Response } from 'express';
// The custom build creates dist/server.cjs from server.ts before Vercel packages
// this function. Import the generated CommonJS bundle so the function does not
// depend on TypeScript source files outside /api at runtime.
// @ts-ignore - generated at build time by `npm run build`
import serverModule from '../dist/server.cjs';

const app: any = (serverModule as any)?.default ?? serverModule;

type DailyBar = { open: number; close: number; timestamp?: number; time?: string };

function buildNextOpenDailyStatistics(daily: DailyBar[]) {
  if (!Array.isArray(daily) || daily.length < 40) return null;

  const latestIndex = daily.length - 1;
  const previousClose = daily[latestIndex - 1]?.close || 0;
  const latestClose = daily[latestIndex]?.close || 0;
  if (previousClose <= 0 || latestClose <= 0) return null;

  const latestReturnPct = ((latestClose / previousClose) - 1) * 100;

  const collect = (bandPct: number) => {
    const observations: number[] = [];
    for (let i = 1; i < daily.length - 1; i++) {
      const prev = daily[i - 1]?.close || 0;
      const close = daily[i]?.close || 0;
      const nextOpen = daily[i + 1]?.open || 0;
      if (prev <= 0 || close <= 0 || nextOpen <= 0) continue;

      const dayReturnPct = ((close / prev) - 1) * 100;
      if (Math.abs(dayReturnPct - latestReturnPct) > bandPct) continue;

      observations.push(((nextOpen / close) - 1) * 100);
    }
    return observations;
  };

  let band = 1.25;
  let observations = collect(band);
  if (observations.length < 20) {
    band = 2.5;
    observations = collect(band);
  }

  if (observations.length < 10) return null;

  const up = observations.filter((v) => v > 0.5).length;
  const down = observations.filter((v) => v < -0.5).length;
  const flat = observations.length - up - down;
  const upPercent = Math.round((up / observations.length) * 100);
  const flatPercent = Math.round((flat / observations.length) * 100);
  const downPercent = 100 - upPercent - flatPercent;

  return {
    directionText: `東証の日足実績から、当日騰落率 ${latestReturnPct >= 0 ? '+' : ''}${latestReturnPct.toFixed(2)}% に近い過去局面（±${band.toFixed(2)}pt）を抽出しました。PTS→翌朝の実測ペアはまだ十分に蓄積されていないため、現段階では東証日足ベースの参考統計です。`,
    disclaimer: '過去の日足統計は翌営業日の寄り付き価格を保証するものではありません。',
    sampleCount: observations.length,
    isSufficientSample: observations.length >= 20,
    historicalStats: {
      upPercent,
      flatPercent,
      downPercent,
    },
  };
}

// Vercel rewrites every /api/* request to this single function and passes the
// original sub-path in ?path=. Reconstruct the Express URL before dispatching
// so routes such as /api/market/kioxia keep their full path.
export default function handler(req: Request, res: Response) {
  const rawPath = req.query.path;
  const pathValue = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');

  if (pathValue) {
    const query = { ...req.query } as Record<string, unknown>;
    delete query.path;

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) search.append(key, String(item));
      } else if (value !== undefined && value !== null) {
        search.append(key, String(value));
      }
    }

    req.url = `/api/${pathValue}${search.size ? `?${search.toString()}` : ''}`;
  }

  if (pathValue === 'market/kioxia') {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (body?.ptsMarketInfo && Array.isArray(body?.daily1d)) {
        const existing = body.ptsMarketInfo.nextDayOpenAnalysis;
        if (!existing?.isSufficientSample) {
          const dailyStats = buildNextOpenDailyStatistics(body.daily1d);
          if (dailyStats) {
            body.ptsMarketInfo.nextDayOpenAnalysis = dailyStats;
          }
        }
      }
      return originalJson(body);
    }) as typeof res.json;
  }

  return app(req, res);
}
