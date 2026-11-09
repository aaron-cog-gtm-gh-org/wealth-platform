import assert from 'node:assert/strict';
import test from 'node:test';
import type { PvUser } from '../../api/pv-types';
import { INITIAL_UI_STATE } from '../../types';
import type { UiState } from '../../types';
import { buildAdmin, ukDateTimeMinutes, ukLoadedAt } from '../admin';
import { buildModel } from '../index';
import { buildShell } from '../shell';
import { PV_PAGES, canAccess, pvNavFor } from './access';
import { parsePvContext } from './context';
import { PREVIEW_ADMIN_STATS } from './preview';
import { PV_SLICES, pvSliceFor, resolvePvSlice } from './slice';
import type { PvModelInput, PvSliceDef } from './slice';
import { isTokenExpired, readStoredSession, tokenExp, writeStoredSession } from '../../pv/session';

const user = (role: string): PvUser => ({ userId: 1, username: 'U' + role, fullName: 'Test ' + role, role });
const noop = () => {};

test('Site.Master/BasePage role table (Q17)', () => {
  const allowed = (page: string, role: string) => canAccess(PV_PAGES.find(p => p.page === page)!.roles, role);
  for (const role of ['ADVISER', 'OPS', 'ADMIN']) {
    for (const page of ['ClientSearch.aspx', 'ClientSummary.aspx', 'Holdings.aspx', 'Settlements.aspx']) assert.equal(allowed(page, role), true, `${page} ${role}`);
    assert.equal(allowed('PositionCheck.aspx', role), role !== 'ADVISER');
    assert.equal(allowed('MessageBrowser.aspx', role), role !== 'ADVISER');
    assert.equal(allowed('Admin.aspx', role), role === 'ADMIN');
  }
  assert.equal(canAccess(['ADMIN'], 'admin'), false, 'exact, case-sensitive match');
  assert.equal(canAccess(null, null), false, 'no session, no access');
  assert.deepEqual(pvNavFor('ADMIN').map(p => p.screen), ['messages', 'admin']);
  assert.deepEqual(pvNavFor('OPS').map(p => p.screen), ['messages']);
});

test('URL context ?acct=&stmt=', () => {
  assert.deepEqual(parsePvContext('?acct=2001&stmt=2026-09-18'), { acct: 2001, stmt: '2026-09-18' });
  assert.deepEqual(parsePvContext('?acct=abc&stmt=18/09/2026'), { acct: null, stmt: null });
  assert.deepEqual(parsePvContext('?acct=0&stmt=2026-02-30'), { acct: null, stmt: null });
  assert.deepEqual(parsePvContext(''), { acct: null, stmt: null });
});

test('slices: unregistered screens and missing context keep existing behaviour', () => {
  assert.equal(pvSliceFor('portfolio', { acct: 2001, stmt: null }), null);
  assert.ok(pvSliceFor('admin', { acct: null, stmt: null }));
  const needsAcct: PvSliceDef<number[]> = { needs: 'acct+stmt', load: async () => [], isEmpty: d => !d.length, preview: () => [1] };
  PV_SLICES.portfolio = needsAcct as PvSliceDef<unknown>;
  try {
    assert.equal(pvSliceFor('portfolio', { acct: null, stmt: null }), null);
    assert.equal(pvSliceFor('portfolio', { acct: 2001, stmt: null }), null);
    assert.ok(pvSliceFor('portfolio', { acct: 2001, stmt: '2026-09-18' }));
  } finally { delete PV_SLICES.portfolio; }
});

test('slice → gate / DataState mapping', () => {
  const def = PV_SLICES.admin!;
  const idle = { kind: 'idle' } as const;
  for (const s of ['Loading', 'Empty', 'Error'] as const) {
    const r = resolvePvSlice('admin', def, s, null, idle);
    assert.equal(r.gate, null); assert.equal(r.dataState, s); assert.equal(r.fetch, false); assert.equal(r.preview, true);
  }
  const prev = resolvePvSlice('admin', def, 'Populated', null, idle);
  assert.equal(prev.dataState, 'Populated'); assert.equal(prev.preview, true); assert.equal(prev.data, PREVIEW_ADMIN_STATS); assert.equal(prev.fetch, false);
  assert.equal(resolvePvSlice('admin', def, null, null, idle).gate, 'signin');
  assert.equal(resolvePvSlice('admin', def, null, user('OPS'), idle).gate, 'forbidden');
  assert.equal(resolvePvSlice('admin', def, null, user('OPS'), idle).fetch, false, 'no request when the role cannot open the page');
  assert.deepEqual(resolvePvSlice('admin', def, null, user('ADMIN'), idle), { gate: null, dataState: 'Loading', data: null, preview: false, fetch: true });
  assert.equal(resolvePvSlice('admin', def, null, user('ADMIN'), { kind: 'error', status: 500, message: 'x' }).dataState, 'Error');
  assert.equal(resolvePvSlice('admin', def, null, user('ADMIN'), { kind: 'error', status: 403, message: 'x' }).gate, 'forbidden');
  assert.equal(resolvePvSlice('admin', def, null, user('ADMIN'), { kind: 'ready', data: PREVIEW_ADMIN_STATS }).dataState, 'Populated');
  const empty = { ...PREVIEW_ADMIN_STATS, archive: { ...PREVIEW_ADMIN_STATS.archive, mt535Count: 0, mt54xCount: 0 } };
  assert.equal(resolvePvSlice('admin', def, null, user('ADMIN'), { kind: 'ready', data: empty }).dataState, 'Empty');
  assert.equal(resolvePvSlice('admin', def, 'Populated', user('ADMIN'), idle).fetch, true, 'signed in: ?state=Populated shows live data');
});

test('Admin formats (Q14 dd/MM/yyyy) and view model', () => {
  assert.equal(ukLoadedAt('2026-11-09T14:47:12.000Z'), '09/11/2026 09:47:12');
  assert.equal(ukLoadedAt(null), 'Not loaded');
  assert.equal(ukDateTimeMinutes('2026-11-06T09:12:41.000'), '06/11/2026 09:12');
  assert.equal(ukDateTimeMinutes(null), '');
  const patches: Partial<UiState>[] = [];
  const v = buildAdmin(PREVIEW_ADMIN_STATS, INITIAL_UI_STATE, p => patches.push(p as Partial<UiState>), async () => {});
  assert.deepEqual(v.kpis.map(k => k.v), ['1,184', '2,642', '1,184', '2,642', '2', '1286 ms']);
  assert.equal(v.users.length, 6);
  assert.equal(v.users.find(u => u.username === 'RMCKAY')!.lastLogin, '—');
  v.reload.onAsk();
  assert.deepEqual(patches.pop(), { adminConfirm: true, adminNotice: null });
});

test('shell without PV is unchanged; PV adds nav group, identity, gates', () => {
  const plain = buildShell('c360', 'Populated', noop, null);
  assert.deepEqual(plain.nav.map(g => g.label), ['Adviser', 'Operations', 'Client portal preview']);
  assert.equal(plain.userName, 'Aaron Diamond');
  assert.equal(plain.pvGate, null);
  assert.equal(plain.pvSignedIn, false);
  const pv = (u: PvUser | null, slice: PvModelInput['slice']): PvModelInput => ({
    user: u, slice, signIn: { pending: false, error: null, notice: null, submit: noop }, signOut: noop, run: async () => {}, goPv: noop,
  });
  const signedIn = buildShell('c360', 'Populated', noop, null, pv(user('ADMIN'), null));
  assert.deepEqual(signedIn.nav.map(g => g.label), ['Adviser', 'Operations', 'Client portal preview', 'Portfolio Viewer']);
  assert.equal(signedIn.userName, 'Test ADMIN');
  assert.equal(signedIn.userRole, 'UADMIN · ADMIN');
  const ops = buildShell('admin', 'Loading', noop, null, pv(user('OPS'), { screen: 'admin', gate: 'forbidden', dataState: 'Loading', data: null, preview: false, fetch: false, retry: noop }));
  assert.equal(ops.pvGate, 'forbidden'); assert.equal(ops.isLoading, false); assert.equal(ops.show.admin, false);
  assert.match(ops.pvForbidden.body, /requires the ADMIN role/);
  const m = buildModel('admin', 'Populated', INITIAL_UI_STATE, noop, noop, null, noop,
    pv(null, { screen: 'admin', gate: null, dataState: 'Populated', data: PREVIEW_ADMIN_STATS, preview: true, fetch: false, retry: noop }));
  assert.equal(m.show.admin, true); assert.ok(m.admin); assert.equal(m.userName, 'System Administrator');
});

test('session storage and token expiry', () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  const body = Buffer.from(JSON.stringify({ userId: 1, username: 'PVADMIN', role: 'ADMIN', exp: 2_000 })).toString('base64url');
  const token = `${body}.sig`;
  assert.equal(tokenExp(token), 2_000);
  assert.equal(isTokenExpired(token, 1_999), false);
  assert.equal(isTokenExpired(token, 2_000), true);
  assert.equal(tokenExp('garbage'), null);
  writeStoredSession({ token, user: user('ADMIN') }, store);
  assert.equal(readStoredSession(store)?.token, token);
  mem.set('pv.session', '{not json');
  assert.equal(readStoredSession(store), null);
  writeStoredSession(null, store);
  assert.equal(mem.size, 0);
});
