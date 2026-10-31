import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { diagnostic, normalizeRelative, printDiagnostics, sortedDiagnostics, writeJson } from './common.mjs';
import { normalizeSegment } from './normalize.mjs';

const require = createRequire(import.meta.url);
const allowedId = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function git(command, args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function dirtyFiles(status) {
  return status.split(/\r?\n/).filter(Boolean).map((line) => {
    const raw = line.slice(3).replace(/^"(.*)"$/, '$1');
    return normalizeRelative(raw);
  }).sort();
}

function qaEnvironment(env, segmentDir, cwd) {
  const captured = Object.fromEntries(Object.entries(env)
    .filter(([key]) => key.startsWith('QA_') || key === 'ENABLE_TEST_RESET' || key === 'CI')
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  const relativeSegment = path.relative(cwd, segmentDir);
  if (captured.QA_SEGMENT_DIR !== undefined) {
    captured.QA_SEGMENT_DIR = relativeSegment.startsWith('..') ? path.basename(segmentDir) : normalizeRelative(relativeSegment);
  }
  return captured;
}

async function checkEndpoint(url, method) {
  try {
    const response = await fetch(url, { method });
    return response.ok ? null : `${method} ${url} returned ${response.status}`;
  } catch (error) {
    return `${method} endpoint unavailable: ${(error).message.split(/\r?\n/, 1)[0]}`;
  }
}

async function checkApiHealth(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return { issue: `GET ${url} returned ${response.status}`, revision: null };
    const body = await response.json().catch(() => null);
    return { issue: null, revision: body?.revision };
  } catch (error) {
    return { issue: `GET endpoint unavailable: ${(error).message.split(/\r?\n/, 1)[0]}`, revision: null };
  }
}

export function compareApiRevision(value, headRevision) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  const head = String(headRevision ?? '').trim();
  const isSha = /^[a-f\d]{7,40}$/i;
  if (!isSha.test(candidate)) {
    return {
      apiRevision: 'unknown',
      warning: diagnostic('API_REVISION_UNKNOWN', 'api/health', 'API health response has no recognized revision SHA'),
      error: null
    };
  }
  if (isSha.test(head) && (candidate.startsWith(head) || head.startsWith(candidate))) {
    return { apiRevision: candidate, warning: null, error: null };
  }
  return {
    apiRevision: candidate,
    warning: null,
    error: diagnostic(
      'API_REVISION_MISMATCH',
      'api/health',
      `API serving ${candidate.slice(0, 7)} but HEAD is ${head.slice(0, 7)}; restart \`npm run dev:full\``
    )
  };
}

export function committedChangesError(baseSha, files) {
  const appChanges = files.filter((file) => !file.startsWith('qa/tests/'));
  return appChanges.length
    ? diagnostic('APP_CHANGED', '.', `committed changes outside qa/tests/** since ${baseSha}: ${appChanges.join(', ')}`)
    : null;
}

export function dirtyChangesError(files, artifacts, cwd) {
  const artifactPath = normalizeRelative(path.relative(cwd, path.resolve(cwd, artifacts)));
  const artifactPrefix = artifactPath && artifactPath !== '.' && !artifactPath.startsWith('../')
    ? `${artifactPath}/`
    : null;
  const forbidden = files.filter((file) =>
    !file.startsWith('qa/tests/')
    && file !== artifactPath
    && !(artifactPrefix && file.startsWith(artifactPrefix))
  );
  return forbidden.length
    ? diagnostic('DIRTY_FILES', '.', `only qa/tests/** and ${artifactPath}/ may be dirty with --base-sha: ${forbidden.join(', ')}`)
    : null;
}

function playwrightInfo() {
  const cli = require.resolve('@playwright/test/cli');
  let version = 'unknown';
  try {
    const packagePath = require.resolve('@playwright/test/package.json');
    version = require(packagePath).version;
  } catch {
    const packagePath = path.resolve(path.dirname(cli), '../package.json');
    if (fs.existsSync(packagePath)) version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
  }
  return { cli, version };
}

function waitForProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code ?? (signal ? 1 : 0), signal }));
  });
}

export async function runSegment({ runId, phase, label, baseSha = null, fixPr = null, args = [], skipPreflight = false, cwd = process.cwd(), env = process.env, artifacts = env.QA_ARTIFACTS_DIR ?? 'qa-artifacts' }) {
  const errors = [];
  const warnings = [];
  if (!allowedId.test(runId ?? '')) errors.push(diagnostic('INVALID_RUN_ID', '.', 'run id must match ^[A-Za-z0-9][A-Za-z0-9._-]*$'));
  if (!allowedId.test(label ?? '')) errors.push(diagnostic('INVALID_LABEL', '.', 'label must match ^[A-Za-z0-9][A-Za-z0-9._-]*$'));
  if (!['baseline', 'retest'].includes(phase)) errors.push(diagnostic('INVALID_PHASE', '.', 'phase must be baseline or retest'));
  if (errors.length) return { errors, warnings, exitCode: 2 };

  const segmentDir = path.resolve(cwd, artifacts, runId, phase, label);
  if (fs.existsSync(segmentDir)) {
    errors.push(diagnostic('SEGMENT_EXISTS', normalizeRelative(path.relative(cwd, segmentDir)), 'segment directory already exists'));
    return { errors, warnings, exitCode: 2 };
  }

  let revision;
  let dirty;
  let testFilesDiff = [];
  try {
    revision = git('git', ['rev-parse', 'HEAD'], cwd).stdout;
    dirty = dirtyFiles(git('git', ['status', '--porcelain'], cwd).stdout);
  } catch (error) {
    return { errors: [diagnostic('GIT_METADATA', '.', `unable to read git metadata: ${error.message}`)], warnings, exitCode: 2 };
  }
  let apiRevision = 'unknown';
  if (!skipPreflight) {
    const baseUrl = env.QA_BASE_URL ?? 'http://localhost:5173';
    const apiUrl = env.QA_API_URL ?? 'http://localhost:3001';
    const healthPath = env.QA_HEALTH_PATH ?? '/api/health';
    const resetPath = env.QA_RESET_PATH ?? '/api/test/reset';
    const webIssue = await checkEndpoint(new URL('/', baseUrl).toString(), 'GET');
    const health = await checkApiHealth(new URL(healthPath, apiUrl).toString());
    const resetIssue = await checkEndpoint(new URL(resetPath, apiUrl).toString(), 'POST');
    if (webIssue) errors.push(diagnostic('PREFLIGHT_FAILED', '.', webIssue));
    if (health.issue) errors.push(diagnostic('PREFLIGHT_FAILED', '.', health.issue));
    if (resetIssue) errors.push(diagnostic('PREFLIGHT_FAILED', '.', resetIssue));
    if (!health.issue) {
      const comparison = compareApiRevision(health.revision, revision);
      apiRevision = comparison.apiRevision;
      if (comparison.warning) warnings.push(comparison.warning);
      if (comparison.error) errors.push(comparison.error);
    }
  } else {
    const comparison = compareApiRevision(null, revision);
    warnings.push(comparison.warning);
  }
  if (baseSha) {
    const ancestor = git('git', ['merge-base', '--is-ancestor', baseSha, 'HEAD'], cwd);
    if (ancestor.status !== 0) errors.push(diagnostic('BASE_NOT_ANCESTOR', '.', `${baseSha} is not an ancestor of HEAD`));
    const diff = git('git', ['diff', '--name-only', baseSha, 'HEAD'], cwd);
    if (diff.status !== 0) errors.push(diagnostic('GIT_DIFF', '.', `unable to diff against ${baseSha}`));
    else testFilesDiff = diff.stdout ? diff.stdout.split(/\r?\n/).map(normalizeRelative).sort() : [];
    const appChanged = committedChangesError(baseSha, testFilesDiff);
    if (appChanged) errors.push(appChanged);
    const dirtyError = dirtyChangesError(dirty, artifacts, cwd);
    if (dirtyError) errors.push(dirtyError);
  }
  if (errors.length) return { errors: sortedDiagnostics(errors), warnings: sortedDiagnostics(warnings), apiRevision, exitCode: 2 };

  const defaultSeed = ['server/db/seed.sql', 'server/db/seed.ts'].map((file) => path.join(cwd, file)).find((file) => fs.existsSync(file));
  const seedFile = env.QA_SEED_FILE ? path.resolve(cwd, env.QA_SEED_FILE) : defaultSeed;
  const seed = {
    id: env.QA_SEED ?? null,
    file: seedFile ? normalizeRelative(path.relative(cwd, seedFile)) : null,
    sha256: seedFile ? crypto.createHash('sha256').update(fs.readFileSync(seedFile)).digest('hex') : null
  };
  const pw = playwrightInfo();
  const processEnv = { ...env, QA_SEGMENT_DIR: normalizeRelative(path.relative(cwd, segmentDir)) };
  const meta = {
    schema: 1,
    runId,
    phase,
    label,
    fixPr,
    revision,
    apiRevision,
    baseRevision: baseSha,
    dirty,
    testFilesDiff,
    seed,
    invocation: {
      argv: ['node', 'qa/tooling/qa.mjs', 'run', `--run-id`, runId, '--phase', phase, '--label', label, ...args],
      cwd: '.',
      env: qaEnvironment(processEnv, segmentDir, cwd),
      skipPreflight
    },
    versions: { node: process.version, playwright: pw.version, os: `${process.platform}${os.arch()}` },
    startedAt: new Date().toISOString()
  };
  fs.mkdirSync(segmentDir, { recursive: true });
  writeJson(path.join(segmentDir, 'run-meta.json'), meta);

  const result = await waitForProcess(process.execPath, [pw.cli, 'test', ...args], {
    cwd,
    env: processEnv,
    stdio: 'inherit'
  });
  meta.finishedAt = new Date().toISOString();
  meta.exitCode = result.code;
  writeJson(path.join(segmentDir, 'run-meta.json'), meta);
  const normalized = normalizeSegment(segmentDir, { cwd });
  if (normalized.errors.length) printDiagnostics(normalized.errors);
  return { segmentDir, meta, summary: normalized.summary, errors: normalized.errors, warnings: sortedDiagnostics(warnings), exitCode: normalized.errors.length ? 2 : result.code };
}
