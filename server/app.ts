import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { query } from './db/pool';
import { getAlternatives, getHousehold, getPerformance, getPortfolio, getRebalance } from './repositories/advisor';
import { getSettlementExceptions } from './repositories/operations';
import { getActivity, getPayments } from './repositories/portal';

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
  app.get('/api/health', json(async () => { await query('SELECT 1 FROM dual'); return { status: 'ok' }; }));
  app.get('/api/households/:id', json(req => getHousehold(req.params.id)));
  app.get('/api/households/:id/portfolio', json(req => getPortfolio(req.params.id)));
  app.get('/api/households/:id/performance', json(req => getPerformance(req.params.id)));
  app.get('/api/households/:id/rebalance', json(req => getRebalance(req.params.id)));
  app.get('/api/households/:id/alternatives', json(req => getAlternatives(req.params.id)));
  app.get('/api/ops/queues/:queue/settlement-exceptions', json(req => getSettlementExceptions(req.params.queue)));
  app.get('/api/portal/clients/:id/activity', json(req => getActivity(req.params.id)));
  app.get('/api/portal/clients/:id/payments', json(req => getPayments(req.params.id)));
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.message);
    res.status(503).json({ error: 'Service unavailable' });
  });
  return app;
}
