import oracledb from 'oracledb';
import { dbConfig } from './pool';

/** Blocks until the configured Oracle database accepts connections (first boot of a container takes a while). */
const timeoutMs = Number(process.env.DB_WAIT_SECONDS ?? 300) * 1000;
const deadline = Date.now() + timeoutMs;

for (;;) {
  try {
    const conn = await oracledb.getConnection(dbConfig);
    await conn.close();
    console.log(`Oracle is accepting connections at ${dbConfig.connectString}`);
    break;
  } catch (err) {
    if (Date.now() > deadline) {
      console.error(`Oracle not reachable at ${dbConfig.connectString}: ${(err as Error).message}`);
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}
