import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildDemoVideo, demoSequence } from '../lib/demo-video.mjs';
import { buildReport } from '../lib/report.mjs';
import { addSegment, reportFixture, reportTest, workbookFor } from './helpers.mjs';

test('the demo sequence retains every baseline, gap and retest recording attempt', () => {
  const sequence = demoSequence({
    baselineRows: [{ id: 'WM-TC-001', title: '[WM-TC-001] Search', phase: 'baseline', recordings: [
      { video: 'first.webm', status: 'failed' }, { video: 'retry.webm', status: 'passed' }
    ] }],
    gapTests: [{ id: 'WM-GAP-001', title: 'Gap', phase: 'baseline', recordings: [{ video: 'gap.webm', status: 'passed' }] }],
    retestRows: [{ id: 'WM-TC-001', title: 'Search', phase: 'retest', recordings: [{ video: 'retest.webm', status: 'passed' }] }]
  });
  assert.deepEqual(sequence.map((clip) => clip.video), ['first.webm', 'retry.webm', 'gap.webm', 'retest.webm']);
  assert.equal(sequence[0].title, 'Search');
  assert.throws(() => demoSequence({ baselineRows: [{ title: 'Missing', recordings: [{ video: null }] }], retestRows: [], gapTests: [] }), /individual recording/);
});

test('opening journeys lead the video without dropping retries or changing source results', () => {
  const row = (id, phase = 'baseline') => ({ id, title: id, phase, recordings: [
    { video: `${phase}-${id}.webm`, status: 'passed' }
  ] });
  const report = { baselineRows: [row('WM-TC-001'), row('WM-TC-053'), row('WM-TC-052'), row('WM-TC-051')],
    gapTests: [row('WM-GAP-001')], retestRows: [row('WM-TC-051', 'retest')] };
  report.baselineRows[3].recordings.unshift({ video: 'first-failure.webm', status: 'failed' });
  const before = JSON.stringify(report);
  const sequence = demoSequence(report);
  assert.deepEqual(sequence.map((clip) => clip.id), [
    'WM-TC-051', 'WM-TC-051', 'WM-TC-052', 'WM-TC-053', 'WM-TC-001', 'WM-GAP-001', 'WM-TC-051'
  ]);
  assert.equal(sequence[0].status, 'failed');
  assert.equal(sequence[0].video, 'first-failure.webm');
  assert.equal(sequence.at(-1).phase, 'retest');
  assert.equal(JSON.stringify(report), before);
});

test('composed MP4 includes a title card before each attempt, without replacing the source WebMs', (t) => {
  if (spawnSync('ffmpeg', ['-version']).error || spawnSync('ffprobe', ['-version']).error) return t.skip('FFmpeg unavailable');
  const config = {
    jiraBaseUrl: 'https://example.atlassian.net/browse/', totalCases: 2, casePattern: '^WM-TC-\\d{3}$',
    gap: { pattern: '^WM-GAP-\\d{3}$', jiraKey: 'KAN-18' },
    areas: [{ area: 'clients', feature: 'Clients', first: 1, last: 2, count: 2, jiraKey: 'KAN-12', spec: 'qa/tests/clients.spec.ts' }]
  };
  const fixture = reportFixture(t, config, workbookFor(config));
  const segment = addSegment(fixture.root, fixture.runId, 'baseline', 'clients', [
    reportTest('WM-TC-001', 'passed'), reportTest('WM-TC-002', 'failed')
  ]);
  const sources = ['WM-TC-001', 'WM-TC-002'].map((id) => path.join(segment, `test-results/${id.toLowerCase()}-retry0/video.webm`));
  for (const source of sources) {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
      'color=c=white:s=1280x900:r=15:d=0.5', '-c:v', 'libvpx', '-an', source]);
    assert.equal(result.status, 0);
  }
  const report = buildReport(fixture.runId, fixture.options);
  assert.deepEqual(report.errors, []);
  const runDir = path.join(fixture.root, 'artifacts', fixture.runId);
  const video = buildDemoVideo(runDir);
  assert.equal(video.clips, 2);
  assert.ok(video.duration >= 8);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runDir, 'demo-manifest.json'))).clips.map((clip) => clip.id), ['WM-TC-001', 'WM-TC-002']);
  for (const source of sources) assert.ok(fs.statSync(source).size > 0);
});
