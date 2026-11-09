import assert from 'node:assert/strict';
import test from 'node:test';
import type { PvPositionCheck, PvUser } from '../../api/pv-types';
import { INITIAL_UI_STATE } from '../../types';
import type { UiState } from '../../types';
import { buildModel } from '../index';
import { buildShell } from '../shell';
import { parsePvContext } from './context';
import type { PvContextPatch } from './context';
import { POSITION_CHECK_MESSAGES, buildPositionCheck, fmtQty, loadPositionCheck, pvDate, saveReconNote } from './position-check';
import type { PvPositionCheckData } from './position-check';
import { PREVIEW_POSITION_CHECK } from './preview';
import { PV_SLICES, pvSliceFor, resolvePvSlice } from './slice';
import type { PvApi, PvModelInput, PvOp } from './slice';

const noop = () => {};
const user = (role: string): PvUser => ({ userId: 9, username: 'U' + role, fullName: 'Test ' + role, role });
const ctx = (q: string) => parsePvContext(q);
const check = (over: Partial<PvPositionCheck> = {}): PvPositionCheck => ({ ...PREVIEW_POSITION_CHECK.check!, ...over });

function view(d: PvPositionCheckData, st: Partial<UiState> = {}) {
  const patches: Partial<UiState>[] = [], navs: [string, PvContextPatch | undefined][] = [], ops: PvOp[] = [];
  const set = (p: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => void patches.push(typeof p === 'function' ? p(INITIAL_UI_STATE) : p);
  const v = buildPositionCheck(d, { ...INITIAL_UI_STATE, ...st }, set, async op => { ops.push(op); }, (s, p) => void navs.push([s, p]));
  return { v, patches, navs, ops };
}

test('exceptions is PV only with ?pc=1, ?acct= or ?all=; otherwise the mockup ops queue stays the default', () => {
  assert.equal(pvSliceFor('exceptions', ctx('')), null);
  assert.equal(pvSliceFor('exceptions', ctx('?stmt=2026-09-18')), null);
  assert.equal(pvSliceFor('exceptions', ctx('?pc=yes')), null);
  for (const q of ['?pc=1', '?acct=2038', '?all=2026-09-18', '?acct=2038&stmt=2026-06-26']) assert.equal(pvSliceFor('exceptions', ctx(q)), PV_SLICES.exceptions, q);
  assert.deepEqual(parsePvContext('?pc=1&all=2026-09-18'), { acct: null, stmt: null, pc: true, all: '2026-09-18', cid: null, q: null });
  assert.equal(parsePvContext('?all=18/09/2026').all, null);
  const shell = buildShell('exceptions', 'Populated', noop, null);
  assert.equal(shell.title, 'Settlement exceptions');
  assert.equal(shell.emptyTitle, 'Queue clear');
});

test('OPS/ADMIN only (Q17): ADVISER is forbidden; Loading/Empty/Error/Populated reachable without a session', () => {
  const def = PV_SLICES.exceptions!;
  const idle = { kind: 'idle' } as const;
  assert.equal(resolvePvSlice('exceptions', def, null, user('ADVISER'), idle).gate, 'forbidden');
  for (const r of ['OPS', 'ADMIN']) assert.equal(resolvePvSlice('exceptions', def, null, user(r), idle).fetch, true);
  for (const s of ['Loading', 'Empty', 'Error'] as const) assert.equal(resolvePvSlice('exceptions', def, s, null, idle).dataState, s);
  const prev = resolvePvSlice('exceptions', def, 'Populated', null, idle);
  assert.equal(prev.data, PREVIEW_POSITION_CHECK);
  assert.equal(def.isEmpty({ ...PREVIEW_POSITION_CHECK, allDates: [] }), true);
  assert.equal(def.isEmpty(PREVIEW_POSITION_CHECK), false);
});

test('Page_Load through the API only: default account, deep-linked run, Check All', async () => {
  const calls: string[] = [];
  const api = {
    accounts: async () => { calls.push('accounts'); return { accounts: PREVIEW_POSITION_CHECK.accounts.map(a => ({ ...a, clientId: 1, acctType: 'SIPP', baseCcy: 'GBP', safeCode: '1', openDt: null, closeDt: null, statusCd: 'O' })) }; },
    positionCheckDates: async () => { calls.push('dates'); return { dates: ['2026-06-26', '2026-06-19'] }; },
    statementDates: async (id: number) => { calls.push(`stmt ${id}`); return { acctId: id, dates: ['2026-06-26', '2026-06-19'] }; },
    positionCheck: async (id: number, d: string) => { calls.push(`check ${id} ${d}`); return check({ acctId: id, stmtDate: d }); },
    checkAll: async (d: string) => { calls.push(`all ${d}`); return { stmtDate: d, rows: [] }; },
  } as unknown as PvApi;
  const first = await loadPositionCheck(api, ctx('?pc=1'));
  assert.equal(first.acctId, 2001, 'legacy ddlAcct defaults to the first account');
  assert.equal(first.check, null);
  assert.deepEqual(calls.splice(0), ['accounts', 'dates', 'stmt 2001']);
  const deep = await loadPositionCheck(api, ctx('?acct=2038&stmt=2026-06-26'));
  assert.equal(deep.check?.stmtDate, '2026-06-26');
  assert.deepEqual(calls.splice(0), ['accounts', 'dates', 'stmt 2038', 'check 2038 2026-06-26']);
  const notListed = await loadPositionCheck(api, ctx('?acct=2038&stmt=2026-01-02'));
  assert.equal(notListed.check, null, 'stmt not in the account dates: no run (legacy FindByValue)');
  calls.splice(0);
  const all = await loadPositionCheck(api, ctx('?acct=2038&stmt=2026-06-26&all=2026-06-19'));
  assert.equal(all.check, null); assert.equal(all.all?.stmtDate, '2026-06-19');
  assert.deepEqual(calls.splice(0), ['accounts', 'dates', 'stmt 2038', 'all 2026-06-19']);
});

test('break rows: FmtQty, FormatDate / FmtDt (Q14), RECON_NOTE status verbatim (Q12)', () => {
  assert.deepEqual(['0', '1250', '-1250', '8462.307', '12238.377', '3776.07', '1234567.00005', '0.00004', '-0.00004', '2.10000'].map(fmtQty),
    ['0', '1,250', '-1,250', '8,462.307', '12,238.377', '3,776.07', '1,234,567.0001', '0', '0', '2.1']);
  assert.equal(pvDate('2026-06-26'), '26-JUN-2026');
  const { v } = view(PREVIEW_POSITION_CHECK);
  assert.equal(v.rows.length, 1);
  const r = v.rows[0];
  assert.deepEqual([r.isin, r.prevQty, r.netSettled, r.expected, r.stmtQty, r.diff, r.status, r.updatedBy, r.updated],
    ['GB00ZZ003373', '0', '1,250', '1,250', '0', '-1,250', 'OPEN', 'LBRENNAN', '30/06/2026']);
  assert.equal(v.message, null);
  assert.deepEqual(v.dateOptions[0], { value: '2026-10-09', label: '09-OCT-2026' });
  assert.equal(v.accountOptions[2].label, '01028-01 - Miss M Whitlock');
  const odd = view({ ...PREVIEW_POSITION_CHECK, check: check({ rows: [{ ...check().rows[0], status: 'O', note: '', updatedBy: null, updatedDt: null }] }) }).v.rows[0];
  assert.deepEqual([odd.status, odd.note, odd.updatedBy, odd.updated], ['O', '', '', '']);
});

test('messages: no previous statement (Q11), no differences, no statements for a Check All date', () => {
  const noPrev = view({ ...PREVIEW_POSITION_CHECK, check: check({ prevStmtDate: null, noPrevMessage: 'No previous statement on file.', rows: [] }) }).v;
  assert.equal(noPrev.message, 'No previous statement on file.'); assert.equal(noPrev.showRows, false);
  assert.equal(view({ ...PREVIEW_POSITION_CHECK, check: check({ rows: [] }) }).v.message, 'No differences.');
  const none = view({ ...PREVIEW_POSITION_CHECK, check: null, all: { stmtDate: '2026-06-26', rows: [] } }).v;
  assert.equal(none.message, 'No statements on file for that date.'); assert.equal(none.showAll, false);
  const day = view({ ...PREVIEW_POSITION_CHECK, check: null, all: { stmtDate: '2026-09-18', rows: [
    { acctId: 2125, acctNo: '01068-02', client: 'Mrs R Szabo', diffs: '1' }, { acctId: 2001, acctNo: '01001-01', client: 'The Penhaligon Family Trust', diffs: '0' }, { acctId: 2002, acctNo: '01001-02', client: 'X', diffs: '-' },
  ] } });
  assert.equal(day.v.showAll, true); assert.equal(day.v.kpis[2].v, '1');
  day.v.allRows[0].onView();
  assert.deepEqual(day.navs.pop(), ['exceptions', { pc: '1', acct: '2125', stmt: '2026-09-18', all: null }]);
});

test('pickers navigate through goPv; Run check without a date shows the legacy prompt', () => {
  const { v, navs, patches } = view(PREVIEW_POSITION_CHECK, { pcDate: '2026-06-19' });
  v.onRun();
  assert.deepEqual(navs.pop(), ['exceptions', { pc: '1', acct: '2038', stmt: '2026-06-19', all: null }]);
  v.onAccount('2125');
  assert.deepEqual(navs.pop(), ['exceptions', { pc: '1', acct: '2125', stmt: null, all: null }]);
  v.onCheckAll();
  assert.deepEqual(navs.pop(), ['exceptions', { pc: '1', all: '2026-10-09', stmt: null }]);
  const empty = view({ ...PREVIEW_POSITION_CHECK, dates: [], check: null });
  empty.v.onRun();
  assert.equal(empty.patches.pop()?.pcNotice, POSITION_CHECK_MESSAGES.pick);
  assert.ok(patches.length);
});

test('inline RECON_NOTE edit: preselects a listed status, saves "" as null, rebinds, "Notes saved."', async () => {
  const start = view(PREVIEW_POSITION_CHECK);
  start.v.rows[0].onEdit();
  assert.deepEqual(start.patches.pop(), { pcEdit: 'GB00ZZ003373', pcEditStatus: 'OPEN', pcEditNote: 'custodian resent statement for this date, qty looks short vs contract note. raised with KSS', pcNotice: null, pcError: null });
  const unlisted = view({ ...PREVIEW_POSITION_CHECK, check: check({ rows: [{ ...check().rows[0], status: 'NEW', note: null }] }) });
  unlisted.v.rows[0].onEdit();
  assert.equal(unlisted.patches.pop()?.pcEditStatus, 'OPEN');
  const editing = view(PREVIEW_POSITION_CHECK, { pcEdit: 'GB00ZZ003373', pcEditStatus: 'CHASED', pcEditNote: '' });
  assert.equal(editing.v.rows[0].editing, true);
  editing.v.rows[0].onSave();
  assert.deepEqual(editing.ops, [{ kind: 'saveReconNote', acctId: 2038, note: { isin: 'GB00ZZ003373', stmtDate: '2026-06-26', status: 'CHASED', note: null } }]);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(editing.patches.pop(), { pcBusy: false, pcEdit: null, pcNotice: 'Notes saved.' });
  const calls: string[] = [];
  const api = {
    saveNote: async (id: number, n: { isin: string }) => { calls.push(`put ${id} ${n.isin}`); return {}; },
    positionCheck: async (id: number, d: string) => { calls.push(`get ${id} ${d}`); return check({ rows: [{ ...check().rows[0], status: 'CHASED' }] }); },
  } as unknown as PvApi;
  const next = await saveReconNote(api, PREVIEW_POSITION_CHECK, editing.ops[0] as Exclude<PvOp, 'reloadArchive'>);
  assert.deepEqual(calls, ['put 2038 GB00ZZ003373', 'get 2038 2026-06-26']);
  assert.equal(next.check?.rows[0].status, 'CHASED'); assert.equal(next.accounts, PREVIEW_POSITION_CHECK.accounts);
});

test('shell: Position check title, active PV nav item, model wiring', () => {
  const pv: PvModelInput = {
    user: null, signIn: { pending: false, error: null, notice: null, submit: noop }, signOut: noop, run: async () => {}, goPv: noop,
    slice: { screen: 'exceptions', gate: null, dataState: 'Populated', data: PREVIEW_POSITION_CHECK, preview: true, fetch: false, retry: noop },
  };
  const m = buildModel('exceptions', 'Populated', INITIAL_UI_STATE, noop, noop, null, noop, pv);
  assert.equal(m.title, 'Position check');
  assert.ok(m.posCheck); assert.equal(m.show.exceptions, true);
  const ops = m.nav.find(g => g.label === 'Operations')!.items[0], pvNav = m.nav.find(g => g.label === 'Portfolio Viewer')!.items;
  assert.equal(ops.weight, 500, 'mockup Settlement exceptions item is not active');
  assert.deepEqual(pvNav.filter(i => i.weight === 600).map(i => i.label), ['Position check']);
  assert.deepEqual(pvNav.filter(i => ['Position check', 'Admin'].includes(i.label)).map(i => i.label), ['Position check', 'Admin']);
  const empty = buildShell('exceptions', 'Empty', noop, null, { ...pv, slice: { ...pv.slice!, dataState: 'Empty', data: null } });
  assert.equal(empty.emptyTitle, 'No statements to check');
  const forbidden = buildShell('exceptions', 'Loading', noop, null, { ...pv, user: user('ADVISER'), slice: { ...pv.slice!, gate: 'forbidden', data: null } });
  assert.equal(forbidden.pvForbidden.body, 'Position check requires the OPS or ADMIN role. You are signed in as UADVISER (ADVISER).');
});
