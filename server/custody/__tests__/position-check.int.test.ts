import assert from 'node:assert/strict';
import { test } from 'node:test';
import oracledb from 'oracledb';
import { createApp } from '../../app';
import { closePool, dbConfig } from '../../db/pool';
import { loadLegacyCustody, setupDatabase } from '../../db/setup';
import { getBreakHistory, listBreakNotes, patchBreakNote, runPositionChecks } from '../../repositories/custody';

const enabled = process.env.CUSTODY_INT === '1';
const breakKey = (row: { accountId: number; isin: string; date: string }) => `${row.accountId}|${row.isin}|${row.date}`;

test('legacy and corrected position checks expose audited break notes', {
  skip: !enabled && 'set CUSTODY_INT=1 (needs Oracle)',
  timeout: 900_000,
}, async () => {
  await setupDatabase(dbConfig);
  try {
    await loadLegacyCustody();

    const corrected = await runPositionChecks({ mode: 'corrected' });
    assert.ok(corrected);
    assert.deepEqual(corrected.breaks.map(breakKey), [
      '2001|GB00ZZ011962|2026-07-17',
      '2074|GB00ZZ000908|2026-07-31',
    ]);
    assert.equal(corrected.breaks.find(row => row.accountId === 2001)?.status, 'RESOLVED');
    assert.equal(corrected.breaks.find(row => row.accountId === 2074)?.status, 'CHASED');

    const legacy = await runPositionChecks({ mode: 'legacy' });
    assert.ok(legacy);
    const conn = await oracledb.getConnection(dbConfig);
    let safeAccounts: Record<number, number>;
    try {
      const rows = (await conn.execute<{ safeNo: number; accountId: number }>(
        `SELECT safe_no AS "safeNo", account_id AS "accountId"
           FROM custody_accounts WHERE safe_no IN (10554, 11397)`,
        [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )).rows ?? [];
      safeAccounts = Object.fromEntries(rows.map(row => [row.safeNo, row.accountId]));
    } finally {
      await conn.close();
    }
    assert.ok(safeAccounts[10554]);
    assert.ok(safeAccounts[11397]);
    const expectedLegacy = [
      '2001|GB00ZZ011962|2026-07-17',
      '2074|GB00ZZ000908|2026-07-31',
      '2145|GB00ZZ001500|2026-07-17',
      '2038|GB00ZZ003373|2026-06-26',
      '2038|GB00ZZ003373|2026-07-03',
      `${safeAccounts[10554]}|LU00ZZ014180|2026-09-18`,
      `${safeAccounts[11397]}|LU00ZZ013430|2026-09-18`,
    ].sort();
    assert.deepEqual(legacy.breaks.map(breakKey).sort(), expectedLegacy);
    const migratedBreak = legacy.breaks.find(row => row.accountId === 2038 && row.date === '2026-06-26');
    assert.equal(migratedBreak?.status, 'OPEN');
    assert.ok(migratedBreak?.note);

    assert.equal((await runPositionChecks({ date: '2026-07-17', mode: 'corrected' }))?.breaks.length, 1);
    assert.equal((await runPositionChecks({ date: '2026-07-17', mode: 'legacy' }))?.breaks.length, 2);

    const notes = await listBreakNotes();
    assert.equal(notes.length, 13);
    assert.equal(notes.find(row => row.accountId === 2004 && row.isin === 'US00ZZ011817' && row.date === '2016-03-11')?.status, 'OPEN');
    const resolved = notes.find(row => row.accountId === 2010 && row.isin === 'GB00ZZ002334');
    assert.equal(resolved?.status, 'RESOLVED');
    assert.equal(resolved?.updatedBy, 'TGARNER');
    assert.equal(notes.find(row => row.accountId === 2004 && row.isin === 'GB00ZZ006624' && row.date === '2017-09-15')?.updatedBy, 'LEGACY');

    const history = await getBreakHistory(2074, 'GB00ZZ000908', '2026-07-31');
    assert.ok(history);
    assert.equal(history.length, 1);
    assert.equal(history[0].source, 'LEGACY_MIGRATION');
    assert.equal(history[0].status, 'CHASED');
    const oldNote = history[0].note;

    const updated = await patchBreakNote(2074, 'GB00ZZ000908', '2026-07-31', {
      author: 'Test Analyst', note: 'Called KSS again',
    });
    assert.equal(updated?.status, 'CHASED');
    assert.equal(updated?.note, 'Called KSS again');
    assert.equal(updated?.updatedBy, 'Test Analyst');
    const updatedHistory = await getBreakHistory(2074, 'GB00ZZ000908', '2026-07-31');
    assert.ok(updatedHistory);
    assert.deepEqual(updatedHistory.map(row => [row.source, row.updatedBy, row.note, row.status]), [
      ['USER', 'Test Analyst', 'Called KSS again', 'CHASED'],
      ['LEGACY_MIGRATION', 'LBRENNAN', oldNote, 'CHASED'],
    ]);

    const statusOnly = await patchBreakNote(2074, 'GB00ZZ000908', '2026-07-31', {
      author: 'Test Analyst', status: 'RESOLVED',
    });
    assert.equal(statusOnly?.note, 'Called KSS again');

    const newNote = await patchBreakNote(2145, 'GB00ZZ001500', '2026-07-17', {
      author: 'Test Analyst', note: 'Follow up',
    });
    assert.equal(newNote?.status, 'OPEN');
    assert.equal(newNote?.note, 'Follow up');
    assert.equal((await getBreakHistory(2145, 'GB00ZZ001500', '2026-07-17'))?.length, 1);

    const app = createApp();
    const server = app.listen(0);
    try {
      await new Promise<void>(resolve => server.once('listening', resolve));
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const base = `http://127.0.0.1:${address.port}/api/custody`;

      const missingAuthor = await fetch(`${base}/breaks/2074/GB00ZZ000908/2026-07-31`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 'No author' }),
      });
      assert.equal(missingAuthor.status, 400);
      assert.equal((await missingAuthor.json() as { error: string }).error, 'author is required');

      const malformedJson = await fetch(`${base}/breaks/2074/GB00ZZ000908/2026-07-31`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{',
      });
      assert.equal(malformedJson.status, 400);

      const unknownHistory = await fetch(`${base}/breaks/999999/GB00ZZ000908/2026-07-31/history`);
      assert.equal(unknownHistory.status, 404);

      const legacyResponse = await fetch(`${base}/position-checks?mode=legacy`);
      assert.equal(legacyResponse.status, 200);
      assert.equal(((await legacyResponse.json() as { breaks: unknown[] }).breaks).length, 7);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(err => err ? reject(err) : resolve());
      });
    }
  } finally {
    await closePool();
  }
});
