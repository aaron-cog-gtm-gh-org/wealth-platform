// Oracle integration test for US4/US5 (T040/T044): message listing, raw-text byte parity,
// ingestion status and ingest runs. Needs the local Oracle container; skipped unless
// CUSTODY_INT=1.   CUSTODY_INT=1 npx tsx --test server/custody/__tests__/messages.int.test.ts
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import oracledb from 'oracledb';
import { dbConfig } from '../../db/pool';
import { loadLegacyCustody, setupDatabase } from '../../db/setup';
import { sha256 } from '../archive.js';
import { defaultArchiveDir } from '../ingest.js';
import {
  IngestBusyError, getIngestionStatus, getMessage, listMessages, triggerIngestRun,
} from '../../repositories/custody';

const enabled = process.env.CUSTODY_INT === '1';
const ARCHIVE = defaultArchiveDir();

test('US4/US5: messages browser + ingestion admin', { skip: !enabled && 'set CUSTODY_INT=1 (needs Oracle)', timeout: 900_000 }, async () => {
  await setupDatabase(dbConfig);
  await loadLegacyCustody(dbConfig);
  const tmp = mkdtempSync(join(tmpdir(), 'pv-archive-'));
  const conn = await oracledb.getConnection(dbConfig);
  try {
    const msgIdOf = async (f: string) =>
      Number(((await conn.execute<{ M: number }>(`SELECT message_id AS m FROM custody_messages WHERE source_file = :f`, { f },
        { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows ?? [])[0]?.M);

    // --- listMessages -------------------------------------------------------
    const filtered = await listMessages({ type: '535', date: '2026-07-17', safe: 16598 });
    assert.ok(filtered.rows.some(r => r.sourceFile === 'mt535/MT535_16598_20260717_001.txt'));
    assert.equal((await listMessages({ type: '54x' })).total, 2971);
    const all = await listMessages({});
    assert.equal(all.total, 6044);
    assert.equal(all.rows.length, 50);
    assert.ok(all.rows[0].sourceFile.startsWith('mt535/'));
    assert.ok(all.rows.every(r => r.sizeBytes > 0));

    // --- getMessage byte parity ---------------------------------------------
    // 20 deterministic pseudo-random files plus named specials.
    const sampled = (await conn.execute<{ F: string }>(
      `SELECT source_file AS f FROM (SELECT source_file, ROW_NUMBER() OVER (ORDER BY message_id) rn FROM custody_messages)
        WHERE MOD(rn, 302) = 1 FETCH FIRST 20 ROWS ONLY`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows!.map(r => r.F);
    const lfFile = 'mt535/MT535_10024_20260807_001.txt';
    const files = [...sampled,
      'mt535/MT535_16598_20260717_001.txt',
      lfFile,                                     // LF-only August file
      'mt535/MT535_10049_20260717_001.txt',       // SUBSAFE statement
      'mt54x/20260428/MT547_14397_20260428_004.txt', // MT547 CANC
    ];
    assert.ok(!readFileSync(join(ARCHIVE, lfFile)).includes(13), 'LF-only file has no CR');
    for (const f of files) {
      const m = await getMessage(await msgIdOf(f));
      assert.ok(m, f);
      const want = sha256(readFileSync(join(ARCHIVE, f)));
      assert.equal(createHash('sha256').update(m.rawText, 'utf8').digest('hex'), want, `rawText sha ${f}`);
      assert.equal(m.contentSha256, want, `contentSha256 ${f}`);
    }
    assert.equal((await getMessage(await msgIdOf(lfFile)))!.rawText.includes('\r'), false);
    const canc = await getMessage(await msgIdOf('mt54x/20260428/MT547_14397_20260428_004.txt'));
    assert.equal(canc!.derived?.kind, 'confirmation');
    assert.notEqual(canc!.derived?.cancelsMessageId ?? null, null);
    assert.equal(await getMessage(999999999), null);

    // --- getIngestionStatus -------------------------------------------------
    const st = await getIngestionStatus();
    assert.equal(st.messagesByType['535'], 3073);
    assert.equal([544, 545, 546, 547].reduce((n, t) => n + (st.messagesByType[String(t)] ?? 0), 0), 2971);
    assert.equal(st.statements, 3073);
    assert.equal(st.confirmations, 2971);
    assert.deepEqual(st.errors, []);
    assert.equal(st.lastRun?.filesNew, 6044);
    assert.equal(st.runInProgress, false);

    // --- triggerIngestRun ----------------------------------------------------
    const rerun = await triggerIngestRun({ triggeredBy: 'int-test' });
    assert.equal(rerun.filesNew, 0);
    assert.equal(rerun.filesDuplicate, 6044);
    const inflight = triggerIngestRun({ triggeredBy: 'int-test' });
    await assert.rejects(triggerIngestRun({ triggeredBy: 'int-test' }), IngestBusyError);
    await inflight;

    // --- incremental ingest from a copied archive ---------------------------
    cpSync(ARCHIVE, join(tmp, 'archive'), { recursive: true });
    cpSync(join(tmp, 'archive', 'mt535', 'MT535_16598_20260717_001.txt'),
      join(tmp, 'archive', 'mt535', 'MT535_16598_20260717_099.txt'));
    const delta = await triggerIngestRun({ triggeredBy: 'int-test', archiveDir: join(tmp, 'archive') });
    assert.equal(delta.filesNew, 1);
    assert.equal(delta.filesDuplicate, 6044);
  } finally {
    await conn.close();
    rmSync(tmp, { recursive: true, force: true });
    // restore the clean db:setup state
    await setupDatabase(dbConfig);
    await loadLegacyCustody(dbConfig);
  }
});
