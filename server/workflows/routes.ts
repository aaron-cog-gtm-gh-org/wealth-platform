import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { badRequest } from './errors';
import {
  cancelOrder, createOrder, createTransfer, getBootstrap, getRebalancePreview,
  updateAllocations, updateClient, updateException,
} from './repository';
import {
  bodyObject, parseAmount, parseQuantity, parseReference, rejectUnknownFields, requiredString,
  validateAllocations, validateClientPatch, validateExceptionPatch,
} from './validation';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

const route = (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  handler(req, res).catch(next);
};

export const workflowRouter = Router();

workflowRouter.get('/bootstrap', route(async (_req, res) => {
  res.json(await getBootstrap());
}));

workflowRouter.patch('/clients/:id', route(async (req, res) => {
  const patch = validateClientPatch(bodyObject(req.body));
  res.json(await updateClient(req.params.id, patch));
}));

workflowRouter.post('/orders', route(async (req, res) => {
  const body = bodyObject(req.body);
  rejectUnknownFields(body, ['accountId', 'symbol', 'side', 'quantity']);
  const accountId = requiredString(body.accountId, 'Account ID');
  const symbol = requiredString(body.symbol, 'Symbol').toUpperCase();
  if (symbol.length > 12) badRequest('Symbol must be 12 characters or fewer.');
  if (body.side !== 'Buy' && body.side !== 'Sell') badRequest('Side must be Buy or Sell.');
  const order = await createOrder({ accountId, symbol, side: body.side, quantity: parseQuantity(body.quantity) });
  res.status(201).json(order);
}));

workflowRouter.post('/orders/:id/cancel', route(async (req, res) => {
  const body = bodyObject(req.body);
  rejectUnknownFields(body, []);
  res.json(await cancelOrder(req.params.id));
}));

workflowRouter.post('/transfers', route(async (req, res) => {
  const body = bodyObject(req.body);
  rejectUnknownFields(body, ['fromAccountId', 'toAccountId', 'amount', 'reference']);
  const fromAccountId = requiredString(body.fromAccountId, 'From account ID');
  const toAccountId = requiredString(body.toAccountId, 'To account ID');
  if (fromAccountId === toAccountId) badRequest('Source and destination accounts must be different.');
  const amount = parseAmount(body.amount);
  const reference = parseReference(body.reference);
  res.status(201).json(await createTransfer({ fromAccountId, toAccountId, amount, reference }));
}));

workflowRouter.put('/allocations', route(async (req, res) => {
  const body = bodyObject(req.body);
  rejectUnknownFields(body, ['allocations']);
  const allocations = validateAllocations(body.allocations);
  res.json({ allocations: await updateAllocations(allocations) });
}));

workflowRouter.post('/rebalance/preview', route(async (req, res) => {
  const body = bodyObject(req.body);
  rejectUnknownFields(body, []);
  res.json(await getRebalancePreview());
}));

workflowRouter.patch('/exceptions/:id', route(async (req, res) => {
  const patch = validateExceptionPatch(bodyObject(req.body));
  res.json(await updateException(req.params.id, patch));
}));
