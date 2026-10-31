import pg from 'pg';
import type { QueryResultRow } from 'pg';

const { Pool, types } = pg;
types.setTypeParser(20, value => Number(value));
types.setTypeParser(1700, value => Number(value));

export const dbConfig = process.env.DATABASE_URL ?? 'postgres://wealth:wealth@127.0.0.1:5432/wealth';
export const getConnectionString = (databaseUrl = dbConfig) => databaseUrl;

export function maintenanceConnectionString(databaseUrl = dbConfig) {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  return url.toString();
}

let pool: pg.Pool | undefined;

export function getPool() {
  pool ??= new Pool({ connectionString: dbConfig });
  return pool;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}
