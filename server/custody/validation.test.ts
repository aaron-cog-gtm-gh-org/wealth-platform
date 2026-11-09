import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../workflows/errors';
import {
  isIsoDate, parseClientQuery, parseFileName, parseId, parseMessageFilters, parseSettlementRange, rejectBody, validateReconNote,
} from './validation';

const rejects = (fn: () => unknown, message: RegExp) => assert.throws(fn, (error: unknown) => {
  assert.ok(error instanceof HttpError);
  assert.equal(error.status, 400);
  assert.match(error.message, message);
  return true;
});

const note = { acctId: 2001, isin: 'GB00ZZ011962', stmtDate: '2026-07-17', status: 'CHASED', note: ' chased ', operator: 'lbrennan' };

test('ISO dates must be real calendar dates', () => {
  assert.equal(isIsoDate('2026-02-28'), true);
  assert.equal(isIsoDate('2028-02-29'), true);
  for (const bad of ['2026-02-29', '2026-13-01', '2026-1-01', '20260101', '', null, 20260101]) assert.equal(isIsoDate(bad), false);
});

test('path IDs are bounded positive integers', () => {
  assert.equal(parseId('2001', 'Account ID'), 2001);
  for (const bad of ['0', '-1', '01', '1.5', 'abc', '2147483648', '']) rejects(() => parseId(bad, 'Account ID'), /Account ID/);
});

test('query parameters are allow-listed, single-valued and bounded', () => {
  assert.equal(parseClientQuery({}), '');
  assert.equal(parseClientQuery({ q: 'penh' }), 'penh');
  rejects(() => parseClientQuery({ q: 'x'.repeat(101) }), /100 characters/);
  rejects(() => parseClientQuery({ name: 'x' }), /Unknown query parameter "name"/);
  rejects(() => parseClientQuery({ q: ['a', 'b'] }), /given once/);
});

test('settlement ranges are optional ISO dates with from on or before to', () => {
  assert.deepEqual(parseSettlementRange({}), { from: undefined, to: undefined });
  assert.deepEqual(parseSettlementRange({ from: '2026-04-01', to: '2026-04-01' }), { from: '2026-04-01', to: '2026-04-01' });
  rejects(() => parseSettlementRange({ from: '2026-05-01', to: '2026-04-01' }), /on or before/);
  rejects(() => parseSettlementRange({ from: '01/04/2026' }), /From date/);
  rejects(() => parseSettlementRange({ to: '2026-04-31' }), /To date/);
});

test('message filters validate family, date, safe code and page', () => {
  assert.deepEqual(parseMessageFilters({}), { page: 1 });
  assert.deepEqual(parseMessageFilters({ family: 'MT54x', date: '2026-04-20', safe: ' 0016594 ', page: '2' }),
    { family: 'MT54x', date: '2026-04-20', safe: '16594', page: 2 });
  assert.equal(parseMessageFilters({ safe: '000' }).safe, '0');
  rejects(() => parseMessageFilters({ family: 'MT540' }), /MT535 or MT54x/);
  rejects(() => parseMessageFilters({ safe: '12a' }), /Safekeeping/);
  rejects(() => parseMessageFilters({ page: '0' }), /Page/);
  rejects(() => parseMessageFilters({ sort: 'x' }), /Unknown query parameter/);
});

test('message file names cannot contain path separators', () => {
  assert.equal(parseFileName('MT535_16598_20260417_001.txt'), 'MT535_16598_20260417_001.txt');
  for (const bad of ['../setup.ts', 'a/b.txt', 'a\\b', '', 'x'.repeat(65)]) rejects(() => parseFileName(bad), /File name/);
});

test('recon notes accept only the four editable statuses and trim text', () => {
  assert.deepEqual(validateReconNote(note), { ...note, note: 'chased', operator: 'LBRENNAN' });
  for (const status of ['OPEN', 'CHASED', 'RESOLVED', 'WRITEOFF']) assert.equal(validateReconNote({ ...note, status }).status, status);
  for (const status of ['O', 'C', 'NEW', 'open', '']) rejects(() => validateReconNote({ ...note, status }), /Status must be/);
  rejects(() => validateReconNote({ ...note, extra: 1 }), /Unknown field "extra"/);
  rejects(() => validateReconNote({ ...note, acctId: '2001' }), /Account ID/);
  rejects(() => validateReconNote({ ...note, isin: 'GB00ZZ01196' }), /ISIN/);
  rejects(() => validateReconNote({ ...note, stmtDate: '2026-02-30' }), /Statement date/);
  rejects(() => validateReconNote({ ...note, note: 'x'.repeat(501) }), /500 characters/);
  rejects(() => validateReconNote({ ...note, note: null }), /Note must be a string/);
  rejects(() => validateReconNote({ ...note, operator: ' ' }), /Operator is required/);
  rejects(() => validateReconNote([note]), /JSON object/);
});

test('bodiless mutations reject any fields', () => {
  rejectBody(undefined);
  rejectBody({});
  rejects(() => rejectBody({ force: true }), /Unknown field "force"/);
  rejects(() => rejectBody('x'), /JSON object/);
});
