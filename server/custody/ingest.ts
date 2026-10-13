// Idempotent archive ingest (FR-001..FR-004): one custody_messages row per archive file, plus the
// derived statement / confirmation rows. Re-running with identical content is a no-op; a changed
// file at an already-ingested path is an error. Effective statements, cancellations and account
// links are recomputed over the whole store after every run (rules.ts, corrected mode).
//   npm run custody:ingest -- [--archive <dir>]   (default data/legacy-pv/archive or $LEGACY_PV_DIR/archive)
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import oracledb from 'oracledb';
import { dbConfig } from '../db/pool';
import { listArchive, parseArchiveText, readArchiveBytes, sha256, type ArchiveEntry, type ParsedArchiveFile } from './archive.js';
import { applyCancellations, selectEffectiveStatement, type ConfirmationFact } from './rules.js';

export interface IngestSummary {
  runId: number;
  archive: string;
  filesSeen: number;
  filesNew: number;
  filesDuplicate: number;
  parseErrors: number;
  /** Totals in the store after the run. */
  statements: number;
  confirmations: number;
  unmatchedCancellations: number;
  errors: { sourceFile: string; error: string }[];
}

export class IngestConflictError extends Error {}

export const defaultArchiveDir = () => resolve(process.env.LEGACY_PV_DIR ? `${process.env.LEGACY_PV_DIR}/archive` : 'data/legacy-pv/archive');

type Conn = oracledb.Connection;
const one = async (conn: Conn, sql: string, binds: oracledb.BindParameters = {}) =>
  Number(Object.values(((await conn.execute<Record<string, unknown>>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows ?? [])[0] ?? { v: 0 })[0] ?? 0);
const nextId = async (conn: Conn, table: string, col: string) => (await one(conn, `SELECT NVL(MAX(${col}), 0) AS v FROM ${table}`)) + 1;

/** Decimal strings are bound as text; pin the session so '.' is the decimal separator. */
export async function prepareCustodySession(conn: Conn) {
  await conn.execute(`ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,'`);
}

const D = (bind: string) => `TO_DATE(:${bind}, 'YYYY-MM-DD')`;

async function insertMessage(conn: Conn, id: number, runId: number, e: ArchiveEntry, sha: string, text: string, p: ParsedArchiveFile) {
  const s = p.kind === 'statement' ? p.statement : null;
  const c = p.kind === 'confirmation' ? p.confirmation : null;
  const mtType = s ? 535 : c ? c.mtType : Number(/^MT(\d{3})/.exec(e.fileName)?.[1] ?? (e.family === 'MT535' ? 535 : 545));
  await conn.execute(
    `INSERT INTO custody_messages (message_id, mt_type, sender_bic, seme, function_code, safe_no, business_date, source_folder,
       source_file, file_seq, content_sha256, raw_text, run_id, parse_status, parse_error)
     VALUES (:id, :mt, :bic, :seme, :fn, :safe, ${D('bd')}, :folder, :b_file, :seq, :sha, :b_raw, :run, :status, :err)`,
    {
      id, mt: mtType, bic: (s ?? c)?.senderBic ?? null, seme: (s ?? c)?.seme ?? null, fn: (s ?? c)?.functionCode ?? null,
      safe: (s ?? c)?.safeNo ?? null, bd: s?.statementDate ?? e.businessDate, folder: e.sourceFolder, b_file: e.sourceFile,
      seq: e.fileSeq, sha, b_raw: { val: text, type: oracledb.DB_TYPE_CLOB }, run: runId,
      status: p.kind === 'error' ? 'ERROR' : 'OK', err: p.kind === 'error' ? p.error.slice(0, 4000) : null,
    },
  );
}

async function ensureInstruments(conn: Conn, items: { isin: string; desc: string | null }[], knownInstruments: Set<string>) {
  const seen = new Map<string, string>();
  for (const i of items) if (!seen.has(i.isin)) seen.set(i.isin, i.desc ?? `Unknown instrument ${i.isin}`);
  const missing = [...seen].filter(([isin]) => !knownInstruments.has(isin));
  if (!missing.length) return [];
  await conn.executeMany(
    `MERGE INTO custody_instruments t USING (SELECT :isin AS isin, :name AS name FROM dual) s ON (t.isin = s.isin)
     WHEN NOT MATCHED THEN INSERT (isin, name, source) VALUES (s.isin, SUBSTR(s.name, 1, 120), 'CUSTODIAN')`,
    missing.map(([isin, name]) => ({ isin, name })),
  );
  return missing.map(([isin]) => isin);
}

async function insertDerived(
  conn: Conn,
  messageId: number,
  p: ParsedArchiveFile,
  ids: { statement: number; confirmation: number },
  knownInstruments: Set<string>,
): Promise<string[]> {
  const newInstruments: string[] = [];
  if (p.kind === 'statement') {
    const s = p.statement;
    const statementId = ids.statement;
    await conn.execute(
      `INSERT INTO custody_statements (statement_id, message_id, safe_no, statement_date, function_code, file_seq, is_empty)
       VALUES (:id, :msg, :safe, ${D('d')}, :fn, :seq, :empty)`,
      { id: statementId, msg: messageId, safe: s.safeNo, d: s.statementDate, fn: s.functionCode, seq: p.entry.fileSeq, empty: s.isEmpty ? 1 : 0 },
    );
    if (s.lines.length) {
      await conn.executeMany(
        `INSERT INTO custody_statement_lines (statement_id, line_no, isin, custodian_desc, qty, qty_type, price, price_type, ccy,
           market_value, reporting_value, subsafe)
         VALUES (:sid, :ln, :isin, :descr, TO_NUMBER(:qty), :qt, TO_NUMBER(:price), :pt, :ccy, TO_NUMBER(:mv), TO_NUMBER(:rv), :sub)`,
        s.lines.map(l => ({
          sid: statementId, ln: l.lineNo, isin: l.isin, descr: l.custodianDesc, qty: l.qty, qt: l.qtyType, price: l.price,
          pt: l.priceType, ccy: l.ccy, mv: l.marketValue, rv: l.reportingValue, sub: l.subsafe,
        })),
      );
      newInstruments.push(...await ensureInstruments(conn, s.lines.map(l => ({ isin: l.isin, desc: l.custodianDesc })), knownInstruments));
    }
  } else if (p.kind === 'confirmation') {
    const c = p.confirmation;
    await conn.execute(
      `INSERT INTO custody_confirmations (confirmation_id, message_id, safe_no, mt_type, direction, seme, prev_ref, function_code,
         trade_date, settle_date, isin, qty, qty_type, amount, amount_ccy)
       VALUES (:id, :msg, :safe, :mt, :dir, :seme, :prev, :fn, ${D('td')}, ${D('sd')}, :isin, TO_NUMBER(:qty), :qt, TO_NUMBER(:amt), :ccy)`,
      {
        id: ids.confirmation, msg: messageId, safe: c.safeNo, mt: c.mtType,
        dir: c.direction, seme: c.seme, prev: c.prevRef, fn: c.functionCode, td: c.tradeDate, sd: c.settleDate, isin: c.isin,
        qty: c.qty, qt: c.qtyType, amt: c.amount, ccy: c.amountCcy,
      },
    );
    newInstruments.push(...await ensureInstruments(conn, [{ isin: c.isin, desc: c.custodianDesc }], knownInstruments));
  }
  return newInstruments;
}

/** Recompute derived flags over the whole store (corrected rules), then link rows to accounts by safe number. */
export async function recomputeDerived(conn: Conn): Promise<{ unmatchedCancellations: number }> {
  const stmts = (await conn.execute<{ ID: number; SAFE_NO: number; D: string; FN: string; SEQ: number }>(
    `SELECT statement_id AS id, safe_no, TO_CHAR(statement_date, 'YYYY-MM-DD') AS d, function_code AS fn, file_seq AS seq FROM custody_statements`,
    [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows ?? [];
  const groups = new Map<string, { id: number; functionCode: string; fileSeq: number }[]>();
  for (const r of stmts) {
    const k = `${r.SAFE_NO}|${r.D}`;
    const g = groups.get(k) ?? [];
    g.push({ id: r.ID, functionCode: r.FN, fileSeq: r.SEQ });
    groups.set(k, g);
  }
  const effective = new Set([...groups.values()].map(g => selectEffectiveStatement(g, 'corrected')!.id));
  await conn.execute(`UPDATE custody_statements SET is_effective = 0`);
  if (effective.size) await conn.executeMany(`UPDATE custody_statements SET is_effective = 1 WHERE statement_id = :id`, [...effective].map(id => ({ id })));

  const confs = (await conn.execute<{ ID: number; SAFE_NO: number; SEME: string; PREV: string | null; FN: string; D: string; ISIN: string; DIR: string }>(
    `SELECT confirmation_id AS id, safe_no, seme, prev_ref AS prev, function_code AS fn, TO_CHAR(settle_date, 'YYYY-MM-DD') AS d,
            isin, direction AS dir FROM custody_confirmations`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows ?? [];
  const facts: ConfirmationFact[] = confs.map(r => ({
    ref: String(r.ID), folder: '', safeRaw: String(r.SAFE_NO), safeNo: r.SAFE_NO, seme: r.SEME, prevRef: r.PREV,
    functionCode: r.FN as 'NEWM' | 'CANC', settleDate: r.D, isin: r.ISIN, qty: '0', qtyType: 'UNIT', direction: r.DIR as 'RECEIVE', amountRaw: null,
  }));
  const { cancelledBy, unmatched } = applyCancellations(facts, 'corrected');
  await conn.execute(`UPDATE custody_confirmations SET cancelled_by = NULL`);
  if (cancelledBy.size) {
    await conn.executeMany(`UPDATE custody_confirmations SET cancelled_by = :b_by WHERE confirmation_id = :id`,
      [...cancelledBy].map(([id, by]) => ({ id: Number(id), b_by: Number(by) })));
  }
  for (const t of ['custody_statements', 'custody_confirmations']) {
    await conn.execute(`UPDATE ${t} x SET account_id = (SELECT a.account_id FROM custody_accounts a WHERE a.safe_no = x.safe_no)`);
  }
  await conn.commit();
  return { unmatchedCancellations: unmatched.length };
}

/** Ingest every file under `archiveDir`. One transaction per new file; duplicates are skipped. */
export async function ingestArchive(conn: Conn, archiveDir = defaultArchiveDir(), opts: { triggeredBy?: string; log?: (s: string) => void } = {}): Promise<IngestSummary> {
  await prepareCustodySession(conn);
  const entries = listArchive(archiveDir);
  if (!entries.length) throw new Error(`No archive files found under ${archiveDir}`);
  const runId = await nextId(conn, 'custody_ingest_runs', 'run_id');
  await conn.execute(`INSERT INTO custody_ingest_runs (run_id, started_at, triggered_by) VALUES (:id, SYSTIMESTAMP, :b_by)`,
    { id: runId, b_by: opts.triggeredBy ?? 'cli' });
  await conn.commit();

  const known = new Map<string, string>();
  for (const r of (await conn.execute<{ F: string; H: string }>(`SELECT source_file AS f, content_sha256 AS h FROM custody_messages`, [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows ?? []) known.set(r.F, r.H);

  let filesNew = 0, filesDuplicate = 0, parseErrors = 0;
  const errors: IngestSummary['errors'] = [];
  const ids = {
    statement: await nextId(conn, 'custody_statements', 'statement_id'),
    confirmation: await nextId(conn, 'custody_confirmations', 'confirmation_id'),
  };
  const knownInstruments = new Set((await conn.execute<{ ISIN: string }>(
    `SELECT isin FROM custody_instruments`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
  )).rows?.map(r => r.ISIN) ?? []);
  let messageId = await nextId(conn, 'custody_messages', 'message_id');
  for (const e of entries) {
    const bytes = readArchiveBytes(archiveDir, e);
    const sha = sha256(bytes);
    const prior = known.get(e.sourceFile);
    if (prior === sha) { filesDuplicate++; continue; }
    if (prior) throw new IngestConflictError(`${e.sourceFile} was already ingested with different content (sha256 ${prior} ≠ ${sha})`);
    const text = bytes.toString('utf8');
    const parsed = parseArchiveText(e, text);
    let newInstruments: string[] = [];
    try {
      await insertMessage(conn, messageId, runId, e, sha, text, parsed);
      newInstruments = await insertDerived(conn, messageId, parsed, ids, knownInstruments);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw new Error(`Ingest failed for ${e.sourceFile}: ${(err as Error).message}`);
    }
    known.set(e.sourceFile, sha);
    for (const isin of newInstruments) knownInstruments.add(isin);
    messageId++;
    if (parsed.kind === 'statement') ids.statement++;
    if (parsed.kind === 'confirmation') ids.confirmation++;
    filesNew++;
    if (parsed.kind === 'error') { parseErrors++; errors.push({ sourceFile: e.sourceFile, error: parsed.error }); }
    if (opts.log && filesNew % 1000 === 0) opts.log(`  ${filesNew} new files…`);
  }

  const recomputeStarted = performance.now();
  const { unmatchedCancellations } = await recomputeDerived(conn);
  console.log(`recomputeDerived: ${(performance.now() - recomputeStarted).toFixed(0)} ms`);
  await conn.execute(
    `UPDATE custody_ingest_runs SET finished_at = SYSTIMESTAMP, files_seen = :seen, files_new = :nw, files_duplicate = :dup,
       parse_errors = :pe WHERE run_id = :id`,
    { seen: entries.length, nw: filesNew, dup: filesDuplicate, pe: parseErrors, id: runId });
  await conn.commit();
  return {
    runId, archive: archiveDir, filesSeen: entries.length, filesNew, filesDuplicate, parseErrors,
    statements: await one(conn, `SELECT COUNT(*) AS v FROM custody_statements`),
    confirmations: await one(conn, `SELECT COUNT(*) AS v FROM custody_confirmations`),
    unmatchedCancellations, errors,
  };
}

export function formatIngestSummary(s: IngestSummary): string {
  return [
    `custody ingest run ${s.runId} (${s.archive})`,
    `  files seen        ${s.filesSeen}`,
    `  files new         ${s.filesNew}`,
    `  files duplicate   ${s.filesDuplicate}`,
    `  parse errors      ${s.parseErrors}`,
    `  statements        ${s.statements}`,
    `  confirmations     ${s.confirmations}`,
    `  unmatched CANC    ${s.unmatchedCancellations}`,
    ...s.errors.slice(0, 20).map(e => `  ! ${e.sourceFile}: ${e.error}`),
  ].join('\n');
}

const argValue = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  (async () => {
    const conn = await oracledb.getConnection(dbConfig);
    try {
      const summary = await ingestArchive(conn, resolve(argValue('--archive') ?? defaultArchiveDir()), { log: console.log });
      console.log(formatIngestSummary(summary));
      if (summary.parseErrors) process.exitCode = 2;
    } finally {
      await conn.close();
    }
  })().catch(err => { console.error(err.message); process.exit(1); });
}
