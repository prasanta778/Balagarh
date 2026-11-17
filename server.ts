import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { app } from './src/server/app.ts';

const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Our Balagarh CMS & Portal running at http://localhost:${PORT}`);
  });
}

startServer();
