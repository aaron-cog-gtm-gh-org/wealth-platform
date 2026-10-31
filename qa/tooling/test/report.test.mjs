import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildReport } from '../lib/report.mjs';
import { writeJson } from '../lib/common.mjs';
import { addSegment, reportFixture, reportTest, tempDir, tinyConfig, tinyWorkbook } from './helpers.mjs';

function singleConfig() {
  return {
    jiraBaseUrl: 'https://example.atlassian.net/browse/',
    totalCases: 1,
    casePattern: '^WM-TC-\\d{3}$',
    gap: { pattern: '^WM-GAP-\\d{3}$', jiraKey: 'KAN-18' },
    areas: [{ area: 'clients', feature: 'Clients', count: 1, first: 1, last: 1, jiraKey: 'KAN-12', spec: 'qa/tests/clients.spec.ts' }]
  };
}

function testOptions(status) {
  return reportTest('WM-TC-001', status, {
    after: 'test-results/case/after.png',
    trace: 'test-results/case/trace.zip'
  });
}

function setup(t, cases = tinyWorkbook(), config = tinyConfig()) {
  const fixture = reportFixture(t, config, cases);
  return fixture;
}

test('report collects a passing baseline case', (t) => {
  const fixture = setup(t, tinyWorkbook(singleConfig()), singleConfig());
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')]);
  const result = buildReport(fixture.runId, fixture.options);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.cases[0].finalStatus, 'passed');
  assert.equal(result.report.summary.passed, 1);
  assert.equal(result.report.cases[0].area, 'clients');
  assert.equal(result.report.cases[0].feature, 'Clients');
  assert.equal(result.report.baselineRows[0].primaryRecording, 'baseline/clients/test-results/wm-tc-001-retry0/video.webm');
});

test('failed baseline becomes fixed in a separate retest row linked by fixes.json', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  const baselineDir = addSegment(fixture.root, fixture.runId, 'baseline', 'original', [testOptions('failed')]);
  const baselineBytes = fs.readFileSync(path.join(baselineDir, 'summary.json'));
  addSegment(fixture.root, fixture.runId, 'retest', 'fix-1', [testOptions('passed')], {
    revision: 'fix-revision',
    fixPr: 'https://example.test/pull/1'
  });
  writeJson(path.join(fixture.root, 'artifacts', fixture.runId, 'fixes.json'), {
    fixes: [{ signature: 'expected visible', caseIds: ['WM-TC-001'], prUrl: 'https://example.test/pull/1', fixRevision: 'fix-revision', retestLabel: 'fix-1' }]
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.baselineRows.length, 1);
  assert.equal(result.report.retestRows.length, 1);
  assert.equal(result.report.cases[0].finalStatus, 'fixed');
  assert.equal(result.report.cases[0].initialStatus, 'failed');
  assert.deepEqual(fs.readFileSync(path.join(baselineDir, 'summary.json')), baselineBytes);
});

test('segment fixPr alone does not mark unrelated baseline failures fixed', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'original', [testOptions('failed')]);
  addSegment(fixture.root, fixture.runId, 'retest', 'whole-area', [testOptions('passed')], {
    fixPr: 'https://example.test/pull/1',
    revision: 'retest-revision'
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.equal(result.report.cases[0].finalStatus, 'failing');
  assert.equal(result.report.cases[0].retestStatus, 'passed');
  assert.equal(result.report.cases[0].fixPr, 'https://example.test/pull/1');
});

test('failed case without retest remains failing', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'original', [testOptions('failed')]);
  const result = buildReport(fixture.runId, fixture.options);
  assert.equal(result.report.cases[0].finalStatus, 'failing');
});

test('collector reports duplicate ownership and missing baseline case', (t) => {
  const fixture = setup(t);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients-a', [testOptions('passed')]);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients-b', [testOptions('passed')]);
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.errors.some((item) => item.code === 'DUPLICATE_OWNERSHIP'));
  assert.ok(result.errors.some((item) => item.code === 'MISSING_CASE'));
});

test('manual summaries and absent recordings are collector errors', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  const directory = path.join(fixture.root, 'artifacts', fixture.runId, 'baseline', 'manual');
  fs.mkdirSync(directory, { recursive: true });
  const meta = { schema: 1, runId: fixture.runId, phase: 'baseline', label: 'manual', revision: 'r1', baseRevision: 'base' };
  writeJson(path.join(directory, 'run-meta.json'), meta);
  writeJson(path.join(directory, 'summary.json'), { ...meta, tests: [reportTest('WM-TC-001', 'passed', { video: null })] });
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.errors.some((item) => item.code === 'MANUAL_RESULT'));
  assert.ok(result.errors.some((item) => item.code === 'MISSING_EVIDENCE'));
});

test('fixes.json entries with no matching revision are FIX_UNLINKED', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'original', [testOptions('failed')]);
  addSegment(fixture.root, fixture.runId, 'retest', 'fix-1', [testOptions('passed')], { revision: 'real-revision' });
  writeJson(path.join(fixture.root, 'artifacts', fixture.runId, 'fixes.json'), {
    fixes: [{ signature: 'one', caseIds: ['WM-TC-001'], prUrl: 'https://example.test/pull/1', fixRevision: 'wrong-revision', retestLabel: 'fix-1' }]
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.errors.some((item) => item.code === 'FIX_UNLINKED'));
});

test('unlinked failing retest emits RETEST_REGRESSION warning', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'original', [testOptions('passed')]);
  addSegment(fixture.root, fixture.runId, 'retest', 'full-area', [testOptions('failed')]);
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.warnings.some((item) => item.code === 'RETEST_REGRESSION'));
  assert.ok(!result.warnings.some((item) => item.code === 'RETEST_WITHOUT_BASELINE_FAILURE'));
  const runDir = path.join(fixture.root, 'artifacts', fixture.runId);
  assert.ok(fs.readFileSync(path.join(runDir, 'index.html'), 'utf8').includes('RETEST_REGRESSION'));
  assert.ok(fs.readFileSync(path.join(runDir, 'report.md'), 'utf8').includes('RETEST_REGRESSION'));
});

test('RETEST_WITHOUT_BASELINE_FAILURE is limited to fixes.json-linked cases', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'original', [testOptions('passed')]);
  addSegment(fixture.root, fixture.runId, 'retest', 'fix-1', [testOptions('passed')], { revision: 'fix-revision' });
  writeJson(path.join(fixture.root, 'artifacts', fixture.runId, 'fixes.json'), {
    fixes: [{ signature: 'unexpected fix', caseIds: ['WM-TC-001'], prUrl: 'https://example.test/pull/1', fixRevision: 'fix-revision', retestLabel: 'fix-1' }]
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.warnings.some((item) => item.code === 'RETEST_WITHOUT_BASELINE_FAILURE'));
});

test('report JSON is byte-identical across deterministic generations', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')]);
  buildReport(fixture.runId, fixture.options);
  const reportPath = path.join(fixture.root, 'artifacts', fixture.runId, 'report.json');
  const first = fs.readFileSync(reportPath);
  buildReport(fixture.runId, fixture.options);
  const second = fs.readFileSync(reportPath);
  assert.deepEqual(first, second);
  assert.equal(crypto.createHash('sha256').update(first).digest('hex'), crypto.createHash('sha256').update(second).digest('hex'));
});

test('HTML escapes script titles and contains only relative evidence paths', (t) => {
  const config = singleConfig();
  const workbook = tinyWorkbook(config);
  workbook.cases[0].title = '<script>alert(1)</script>';
  const fixture = setup(t, workbook, config);
  const summary = testOptions('passed');
  summary.title = '[WM-TC-001] <script>alert(1)</script>';
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [summary]);
  buildReport(fixture.runId, fixture.options);
  const html = fs.readFileSync(path.join(fixture.root, 'artifacts', fixture.runId, 'index.html'), 'utf8');
  assert.ok(html.includes('\\u003cscript\\u003ealert(1)\\u003c/script\\u003e'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('/tmp/'));
  assert.ok(!/src=["']\//.test(html));
  assert.ok(html.includes('baseline/clients/test-results/'));
});
