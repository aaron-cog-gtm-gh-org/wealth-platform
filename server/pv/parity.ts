// Spec 011 decommission parity runner (npm run parity): TS port + PostgreSQL reference data vs the legacy oracle.
// Writes parity/report/parity-report.{json,md}; exits 1 on any difference not listed in parity/divergences.json.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Decimal } from '../../src/domain/decimal';
import { MIN_DATE } from '../../src/domain/date';
import { buildArchiveIndex } from '../../src/domain/archive/archive-index';
import { getSettlements, toAmount } from '../../src/domain/archive/settlements';
import { getStatement, getStatementDates, holdingLines } from '../../src/domain/positions/position-builder';
import { checkAll, runPositionCheck, type PositionCheckDeps } from '../../src/domain/positions/position-check';
import type { SettlementConfirm } from '../../src/domain/swift/models';
import { closePool } from '../db/pool';
import { DEFAULT_ARCHIVE_ROOT, fsArchiveSource } from './archive-fs';
import { getInstruments, pgReconNotes } from './context';
import { GOLDEN_PATH, loadGolden, MANIFEST_PATH, type Golden } from './legacy-golden';

const ROOT = resolve(dirname(GOLDEN_PATH), '../..');
const REPORT_DIR = join(ROOT, 'parity/report');
const DIVERGENCES = join(ROOT, 'parity/divergences.json');
const DEC = new Set(['qty', 'price', 'mktVal', 'mktValGbp', 'prevQty', 'netSettled', 'expected', 'stmtQty', 'diff', 'amount']);
const num = (v: unknown) => (v === null || v === undefined ? v : Decimal.parse(String(v)).toString());
const norm = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, DEC.has(k) ? num(v) : v]));

interface Divergence { id: string; check: string; key: string; reason: string }
interface Check { id: string; legacy: string; compared: number; mismatches: { key: string; legacy: unknown; ported: unknown }[]; accepted: string[] }

const divergences: Divergence[] = existsSync(DIVERGENCES) ? JSON.parse(readFileSync(DIVERGENCES, 'utf8')).divergences : [];
const checks: Check[] = [];
function check(id: string, legacy: string) {
  const c: Check = { id, legacy, compared: 0, mismatches: [], accepted: [] };
  checks.push(c);
  return (key: string, legacyValue: unknown, ported: unknown) => {
    c.compared++;
    if (isDeepStrictEqual(legacyValue, ported)) return;
    const d = divergences.find(x => x.check === id && x.key === key);
    if (d) c.accepted.push(`${key} (${d.id})`);
    else c.mismatches.push({ key, legacy: legacyValue, ported });
  };
}

const confirmView = (c: SettlementConfirm) => ({
  folder: c.folder, fileName: c.filePath?.split('/').pop(), mtType: c.mtType, seme: c.seme, prev: c.prev, function: c.function,
  tradeDate: c.tradeDate, settleDate: c.settleDate, isin: c.isin, qty: num(c.qty), custAcct: c.custAcct, amountRaw: c.amountRaw,
  ccy: c.ccy, direction: c.direction, amount: c.amountRaw === null ? '0' : toAmount(c.amountRaw).toString(),
});
const CONFIRM_KEYS = ['folder', 'fileName', 'mtType', 'seme', 'prev', 'function', 'tradeDate', 'settleDate', 'isin', 'qty',
  'custAcct', 'amountRaw', 'ccy', 'direction', 'amount'];
const goldenConfirm = (g: Golden) => norm(Object.fromEntries(CONFIRM_KEYS.map(k => [k, g[k]])));

async function main() {
  const golden = loadGolden();
  const goldenSha = createHash('sha256').update(readFileSync(GOLDEN_PATH)).digest('hex');

  const manifest = check('archive-manifest', 'legacy archive/ (byte-for-byte)');
  for (const line of readFileSync(MANIFEST_PATH, 'utf8').trim().split('\n')) {
    const [sha, path] = line.split(/\s+\*?/);
    const file = join(DEFAULT_ARCHIVE_ROOT, '..', path);
    manifest(path, sha, existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null);
  }

  const idx = buildArchiveIndex(fsArchiveSource());
  const g = golden.archiveIndex;
  check('archive-index', 'PV.Core.ArchiveIndex.Build')('counts',
    [g.mt535Count, g.mt54xCount, g.parseErrors, g.statementAccountCount, g.confirmFolderCount],
    [idx.mt535Count, idx.mt54xCount, idx.parseErrors, idx.statements.size, idx.confirmFolders.size]);
  const sel = check('statement-selection', 'PV.Core.PositionBuilder.GetStatement (Q8)');
  for (const k of g.statementKeys) for (const d of k.dates) sel(`${k.key} ${d.date}`, d.selectedFile, getStatement(idx, k.key, d.date)?.fileName ?? null);

  const deps: PositionCheckDeps = { index: idx, instruments: await getInstruments(), notes: pgReconNotes };
  const dates = check('statement-dates', 'PV.Core.PositionBuilder.GetStatementDates');
  const holdings = check('holdings', 'PV.Core.PositionBuilder + InstrumentData (Holdings.aspx)');
  const runs = check('position-check', 'PV.Core.PositionCheck.Run + PV.Data.ReconNoteData (PostgreSQL pv.recon_note)');
  const settle = check('settlements', 'PV.Core.SettlementReader.GetSettlements + ToAmount (Settlements.aspx)');
  for (const a of golden.accounts) {
    dates(a.acctNo, a.statementDates, getStatementDates(idx, a.safeCode));
    for (const pc of a.positionChecks) {
      const key = `${a.acctNo} ${pc.stmtDate}`;
      const st = getStatement(idx, a.safeCode, pc.stmtDate);
      holdings(key, pc.statement.lines.map(norm), st ? holdingLines(deps.instruments, st).map(h => norm({ ...h })) : null);
      const r = await runPositionCheck(deps, { acctId: a.acctId, safeCode: a.safeCode }, pc.stmtDate);
      runs(key, { prevStmtDate: pc.prevStmtDate, noPrevMessage: pc.noPrevMessage, statementFile: pc.statementFile, rows: pc.rows.map(norm) },
        { prevStmtDate: r.prevStmtDate, noPrevMessage: r.noPrevMessage, statementFile: r.statement?.fileName ?? null, rows: r.rows.map(x => norm({ ...x })) });
    }
    for (const [label, s] of [['90d', a.settlementsDefault90d], ['full', a.settlementsFullRange]] as const)
      settle(`${a.acctNo} ${label}`, s.items.map(goldenConfirm), getSettlements(idx, s.custAcct, s.from ?? MIN_DATE, s.to).map(confirmView));
  }
  const all = check('check-all', 'PositionCheck.aspx btnAll_Click');
  const accounts = golden.accounts.map((a: Golden) => ({ acctId: a.acctId, safeCode: a.safeCode, acctNo: a.acctNo, clientName: a.clientName }));
  for (const day of golden.checkAll) all(day.stmtDate, day.rows, await checkAll(deps, accounts, day.stmtDate));
  await closePool();

  const failed = checks.filter(c => c.mismatches.length);
  const report = {
    format: 'pv-parity-report/1', generatedAt: new Date().toISOString(), result: failed.length ? 'FAIL' : 'PASS',
    golden: { path: 'parity/legacy-golden/legacy-golden.json.gz', sha256: goldenSha, legacyCommit: golden.meta?.legacyCommit ?? null, summary: golden.summary },
    divergencesDeclared: divergences.map(d => d.id),
    checks: checks.map(c => ({ ...c, mismatchCount: c.mismatches.length, mismatches: c.mismatches.slice(0, 20) })),
  };
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, 'parity-report.json'), JSON.stringify(report, null, 2) + '\n');
  const md = [
    `# Portfolio Viewer decommission parity report`, '',
    `Result: **${report.result}**. Golden (gzip) SHA-256 \`${goldenSha}\`. Declared divergences: ${divergences.length ? divergences.map(d => d.id).join(', ') : 'none'}.`, '',
    '| Check | Legacy behaviour | Compared | Mismatches | Accepted divergences |', '| --- | --- | ---: | ---: | ---: |',
    ...checks.map(c => `| ${c.id} | ${c.legacy} | ${c.compared} | ${c.mismatches.length} | ${c.accepted.length} |`), '',
    `Legacy oracle summary: ${golden.summary.accountStatementDatesChecked} PositionCheck runs, ${golden.summary.totalDiffRows} break rows ` +
      `(${Object.entries(golden.summary.diffRowsByStatus).map(([k, v]) => `${k} ${v}`).join(', ')}), ${golden.summary.holdingLines} holdings lines, ` +
      `${golden.summary.settlementsDefault90dItems} + ${golden.summary.settlementsFullRangeItems} settlements.`, '',
  ].join('\n');
  writeFileSync(join(REPORT_DIR, 'parity-report.md'), md);
  console.log(md);
  for (const c of failed) console.error(`${c.id}: first mismatch`, JSON.stringify(c.mismatches[0]).slice(0, 2000));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(e => { console.error(e); process.exit(2); });
