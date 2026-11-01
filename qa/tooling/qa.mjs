#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { caseSuccessMessage, validateCases } from './lib/cases.mjs';
import { diagnostic, loadAreas, parseFlags, printDiagnostics, readJson, relativeDisplay, repoRoot } from './lib/common.mjs';
import { exportVideos } from './lib/export-videos.mjs';
import { normalizeSegment } from './lib/normalize.mjs';
import { buildReport } from './lib/report.mjs';
import { runSegment } from './lib/run.mjs';
import { packSegment, unpackSegment } from './lib/segments.mjs';
import { parsePlaywrightList, suiteSuccessMessage, validateSuite } from './lib/suite.mjs';
import { readUploads, writeStructured } from './lib/structured.mjs';
import { bundleRun } from './lib/bundle.mjs';
import { buildDemoVideo } from './lib/demo-video.mjs';

const require = createRequire(import.meta.url);
const HELP = `Usage: node qa/tooling/qa.mjs <command> [options]

Commands:
  validate-cases [--cases FILE]                         Validate the QA workbook
  validate-suite [--cases FILE] [--list FILE] [--area SLUG ...] [--feature SLUG_OR_LABEL ...]
                                                        Validate exact case and gap test coverage
  run --run-id ID --phase baseline|retest --label LABEL [--base-sha SHA] [--fix-pr URL] [--skip-preflight] [-- PW_ARGS...]
                                                        Preflight, run Playwright, and normalize results
  normalize <segmentDir>                                Normalize a Playwright segment
  report --run-id ID [--artifacts DIR] [--cases FILE] [--generated-at ISO]
                                                        Collect segment evidence into reports
  structured --run-id ID [--uploads FILE]               Write and print structured-output.json
  export-videos --segment DIR --out DIR                  Export attempt recordings for attachment upload
  demo-video --run-id ID [--artifacts DIR]               Compose all attempts with title cards into full-run.mp4
  pack-segment --segment DIR --out FILE.zip              Package a segment for attachment transport
  unpack-segment --zip FILE --into DIR                   Safely extract a segment ZIP
  bundle --run-id ID [--artifacts DIR] [--out FILE] [--allow-errors]
                                                        Create a deterministic evidence ZIP
  --help                                                Show this help
`;

function caseFile(flags) {
  return path.resolve(repoRoot, String(flags.cases ?? 'qa/cases.json'));
}

function outputResult(errors, warnings) {
  printDiagnostics(errors, warnings);
  return errors.length ? 2 : 0;
}

function loadWorkbook(file) {
  return readJson(file);
}

function playwrightList(file) {
  if (file) return readJson(path.resolve(file));
  const cli = require.resolve('@playwright/test/cli');
  const result = spawnSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  return parsePlaywrightList(result.stdout, result.status);
}

export async function main(argv = process.argv.slice(2)) {
  const [command, ...commandArgs] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  const { flags, rest } = parseFlags(commandArgs);

  if (command === 'validate-cases') {
    const file = caseFile(flags);
    try {
      const workbook = loadWorkbook(file);
      const result = validateCases(workbook, { file, cwd: repoRoot });
      if (!result.errors.length) process.stdout.write(`${caseSuccessMessage(loadAreas())}\n`);
      return outputResult(result.errors, result.warnings);
    } catch (error) {
      return outputResult([diagnostic('INVALID_WORKBOOK', relativeDisplay(file, repoRoot), (error).message.replace(repoRoot, '.'))], []);
    }
  }

  if (command === 'validate-suite') {
    const file = caseFile(flags);
    try {
      const workbook = loadWorkbook(file);
      const list = playwrightList(flags.list);
      const areas = [flags.area, flags.feature].flatMap((value) => value === undefined ? [] : Array.isArray(value) ? value : [value]);
      const result = await validateSuite({
        workbook,
        list,
        config: loadAreas(),
        root: repoRoot,
        casesFile: relativeDisplay(file, repoRoot),
        areas
      });
      if (!result.errors.length) process.stdout.write(`${suiteSuccessMessage(result)}\n`);
      return outputResult(result.errors, result.warnings);
    } catch (error) {
      return outputResult([diagnostic('SUITE_VALIDATION', 'qa/tests', (error).message.replace(repoRoot, '.'))], []);
    }
  }

  if (command === 'run') {
    const playwrightArgs = rest;
    const result = await runSegment({
      runId: flags['run-id'],
      phase: flags.phase,
      label: flags.label,
      baseSha: flags['base-sha'] || null,
      fixPr: flags['fix-pr'] || null,
      args: playwrightArgs,
      skipPreflight: Boolean(flags['skip-preflight']),
      cwd: repoRoot
    });
    if (result.errors.length) return outputResult(result.errors, result.warnings ?? []);
    if (result.warnings?.length) printDiagnostics([], result.warnings);
    return result.exitCode;
  }

  if (command === 'normalize') {
    const segment = flags.segment ?? rest[0];
    if (!segment) return outputResult([diagnostic('MISSING_ARGUMENT', '.', 'normalize requires a segment directory')], []);
    const result = normalizeSegment(path.resolve(segment), { cwd: repoRoot });
    if (result.summary) process.stdout.write(`OK normalized ${result.summary.tests.length} tests\n`);
    return outputResult(result.errors, []);
  }

  if (command === 'report') {
    if (!flags['run-id']) return outputResult([diagnostic('MISSING_ARGUMENT', '.', 'report requires --run-id')], []);
    const result = buildReport(flags['run-id'], {
      artifacts: flags.artifacts ?? 'qa-artifacts',
      casesFile: flags.cases ?? 'qa/cases.json',
      generatedAt: flags['generated-at'],
      root: repoRoot
    });
    if (!result.report) return outputResult(result.errors, result.warnings);
    process.stdout.write(`Wrote ${flags['run-id']}/report.json, report.md, index.html\n`);
    return outputResult(result.errors, result.warnings);
  }

  if (command === 'structured') {
    if (!flags['run-id']) return outputResult([diagnostic('MISSING_ARGUMENT', '.', 'structured requires --run-id')], []);
    const result = buildReport(flags['run-id'], {
      artifacts: flags.artifacts ?? 'qa-artifacts',
      casesFile: flags.cases ?? 'qa/cases.json',
      generatedAt: flags['generated-at'],
      root: repoRoot
    });
    if (!result.report) return outputResult(result.errors, result.warnings);
    const uploads = readUploads(flags.uploads ? path.resolve(flags.uploads) : null);
    const runDir = path.resolve(repoRoot, flags.artifacts ?? 'qa-artifacts', flags['run-id']);
    const projection = writeStructured(runDir, result.report, uploads);
    process.stdout.write(`${JSON.stringify(projection)}\n`);
    return outputResult(result.errors, result.warnings);
  }

  if (command === 'export-videos') {
    if (!flags.segment || !flags.out) {
      return outputResult([diagnostic('MISSING_ARGUMENT', '.', 'export-videos requires --segment and --out')], []);
    }
    const result = exportVideos(path.resolve(flags.segment), path.resolve(flags.out));
    if (!result.errors.length) process.stdout.write(`Exported ${result.manifest.length} video attempts\n`);
    return outputResult(result.errors, []);
  }

  if (command === 'demo-video') {
    if (!flags['run-id']) return outputResult([diagnostic('MISSING_ARGUMENT', '.', 'demo-video requires --run-id')], []);
    const runDir = path.resolve(repoRoot, flags.artifacts ?? 'qa-artifacts', flags['run-id']);
    const result = buildDemoVideo(runDir);
    process.stdout.write(`Wrote ${relativeDisplay(result.output, repoRoot)} (${result.clips} attempts, ${result.duration}s)\n`);
    return 0;
  }

  if (command === 'pack-segment') {
    if (!flags.segment || !flags.out) {
      return outputResult([diagnostic('MISSING_ARGUMENT', '.', 'pack-segment requires --segment and --out')], []);
    }
    const result = await packSegment(path.resolve(flags.segment), path.resolve(flags.out));
    if (!result.errors.length) {
      process.stdout.write(`Packed ${result.entryCount} entries (${result.size} bytes) to ${relativeDisplay(result.zipPath, repoRoot)}\n`);
    }
    return outputResult(result.errors, []);
  }

  if (command === 'unpack-segment') {
    if (!flags.zip || !flags.into) {
      return outputResult([diagnostic('MISSING_ARGUMENT', '.', 'unpack-segment requires --zip and --into')], []);
    }
    const result = unpackSegment(path.resolve(flags.zip), path.resolve(flags.into));
    if (!result.errors.length) {
      process.stdout.write(`Unpacked ${result.entryCount} entries to ${relativeDisplay(result.targetDir, repoRoot)}\n`);
    }
    return outputResult(result.errors, []);
  }

  if (command === 'bundle') {
    if (!flags['run-id']) return outputResult([diagnostic('MISSING_ARGUMENT', '.', 'bundle requires --run-id')], []);
    const result = await bundleRun(flags['run-id'], {
      artifacts: flags.artifacts ?? 'qa-artifacts',
      out: flags.out,
      allowErrors: Boolean(flags['allow-errors']),
      casesFile: flags.cases ?? 'qa/cases.json',
      generatedAt: flags['generated-at'],
      root: repoRoot
    });
    if (result.zipPath) process.stdout.write(`Wrote ${relativeDisplay(result.zipPath, repoRoot)} (${result.entryCount} entries, ${result.size} bytes)\n`);
    return outputResult(result.errors, result.warnings);
  }

  process.stderr.write(`Unknown command "${command}"\n${HELP}`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    const message = String(error?.message ?? error).replace(repoRoot, '.').split(/\r?\n/, 1)[0];
    printDiagnostics([diagnostic('CLI_ERROR', '.', message)]);
    process.exitCode = 2;
  });
}
