import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createTestDatabase, jsonRequest } from '../test-db';

const contextPromise = createTestDatabase();
let context: Awaited<typeof contextPromise>;

before(async () => {
  context = await contextPromise;
});

beforeEach(async () => context.reset());

after(async () => {
  if (context) await context.close();
});

async function request(path: string, method: string, body?: unknown) {
  return jsonRequest(context.baseUrl, path, method, body);
}

test('health identifies the running application revision', async () => {
  const { response, body } = await request('/health', 'GET');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  if (process.env.APP_REVISION) assert.equal(body.revision, process.env.APP_REVISION);
  else assert.match(body.revision, /^[a-f0-9]{40}$/);
});

test('bootstrap contains exactly the seeded workflow records and wire types', async () => {
  const { response, body } = await request('/workflows/bootstrap', 'GET');
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body).sort(), ['accounts', 'allocations', 'audit', 'clients', 'exceptions', 'orders', 'positions', 'transfers']);
  assert.deepEqual(Object.keys(body.clients[0]).sort(), ['id', 'kycStatus', 'name', 'riskProfile']);
  assert.deepEqual(body.clients[0], { id: 'C1001', name: 'Eleanor Whitfield', riskProfile: 'Moderate', kycStatus: 'Current' });
  assert.equal(body.accounts.length, 3);
  assert.deepEqual(Object.keys(body.accounts[0]).sort(), ['cash', 'clientId', 'currency', 'id', 'name']);
  assert.equal(body.accounts[0].cash, 25000);
  assert.equal(typeof body.accounts[0].cash, 'number');
  assert.equal(typeof body.positions[0].price, 'number');
  assert.deepEqual(Object.keys(body.positions[0]).sort(), ['accountId', 'id', 'name', 'price', 'quantity', 'symbol']);
  assert.deepEqual(body.positions.map((position: { id: string }) => position.id), ['P1001', 'P1002', 'P1003']);
  assert.equal(body.orders.length, 0);
  assert.equal(body.transfers.length, 0);
  assert.equal(body.audit.length, 0);
  assert.equal(body.exceptions[0].owner, null);
  assert.equal(body.exceptions[0].note, null);
});

test('client updates validate input and append an audit event', async () => {
  const { response, body } = await request('/workflows/clients/C1001', 'PATCH', { riskProfile: 'Growth', kycStatus: 'Review due' });
  assert.equal(response.status, 200);
  assert.equal(body.riskProfile, 'Growth');
  const bootstrap = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(bootstrap.audit[0].action, 'client.updated');
  assert.equal(bootstrap.audit[0].detail, 'Risk profile Moderate → Growth; KYC status Current → Review due');
  assert.equal(bootstrap.audit.length, 1);
  await request('/workflows/clients/C1001', 'PATCH', { kycStatus: 'Current' });
  const updatedKyc = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(updatedKyc.audit[0].detail, 'KYC status Review due → Current');
  assert.equal(updatedKyc.audit.length, 2);
  const unchanged = await request('/workflows/clients/C1001', 'PATCH', { riskProfile: 'Growth', kycStatus: 'Current' });
  assert.equal(unchanged.response.status, 200);
  assert.equal(unchanged.body.riskProfile, 'Growth');
  assert.equal(unchanged.body.kycStatus, 'Current');
  assert.equal((await request('/workflows/bootstrap', 'GET')).body.audit.length, 2);
  assert.equal((await request('/workflows/clients/C1001', 'PATCH', { riskProfile: 'Invalid' })).response.status, 400);
  assert.equal((await request('/workflows/clients/unknown', 'PATCH', { riskProfile: 'Growth' })).response.status, 404);
  assert.equal((await request('/workflows/clients/C1001', 'PATCH', {})).response.status, 400);
  assert.equal((await request('/workflows/bootstrap', 'GET')).body.audit.length, 2);
});

test('orders validate references and quantities, and reserve available cash', async () => {
  const buy = await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: ' ry ', side: 'Buy', quantity: 100 });
  assert.equal(buy.response.status, 201);
  assert.equal(buy.body.id, 'O1001');
  assert.equal(buy.body.symbol, 'RY');
  assert.equal(buy.body.price, 140);
  let audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'order.created');
  assert.equal(audit[0].detail, 'Buy 100 RY @ 140.00 in A1001');
  assert.equal((await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 80 })).response.status, 409);
  assert.equal((await request('/workflows/bootstrap', 'GET')).body.audit.length, 1);
  assert.equal((await request('/workflows/orders/O1001/cancel', 'POST', {})).response.status, 200);
  audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit[0].action, 'order.cancelled');
  assert.equal(audit[0].detail, 'Cancelled Buy 100 RY in A1001');
  assert.equal((await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 80 })).response.status, 201);
  assert.equal((await request('/workflows/orders', 'POST', { accountId: 'missing', symbol: 'RY', side: 'Buy', quantity: 1 })).response.status, 400);
  const instrument = await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'NOPE', side: 'Buy', quantity: 1 });
  assert.equal(instrument.response.status, 400);
  assert.equal(instrument.body.error, 'Instrument NOPE is not held in account A1001.');
  for (const quantity of [0, 1.5, '5']) {
    assert.equal((await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity })).response.status, 400);
  }
  audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 3);
  assert.equal(audit[0].detail, 'Buy 80 RY @ 140.00 in A1001');
});

test('sells validate the held position quantity', async () => {
  const success = await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Sell', quantity: 100 });
  assert.equal(success.response.status, 201);
  assert.equal(success.body.side, 'Sell');
  const audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].detail, 'Sell 100 RY @ 140.00 in A1001');
});

test('a sell above the held position quantity is rejected', async () => {
  const result = await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Sell', quantity: 120 });
  assert.equal(result.response.status, 409);
  assert.match(result.body.error, /Sell quantity 120 exceeds the 100 RY shares held in A1001\./);
  assert.equal((await request('/workflows/bootstrap', 'GET')).body.audit.length, 0);
});

test('sells reserve all open quantities and cancellation releases shares', async () => {
  const sell = (quantity: number) => request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Sell', quantity });
  const first = await sell(70);
  assert.equal(first.response.status, 201);
  const rejected = await sell(31);
  assert.equal(rejected.response.status, 409);
  assert.match(rejected.body.error, /\b30\b/);
  assert.match(rejected.body.error, /available/i);
  let bootstrap = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(bootstrap.orders.length, 1);
  assert.equal(bootstrap.audit.length, 1);
  const second = await sell(20);
  assert.equal(second.response.status, 201);
  const aboveRemaining = await sell(11);
  assert.equal(aboveRemaining.response.status, 409);
  assert.match(aboveRemaining.body.error, /\b10\b.*available/i);
  assert.equal((await sell(10)).response.status, 201);
  const exhausted = await sell(1);
  assert.equal(exhausted.response.status, 409);
  assert.match(exhausted.body.error, /\b0\b.*available/i);
  bootstrap = (await request('/workflows/bootstrap', 'GET')).body;
  for (const order of bootstrap.orders) {
    assert.equal((await request(`/workflows/orders/${order.id}/cancel`, 'POST', {})).response.status, 200);
  }
  assert.equal((await sell(100)).response.status, 201);
});

test('parallel sells serialize available share validation', async () => {
  const results = await Promise.all([
    request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Sell', quantity: 70 }),
    request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Sell', quantity: 70 }),
  ]);
  assert.deepEqual(results.map(item => item.response.status).sort(), [201, 409]);
  assert.match(results.find(item => item.response.status === 409)!.body.error, /\b30\b.*available/i);
});

test('orders can be cancelled only once', async () => {
  await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 10 });
  let audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'order.created');
  assert.equal(audit[0].detail, 'Buy 10 RY @ 140.00 in A1001');
  assert.equal((await request('/workflows/orders/O1001/cancel', 'POST', {})).response.status, 200);
  audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 2);
  assert.equal(audit[0].action, 'order.cancelled');
  assert.equal(audit[0].detail, 'Cancelled Buy 10 RY in A1001');
  const repeated = await request('/workflows/orders/O1001/cancel', 'POST', {});
  assert.equal(repeated.response.status, 409);
  assert.equal(repeated.body.error, 'Order O1001 is already Cancelled.');
  assert.equal((await request('/workflows/orders/missing/cancel', 'POST', {})).response.status, 404);
  audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 2);
});

test('parallel orders serialize available cash validation', async () => {
  const results = await Promise.all([
    request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 100 }),
    request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 100 }),
  ]);
  assert.deepEqual(results.map(item => item.response.status).sort(), [201, 409]);
  const next = await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 80 });
  assert.equal(next.response.status, 409);
});

test('transfers move CAD cash atomically and retain a reference', async () => {
  const result = await request('/workflows/transfers', 'POST', {
    fromAccountId: 'A1001', toAccountId: 'A1002', amount: 1000, reference: '  monthly  ',
  });
  assert.equal(result.response.status, 201);
  assert.deepEqual(result.body, {
    id: 'T1001', fromAccountId: 'A1001', toAccountId: 'A1002', amount: 1000, status: 'Completed', reference: 'monthly',
  });
  let bootstrap = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(bootstrap.accounts[0].cash, 24000);
  assert.equal(bootstrap.accounts[1].cash, 11000);
  assert.equal(bootstrap.audit[0].action, 'transfer.completed');
  assert.equal(bootstrap.audit[0].detail, 'CAD 1,000.00 A1001 → A1002 (ref monthly)');
  const withoutReference = await request('/workflows/transfers', 'POST', {
    fromAccountId: 'A1001', toAccountId: 'A1002', amount: 1, reference: '   ',
  });
  assert.equal(withoutReference.response.status, 201);
  assert.equal(withoutReference.body.reference, 'TRF-1002');
  bootstrap = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(bootstrap.audit.length, 2);
  assert.equal(bootstrap.transfers[1].reference, 'TRF-1002');
  assert.equal(bootstrap.audit[0].detail, 'CAD 1.00 A1001 → A1002 (ref TRF-1002)');
});

test('transfers reject invalid accounts, currency, amount, and reference input', async () => {
  assert.equal((await request('/workflows/transfers', 'POST', { fromAccountId: 'A1001', toAccountId: 'A1001', amount: 1 })).response.status, 400);
  assert.equal((await request('/workflows/transfers', 'POST', { fromAccountId: 'missing', toAccountId: 'A1001', amount: 1 })).response.status, 400);
  assert.equal((await request('/workflows/transfers', 'POST', { fromAccountId: 'A1001', toAccountId: 'A1003', amount: 1 })).response.status, 400);
  const { Client } = await import('pg');
  const database = new Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  await database.query(`INSERT INTO wf_accounts (account_id, client_id, name, currency, cash) VALUES ('A1004', 'C1002', 'Chen USD Savings', 'USD', 1000)`);
  await database.end();
  assert.equal((await request('/workflows/transfers', 'POST', { fromAccountId: 'A1003', toAccountId: 'A1004', amount: 1 })).response.status, 400);
  for (const amount of ['', '   ', 'abc']) {
    assert.equal((await request('/workflows/transfers', 'POST', { fromAccountId: 'A1001', toAccountId: 'A1002', amount })).response.status, 400);
  }
  assert.equal((await request('/workflows/transfers', 'POST', { fromAccountId: 'A1001', toAccountId: 'A1002', amount: 1.001 })).response.status, 400);
  assert.equal((await request('/workflows/transfers', 'POST', { fromAccountId: 'A1001', toAccountId: 'A1002', amount: 1, reference: 'x'.repeat(81) })).response.status, 400);
  const reserved = await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 100 });
  assert.equal(reserved.response.status, 201);
  const before = (await request('/workflows/bootstrap', 'GET')).body.accounts.map((account: { cash: number }) => account.cash);
  assert.equal((await request('/workflows/transfers', 'POST', { fromAccountId: 'A1001', toAccountId: 'A1002', amount: 12000 })).response.status, 409);
  const afterState = (await request('/workflows/bootstrap', 'GET')).body.accounts.map((account: { cash: number }) => account.cash);
  assert.deepEqual(afterState, before);
  const audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'order.created');
});

test('parallel transfers serialize debits and preserve total cash', async () => {
  const results = await Promise.all([
    request('/workflows/transfers', 'POST', { fromAccountId: 'A1001', toAccountId: 'A1002', amount: 15000 }),
    request('/workflows/transfers', 'POST', { fromAccountId: 'A1001', toAccountId: 'A1002', amount: 15000 }),
  ]);
  assert.deepEqual(results.map(item => item.response.status).sort(), [201, 409]);
  const bootstrap = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(bootstrap.accounts[0].cash, 10000);
  assert.equal(bootstrap.accounts[0].cash + bootstrap.accounts[1].cash, 35000);
  assert.equal(bootstrap.audit.length, 1);
  assert.equal(bootstrap.audit[0].action, 'transfer.completed');
});

test('allocation edits are validated and preview is read-only', async () => {
  const before = (await request('/workflows/bootstrap', 'GET')).body;
  const invalid = await request('/workflows/allocations', 'PUT', { allocations: [
    { assetClass: 'Equity', targetWeight: 60 },
    { assetClass: 'Fixed income', targetWeight: 30 },
    { assetClass: 'Cash', targetWeight: 9 },
  ] });
  assert.equal(invalid.response.status, 400);
  for (const targetWeight of [null, '', 'ten']) {
    const response = await request('/workflows/allocations', 'PUT', { allocations: [
      { assetClass: 'Equity', targetWeight },
      { assetClass: 'Fixed income', targetWeight: 30 },
      { assetClass: 'Cash', targetWeight: 10 },
    ] });
    assert.equal(response.response.status, 400);
    assert.equal(response.body.error, 'Every asset class needs a numeric target.');
  }
  const changed = await request('/workflows/allocations', 'PUT', { allocations: [
    { assetClass: 'Equity', targetWeight: 70 },
    { assetClass: 'Fixed income', targetWeight: 20 },
    { assetClass: 'Cash', targetWeight: 10 },
  ] });
  assert.equal(changed.response.status, 200);
  assert.equal(changed.body.allocations[0].currentWeight, 60);
  const preview = await request('/workflows/rebalance/preview', 'POST', {});
  assert.equal(preview.response.status, 200);
  assert.equal(preview.body.status, 'Ready');
  assert.deepEqual(preview.body.trades.map((trade: { drift: number }) => trade.drift), [-10, 10, 0]);
  const afterUpdate = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(afterUpdate.audit.length, before.audit.length + 1);
  assert.equal(afterUpdate.audit[0].action, 'allocations.updated');
  assert.equal(afterUpdate.audit[0].detail, 'Targets 60/30/10 → 70/20/10 (Equity/Fixed income/Cash)');
  await request('/workflows/rebalance/preview', 'POST', {});
  assert.deepEqual((await request('/workflows/bootstrap', 'GET')).body, afterUpdate);
});

test('rebalance preview starts within tolerance and does not write', async () => {
  const before = (await request('/workflows/bootstrap', 'GET')).body;
  const preview = await request('/workflows/rebalance/preview', 'POST', {});
  assert.deepEqual(preview.body.status, 'Within tolerance');
  assert.deepEqual((await request('/workflows/bootstrap', 'GET')).body, before);
});

test('exceptions validate assignment, resolution, and immutable resolved state', async () => {
  const progress = await request('/workflows/exceptions/EX1001', 'PATCH', { owner: ' S. Patel ', status: 'In progress' });
  assert.equal(progress.response.status, 200);
  assert.equal(progress.body.owner, 'S. Patel');
  assert.equal(progress.body.status, 'In progress');
  assert.equal((await request('/workflows/bootstrap', 'GET')).body.audit[0].detail, 'Owner assigned: S. Patel; Status Open → In progress');
  const noteUpdate = await request('/workflows/exceptions/EX1001', 'PATCH', {
    owner: 'S. Patel', status: 'In progress', note: 'Settlement review completed',
  });
  assert.equal(noteUpdate.response.status, 200);
  let bootstrap = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(bootstrap.audit.length, 2);
  assert.equal(bootstrap.audit[0].detail, 'Note: Settlement review completed');
  const unchanged = await request('/workflows/exceptions/EX1001', 'PATCH', {
    owner: 'S. Patel', status: 'In progress', note: 'Settlement review completed',
  });
  assert.equal(unchanged.response.status, 200);
  bootstrap = (await request('/workflows/bootstrap', 'GET')).body;
  assert.equal(bootstrap.audit.length, 2);
  const invalidOwner = await request('/workflows/exceptions/EX1002', 'PATCH', { owner: 'Alex Morgan' });
  assert.equal(invalidOwner.response.status, 400);
  assert.equal(invalidOwner.body.error, 'Owner must be A. Nguyen or S. Patel.');
  const nullOwner = await request('/workflows/exceptions/EX1002', 'PATCH', { owner: null });
  assert.equal(nullOwner.response.status, 400);
  assert.equal(nullOwner.body.error, 'Owner must be A. Nguyen or S. Patel.');
  const emptyOwner = await request('/workflows/exceptions/EX1002', 'PATCH', { owner: '  ' });
  assert.equal(emptyOwner.response.status, 400);
  assert.equal(emptyOwner.body.error, 'Owner is required.');
  assert.equal((await request('/workflows/bootstrap', 'GET')).body.audit.length, 2);
  assert.equal((await request('/workflows/exceptions/EX1002', 'PATCH', { status: 'Resolved' })).response.status, 400);
  assert.equal((await request('/workflows/exceptions/EX1002', 'PATCH', { owner: 'S. Patel', note: 'short', status: 'Resolved' })).response.status, 400);
  const resolved = await request('/workflows/exceptions/EX1001', 'PATCH', { owner: 'S. Patel', note: 'Settlement instructions confirmed', status: 'Resolved' });
  assert.equal(resolved.response.status, 200);
  const audit = (await request('/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 3);
  assert.equal(audit[0].detail, 'Status In progress → Resolved; Note: Settlement instructions confirmed');
  assert.equal((await request('/workflows/exceptions/EX1001', 'PATCH', { status: 'Open' })).response.status, 409);
  assert.equal((await request('/workflows/exceptions/missing', 'PATCH', { owner: 'A. Nguyen' })).response.status, 404);
  assert.equal((await request('/workflows/bootstrap', 'GET')).body.audit.length, 3);
});

test('invalid JSON and unknown API routes return JSON errors', async () => {
  const malformed = await fetch(`${context.baseUrl}/workflows/orders`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'Request body must be valid JSON.' });
  const unknown = await fetch(`${context.baseUrl}/missing`);
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: 'Not found.' });
  assert.equal((await request('/workflows/orders', 'POST', [])).response.status, 400);
  const unknownField = await request('/workflows/orders', 'POST', { accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 1, extra: true });
  assert.equal(unknownField.response.status, 400);
  assert.match(unknownField.body.error, /extra/);
});

test('reset route is absent unless enabled for the app instance', async () => {
  const { createApp } = await import('../app');
  const previous = process.env.ENABLE_TEST_RESET;
  process.env.ENABLE_TEST_RESET = '0';
  const server = createApp().listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${(address as { port: number }).port}/api/test/reset`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found.' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previous === undefined) delete process.env.ENABLE_TEST_RESET;
    else process.env.ENABLE_TEST_RESET = previous;
  }
});
