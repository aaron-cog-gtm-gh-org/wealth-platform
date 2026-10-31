import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { exportVideos } from '../lib/export-videos.mjs';
import { projectStructured, writeStructured } from '../lib/structured.mjs';
import { writeJson } from '../lib/common.mjs';
import { tempDir } from './helpers.mjs';

test('export-videos creates uniquely named retry videos and after screenshots', (t) => {
  const root = tempDir(t, 'qa-export-');
  const segment = path.join(root, 'run', 'baseline', 'original');
  const attemptDir = path.join(segment, 'test-results', 'case-retry1');
  fs.mkdirSync(attemptDir, { recursive: true });
  fs.writeFileSync(path.join(attemptDir, 'video.webm'), Buffer.from('video'));
  fs.writeFileSync(path.join(attemptDir, 'after.png'), Buffer.from('png'));
  writeJson(path.join(segment, 'run-meta.json'), { phase: 'baseline', label: 'original' });
  writeJson(path.join(segment, 'summary.json'), {
    tests: [{
      caseId: 'WM-TC-001',
      title: '[WM-TC-001] Clients list',
      status: 'passed',
      attempts: [{ retry: 1, status: 'passed', video: 'test-results/case-retry1/video.webm', after: 'test-results/case-retry1/after.png' }]
    }]
  });
  const out = path.join(root, 'exports');
  const result = exportVideos(segment, out);
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.length, 1);
  assert.equal(result.manifest[0].file, 'WM-TC-001__baseline-original__retry1.webm');
  assert.equal(result.manifest[0].sourcePath, 'test-results/case-retry1/video.webm');
  assert.ok(fs.existsSync(path.join(out, 'WM-TC-001__baseline-original__retry1.webm')));
  assert.ok(fs.existsSync(path.join(out, 'WM-TC-001__baseline-original__retry1__after.png')));
  assert.ok(fs.existsSync(path.join(out, 'manifest.json')));
  const second = exportVideos(segment, out);
  assert.ok(second.errors.some((item) => item.code === 'FILE_EXISTS'));
});

test('export-videos rejects untagged tests and missing attempt videos', (t) => {
  const root = tempDir(t, 'qa-export-errors-');
  const segment = path.join(root, 'run', 'retest', 'full');
  fs.mkdirSync(segment, { recursive: true });
  writeJson(path.join(segment, 'run-meta.json'), { phase: 'retest', label: 'full' });
  writeJson(path.join(segment, 'summary.json'), {
    tests: [
      { title: 'untagged', attempts: [] },
      { title: '[WM-TC-001] No video', attempts: [{ retry: 0, status: 'passed' }] }
    ]
  });
  const result = exportVideos(segment, path.join(root, 'out'));
  assert.ok(result.errors.some((item) => item.code === 'UNTAGGED_TEST'));
  assert.ok(result.errors.some((item) => item.code === 'MISSING_EVIDENCE'));
});

test('export-videos rejects absolute or escaping attachment paths without writing output', (t) => {
  const root = tempDir(t, 'qa-export-path-');
  const segment = path.join(root, 'run', 'baseline', 'clients');
  fs.mkdirSync(segment, { recursive: true });
  writeJson(path.join(segment, 'run-meta.json'), { phase: 'baseline', label: 'clients' });
  writeJson(path.join(segment, 'summary.json'), {
    tests: [{
      title: '[WM-TC-001] Clients list',
      attempts: [{ retry: 0, status: 'passed', video: '../outside.webm' }]
    }]
  });
  const out = path.join(root, 'out');
  const result = exportVideos(segment, out);
  assert.ok(result.errors.some((item) => item.code === 'ATTACHMENT_PATH'));
  assert.ok(!fs.existsSync(out));
});

test('structured output replaces primary recording with the matching uploaded URL', (t) => {
  const root = tempDir(t, 'qa-structured-');
  const report = {
    runId: 'r1',
    baselineRevisions: ['base-rev'],
    apiRevision: 'api-rev',
    baseRevision: 'origin-main',
    fixRevisions: ['fix-rev'],
    seed: { id: 'seed' },
    summary: { total: 1, passed: 0, fixed: 1, failing: 0, flaky: 0, notRun: 0, gapTests: 0 },
    errors: [],
    cases: [{
      id: 'WM-TC-001',
      title: 'Clients',
      area: 'clients',
      feature: 'Clients',
      jiraKey: 'KAN-12',
      jiraUrl: 'https://example.test/KAN-12',
      testPath: 'qa/tests/clients.spec.ts:5',
      initialStatus: 'failed',
      fixPr: 'https://example.test/pull/2',
      retestStatus: 'passed',
      finalStatus: 'fixed',
      baseline: { id: 'WM-TC-001', phase: 'baseline', label: 'original', recordings: [{ retry: 1, video: 'baseline/original/video.webm' }] },
      retest: { id: 'WM-TC-001', phase: 'retest', label: 'fixed', recordings: [{ retry: 0, video: 'retest/fixed/video.webm' }] }
    }],
    gapTests: []
  };
  const uploads = {
    'WM-TC-001__baseline-original__retry1.webm': 'https://uploads.test/baseline.webm',
    'WM-TC-001__retest-fixed__retry0.webm': 'https://uploads.test/retest.webm'
  };
  const projection = projectStructured(report, uploads);
  assert.equal(projection.cases[0].area, 'clients');
  assert.equal(projection.cases[0].feature, 'Clients');
  assert.equal(projection.apiRevision, 'api-rev');
  assert.equal(projection.cases[0].initialRecording, uploads['WM-TC-001__baseline-original__retry1.webm']);
  assert.equal(projection.cases[0].retestRecording, uploads['WM-TC-001__retest-fixed__retry0.webm']);
  const written = writeStructured(root, report, uploads);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'structured-output.json'), 'utf8')), written);
});
