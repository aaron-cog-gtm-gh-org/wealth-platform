import fs from 'node:fs';
import path from 'node:path';
import { caseIdFromTitle, diagnostic, normalizeRelative, readJson, sortedDiagnostics, writeJson } from './common.mjs';

const safeName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function attachmentPath(segment, input, file, errors) {
  if (typeof input !== 'string' || !input) {
    errors.push(diagnostic('ATTACHMENT_PATH', path.basename(file), 'attachment path must be relative to the segment'));
    return null;
  }
  const portable = input.replace(/\\/g, '/');
  const target = path.resolve(segment, portable);
  const relative = path.relative(segment, target);
  if (path.isAbsolute(portable) || /^[A-Za-z]:\//.test(portable) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    errors.push(diagnostic('ATTACHMENT_PATH', path.basename(portable), 'attachment path must remain inside the segment'));
    return null;
  }
  return { source: target, sourcePath: normalizeRelative(relative) };
}

function testId(test) {
  return test.caseId ?? test.gapId ?? caseIdFromTitle(test.title);
}

export function exportVideos(segmentDir, outDir) {
  const segment = path.resolve(segmentDir);
  const destination = path.resolve(outDir);
  const errors = [];
  const metaPath = path.join(segment, 'run-meta.json');
  const summaryPath = path.join(segment, 'summary.json');
  if (!fs.existsSync(metaPath) || !fs.existsSync(summaryPath)) {
    return { errors: [diagnostic('SEGMENT_DATA', path.basename(segment), 'run-meta.json and summary.json are required')], manifest: [] };
  }
  const meta = readJson(metaPath);
  const summary = readJson(summaryPath);
  if (!['baseline', 'retest'].includes(meta.phase) || !safeName.test(meta.label ?? '')) {
    errors.push(diagnostic('SEGMENT_META', path.basename(segment), 'phase or label is invalid'));
  }
  const entries = [];
  for (const test of summary.tests ?? []) {
    const id = testId(test);
    if (!id || !/^WM-(?:TC|GAP)-\d{3}$/.test(id)) {
      errors.push(diagnostic('UNTAGGED_TEST', normalizeRelative(test.file ?? ''), 'cannot export an untagged test'));
      continue;
    }
    for (const attempt of test.attempts ?? []) {
      if (!attempt.video) {
        errors.push(diagnostic('MISSING_EVIDENCE', normalizeRelative(test.file ?? ''), `${id} retry ${attempt.retry} has no video`));
        continue;
      }
      const video = attachmentPath(segment, attempt.video, normalizeRelative(attempt.video), errors);
      const after = attempt.after ? attachmentPath(segment, attempt.after, normalizeRelative(attempt.after), errors) : null;
      if (!video) continue;
      const stem = `${id}__${meta.phase}-${meta.label}__retry${attempt.retry}`;
      const videoFile = `${stem}.webm`;
      entries.push({ source: video.source, file: videoFile, id, phase: meta.phase, label: meta.label, retry: attempt.retry, status: attempt.status, sourcePath: video.sourcePath });
      if (after) {
        entries.push({
          source: after.source,
          file: `${stem}__after.png`,
          id,
          phase: meta.phase,
          label: meta.label,
          retry: attempt.retry,
          status: attempt.status,
          sourcePath: after.sourcePath,
          after: true
        });
      }
    }
  }
  const names = new Set();
  for (const entry of entries) {
    if (names.has(entry.file)) errors.push(diagnostic('DUPLICATE_EXPORT', entry.file, 'multiple attempts map to the same export filename'));
    names.add(entry.file);
    if (!fs.existsSync(entry.source)) errors.push(diagnostic('MISSING_EVIDENCE', entry.sourcePath, `${entry.file} source does not exist`));
  }
  entries.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  const manifestPath = path.join(destination, 'manifest.json');
  const existing = entries.map((item) => path.join(destination, item.file)).filter((file) => fs.existsSync(file));
  if (fs.existsSync(manifestPath)) existing.push(manifestPath);
  if (existing.length) errors.push(diagnostic('FILE_EXISTS', path.basename(destination), `refusing to overwrite ${existing.map((file) => path.basename(file)).sort().join(', ')}`));
  if (errors.length) return { errors: sortedDiagnostics(errors), manifest: [] };

  fs.mkdirSync(destination, { recursive: true });
  for (const entry of entries) fs.copyFileSync(entry.source, path.join(destination, entry.file), fs.constants.COPYFILE_EXCL);
  const manifest = entries
    .filter((entry) => !entry.after)
    .map(({ file, id, phase, label, retry, status, sourcePath }) => ({
      file, id, phase, label, retry, status, sourcePath: normalizeRelative(sourcePath)
    }));
  writeJson(manifestPath, manifest);
  return { errors: [], manifest };
}
