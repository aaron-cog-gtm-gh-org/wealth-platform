import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { createTestDatabase, jsonRequest } from '../test-db';

const contextPromise = createTestDatabase();
let context: Awaited<typeof contextPromise>;
let pool: typeof import('../db/pool');
let archive: typeof import('./load-archive');

before(async () => {
  context = await contextPromise;
  pool = await import('../db/pool');
  archive = await import('./load-archive');
});

after(async () => {
  if (context) await context.close();
});

const count = async (table: string) => Number((await pool.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`))[0].n);

const RECON_NOTES = `SELECT acct_id, isin, to_char(stmt_date, 'YYYY-MM-DD') AS stmt_date, status, note, updated_by,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS updated_at
  FROM custody_recon_notes ORDER BY acct_id, isin, stmt_date`;

test('custody reference data is migrated with PV IDs and values', async () => {
  assert.equal(await count('custody_users'), 6);
  assert.equal(await count('custody_clients'), 50);
  assert.equal(await count('custody_accounts'), 120);
  assert.equal(await count('custody_instruments'), 302);
  assert.equal(await count('custody_recon_notes'), 13);
  assert.deepEqual(await pool.query('SELECT * FROM custody_users WHERE user_id IN (1, 9) ORDER BY user_id'), [
    { user_id: 1, username: 'PVADMIN', full_name: 'System Administrator', role: 'ADMIN', active: true },
    { user_id: 9, username: 'LBRENNAN', full_name: 'Lauren Brennan', role: 'OPS', active: true },
  ]);
  assert.deepEqual(await pool.query(`SELECT acct_id, acct_no, client_id, acct_type, base_ccy, safe_code,
    to_char(open_date, 'YYYY-MM-DD') AS open_date, to_char(close_date, 'YYYY-MM-DD') AS close_date, status
    FROM custody_accounts WHERE acct_id IN (2001, 2007, 2140) ORDER BY acct_id`), [
    { acct_id: 2001, acct_no: '01001-01', client_id: 1001, acct_type: 'SIPP', base_ccy: 'GBP', safe_code: '16598', open_date: '2019-06-10', close_date: null, status: 'O' },
    { acct_id: 2007, acct_no: '01005-02', client_id: 1005, acct_type: 'SIPP ', base_ccy: 'GBP', safe_code: '13760', open_date: '2013-04-01', close_date: null, status: 'O' },
    { acct_id: 2140, acct_no: '01077-02', client_id: 1077, acct_type: 'SIPP ', base_ccy: 'GBP', safe_code: '14226', open_date: '2021-02-13', close_date: '2026-06-26', status: 'C' },
  ]);
  assert.deepEqual(await pool.query('SELECT client_id, client_ref, name, adviser_user_id, status FROM custody_clients WHERE client_id = 1001'),
    [{ client_id: 1001, client_ref: 'C2017-0124', name: 'The Penhaligon Family Trust', adviser_user_id: 7, status: 'A' }]);
  const notes = await pool.query<{ acct_id: number; stmt_date: string }>(RECON_NOTES);
  assert.deepEqual(notes.find(note => note.acct_id === 2038), {
    acct_id: 2038, isin: 'GB00ZZ003373', stmt_date: '2026-06-26', status: 'O',
    note: 'custodian resent statement for this date, qty looks short vs contract note. raised with KSS',
    updated_by: 'LBRENNAN', updated_at: '2026-06-30T08:41',
  });
  assert.deepEqual(notes.find(note => note.acct_id === 2004 && note.stmt_date === '2017-09-15'), {
    acct_id: 2004, isin: 'GB00ZZ006624', stmt_date: '2017-09-15', status: 'O', note: '', updated_by: null, updated_at: null,
  });
});

test('every archive file is loaded as a pending custody message with file-name metadata', async () => {
  assert.deepEqual(await pool.query(`SELECT msg_family, mt_type, count(*)::int AS files, count(day_folder)::int AS with_day,
    count(*) FILTER (WHERE parse_status = 'pending')::int AS pending
    FROM custody_messages GROUP BY 1, 2 ORDER BY 2`), [
    { msg_family: 'MT535', mt_type: 535, files: 3073, with_day: 0, pending: 3073 },
    { msg_family: 'MT54x', mt_type: 544, files: 112, with_day: 112, pending: 112 },
    { msg_family: 'MT54x', mt_type: 545, files: 1496, with_day: 1496, pending: 1496 },
    { msg_family: 'MT54x', mt_type: 546, files: 65, with_day: 65, pending: 65 },
    { msg_family: 'MT54x', mt_type: 547, files: 1298, with_day: 1298, pending: 1298 },
  ]);
  assert.equal(Number((await pool.query<{ n: string }>('SELECT sum(size_bytes) AS n FROM custody_messages'))[0].n), 8957493);
  const rows = await pool.query(`SELECT file_name, rel_path, msg_family, mt_type, safe_code, to_char(msg_date, 'YYYY-MM-DD') AS msg_date,
    file_seq, day_folder, size_bytes, raw_text, parse_status, parse_error FROM custody_messages
    WHERE file_name IN ('MT535_10024_20260417_001.txt', 'MT545_16594_20260420_002.txt') ORDER BY file_name`);
  assert.deepEqual(rows, [
    {
      file_name: 'MT535_10024_20260417_001.txt', rel_path: 'mt535/MT535_10024_20260417_001.txt', msg_family: 'MT535', mt_type: 535,
      safe_code: '10024', msg_date: '2026-04-17', file_seq: 1, day_folder: null, size_bytes: 260,
      raw_text: readFileSync(`${archive.ARCHIVE_DIR}mt535/MT535_10024_20260417_001.txt`, 'utf8'), parse_status: 'pending', parse_error: null,
    },
    {
      file_name: 'MT545_16594_20260420_002.txt', rel_path: 'mt54x/20260420/MT545_16594_20260420_002.txt', msg_family: 'MT54x', mt_type: 545,
      safe_code: '16594', msg_date: '2026-04-20', file_seq: 2, day_folder: '20260420', size_bytes: 578,
      raw_text: readFileSync(`${archive.ARCHIVE_DIR}mt54x/20260420/MT545_16594_20260420_002.txt`, 'utf8'), parse_status: 'pending', parse_error: null,
    },
  ]);
  assert.match(rows[1].raw_text as string, /^\{1:F01BRKWGB2LAXXX.*\r\n:16R:GENL\r\n/);
});

test('archive load is idempotent and resynchronises changed or missing files', async () => {
  const ids = await pool.query('SELECT message_id, file_name FROM custody_messages ORDER BY message_id');
  const client = await pool.getPool().connect();
  try {
    assert.deepEqual(await archive.loadArchive(client), { mt535: 3073, mt54x: 2971, inserted: 0, updated: 0, removed: 0 });
    await client.query(`UPDATE custody_messages SET raw_text = 'x', parse_status = 'ok' WHERE file_name = 'MT535_10024_20260417_001.txt'`);
    await client.query(`DELETE FROM custody_messages WHERE file_name = 'MT547_13759_20260420_001.txt'`);
    await client.query(`INSERT INTO custody_messages (file_name, rel_path, msg_family, mt_type, safe_code, msg_date, file_seq, size_bytes, raw_text)
      VALUES ('MT535_99999_20260417_001.txt', 'mt535/MT535_99999_20260417_001.txt', 'MT535', 535, '99999', '2026-04-17', 1, 1, 'x')`);
    assert.deepEqual(await archive.loadArchive(client), { mt535: 3073, mt54x: 2971, inserted: 1, updated: 1, removed: 1 });
    assert.deepEqual(await archive.loadArchive(client), { mt535: 3073, mt54x: 2971, inserted: 0, updated: 0, removed: 0 });
  } finally {
    client.release();
  }
  const restored = await pool.query(`SELECT parse_status, raw_text = $1 AS same FROM custody_messages WHERE file_name = 'MT535_10024_20260417_001.txt'`,
    [readFileSync(`${archive.ARCHIVE_DIR}mt535/MT535_10024_20260417_001.txt`, 'utf8')]);
  assert.deepEqual(restored, [{ parse_status: 'pending', same: true }]);
  const after = await pool.query<{ message_id: number; file_name: string }>('SELECT message_id, file_name FROM custody_messages ORDER BY message_id');
  assert.equal(after.length, 6044);
  const unchanged = ids.filter(row => row.file_name !== 'MT547_13759_20260420_001.txt');
  assert.deepEqual(after.slice(0, unchanged.length), unchanged);
});

test('archive file names map to unpadded safekeeping codes and reject unexpected paths', () => {
  assert.deepEqual(archive.describeArchiveFile('mt54x/20260505/MT546_0012345_20260504_003.txt'), {
    fileName: 'MT546_0012345_20260504_003.txt', relPath: 'mt54x/20260505/MT546_0012345_20260504_003.txt', family: 'MT54x',
    mtType: 546, safeCode: '12345', msgDate: '2026-05-04', fileSeq: 3, dayFolder: '20260505',
  });
  assert.equal(archive.describeArchiveFile('mt535/MT535_0000_20260417_001.txt').safeCode, '0');
  assert.throws(() => archive.describeArchiveFile('mt535/MT540_10024_20260417_001.txt'), /Unexpected archive file name/);
  assert.throws(() => archive.describeArchiveFile('mt54x/MT545_10024_20260417_001.txt'), /outside mt54x/);
  assert.throws(() => archive.describeArchiveFile('mt535/MT535_10024_20260231_001.txt'), /Invalid date/);
});

test('test reset restores the 13 seed recon notes', async () => {
  const seeded = await pool.query(RECON_NOTES);
  await pool.query(`UPDATE custody_recon_notes SET status = 'CHASED', note = 'Chased custodian', updated_by = 'PVADMIN', updated_at = now()
    WHERE acct_id = 2074`);
  await pool.query(`DELETE FROM custody_recon_notes WHERE acct_id = 2001`);
  await pool.query(`INSERT INTO custody_recon_notes (acct_id, isin, stmt_date, status, note, updated_by, updated_at)
    VALUES (2002, 'GB00ZZ000080', '2026-10-09', 'NEW', 'Break raised', 'LBRENNAN', now())`);
  assert.notDeepEqual(await pool.query(RECON_NOTES), seeded);
  const { response } = await jsonRequest(context.baseUrl, '/test/reset', 'POST', {});
  assert.equal(response.status, 200);
  assert.deepEqual(await pool.query(RECON_NOTES), seeded);
  assert.equal(await count('custody_messages'), 6044);
});
