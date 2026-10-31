import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createTestDatabase, jsonRequest } from './test-db';

const contextPromise = createTestDatabase();
let context: Awaited<typeof contextPromise>;

before(async () => {
  context = await contextPromise;
});

after(async () => {
  if (context) await context.close();
});

test('legacy portfolio and operations endpoints retain seeded values and wire types', async () => {
  const portfolio = (await jsonRequest(context.baseUrl, '/households/HH-WHITFIELD/portfolio', 'GET')).body;
  assert.equal(portfolio.holdings.length, 25);
  assert.equal(portfolio.accounts.length, 3);
  assert.equal(portfolio.holdings.reduce((sum: number, holding: { marketValue: number }) => sum + holding.marketValue, 0), 8555922);
  assert.equal(typeof portfolio.holdings[0].marketValue, 'number');
  assert.match(portfolio.holdings[0].currency, /^(CAD|USD)$/);
  const exceptions = (await jsonRequest(context.baseUrl, '/ops/queues/Wealth%20Ops%20%E2%80%93%20Toronto/settlement-exceptions', 'GET')).body;
  assert.equal(exceptions.exceptions.length, 40);
  const rebalance = (await jsonRequest(context.baseUrl, '/households/HH-WHITFIELD/rebalance', 'GET')).body;
  assert.equal(rebalance.proposal.id, 'RB-2026-0412');
  assert.equal(rebalance.trades.length, 7);
  const household = (await jsonRequest(context.baseUrl, '/households/HH-WHITFIELD', 'GET')).body;
  assert.match(household.nextReviewDate, /^\d{4}-\d{2}-\d{2}$/);
});
