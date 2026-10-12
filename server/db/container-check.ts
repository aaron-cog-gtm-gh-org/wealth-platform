import type { AddressInfo } from 'node:net';
import { GenericContainer, Wait } from 'testcontainers';

/**
 * End-to-end check against a throwaway Oracle: starts Oracle Database Free with Testcontainers,
 * loads schema + seed, boots the API on a random port and asserts on the seeded data.
 */
const container = await new GenericContainer('gvenzl/oracle-free:23-slim-faststart')
  .withEnvironment({ ORACLE_PASSWORD: 'oracle', APP_USER: 'wealth', APP_USER_PASSWORD: 'wealth' })
  .withExposedPorts(1521)
  .withWaitStrategy(Wait.forLogMessage('DATABASE IS READY TO USE!'))
  .withStartupTimeout(300_000)
  .start();

process.env.ORACLE_USER = 'wealth';
process.env.ORACLE_PASSWORD = 'wealth';
process.env.ORACLE_CONNECT_STRING = `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`;

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
  console.log('Oracle container check passed');
} finally {
  server.close();
  await closePool();
  await container.stop();
}
