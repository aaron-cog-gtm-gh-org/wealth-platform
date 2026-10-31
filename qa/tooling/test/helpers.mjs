import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAreas, writeJson } from '../lib/common.mjs';

export function tempDir(t, prefix = 'qa-tooling-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

export function workbookFor(config = loadAreas()) {
  const cases = [];
  for (const area of config.areas) {
    for (let number = area.first; number <= area.last; number += 1) {
      cases.push({
        id: `WM-TC-${String(number).padStart(3, '0')}`,
        feature: area.feature,
        title: `${area.feature} test ${number}`,
        jiraKey: area.jiraKey,
        jiraUrl: `${config.jiraBaseUrl}${area.jiraKey}`,
        priority: 'High',
        preconditions: '',
        testData: '',
        steps: [{ action: 'Open the area', expected: 'Area is visible' }]
      });
    }
  }
  return { cases };
}

export function tinyConfig() {
  return {
    jiraBaseUrl: 'https://example.atlassian.net/browse/',
    totalCases: 2,
    casePattern: '^WM-TC-\\d{3}$',
    gap: { pattern: '^WM-GAP-\\d{3}$', jiraKey: 'KAN-18' },
    areas: [
      { area: 'clients', feature: 'Clients', count: 1, first: 1, last: 1, jiraKey: 'KAN-12', spec: 'qa/tests/clients.spec.ts' },
      { area: 'portfolio', feature: 'Portfolio', count: 1, first: 2, last: 2, jiraKey: 'KAN-13', spec: 'qa/tests/portfolio.spec.ts' }
    ]
  };
}

export function tinyWorkbook(config = tinyConfig()) {
  return {
    cases: config.areas.map((area) => ({
      id: `WM-TC-${String(area.first).padStart(3, '0')}`,
      feature: area.feature,
      title: `${area.feature} visible`,
      jiraKey: area.jiraKey,
      jiraUrl: `${config.jiraBaseUrl}${area.jiraKey}`,
      priority: 'High',
      preconditions: '',
      testData: '',
      steps: [{ action: 'Open', expected: 'Visible' }]
    }))
  };
}

export function writeSpec(root, feature, source = "import { caseTest } from '../tooling/fixtures';\n") {
  const file = path.join(root, 'qa/tests', `${feature}.spec.ts`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
  return file;
}

export function listFor(specs) {
  return {
    suites: specs.map(({ file, tests }) => ({
      file,
      specs: tests.map(({ title, annotations = [], line = 1 }) => ({
        title,
        file,
        line,
        tests: [{ annotations }]
      }))
    }))
  };
}

export function reportTest(id, status, options = {}) {
  const video = options.video ?? `test-results/${id.toLowerCase()}-retry${options.retry ?? 0}/video.webm`;
  const attempt = {
    retry: options.retry ?? 0,
    status,
    startTime: '2025-01-01T00:00:00.000Z',
    durationMs: 20,
    error: status === 'failed' ? 'expected text to be visible' : '',
    video,
    screenshots: options.after ? [options.after] : [],
    trace: options.trace ?? null,
    before: null,
    after: options.after ?? null
  };
  return {
    caseId: id,
    title: `[${id}] Clients visible`,
    file: 'qa/tests/clients.spec.ts',
    line: 4,
    annotations: [{ type: 'area', description: 'clients' }, { type: 'feature', description: 'Clients' }],
    expectedStatus: 'passed',
    outcome: status === 'passed' ? 'expected' : 'unexpected',
    status,
    attempts: [attempt]
  };
}

export function addSegment(root, runId, phase, label, tests, options = {}) {
  const directory = path.join(root, 'artifacts', runId, phase, label);
  fs.mkdirSync(directory, { recursive: true });
  const meta = {
    schema: 1,
    runId,
    phase,
    label,
    fixPr: options.fixPr ?? null,
    revision: options.revision ?? `${phase}-${label}-revision`,
    baseRevision: options.baseRevision ?? 'base-sha',
    seed: { id: 'seed-one', file: 'server/db/seed.sql', sha256: 'seed-hash' },
    invocation: { argv: ['node', 'qa/tooling/qa.mjs', 'run'], env: { QA_BASE_URL: 'http://localhost:5173' } },
    startedAt: '2025-01-01T00:00:00.000Z',
    finishedAt: options.finishedAt ?? (phase === 'baseline' ? '2025-01-01T00:01:00.000Z' : '2025-01-01T00:02:00.000Z'),
    exitCode: 0
  };
  writeJson(path.join(directory, 'run-meta.json'), meta);
  writeJson(path.join(directory, 'results.json'), { suites: [] });
  for (const test of tests) {
    for (const attempt of test.attempts ?? []) {
      for (const file of [attempt.video, ...(attempt.screenshots ?? []), attempt.trace].filter(Boolean)) {
        const target = path.join(directory, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.endsWith('.png') ? Buffer.from('png') : file.endsWith('.zip') ? Buffer.from('zip') : Buffer.from('webm'));
      }
    }
  }
  writeJson(path.join(directory, 'summary.json'), { ...meta, tests });
  return directory;
}

export function reportFixture(t, config = tinyConfig(), workbook = tinyWorkbook(config)) {
  const root = tempDir(t, 'qa-report-');
  writeJson(path.join(root, 'cases.json'), workbook);
  return {
    root,
    config,
    runId: 'run-one',
    options: { root, artifacts: 'artifacts', casesFile: 'cases.json', config, generatedAt: '2025-01-02T00:00:00.000Z' }
  };
}
