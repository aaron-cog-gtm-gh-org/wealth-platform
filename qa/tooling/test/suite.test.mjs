import assert from 'node:assert/strict';
import test from 'node:test';
import { suiteSuccessMessage, validateSuite } from '../lib/suite.mjs';
import { listFor, tempDir, tinyConfig, tinyWorkbook, writeSpec } from './helpers.mjs';

const featureAnnotation = (area) => {
  const entry = tinyConfig().areas.find((candidate) => candidate.area === area);
  return [
    { type: 'area', description: area },
    { type: 'feature', description: entry?.feature ?? area }
  ];
};
const tc = (id, title, area) => ({ title: `[${id}] ${title}`, annotations: featureAnnotation(area) });
const gap = (id, title, area) => ({ title: `[${id}] ${title}`, annotations: featureAnnotation(area) });

async function check(t, suites, sourceByFeature = {}) {
  const root = tempDir(t, 'qa-suite-');
  for (const feature of ['clients', 'portfolio']) {
    writeSpec(root, feature, sourceByFeature[feature] ?? "import { caseTest, gapTest } from '../tooling/fixtures';\n");
  }
  return validateSuite({
    workbook: tinyWorkbook(),
    list: listFor(suites),
    config: tinyConfig(),
    root
  });
}

const complete = [
  { file: 'qa/tests/clients.spec.ts', tests: [tc('WM-TC-001', 'Clients visible', 'clients')] },
  { file: 'qa/tests/portfolio.spec.ts', tests: [tc('WM-TC-002', 'Portfolio visible', 'portfolio')] }
];

test('suite accepts exact case coverage', async (t) => {
  const result = await check(t, complete);
  assert.deepEqual(result.errors, []);
  assert.equal(result.caseCount, 2);
  assert.equal(suiteSuccessMessage(result), 'OK 2/2 cases, 0 gap tests');
});

test('suite rejects missing case', async (t) => {
  const result = await check(t, [complete[0]]);
  assert.ok(result.errors.some((item) => item.code === 'MISSING_CASE'));
});

test('suite rejects duplicate test for a case', async (t) => {
  const result = await check(t, [
    { file: complete[0].file, tests: [complete[0].tests[0], complete[0].tests[0]] },
    complete[1]
  ]);
  assert.ok(result.errors.some((item) => item.code === 'DUPLICATE_CASE_TEST'));
});

test('suite rejects a case in the wrong spec file', async (t) => {
  const result = await check(t, [
    { file: 'qa/tests/portfolio.spec.ts', tests: [tc('WM-TC-001', 'clients visible', 'clients')] },
    { file: 'qa/tests/portfolio.spec.ts', tests: [complete[1].tests[0]] }
  ]);
  assert.ok(result.errors.some((item) => item.code === 'WRONG_SPEC'));
});

test('suite rejects title mismatch and untagged tests', async (t) => {
  const result = await check(t, [
    { file: 'qa/tests/clients.spec.ts', tests: [tc('WM-TC-001', 'wrong title', 'clients'), { title: 'untagged test' }] },
    complete[1]
  ]);
  assert.ok(result.errors.some((item) => item.code === 'TITLE_MISMATCH'));
  assert.ok(result.errors.some((item) => item.code === 'UNTAGGED_TEST'));
});

test('static scan rejects test.skip', async (t) => {
  const result = await check(t, complete, {
    clients: "import { caseTest } from '../tooling/fixtures';\ntest.skip('not acceptable', () => {});\n"
  });
  assert.ok(result.errors.some((item) => item.code === 'FORBIDDEN_TEST_API'));
});

test('static scan rejects configure and per-test timeout overrides', async (t) => {
  const result = await check(t, complete, {
    clients: "import { caseTest } from '../tooling/fixtures';\ntest.configure({ retries: 2 });\ntest.setTimeout(120000);\n"
  });
  assert.equal(result.errors.filter((item) => item.code === 'FORBIDDEN_TEST_API').length, 2);
});

test('suite accepts feature-owned gaps and rejects duplicate ids', async (t) => {
  const tests = [
    ...complete[0].tests,
    gap('WM-GAP-001', 'wiki coverage', 'clients')
  ];
  const good = await check(t, [
    { file: 'qa/tests/clients.spec.ts', tests },
    complete[1]
  ]);
  assert.deepEqual(good.errors, []);
  assert.equal(good.gapCount, 1);
  const duplicate = await check(t, [
    { file: 'qa/tests/clients.spec.ts', tests: [...tests, gap('WM-GAP-001', 'duplicate gap', 'clients')] },
    complete[1]
  ]);
  assert.ok(duplicate.errors.some((item) => item.code === 'DUPLICATE_GAP'));
});

test('suite requires gap tests in their feature spec', async (t) => {
  const result = await check(t, [
    { file: 'qa/tests/clients.spec.ts', tests: [complete[0].tests[0], gap('WM-GAP-002', 'wrong area', 'portfolio')] },
    complete[1]
  ]);
  assert.ok(result.errors.some((item) => item.code === 'GAP_WRONG_FILE'));
});

test('feature scope ignores other spec files and reports selected area coverage', async (t) => {
  const root = tempDir(t, 'qa-suite-scope-');
  writeSpec(root, 'clients');
  writeSpec(root, 'portfolio');
  const result = await validateSuite({
    workbook: tinyWorkbook(),
    list: listFor([
      { file: 'qa/tests/clients.spec.ts', tests: [complete[0].tests[0], gap('WM-GAP-003', 'client gap', 'clients')] },
      { file: 'qa/tests/portfolio.spec.ts', tests: [{ title: 'not ready yet' }] }
    ]),
    config: tinyConfig(),
    root,
    areas: ['clients']
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.caseCount, 1);
  assert.equal(result.gapCount, 1);
  assert.equal(suiteSuccessMessage(result), 'OK 1/1 clients cases, 1 gap tests');
});

test('feature alias accepts the title-case display label', async (t) => {
  const root = tempDir(t, 'qa-suite-alias-');
  writeSpec(root, 'clients');
  writeSpec(root, 'portfolio');
  const result = await validateSuite({
    workbook: tinyWorkbook(),
    list: listFor([complete[0], { file: 'qa/tests/portfolio.spec.ts', tests: [{ title: 'not ready yet' }] }]),
    config: tinyConfig(),
    root,
    features: ['Clients']
  });
  assert.deepEqual(result.errors, []);
  assert.equal(suiteSuccessMessage(result), 'OK 1/1 clients cases, 0 gap tests');
});

test('uses the spec suite file when Playwright reports the fixture definition file', async (t) => {
  const root = tempDir(t, 'qa-suite-playwright-list-');
  writeSpec(root, 'clients');
  writeSpec(root, 'portfolio');
  const result = await validateSuite({
    workbook: tinyWorkbook(),
    list: {
      suites: [{
        file: 'clients.spec.ts',
        specs: [{
          title: '[WM-TC-001] Clients visible',
          file: '../tooling/fixtures.ts',
          tests: [{ annotations: featureAnnotation('clients') }]
        }]
      }]
    },
    config: tinyConfig(),
    root,
    areas: ['clients']
  });
  assert.deepEqual(result.errors, []);
  assert.equal(suiteSuccessMessage(result), 'OK 1/1 clients cases, 0 gap tests');
});
