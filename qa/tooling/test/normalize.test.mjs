import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { normalizeResults } from '../lib/normalize.mjs';
import { tempDir } from './helpers.mjs';

function attachment(name, file, contentType) {
  return { name, path: file, contentType };
}

function fixtureResults(attempts) {
  return {
    suites: [{
      file: 'qa/tests/clients.spec.ts',
      specs: [{
        title: '[WM-TC-001] clients visible',
        file: 'qa/tests/clients.spec.ts',
        line: 12,
        tests: [{
          expectedStatus: 'passed',
          annotations: [{ type: 'feature', description: 'clients' }],
          results: attempts
        }]
      }]
    }]
  };
}

function createEvidence(segment, relative) {
  const file = path.join(segment, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from('evidence'));
}

test('normalization emits segment-relative POSIX attachment paths', (t) => {
  const segment = tempDir(t, 'qa-normalize-');
  createEvidence(segment, 'test-results/test-case-retry0/video.webm');
  createEvidence(segment, 'test-results/test-case-retry0/after.png');
  const results = fixtureResults([{
    retry: 0,
    status: 'passed',
    startTime: '2025-01-01T00:00:00.000Z',
    duration: 30,
    attachments: [
      attachment('video', 'test-results/test-case-retry0/video.webm', 'video/webm'),
      attachment('after.png', 'test-results/test-case-retry0/after.png', 'image/png')
    ]
  }]);
  const normalized = normalizeResults(results, { segmentDir: segment });
  assert.deepEqual(normalized.errors, []);
  assert.equal(normalized.tests[0].caseId, 'WM-TC-001');
  assert.equal(normalized.tests[0].file, 'qa/tests/clients.spec.ts');
  assert.equal(normalized.tests[0].attempts[0].video, 'test-results/test-case-retry0/video.webm');
  assert.equal(normalized.tests[0].attempts[0].after, 'test-results/test-case-retry0/after.png');
});

test('normalization attributes wrapper-registered cases to the owning spec file', (t) => {
  const segment = tempDir(t, 'qa-normalize-wrapper-');
  const results = fixtureResults([]);
  results.config = { rootDir: '/repo/qa/tests' };
  results.suites[0].specs[0].file = '../tooling/fixtures.ts';
  const normalized = normalizeResults(results, { segmentDir: segment, cwd: '/repo' });
  assert.equal(normalized.tests[0].file, 'qa/tests/clients.spec.ts');
});

test('absolute paths from another machine are rebased under test-results', (t) => {
  const segment = tempDir(t, 'qa-foreign-');
  createEvidence(segment, 'test-results/clients-retry0/video.webm');
  const result = normalizeResults(fixtureResults([{
    retry: 0,
    status: 'passed',
    attachments: [attachment('video', 'Z:\\agent\\_work\\qa\\test-results\\clients-retry0\\video.webm', 'video/webm')]
  }]), { segmentDir: segment });
  assert.equal(result.tests[0].attempts[0].video, 'test-results/clients-retry0/video.webm');
  assert.deepEqual(result.errors, []);
});

test('retry0 and retry1 evidence stay in separate attempt directories', (t) => {
  const segment = tempDir(t, 'qa-retries-');
  createEvidence(segment, 'test-results/clients-retry0/video.webm');
  createEvidence(segment, 'test-results/clients-retry1/video.webm');
  const result = normalizeResults(fixtureResults([
    { retry: 0, status: 'failed', attachments: [attachment('video', 'test-results/clients-retry0/video.webm', 'video/webm')] },
    { retry: 1, status: 'passed', attachments: [attachment('video', 'test-results/clients-retry1/video.webm', 'video/webm')] }
  ]), { segmentDir: segment });
  assert.deepEqual(result.tests[0].attempts.map((attempt) => attempt.video), [
    'test-results/clients-retry0/video.webm',
    'test-results/clients-retry1/video.webm'
  ]);
  assert.equal(result.tests[0].outcome, 'flaky');
});

test('missing video produces a MISSING_EVIDENCE error', (t) => {
  const segment = tempDir(t, 'qa-missing-video-');
  const result = normalizeResults(fixtureResults([{
    retry: 0,
    status: 'passed',
    attachments: [attachment('after.png', 'test-results/after.png', 'image/png')]
  }]), { segmentDir: segment });
  assert.ok(result.errors.some((item) => item.code === 'MISSING_EVIDENCE'));
});

test('missing attachment paths are reported instead of retained as evidence', (t) => {
  const segment = tempDir(t, 'qa-missing-file-');
  const result = normalizeResults(fixtureResults([{
    retry: 0,
    status: 'passed',
    attachments: [attachment('video', 'test-results/missing/video.webm', 'video/webm')]
  }]), { segmentDir: segment });
  assert.ok(result.errors.some((item) => item.code === 'MISSING_EVIDENCE'));
});
