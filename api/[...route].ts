import type { Request, Response } from 'express';

let cachedApp: ((req: Request, res: Response) => unknown) | null = null;
let loadError: Error | null = null;

export default async function handler(req: Request, res: Response) {
  if (!cachedApp && !loadError) {
    try {
      const mod = await import('../src/server/app.ts');
      cachedApp = mod.app;
    } catch (err) {
      loadError = err instanceof Error ? err : new Error('Serverless backend failed to initialize');
    }
  }

  if (cachedApp) {
    return cachedApp(req, res);
  }

  res.status(503).json({
    error: loadError?.message || 'Backend runtime requires Node 22 with node:sqlite enabled',
  });
}
