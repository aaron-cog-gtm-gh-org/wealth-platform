import assert from 'node:assert/strict';
import test from 'node:test';
import { PvApiError } from '../api/pv';
import type { PvClientSearchRow, PvClientSummary } from '../api/pv-types';
import { INITIAL_UI_STATE } from '../types';
import type { Screen } from '../types';
import { buildClientSearch, buildClientSummary, clientSearchSlice, clientSummarySlice } from './clients';
import { buildModel } from './index';
import { PV_PAGES, pvNavFor, pvPageForScreen } from './pv/access';
import { PV_CONTEXT_KEYS, parsePvContext, pvContextKey } from './pv/context';
import { PREVIEW_CLIENT_SEARCH, PREVIEW_CLIENT_SUMMARY } from './pv/preview';
import { PV_SLICES, pvSliceFor, resolvePvSlice } from './pv/slice';
import type { PvApi, PvModelInput } from './pv/slice';

const row = (i: number, statusCd = 'A'): PvClientSearchRow =>
  ({ clientId: 1000 + i, clientRef: `PV${1000 + i}`, clientName: `Client ${String(i).padStart(2, '0')}`, statusCd, adviserUsername: 'JSMITH', adviserName: 'James Smith', acctCount: i % 3 });
const opened: [Screen, Record<string, string | null>][] = [];
const goPv = (s: Screen, p: Record<string, string | null> = {}) => { opened.push([s, p]); };
const ctx = (search: string) => parsePvContext(search);

test('context: ?cid= positive integer, ?q= raw text (untrimmed, blank kept); both cleared by mockup nav', () => {
  assert.deepEqual(ctx('?cid=1001&q=%20smith'), { acct: null, stmt: null, pc: false, all: null, cid: 1001, q: ' smith' });
  assert.deepEqual(ctx('?cid=0&q='), { acct: null, stmt: null, pc: false, all: null, q: '' });
  assert.equal(ctx('?cid=abc').cid, undefined);
  assert.ok(PV_CONTEXT_KEYS.includes('cid') && PV_CONTEXT_KEYS.includes('q'));
  assert.notEqual(pvContextKey(ctx('?q=')), pvContextKey(ctx('')));
  assert.notEqual(pvContextKey(ctx('?cid=1')), pvContextKey(ctx('?cid=2')));
});

test('slices: clients always; c360 only with ?cid= so the Whitfield Client 360 stays the default', () => {
  assert.equal(PV_SLICES.clients, clientSearchSlice);
  assert.equal(PV_SLICES.c360, clientSummarySlice);
  assert.equal(pvSliceFor('clients', ctx('')), clientSearchSlice);
  assert.equal(pvSliceFor('c360', ctx('')), null);
  assert.equal(pvSliceFor('c360', ctx('?acct=2001')), null);
  assert.equal(pvSliceFor('c360', ctx('?cid=1001')), clientSummarySlice);
  const m = buildModel('c360', 'Populated', INITIAL_UI_STATE, () => {}, () => {}, null, () => {}, null);
  assert.equal(m.crumb, 'Advisers / Book of business / Whitfield household');
  assert.equal(m.client360, null);
});

test('PV_PAGES: ClientSearch → clients, ClientSummary → c360, any signed-in role', () => {
  assert.equal(PV_PAGES.find(p => p.page === 'ClientSearch.aspx')?.screen, 'clients');
  assert.equal(PV_PAGES.find(p => p.page === 'ClientSummary.aspx')?.screen, 'c360');
  assert.equal(pvPageForScreen('c360')?.roles, null);
  for (const r of ['ADVISER', 'OPS', 'ADMIN']) assert.ok(pvNavFor(r).some(p => p.screen === 'clients'));
});

test('search slice: no query → not searched (no request); blank → all; Empty only for a blank search with no clients', async () => {
  const calls: string[] = [];
  const api = { searchClients: async (q: string) => { calls.push(q); return { clients: q === 'zz' ? [] : [row(1)] }; } } as unknown as PvApi;
  assert.deepEqual(await clientSearchSlice.load(api, ctx('')), { query: null, clients: [] });
  assert.deepEqual(calls, []);
  assert.equal((await clientSearchSlice.load(api, ctx('?q='))).clients.length, 1);
  assert.deepEqual(calls, ['']);
  assert.equal(clientSearchSlice.isEmpty({ query: '', clients: [] }), true);
  assert.equal(clientSearchSlice.isEmpty({ query: 'zz', clients: [] }), false);
  assert.equal(clientSearchSlice.isEmpty({ query: null, clients: [] }), false);
  assert.deepEqual(resolvePvSlice('clients', clientSearchSlice as never, 'Populated', null, { kind: 'idle' }).data, PREVIEW_CLIENT_SEARCH);
});

test('search model: legacy "No clients found.", StatusText, 25 per page, search resets paging', () => {
  const none = buildClientSearch({ query: 'zz', clients: [] }, INITIAL_UI_STATE, () => {}, goPv);
  assert.equal(none.noResults, 'No clients found.');
  assert.equal(buildClientSearch({ query: null, clients: [] }, INITIAL_UI_STATE, () => {}, goPv).searched, false);
  const many = Array.from({ length: 30 }, (_, i) => row(i, i === 3 ? 'D' : i === 4 ? 'C' : i === 5 ? 'X' : 'A'));
  const p1 = buildClientSearch({ query: 'c', clients: many }, INITIAL_UI_STATE, () => {}, goPv);
  assert.equal(p1.rows.length, 25);
  assert.deepEqual(p1.rows.slice(2, 6).map(r => r.status), ['Active', 'Dormant', 'Closed', 'X']);
  assert.deepEqual(p1.pager.map(p => [p.label, p.current]), [['1', true], ['2', false]]);
  assert.equal(p1.rangeLabel, '1–25 of 30 · sorted by client name');
  const p2 = buildClientSearch({ query: 'c', clients: many }, { ...INITIAL_UI_STATE, clientPage: 7 }, () => {}, goPv);
  assert.equal(p2.rows.length, 5);
  assert.equal(p2.rangeLabel, '26–30 of 30 · sorted by client name');
  assert.equal(p2.next, null);
  let moved: unknown = null;
  buildClientSearch({ query: 'c', clients: many }, INITIAL_UI_STATE, p => { moved = p; }, goPv).next!();
  assert.deepEqual(moved, { clientPage: 1 });
  let patch: unknown = null;
  opened.length = 0;
  buildClientSearch({ query: 'c', clients: many }, INITIAL_UI_STATE, p => { patch = p; }, goPv).search(' smi');
  assert.deepEqual(patch, { clientPage: 0 });
  assert.deepEqual(opened, [['clients', { q: ' smi' }]]);
  p1.rows[0].open();
  assert.deepEqual(opened[1], ['c360', { cid: '1000', acct: null, stmt: null }]);
});

const summary = (over: Partial<PvClientSummary> = {}): PvClientSummary => ({
  ...PREVIEW_CLIENT_SUMMARY,
  accounts: [
    ...PREVIEW_CLIENT_SUMMARY.accounts,
    { ...PREVIEW_CLIENT_SUMMARY.accounts[0], acctId: 2999, acctNo: '01001-03', statusCd: 'C', closeDt: '2023-03-31', stmtDate: null, mktValGbp: null },
  ],
  ...over,
});

test('summary model: dd-MMM-yyyy dates, #,##0.00 money, "-" without a statement, Holdings only with a statement', () => {
  const s = buildClientSummary(summary(), 'ADMIN', goPv);
  assert.deepEqual(s.fields.map(f => f.v), ['C2017-0124', 'The Penhaligon Family Trust', 'James Smith', 'Active', '15-JUN-2017']);
  assert.deepEqual(s.accounts.map(a => [a.no, a.status, a.opened, a.closed, a.stmt, a.value]), [
    ['01001-01', 'Open', '10-JUN-2019', '', '09-OCT-2026', '283,880.39'],
    ['01001-02', 'Open', '22-APR-2018', '', '09-OCT-2026', '76,295.23'],
    ['01001-03', 'Closed', '10-JUN-2019', '31-MAR-2023', '-', '-'],
  ]);
  assert.equal(s.total, '360,175.62');
  assert.equal(buildClientSummary(summary({ totalMktValGbp: null }), 'ADMIN', goPv).total, '-');
  assert.deepEqual(s.accounts[0].links.map(l => l.label), ['Holdings', 'Settlements', 'Position check']);
  assert.deepEqual(s.accounts[2].links.map(l => l.label), ['Settlements']);
});

test('summary links: Position check for OPS/ADMIN only; targets follow PV_PAGES (disabled until migrated)', () => {
  assert.deepEqual(buildClientSummary(summary(), 'ADVISER', goPv).accounts[0].links.map(l => l.label), ['Holdings', 'Settlements']);
  assert.deepEqual(buildClientSummary(summary(), 'OPS', goPv).accounts[0].links.map(l => l.label), ['Holdings', 'Settlements', 'Position check']);
  const links = buildClientSummary(summary(), 'OPS', goPv).accounts[0].links;
  for (const l of links) {
    const target = PV_PAGES.find(p => p.label === l.label)!.screen;
    assert.equal(l.enabled, target !== null);
    opened.length = 0;
    l.go();
    if (target) assert.deepEqual(opened[0][0], target);
  }
  opened.length = 0;
  buildClientSummary(summary(), 'OPS', goPv).back();
  assert.deepEqual(opened, [['clients', { cid: null }]]);
});

test('summary slice: 404 → Empty (client not found); other errors → Error', async () => {
  const api = (err: Error) => ({ clientSummary: async () => { throw err; } }) as unknown as PvApi;
  assert.deepEqual(await clientSummarySlice.load(api(new PvApiError(404, 'Not found')), ctx('?cid=9')), { client: null });
  assert.equal(clientSummarySlice.isEmpty({ client: null }), true);
  await assert.rejects(clientSummarySlice.load(api(new PvApiError(500, 'boom')), ctx('?cid=9')));
});

test('buildModel: custody Client 360 shell copy + view model only in PV context; signed-out preview is ADMIN', () => {
  const slice = { ...resolvePvSlice('c360', clientSummarySlice as never, 'Populated', null, { kind: 'idle' }), screen: 'c360' as Screen, retry: () => {} };
  const pv: PvModelInput = { user: null, slice, signIn: { pending: false, error: null, notice: null, submit: () => {} }, signOut: () => {}, run: async () => {}, goPv };
  const m = buildModel('c360', 'Populated', INITIAL_UI_STATE, () => {}, () => {}, null, () => {}, pv);
  assert.equal(m.crumb, 'Portfolio Viewer / Client search / C2017-0124');
  assert.equal(m.title, 'The Penhaligon Family Trust');
  assert.ok(m.client360 && m.client360.accounts[0].links.some(l => l.label === 'Position check'));
  const empty = buildModel('c360', 'Empty', INITIAL_UI_STATE, () => {}, () => {}, null, () => {}, { ...pv, slice: { ...slice, dataState: 'Empty', data: null } });
  assert.equal(empty.emptyTitle, 'Client not found');
  const whitfield = buildModel('c360', 'Empty', INITIAL_UI_STATE, () => {}, () => {}, null, () => {}, null);
  assert.equal(whitfield.emptyTitle, 'No accounts open yet');
});
