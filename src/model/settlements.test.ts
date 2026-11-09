import assert from 'node:assert/strict';
import test from 'node:test';
import { PvApiError } from '../api/pv';
import type { PvUser } from '../api/pv-types';
import { INITIAL_UI_STATE } from '../types';
import type { UiState } from '../types';
import { buildModel } from './index';
import { pvNavFor } from './pv/access';
import { parseDateInput, parsePvContext, pvContextKey } from './pv/context';
import { PREVIEW_SETTLEMENTS, PREVIEW_SETTLEMENTS_ACCOUNT } from './pv/preview-settlements';
import { PV_SLICES, pvSliceFor, resolvePvSlice } from './pv/slice';
import type { PvApi, PvModelInput } from './pv/slice';
import { DATE_FORMAT_MSG, buildSettlements, fmtDate, fmtMoney, fmtQty, settlementsSlice } from './settlements';
import type { SettlementsData } from './settlements';

const noop = () => {};
const user: PvUser = { userId: 2, username: 'JSMITH', fullName: 'J Smith', role: 'ADVISER' };
const list: SettlementsData = { kind: 'list', account: PREVIEW_SETTLEMENTS_ACCOUNT, settlements: PREVIEW_SETTLEMENTS };

test('date inputs: ISO, legacy dd/MM/yyyy, invalid (D-007-1)', () => {
  assert.equal(parseDateInput('2026-09-01'), '2026-09-01');
  assert.equal(parseDateInput(' 01/09/2026 '), '2026-09-01');
  for (const bad of ['31/02/2026', '1/9/2026', '2026-9-1', '2026-02-30', '', null, '09/01/26']) assert.equal(parseDateInput(bad), null, String(bad));
  assert.deepEqual(parsePvContext('?acct=2001&from=01/09/2026&to=2026-09-30'), { acct: 2001, stmt: null, from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(parsePvContext('?acct=2001&from=junk'), { acct: 2001, stmt: null }, 'invalid dates are ignored (legacy Page_Load)');
  assert.notEqual(pvContextKey(parsePvContext('?acct=1&from=2026-01-01')), pvContextKey(parsePvContext('?acct=1')));
  assert.equal(pvContextKey({ acct: 1, stmt: null }), '1|', 'key unchanged without a window');
});

test('legacy formats (Q14)', () => {
  assert.equal(fmtDate('2026-10-09'), '09-OCT-2026');
  assert.equal(fmtQty('12000'), '12,000');
  assert.equal(fmtQty('2437.027'), '2,437.027');
  assert.equal(fmtQty('0.12345'), '0.1235');
  assert.equal(fmtQty('-1234.00005'), '-1,234.0001');
  assert.equal(fmtMoney('11524.08'), '11,524.08');
  assert.equal(fmtMoney('0'), '0.00');
  assert.equal(fmtMoney('999.995'), '1,000.00');
  assert.equal(fmtMoney('-0.001'), '0.00');
});

test('settlements slice is registered, needs no context, nav for every role', () => {
  assert.equal(PV_SLICES.settlements, settlementsSlice);
  assert.ok(pvSliceFor('settlements', { acct: null, stmt: null }));
  for (const role of ['ADVISER', 'OPS', 'ADMIN']) assert.ok(pvNavFor(role).some(p => p.screen === 'settlements'), role);
});

test('slice load: account + window, picker, 404 → picker, other errors rethrown', async () => {
  const calls: unknown[] = [];
  const api = {
    account: async (id: number) => { calls.push(['account', id]); if (id === 9999) throw new PvApiError(404, 'Account not found'); if (id === 500) throw new PvApiError(500, 'boom'); return PREVIEW_SETTLEMENTS_ACCOUNT; },
    settlements: async (id: number, r: unknown) => { calls.push(['settlements', id, r]); return PREVIEW_SETTLEMENTS; },
    accounts: async () => ({ accounts: [PREVIEW_SETTLEMENTS_ACCOUNT] }),
  } as unknown as PvApi;
  const d = await settlementsSlice.load(api, { acct: 2001, stmt: null, from: '2026-09-01' });
  assert.equal(d.kind, 'list');
  assert.deepEqual(calls[calls.length - 1], ['settlements', 2001, { from: '2026-09-01', to: undefined }]);
  assert.deepEqual(await settlementsSlice.load(api, { acct: null, stmt: null }), { kind: 'pick', accounts: [PREVIEW_SETTLEMENTS_ACCOUNT], notFound: null });
  assert.equal(((await settlementsSlice.load(api, { acct: 9999, stmt: null })) as { notFound: number }).notFound, 9999);
  await assert.rejects(settlementsSlice.load(api, { acct: 500, stmt: null }), (e: PvApiError) => e.status === 500);
  assert.equal(settlementsSlice.isEmpty(list), false);
  assert.equal(settlementsSlice.isEmpty({ ...list, settlements: { ...PREVIEW_SETTLEMENTS, items: [] } }), true);
  assert.equal(settlementsSlice.isEmpty({ kind: 'pick', accounts: [], notFound: null }), true);
});

test('buildSettlements: legacy columns in API order, Q10 amount, counts', () => {
  const m = buildSettlements(list, INITIAL_UI_STATE, noop, noop);
  assert.equal(m.kind, 'list');
  assert.equal(m.rows.length, PREVIEW_SETTLEMENTS.items.length);
  assert.deepEqual(m.rows.map(r => r.seme), PREVIEW_SETTLEMENTS.items.map(i => i.seme), 'API order kept (newest settle date first)');
  const r0 = m.rows[0];
  assert.deepEqual([r0.trade, r0.settle, r0.msg, r0.dir, r0.isin, r0.qty, r0.amount, r0.ccy, r0.seme], ['08-OCT-2026', '09-OCT-2026', 'MT547', 'DEL', 'XS00ZZ014941', '12,000', '11,524.08', 'GBP', 'KS5400064539']);
  assert.equal(PREVIEW_SETTLEMENTS.items[0].amountRaw, 'GBP11524,8', 'Q10: ,8 is eight hundredths');
  const rec = PREVIEW_SETTLEMENTS.items.filter(i => i.direction === 'REC').length;
  assert.deepEqual(m.kpis.slice(0, 4).map(k => k.v), [String(m.rows.length), String(rec), String(m.rows.length - rec), '91 days']);
  assert.equal(m.range!.label, '11-JUL-2026 – 09-OCT-2026');
  assert.deepEqual(m.header!.map(h => h.v), ['01001-01', 'The Penhaligon Family Trust', '16598', 'SIPP', 'GBP']);
  const warn = buildSettlements({ ...list, settlements: { ...PREVIEW_SETTLEMENTS, items: [{ ...PREVIEW_SETTLEMENTS.items[0], amount: '0', amountError: 'bad', amountRaw: 'GBPx' }] } }, INITIAL_UI_STATE, noop, noop);
  assert.equal(warn.rows[0].amount, '0.00');
  assert.ok(warn.rows[0].amountWarn);
});

test('Show: invalid date → message, no reload; valid → URL window', () => {
  let st: UiState = { ...INITIAL_UI_STATE };
  const patches: unknown[] = [];
  const setState = (p: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => { st = { ...st, ...(typeof p === 'function' ? p(st) : p) }; };
  const build = () => buildSettlements(list, st, setState, p => patches.push(p));
  assert.equal(build().range!.from, '2026-07-11', 'inputs default to the loaded window (Q15, server)');
  build().range!.onFrom('31/02/2026');
  build().range!.onShow();
  assert.equal(st.stlMsg, DATE_FORMAT_MSG);
  assert.equal(patches.length, 0);
  build().range!.onFrom('01/09/2026');
  assert.equal(st.stlMsg, null);
  build().range!.onTo('2026-09-30');
  build().range!.onShow();
  assert.deepEqual(patches, [{ from: '2026-09-01', to: '2026-09-30' }]);
  assert.equal(st.stlFrom, null);
});

test('picker rows open the account and clear the window', () => {
  const patches: unknown[] = [];
  const m = buildSettlements({ kind: 'pick', accounts: [PREVIEW_SETTLEMENTS_ACCOUNT], notFound: 9999 }, INITIAL_UI_STATE, noop, p => patches.push(p));
  assert.equal(m.notice, 'Account 9999 was not found.');
  m.accounts[0].onClick();
  assert.deepEqual(patches, [{ acct: '2001', stmt: null, from: null, to: null }]);
});

test('shell: four states, live empty window keeps the form (D-007-4)', () => {
  const pv = (status: Parameters<typeof resolvePvSlice>[4], forced: Parameters<typeof resolvePvSlice>[2] = null, u: PvUser | null = user): PvModelInput => ({
    user: u, slice: { ...resolvePvSlice('settlements', settlementsSlice as never, forced, u, status), screen: 'settlements', retry: noop },
    signIn: { pending: false, error: null, notice: null, submit: noop }, signOut: noop, run: async () => {}, goPv: noop, setPvContext: noop,
  });
  const model = (p: PvModelInput) => buildModel('settlements', p.slice!.dataState, INITIAL_UI_STATE, noop, noop, null, noop, p);
  const pop = model(pv({ kind: 'idle' }, 'Populated', null));
  assert.ok(pop.show.settlements && pop.settlements?.kind === 'list');
  assert.equal(pop.title, 'Settlements');
  for (const s of ['Loading', 'Empty', 'Error'] as const) {
    const m = model(pv({ kind: 'idle' }, s, null));
    assert.equal(m.show.settlements, false);
    assert.equal(m.settlementsRange, null);
  }
  assert.equal(model(pv({ kind: 'idle' }, 'Empty', null)).emptyTitle, 'No settlements in period');
  const empty = model(pv({ kind: 'ready', data: { ...list, settlements: { ...PREVIEW_SETTLEMENTS, items: [] } } }));
  assert.ok(empty.isEmpty && empty.settlementsRange?.range);
  assert.ok(model(pv({ kind: 'ready', data: list })).nav.some(g => g.items.some(i => i.id === 'settlements')));
});
