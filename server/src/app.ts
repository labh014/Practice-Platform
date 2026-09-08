import cors from 'cors';
import express, { type Express } from 'express';

/**
 * Builds the Express application.
 *
 * Kept separate from the listening server so tests can exercise routes with
 * supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
