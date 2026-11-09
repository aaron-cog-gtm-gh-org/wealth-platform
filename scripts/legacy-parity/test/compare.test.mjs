// Golden-vs-mutated-golden tests for the parity diff/classification logic and the API fetch mapping.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { buildReport, fetchApiSnapshot } from '../compare.mjs';
import { classify, diffSnapshots } from '../lib/diff.mjs';
import { isoDate, num } from '../lib/normalize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_FILE = path.join(HERE, '..', 'golden', 'pv-golden.json.gz');
const golden = JSON.parse(gunzipSync(readFileSync(GOLDEN_FILE)).toString('utf8'));
const expected = JSON.parse(readFileSync(path.join(HERE, '..', 'expected-divergences.json'), 'utf8'));
const clone = () => structuredClone(golden);

/** Applies the intended new behaviour (D1 + D2) to a copy of the golden, as the new API should produce it. */
function simulateNewBehaviour() {
  const g = clone();
  const settlementsOf = (acctId) => g.settlements.find((s) => s.acctId === acctId).settlements;
  const dropRow = (acctId, date, isin) => {
    const p = g.positionChecks.find((x) => x.acctId === acctId && x.statementDate === date);
    p.rows = p.rows.filter((r) => r.isin !== isin);
    const c = g.checkAll.find((x) => x.statementDate === date).accounts.find((a) => a.acctId === acctId);
    c.breaks -= 1;
  };
  for (const m of expected.divergences.find((d) => d.id === 'D1').messages) {
    const isin = m.isin;
    settlementsOf(m.acctId).push({ tradeDate: '2026-09-14', settleDate: m.settleDate, mtType: 'MT545', direction: 'REC',
      isin, instrument: 'x', qty: 1, amount: 1, ccy: 'GBP', seme: m.seme, fileName: path.basename(m.file) });
    dropRow(m.acctId, '2026-09-18', isin);
  }
  const d2 = expected.divergences.find((d) => d.id === 'D2').messages[1];
  const rows = settlementsOf(d2.acctId);
  rows.splice(rows.findIndex((r) => r.seme === d2.seme), 1);
  dropRow(d2.acctId, '2026-07-17', d2.isin);
  return g;
}

test('golden captured every screen named by T009', () => {
  assert.equal(golden.format, 'pv-golden/1');
  assert.equal(golden.statementDates.length, 26);
  assert.equal(golden.checkAll.length, 26);
  assert.equal(golden.accounts.length, 120);
  assert.equal(golden.settlements.length, 120);
  const pairs = golden.accounts.reduce((n, a) => n + a.statementDates.length, 0);
  assert.equal(golden.holdings.length, pairs);
  assert.equal(golden.positionChecks.length, pairs);
  assert.deepEqual(golden.settlementsWindow, { from: '2026-04-01', to: '2026-10-31' });
  assert.equal(golden.archive.mt535Count + golden.archive.mt54xCount, 6044);
  for (const h of golden.holdings.slice(0, 50)) {
    assert.match(h.statementDate, /^\d{4}-\d{2}-\d{2}$/);
    for (const l of h.lines) assert.equal(typeof l.qty, 'number');
  }
});

test('identical snapshots produce no diffs; every expected rule is reported as not observed', () => {
  const result = classify(diffSnapshots(golden, clone()), expected);
  assert.equal(result.classified.length, 0);
  assert.equal(result.notObserved.length, expected.divergences.reduce((n, d) => n + d.expect.length, 0));
});

test('D1 + D2 behaviour is fully explained and every expected rule is observed', () => {
  const result = classify(diffSnapshots(golden, simulateNewBehaviour()), expected);
  assert.equal(result.unexplained.length, 0, JSON.stringify(result.unexplained, null, 1));
  assert.equal(result.notObserved.length, 0, JSON.stringify(result.notObserved));
  assert.deepEqual(result.byDivergence, { D1: 6, D2: 3 });
});

test('an unrelated mutation is unexplained', () => {
  const api = simulateNewBehaviour();
  api.holdings[10].lines[0].qty += 1;
  api.clientSearch[0].clients.pop();
  api.positionChecks.find((p) => p.rows.length && p.acctId === 2001).rows[0].note = 'edited';
  const result = classify(diffSnapshots(golden, api), expected);
  assert.deepEqual(result.unexplained.map((r) => `${r.dataset}:${r.kind}:${r.field ?? ''}`).sort(),
    ['clientSearch:missing:', 'holdings:changed:qty', 'positionChecks:changed:note']);
});

test('a divergence of the wrong size is unexplained (delta rule)', () => {
  const api = simulateNewBehaviour();
  api.checkAll.find((c) => c.statementDate === '2026-07-17').accounts.find((a) => a.acctId === 2145).breaks -= 1;
  const result = classify(diffSnapshots(golden, api), expected);
  assert.equal(result.unexplained.length, 1);
  assert.equal(result.unexplained[0].field, 'breaks');
});

test('display rounding, leading-zero safe codes, MT type spelling and extra API fields are not diffs', () => {
  const api = clone();
  const line = api.holdings[0].lines[0];
  line.mktValGbp += 0.004; line.qtyType = 'UNIT';
  api.accounts[0].safeCode = `00${api.accounts[0].safeCode}`;
  for (const s of api.settlements) for (const r of s.settlements) { r.mtType = Number(r.mtType.slice(2)); r.fileName = 'f'; }
  assert.equal(diffSnapshots(golden, api).length, 0);
  line.mktValGbp += 0.01;
  assert.equal(diffSnapshots(golden, api).length, 1);
});

test('a field absent from the API is reported as field-missing', () => {
  const api = clone();
  delete api.positionChecks.find((p) => p.rows.length).rows[0].prevQty;
  const [d] = diffSnapshots(golden, api);
  assert.equal(d.kind, 'field-missing');
  assert.equal(d.field, 'prevQty');
});

test('fetchApiSnapshot maps the custody contract to the golden shape', async () => {
  const api = simulateNewBehaviour();
  const routes = new Map();
  routes.set('/archive/status', { root: '/a', ...api.archive, loadedAt: 'x', loadMs: 1 });
  routes.set('/statement-dates', { dates: api.statementDates });
  routes.set('/accounts', { accounts: api.accounts.map((a) => ({ acctId: a.acctId, acctNo: a.acctNo, clientName: a.clientName, safeCode: a.safeCode, clientId: 1, status: "Open" })) });
  for (const a of api.accounts) routes.set(`/accounts/${a.acctId}/statements`, { dates: a.statementDates });
  for (const s of api.clientSearch) routes.set(`/clients${s.q === '' ? '' : `?q=${encodeURIComponent(s.q)}`}`, { clients: s.clients });
  for (const s of api.clientSummaries) routes.set(`/clients/${s.client.clientId}`, { client: s.client, accounts: s.accounts });
  for (const h of api.holdings) routes.set(`/accounts/${h.acctId}/statements/${h.statementDate}`,
    { account: {}, statement: { statementDate: h.statementDate }, lines: h.lines, totalGbp: h.totalGbp ?? 0 });
  for (const s of api.settlements) routes.set(`/accounts/${s.acctId}/settlements?from=2026-04-01&to=2026-10-31`, s);
  for (const p of api.positionChecks) routes.set(`/accounts/${p.acctId}/position-check/${p.statementDate}`,
    { statementDate: p.statementDate, previousStatementDate: p.message ? null : '2026-01-01', message: p.message, rows: p.rows });
  for (const c of api.checkAll) routes.set(`/position-check/${c.statementDate}`, { statementDate: c.statementDate,
    accounts: c.accounts.map((a) => ({ acctId: a.acctId, acctNo: a.acctNo, clientName: a.clientName, breaks: a.breaks ?? 0,
      newBreaks: 0, previousStatementDate: a.hasPreviousStatement ? '2026-01-01' : null })) });
  const missingHolding = `/accounts/${api.holdings[5].acctId}/statements/${api.holdings[5].statementDate}`;
  routes.delete(missingHolding);
  const fetchImpl = async (url) => {
    const rel = url.replace('http://api.test/api/custody', '');
    const body = routes.get(rel);
    return body ? new Response(JSON.stringify(body), { status: 200 })
      : new Response(JSON.stringify({ error: 'No statement on file for this date.' }), { status: 404 });
  };
  const snap = await fetchApiSnapshot(golden, 'http://api.test', { fetchImpl });
  const report = buildReport({ golden, api: snap, expected, goldenPath: 'g', apiLabel: 'fake', tolerance: 0.005 });
  const unexplained = report.diffs.filter((r) => !r.divergence);
  assert.equal(report.summary.expectedDiffs, 9);
  assert.ok(unexplained.length >= 1 && unexplained.every((r) => r.dataset === 'holdings'
    && r.acctId === api.holdings[5].acctId && r.date === api.holdings[5].statementDate), JSON.stringify(unexplained.filter((r) => r.date !== api.holdings[5].statementDate || r.acctId !== api.holdings[5].acctId).slice(0, 3)));
});

test('CLI writes report.json + report.md and exits non-zero only on unexplained diffs', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'parity-'));
  const run = (snapshot) => {
    const file = path.join(dir, 'api.json');
    writeFileSync(file, JSON.stringify(snapshot));
    return spawnSync(process.execPath, [path.join(HERE, '..', 'compare.mjs'), '--golden', path.dirname(GOLDEN_FILE),
      '--api-snapshot', file, '--out', dir], { encoding: 'utf8' });
  };
  const pass = run(simulateNewBehaviour());
  assert.equal(pass.status, 0, pass.stderr + pass.stdout);
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8'));
  assert.equal(report.summary.unexplainedDiffs, 0);
  assert.match(readFileSync(path.join(dir, 'report.md'), 'utf8'), /Verdict: \*\*PASS\*\*/);
  const bad = simulateNewBehaviour();
  bad.archive.parseErrors = 3;
  const fail = run(bad);
  assert.equal(fail.status, 1, fail.stderr);
  assert.match(readFileSync(path.join(dir, 'report.md'), 'utf8'), /Verdict: \*\*FAIL\*\*[\s\S]*parseErrors/);
});

test('normalizers convert PV display formats', () => {
  assert.equal(isoDate('09-OCT-2026'), '2026-10-09');
  assert.equal(isoDate('01/04/2026'), '2026-04-01');
  assert.equal(isoDate('20260918'), '2026-09-18');
  assert.equal(isoDate(' '), null);
  assert.equal(num('1,234.50'), 1234.5);
  assert.equal(num('-210'), -210);
  assert.equal(num(''), null);
  assert.throws(() => num('abc'));
});
