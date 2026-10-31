import type { AddressInfo } from 'node:net';
import { GenericContainer, Wait } from 'testcontainers';
import type { WorkflowBootstrap } from '../workflows/types';

/**
 * End-to-end check against a throwaway PostgreSQL container with Testcontainers,
 * loads schema + seed, boots the API on a random port and asserts on the seeded data.
 */
const container = await new GenericContainer('postgres:16-alpine')
  .withEnvironment({ POSTGRES_USER: 'wealth', POSTGRES_PASSWORD: 'wealth', POSTGRES_DB: 'wealth' })
  .withExposedPorts(5432)
  .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
  .withStartupTimeout(120_000)
  .start();

process.env.DATABASE_URL = `postgres://wealth:wealth@${container.getHost()}:${container.getMappedPort(5432)}/wealth`;

const { setupDatabase } = await import('./setup');
const { closePool } = await import('./pool');
const { createApp } = await import('../app');

const server = createApp().listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
const get = async (path: string): Promise<any> => (await fetch(base + path)).json();

function check(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  console.log(`ok  ${label} = ${actual}`);
}

try {
  await setupDatabase();
  const portfolio = await get('/households/HH-WHITFIELD/portfolio');
  check('holdings', portfolio.holdings.length, 25);
  check('accounts', portfolio.accounts.length, 3);
  check('total market value', portfolio.holdings.reduce((s: number, h: { marketValue: number }) => s + h.marketValue, 0), 8555922);
  const ex = await get('/ops/queues/' + encodeURIComponent('Wealth Ops – Toronto') + '/settlement-exceptions');
  check('settlement exceptions', ex.exceptions.length, 40);
  const rebalance = await get('/households/HH-WHITFIELD/rebalance');
  check('proposal', rebalance.proposal.id, 'RB-2026-0412');
  check('proposal trades', rebalance.trades.length, 7);
  const workflowResponse = await fetch(`${base}/workflows/bootstrap`);
  const workflows = await workflowResponse.json() as WorkflowBootstrap;
  check('workflow clients', workflows.clients.length, 2);
  check('workflow accounts', workflows.accounts.length, 3);
  check('workflow orders', workflows.orders.length, 0);
  check('workflow transfers', workflows.transfers.length, 0);
  check('workflow audit', workflows.audit.length, 0);
  check('workflow holdings price is numeric', typeof workflows.positions[0].price, 'number');
  console.log('PostgreSQL container check passed');
} finally {
  server.close();
  await closePool();
  await container.stop();
}
