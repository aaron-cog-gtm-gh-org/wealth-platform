import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createTestDatabase, jsonRequest } from '../test-db';

const contextPromise = createTestDatabase();
let context: Awaited<typeof contextPromise>;
let pool: typeof import('../db/pool');

before(async () => {
  context = await contextPromise;
  pool = await import('../db/pool');
});

beforeEach(async () => context.reset());

after(async () => {
  if (context) await context.close();
});

const get = async (path: string) => jsonRequest(context.baseUrl, `/custody${path}`, 'GET');
const send = async (method: string, path: string, body?: unknown) => jsonRequest(context.baseUrl, `/custody${path}`, method, body);

async function expectError(path: string, status: number, message: RegExp, method = 'GET', body?: unknown) {
  const { response, body: payload } = await send(method, path, body);
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)}`);
  assert.deepEqual(Object.keys(payload), ['error']);
  assert.match(payload.error, message);
}

const NOTE = { acctId: 2001, isin: 'GB00ZZ011962', stmtDate: '2026-07-17', status: 'CHASED', note: 'Chased KSS for CA notice', operator: 'LBRENNAN' };

test('archive status reports the parsed archive', async () => {
  const { response, body } = await get('/archive/status');
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ['root', 'mt535Count', 'mt54xCount', 'statements', 'confirmations', 'parseErrors', 'loadedAt', 'loadMs']);
  assert.deepEqual({ ...body, loadedAt: undefined, loadMs: undefined }, {
    root: 'server/custody/archive', mt535Count: 3073, mt54xCount: 2971, statements: 3073, confirmations: 2971, parseErrors: 0,
    loadedAt: undefined, loadMs: undefined,
  });
  assert.match(body.loadedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(typeof body.loadMs, 'number');
  await expectError('/archive/status?x=1', 400, /Unknown query parameter "x"/);
});

test('client search matches name or reference prefix, sorted by name', async () => {
  const all = await get('/clients');
  assert.equal(all.response.status, 200);
  assert.equal(all.body.clients.length, 50);
  const names = all.body.clients.map((c: { name: string }) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  assert.deepEqual((await get('/clients?q=PENH')).body.clients, [{
    clientId: 1001, clientRef: 'C2017-0124', name: 'The Penhaligon Family Trust', status: 'Active',
    adviserUsername: 'JSMITH', adviserName: 'James Smith', accountCount: 2,
  }]);
  assert.deepEqual((await get('/clients?q=c2017-01')).body.clients.map((c: { clientId: number }) => c.clientId).includes(1001), true);
  assert.deepEqual((await get('/clients?q=0124')).body.clients, [], 'reference matches by prefix only');
  assert.deepEqual((await get(`/clients?q=${encodeURIComponent('%')}`)).body.clients, [], 'LIKE wildcards are literal');
  await expectError(`/clients?q=${'x'.repeat(101)}`, 400, /100 characters/);
  await expectError('/clients?q=a&q=b', 400, /given once/);
  await expectError('/clients?name=a', 400, /Unknown query parameter/);
});

test('client summary lists accounts with trimmed account types', async () => {
  const { response, body } = await get('/clients/1005');
  assert.equal(response.status, 200);
  assert.equal(body.client.name, 'Miss D Mcintyre');
  assert.deepEqual(body.accounts[1], {
    acctId: 2007, acctNo: '01005-02', acctType: 'SIPP', baseCcy: 'GBP', safeCode: '13760', openDate: '2013-04-01', closeDate: null, status: 'Open',
  });
  const closed = (await get('/clients/1077')).body.accounts.find((a: { acctId: number }) => a.acctId === 2140);
  assert.deepEqual({ acctType: closed.acctType, closeDate: closed.closeDate, status: closed.status }, { acctType: 'SIPP', closeDate: '2026-06-26', status: 'Closed' });
  await expectError('/clients/999999', 404, /Client not found/);
  await expectError('/clients/abc', 400, /Client ID/);
  await expectError('/clients/0', 400, /Client ID/);
});

test('accounts are listed by account number with statement dates newest first', async () => {
  const { body } = await get('/accounts');
  assert.equal(body.accounts.length, 120);
  assert.deepEqual(body.accounts[0], { acctId: 2001, acctNo: '01001-01', clientId: 1001, clientName: 'The Penhaligon Family Trust', safeCode: '16598', status: 'Open' });
  const numbers = body.accounts.map((a: { acctNo: string }) => a.acctNo);
  assert.deepEqual(numbers, [...numbers].sort());
  const dates = (await get('/accounts/2001/statements')).body.dates as string[];
  assert.equal(dates[0], '2026-10-09');
  assert.deepEqual(dates, [...dates].sort().reverse());
  await expectError('/accounts/999999/statements', 404, /Account not found/);
  await expectError('/accounts/x/statements', 400, /Account ID/);
});

test('statement dates across the archive are distinct and newest first', async () => {
  const { response, body } = await get('/statement-dates');
  assert.equal(response.status, 200);
  assert.equal(body.dates.length, 26);
  assert.equal(new Set(body.dates).size, 26);
  assert.deepEqual(body.dates, [...body.dates].sort().reverse());
});

test('holdings show one statement with instrument names and a GBP total', async () => {
  const { response, body } = await get('/accounts/2001/statements/2026-07-17');
  assert.equal(response.status, 200);
  assert.deepEqual(body.statement, { statementDate: '2026-07-17', function: 'NEWM', fileSeq: 1, fileName: 'MT535_16598_20260717_001.txt' });
  assert.equal(body.account.acctNo, '01001-01');
  assert.deepEqual(body.lines[0], {
    isin: 'GB00ZZ002573', instrument: 'Hythe Engineering PLC Ord', qty: 106, qtyType: 'UNIT', price: 25.061, ccy: 'GBP', mktVal: 2656.47, mktValGbp: 2656.47,
  });
  const sum = body.lines.reduce((total: number, line: { mktValGbp: number }) => total + Math.round(line.mktValGbp * 100), 0) / 100;
  assert.equal(body.totalGbp, sum);
  await expectError('/accounts/2001/statements/2026-07-18', 404, /^No statement on file for this date\.$/);
  await expectError('/accounts/999999/statements/2026-07-17', 404, /Account not found/);
  await expectError('/accounts/2001/statements/2026-02-30', 400, /Statement date/);
});

test('settlements default to 90 days to the latest statement, newest first, with D1-D3 behaviour', async () => {
  const { response, body } = await get('/accounts/2001/settlements');
  assert.equal(response.status, 200);
  assert.equal(body.from, '2026-07-11');
  assert.equal(body.to, '2026-10-09');
  assert.deepEqual(body.settlements[0], {
    tradeDate: '2026-10-08', settleDate: '2026-10-09', mtType: 547, direction: 'DEL', isin: 'XS00ZZ014941', instrument: 'Westray Housing 3.75% 2037',
    qty: 12000, amount: 11524.8, ccy: 'GBP', seme: 'KS5400064539', fileName: 'MT547_16598_20261009_001.txt',
  });
  const settle = body.settlements.map((s: { settleDate: string }) => s.settleDate);
  assert.deepEqual(settle, [...settle].sort().reverse());
  assert.ok(settle.every((d: string) => d >= body.from && d <= body.to));

  const wide = (await get('/accounts/2001/settlements?from=2026-04-01&to=2026-10-31')).body;
  assert.equal(wide.settlements.find((s: { seme: string }) => s.seme === 'KS5400062252').amount, null, 'no 19A amount is null');
  assert.equal((await get('/accounts/2001/settlements?to=2026-07-31')).body.from, '2026-05-02');
  const d1 = (await get('/accounts/2129/settlements?from=2026-09-16&to=2026-09-16')).body.settlements;
  assert.ok(d1.some((s: { seme: string }) => s.seme === 'KS5400063562'), 'D1: unpadded safekeeping account matches');
  const d2 = (await get('/accounts/2145/settlements?from=2026-07-01&to=2026-07-31')).body.settlements;
  assert.ok(!d2.some((s: { seme: string }) => s.seme === 'KS5400060882' || s.seme === 'KS5400064555'), 'D2: cross-day CANC removes its original');

  await expectError('/accounts/2001/settlements?from=2026-08-01&to=2026-07-01', 400, /on or before/);
  await expectError('/accounts/2001/settlements?from=2026-11-01', 400, /on or before/);
  await expectError('/accounts/2001/settlements?from=01/07/2026', 400, /From date/);
  await expectError('/accounts/2001/settlements?sort=asc', 400, /Unknown query parameter/);
  await expectError('/accounts/999999/settlements', 404, /Account not found/);
});

test('position check lists breaks with recon notes; historic statuses are shown verbatim', async () => {
  const { response, body } = await get('/accounts/2001/position-check/2026-07-17');
  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    statementDate: '2026-07-17', previousStatementDate: '2026-07-10', message: null,
    rows: [{
      isin: 'GB00ZZ011962', instrument: 'Marrowby Engineering PLC Ord', prevQty: 800, netSettled: 0, expected: 800, stmtQty: 1600, diff: 800,
      status: 'RESOLVED', note: 'Bonus issue 1 for 1 per custodian CA notice KS/CA/26/0412. Qty agrees to notice. No action.',
      updatedBy: 'LBRENNAN', updatedAt: '2026-07-21T09:14:00.000Z',
    }],
  });
  const first = (await get('/accounts/2001/statements')).body.dates.at(-1);
  assert.deepEqual(await get(`/accounts/2001/position-check/${first}`).then(r => r.body),
    { statementDate: first, previousStatementDate: null, message: 'No previous statement on file.', rows: [] });
  await pool.query(`UPDATE custody_recon_notes SET status = 'O' WHERE acct_id = 2038 AND stmt_date = '2026-06-26'`);
  assert.equal((await get('/accounts/2038/position-check/2026-06-26')).body.rows[0].status, 'O');
  const d2 = (await get('/accounts/2145/position-check/2026-07-17')).body.rows;
  assert.ok(!d2.some((r: { isin: string }) => r.isin === 'GB00ZZ001500'));
  await expectError('/accounts/2001/position-check/2026-07-18', 404, /No statement on file/);
  await expectError('/accounts/999999/position-check/2026-07-17', 404, /Account not found/);
  await expectError('/accounts/2001/position-check/17-07-2026', 400, /Statement date/);
});

test('check all summarises every account with a statement on the date', async () => {
  const { response, body } = await get('/position-check/2026-07-17');
  assert.equal(response.status, 200);
  assert.equal(body.statementDate, '2026-07-17');
  assert.deepEqual(Object.keys(body.accounts[0]), ['acctId', 'acctNo', 'clientName', 'breaks', 'newBreaks', 'previousStatementDate']);
  assert.deepEqual(body.accounts.find((a: { acctId: number }) => a.acctId === 2001),
    { acctId: 2001, acctNo: '01001-01', clientName: 'The Penhaligon Family Trust', breaks: 1, newBreaks: 0, previousStatementDate: '2026-07-10' });
  assert.equal(body.accounts.find((a: { acctId: number }) => a.acctId === 2145).breaks, 0, 'D2 break is gone');
  const perAccount = await Promise.all(body.accounts.slice(0, 10).map((a: { acctId: number }) => get(`/accounts/${a.acctId}/position-check/2026-07-17`)));
  assert.deepEqual(perAccount.map(r => r.body.rows.length), body.accounts.slice(0, 10).map((a: { breaks: number }) => a.breaks));
  assert.deepEqual((await get('/position-check/2026-07-18')).body, { statementDate: '2026-07-18', accounts: [] });
  await expectError('/position-check/2026-7-17', 400, /Statement date/);
});

test('operators are active OPS and ADMIN users', async () => {
  assert.deepEqual((await get('/operators')).body, { operators: [
    { username: 'LBRENNAN', fullName: 'Lauren Brennan', role: 'OPS' },
    { username: 'PVADMIN', fullName: 'System Administrator', role: 'ADMIN' },
  ] });
});

test('recon note updates persist, appear on the position check and write an audit event', async () => {
  const { response, body } = await send('PUT', '/recon-notes', NOTE);
  assert.equal(response.status, 200);
  assert.deepEqual({ ...body.note, updatedAt: undefined }, { acctId: 2001, isin: 'GB00ZZ011962', stmtDate: '2026-07-17', status: 'CHASED',
    note: 'Chased KSS for CA notice', updatedBy: 'LBRENNAN', updatedAt: undefined });
  assert.ok(Date.parse(body.note.updatedAt) > Date.parse('2026-07-21T09:14:00Z'));
  const row = (await get('/accounts/2001/position-check/2026-07-17')).body.rows[0];
  assert.deepEqual([row.status, row.note, row.updatedBy, row.updatedAt], ['CHASED', 'Chased KSS for CA notice', 'LBRENNAN', body.note.updatedAt]);
  const audit = (await jsonRequest(context.baseUrl, '/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'Recon note updated');
  assert.equal(audit[0].entityId, '01001-01');
  assert.equal(audit[0].detail, '01001-01 GB00ZZ011962 statement 2026-07-17 by LBRENNAN: Status RESOLVED → CHASED; Note: Chased KSS for CA notice');

  const created = await send('PUT', '/recon-notes', { acctId: 2129, isin: 'LU00ZZ013430', stmtDate: '2026-09-18', status: 'WRITEOFF', note: '', operator: 'pvadmin' });
  assert.equal(created.response.status, 200);
  assert.deepEqual([created.body.note.status, created.body.note.note, created.body.note.updatedBy], ['WRITEOFF', '', 'PVADMIN']);
  const audit2 = (await jsonRequest(context.baseUrl, '/workflows/bootstrap', 'GET')).body.audit;
  assert.equal(audit2[0].detail, '01072-01 LU00ZZ013430 statement 2026-09-18 by PVADMIN: Status NEW → WRITEOFF');

  await context.reset();
  assert.equal((await get('/accounts/2001/position-check/2026-07-17')).body.rows[0].status, 'RESOLVED');
});

test('recon note updates are validated', async () => {
  for (const status of ['O', 'C', 'NEW', 'closed']) await expectError('/recon-notes', 400, /Status must be OPEN, CHASED, RESOLVED or WRITEOFF/, 'PUT', { ...NOTE, status });
  await expectError('/recon-notes', 400, /Unknown field "updatedBy"/, 'PUT', { ...NOTE, updatedBy: 'X' });
  await expectError('/recon-notes', 400, /Account ID/, 'PUT', { ...NOTE, acctId: 1.5 });
  await expectError('/recon-notes', 400, /ISIN/, 'PUT', { ...NOTE, isin: 'gb00zz011962' });
  await expectError('/recon-notes', 400, /Statement date/, 'PUT', { ...NOTE, stmtDate: '2026-07-32' });
  await expectError('/recon-notes', 400, /500 characters/, 'PUT', { ...NOTE, note: 'x'.repeat(501) });
  await expectError('/recon-notes', 400, /active operations user/, 'PUT', { ...NOTE, operator: 'JSMITH' });
  await expectError('/recon-notes', 400, /active operations user/, 'PUT', { ...NOTE, operator: 'TGARNER' });
  await expectError('/recon-notes', 400, /JSON object/, 'PUT', [NOTE]);
  await expectError('/recon-notes', 404, /Account not found/, 'PUT', { ...NOTE, acctId: 999999 });
  await expectError('/recon-notes', 404, /No statement on file/, 'PUT', { ...NOTE, stmtDate: '2026-07-18' });
  const raw = await fetch(`${context.baseUrl}/custody/recon-notes`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(raw.status, 400);
  assert.deepEqual(await raw.json(), { error: 'Request body must be valid JSON.' });
  assert.equal((await jsonRequest(context.baseUrl, '/workflows/bootstrap', 'GET')).body.audit.length, 0);
  assert.equal((await get('/accounts/2001/position-check/2026-07-17')).body.rows[0].status, 'RESOLVED');
});

test('message list filters by family, date and safekeeping account with 50 per page', async () => {
  const all = (await get('/messages')).body;
  assert.equal(all.total, 6044);
  assert.equal(all.files.length, 50);
  assert.equal(all.page, 1);
  assert.deepEqual(Object.keys(all.files[0]), ['fileName', 'family', 'mtType', 'msgDate', 'safeCode', 'sizeBytes', 'parseStatus']);
  const last = (await get('/messages?page=121')).body;
  assert.deepEqual([last.total, last.files.length], [6044, 44]);
  assert.deepEqual((await get('/messages?page=122')).body.files, []);
  assert.equal((await get('/messages?family=MT535')).body.total, 3073);
  assert.equal((await get('/messages?family=MT54x')).body.total, 2971);
  assert.deepEqual((await get('/messages?family=MT535&safe=0016598&date=2026-04-17')).body, { total: 1, page: 1, files: [{
    fileName: 'MT535_16598_20260417_001.txt', family: 'MT535', mtType: 535, msgDate: '2026-04-17', safeCode: '16598', sizeBytes: 1249, parseStatus: 'ok',
  }] });
  const day = (await get('/messages?date=2026-04-20&family=MT54x')).body.files;
  assert.ok(day.length > 0 && day.every((f: { msgDate: string; family: string }) => f.msgDate === '2026-04-20' && f.family === 'MT54x'));
  await expectError('/messages?family=MT540', 400, /MT535 or MT54x/);
  await expectError('/messages?date=2026-04-31', 400, /Date/);
  await expectError('/messages?safe=abc', 400, /Safekeeping/);
  await expectError('/messages?page=0', 400, /Page/);
  await expectError('/messages?limit=10', 400, /Unknown query parameter/);
});

test('raw message is served only for ingested file names', async () => {
  const { response, body } = await get('/messages/MT545_16594_20260420_002.txt');
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ['fileName', 'relPath', 'family', 'raw']);
  assert.equal(body.relPath, 'mt54x/20260420/MT545_16594_20260420_002.txt');
  assert.match(body.raw, /^\{1:F01BRKWGB2LAXXX.*\r\n:16R:GENL\r\n/);
  await expectError('/messages/MT545_16594_20260420_009.txt', 404, /Message not found/);
  await expectError('/messages/..%2F..%2Fdb%2Fsetup.ts', 400, /File name/);
  await expectError('/messages/%2Fetc%2Fpasswd', 400, /File name/);
});

test('archive reload is transactional, idempotent and re-parses changed files', async () => {
  const before = await pool.query<{ statement_id: number }>('SELECT statement_id FROM custody_statements ORDER BY statement_id');
  const loads = async () => Number((await pool.query<{ n: string }>('SELECT count(*) AS n FROM custody_archive_loads'))[0].n);
  const loadCount = await loads();
  const first = await send('POST', '/archive/reload');
  assert.equal(first.response.status, 200);
  assert.deepEqual([first.body.mt535Count, first.body.mt54xCount, first.body.statements, first.body.confirmations, first.body.parseErrors],
    [3073, 2971, 3073, 2971, 0]);
  assert.deepEqual(await pool.query('SELECT statement_id FROM custody_statements ORDER BY statement_id'), before, 'unchanged files are not re-parsed');
  assert.equal(await loads(), loadCount + 1);
  assert.deepEqual((await get('/archive/status')).body, first.body);

  await pool.query(`UPDATE custody_messages SET raw_text = 'corrupt', parse_status = 'error', parse_error = 'x' WHERE file_name = 'MT535_16598_20260717_001.txt'`);
  await pool.query(`DELETE FROM custody_statements WHERE message_id = (SELECT message_id FROM custody_messages WHERE file_name = 'MT535_16598_20260717_001.txt')`);
  await pool.query(`DELETE FROM custody_messages WHERE file_name = 'MT545_16594_20260420_002.txt'`);
  await expectError('/accounts/2001/statements/2026-07-17', 404, /No statement on file/);
  const healed = await send('POST', '/archive/reload', {});
  assert.deepEqual([healed.body.statements, healed.body.confirmations, healed.body.parseErrors], [3073, 2971, 0]);
  assert.equal((await get('/accounts/2001/statements/2026-07-17')).body.lines[0].isin, 'GB00ZZ002573');
  assert.equal((await get('/messages/MT545_16594_20260420_002.txt')).response.status, 200);

  const [{ max }] = await pool.query<{ max: number }>('SELECT max(seq)::int AS max FROM wf_audit');
  const [event] = await pool.query<{ action: string; detail: string }>('SELECT action, detail FROM wf_audit WHERE seq = $1', [max]);
  assert.deepEqual(event, { action: 'Custody archive reloaded', detail: '3073 MT535 + 2971 MT54x files (1 new, 1 changed, 0 removed); 0 parse errors' });
  await expectError('/archive/reload', 400, /Unknown field "force"/, 'POST', { force: true });
});

test('archive parse records per-file errors without aborting the load', async () => {
  const { parseArchive } = await import('./parse-archive');
  const client = await pool.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO custody_messages (file_name, rel_path, msg_family, mt_type, safe_code, msg_date, file_seq, size_bytes, raw_text)
      VALUES ('MT535_99999_20260417_001.txt', 'mt535/MT535_99999_20260417_001.txt', 'MT535', 535, '99999', '2026-04-17', 1, 3, '{4:'),
             ('MT545_99999_20260420_001.txt', 'mt54x/20260420/MT545_99999_20260420_001.txt', 'MT54x', 545, '99999', '2026-04-20', 1, 1, 'x')`);
    await client.query(`UPDATE custody_messages SET parse_status = 'pending' WHERE file_name = 'MT535_16598_20260717_001.txt'`);
    const result = await parseArchive(client);
    assert.equal(result.parsed, 1);
    assert.equal(result.parseErrors, 2);
    assert.deepEqual([result.load.mt535Count, result.load.mt54xCount, result.load.statements, result.load.confirmations, result.load.parseErrors],
      [3074, 2972, 3073, 2971, 2]);
    const { rows } = await client.query(`SELECT file_name, parse_status, parse_error IS NOT NULL AS has_error FROM custody_messages
      WHERE file_name LIKE '%99999%' OR file_name = 'MT535_16598_20260717_001.txt' ORDER BY file_name`);
    assert.deepEqual(rows, [
      { file_name: 'MT535_16598_20260717_001.txt', parse_status: 'ok', has_error: false },
      { file_name: 'MT535_99999_20260417_001.txt', parse_status: 'error', has_error: true },
      { file_name: 'MT545_99999_20260420_001.txt', parse_status: 'error', has_error: true },
    ]);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('unknown custody routes return JSON 404', async () => {
  await expectError('/nope', 404, /Not found/);
  await expectError('/accounts', 404, /Not found/, 'POST', {});
});
