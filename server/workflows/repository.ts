import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PoolClient, QueryResultRow } from 'pg';
import { query, withTransaction } from '../db/pool';
import { splitSqlScript } from '../db/sql-script';
import { badRequest, conflict, HttpError, notFound } from './errors';
import { computeDrifts } from './validation';
import type {
  WorkflowAccount, WorkflowAllocation, WorkflowAudit, WorkflowBootstrap, WorkflowClient,
  WorkflowException, WorkflowOrder, WorkflowPosition, WorkflowTransfer,
} from './types';

const DB_DIR = fileURLToPath(new URL('../db/', import.meta.url));

const clientFields = `client_id AS id, name, risk_profile AS "riskProfile", kyc_status AS "kycStatus"`;
const accountFields = `account_id AS id, client_id AS "clientId", name, RTRIM(currency) AS currency, cash`;
const positionFields = `position_id AS id, account_id AS "accountId", symbol, name, quantity, price`;
const orderFields = `order_id AS id, account_id AS "accountId", symbol, side, quantity, price, status`;
const transferFields = `transfer_id AS id, from_account_id AS "fromAccountId", to_account_id AS "toAccountId", amount, status, reference`;
const exceptionFields = `exception_id AS id, account_id AS "accountId", reason, status, owner, note`;
const allocationFields = `asset_class AS "assetClass", current_weight AS "currentWeight", target_weight AS "targetWeight"`;
const allocationOrder = ['Equity', 'Fixed income', 'Cash'] as const;

function formatCadAmount(amount: number) {
  const [whole, fraction] = amount.toFixed(2).split('.');
  return `${Number(whole).toLocaleString('en-US')}.${fraction}`;
}

function formatWeight(weight: number) {
  return weight.toFixed(2).replace(/\.?0+$/, '');
}

function audit(client: PoolClient, action: string, entityId: string, detail: string) {
  return client.query(
    `WITH next AS (SELECT nextval('wf_audit_seq') AS seq)
     INSERT INTO wf_audit (audit_id, seq, action, entity_id, detail)
     SELECT 'AU' || seq, seq, $1, $2, $3 FROM next`,
    [action, entityId, detail],
  );
}

async function selected<T>(client: PoolClient, sql: string, params: unknown[] = []) {
  const result = await client.query<T & QueryResultRow>(sql, params);
  return result.rows;
}

export async function getBootstrap(): Promise<WorkflowBootstrap> {
  return withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const clients = await selected<WorkflowClient>(client, `SELECT ${clientFields} FROM wf_clients ORDER BY client_id`);
    const accounts = await selected<WorkflowAccount>(client, `SELECT ${accountFields} FROM wf_accounts ORDER BY account_id`);
    const positions = await selected<WorkflowPosition>(client, `SELECT ${positionFields} FROM wf_positions ORDER BY position_id`);
    const orders = await selected<WorkflowOrder>(client, `SELECT ${orderFields} FROM wf_orders ORDER BY seq`);
    const transfers = await selected<WorkflowTransfer>(client, `SELECT ${transferFields} FROM wf_transfers ORDER BY seq`);
    const exceptions = await selected<WorkflowException>(client, `SELECT ${exceptionFields} FROM wf_exceptions ORDER BY exception_id`);
    const allocations = await selected<WorkflowAllocation>(client, `SELECT ${allocationFields} FROM wf_allocations ORDER BY display_order`);
    const auditRows = await selected<WorkflowAudit>(client, `SELECT audit_id AS id, action, entity_id AS "entityId", detail, created_at AS "createdAt" FROM wf_audit ORDER BY seq DESC`);
    return {
      clients,
      accounts,
      positions,
      orders,
      transfers,
      exceptions,
      allocations,
      audit: auditRows.map(row => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })),
    };
  });
}

export async function updateClient(
  id: string,
  patch: Partial<Pick<WorkflowClient, 'riskProfile' | 'kycStatus'>>,
): Promise<WorkflowClient> {
  return withTransaction(async client => {
    const [current] = await selected<WorkflowClient>(client, `SELECT ${clientFields} FROM wf_clients WHERE client_id = $1 FOR UPDATE`, [id]);
    if (!current) notFound(`Client ${id} not found.`);
    const riskProfile = patch.riskProfile ?? current.riskProfile;
    const kycStatus = patch.kycStatus ?? current.kycStatus;
    const changes: string[] = [];
    if (riskProfile !== current.riskProfile) changes.push(`Risk profile ${current.riskProfile} → ${riskProfile}`);
    if (kycStatus !== current.kycStatus) changes.push(`KYC status ${current.kycStatus} → ${kycStatus}`);
    if (changes.length === 0) return current;
    await client.query('UPDATE wf_clients SET risk_profile = $2, kyc_status = $3 WHERE client_id = $1', [id, riskProfile, kycStatus]);
    await audit(client, 'client.updated', id, changes.join('; '));
    return { ...current, riskProfile, kycStatus };
  });
}

async function lockAccount(client: PoolClient, accountId: string) {
  const [account] = await selected<WorkflowAccount & { clientId: string; currency: string }>(
    client,
    `SELECT account_id AS id, client_id AS "clientId", name, RTRIM(currency) AS currency, cash
       FROM wf_accounts WHERE account_id = $1 FOR UPDATE`,
    [accountId],
  );
  return account;
}

export async function createOrder(input: { accountId: string; symbol: string; side: 'Buy' | 'Sell'; quantity: number }): Promise<WorkflowOrder> {
  return withTransaction(async client => {
    const account = await lockAccount(client, input.accountId);
    if (!account) throw new HttpError(400, `Account ${input.accountId} not found.`);
    const [position] = await selected<WorkflowPosition>(client,
      `SELECT ${positionFields} FROM wf_positions WHERE account_id = $1 AND symbol = $2 FOR UPDATE`,
      [input.accountId, input.symbol]);
    if (!position) throw new HttpError(400, `Instrument ${input.symbol} is not held in account ${input.accountId}.`);

    if (input.side === 'Buy') {
      const [cashCheck] = await selected<{ insufficient: boolean }>(client,
        `SELECT $2::numeric * $3::numeric > a.cash - COALESCE(
           (SELECT SUM(quantity * price) FROM wf_orders WHERE account_id = a.account_id AND side = 'Buy' AND status = 'Open'), 0
         ) AS insufficient
         FROM wf_accounts a WHERE a.account_id = $1`,
        [input.accountId, input.quantity, position.price]);
      if (cashCheck.insufficient) conflict(`Insufficient available cash in account ${input.accountId}.`);
    } else if (input.quantity > position.quantity) {
      conflict(`Sell quantity ${input.quantity} exceeds the ${position.quantity} ${input.symbol} shares held in ${input.accountId}.`);
    }

    const [order] = await selected<WorkflowOrder>(client,
      `WITH next AS (SELECT nextval('wf_order_seq') AS seq)
       INSERT INTO wf_orders (order_id, seq, account_id, symbol, side, quantity, price, status)
       SELECT 'O' || seq, seq, $1, $2, $3, $4, $5, 'Open' FROM next
       RETURNING order_id AS id, account_id AS "accountId", symbol, side, quantity, price, status`,
      [input.accountId, input.symbol, input.side, input.quantity, position.price]);
    await audit(client, 'order.created', order.id, `${input.side} ${input.quantity} ${input.symbol} @ ${Number(order.price).toFixed(2)} in ${input.accountId}`);
    return order;
  });
}

export async function cancelOrder(id: string): Promise<WorkflowOrder> {
  return withTransaction(async client => {
    const [order] = await selected<WorkflowOrder>(client,
      `SELECT ${orderFields} FROM wf_orders WHERE order_id = $1 FOR UPDATE`, [id]);
    if (!order) notFound(`Order ${id} not found.`);
    if (order.status !== 'Open') conflict(`Order ${id} is already Cancelled.`);
    const [updated] = await selected<WorkflowOrder>(client,
      `UPDATE wf_orders SET status = 'Cancelled' WHERE order_id = $1
       RETURNING order_id AS id, account_id AS "accountId", symbol, side, quantity, price, status`, [id]);
    await audit(client, 'order.cancelled', id, `Cancelled ${order.side} ${order.quantity} ${order.symbol} in ${order.accountId}`);
    return updated;
  });
}

export async function createTransfer(input: {
  fromAccountId: string; toAccountId: string; amount: string; reference: string | null;
}): Promise<WorkflowTransfer> {
  return withTransaction(async client => {
    const ids = [input.fromAccountId, input.toAccountId].sort();
    const locked = await selected<WorkflowAccount & { clientId: string; currency: string }>(client,
      `SELECT account_id AS id, client_id AS "clientId", name, RTRIM(currency) AS currency, cash
         FROM wf_accounts WHERE account_id = ANY($1::varchar[]) ORDER BY account_id FOR UPDATE`, [ids]);
    const from = locked.find(account => account.id === input.fromAccountId);
    const to = locked.find(account => account.id === input.toAccountId);
    if (!from) throw new HttpError(400, `Account ${input.fromAccountId} not found.`);
    if (!to) throw new HttpError(400, `Account ${input.toAccountId} not found.`);
    if (from.clientId !== to.clientId) throw new HttpError(400, 'Accounts must belong to the same client.');
    if (from.currency !== 'CAD' || to.currency !== 'CAD') throw new HttpError(400, 'Transfers are only available between CAD accounts.');

    const [cashCheck] = await selected<{ insufficient: boolean }>(client,
      `SELECT $2::numeric > a.cash - COALESCE(
         (SELECT SUM(quantity * price) FROM wf_orders WHERE account_id = a.account_id AND side = 'Buy' AND status = 'Open'), 0
       ) AS insufficient
       FROM wf_accounts a WHERE a.account_id = $1`,
      [input.fromAccountId, input.amount]);
    if (cashCheck.insufficient) conflict(`Insufficient available cash in account ${input.fromAccountId}.`);

    await client.query('UPDATE wf_accounts SET cash = cash - $2::numeric WHERE account_id = $1', [input.fromAccountId, input.amount]);
    await client.query('UPDATE wf_accounts SET cash = cash + $2::numeric WHERE account_id = $1', [input.toAccountId, input.amount]);
    const [transfer] = await selected<WorkflowTransfer>(client,
      `WITH next AS (SELECT nextval('wf_transfer_seq') AS seq)
       INSERT INTO wf_transfers (transfer_id, seq, from_account_id, to_account_id, amount, status, reference)
       SELECT 'T' || seq, seq, $1, $2, $3, 'Completed', COALESCE($4, 'TRF-' || seq) FROM next
       RETURNING transfer_id AS id, from_account_id AS "fromAccountId", to_account_id AS "toAccountId", amount, status, reference`,
      [input.fromAccountId, input.toAccountId, input.amount, input.reference]);
    await audit(client, 'transfer.completed', transfer.id, `CAD ${formatCadAmount(Number(transfer.amount))} ${input.fromAccountId} → ${input.toAccountId} (ref ${transfer.reference})`);
    return transfer;
  });
}

export async function updateAllocations(allocations: { assetClass: string; targetWeight: number }[]) {
  return withTransaction(async client => {
    const current = await selected<WorkflowAllocation>(client,
      `SELECT ${allocationFields} FROM wf_allocations ORDER BY display_order FOR UPDATE`);
    const before = new Map(current.map(item => [item.assetClass, item.targetWeight]));
    for (const allocation of allocations) {
      await client.query('UPDATE wf_allocations SET target_weight = $2 WHERE asset_class = $1', [allocation.assetClass, allocation.targetWeight]);
    }
    const after = new Map(allocations.map(item => [item.assetClass, item.targetWeight]));
    const beforeTargets = allocationOrder.map(assetClass => formatWeight(before.get(assetClass) ?? 0)).join('/');
    const afterTargets = allocationOrder.map(assetClass => formatWeight(after.get(assetClass) ?? 0)).join('/');
    const detail = `Targets ${beforeTargets} → ${afterTargets} (${allocationOrder.join('/')})`;
    await audit(client, 'allocations.updated', 'ALLOCATIONS', detail);
    return selected<WorkflowAllocation>(client, `SELECT ${allocationFields} FROM wf_allocations ORDER BY display_order`);
  });
}

export async function getRebalancePreview() {
  const allocations = await query<WorkflowAllocation>(`SELECT ${allocationFields} FROM wf_allocations ORDER BY display_order`);
  return computeDrifts(allocations);
}

export async function updateException(
  id: string,
  patch: { owner?: string; note?: string; status?: 'Open' | 'In progress' | 'Resolved' },
): Promise<WorkflowException> {
  return withTransaction(async client => {
    const [current] = await selected<WorkflowException>(client,
      `SELECT ${exceptionFields} FROM wf_exceptions WHERE exception_id = $1 FOR UPDATE`, [id]);
    if (!current) notFound(`Exception ${id} not found.`);
    if (current.status === 'Resolved') conflict(`Exception ${id} is resolved and cannot be changed.`);
    const owner = patch.owner ?? current.owner;
    const note = patch.note ?? current.note;
    const status = patch.status ?? current.status;
    if (status === 'Resolved' && !owner) badRequest('Owner is required.');
    if (status === 'Resolved' && (!note || note.trim().length < 10)) badRequest('Add a note of at least 10 characters.');
    const changes: string[] = [];
    if (owner !== current.owner) changes.push(`Owner assigned: ${owner}`);
    if (status !== current.status) changes.push(`Status ${current.status} → ${status}`);
    if (note !== current.note) changes.push(`Note: ${note}`);
    if (changes.length === 0) return current;
    const [updated] = await selected<WorkflowException>(client,
      `UPDATE wf_exceptions SET owner = $2, note = $3, status = $4 WHERE exception_id = $1
       RETURNING exception_id AS id, account_id AS "accountId", reason, status, owner, note`,
      [id, owner, note, status]);
    await audit(client, 'exception.updated', id, changes.join('; '));
    return updated;
  });
}

export async function resetWorkflowData() {
  const client = await (await import('../db/pool')).getPool().connect();
  try {
    await client.query('BEGIN');
    const statements = splitSqlScript(readFileSync(`${DB_DIR}workflow-seed.sql`, 'utf8'));
    for (const statement of statements) await client.query(statement);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
