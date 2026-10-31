import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { caseSuccessMessage, validateCases } from '../lib/cases.mjs';
import { loadAreas, printDiagnostics, repoRoot, sortedDiagnostics, writeJson } from '../lib/common.mjs';
import { tempDir, workbookFor } from './helpers.mjs';

const config = loadAreas();

test('valid 50-case workbook passes', () => {
  const result = validateCases(workbookFor(config), { config, cwd: repoRoot });
  assert.deepEqual(result.errors, []);
  assert.equal(caseSuccessMessage(config), 'OK 50 cases (Clients 8, Portfolio 10, Orders 12, Move Money 8, Rebalance 6, Settlements 6)');
});

test('wrong area count is an error', () => {
  const workbook = workbookFor(config);
  workbook.cases.pop();
  const result = validateCases(workbook, { config });
  assert.ok(result.errors.some((item) => item.code === 'AREA_COUNT'));
});

test('duplicate case ids are reported', () => {
  const workbook = workbookFor(config);
  workbook.cases[1].id = workbook.cases[0].id;
  const result = validateCases(workbook, { config });
  assert.ok(result.errors.some((item) => item.code === 'DUPLICATE_ID'));
});

test('ids outside an area range are reported', () => {
  const workbook = workbookFor(config);
  workbook.cases[0].id = 'WM-TC-009';
  const result = validateCases(workbook, { config });
  assert.ok(result.errors.some((item) => item.code === 'ID_OUT_OF_RANGE'));
});

test('wrong Jira key and URL are reported', () => {
  const workbook = workbookFor(config);
  workbook.cases[0].jiraKey = 'KAN-99';
  workbook.cases[0].jiraUrl = 'https://example.invalid/KAN-99';
  const result = validateCases(workbook, { config });
  assert.ok(result.errors.some((item) => item.code === 'JIRA_KEY'));
  assert.ok(result.errors.some((item) => item.code === 'JIRA_URL'));
});

test('feature labels must match the canonical title-case workbook label', () => {
  const workbook = workbookFor(config);
  workbook.cases[0].feature = 'clients';
  const result = validateCases(workbook, { config });
  assert.ok(result.errors.some((item) => item.code === 'UNKNOWN_FEATURE'));
});

test('priority, preconditions, and testData follow workbook field types', () => {
  const workbook = workbookFor(config);
  workbook.cases[0].priority = 'P1';
  workbook.cases[0].preconditions = [];
  workbook.cases[0].testData = { account: 'demo' };
  const result = validateCases(workbook, { config });
  assert.ok(result.errors.some((item) => item.code === 'PRIORITY'));
  assert.ok(result.errors.some((item) => item.code === 'PRECONDITIONS'));
  assert.ok(result.errors.some((item) => item.code === 'TEST_DATA'));
});

test('missing steps and expected results are reported', () => {
  const workbook = workbookFor(config);
  delete workbook.cases[0].steps;
  workbook.cases[1].steps[0].expected = '';
  const result = validateCases(workbook, { config });
  assert.ok(result.errors.some((item) => item.code === 'STEPS'));
  assert.ok(result.errors.some((item) => item.code === 'STEP_FIELDS'));
});

test('diagnostics sort deterministically by code, path, and message', () => {
  const input = [
    { code: 'Z', path: 'b', message: 'z' },
    { code: 'A', path: 'z', message: 'a' },
    { code: 'A', path: 'a', message: 'b' }
  ];
  assert.deepEqual(sortedDiagnostics(input).map((item) => item.path), ['a', 'z', 'b']);
  const printed = [];
  printDiagnostics(input, [], { error: (line) => printed.push(line), warn() {} });
  assert.deepEqual(printed, ['ERROR A a: b', 'ERROR A z: a', 'ERROR Z b: z']);
});

test('validate-cases CLI returns exit 2 and sorted ERROR lines for invalid input', (t) => {
  const directory = tempDir(t, 'qa-cli-');
  const file = path.join(directory, 'bad.json');
  writeJson(file, { cases: [] });
  const result = spawnSync(process.execPath, [
    path.join(repoRoot, 'qa/tooling/qa.mjs'), 'validate-cases', '--cases', file
  ], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 2);
  const lines = result.stderr.trim().split(/\r?\n/);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((line) => line.startsWith('ERROR ')));
  assert.deepEqual(lines, [...lines].sort((a, b) => {
    const left = a.slice('ERROR '.length).split(' ');
    const right = b.slice('ERROR '.length).split(' ');
    return left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]) || left.slice(2).join(' ').localeCompare(right.slice(2).join(' '));
  }));
  assert.ok(!result.stderr.includes(directory));
});
