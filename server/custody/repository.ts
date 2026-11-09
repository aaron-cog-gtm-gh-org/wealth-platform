import type { PoolClient } from 'pg';
import { getPool, withTransaction } from '../db/pool';
import { notFound, badRequest } from '../workflows/errors';
import { holdings, statementDates as datesFor, statementsByDate, type StatementFile } from './domain/holdings';
import { instrumentName, type InstrumentNames } from './domain/instruments';
import { runPositionCheck, type ReconNote } from './domain/position-check';
import { activeConfirmations, defaultSettlementWindow, settlementsFor, type ArchivedConfirmation } from './domain/settlements';
import { ARCHIVE_DIR, loadArchive } from './load-archive';
import { parseArchive } from './parse-archive';
import { MESSAGES_PAGE_SIZE, type MessageFilters, type ReconNoteInput } from './validation';

const CLIENT_STATUS: Record<string, string> = { A: 'Active', D: 'Dormant', C: 'Closed' };
const ACCOUNT_STATUS: Record<string, string> = { O: 'Open', C: 'Closed' };
const ARCHIVE_ROOT = 'server/custody/archive';
const NO_STATEMENT = 'No statement on file for this date.';

type StoredStatementFile = StatementFile & { fileName: string };
type StoredConfirmation = ArchivedConfirmation & { fileName: string; safeCode: string };

interface AccountRow {
  acctId: number;
  acctNo: string;
  clientId: number;
  clientName: string;
  safeCode: string;
  status: string;
}

async function read<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    return fn(client);
  });
}

async function rows<T>(client: PoolClient, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await client.query(sql, params)).rows as T[];
}

const iso = (column: string, alias: string) => `to_char(${column}, 'YYYY-MM-DD') AS "${alias}"`;

const ACCOUNT_SELECT = `SELECT a.acct_id AS "acctId", a.acct_no AS "acctNo", a.client_id AS "clientId", c.name AS "clientName",
  a.safe_code AS "safeCode", a.status FROM custody_accounts a JOIN custody_clients c ON c.client_id = a.client_id`;

const account = (row: AccountRow) => ({ ...row, status: ACCOUNT_STATUS[row.status] ?? row.status });

async function findAccount(client: PoolClient, acctId: number) {
  const [row] = await rows<AccountRow>(client, `${ACCOUNT_SELECT} WHERE a.acct_id = $1`, [acctId]);
  if (!row) notFound('Account not found.');
  return row;
}

async function instrumentNames(client: PoolClient): Promise<InstrumentNames> {
  const list = await rows<{ isin: string; name: string }>(client, 'SELECT isin, name FROM custody_instruments');
  return new Map(list.map(r => [r.isin, r.name]));
}

/** Parsed MT535s (optionally one safekeeping account, optionally up to a date) in archive order. */
async function loadStatements(client: PoolClient, opts: { safeCode?: string; upTo?: string } = {}): Promise<StoredStatementFile[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.safeCode !== undefined) { params.push(opts.safeCode); where.push(`s.safe_code = $${params.length}`); }
  if (opts.upTo !== undefined) { params.push(opts.upTo); where.push(`s.stmt_date <= $${params.length}`); }
  const header = await rows<{ id: number; fileSeq: number; fileName: string; function: string | null; statementDate: string; safe: string }>(client,
    `SELECT s.statement_id AS id, s.file_seq AS "fileSeq", m.file_name AS "fileName", s.function, ${iso('s.stmt_date', 'statementDate')},
       s.safe_code AS safe
     FROM custody_statements s JOIN custody_messages m ON m.message_id = s.message_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY m.rel_path`, params);
  const files = new Map<number, StoredStatementFile>();
  for (const h of header) {
    files.set(h.id, { fileSeq: h.fileSeq, fileName: h.fileName,
      statement: { function: h.function, statementDate: h.statementDate, safekeepingAcct: h.safe, lines: [] } });
  }
  if (!files.size) return [];
  const lines = await rows<{ id: number; isin: string; description: string; qty: number; qtyType: string; price: number; ccy: string;
    mktVal: number; mktValGbp: number }>(client,
    `SELECT statement_id AS id, isin::text, description, qty, qty_type AS "qtyType", price, ccy::text, mkt_val AS "mktVal",
       mkt_val_gbp AS "mktValGbp" FROM custody_statement_lines WHERE statement_id = ANY($1::int[]) ORDER BY statement_id, line_no`,
    [[...files.keys()]]);
  for (const { id, ...line } of lines) files.get(id)!.statement.lines.push(line);
  return [...files.values()];
}

/** Parsed MT54x for a safekeeping account (plus every CANC, which may cancel across accounts), or all. */
async function loadConfirmations(client: PoolClient, safeCode?: string): Promise<StoredConfirmation[]> {
  return rows<StoredConfirmation>(client,
    `SELECT c.mt_type AS "mtType", c.seme, c.prev, c.function, ${iso('c.trade_date', 'tradeDate')}, ${iso('c.settle_date', 'settleDate')},
       c.isin::text AS isin, c.qty, c.safe_code_raw AS "safekeepingAcct", c.amount_raw AS "amountRaw", c.amount, c.ccy::text AS ccy,
       c.direction::text AS direction, c.day_folder::text AS "dayFolder", m.file_name AS "fileName", c.safe_code AS "safeCode"
     FROM custody_confirmations c JOIN custody_messages m ON m.message_id = c.message_id
     ${safeCode === undefined ? '' : `WHERE c.safe_code = $1 OR c.function = 'CANC'`} ORDER BY m.rel_path`,
    safeCode === undefined ? [] : [safeCode]);
}

async function loadNotes(client: PoolClient, stmtDate: string, acctId?: number): Promise<Map<number, ReconNote[]>> {
  const list = await rows<ReconNote & { acctId: number; updatedAt: Date | null }>(client,
    `SELECT acct_id AS "acctId", isin::text AS isin, status, note, updated_by AS "updatedBy", updated_at AS "updatedAt"
     FROM custody_recon_notes WHERE stmt_date = $1 ${acctId === undefined ? '' : 'AND acct_id = $2'}`,
    acctId === undefined ? [stmtDate] : [stmtDate, acctId]);
  const byAccount = new Map<number, ReconNote[]>();
  for (const { acctId: id, updatedAt, ...note } of list) {
    const notes = byAccount.get(id) ?? [];
    notes.push({ ...note, updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null });
    byAccount.set(id, notes);
  }
  return byAccount;
}

// Clients -------------------------------------------------------------------------------------

export async function listClients(q: string) {
  const pattern = q.toLowerCase().replace(/[\\%_]/g, ch => `\\${ch}`);
  return read(async client => {
    const list = await rows<{ clientId: number; clientRef: string; name: string; status: string; adviserUsername: string | null;
      adviserName: string | null; accountCount: number }>(client,
      `SELECT c.client_id AS "clientId", c.client_ref AS "clientRef", c.name, c.status, u.username AS "adviserUsername",
         u.full_name AS "adviserName", (SELECT count(*)::int FROM custody_accounts a WHERE a.client_id = c.client_id) AS "accountCount"
       FROM custody_clients c LEFT JOIN custody_users u ON u.user_id = c.adviser_user_id
       WHERE $1 = '' OR lower(c.name) LIKE '%' || $1 || '%' OR lower(c.client_ref) LIKE $1 || '%'
       ORDER BY c.name, c.client_id`, [pattern]);
    return { clients: list.map(c => ({ ...c, status: CLIENT_STATUS[c.status] ?? c.status })) };
  });
}

export async function getClient(clientId: number) {
  return read(async client => {
    const [row] = await rows<{ clientId: number; clientRef: string; name: string; status: string; adviserUsername: string | null;
      adviserName: string | null }>(client,
      `SELECT c.client_id AS "clientId", c.client_ref AS "clientRef", c.name, c.status, u.username AS "adviserUsername",
         u.full_name AS "adviserName"
       FROM custody_clients c LEFT JOIN custody_users u ON u.user_id = c.adviser_user_id WHERE c.client_id = $1`, [clientId]);
    if (!row) notFound('Client not found.');
    const accounts = await rows<{ acctId: number; acctNo: string; acctType: string | null; baseCcy: string | null; safeCode: string;
      openDate: string | null; closeDate: string | null; status: string }>(client,
      `SELECT acct_id AS "acctId", acct_no AS "acctNo", rtrim(acct_type) AS "acctType", base_ccy::text AS "baseCcy", safe_code AS "safeCode",
         ${iso('open_date', 'openDate')}, ${iso('close_date', 'closeDate')}, status
       FROM custody_accounts WHERE client_id = $1 ORDER BY acct_no, acct_id`, [clientId]);
    return {
      client: { ...row, status: CLIENT_STATUS[row.status] ?? row.status },
      accounts: accounts.map(a => ({ ...a, status: ACCOUNT_STATUS[a.status] ?? a.status })),
    };
  });
}

// Accounts, holdings, settlements -------------------------------------------------------------

export async function listAccounts() {
  return read(async client => ({ accounts: (await rows<AccountRow>(client, `${ACCOUNT_SELECT} ORDER BY a.acct_no, a.acct_id`)).map(account) }));
}

export async function getStatementDates(acctId: number) {
  return read(async client => {
    const acct = await findAccount(client, acctId);
    return { dates: datesFor(await loadStatements(client, { safeCode: acct.safeCode }), acct.safeCode) };
  });
}

export async function getAllStatementDates() {
  return read(async client => ({
    dates: (await rows<{ d: string }>(client, `SELECT DISTINCT ${iso('stmt_date', 'd')} FROM custody_statements ORDER BY 1 DESC`)).map(r => r.d),
  }));
}

export async function getHoldings(acctId: number, date: string) {
  return read(async client => {
    const acct = await findAccount(client, acctId);
    const files = await loadStatements(client, { safeCode: acct.safeCode });
    const file = statementsByDate(files, acct.safeCode).get(date) as StoredStatementFile | undefined;
    if (!file) notFound(NO_STATEMENT);
    const view = holdings(file.statement, await instrumentNames(client));
    return {
      account: account(acct),
      statement: { statementDate: view.statementDate, function: view.function, fileSeq: file.fileSeq, fileName: file.fileName },
      lines: view.rows,
      totalGbp: view.totalGbp,
    };
  });
}

export async function getSettlements(acctId: number, range: { from?: string; to?: string }) {
  return read(async client => {
    const acct = await findAccount(client, acctId);
    let { from, to } = range;
    if (!from || !to) {
      const [latest] = datesFor(await loadStatements(client, { safeCode: acct.safeCode }), acct.safeCode);
      const window = defaultSettlementWindow(to ?? latest ?? null, new Date().toISOString().slice(0, 10));
      from ??= window.from;
      to ??= window.to;
      if (from > to) badRequest('From date must be on or before the to date.');
    }
    const names = await instrumentNames(client);
    const list = settlementsFor(activeConfirmations(await loadConfirmations(client, acct.safeCode)), acct.safeCode, from, to);
    return {
      from,
      to,
      settlements: list.map(c => ({
        tradeDate: c.tradeDate, settleDate: c.settleDate, mtType: c.mtType, direction: c.direction, isin: c.isin,
        instrument: c.isin === null ? null : instrumentName(c.isin, names), qty: c.qty, amount: c.amount, ccy: c.ccy,
        seme: c.seme, fileName: c.fileName,
      })),
    };
  });
}

// Position check ------------------------------------------------------------------------------

export async function getPositionCheck(acctId: number, date: string) {
  return read(async client => {
    const acct = await findAccount(client, acctId);
    const files = await loadStatements(client, { safeCode: acct.safeCode, upTo: date });
    if (!statementsByDate(files, acct.safeCode).has(date)) notFound(NO_STATEMENT);
    const notes = (await loadNotes(client, date, acctId)).get(acctId) ?? [];
    const result = runPositionCheck(files, await loadConfirmations(client, acct.safeCode), acct.safeCode, date, notes,
      await instrumentNames(client));
    return { statementDate: date, previousStatementDate: result.prevStmtDate, message: result.noPrevMessage, rows: result.rows };
  });
}

export async function getCheckAll(date: string) {
  return read(async client => {
    const accounts = await rows<AccountRow>(client, `${ACCOUNT_SELECT} ORDER BY a.acct_no, a.acct_id`);
    const bySafe = new Map<string, StoredStatementFile[]>();
    for (const file of await loadStatements(client, { upTo: date })) {
      const list = bySafe.get(file.statement.safekeepingAcct ?? '') ?? [];
      list.push(file);
      bySafe.set(file.statement.safekeepingAcct ?? '', list);
    }
    const confirmations = await loadConfirmations(client);
    const cancellations = confirmations.filter(c => c.function === 'CANC');
    const confsBySafe = new Map<string, StoredConfirmation[]>();
    for (const c of confirmations) {
      if (c.function === 'CANC') continue;
      const list = confsBySafe.get(c.safeCode) ?? [];
      list.push(c);
      confsBySafe.set(c.safeCode, list);
    }
    const notes = await loadNotes(client, date);
    const names = await instrumentNames(client);
    const out = [];
    for (const acct of accounts) {
      const files = bySafe.get(acct.safeCode) ?? [];
      if (!statementsByDate(files, acct.safeCode).has(date)) continue;
      const result = runPositionCheck(files, [...(confsBySafe.get(acct.safeCode) ?? []), ...cancellations], acct.safeCode, date,
        notes.get(acct.acctId) ?? [], names);
      out.push({
        acctId: acct.acctId, acctNo: acct.acctNo, clientName: acct.clientName, breaks: result.rows.length,
        newBreaks: result.rows.filter(r => r.status === 'NEW').length, previousStatementDate: result.prevStmtDate,
      });
    }
    return { statementDate: date, accounts: out };
  });
}

export async function listOperators() {
  return read(async client => ({
    operators: await rows(client, `SELECT username, full_name AS "fullName", role FROM custody_users
      WHERE active AND role IN ('OPS', 'ADMIN') ORDER BY username`),
  }));
}

function audit(client: PoolClient, action: string, entityId: string, detail: string) {
  return client.query(
    `WITH next AS (SELECT nextval('wf_audit_seq') AS seq)
     INSERT INTO wf_audit (audit_id, seq, action, entity_id, detail)
     SELECT 'AU' || seq, seq, $1, $2, $3 FROM next`,
    [action, entityId, detail.length > 300 ? `${detail.slice(0, 299)}…` : detail],
  );
}

export async function saveReconNote(input: ReconNoteInput) {
  return withTransaction(async client => {
    const acct = await findAccount(client, input.acctId);
    const [operator] = await rows<{ username: string }>(client,
      `SELECT username FROM custody_users WHERE username = $1 AND active AND role IN ('OPS', 'ADMIN')`, [input.operator]);
    if (!operator) badRequest('Operator must be an active operations user.');
    const [{ exists }] = await rows<{ exists: boolean }>(client,
      'SELECT EXISTS (SELECT 1 FROM custody_statements WHERE safe_code = $1 AND stmt_date = $2) AS exists', [acct.safeCode, input.stmtDate]);
    if (!exists) notFound(NO_STATEMENT);
    const [previous] = await rows<{ status: string; note: string | null }>(client,
      'SELECT status, note FROM custody_recon_notes WHERE acct_id = $1 AND isin = $2 AND stmt_date = $3 FOR UPDATE',
      [input.acctId, input.isin, input.stmtDate]);
    const [note] = await rows<{ acctId: number; isin: string; stmtDate: string; status: string; note: string | null; updatedBy: string;
      updatedAt: Date }>(client,
      `INSERT INTO custody_recon_notes (acct_id, isin, stmt_date, status, note, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())
       ON CONFLICT (acct_id, isin, stmt_date) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note,
         updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
       RETURNING acct_id AS "acctId", isin::text AS isin, ${iso('stmt_date', 'stmtDate')}, status, note, updated_by AS "updatedBy",
         updated_at AS "updatedAt"`,
      [input.acctId, input.isin, input.stmtDate, input.status, input.note, operator.username]);
    const changes = [`Status ${previous?.status ?? 'NEW'} → ${input.status}`];
    if ((previous?.note ?? '') !== input.note) changes.push(`Note: ${input.note || '(cleared)'}`);
    await audit(client, 'Recon note updated', acct.acctNo,
      `${acct.acctNo} ${input.isin} statement ${input.stmtDate} by ${operator.username}: ${changes.join('; ')}`);
    return { note: { ...note, updatedAt: new Date(note.updatedAt).toISOString() } };
  });
}

// Messages and archive ------------------------------------------------------------------------

export async function listMessages(filters: MessageFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.family) { params.push(filters.family); where.push(`msg_family = $${params.length}`); }
  if (filters.date) { params.push(filters.date); where.push(`msg_date = $${params.length}`); }
  if (filters.safe) { params.push(filters.safe); where.push(`safe_code = $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return read(async client => {
    const [{ total }] = await rows<{ total: number }>(client, `SELECT count(*)::int AS total FROM custody_messages ${clause}`, params);
    const files = await rows(client,
      `SELECT file_name AS "fileName", msg_family AS family, mt_type AS "mtType", ${iso('msg_date', 'msgDate')}, safe_code AS "safeCode",
         size_bytes AS "sizeBytes", parse_status AS "parseStatus"
       FROM custody_messages ${clause} ORDER BY rel_path LIMIT ${MESSAGES_PAGE_SIZE} OFFSET $${params.length + 1}`,
      [...params, (filters.page - 1) * MESSAGES_PAGE_SIZE]);
    return { total, page: filters.page, files };
  });
}

export async function getMessage(fileName: string) {
  return read(async client => {
    const [row] = await rows<{ fileName: string; relPath: string; family: string; raw: string }>(client,
      `SELECT file_name AS "fileName", rel_path AS "relPath", msg_family AS family, raw_text AS raw
       FROM custody_messages WHERE file_name = $1`, [fileName]);
    if (!row) notFound('Message not found.');
    return row;
  });
}

async function status(client: PoolClient) {
  const [load] = await rows<{ loadedAt: Date; loadMs: number; mt535Count: number; mt54xCount: number; statements: number;
    confirmations: number; parseErrors: number }>(client,
    `SELECT loaded_at AS "loadedAt", load_ms AS "loadMs", mt535_count AS "mt535Count", mt54x_count AS "mt54xCount", statements,
       confirmations, parse_errors AS "parseErrors" FROM custody_archive_loads ORDER BY load_id DESC LIMIT 1`);
  return {
    root: ARCHIVE_ROOT,
    mt535Count: load?.mt535Count ?? 0,
    mt54xCount: load?.mt54xCount ?? 0,
    statements: load?.statements ?? 0,
    confirmations: load?.confirmations ?? 0,
    parseErrors: load?.parseErrors ?? 0,
    loadedAt: load ? new Date(load.loadedAt).toISOString() : null,
    loadMs: load?.loadMs ?? null,
  };
}

export async function getArchiveStatus() {
  return read(status);
}

/** Re-syncs the archive folder and parses changed files in one transaction; serialised by an advisory lock. */
export async function reloadArchive(dir = ARCHIVE_DIR) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('custody_archive_reload'))`);
    const started = Date.now();
    const loaded = await loadArchive(client, dir);
    const parsed = await parseArchive(client, started);
    await audit(client, 'Custody archive reloaded', 'ARCHIVE',
      `${loaded.mt535} MT535 + ${loaded.mt54x} MT54x files (${loaded.inserted} new, ${loaded.updated} changed, ${loaded.removed} removed); `
      + `${parsed.parseErrors} parse errors`);
    const result = await status(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
