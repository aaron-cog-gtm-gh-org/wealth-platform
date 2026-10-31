import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';

export interface TestDatabase {
  baseUrl: string;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const template = new URL(process.env.DATABASE_URL ?? 'postgres://wealth:wealth@127.0.0.1:5432/wealth');
  const name = `wealth_test_${process.pid}_${randomBytes(4).toString('hex')}`;
  template.pathname = `/${name}`;
  const databaseUrl = template.toString();
  process.env.DATABASE_URL = databaseUrl;
  process.env.ENABLE_TEST_RESET = '1';

  const { setupDatabase } = await import('./db/setup');
  const { closePool } = await import('./db/pool');
  const { createApp } = await import('./app');
  const { Client } = await import('pg');
  const { maintenanceConnectionString } = await import('./db/pool');
  await setupDatabase(databaseUrl);

  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  return {
    baseUrl,
    async reset() {
      const response = await fetch(`${baseUrl}/test/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error(`Test database reset failed with ${response.status}: ${await response.text()}`);
    },
    async close() {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await closePool();
      const client = new Client({ connectionString: maintenanceConnectionString(databaseUrl) });
      await client.connect();
      try {
        await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await client.end();
      }
    },
  };
}

export async function jsonRequest(baseUrl: string, path: string, method: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, body: await response.json() as Record<string, any> };
}
