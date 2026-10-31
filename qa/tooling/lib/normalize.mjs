import fs from 'node:fs';
import path from 'node:path';
import { caseIdFromTitle, diagnostic, normalizeRelative, readJson, writeJson } from './common.mjs';

const ansiPattern = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function attachmentPath(attachment, segmentDir, cwd) {
  if (!attachment.path) return null;
  const rawPath = String(attachment.path);
  let relative;
  if (path.isAbsolute(rawPath)) {
    const fromSegment = path.relative(segmentDir, rawPath);
    if (fromSegment && !fromSegment.startsWith('..') && !path.isAbsolute(fromSegment)) {
      relative = normalizeRelative(fromSegment);
    } else {
      const marker = rawPath.replace(/\\/g, '/').match(/(?:^|\/)test-results\/(.+)$/);
      if (marker) relative = `test-results/${marker[1]}`;
    }
  } else {
    const absolute = path.resolve(cwd, rawPath);
    const fromSegment = path.relative(segmentDir, absolute);
    if (fromSegment && !fromSegment.startsWith('..') && !path.isAbsolute(fromSegment)) {
      relative = normalizeRelative(fromSegment);
    } else {
      const marker = rawPath.replace(/\\/g, '/').match(/(?:^|\/)test-results\/(.+)$/);
      if (marker) relative = `test-results/${marker[1]}`;
      else if (rawPath.startsWith('test-results/')) relative = rawPath;
    }
  }
  return relative ?? rawPath.replace(/\\/g, '/');
}

function extractError(result) {
  const message = result.error?.message ?? result.errors?.[0]?.message ?? '';
  return String(message).replace(ansiPattern, '').split(/\r?\n/, 1)[0];
}

function normalizeAttempt(result, segmentDir, cwd, errors, id, file) {
  const attempt = {
    retry: Number(result.retry ?? 0),
    status: result.status ?? 'interrupted',
    startTime: result.startTime ?? null,
    durationMs: Number(result.duration ?? 0),
    error: extractError(result),
    video: null,
    screenshots: [],
    trace: null,
    before: null,
    after: null
  };
  for (const attachment of result.attachments ?? []) {
    const relative = attachmentPath(attachment, segmentDir, cwd);
    if (!relative) continue;
    const fullPath = path.resolve(segmentDir, relative);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      errors.push(diagnostic('MISSING_EVIDENCE', file, `${id ?? 'untagged'} attachment is missing: ${relative}`));
      continue;
    }
    const name = String(attachment.name ?? '').toLowerCase();
    if (name === 'video' || attachment.contentType?.startsWith('video/') || relative.endsWith('.webm')) {
      attempt.video = relative;
    } else if (name === 'trace' || relative.endsWith('.zip') || attachment.contentType === 'application/zip') {
      attempt.trace = relative;
    } else if (name === 'before.png' || name === 'before') {
      attempt.before = relative;
      attempt.screenshots.push(relative);
    } else if (name === 'after.png' || name === 'after') {
      attempt.after = relative;
      attempt.screenshots.push(relative);
    } else if (attachment.contentType?.startsWith('image/') || /\.(png|jpe?g)$/i.test(relative)) {
      attempt.screenshots.push(relative);
    }
  }
  if (!attempt.video) errors.push(diagnostic('MISSING_EVIDENCE', file, `${id ?? 'untagged'} retry ${attempt.retry} has no video`));
  attempt.screenshots = [...new Set(attempt.screenshots)].sort();
  return attempt;
}

function resultOutcome(test, attempts) {
  if (test.outcome && ['expected', 'unexpected', 'flaky', 'skipped'].includes(test.outcome)) return test.outcome;
  if (!attempts.length || attempts.at(-1).status === 'skipped') return 'skipped';
  const expected = test.expectedStatus ?? 'passed';
  const last = attempts.at(-1).status;
  if (last === expected) return attempts.some((item) => item.status !== expected) ? 'flaky' : 'expected';
  return 'unexpected';
}

function finalStatus(outcome, attempts) {
  if (outcome === 'flaky') return 'flaky';
  if (outcome === 'skipped') return 'skipped';
  const status = attempts.at(-1)?.status ?? 'interrupted';
  if (['passed', 'failed', 'timedOut', 'interrupted', 'skipped'].includes(status)) return status;
  return status === 'timedout' ? 'timedOut' : 'interrupted';
}

function collectSpecs(suites, output = [], parentFile = '') {
  for (const suite of suites ?? []) {
    const suiteFile = suite.file ?? parentFile;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) output.push({ spec, test, suiteFile });
    }
    collectSpecs(suite.suites, output, suiteFile);
  }
  return output;
}

function normalizeSourceFile(file, cwd, testDir) {
  if (!file) return '';
  const normalized = String(file).replace(/\\/g, '/');
  if (path.isAbsolute(file)) {
    const relative = path.relative(cwd, file);
    if (!relative.startsWith('..')) return normalizeRelative(relative);
  }
  const marker = normalized.match(/(?:^|\/)(qa\/tests\/.+)$/);
  if (marker) return marker[1];
  if (testDir) {
    const resolved = path.resolve(testDir, file);
    const relative = path.relative(cwd, resolved);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) return normalizeRelative(relative);
  }
  return normalized.split('/').slice(-3).join('/');
}

export function normalizeResults(results, { segmentDir, cwd = process.cwd(), meta = null } = {}) {
  const errors = [];
  const tests = [];
  const testDir = results.config?.rootDir ?? path.resolve(cwd, 'qa/tests');
  for (const { spec, test, suiteFile } of collectSpecs(results.suites)) {
    const title = spec.title ?? '';
    const id = caseIdFromTitle(title);
    const sourceFile = suiteFile ?? spec.file ?? '';
    const attempts = (test.results ?? []).map((item) =>
      normalizeAttempt(item, segmentDir, cwd, errors, id, normalizeRelative(sourceFile))
    );
    const outcome = resultOutcome(test, attempts);
    const file = normalizeSourceFile(sourceFile, cwd, testDir);
    tests.push({
      ...(id?.startsWith('WM-TC-') ? { caseId: id } : {}),
      ...(id?.startsWith('WM-GAP-') ? { gapId: id } : {}),
      title,
      file,
      line: spec.line ?? null,
      annotations: (test.annotations ?? []).map((annotation) => ({ type: annotation.type, description: annotation.description ?? '' })),
      expectedStatus: test.expectedStatus ?? 'passed',
      outcome,
      status: finalStatus(outcome, attempts),
      attempts: attempts.sort((a, b) => a.retry - b.retry)
    });
  }
  const summary = { ...(meta ?? {}), tests, errors: errors.sort((a, b) => a.code.localeCompare(b.code) || a.path.localeCompare(b.path) || a.message.localeCompare(b.message)) };
  return summary;
}

export function normalizeSegment(segmentDir, { cwd = process.cwd() } = {}) {
  const resolved = path.resolve(segmentDir);
  const resultsPath = path.join(resolved, 'results.json');
  if (!fs.existsSync(resultsPath)) {
    return {
      summary: null,
      errors: [diagnostic('MANUAL_RESULT', path.basename(resolved), 'results.json is missing; summary is not derived from Playwright')]
    };
  }
  const results = readJson(resultsPath);
  const metaPath = path.join(resolved, 'run-meta.json');
  const meta = fs.existsSync(metaPath) ? readJson(metaPath) : null;
  const summary = normalizeResults(results, { segmentDir: resolved, cwd, meta });
  writeJson(path.join(resolved, 'summary.json'), summary);
  return { summary, errors: summary.errors ?? [] };
}
