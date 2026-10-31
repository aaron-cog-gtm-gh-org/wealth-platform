import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { query } from './db/pool';
import { getAlternatives, getHousehold, getPerformance, getPortfolio, getRebalance } from './repositories/advisor';
import { getSettlementExceptions } from './repositories/operations';
import { getActivity, getPayments } from './repositories/portal';
import { workflowRouter } from './workflows/routes';
import { HttpError } from './workflows/errors';

type Handler = (req: Request) => Promise<unknown>;

const json = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = await fn(req);
    if (body == null) res.status(404).json({ error: 'Not found' });
    else res.json(body);
  } catch (err) {
    next(err);
  }
};

export function createApp() {
  const app = express();
  app.use('/api/workflows', express.json({ limit: '16kb' }), workflowRouter);
  app.use('/api/test', express.json({ limit: '16kb' }));
  if (process.env.ENABLE_TEST_RESET === '1') {
    app.post('/api/test/reset', async (req, res, next) => {
      const address = req.socket.remoteAddress;
      if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') {
        res.status(403).json({ error: 'Forbidden.' });
        return;
      }
      try {
        await import('./workflows/repository').then(({ resetWorkflowData }) => resetWorkflowData());
        res.json({ status: 'reset' });
      } catch (error) {
        next(error);
      }
    });
  }
  app.get('/api/health', json(async () => { await query('SELECT 1'); return { status: 'ok' }; }));
  app.get('/api/households/:id', json(req => getHousehold(req.params.id)));
  app.get('/api/households/:id/portfolio', json(req => getPortfolio(req.params.id)));
  app.get('/api/households/:id/performance', json(req => getPerformance(req.params.id)));
  app.get('/api/households/:id/rebalance', json(req => getRebalance(req.params.id)));
  app.get('/api/households/:id/alternatives', json(req => getAlternatives(req.params.id)));
  app.get('/api/ops/queues/:queue/settlement-exceptions', json(req => getSettlementExceptions(req.params.queue)));
  app.get('/api/portal/clients/:id/activity', json(req => getActivity(req.params.id)));
  app.get('/api/portal/clients/:id/payments', json(req => getPayments(req.params.id)));
  app.use('/api', (_req: Request, res: Response) => res.status(404).json({ error: 'Not found.' }));
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      res.status(400).json({ error: 'Request body must be valid JSON.' });
      return;
    }
    if (err.type === 'entity.too.large') {
      res.status(400).json({ error: 'Request body must be valid JSON.' });
      return;
    }
    console.error(err.message);
    res.status(503).json({ error: 'Service unavailable' });
  });
  return app;
}
