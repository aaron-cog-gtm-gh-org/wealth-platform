// `/api/custody` routes (contracts/api.md). Story sessions add endpoints here; data access lives
// in server/repositories/custody.ts. Validation errors → 400 { error }, missing → 404.
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  CustodyValidationError, accountExists, getCustodyClient, getCustodyHousehold, getCustodyPortfolio, getStatement, listConfirmations,
  listCustodyClients, listStatementDates, optionalPage, requireDate, requireId, runPositionChecks,
} from '../repositories/custody';
import type { PositionCheckMode } from '../../src/api/types';

type Handler = (req: Request) => Promise<unknown>;

export const custodyJson = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = await fn(req);
    if (body == null) res.status(404).json({ error: 'Not found' });
    else res.json(body);
  } catch (err) {
    if (err instanceof CustodyValidationError) res.status(400).json({ error: err.message });
    else next(err);
  }
};

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const optDate = (v: unknown, name: string) => (v === undefined || v === '' ? undefined : requireDate(v, name));
export function requireMode(v: unknown): PositionCheckMode {
  if (v === undefined || v === '' || v === 'corrected') return 'corrected';
  if (v === 'legacy') return 'legacy';
  throw new CustodyValidationError(`mode must be 'corrected' or 'legacy'`);
}

const forAccount = async <T>(accountId: number, fn: () => Promise<T>) => ((await accountExists(accountId)) ? fn() : null);

export function custodyRouter() {
  const r = Router();
  r.get('/clients', custodyJson(req => listCustodyClients(str(req.query.q) ?? '', optionalPage(req.query.page))));
  r.get('/clients/:clientId', custodyJson(req => getCustodyClient(requireId(req.params.clientId, 'clientId'))));
  r.get('/clients/:clientId/household', custodyJson(req => getCustodyHousehold(requireId(req.params.clientId, 'clientId'))));
  r.get('/clients/:clientId/portfolio', custodyJson(req => getCustodyPortfolio(requireId(req.params.clientId, 'clientId'))));
  r.get('/accounts/:accountId/statements', custodyJson(req => {
    const id = requireId(req.params.accountId, 'accountId');
    return forAccount(id, () => listStatementDates(id));
  }));
  r.get('/accounts/:accountId/statements/:date', custodyJson(req => getStatement(requireId(req.params.accountId, 'accountId'), requireDate(req.params.date))));
  r.get('/accounts/:accountId/confirmations', custodyJson(req => {
    const id = requireId(req.params.accountId, 'accountId');
    const from = optDate(req.query.from, 'from'), to = optDate(req.query.to, 'to');
    return forAccount(id, () => listConfirmations(id, from, to));
  }));
  r.get('/position-checks', custodyJson(req => runPositionChecks({
    date: optDate(req.query.date, 'date'),
    accountId: req.query.accountId === undefined || req.query.accountId === '' ? undefined : requireId(req.query.accountId, 'accountId'),
    mode: requireMode(req.query.mode),
  })));
  return r;
}
