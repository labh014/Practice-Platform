import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express, { type Express } from 'express';

import { createRouter } from './api/routes';
import { errorMiddleware, notFoundHandler } from './api/errorMiddleware';
import type { Container } from './container';

/**
 * Where the built client lives, when there is one.
 *
 * In development Vite serves the client and proxies /api here, so nothing is
 * built and this path does not exist. In production one process serves both,
 * which keeps the client and the API on the same origin - and the client calls
 * /api relative, so same-origin is what makes it work without the deployment
 * having to know a second URL.
 *
 * Same-origin also happens to be the only shape in-memory storage supports:
 * attempts live in one process, so there is exactly one process to serve.
 */
function resolveClientDist(): string {
  const configured = process.env['CLIENT_DIST']?.trim();
  if (configured) return configured;

  return fileURLToPath(new URL('../../client/dist', import.meta.url));
}

/**
 * Builds the Express application around an already-wired container.
 *
 * Kept separate from the listening server so tests exercise the real routes
 * with supertest, against a container holding a stub LLM client, without
 * binding a port.
 */
export function createApp(container: Container): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/api',
    createRouter({
      attempts: container.attempts,
      problems: container.problems,
      evaluator: container.evaluator,
    }),
  );

  // An unknown /api route is a client error and must stay JSON. Without this it
  // would fall through to the SPA fallback below and answer a bad API call with
  // an HTML page, which is a confusing thing to debug.
  app.use('/api', notFoundHandler);

  const clientDist = resolveClientDist();
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));

    // Client-side routing: /problems/parking-lot is a real URL to the browser
    // but not a file on disk, so anything not matched above returns the shell
    // and lets the router take over.
    app.get('*', (_req, res) => {
      res.sendFile(join(clientDist, 'index.html'));
    });
  } else {
    // No build present - development, or the API running on its own.
    app.use(notFoundHandler);
  }

  app.use(errorMiddleware);

  return app;
}
