import assert from 'node:assert/strict';
import test from 'node:test';
import { PvApiError } from '../api/pv';
import type { PvApi } from './pv/slice';
import { MSG_NO_HOLDINGS, MSG_NO_STATEMENT, buildPvHoldings, fmtMoney, fmtPx, fmtQty, fmtStmtDate, holdingsSlice, sumDecimals } from './holdings';
import type { PvHoldingsSlice } from './holdings';
import { PREVIEW_HOLDINGS } from './pv/preview-holdings';

test('WebUtil formats (Q14): half away from zero, grouping, negative zero without sign', () => {
  assert.equal(fmtQty('13000'), '13,000');
  assert.equal(fmtQty('1250.5'), '1,250.5');
  assert.equal(fmtQty('0.12345'), '0.1235');
  assert.equal(fmtQty('2.00005'), '2.0001');
  assert.equal(fmtPx('15.196'), '15.1960');
  assert.equal(fmtPx('34.553'), '34.5530');
  assert.equal(fmtPx('5.62035'), '5.6204');
  assert.equal(fmtMoney('8509.76'), '8,509.76');
  assert.equal(fmtMoney('1234567.005'), '1,234,567.01');
  assert.equal(fmtMoney('-0.004'), '0.00');
  assert.equal(fmtMoney('-12.5'), '-12.50');
  assert.equal(fmtMoney('0'), '0.00');
  assert.equal(fmtStmtDate('2026-10-09'), '09-OCT-2026');
});

test('GBP total is an exact decimal sum', () => {
  assert.equal(sumDecimals(['0.1', '0.2']), '0.3');
  assert.equal(sumDecimals(['8509.76', '15531.12', '0']), '24040.88');
  assert.equal(sumDecimals([]), '0');
  assert.equal(fmtMoney(sumDecimals(PREVIEW_HOLDINGS.lines.map(l => l.mktValGbp))), '295,859.50');
});

const slice = (over: Partial<PvHoldingsSlice> = {}): PvHoldingsSlice => ({ ...holdingsSlice.preview(), ...over });

test('Holdings view: rows, Q13 unknown instrument, FAMT, total', () => {
  const v = buildPvHoldings(slice());
  assert.equal(v.rows.length, 16);
  assert.equal(v.message, null);
  assert.deepEqual(v.fields.map(f => f.v), ['01012-01', 'Prof J Castellan', '10367', 'Discretionary', 'GBP']);
  const unk = v.rows.find(r => r.isin === 'GB00ZZ004322')!;
  assert.equal(unk.instrument, 'UNKNOWN INSTRUMENT GB00ZZ004322'); assert.equal(unk.unknown, true);
  const bond = v.rows.find(r => r.isin === 'XS00ZZ014842')!;
  assert.deepEqual([bond.qty, bond.qtyType, bond.px, bond.mv], ['72,000', 'FAMT', '104.3780', '75,152.16']);
  const usd = v.rows.find(r => r.isin === 'US00ZZ000018')!;
  assert.deepEqual([usd.ccy, usd.mv, usd.mvGbp], ['USD', '7,229.66', '5,692.87']);
  assert.equal(v.total, '295,859.50');
  assert.equal(v.kpis[0].v, '295,859.50');
  assert.equal(v.picker.value, '2026-10-09');
  assert.equal(v.picker.options.length, 26);
  assert.equal(v.picker.options[0].label, '09-OCT-2026');
  assert.equal(v.statement?.fn, 'NEWM');
});

test('Q4: non-GBP line without a GBP HOLD shows 0.00 and adds nothing', () => {
  const p = holdingsSlice.preview();
  const lines = [...p.holdings!.lines.slice(0, 1), { ...p.holdings!.lines[11], mktValGbp: '0' }];
  const v = buildPvHoldings(slice({ holdings: { ...p.holdings!, lines } }));
  assert.equal(v.rows[1].mvGbp, '0.00');
  assert.match(v.rows[1].gbpSrc, /No GBP 19A::HOLD/);
  assert.equal(v.total, '3,869.58');
  assert.equal(v.kpis[2].sub, '1 without a GBP value');
});

test('legacy messages and the not-on-file picker option (D-005-3)', () => {
  const p = holdingsSlice.preview();
  const none = buildPvHoldings(slice({ requested: '2026-01-02', holdings: { acctId: 2018, stmtDate: '2026-01-02', statement: null, lines: [] } }));
  assert.equal(none.message, MSG_NO_STATEMENT);
  assert.equal(none.rows.length, 0);
  assert.equal(none.picker.value, '2026-01-02');
  assert.equal(none.picker.options[0].label, '02-JAN-2026 (not on file)');
  assert.equal(none.picker.options.length, 27);
  const empty = buildPvHoldings(slice({ holdings: { ...p.holdings!, statement: { ...p.holdings!.statement!, lineCount: 0 }, lines: [] } }));
  assert.equal(empty.message, MSG_NO_HOLDINGS);
  assert.equal(empty.picker.options.length, 26);
});

test('picker navigates by URL, ignoring the current date', () => {
  const calls: unknown[] = [];
  const v = buildPvHoldings(slice(), patch => calls.push(patch));
  v.picker.onChange('2026-10-09');
  v.picker.onChange('2026-10-02');
  assert.deepEqual(calls, [{ stmt: '2026-10-02' }]);
});

test('slice: loads via the API, 404 → not found (Empty), isEmpty rules', async () => {
  const p = holdingsSlice.preview();
  const seen: string[] = [];
  const api = {
    account: async (id: number) => { seen.push(`account ${id}`); if (id === 9999) throw new PvApiError(404, 'Account not found.'); return p.account!; },
    statementDates: async (id: number) => { seen.push(`dates ${id}`); return { acctId: id, dates: p.dates }; },
    holdings: async (id: number, date?: string) => { seen.push(`holdings ${id} ${date ?? ''}`); return p.holdings!; },
  } as unknown as PvApi;
  const d = await holdingsSlice.load(api, { acct: 2018, stmt: '2026-10-02' });
  assert.deepEqual(seen, ['account 2018', 'dates 2018', 'holdings 2018 2026-10-02']);
  assert.equal(holdingsSlice.isEmpty(d), false);
  const missing = await holdingsSlice.load(api, { acct: 9999, stmt: null });
  assert.equal(missing.account, null);
  assert.equal(holdingsSlice.isEmpty(missing), true);
  assert.equal(holdingsSlice.copy!(missing, { acct: 9999, stmt: null }).empty![0], 'Custody account not found');
  assert.equal(holdingsSlice.isEmpty({ ...d, dates: [] }), true);
  const failing = { ...api, account: async () => { throw new PvApiError(500, 'boom'); } } as unknown as PvApi;
  await assert.rejects(holdingsSlice.load(failing, { acct: 2018, stmt: null }), (e: unknown) => e instanceof PvApiError && e.status === 500);
});

test('shell: PV copy only while the portfolio slice is active; Whitfield copy unchanged', async () => {
  const { buildShell } = await import('./shell');
  const { buildModel } = await import('./index');
  const { INITIAL_UI_STATE } = await import('../types');
  const noop = () => {};
  const plain = buildShell('portfolio', 'Empty', noop, null);
  assert.equal(plain.crumb, 'Advisers / Whitfield household / All accounts');
  assert.equal(plain.emptyTitle, 'No holdings to show');
  const pv = (slice: Parameters<typeof buildModel>[7] extends infer P ? P extends { slice: infer S } ? S : never : never) => ({
    user: null, slice, signIn: { pending: false, error: null, notice: null, submit: noop }, signOut: noop, run: async () => {}, goPv: noop,
  });
  const ctx = { acct: 2018, stmt: null };
  const loading = buildShell('portfolio', 'Loading', noop, null, pv({ screen: 'portfolio', ctx, gate: null, dataState: 'Loading', data: null, preview: true, fetch: false, retry: noop }));
  assert.equal(loading.loadingMsg, 'Loading custody holdings…');
  assert.equal(loading.crumb, 'Portfolio Viewer / Custody holdings / Account 2018');
  assert.equal(loading.showCtx, false);
  const empty = buildShell('portfolio', 'Empty', noop, null, pv({ screen: 'portfolio', ctx, gate: null, dataState: 'Empty', data: null, preview: true, fetch: false, retry: noop }));
  assert.equal(empty.emptyTitle, 'No statement on file');
  const m = buildModel('portfolio', 'Populated', INITIAL_UI_STATE, noop, noop, null, noop,
    pv({ screen: 'portfolio', ctx, gate: null, dataState: 'Populated', data: holdingsSlice.preview(), preview: true, fetch: false, retry: noop }));
  assert.equal(m.show.portfolio, true);
  assert.ok(m.portfolio);
  assert.equal(m.crumb, 'Portfolio Viewer / Custody holdings / 01012-01 · Prof J Castellan');
  assert.deepEqual(m.nav[m.nav.length - 1].items.map(i => i.label), ['Holdings', 'Admin']);
});
