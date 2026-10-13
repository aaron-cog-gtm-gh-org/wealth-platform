// Custody (legacy Portfolio Viewer) data access — contracts/api.md. Stable signatures for story
// sessions: add new functions here rather than querying custody_* tables from routes.
// Decimals leave Oracle as strings (TO_CHAR ... 'TM9') and are normalized with `normalizeDec`.
import oracledb from 'oracledb';
import type {
  CustodyAccountSummary, CustodyAccountType, CustodyClientPage, CustodyClientRow, CustodyClientSummary, CustodyConfirmation,
  CustodyStatement, CustodyStatementDate, CustodyStatementLine, Currency, HouseholdDto, PortfolioDto, QtyType,
  BreakCause, BreakStatus, PositionBreak, PositionCheckResult,
} from '../../src/api/types';
import { getPool, query } from '../db/pool';
import { decSum, normalizeDec } from '../custody/decimal.js';
import { toCustodyHousehold, toCustodyPortfolio } from '../custody/platform-view.js';
import { confirmationFact, parseArchiveText, statementFact, type ArchiveEntry } from '../custody/archive.js';
import {
  buildRuleContext, positionChecksForAll, type AccountRef, type ConfirmationFact, type RuleMode, type StatementFact,
} from '../custody/rules.js';

export const PAGE_SIZE = 25;

/** Thrown for invalid request input; routes map it to `400 { error }`. */
export class CustodyValidationError extends Error {}

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
export async function listConfirmations(accountId: number, from = '0001-01-01', to = '9999-12-31'): Promise<CustodyConfirmation[]> {
  const rows = await query<Omit<CustodyConfirmation, 'direction' | 'freeOfPayment' | 'qty' | 'amount'> & { dir: string; qty: string; amount: string | null }>(
    `SELECT c.confirmation_id AS "confirmationId", c.mt_type AS "mtType", c.direction AS "dir", ${isoCol('c.trade_date', 'tradeDate')},
            ${isoCol('c.settle_date', 'settleDate')}, TRIM(c.isin) AS "isin", NVL(i.name, TRIM(c.isin)) AS "name", ${decCol('c.qty', 'qty')},
            c.qty_type AS "qtyType", ${decCol('c.amount', 'amount')}, TRIM(c.amount_ccy) AS "amountCcy", c.seme AS "reference",
            c.message_id AS "messageId"
       FROM custody_confirmations c LEFT JOIN custody_instruments i ON i.isin = c.isin
      WHERE c.account_id = :a AND c.function_code <> 'CANC' AND c.cancelled_by IS NULL
        AND c.settle_date BETWEEN TO_DATE(:f, 'YYYY-MM-DD') AND TO_DATE(:t, 'YYYY-MM-DD')
      ORDER BY c.settle_date DESC, c.confirmation_id DESC`, { a: accountId, f: from, t: to });
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
      accountId: o.accountId, safeNo: o.safeNo, isin: r.isin, name: nameOf.get(r.isin) ?? r.isin, qtyType: r.qtyType,
      previousQty: r.previousQty, settledNet: r.settledNet, expectedQty: r.expectedQty, reportedQty: r.reportedQty, difference: r.difference,
      status: n?.status ?? 'NEW', cause: n?.cause ?? null, note: n?.note ?? null, updatedBy: n?.updatedBy ?? null, updatedAt: n?.updatedAt ?? null,
      sourceMessageIds: [o.previousRef, o.statementRef, ...r.settlementRefs].filter((x): x is string => !!x).map(Number),
    };
  }));
  return { date: opts.date ?? '', mode, accountsChecked: accounts.length, breaks };
}
