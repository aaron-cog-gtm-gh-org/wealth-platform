import assert from 'node:assert/strict';
import test from 'node:test';
import { PvApiError } from '../../api/pv';
import type { PvArchiveFile, PvUser } from '../../api/pv-types';
import { INITIAL_UI_STATE } from '../../types';
import type { UiState } from '../../types';
import { buildModel } from '../index';
import { MESSAGE_TEXT, MSG_PAGE_SIZE, buildMessageBrowser, pageWindow } from '../messages';
import { PV_PAGES, canAccess, pvNavFor, pvPageForScreen } from './access';
import { PV_SCREEN_KEYS, parsePvContext, pvContextKey } from './context';
import { parseMessageDate, parseMessageQuery } from './message-query';
import { messagesSlice } from './messages-slice';
import type { MessageBrowserData } from './messages-slice';
import { PREVIEW_MESSAGES } from './messages-preview';
import { PV_SLICES, pvSliceFor, resolvePvSlice } from './slice';
import type { PvApi, PvModelInput } from './slice';

const user = (role: string): PvUser => ({ userId: 1, username: 'U' + role, fullName: 'Test ' + role, role });
const noop = () => {};
const q = (s: string) => parseMessageQuery(new URLSearchParams(s));
const file = (name: string, i = 0): PvArchiveFile => ({ path: `mt535/${name}`, fileName: name, msgType: 'MT535', date: '2026-09-18', safeCode: String(10000 + i), size: 100 + i });

test('D-009-1: ?date= accepts ISO and legacy dd/MM/yyyy (TryParseUkDate exact)', () => {
  assert.equal(parseMessageDate('2026-09-18'), '2026-09-18');
  assert.equal(parseMessageDate('18/09/2026'), '2026-09-18');
  assert.equal(parseMessageDate(' 18/09/2026 '), '2026-09-18');
  assert.equal(parseMessageDate('29/02/2028'), '2028-02-29');
  assert.equal(parseMessageDate('01/01/0001'), '0001-01-01');
  assert.equal(parseMessageDate(''), null);
  assert.equal(parseMessageDate('   '), null);
  for (const bad of ['31/02/2026', '29/02/2026', '1/9/2026', '18/9/2026', '18-09-2026', '2026-9-18', '2026-02-30', '09/18/2026', '18/09/26', '00/01/2026', 'abc', '2026-09-18T00:00'])
    assert.equal(parseMessageDate(bad), 'invalid', bad);
});

test('both date forms give the same query, context key and API request', async () => {
  const iso = parsePvContext('?screen=messages&type=535&date=2026-09-18');
  const uk = parsePvContext('?screen=messages&type=535&date=18/09/2026');
  assert.equal(iso.messages!.date, '2026-09-18');
  assert.equal(uk.messages!.date, '2026-09-18');
  assert.equal(pvContextKey(iso), pvContextKey(uk));
  const calls: unknown[] = [];
  const api = { archiveFiles: async (f: unknown) => { calls.push(f); return { count: 0, files: [] }; } } as unknown as PvApi;
  await messagesSlice.load(api, iso);
  await messagesSlice.load(api, uk);
  assert.deepEqual(calls, [{ type: 'MT535', date: '2026-09-18', safe: undefined }, { type: 'MT535', date: '2026-09-18', safe: undefined }]);
});

test('URL query: legacy type values, list on presence, safe trimmed, invalid date', () => {
  assert.equal(q('screen=messages'), null);
  assert.deepEqual(parsePvContext('?acct=2001'), { acct: 2001, stmt: null, pc: false, all: null });
  assert.deepEqual(q('type=535'), { list: true, type: 'MT535', dateText: '', date: null, dateError: false, safe: '', file: null });
  assert.equal(q('type=54x')!.type, 'MT54x');
  assert.equal(q('type=x')!.type, null);
  assert.equal(q('type=')!.list, true);
  assert.equal(q('safe=%200016598%20')!.safe, '0016598');
  assert.deepEqual(q('file=MT535_10024_20260918_001.txt'), { list: false, type: null, dateText: '', date: null, dateError: false, safe: '', file: 'MT535_10024_20260918_001.txt' });
  assert.deepEqual([q('date=31/02/2026')!.dateError, q('date=31/02/2026')!.date, q('date=31/02/2026')!.dateText], [true, null, '31/02/2026']);
  assert.deepEqual(PV_SCREEN_KEYS.messages, ['type', 'date', 'safe', 'file']);
});

test('slice: list + raw by name, 404 → not found, invalid date makes no request', async () => {
  const seen: string[] = [];
  const api = {
    archiveFiles: async (f: { safe?: string }) => { seen.push(`list:${f.safe ?? ''}`); return { count: 1, files: [file('MT535_10024_20260918_001.txt')] }; },
    archiveFileByName: async (name: string) => {
      seen.push(`raw:${name}`);
      if (name !== 'MT535_10024_20260918_001.txt') throw new PvApiError(404, 'File not in archive index.');
      return { fileName: name, path: `mt535/${name}`, raw: '{1:F01' };
    },
  } as unknown as PvApi;
  const d = await messagesSlice.load(api, parsePvContext('?safe=0010024&file=MT535_10024_20260918_001.txt'));
  assert.equal(d.files!.length, 1);
  assert.deepEqual(d.file, { name: 'MT535_10024_20260918_001.txt', path: 'mt535/MT535_10024_20260918_001.txt', raw: '{1:F01' });
  const missing = await messagesSlice.load(api, parsePvContext('?file=../package.json'));
  assert.deepEqual(missing, { query: q('file=../package.json'), files: null, file: { name: '../package.json', path: null, raw: null } });
  seen.length = 0;
  const bad = await messagesSlice.load(api, parsePvContext('?type=535&date=1/9/2026'));
  assert.deepEqual([bad.files, bad.file, seen], [null, null, []]);
  const none = await messagesSlice.load(api, parsePvContext(''));
  assert.deepEqual(none, { query: null, files: null, file: null });
  const boom = { archiveFiles: async () => { throw new PvApiError(500, 'x'); } } as unknown as PvApi;
  await assert.rejects(messagesSlice.load(boom, parsePvContext('?type=535')));
});

test('roles, nav, slice registration and DataStates (Q17)', () => {
  assert.equal(PV_PAGES.find(p => p.page === 'MessageBrowser.aspx')!.screen, 'messages');
  assert.deepEqual(pvPageForScreen('messages')!.roles, ['OPS', 'ADMIN']);
  for (const [role, ok] of [['ADVISER', false], ['OPS', true], ['ADMIN', true]] as const) {
    assert.equal(canAccess(pvPageForScreen('messages')!.roles, role), ok);
    assert.equal(pvNavFor(role).some(p => p.screen === 'messages'), ok);
  }
  assert.equal(PV_SLICES.messages, messagesSlice);
  const def = pvSliceFor('messages', parsePvContext(''))!;
  assert.ok(def);
  assert.equal(resolvePvSlice('messages', def, null, user('ADVISER'), { kind: 'idle' }).gate, 'forbidden');
  assert.equal(resolvePvSlice('messages', def, null, null, { kind: 'idle' }).gate, 'signin');
  for (const s of ['Loading', 'Empty', 'Error'] as const) assert.deepEqual(resolvePvSlice('messages', def, s, null, { kind: 'idle' }).dataState, s);
  const pop = resolvePvSlice('messages', def, 'Populated', null, { kind: 'idle' });
  assert.deepEqual([pop.dataState, pop.preview, pop.data, pop.fetch], ['Populated', true, PREVIEW_MESSAGES, false]);
  const ready = (data: MessageBrowserData) => resolvePvSlice('messages', def, null, user('OPS'), { kind: 'ready', data }).dataState;
  assert.equal(ready({ query: q('type=535'), files: [], file: null }), 'Empty');
  assert.equal(ready({ query: q('type=535&file=a'), files: [], file: { name: 'a', path: null, raw: null } }), 'Populated');
  assert.equal(ready({ query: null, files: null, file: null }), 'Populated');
  assert.equal(resolvePvSlice('messages', def, null, user('OPS'), { kind: 'error', status: 500, message: 'x' }).dataState, 'Error');
});

test('view model: filters, dd/MM/yyyy grid dates (Q14), 50-row pages, viewer, URL updates', () => {
  let st: UiState = { ...INITIAL_UI_STATE };
  const setState = (p: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => { st = { ...st, ...(typeof p === 'function' ? p(st) : p) }; };
  const params: Record<string, string | null>[] = [];
  const files = Array.from({ length: 118 }, (_, i) => file(`MT535_${10000 + i}_20260918_001.txt`, i));
  const data: MessageBrowserData = { query: q('type=535&date=18/09/2026&file=MT535_10001_20260918_001.txt'), files, file: { name: 'MT535_10001_20260918_001.txt', path: 'mt535/MT535_10001_20260918_001.txt', raw: 'RAW' } };
  let v = buildMessageBrowser(data, st, setState, p => params.push(p));
  assert.deepEqual([v.filters.type, v.filters.date, v.filters.safe], ['535', '2026-09-18', '']);
  assert.equal(v.list!.title, '118 files');
  assert.equal(v.list!.scope, 'MT535 · 18/09/2026 · all safe codes');
  assert.equal(v.list!.rows.length, MSG_PAGE_SIZE);
  assert.deepEqual(v.list!.rows[1], { ...v.list!.rows[1], name: 'MT535_10001_20260918_001.txt', type: 'MT535', date: '18/09/2026', size: '101', selected: true });
  assert.equal(v.list!.pager!.range, '1–50 of 118');
  assert.equal(v.list!.pager!.onPrev, null);
  v.list!.pager!.onNext!();
  v = buildMessageBrowser(data, st, setState, p => params.push(p));
  assert.equal(v.list!.pager!.range, '51–100 of 118');
  v.list!.pager!.onNext!();
  v = buildMessageBrowser(data, st, setState, p => params.push(p));
  assert.deepEqual([v.list!.rows.length, v.list!.pager!.range, v.list!.pager!.onNext], [18, '101–118 of 118', null]);
  v.list!.rows[0].onOpen();
  v.viewer!.onClose();
  v.filters.onList({ type: '54x', date: '2026-04-20', safe: ' 0011521 ' });
  assert.deepEqual(params, [{ file: 'MT535_10100_20260918_001.txt' }, { file: null }, { type: '54x', date: '2026-04-20', safe: '0011521', file: null }]);
  assert.equal(st.msgPage, 0);
  assert.deepEqual([v.viewer!.path, v.viewer!.raw, v.viewer!.notFound], ['mt535/MT535_10001_20260918_001.txt', 'RAW', false]);
  assert.equal(v.notice, null);
  const nf = buildMessageBrowser({ query: q('file=x'), files: null, file: { name: 'x', path: null, raw: null } }, st, setState);
  assert.deepEqual([nf.list, nf.viewer!.notFound, nf.viewer!.notFoundText, nf.notice], [null, true, MESSAGE_TEXT.notFound, null]);
  assert.equal(buildMessageBrowser({ query: null, files: null, file: null }, st, setState).notice!.text, MESSAGE_TEXT.prompt);
  const bad = buildMessageBrowser({ query: q('date=31/02/2026'), files: null, file: null }, st, setState);
  assert.deepEqual([bad.notice!.text, bad.notice!.error, bad.filters.date], ['Enter date as yyyy-mm-dd or dd/MM/yyyy.', true, '']);
  assert.equal(buildMessageBrowser({ query: q('type=535'), files: [files[0]], file: null }, { ...st, msgPage: 9 }, setState).list!.rows.length, 1);
});

test('shell + buildModel: Message browser preview, Empty "Clear filters" clears the URL keys', () => {
  const cleared: Record<string, string | null>[] = [];
  const pv = (dataState: 'Populated' | 'Empty', data: unknown): PvModelInput => ({
    user: null, slice: { screen: 'messages', gate: null, dataState, data, preview: true, fetch: false, retry: noop },
    signIn: { pending: false, error: null, notice: null, submit: noop }, signOut: noop, run: async () => {}, goPv: noop, setParams: p => cleared.push(p),
  });
  const m = buildModel('messages', 'Populated', INITIAL_UI_STATE, noop, noop, null, noop, pv('Populated', PREVIEW_MESSAGES));
  assert.equal(m.title, 'Message browser');
  assert.equal(m.show.messages, true);
  assert.equal(m.messages!.list!.title, '118 files');
  assert.equal(m.messages!.list!.pager!.pages.length, 3);
  assert.match(m.messages!.viewer!.raw!, /^\{1:F01/);
  assert.ok(m.nav[m.nav.length - 1].items.some(i => i.label === 'Message browser'));
  const e = buildModel('messages', 'Empty', INITIAL_UI_STATE, noop, noop, null, noop, pv('Empty', null));
  assert.deepEqual([e.isEmpty, e.emptyTitle, e.emptyCta, e.messages], [true, 'No files match', 'Clear filters', null]);
  e.emptyAction!();
  assert.deepEqual(cleared, [{ type: null, date: null, safe: null, file: null }]);
  assert.equal(buildModel('admin', 'Empty', INITIAL_UI_STATE, noop, noop, null, noop, null).emptyAction, undefined);
});

test('pager window: first, last, current ±2 with gaps (MT54x is 60 pages)', () => {
  assert.deepEqual(pageWindow(0, 3), [0, 1, 2]);
  assert.deepEqual(pageWindow(0, 60), [0, 1, 2, null, 59]);
  assert.deepEqual(pageWindow(30, 60), [0, null, 28, 29, 30, 31, 32, null, 59]);
  assert.deepEqual(pageWindow(59, 60), [0, null, 57, 58, 59]);
});
