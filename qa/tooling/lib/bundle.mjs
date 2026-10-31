import fs from 'node:fs';
import path from 'node:path';
import { normalizeRelative, walkFiles } from './common.mjs';
import { buildReport } from './report.mjs';
import { createZip } from './zip.mjs';

export async function bundleRun(runId, { artifacts = 'qa-artifacts', out, allowErrors = false, casesFile, generatedAt, root = process.cwd() } = {}) {
  const artifactsDir = path.resolve(root, artifacts);
  const runDir = path.join(artifactsDir, runId);
  const built = buildReport(runId, { artifacts: artifactsDir, casesFile, generatedAt, root });
  if (built.errors.length && !allowErrors) return { ...built, zipPath: null, entryCount: 0, size: 0 };

  const files = [];
  for (const name of ['index.html', 'report.json', 'report.md', 'fixes.json']) {
    const fullPath = path.join(runDir, name);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) files.push(fullPath);
  }
  const allFiles = await walkFiles(runDir, () => true);
  for (const file of allFiles) {
    const relative = normalizeRelative(path.relative(runDir, file));
    const segmentFile = relative.startsWith('baseline/') || relative.startsWith('retest/');
    if (segmentFile && (
      relative.endsWith('/run-meta.json') ||
      relative.endsWith('/summary.json') ||
      relative.endsWith('/results.json') ||
      relative.includes('/test-results/') ||
      relative.includes('/html/')
    )) files.push(file);
  }
  const uniqueFiles = [...new Set(files)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const entries = uniqueFiles.map((file) => ({
    name: `${runId}/${normalizeRelative(path.relative(runDir, file))}`,
    data: fs.readFileSync(file)
  }));
  const bytes = createZip(entries);
  const output = path.resolve(root, out ?? path.join(artifacts, `${runId}-evidence.zip`));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes);
  return { ...built, zipPath: output, entryCount: entries.length, size: bytes.length };
}
