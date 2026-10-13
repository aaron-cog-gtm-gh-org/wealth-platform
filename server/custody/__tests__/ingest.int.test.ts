// Oracle integration test (T021): full-archive ingest into a fresh schema, then a re-run.
// Needs the local Oracle container (`npm run db:up && npm run db:wait`); skipped unless CUSTODY_INT=1.
//   CUSTODY_INT=1 npm run test:int
import assert from 'node:assert/strict';
import { test } from 'node:test';
import oracledb from 'oracledb';
import { dbConfig } from '../../db/pool';
import { setupDatabase } from '../../db/setup';
import { defaultArchiveDir, ingestArchive } from '../ingest.js';
import { readLegacySeed } from '../legacy-seed.js';
import { defaultSeedDir, migrateLegacy } from '../migrate-legacy.js';

const enabled = process.env.CUSTODY_INT === '1';

test('full archive ingest is complete and idempotent', { skip: !enabled && 'set CUSTODY_INT=1 (needs Oracle)', timeout: 900_000 }, async () => {
  await setupDatabase(dbConfig);
  const conn = await oracledb.getConnection(dbConfig);
  try {
    const m = await migrateLegacy(conn, readLegacySeed(defaultSeedDir()));
    assert.deepEqual(m, { users: 6, clients: 50, accounts: 120, instruments: 302, breakNotes: 13 });

    const first = await ingestArchive(conn, defaultArchiveDir(), { triggeredBy: 'int-test' });
    assert.equal(first.filesSeen, 6044);
    assert.equal(first.filesNew, 6044);
    assert.equal(first.parseErrors, 0);
    assert.equal(first.statements, 3073);
    assert.equal(first.confirmations, 2971);

    const count = async (sql: string) => Number(Object.values((await conn.execute<Record<string, number>>(sql)).rows![0])[0]);
    assert.equal(await count(`SELECT COUNT(*) AS n FROM custody_messages`), 6044);
    assert.equal(await count(`SELECT COUNT(*) AS n FROM custody_messages WHERE mt_type = 535`), 3073);
    assert.equal(await count(`SELECT COUNT(*) AS n FROM (SELECT safe_no, statement_date FROM custody_statements GROUP BY safe_no, statement_date)`),
      await count(`SELECT COUNT(*) AS n FROM custody_statements WHERE is_effective = 1`));
    assert.equal(await count(`SELECT COUNT(*) AS n FROM custody_statements WHERE account_id IS NULL`), 0);
    assert.equal(await count(`SELECT is_effective AS n FROM custody_statements s JOIN custody_messages m ON m.message_id = s.message_id
                                WHERE m.source_file = 'mt535/MT535_16558_20260626_002.txt'`), 1);
    assert.ok(await count(`SELECT COUNT(*) AS n FROM custody_confirmations WHERE cancelled_by IS NOT NULL`) > 0);
    assert.equal(await count(`SELECT COUNT(*) AS n FROM custody_instruments WHERE isin = 'GB00ZZ004322' AND source = 'CUSTODIAN'`), 1);

    const second = await ingestArchive(conn, defaultArchiveDir(), { triggeredBy: 'int-test' });
    assert.equal(second.filesNew, 0);
    assert.equal(second.filesDuplicate, 6044);
    assert.equal(second.statements, 3073);
    assert.equal(second.confirmations, 2971);
    assert.equal(await count(`SELECT COUNT(*) AS n FROM custody_messages`), 6044);
    assert.equal(await count(`SELECT COUNT(*) AS n FROM custody_ingest_runs`), 2);
  } finally {
    await conn.close();
  }
});
