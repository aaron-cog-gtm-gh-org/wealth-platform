import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  getAllStatementDates, getArchiveStatus, getCheckAll, getClient, getHoldings, getMessage, getPositionCheck, getSettlements,
  getStatementDates, listAccounts, listClients, listMessages, listOperators, reloadArchive, saveReconNote,
} from './repository';
import {
  parseClientQuery, parseFileName, parseId, parseIsoDate, parseMessageFilters, parseSettlementRange, queryParams, rejectBody,
  validateReconNote,
} from './validation';

type AsyncHandler = (req: Request, res: Response) => Promise<unknown>;

const route = (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  handler(req, res).then(body => res.json(body), next);
};

const noQuery = (req: Request) => queryParams(req.query, []);

export const custodyRouter = Router();

custodyRouter.get('/clients', route(async req => listClients(parseClientQuery(req.query))));

custodyRouter.get('/clients/:clientId', route(async req => {
  noQuery(req);
  return getClient(parseId(req.params.clientId, 'Client ID'));
}));

custodyRouter.get('/accounts', route(async req => {
  noQuery(req);
  return listAccounts();
}));

custodyRouter.get('/accounts/:acctId/statements', route(async req => {
  noQuery(req);
  return getStatementDates(parseId(req.params.acctId, 'Account ID'));
}));

custodyRouter.get('/accounts/:acctId/statements/:date', route(async req => {
  noQuery(req);
  return getHoldings(parseId(req.params.acctId, 'Account ID'), parseIsoDate(req.params.date, 'Statement date'));
}));

custodyRouter.get('/accounts/:acctId/settlements', route(async req => {
  const acctId = parseId(req.params.acctId, 'Account ID');
  return getSettlements(acctId, parseSettlementRange(req.query));
}));

custodyRouter.get('/accounts/:acctId/position-check/:date', route(async req => {
  noQuery(req);
  return getPositionCheck(parseId(req.params.acctId, 'Account ID'), parseIsoDate(req.params.date, 'Statement date'));
}));

custodyRouter.get('/position-check/:date', route(async req => {
  noQuery(req);
  return getCheckAll(parseIsoDate(req.params.date, 'Statement date'));
}));

custodyRouter.get('/statement-dates', route(async req => {
  noQuery(req);
  return getAllStatementDates();
}));

custodyRouter.get('/operators', route(async req => {
  noQuery(req);
  return listOperators();
}));

custodyRouter.put('/recon-notes', route(async req => {
  noQuery(req);
  return saveReconNote(validateReconNote(req.body));
}));

custodyRouter.get('/messages', route(async req => listMessages(parseMessageFilters(req.query))));

custodyRouter.get('/messages/:fileName', route(async req => {
  noQuery(req);
  return getMessage(parseFileName(req.params.fileName));
}));

custodyRouter.get('/archive/status', route(async req => {
  noQuery(req);
  return getArchiveStatus();
}));

custodyRouter.post('/archive/reload', route(async req => {
  noQuery(req);
  rejectBody(req.body);
  return reloadArchive();
}));
