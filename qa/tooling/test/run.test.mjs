import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { collectSeedMetadata, compareApiRevision, committedChangesError, dirtyChangesError, runSegment } from '../lib/run.mjs';
import { repoRoot } from '../lib/common.mjs';
import { tempDir } from './helpers.mjs';

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

test('missing and non-SHA API revisions error and normalize to unknown', () => {
  for (const value of [undefined, null, '', 'unknown', 'abcdef']) {
    const result = compareApiRevision(value, head);
    assert.equal(result.apiRevision, 'unknown');
    assert.equal(result.warning, null);
    assert.equal(result.error.code, 'API_REVISION_UNKNOWN');
    assert.match(result.error.message, /restart `npm run dev:full` from a git checkout or set `APP_REVISION`/);
  }
});

test('unknown API revision blocks a run before Playwright or segment creation', async (t) => {
  const server = createServer((request, response) => {
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.end(request.url === '/api/health'
      ? JSON.stringify({ status: 'ok', revision: 'unknown' })
      : '{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const artifacts = tempDir(t, 'qa-unknown-api-');
  const result = await runSegment({
    runId: 'unknown-api',
    phase: 'baseline',
    label: 'clients',
    cwd: repoRoot,
    artifacts,
    env: { QA_BASE_URL: origin, QA_API_URL: origin }
  });
  assert.equal(result.exitCode, 2);
  assert.equal(result.apiRevision, 'unknown');
  assert.ok(result.errors.some((item) => item.code === 'API_REVISION_UNKNOWN'));
  assert.ok(!fs.existsSync(path.join(artifacts, 'unknown-api', 'baseline', 'clients')));
});

test('skip-preflight records an unknown API revision in run metadata', async (t) => {
  const artifacts = tempDir(t, 'qa-skip-preflight-');
  const result = await runSegment({
    runId: 'skip-preflight',
    phase: 'baseline',
    label: 'clients',
    args: ['--help'],
    skipPreflight: true,
    cwd: repoRoot,
    artifacts,
    env: { QA_SEED: 'fixture-seed' }
  });
  const metaPath = path.join(artifacts, 'skip-preflight', 'baseline', 'clients', 'run-meta.json');
  assert.equal(result.meta.apiRevision, 'unknown');
  assert.equal(JSON.parse(fs.readFileSync(metaPath, 'utf8')).apiRevision, 'unknown');
});

test('seed metadata hashes the default files and reset files in order', (t) => {
  const root = tempDir(t, 'qa-seed-digests-');
  const seedFiles = [
    ['server/db/schema.sql', 'schema'],
    ['server/db/seed.sql', 'seed'],
    ['server/db/workflow-seed.sql', 'workflow']
  ];
  for (const [file, contents] of seedFiles) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents);
  }
  const result = collectSeedMetadata({ cwd: root, env: { QA_SEED: 'fixture-seed' } });
  const entries = seedFiles.map(([file, contents]) => ({
    file,
    sha256: crypto.createHash('sha256').update(contents).digest('hex')
  }));
  const digest = (items) => crypto.createHash('sha256')
    .update(items.map(({ file, sha256 }) => `${file}\0${sha256}\n`).join(''))
    .digest('hex');
  assert.deepEqual(result.errors, []);
  assert.equal(result.seed.id, 'fixture-seed');
  assert.deepEqual(result.seed.files, entries);
  assert.equal(result.seed.sha256, digest(entries));
  assert.deepEqual(result.seed.reset.files, ['server/db/workflow-seed.sql']);
  assert.equal(result.seed.reset.sha256, digest([entries[2]]));
});

test('QA_SEED_FILES and QA_RESET_FILES override the ordered file lists', (t) => {
  const root = tempDir(t, 'qa-seed-overrides-');
  for (const [file, contents] of [['second.sql', 'second'], ['first.sql', 'first'], ['reset.sql', 'reset']]) {
    fs.writeFileSync(path.join(root, file), contents);
  }
  const result = collectSeedMetadata({
    cwd: root,
    env: { QA_SEED_FILES: 'second.sql,first.sql', QA_RESET_FILES: 'reset.sql' }
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.seed.files.map(({ file }) => file), ['second.sql', 'first.sql']);
  assert.deepEqual(result.seed.reset.files, ['reset.sql']);
});

test('missing seed files are errors and block the run before segment creation', async (t) => {
  const metadata = collectSeedMetadata({
    cwd: repoRoot,
    env: { QA_SEED_FILES: 'missing-seed.sql', QA_RESET_FILES: 'missing-reset.sql' }
  });
  assert.equal(metadata.errors.length, 2);
  assert.ok(metadata.errors.every((item) => item.code === 'SEED_FILE_MISSING'));
  const artifacts = tempDir(t, 'qa-missing-seed-');
  const result = await runSegment({
    runId: 'missing-seed',
    phase: 'baseline',
    label: 'clients',
    skipPreflight: true,
    cwd: repoRoot,
    artifacts,
    env: { QA_SEED_FILES: 'missing-seed.sql', QA_RESET_FILES: 'missing-reset.sql' }
  });
  assert.equal(result.exitCode, 2);
  assert.ok(result.errors.every((item) => item.code === 'SEED_FILE_MISSING'));
  assert.ok(!fs.existsSync(path.join(artifacts, 'missing-seed', 'baseline', 'clients')));
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
