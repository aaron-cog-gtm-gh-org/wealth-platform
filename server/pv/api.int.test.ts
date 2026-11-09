import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createTestDatabase, jsonRequest } from '../test-db';
import { loadGolden } from './legacy-golden';

const golden = loadGolden() as any;
const contextPromise = createTestDatabase();
let context: Awaited<typeof contextPromise>;
const tokens: Record<string, string> = {};
const num = (v: unknown) => (v == null ? v : Number(v));
const normRow = (r: any) => ({ ...r, prevQty: num(r.prevQty), netSettled: num(r.netSettled), expected: num(r.expected), stmtQty: num(r.stmtQty), diff: num(r.diff) });

async function get(path: string, user = 'LBRENNAN') {
  const response = await fetch(`${context.baseUrl}/pv${path}`, { headers: { authorization: `Bearer ${tokens[user]}` } });
  return { response, body: response.headers.get('content-type')?.includes('json') ? await response.json() as any : await response.text() };
}

before(async () => {
  context = await contextPromise;
  const { setPassword } = await import('./auth');
  for (const u of ['PVADMIN', 'LBRENNAN', 'JSMITH', 'TGARNER']) await setPassword(u, `pw-${u}`);
  for (const u of ['PVADMIN', 'LBRENNAN', 'JSMITH']) {
    const r = await jsonRequest(context.baseUrl, '/pv/login', 'POST', { username: ` ${u.toLowerCase()} `, password: `pw-${u}` });
    assert.equal(r.response.status, 200);
    tokens[u] = r.body.token;
  }
});
after(async () => { if (context) await context.close(); });

describe('auth (Q17)', () => {
  test('wrong password 401, inactive 403, legacy SHA1 not accepted, no token 401', async () => {
    assert.equal((await jsonRequest(context.baseUrl, '/pv/login', 'POST', { username: 'PVADMIN', password: 'nope' })).response.status, 401);
    assert.equal((await jsonRequest(context.baseUrl, '/pv/login', 'POST', { username: 'TGARNER', password: 'pw-TGARNER' })).response.status, 403);
    assert.equal((await jsonRequest(context.baseUrl, '/pv/login', 'POST', { username: 'DHOLT', password: 'anything' })).response.status, 401);
    assert.equal((await fetch(`${context.baseUrl}/pv/accounts`)).status, 401);
    assert.equal((await fetch(`${context.baseUrl}/pv/accounts`, { headers: { authorization: 'Bearer forged.sig' } })).status, 401);
  });
  test('role checks: adviser cannot reach position check, archive or admin; ops cannot reach admin', async () => {
    assert.equal((await get('/accounts/2001/position-check?date=2026-07-17', 'JSMITH')).response.status, 403);
    assert.equal((await get('/archive/files', 'JSMITH')).response.status, 403);
    assert.equal((await get('/admin/stats', 'LBRENNAN')).response.status, 403);
    assert.equal((await get('/accounts', 'JSMITH')).response.status, 200);
  });
});

describe('reference data and archive reads vs legacy golden', () => {
  test('accounts ORDER BY ACCT_NO with client names', async () => {
    const { body } = await get('/accounts');
    assert.deepEqual(body.accounts.map((a: any) => [a.acctId, a.acctNo, a.clientName, a.safeCode, a.openDt, a.closeDt, a.statusCd]),
      golden.accounts.map((a: any) => [a.acctId, a.acctNo, a.clientName, a.safeCode, a.openDt, a.closeDt, a.statusCd]));
  });
  test('client search: name contains / ref prefix, case-insensitive, with account counts', async () => {
    const { body } = await get('/clients/search?q=penhal');
    assert.equal(body.clients[0].clientName, 'The Penhaligon Family Trust');
    assert.equal(body.clients[0].adviserUsername, 'JSMITH');
    assert.ok(body.clients[0].acctCount >= 1);
    const client = (await get(`/clients/${body.clients[0].clientId}`)).body;
    assert.ok(client.accounts.some((a: any) => a.acctId === 2001));
    assert.equal((await get('/clients/999999')).response.status, 404);
    assert.equal((await get('/accounts/abc')).response.status, 400);
  });
  test('statement dates, holdings and default 90-day settlements for every account', async () => {
    for (const a of golden.accounts) {
      assert.deepEqual((await get(`/accounts/${a.acctId}/statement-dates`)).body.dates, a.statementDates);
      const s = (await get(`/accounts/${a.acctId}/settlements`)).body;
      const g = a.settlementsDefault90d;
      assert.deepEqual([s.custAcct, s.from, s.to, s.items.length], [g.custAcct, g.from, g.to, g.count], a.acctNo);
      assert.deepEqual(s.items.map((i: any) => [i.folder, i.fileName, i.seme, num(i.qty), i.direction, i.instrumentName]),
        g.items.map((i: any) => [i.folder, i.fileName, i.seme, num(i.qty), i.direction, i.instrumentName]), a.acctNo);
    }
    const pc = golden.accounts[0].positionChecks[1];
    const h = (await get(`/accounts/2001/holdings?date=${pc.stmtDate}`)).body;
    assert.equal(h.statement.fileName, pc.statement.fileName);
    assert.deepEqual(h.lines.map((l: any) => [l.isin, l.instrumentName, num(l.qty)]), pc.statement.lines.map((l: any) => [l.isin, l.instrumentName, num(l.qty)]));
    assert.equal((await get('/accounts/2001/holdings')).body.stmtDate, golden.accounts[0].statementDates[0]);
  });
});

describe('position check with PostgreSQL RECON_NOTE (Q11, Q12, Q18)', () => {
  test('every golden break and every Check All day', async () => {
    let rows = 0;
    for (const a of golden.accounts) for (const pc of a.positionChecks.filter((p: any) => p.rows.length)) {
      const { body } = await get(`/accounts/${a.acctId}/position-check?date=${pc.stmtDate}`);
      assert.deepEqual(body.rows.map(normRow), pc.rows.map(normRow), `${a.acctNo} ${pc.stmtDate}`);
      assert.equal(body.prevStmtDate, pc.prevStmtDate);
      rows += body.rows.length;
    }
    assert.equal(rows, 7);
    for (const day of golden.checkAll) assert.deepEqual((await get(`/position-check/all?date=${day.stmtDate}`)).body.rows, day.rows, day.stmtDate);
  });
  test('save note: update-else-insert, stamped with the session user', async () => {
    const g = golden.accounts.find((a: any) => a.acctId === 2125).positionChecks.find((p: any) => p.stmtDate === '2026-09-18').rows[0];
    const save = await fetch(`${context.baseUrl}/pv/accounts/2125/position-check/notes`, { method: 'PUT',
      headers: { authorization: `Bearer ${tokens.LBRENNAN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ isin: g.isin, stmtDate: '2026-09-18', status: 'CHASED', note: 'asked custodian' }) });
    assert.equal(save.status, 200);
    assert.equal((await save.json() as any).updatedBy, 'LBRENNAN');
    const row = (await get('/accounts/2125/position-check?date=2026-09-18')).body.rows[0];
    assert.deepEqual([row.status, row.note, row.updatedBy], ['CHASED', 'asked custodian', 'LBRENNAN']);
    await context.reset();
  });
});

describe('archive files and admin', () => {
  test('list + raw only through the index', async () => {
    const list = (await get('/archive/files?type=MT535&safe=0016598&date=2026-04-24')).body;
    assert.deepEqual(list.files.map((f: any) => f.fileName), ['MT535_16598_20260424_001.txt']);
    const raw = await get(`/archive/files/raw?path=${encodeURIComponent(list.files[0].path)}`);
    assert.equal(raw.response.status, 200);
    assert.match(raw.body, /:20C::SEME\/\//);
    for (const bad of ['../package.json', '/etc/passwd', `${list.files[0].path}/../../../../package.json`])
      assert.equal((await get(`/archive/files/raw?path=${encodeURIComponent(bad)}`)).response.status, 404, bad);
  });
  test('admin stats', async () => {
    const { body } = await get('/admin/stats', 'PVADMIN');
    assert.deepEqual([body.archive.mt535Count, body.archive.mt54xCount, body.archive.parseErrors, body.archive.statementAccounts, body.archive.confirmFolders],
      [3073, 2971, 0, 120, 122]);
    assert.ok(body.users.every((u: any) => !('passwordHash' in u) && !('password_hash' in u)));
    assert.equal(body.users.length, 6);
  });
});
