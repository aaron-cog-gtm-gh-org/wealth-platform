import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { bundleRun } from '../lib/bundle.mjs';
import { addSegment, reportFixture, reportTest } from './helpers.mjs';

test('bundle preserves rejected evidence archives', async (t) => {
  const fixture = reportFixture(t);
  addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [reportTest('WM-TC-001', 'passed')]);
  const rejectedDir = path.join(fixture.root, 'artifacts', fixture.runId, 'rejected');
  const runDir = path.dirname(rejectedDir);
  fs.writeFileSync(path.join(runDir, 'full-run.mp4'), Buffer.from('compiled-video'));
  fs.writeFileSync(path.join(runDir, 'demo-manifest.json'), '{"clips":[]}');
  fs.mkdirSync(rejectedDir, { recursive: true });
  fs.writeFileSync(path.join(rejectedDir, 'baseline-clients-r1.zip'), Buffer.from('rejected-evidence-archive'));

  const result = await bundleRun(fixture.runId, {
    root: fixture.root,
    artifacts: 'artifacts',
    out: 'evidence.zip',
    allowErrors: true
  });
  assert.ok(result.zipPath);
  assert.ok(fs.readFileSync(result.zipPath).includes(Buffer.from('rejected-evidence-archive')));
  assert.ok(fs.readFileSync(result.zipPath).includes(Buffer.from('compiled-video')));
  assert.ok(fs.readFileSync(result.zipPath).includes(Buffer.from('demo-manifest.json')));
});
