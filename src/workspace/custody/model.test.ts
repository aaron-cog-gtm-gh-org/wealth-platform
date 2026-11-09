import assert from 'node:assert/strict';
import test from 'node:test';
import {
  custodyDate, custodyParams, custodyTimestamp, displayAcctType, initialEditStatus, normaliseSafe,
  pageCount, RECON_EDIT_STATUSES, rangeError, readCustodyRoute, reconTone, signedQty,
} from './model';
import { readArea, workspaceHref } from '../model';

const route = (q: string) => readCustodyRoute(new URLSearchParams(q));

test('custody deep links round-trip view, account, date, range and file', () => {
  const href = workspaceHref('custody', custodyParams('holdings', { acct: 2001, date: '2026-10-09' }));
  assert.equal(href, '/?screen=workspace&area=custody&view=holdings&acct=2001&date=2026-10-09');
  const search = href.slice(1);
  assert.equal(readArea(search), 'custody');
  assert.deepEqual(route(search), { view: 'holdings', client: null, acct: 2001, date: '2026-10-09', from: null, to: null, file: null, q: '' });
  const s = route('view=settlements&acct=2004&from=2026-07-01&to=2026-10-09');
  assert.equal(s.view, 'settlements');
  assert.equal(s.from, '2026-07-01');
  assert.equal(s.to, '2026-10-09');
  assert.equal(route('view=messages&file=MT535_16598_20261009.txt').file, 'MT535_16598_20261009.txt');
  assert.equal(route('view=client&client=1001').client, 1001);
});

test('malformed custody parameters fall back safely', () => {
  const r = route('view=admin&acct=12abc&date=2026-13-45&from=yesterday&client=-1');
  assert.equal(r.view, 'clients');
  assert.equal(r.acct, null);
  assert.equal(r.date, null);
  assert.equal(r.from, null);
  assert.equal(r.client, null);
  assert.equal(route('file=' + 'x'.repeat(65)).file, null);
  assert.deepEqual(custodyParams('check', { acct: 2001, date: null, from: '' }), { view: 'check', acct: '2001' });
});

test('dates use one format and never shift with the time zone', () => {
  assert.equal(custodyDate('2026-10-09'), '09 Oct 2026');
  assert.equal(custodyDate('2026-04-17T00:00:00.000Z'), '17 Apr 2026');
  assert.equal(custodyDate(null), '—');
  assert.equal(custodyTimestamp('2026-08-10T15:02:00Z'), '10 Aug 2026 16:02');
  assert.equal(custodyTimestamp('2016-03-11T15:20:00Z'), '11 Mar 2016 15:20');
});

test('recon edits offer only the four current statuses; historic codes display as-is', () => {
  assert.deepEqual(RECON_EDIT_STATUSES, ['OPEN', 'CHASED', 'RESOLVED', 'WRITEOFF']);
  assert.equal(initialEditStatus('CHASED'), 'CHASED');
  assert.equal(initialEditStatus('O'), 'OPEN');
  assert.equal(initialEditStatus('C'), 'OPEN');
  assert.equal(initialEditStatus('NEW'), 'OPEN');
  assert.equal(reconTone('NEW'), 'bad');
  assert.equal(reconTone('C'), 'ok');
});

test('account types are trimmed for display', () => {
  assert.equal(displayAcctType('SIPP '), 'SIPP');
  assert.equal(displayAcctType('  General Investment Account  '), 'General Investment Account');
  assert.equal(displayAcctType(''), '—');
});

test('settlement ranges are validated before they are sent', () => {
  assert.equal(rangeError('2026-07-01', '2026-10-09'), null);
  assert.equal(rangeError('2026-10-09', '2026-10-09'), null);
  assert.match(rangeError('2026-10-10', '2026-10-09') ?? '', /on or before/);
  assert.match(rangeError('', '2026-10-09') ?? '', /YYYY-MM-DD/);
});

test('quantity, paging and safekeeping helpers', () => {
  assert.equal(signedQty(-12.5), '−12.5');
  assert.equal(signedQty(1250), '+1,250');
  assert.equal(signedQty(0), '0');
  assert.equal(pageCount(0, 50), 1);
  assert.equal(pageCount(3073, 50), 62);
  assert.equal(normaliseSafe('0010554'), '10554');
  assert.equal(normaliseSafe('0'), '0');
});
