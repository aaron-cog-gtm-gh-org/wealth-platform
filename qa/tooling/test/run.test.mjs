import assert from 'node:assert/strict';
import test from 'node:test';
import { compareApiRevision, committedChangesError, dirtyChangesError } from '../lib/run.mjs';

const head = 'abcdef0123456789abcdef0123456789abcdef01';

test('API revision accepts matching full and seven-character prefix SHAs', () => {
  assert.equal(compareApiRevision(head, head).error, null);
  assert.equal(compareApiRevision(head.slice(0, 7), head).error, null);
});

test('API revision mismatch reports short revisions', () => {
  const result = compareApiRevision('1234567abcdef0123456789abcdef0123456789', head);
  assert.equal(result.error.code, 'API_REVISION_MISMATCH');
  assert.match(result.error.message, /API serving 1234567 but HEAD is abcdef0; restart `npm run dev:full`/);
});

test('missing and unknown API revisions warn and normalize to unknown', () => {
  for (const value of [undefined, null, '', 'unknown', 'abcdef']) {
    const result = compareApiRevision(value, head);
    assert.equal(result.apiRevision, 'unknown');
    assert.equal(result.warning.code, 'API_REVISION_UNKNOWN');
    assert.equal(result.error, null);
  }
});

test('base SHA permits committed QA specs but rejects committed app changes', () => {
  assert.equal(committedChangesError('base', ['qa/tests/clients.spec.ts']), null);
  const error = committedChangesError('base', ['qa/tests/clients.spec.ts', 'src/App.tsx']);
  assert.equal(error.code, 'APP_CHANGED');
  assert.match(error.message, /src\/App\.tsx/);
});

test('base SHA permits generated QA artifacts but still rejects other dirty files', () => {
  assert.equal(
    dirtyChangesError(['qa/tests/clients.spec.ts', 'qa-artifacts/'], 'qa-artifacts', '/repo'),
    null
  );
  assert.equal(
    dirtyChangesError(['qa-artifacts/smoke-int/report.json', 'src/App.tsx'], 'qa-artifacts', '/repo').code,
    'DIRTY_FILES'
  );
});
