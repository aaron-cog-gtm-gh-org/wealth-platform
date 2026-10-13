// Custody (legacy Portfolio Viewer) data access — contracts/api.md. Stable signatures for story
// sessions: add new functions here rather than querying custody_* tables from routes.
// Decimals leave Oracle as strings (TO_CHAR ... 'TM9') and are normalized with `normalizeDec`.
import oracledb from 'oracledb';
import type {
  ClientPickerItem, ClientPickerPage, CustodyAccountSummary, CustodyAccountType, CustodyClientPage, CustodyClientRow, CustodyClientSummary,
  CustodyConfirmation, CustodyMessage, CustodyMessageDerived, CustodyMessagePage, CustodyMessageRow, CustodyStatement,
  CustodyStatementDate, CustodyStatementLine, Currency, HouseholdDto, IngestionStatus, IngestRun, PortfolioDto, QtyType,
  BreakCause, BreakNote, BreakNoteHistory, BreakNotePatch, BreakNoteRow, BreakStatus, PositionBreak, PositionCheckResult,
} from '../../src/api/types';
import { getPool, query } from '../db/pool';
import { decSum, normalizeDec } from '../custody/decimal.js';
import { toCustodyHousehold, toCustodyPortfolio } from '../custody/platform-view.js';
import { defaultArchiveDir, ingestArchive, IngestConflictError } from '../custody/ingest.js';
import { confirmationFact, parseArchiveText, statementFact, type ArchiveEntry } from '../custody/archive.js';
import {
  buildRuleContext, positionChecksForAll, type AccountRef, type ConfirmationFact, type RuleMode, type StatementFact,
} from '../custody/rules.js';

export const PAGE_SIZE = 25;

/** Thrown for invalid request input; routes map it to `400 { error }`. */
export class CustodyValidationError extends Error {}

export function custodyPageWindow(householdCount: number, page: number, size = PAGE_SIZE) {
  const start = (page - 1) * size;
  const end = start + size;
  return { offset: Math.max(0, start - householdCount), limit: Math.max(0, Math.min(size, end - householdCount)) };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function requireDate(v: unknown, name = 'date'): string {
  if (typeof v !== 'string' || !ISO_DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new CustodyValidationError(`${name} must be YYYY-MM-DD`);
  return v;
}
export function requireId(v: unknown, name = 'id'): number {
  if (typeof v !== 'string' || !/^\d{1,10}$/.test(v)) throw new CustodyValidationError(`${name} must be a positive integer`);
  return Number(v);
}
export function optionalPage(v: unknown): number {
  if (v === undefined || v === '') return 1;
  const n = requireId(v, 'page');
  if (n < 1) throw new CustodyValidationError('page must be >= 1');
  return n;
}

/** SQL fragment: NUMBER → canonical decimal text, independent of session NLS. */
export const decCol = (col: string, alias: string) => `TO_CHAR(${col}, 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,''') AS "${alias}"`;
const isoCol = (col: string, alias: string) => `TO_CHAR(${col}, 'YYYY-MM-DD') AS "${alias}"`;
const dec = (s: string | null) => (s === null ? null : normalizeDec(s.startsWith('.') ? `0${s}` : s.startsWith('-.') ? `-0${s.slice(1)}` : s));

// --- Clients & accounts ---------------------------------------------------------------------

const CLIENT_ROW_SQL = `
  SELECT c.client_id AS "clientId", c.client_ref AS "clientRef", c.client_name AS "name", u.display_name AS "adviser",
         c.status AS "status", (SELECT COUNT(*) FROM custody_accounts a WHERE a.client_id = c.client_id) AS "accountCount"
    FROM custody_clients c LEFT JOIN custody_users u ON u.user_name = c.adviser`;

/** Clients matching `q` (ref or name, case-insensitive), 25 per page, ordered by name. */
export async function listCustodyClients(q = '', page = 1): Promise<CustodyClientPage> {
  const like = `%${q.trim().toUpperCase()}%`;
  const where = ` WHERE UPPER(c.client_ref) LIKE :q OR UPPER(c.client_name) LIKE :q`;
  const [rows, total] = await Promise.all([
    query<CustodyClientRow>(`${CLIENT_ROW_SQL}${where} ORDER BY c.client_name, c.client_id OFFSET :o ROWS FETCH NEXT :n ROWS ONLY`,
      { q: like, o: (page - 1) * PAGE_SIZE, n: PAGE_SIZE }),
    query<{ N: number }>(`SELECT COUNT(*) AS n FROM custody_clients c${where}`, { q: like }),
  ]);
  return { rows, page, total: Number(total[0]?.N ?? 0) };
}

export async function getCustodyClientRow(clientId: number): Promise<CustodyClientRow | null> {
  return (await query<CustodyClientRow>(`${CLIENT_ROW_SQL} WHERE c.client_id = :id`, { id: clientId }))[0] ?? null;
}

/** Accounts of a client with their latest effective statement date and GBP value. */
export async function listCustodyAccounts(clientId: number): Promise<CustodyAccountSummary[]> {
  const rows = await query<{ accountId: number; safeNo: number; accountType: CustodyAccountType; reportingCcy: Currency;
    closed: number; latestStatementDate: string | null; latestValue: string | null }>(
    `SELECT a.account_id AS "accountId", a.safe_no AS "safeNo", a.account_type AS "accountType", TRIM(a.reporting_ccy) AS "reportingCcy",
            CASE WHEN a.close_date IS NULL THEN 0 ELSE 1 END AS "closed", ${isoCol('s.statement_date', 'latestStatementDate')},
            (SELECT ${decCol('SUM(l.reporting_value)', 'v')} FROM custody_statement_lines l WHERE l.statement_id = s.statement_id) AS "latestValue"
       FROM custody_accounts a
       LEFT JOIN custody_statements s ON s.statement_id = (
         SELECT MAX(s2.statement_id) KEEP (DENSE_RANK LAST ORDER BY s2.statement_date)
           FROM custody_statements s2 WHERE s2.account_id = a.account_id AND s2.is_effective = 1)
      WHERE a.client_id = :id ORDER BY a.account_id`, { id: clientId });
  return rows.map(r => ({ ...r, closed: r.closed === 1, latestValue: r.latestStatementDate ? dec(r.latestValue) ?? '0.00' : null }));
}

export async function getCustodyClient(clientId: number): Promise<CustodyClientSummary | null> {
  const row = await getCustodyClientRow(clientId);
  if (!row) return null;
  const accounts = await listCustodyAccounts(clientId);
  return { ...row, accounts, total: decSum(accounts.map(a => a.latestValue ?? '0')) };
}

export const getClientSummary = getCustodyClient;

/** Households precede custody clients in one searchable, 25-row client-picker result. */
export async function searchClients(q = '', page = 1): Promise<ClientPickerPage> {
  const like = `%${q.trim().toUpperCase()}%`;
  const [households, householdTotal, custodyTotal] = await Promise.all([
    query<{ id: string; name: string; clientRef: string | null }>(
      `SELECT h.household_id AS "id", h.household_name AS "name",
              MAX(CASE WHEN c.is_primary = 1 THEN c.client_id END) AS "clientRef"
         FROM households h LEFT JOIN clients c ON c.household_id = h.household_id
        WHERE UPPER(h.household_id) LIKE :q OR UPPER(h.household_name) LIKE :q
        GROUP BY h.household_id, h.household_name ORDER BY UPPER(h.household_name), h.household_id`,
      { q: like }),
    query<{ N: number }>(
      `SELECT COUNT(*) AS n FROM households h
        WHERE UPPER(h.household_id) LIKE :q OR UPPER(h.household_name) LIKE :q`, { q: like }),
    query<{ N: number }>(
      `SELECT COUNT(*) AS n FROM custody_clients c
        WHERE UPPER(c.client_ref) LIKE :q OR UPPER(c.client_name) LIKE :q`, { q: like }),
  ]);
  const start = (page - 1) * PAGE_SIZE;
  const householdItems: ClientPickerItem[] = households.slice(start, start + PAGE_SIZE).map(h => ({
    kind: 'household', id: h.id, name: h.name, clientRef: h.clientRef, reportingCurrency: 'CAD',
  }));
  const window = custodyPageWindow(households.length, page);
  const custodyRows = window.limit ? await query<{ id: number; name: string; clientRef: string; reportingCurrency: Currency | null }>(
    `SELECT c.client_id AS "id", c.client_name AS "name", c.client_ref AS "clientRef",
            (SELECT TRIM(a.reporting_ccy) FROM custody_accounts a
              WHERE a.client_id = c.client_id ORDER BY a.account_id FETCH FIRST 1 ROW ONLY) AS "reportingCurrency"
       FROM custody_clients c
      WHERE UPPER(c.client_ref) LIKE :q OR UPPER(c.client_name) LIKE :q
      ORDER BY c.client_name, c.client_id OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
    { q: like, offset: window.offset, limit: window.limit }) : [];
  const custodyItems: ClientPickerItem[] = custodyRows.map(c => ({
    kind: 'custody', id: String(c.id), name: c.name, clientRef: c.clientRef, reportingCurrency: c.reportingCurrency ?? 'GBP',
  }));
  return { items: [...householdItems, ...custodyItems], page, total: Number(householdTotal[0]?.N ?? 0) + Number(custodyTotal[0]?.N ?? 0) };
}

export async function accountExists(accountId: number): Promise<boolean> {
  return (await query(`SELECT 1 FROM custody_accounts WHERE account_id = :id`, { id: accountId })).length > 0;
}

// --- Statements & confirmations -------------------------------------------------------------

/** Statement dates for an account, newest first; `superseded` = non-effective files that day. */
export async function listStatementDates(accountId: number): Promise<CustodyStatementDate[]> {
  const rows = await query<{ date: string; isEmpty: number; superseded: number }>(
    `SELECT ${isoCol('statement_date', 'date')}, MAX(CASE WHEN is_effective = 1 THEN is_empty END) AS "isEmpty",
            SUM(1 - is_effective) AS "superseded"
       FROM custody_statements WHERE account_id = :id GROUP BY statement_date ORDER BY statement_date DESC`, { id: accountId });
  return rows.map(r => ({ date: r.date, isEmpty: r.isEmpty === 1, superseded: Number(r.superseded) }));
}

/** Effective statement for (account, date) with instrument names (legacy ref name, else 35B, D-5). */
export async function getStatement(accountId: number, date: string): Promise<CustodyStatement | null> {
  const head = (await query<{ id: number; messageId: number; functionCode: string; isEmpty: number }>(
    `SELECT statement_id AS "id", message_id AS "messageId", function_code AS "functionCode", is_empty AS "isEmpty"
       FROM custody_statements WHERE account_id = :a AND statement_date = TO_DATE(:d, 'YYYY-MM-DD') AND is_effective = 1`,
    { a: accountId, d: date }))[0];
  if (!head) return null;
  const raw = await query<{ isin: string; name: string | null; src: string | null; descr: string | null; qty: string; qtyType: QtyType;
    price: string; ccy: Currency; mv: string; rv: string | null }>(
    `SELECT TRIM(l.isin) AS "isin", i.name AS "name", i.source AS "src", l.custodian_desc AS "descr", ${decCol('l.qty', 'qty')},
            l.qty_type AS "qtyType", ${decCol('l.price', 'price')}, TRIM(l.ccy) AS "ccy", ${decCol('l.market_value', 'mv')},
            ${decCol('l.reporting_value', 'rv')}
       FROM custody_statement_lines l LEFT JOIN custody_instruments i ON i.isin = l.isin
      WHERE l.statement_id = :id ORDER BY l.line_no`, { id: head.id });
  const lines: CustodyStatementLine[] = raw.map(r => ({
    isin: r.isin, name: (r.src === 'LEGACY_REF' ? r.name : r.descr ?? r.name) ?? r.isin, nameVerified: r.src === 'LEGACY_REF',
    qty: dec(r.qty)!, qtyType: r.qtyType, price: dec(r.price)!, ccy: r.ccy, marketValue: dec(r.mv)!, reportingValue: dec(r.rv),
    messageId: head.messageId,
  }));
  return {
    accountId, date, functionCode: head.functionCode, isEmpty: head.isEmpty === 1, lines,
    total: decSum(lines.map(l => l.reportingValue ?? '0')), missingReportingValues: lines.filter(l => l.reportingValue === null).length,
    messageId: head.messageId,
  };
}

export async function getLatestStatement(accountId: number): Promise<CustodyStatement | null> {
  const d = (await listStatementDates(accountId))[0];
  return d ? getStatement(accountId, d.date) : null;
}

/** Live (not cancelled, not CANC) confirmations settling in [from, to], newest first. */
const addDaysUtc = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export async function listConfirmations(accountId: number, from?: string, to?: string): Promise<CustodyConfirmation[]> {
  const defaultTo = to ?? (await query<{ latest: string | null }>(
    `SELECT TO_CHAR(MAX(statement_date), 'YYYY-MM-DD') AS "latest"
       FROM custody_statements WHERE account_id = :a AND is_effective = 1`, { a: accountId }))[0]?.latest
    ?? new Date().toISOString().slice(0, 10);
  const defaultFrom = from ?? addDaysUtc(defaultTo, -90);
  if (defaultFrom > defaultTo) throw new CustodyValidationError('from must be on or before to');
  const rows = await query<Omit<CustodyConfirmation, 'direction' | 'freeOfPayment' | 'qty' | 'amount'> & { dir: string; qty: string; amount: string | null }>(
    `SELECT c.confirmation_id AS "confirmationId", c.mt_type AS "mtType", c.direction AS "dir", ${isoCol('c.trade_date', 'tradeDate')},
            ${isoCol('c.settle_date', 'settleDate')}, TRIM(c.isin) AS "isin", NVL(i.name, TRIM(c.isin)) AS "name", ${decCol('c.qty', 'qty')},
            c.qty_type AS "qtyType", ${decCol('c.amount', 'amount')}, TRIM(c.amount_ccy) AS "amountCcy", c.seme AS "reference",
            c.message_id AS "messageId"
       FROM custody_confirmations c LEFT JOIN custody_instruments i ON i.isin = c.isin
      WHERE c.account_id = :a AND c.function_code <> 'CANC' AND c.cancelled_by IS NULL
        AND c.settle_date BETWEEN TO_DATE(:f, 'YYYY-MM-DD') AND TO_DATE(:t, 'YYYY-MM-DD')
      ORDER BY c.settle_date DESC, c.confirmation_id DESC`, { a: accountId, f: defaultFrom, t: defaultTo });
  return rows.map(({ dir, qty, amount, ...r }) => ({
    ...r, direction: dir === 'RECEIVE' ? 'Receive' : 'Deliver', freeOfPayment: r.mtType === 544 || r.mtType === 546,
    qty: dec(qty)!, amount: dec(amount),
  }));
}

// --- Platform view (Client 360 / Portfolio Detail for a custody client) ---------------------

export async function getCustodyHousehold(clientId: number): Promise<HouseholdDto | null> {
  const client = await getCustodyClient(clientId);
  return client ? toCustodyHousehold(client) : null;
}

export async function getCustodyPortfolio(clientId: number): Promise<PortfolioDto | null> {
  const client = await getCustodyClient(clientId);
  if (!client) return null;
  const statements = (await Promise.all(client.accounts.map(a => getLatestStatement(a.accountId)))).filter((s): s is CustodyStatement => !!s);
  return toCustodyPortfolio(client, statements);
}


// --- Position checks ------------------------------------------------------------------------
// Rules run over facts re-parsed from custody_messages.raw_text so legacy mode sees the exact
// text it needs (safe as sent, day folder, raw amount). Facts are cached per ingest run.

let factsCache: { key: string; facts: RuleFacts } | undefined;
export interface RuleFacts { statements: StatementFact[]; confirmations: ConfirmationFact[]; accounts: AccountRef[] }

export async function loadRuleFacts(): Promise<RuleFacts> {
  const key = String((await query<{ K: string }>(`SELECT NVL(MAX(run_id), 0) || ':' || COUNT(*) AS k FROM custody_ingest_runs`))[0]?.K)
    + String((await query<{ K: number }>(`SELECT COUNT(*) AS k FROM custody_accounts`))[0]?.K);
  if (factsCache?.key === key) return factsCache.facts;
  const conn = await (await getPool()).getConnection();
  try {
    const rows = (await conn.execute<{ ID: number; MT: number; FOLDER: string; SF: string; SEQ: number; BD: string; RAWTXT: string }>(
      `SELECT message_id AS id, mt_type AS mt, source_folder AS folder, source_file AS sf, file_seq AS seq,
              TO_CHAR(business_date, 'YYYY-MM-DD') AS bd, raw_text AS rawtxt
         FROM custody_messages WHERE parse_status = 'OK' ORDER BY message_id`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo: { RAWTXT: { type: oracledb.STRING } } })).rows ?? [];
    const statements: StatementFact[] = [];
    const confirmations: ConfirmationFact[] = [];
    for (const r of rows) {
      const e: ArchiveEntry = {
        sourceFolder: r.FOLDER, fileName: r.SF.split('/').pop()!, sourceFile: r.SF, family: r.MT === 535 ? 'MT535' : 'MT54x',
        folder: r.MT === 535 ? 'mt535' : r.FOLDER.split('/').pop()!, businessDate: r.BD, fileSeq: r.SEQ,
      };
      const p = parseArchiveText(e, r.RAWTXT);
      if (p.kind === 'statement') statements.push(statementFact(e, p.statement, r.ID));
      else if (p.kind === 'confirmation') confirmations.push(confirmationFact(e, p.confirmation, r.ID));
    }
    const accounts = (await query<{ accountId: number; safeNo: number }>(
      `SELECT account_id AS "accountId", safe_no AS "safeNo" FROM custody_accounts ORDER BY account_id`))
      .map(a => ({ ...a, safeCode: String(a.safeNo) }));
    factsCache = { key, facts: { statements, confirmations, accounts } };
    return factsCache.facts;
  } finally {
    await conn.close();
  }
}

/**
 * Position check (BR-6/BR-7) in `mode`. `accountId` omitted ⇒ every account ("Check All");
 * `date` omitted ⇒ every statement date on file. Breaks carry their current note (status NEW if none).
 */
export async function runPositionChecks(opts: { date?: string; accountId?: number; mode?: RuleMode } = {}): Promise<PositionCheckResult | null> {
  const mode = opts.mode ?? 'corrected';
  const facts = await loadRuleFacts();
  const accounts = opts.accountId === undefined ? facts.accounts : facts.accounts.filter(a => a.accountId === opts.accountId);
  if (opts.accountId !== undefined && !accounts.length) return null;
  const outcomes = positionChecksForAll(buildRuleContext(facts.statements, facts.confirmations, mode), accounts, { date: opts.date });
  const [names, notes] = await Promise.all([
    query<{ isin: string; name: string }>(`SELECT TRIM(isin) AS "isin", name AS "name" FROM custody_instruments`),
    query<{ k: string; status: BreakStatus; cause: BreakCause | null; note: string | null; updatedBy: string; updatedAt: string }>(
      `SELECT account_id || '|' || TRIM(isin) || '|' || TO_CHAR(statement_date, 'YYYY-MM-DD') AS "k", status AS "status", cause AS "cause",
              note AS "note", updated_by AS "updatedBy", TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "updatedAt" FROM custody_break_notes`),
  ]);
  const nameOf = new Map(names.map(n => [n.isin, n.name]));
  const noteOf = new Map(notes.map(n => [n.k, n]));
  const breaks: PositionBreak[] = outcomes.flatMap(o => o.rows.map(r => {
    const n = noteOf.get(`${o.accountId}|${r.isin}|${o.date}`);
    return {
      accountId: o.accountId, safeNo: o.safeNo, isin: r.isin, name: nameOf.get(r.isin) ?? r.isin, date: o.date, qtyType: r.qtyType,
      previousQty: r.previousQty, settledNet: r.settledNet, expectedQty: r.expectedQty, reportedQty: r.reportedQty, difference: r.difference,
      status: n?.status ?? 'NEW', cause: n?.cause ?? null, note: n?.note ?? null, updatedBy: n?.updatedBy ?? null, updatedAt: n?.updatedAt ?? null,
      sourceMessageIds: [o.previousRef, o.statementRef, ...r.settlementRefs].filter((x): x is string => !!x).map(Number),
    };
  })).sort((a, b) => a.date.localeCompare(b.date) || a.accountId - b.accountId || a.isin.localeCompare(b.isin));
  return { date: opts.date ?? '', mode, accountsChecked: new Set(outcomes.map(o => o.accountId)).size, breaks };
}

export async function listPositionCheckDates(): Promise<string[]> {
  const rows = await query<{ date: string }>(
    `SELECT DISTINCT TO_CHAR(statement_date, 'YYYY-MM-DD') AS "date"
       FROM custody_statements WHERE is_effective = 1 ORDER BY 1 DESC`);
  return rows.map(row => row.date);
}

export async function listBreakNotes(): Promise<BreakNoteRow[]> {
  return query<BreakNoteRow>(
    `SELECT n.account_id AS "accountId", TRIM(n.isin) AS "isin", TO_CHAR(n.statement_date, 'YYYY-MM-DD') AS "date",
            NVL(i.name, TRIM(n.isin)) AS "name", n.status AS "status", n.cause AS "cause", n.note AS "note",
            n.updated_by AS "updatedBy", TO_CHAR(n.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "updatedAt"
       FROM custody_break_notes n LEFT JOIN custody_instruments i ON i.isin = n.isin
      ORDER BY n.statement_date DESC, n.account_id, n.isin`);
}

export function parseBreakNotePatch(body: unknown): BreakNotePatch {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new CustodyValidationError('body must be an object');
  }
  const input = body as Record<string, unknown>;
  if (typeof input.author !== 'string' || !input.author.trim() || input.author.trim().length > 80) {
    throw new CustodyValidationError('author is required');
  }

  const patch: BreakNotePatch = { author: input.author.trim() };
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    if (input.status !== 'OPEN' && input.status !== 'CHASED' && input.status !== 'RESOLVED' && input.status !== 'WRITEOFF') {
      throw new CustodyValidationError('status must be OPEN, CHASED, RESOLVED, or WRITEOFF');
    }
    patch.status = input.status;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'cause')) {
    if (input.cause !== null && input.cause !== 'CORP_ACTION' && input.cause !== 'MISSING_CONFIRM' && input.cause !== 'OTHER') {
      throw new CustodyValidationError('cause must be CORP_ACTION, MISSING_CONFIRM, OTHER, or null');
    }
    patch.cause = input.cause;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'note')) {
    if (input.note !== null && typeof input.note !== 'string') {
      throw new CustodyValidationError('note must be a string or null');
    }
    if (typeof input.note === 'string' && input.note.trim().length > 2000) {
      throw new CustodyValidationError('note must be at most 2000 characters');
    }
    patch.note = typeof input.note === 'string' ? input.note.trim() || null : null;
  }
  if (!('status' in patch) && !('cause' in patch) && !('note' in patch)) {
    throw new CustodyValidationError('nothing to update');
  }
  return patch;
}

export function requireIsin(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v)) {
    throw new CustodyValidationError('isin must be a valid ISIN');
  }
  return v;
}

export async function patchBreakNote(accountId: number, isin: string, date: string, patch: BreakNotePatch): Promise<BreakNote | null> {
  if (!(await accountExists(accountId))) return null;
  const conn = await (await getPool()).getConnection();
  try {
    const key = { accountId, isin, breakDate: date };
    const current = (await conn.execute<{ status: Exclude<BreakStatus, 'NEW'>; cause: BreakCause | null; note: string | null }>(
      `SELECT status AS "status", cause AS "cause", note AS "note"
         FROM custody_break_notes
        WHERE account_id = :accountId AND isin = :isin AND statement_date = TO_DATE(:breakDate, 'YYYY-MM-DD')
        FOR UPDATE`, key,
    )).rows?.[0];
    const status = patch.status ?? current?.status ?? 'OPEN';
    const cause = 'cause' in patch ? patch.cause! : current?.cause ?? null;
    const note = 'note' in patch ? patch.note! : current?.note ?? null;
    const clock = (await conn.execute<{ now: Date; updatedAt: string }>(
      `SELECT now_value AS "now", TO_CHAR(now_value, 'YYYY-MM-DD"T"HH24:MI:SS') AS "updatedAt"
         FROM (SELECT LOCALTIMESTAMP(0) AS now_value FROM dual)`,
    )).rows?.[0];
    if (!clock) throw new Error('Could not read database time');

    if (current) {
      await conn.execute(
        `UPDATE custody_break_notes
            SET status = :status, cause = :cause, note = :note, updated_by = :author, updated_at = :now
          WHERE account_id = :accountId AND isin = :isin AND statement_date = TO_DATE(:breakDate, 'YYYY-MM-DD')`,
        { ...key, status, cause, note, author: patch.author, now: clock.now },
      );
    } else {
      await conn.execute(
        `INSERT INTO custody_break_notes (account_id, isin, statement_date, status, cause, note, updated_by, updated_at)
         VALUES (:accountId, :isin, TO_DATE(:breakDate, 'YYYY-MM-DD'), :status, :cause, :note, :author, :now)`,
        { ...key, status, cause, note, author: patch.author, now: clock.now },
      );
    }

    await conn.execute('LOCK TABLE custody_break_note_history IN EXCLUSIVE MODE');
    const historyId = (await conn.execute<{ historyId: number }>(
      `SELECT NVL(MAX(history_id), 0) + 1 AS "historyId" FROM custody_break_note_history`,
    )).rows?.[0]?.historyId;
    if (historyId === undefined) throw new Error('Could not allocate break-note history id');
    await conn.execute(
      `INSERT INTO custody_break_note_history
       (history_id, account_id, isin, statement_date, status, cause, note, changed_by, changed_at, source)
       VALUES (:historyId, :accountId, :isin, TO_DATE(:breakDate, 'YYYY-MM-DD'), :status, :cause, :note, :author, :now, 'USER')`,
      { historyId, ...key, status, cause, note, author: patch.author, now: clock.now },
    );
    await conn.commit();
    return { status, cause, note, updatedBy: patch.author, updatedAt: clock.updatedAt };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

export async function getBreakHistory(accountId: number, isin: string, date: string): Promise<BreakNoteHistory[] | null> {
  if (!(await accountExists(accountId))) return null;
  return query<BreakNoteHistory>(
    `SELECT status AS "status", cause AS "cause", note AS "note", changed_by AS "updatedBy",
            TO_CHAR(changed_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "updatedAt", source AS "source"
       FROM custody_break_note_history
      WHERE account_id = :accountId AND isin = :isin AND statement_date = TO_DATE(:breakDate, 'YYYY-MM-DD')
      ORDER BY changed_at DESC, history_id DESC`,
    { accountId, isin, breakDate: date },
  );
}

// --- Raw messages & ingestion admin (US4 / US5) ----------------------------------------------

/** Legacy MessageBrowser GridView page size. */
export const MESSAGE_PAGE_SIZE = 50;

export type MessageTypeFilter = '535' | '54x' | '544' | '545' | '546' | '547';

/** Accepts `535`, `MT535`, `54x`, `MT54x` (case-insensitive); undefined/'' → no filter. */
export function parseMessageType(v: unknown): MessageTypeFilter | undefined {
  if (v === undefined || v === '') return undefined;
  const s = String(v).trim().toUpperCase().replace(/^MT/, '');
  if (s === '535' || s === '54X' || s === '544' || s === '545' || s === '546' || s === '547') {
    return (s === '54X' ? '54x' : s) as MessageTypeFilter;
  }
  throw new CustodyValidationError('type must be 535, 54x, 544, 545, 546 or 547');
}

const messageWhere = (f: { type?: MessageTypeFilter; date?: string; safe?: number }) => {
  const conds: string[] = [];
  const binds: oracledb.BindParameters = {};
  if (f.type === '535') conds.push('mt_type = 535');
  else if (f.type === '54x') conds.push('mt_type BETWEEN 544 AND 547');
  else if (f.type) { conds.push('mt_type = :mt'); binds.mt = Number(f.type); }
  if (f.date) { conds.push(`business_date = TO_DATE(:d, 'YYYY-MM-DD')`); binds.d = f.date; }
  if (f.safe !== undefined) { conds.push('safe_no = :safe'); binds.safe = f.safe; }
  return { where: conds.length ? ' WHERE ' + conds.join(' AND ') : '', binds };
};

const MESSAGE_ROW_COLS = `message_id AS "messageId", mt_type AS "mtType", function_code AS "functionCode",
  safe_no AS "safeNo", ${isoCol('business_date', 'businessDate')}, source_file AS "sourceFile",
  parse_status AS "parseStatus", DBMS_LOB.GETLENGTH(raw_text) AS "sizeBytes"`;

/** Stored messages, 50 per page, ordered by source file (ordinal — matches the legacy browser). */
export async function listMessages(f: { type?: MessageTypeFilter; date?: string; safe?: number; page?: number } = {}): Promise<CustodyMessagePage> {
  const page = f.page ?? 1;
  const { where, binds } = messageWhere(f);
  const [rows, total] = await Promise.all([
    query<CustodyMessageRow>(`SELECT ${MESSAGE_ROW_COLS} FROM custody_messages${where}
      ORDER BY NLSSORT(source_file, 'NLS_SORT=BINARY') OFFSET :o ROWS FETCH NEXT :n ROWS ONLY`,
      { ...binds, o: (page - 1) * MESSAGE_PAGE_SIZE, n: MESSAGE_PAGE_SIZE }),
    query<{ N: number }>(`SELECT COUNT(*) AS n FROM custody_messages${where}`, binds),
  ]);
  return { rows, page, total: Number(total[0]?.N ?? 0) };
}

/** One message with its exact raw text (CLOB → JS string) and its derived statement/confirmation. */
export async function getMessage(id: number): Promise<CustodyMessage | null> {
  const conn = await (await getPool()).getConnection();
  let msg: (CustodyMessageRow & { rawText: string; parseError: string | null; contentSha256: string }) | undefined;
  try {
    const rows = (await conn.execute<Record<string, unknown>>(
      `SELECT ${MESSAGE_ROW_COLS}, raw_text AS "rawText", parse_error AS "parseError", content_sha256 AS "contentSha256"
         FROM custody_messages WHERE message_id = :id`,
      { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo: { rawText: { type: oracledb.STRING } } })).rows ?? [];
    msg = rows[0] as unknown as typeof msg;
  } finally {
    await conn.close();
  }
  if (!msg) return null;
  return { ...msg, derived: await messageDerived(id, msg.mtType) };
}

async function messageDerived(messageId: number, mtType: number): Promise<CustodyMessageDerived | null> {
  if (mtType === 535) {
    const r = (await query<{ accountId: number | null; clientId: number | null; date: string; functionCode: string; effective: number; lineCount: number }>(
      `SELECT s.account_id AS "accountId", a.client_id AS "clientId", ${isoCol('s.statement_date', 'date')},
              s.function_code AS "functionCode", s.is_effective AS "effective",
              (SELECT COUNT(*) FROM custody_statement_lines l WHERE l.statement_id = s.statement_id) AS "lineCount"
         FROM custody_statements s LEFT JOIN custody_accounts a ON a.account_id = s.account_id
        WHERE s.message_id = :id`, { id: messageId }))[0];
    return r ? { kind: 'statement', ...r, effective: r.effective === 1 } : null;
  }
  const r = (await query<{ confirmationId: number; accountId: number | null; clientId: number | null; date: string;
    reference: string; isin: string; functionCode: string; cancelledBy: number | null }>(
    `SELECT c.confirmation_id AS "confirmationId", c.account_id AS "accountId", a.client_id AS "clientId",
            ${isoCol('c.settle_date', 'date')}, c.seme AS "reference", TRIM(c.isin) AS "isin",
            c.function_code AS "functionCode", c.cancelled_by AS "cancelledBy"
       FROM custody_confirmations c LEFT JOIN custody_accounts a ON a.account_id = c.account_id
      WHERE c.message_id = :id`, { id: messageId }))[0];
  if (!r) return null;
  const [byMsg, cancelsMsg] = await Promise.all([
    r.cancelledBy === null ? Promise.resolve(null)
      : query<{ M: number }>(`SELECT message_id AS m FROM custody_confirmations WHERE confirmation_id = :id`, { id: r.cancelledBy }).then(x => x[0]?.M ?? null),
    r.functionCode === 'CANC'
      ? query<{ M: number }>(`SELECT message_id AS m FROM custody_confirmations WHERE cancelled_by = :id`, { id: r.confirmationId }).then(x => x[0]?.M ?? null)
      : Promise.resolve(null),
  ]);
  const { cancelledBy: _cb, ...rest } = r;
  return { kind: 'confirmation', ...rest, cancelsMessageId: cancelsMsg, cancelledByMessageId: byMsg };
}

// --- Ingestion admin -------------------------------------------------------------------------

const tsCol = (col: string, alias: string) => `TO_CHAR(${col}, 'YYYY-MM-DD"T"HH24:MI:SS') AS "${alias}"`;

type RunRow = { runId: number; startedAt: string; finishedAt: string | null; filesSeen: number; filesNew: number;
  filesDuplicate: number; parseErrors: number; triggeredBy: string };

const RUN_COLS = `run_id AS "runId", ${tsCol('started_at', 'startedAt')}, ${tsCol('finished_at', 'finishedAt')},
  files_seen AS "filesSeen", files_new AS "filesNew", files_duplicate AS "filesDuplicate",
  parse_errors AS "parseErrors", triggered_by AS "triggeredBy"`;

const toIngestRun = (r: RunRow): IngestRun => ({
  ...r,
  durationMs: r.finishedAt ? Date.parse(r.finishedAt) - Date.parse(r.startedAt) : null,
});

let ingestInFlight: Promise<unknown> | undefined;

/** A run row exists but never got a finished_at, or this process holds a run right now. */
const runInProgressNow = async () =>
  ingestInFlight !== undefined ||
  (await query(`SELECT 1 FROM custody_ingest_runs WHERE finished_at IS NULL AND ROWNUM = 1`)).length > 0;

/** Counts and the most recent run for the custody-admin screen (FR-019). */
export async function getIngestionStatus(): Promise<IngestionStatus> {
  const [lastRunRows, byType, counts, unmatched, errors] = await Promise.all([
    query<RunRow>(`SELECT ${RUN_COLS} FROM custody_ingest_runs WHERE run_id = (SELECT MAX(run_id) FROM custody_ingest_runs)`),
    query<{ mtType: number; n: number }>(`SELECT mt_type AS "mtType", COUNT(*) AS "n" FROM custody_messages GROUP BY mt_type`),
    query<{ statements: number; effectiveStatements: number; confirmations: number }>(
      `SELECT (SELECT COUNT(*) FROM custody_statements) AS "statements",
              (SELECT COUNT(*) FROM custody_statements WHERE is_effective = 1) AS "effectiveStatements",
              (SELECT COUNT(*) FROM custody_confirmations) AS "confirmations" FROM dual`),
    query<{ N: number }>(`SELECT COUNT(*) AS n FROM custody_confirmations c WHERE c.function_code = 'CANC'
        AND NOT EXISTS (SELECT 1 FROM custody_confirmations x WHERE x.cancelled_by = c.confirmation_id)`),
    query<{ sourceFile: string; error: string }>(`SELECT source_file AS "sourceFile", parse_error AS "error"
        FROM custody_messages WHERE parse_status = 'ERROR' ORDER BY NLSSORT(source_file, 'NLS_SORT=BINARY')`),
  ]);
  return {
    lastRun: lastRunRows[0] ? toIngestRun(lastRunRows[0]) : null,
    messagesByType: Object.fromEntries(byType.map(t => [String(t.mtType), Number(t.n)])),
    statements: counts[0].statements,
    effectiveStatements: counts[0].effectiveStatements,
    confirmations: counts[0].confirmations,
    unmatchedCancellations: Number(unmatched[0]?.N ?? 0),
    errors,
    archiveRoot: defaultArchiveDir(),
    runInProgress: await runInProgressNow(),
  };
}

/** Thrown when an ingest is triggered while another run is in flight (one at a time, in-process). */
export class IngestBusyError extends Error {}

/**
 * Runs a full incremental ingest on a pooled connection (per-file commits; readers keep working).
 * `IngestBusyError` → 409 if a run is already in flight; `IngestConflictError` propagates (→ 409).
 */
export async function triggerIngestRun(opts: { triggeredBy?: string; archiveDir?: string } = {}): Promise<IngestRun> {
  if (ingestInFlight) throw new IngestBusyError('An ingest run is already in progress');
  const work = (async () => {
    const conn = await (await getPool()).getConnection();
    try {
      const summary = await ingestArchive(conn, opts.archiveDir ?? defaultArchiveDir(), { triggeredBy: opts.triggeredBy ?? 'admin-ui' });
      return summary.runId;
    } finally {
      await conn.close();
    }
  })();
  ingestInFlight = work;
  try {
    const runId = await work;
    const row = (await query<RunRow>(`SELECT ${RUN_COLS} FROM custody_ingest_runs WHERE run_id = :id`, { id: runId }))[0];
    return toIngestRun(row);
  } finally {
    ingestInFlight = undefined;
  }
}

export { IngestConflictError };
