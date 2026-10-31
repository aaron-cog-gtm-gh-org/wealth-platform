import fs from 'node:fs';
import path from 'node:path';
import { writeJson } from './common.mjs';

function uploadMap(value) {
  if (Array.isArray(value)) return new Map(value.map((item) => [item.file, item.url]));
  const source = value?.uploads ?? value ?? {};
  return new Map(Object.entries(source).map(([file, target]) => [
    file,
    typeof target === 'string' ? target : target?.url
  ]));
}

function recording(row, uploads) {
  if (!row) return null;
  const attempt = row.recordings?.at(-1);
  if (!attempt?.video) return row.primaryRecording ?? null;
  const file = `${row.id}__${row.phase}-${row.label}__retry${attempt.retry}.webm`;
  return uploads.get(file) ?? row.primaryRecording ?? null;
}

export function projectStructured(report, uploads = {}) {
  const uploadsByFile = uploadMap(uploads);
  return {
    runId: report.runId,
    baselineRevision: report.baselineRevisions.length === 1 ? report.baselineRevisions[0] : report.baselineRevisions,
    apiRevision: report.apiRevision ?? 'unknown',
    baseRevision: report.baseRevision,
    fixRevisions: report.fixRevisions,
    seed: report.seed,
    summary: {
      total: report.summary.total,
      passed: report.summary.passed,
      fixed: report.summary.fixed,
      failing: report.summary.failing,
      flaky: report.summary.flaky,
      notRun: report.summary.notRun,
      gapTests: report.summary.gapTests
    },
    errors: report.errors,
    cases: report.cases.map((item) => ({
      id: item.id,
      title: item.title,
      area: item.area,
      feature: item.feature,
      jiraKey: item.jiraKey,
      jiraUrl: item.jiraUrl,
      testPath: item.testPath,
      initialStatus: item.initialStatus,
      initialRevision: item.baseline?.revision ?? null,
      initialApiRevision: item.baseline?.apiRevision ?? null,
      initialRecording: recording(item.baseline, uploadsByFile),
      fixPr: item.fixPr,
      retestStatus: item.retestStatus,
      retestRevision: item.retest?.revision ?? null,
      retestApiRevision: item.retest?.apiRevision ?? null,
      retestRecording: recording(item.retest, uploadsByFile),
      finalStatus: item.finalStatus
    })),
    gaps: report.gapTests.map((item) => ({
      id: item.id,
      title: item.title,
      area: item.area,
      feature: item.feature,
      jiraKey: item.jiraKey,
      jiraUrl: item.jiraUrl,
      wikiRef: item.wikiRef,
      testPath: item.testPath,
      status: item.status,
      revision: item.revision,
      apiRevision: item.apiRevision,
      recording: recording(item, uploadsByFile)
    }))
  };
}

export function writeStructured(runDir, report, uploads = {}) {
  const projection = projectStructured(report, uploads);
  writeJson(path.join(runDir, 'structured-output.json'), projection);
  return projection;
}

export function readUploads(file) {
  if (!file) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
