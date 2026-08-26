import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    service: 'KIOXIA SIGNAL',
    environment: process.env.VERCEL_ENV || 'unknown',
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || null,
    checkedAt: new Date().toISOString(),
  });
}
