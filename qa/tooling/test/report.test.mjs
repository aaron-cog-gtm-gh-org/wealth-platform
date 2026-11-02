import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildReport } from '../lib/report.mjs';
import { projectStructured } from '../lib/structured.mjs';
import { writeJson } from '../lib/common.mjs';
import { addSegment, reportFixture, reportTest, tinyConfig, tinyWorkbook } from './helpers.mjs';

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
  assert.deepEqual(result.report.rejectedAttempts, []);
  assert.match(fs.readFileSync(path.join(fixture.root, 'artifacts', fixture.runId, 'report.md'), 'utf8'), /No rejected attempts\./);
  assert.equal(result.report.cases[0].feature, 'Clients');
  assert.equal(result.report.baselineRows[0].primaryRecording, 'baseline/clients/test-results/wm-tc-001-retry0/video.webm');
  const html = fs.readFileSync(path.join(fixture.root, 'artifacts', fixture.runId, 'index.html'), 'utf8');
  const media = JSON.parse(html.match(/<script type="application\/json" id="video-data">(.*?)<\/script>/s)[1]);
  assert.equal(media[result.report.baselineRows[0].primaryRecording], 'data:video/webm;base64,d2VibQ==');
  assert.match(html, /video\.src=videos\[primary\]/);
  const structured = projectStructured(result.report);
  assert.equal(structured.cases[0].initialRevision, 'baseline-clients-revision');
  assert.equal(structured.cases[0].initialApiRevision, 'baseline-clients-revision');
  assert.equal(structured.cases[0].retestRevision, null);
  assert.equal(structured.cases[0].retestApiRevision, null);
  assert.equal(structured.cases[0].retestStatus, null);
});

test('structured evidence traces each case and gap to its app and API revision', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [
    testOptions('failed'), reportTest('WM-GAP-001', 'passed')
  ], { revision: 'abcdef0123456789', apiRevision: 'abcdef0123456789' });
  addSegment(fixture.root, fixture.runId, 'retest', 'fix-1', [testOptions('passed')], {
    revision: '1234567890abcdef', apiRevision: '1234567890abcdef',
    fixPr: 'https://example.test/pull/1'
  });
  writeJson(path.join(fixture.root, 'artifacts', fixture.runId, 'fixes.json'), {
    fixes: [{ signature: 'validation failure', caseIds: ['WM-TC-001'], prUrl: 'https://example.test/pull/1', fixRevision: '1234567890abcdef', retestLabel: 'fix-1' }]
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.deepEqual(result.errors, []);
  const structured = projectStructured(result.report);
  assert.equal(structured.cases[0].initialRevision, 'abcdef0123456789');
  assert.equal(structured.cases[0].initialApiRevision, 'abcdef0123456789');
  assert.equal(structured.cases[0].retestRevision, '1234567890abcdef');
  assert.equal(structured.cases[0].retestApiRevision, '1234567890abcdef');
  assert.equal(structured.cases[0].initialStatus, 'failed');
  assert.equal(structured.cases[0].finalStatus, 'fixed');
  assert.equal(structured.gaps[0].revision, 'abcdef0123456789');
  assert.equal(structured.gaps[0].apiRevision, 'abcdef0123456789');
});

test('report includes rejected-attempt audit links without counting them as results', (t) => {
  const fixture = setup(t, tinyWorkbook(singleConfig()), singleConfig());
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')]);
  const runDir = path.join(fixture.root, 'artifacts', fixture.runId);
  const rejectedDir = path.join(runDir, 'rejected');
  fs.mkdirSync(rejectedDir);
  fs.writeFileSync(path.join(rejectedDir, 'baseline-clients.zip'), 'preserved invalid attempt');
  writeJson(path.join(rejectedDir, 'rejected.json'), { rejected: [{
    zip: 'baseline-clients.zip', phase: 'baseline', label: 'clients-original',
    reason: 'Test-authoring selector issue <not a product failure>', caseIds: ['WM-TC-001'], revision: 'original-revision'
  }] });
  const result = buildReport(fixture.runId, fixture.options);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.summary.total, 1);
  assert.equal(result.report.summary.passed, 1);
  assert.equal(result.report.baselineRows.length, 1);
  assert.equal(result.report.rejectedAttempts.length, 1);
  assert.equal(result.report.rejectedAttempts[0].archive, 'rejected/baseline-clients.zip');
  assert.match(fs.readFileSync(path.join(runDir, 'report.md'), 'utf8'), /Audit appendix: rejected attempts/);
  assert.match(fs.readFileSync(path.join(runDir, 'report.md'), 'utf8'), /\[Original rejected ZIP\]\(rejected\/baseline-clients.zip\)/);
  const html = fs.readFileSync(path.join(runDir, 'index.html'), 'utf8');
  assert.match(html, /data-panel="audit"/);
  assert.match(html, /Original rejected ZIP/);
  assert.ok(!html.includes('<not a product failure>'));
});

test('report rejects unsafe rejected-attempt archive links', (t) => {
  const fixture = setup(t, tinyWorkbook(singleConfig()), singleConfig());
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')]);
  const rejectedDir = path.join(fixture.root, 'artifacts', fixture.runId, 'rejected');
  fs.mkdirSync(rejectedDir);
  writeJson(path.join(rejectedDir, 'rejected.json'), { rejected: [{ zip: '../../other.zip', reason: 'invalid' }] });
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.errors.some(item => item.code === 'INVALID_REJECTED_ATTEMPT'));
  assert.deepEqual(result.report.rejectedAttempts, []);
});

test('report rejects an unknown API revision', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')], { apiRevision: 'unknown' });
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.errors.some((item) => item.code === 'API_REVISION_UNVERIFIED'));
});

test('report rejects an API revision that does not prefix-match the segment revision', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')], {
    revision: 'abcdef0123456789',
    apiRevision: '1234567'
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.errors.some((item) => item.code === 'API_REVISION_UNVERIFIED'));
});

test('baseline segments with different combined seed digests are SEED_MISMATCH errors', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')], {
    seed: { id: 'one', files: [], sha256: 'combined-one', reset: { files: [], sha256: 'reset-one' } }
  });
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients-extra', [], {
    seed: { id: 'two', files: [], sha256: 'combined-two', reset: { files: [], sha256: 'reset-two' } }
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(result.errors.some((item) => item.code === 'SEED_MISMATCH'));
});

test('retest seed digests may differ from the baseline seed digest', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  const baselineSeed = { id: 'base', files: [], sha256: 'baseline-digest', reset: { files: [], sha256: 'base-reset' } };
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')], { seed: baselineSeed });
  addSegment(fixture.root, fixture.runId, 'retest', 'fix-1', [testOptions('passed')], {
    seed: { id: 'retest', files: [], sha256: 'retest-digest', reset: { files: [], sha256: 'retest-reset' } }
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.ok(!result.errors.some((item) => item.code === 'SEED_MISMATCH'));
  assert.equal(result.report.seed.sha256, 'baseline-digest');
});

test('report markdown shows the seed digests and the HTML omits technical chips and columns', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [testOptions('passed')], {
    seed: {
      id: 'seed',
      files: [{ file: 'server/db/schema.sql', sha256: 'file-hash' }],
      sha256: 'combined-seed-digest',
      reset: { files: ['server/db/workflow-seed.sql'], sha256: 'reset-seed-digest' }
    }
  });
  buildReport(fixture.runId, fixture.options);
  const runDir = path.join(fixture.root, 'artifacts', fixture.runId);
  const markdown = fs.readFileSync(path.join(runDir, 'report.md'), 'utf8');
  const html = fs.readFileSync(path.join(runDir, 'index.html'), 'utf8');
  assert.match(markdown, /Seed digest: combined-seed-digest/);
  assert.match(markdown, /Reset digest: reset-seed-digest/);
  for (const label of ['Seed digest', 'Reset digest', "'API revision'", "'Screenshots'", "'Trace'"]) {
    assert.ok(!html.includes(label), `HTML should not render ${label}`);
  }
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
  assert.equal(result.report.cases[0].fixPr, null);
  assert.deepEqual(result.report.cases[0].fixPrs, []);
});

test('gap retests keep their phases, explicit fix links and unique-test denominator', (t) => {
  const config = singleConfig();
  const fixture = setup(t, tinyWorkbook(config), config);
  addSegment(fixture.root, fixture.runId, 'baseline', 'original', [
    testOptions('passed'), reportTest('WM-GAP-001', 'failed')
  ]);
  addSegment(fixture.root, fixture.runId, 'retest', 'fix-1', [
    testOptions('passed'), reportTest('WM-GAP-001', 'passed')
  ], { revision: 'fix-revision', fixPr: 'https://example.test/pull/1' });
  writeJson(path.join(fixture.root, 'artifacts', fixture.runId, 'fixes.json'), {
    fixes: [{ signature: 'recovery failure', caseIds: ['WM-GAP-001'], prUrl: 'https://example.test/pull/1', fixRevision: 'fix-revision', retestLabel: 'fix-1' }]
  });
  const result = buildReport(fixture.runId, fixture.options);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.summary.gapTests, 1);
  assert.equal(result.report.summary.gapAttempts, 2);
  const structured = projectStructured(result.report);
  assert.equal(structured.cases[0].fixPr, null);
  assert.deepEqual(structured.gaps.map((gap) => [gap.phase, gap.status, gap.fixPr]), [
    ['baseline', 'failed', 'https://example.test/pull/1'],
    ['retest', 'passed', 'https://example.test/pull/1']
  ]);
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
