import cors from 'cors';
import express, { type Express } from 'express';

import { createRouter } from './api/routes';
import { errorMiddleware, notFoundHandler } from './api/errorMiddleware';
import type { Container } from './container';

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
    createRouter({ attempts: container.attempts, problems: container.problems }),
  );

  app.use(notFoundHandler);
  app.use(errorMiddleware);

  return app;
}
