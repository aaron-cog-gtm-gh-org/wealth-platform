#!/usr/bin/env node
// Compares the PV golden snapshot to /api/custody and classifies every diff against expected-divergences.json.
// usage: node scripts/legacy-parity/compare.mjs [--golden <dir>] [--api http://localhost:3001]
//        [--api-snapshot <file.json[.gz]>] [--out <dir>] [--expected <file>] [--tolerance 0.005] [--concurrency 8]
// Exit 0 = no unexplained diffs, 1 = unexplained diffs, 2 = usage/runtime error.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { DEFAULT_TOLERANCE, classify, diffSnapshots, renderMarkdown, summarize } from './lib/diff.mjs';
import { londonDate } from './lib/normalize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv) {
  const opts = { golden: path.join(HERE, 'golden'), api: 'http://localhost:3001', apiSnapshot: null,
    out: path.join(HERE, 'report'), expected: path.join(HERE, 'expected-divergences.json'),
    tolerance: DEFAULT_TOLERANCE, concurrency: 8 };
  const names = { 'api-snapshot': 'apiSnapshot' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = names[argv[i].replace(/^--/, '')] ?? argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (!(key in opts) || value === undefined) throw new Error(`unknown or incomplete option ${argv[i]}`);
    i += 1;
    opts[key] = key === 'tolerance' || key === 'concurrency' ? Number(value) : value;
  }
  opts.api = opts.api.replace(/\/$/, '');
  return opts;
}

export async function readSnapshot(file) {
  const buf = await readFile(file);
  return JSON.parse((file.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'));
}

async function pool(items, size, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next; next += 1; out[i] = await fn(items[i]); }
  }));
  return out;
}

/** Fetches the API into the golden's shape, querying exactly the keys the golden holds. */
export async function fetchApiSnapshot(golden, base, { concurrency = 8, fetchImpl = fetch } = {}) {
  const root = `${base}/api/custody`;
  const get = async (rel) => {
    const res = await fetchImpl(`${root}${rel}`);
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { status: res.status, body };
    if (res.status === 404 || res.status === 400) return { status: res.status, body, error: body.error ?? `HTTP ${res.status}` };
    throw new Error(`GET ${rel} -> HTTP ${res.status}`);
  };
  const ok = (r, rel) => { if (r.error) throw new Error(`GET ${rel} -> ${r.status} ${r.error}`); return r.body; };
  const e = encodeURIComponent;

  const archive = ok(await get('/archive/status'), '/archive/status');
  const statementDates = ok(await get('/statement-dates'), '/statement-dates').dates;
  const accountList = ok(await get('/accounts'), '/accounts').accounts;
  const accounts = await pool(accountList, concurrency, async (a) => ({
    acctId: a.acctId, acctNo: a.acctNo, clientName: a.clientName, safeCode: a.safeCode,
    statementDates: ok(await get(`/accounts/${a.acctId}/statements`), 'statements').dates,
  }));

  const clientSearch = await pool(golden.clientSearch, concurrency, async ({ q }) => ({
    q, clients: ok(await get(`/clients${q === '' ? '' : `?q=${e(q)}`}`), `/clients?q=${q}`).clients,
  }));
  const clientSummaries = await pool(golden.clientSummaries, concurrency, async ({ client }) => {
    const r = await get(`/clients/${client.clientId}`);
    return r.error ? null : { client: r.body.client, accounts: r.body.accounts };
  });

  const holdings = await pool(golden.holdings, concurrency, async ({ acctId, statementDate }) => {
    const r = await get(`/accounts/${acctId}/statements/${statementDate}`);
    if (r.error) return { acctId, statementDate, message: r.error, lines: [], totalGbp: null };
    return { acctId, statementDate, message: r.body.lines.length ? null : 'No holdings on statement.', lines: r.body.lines, totalGbp: r.body.lines.length ? r.body.totalGbp : null };
  });
  const { from, to } = golden.settlementsWindow;
  const settlements = await pool(golden.settlements, concurrency, async ({ acctId }) => {
    const r = await get(`/accounts/${acctId}/settlements?from=${from}&to=${to}`);
    return r.error ? null : { acctId, from, to, settlements: r.body.settlements };
  });
  const positionChecks = await pool(golden.positionChecks, concurrency, async ({ acctId, statementDate }) => {
    const r = await get(`/accounts/${acctId}/position-check/${statementDate}`);
    return r.error ? null : { acctId, statementDate, message: r.body.message ?? null,
      rows: r.body.rows.map((row) => ({ ...row, updatedAt: londonDate(row.updatedAt) })) };
  });
  const checkAll = await pool(golden.checkAll, concurrency, async ({ statementDate }) => {
    const r = await get(`/position-check/${statementDate}`);
    if (r.error) return null;
    return { statementDate, accounts: r.body.accounts.map((a) => ({
      acctId: a.acctId, acctNo: a.acctNo, clientName: a.clientName,
      breaks: a.previousStatementDate === null ? null : a.breaks,
      hasPreviousStatement: a.previousStatementDate !== null,
    })) };
  });

  const present = (xs) => xs.filter(Boolean);
  return { format: golden.format, archive, statementDates, accounts, clientSearch,
    clientSummaries: present(clientSummaries), holdings, settlements: present(settlements),
    positionChecks: present(positionChecks), checkAll: present(checkAll) };
}

export function buildReport({ golden, api, expected, goldenPath, apiLabel, tolerance }) {
  const result = classify(diffSnapshots(golden, api, { tolerance }), expected);
  return {
    golden: goldenPath, goldenFormat: golden.format, api: apiLabel, generatedAt: new Date().toISOString(),
    tolerance, summary: summarize(result), notObserved: result.notObserved, diffs: result.classified,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const goldenFile = opts.golden.endsWith('.gz') || opts.golden.endsWith('.json')
    ? opts.golden : path.join(opts.golden, 'pv-golden.json.gz');
  const golden = await readSnapshot(goldenFile);
  const expected = JSON.parse(await readFile(opts.expected, 'utf8'));
  const api = opts.apiSnapshot ? await readSnapshot(opts.apiSnapshot)
    : await fetchApiSnapshot(golden, opts.api, { concurrency: opts.concurrency });
  const report = buildReport({ golden, api, expected, goldenPath: path.relative(process.cwd(), goldenFile),
    apiLabel: opts.apiSnapshot ?? opts.api, tolerance: opts.tolerance });
  await mkdir(opts.out, { recursive: true });
  await writeFile(path.join(opts.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(opts.out, 'report.md'), renderMarkdown(report, expected));
  const s = report.summary;
  console.log(`parity: ${s.totalDiffs} diffs, ${s.expectedDiffs} expected (${Object.entries(s.byDivergence).map(([k, v]) => `${k}=${v}`).join(', ')}), ${s.unexplainedDiffs} unexplained, ${s.notObservedRules} expected rules not observed`);
  console.log(`report: ${path.join(opts.out, 'report.md')}`);
  process.exitCode = s.unexplainedDiffs === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(2); });
}
