import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CustodyValidationError, parseBreakNotePatch, requireIsin } from '../../repositories/custody';

test('break-note PATCH requires a nonblank author', () => {
  for (const author of [undefined, '', '   ']) {
    assert.throws(
      () => parseBreakNotePatch(author === undefined ? { note: 'call' } : { author, note: 'call' }),
      (err: unknown) => err instanceof CustodyValidationError && err.message === 'author is required',
    );
  }
});

test('break-note PATCH preserves only fields supplied by the caller', () => {
  const patch = parseBreakNotePatch({ author: '  Operations  ', note: '  Called KSS  ' });
  assert.deepEqual(patch, { author: 'Operations', note: 'Called KSS' });
  assert.equal('status' in patch, false);
});

test('break-note PATCH converts an empty note to null', () => {
  assert.deepEqual(parseBreakNotePatch({ author: 'Analyst', note: '' }), { author: 'Analyst', note: null });
});

test('break-note PATCH rejects NEW, invalid causes, no-op patches, and long notes', () => {
  for (const body of [
    { author: 'Analyst', status: 'NEW' },
    { author: 'Analyst', cause: 'UNKNOWN' },
    { author: 'Analyst' },
    { author: 'Analyst', note: 'x'.repeat(2001) },
  ]) {
    assert.throws(() => parseBreakNotePatch(body), CustodyValidationError);
  }
  assert.throws(
    () => parseBreakNotePatch({ author: 'Analyst' }),
    (err: unknown) => err instanceof CustodyValidationError && err.message === 'nothing to update',
  );
});

test('requireIsin accepts uppercase ISINs and rejects malformed values', () => {
  assert.equal(requireIsin('GB00ZZ011962'), 'GB00ZZ011962');
  for (const isin of ['gb00ZZ011962', 'GB00ZZ01196', 'GB00ZZ01196A', 'GB-0ZZ011962']) {
    assert.throws(() => requireIsin(isin), CustodyValidationError);
  }
});
