import type { Request, Response } from 'express';
import app from '../server.ts';

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

  return app(req, res);
}
