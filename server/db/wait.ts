import pg from 'pg';
import { dbConfig, maintenanceConnectionString } from './pool';

const timeoutMs = Number(process.env.DB_WAIT_SECONDS ?? 60) * 1000;
const deadline = Date.now() + timeoutMs;

for (;;) {
  const client = new pg.Client({ connectionString: maintenanceConnectionString(dbConfig) });
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log(`PostgreSQL is accepting connections at ${maintenanceConnectionString(dbConfig)}`);
    break;
  } catch (err) {
    if (Date.now() > deadline) {
      console.error(`PostgreSQL not reachable at ${maintenanceConnectionString(dbConfig)}: ${(err as Error).message}`);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 3000));
  } finally {
    await client.end().catch(() => undefined);
  }
}
