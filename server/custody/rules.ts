// Pure custody business rules (no I/O). Every rule takes `mode`:
// - 'corrected' (default): the migrated behavior, fixing D-1..D-4 (research R-5).
// - 'legacy': reproduces legacy PV.Core BR-1..BR-5 exactly, for parity sign-off (FR-020).
// Inputs are plain facts so the same code runs over archive files (parity tests, harness diff)
// and over Oracle rows (repository). Story sessions extend this module; keep it I/O free.
import { decAdd, decRound, decSub, decIsZero, normalizeDec, type Dec } from './decimal.js';
import type { QtyType } from './swift/mt535.js';
import type { Direction } from './swift/mt54x.js';
import { parseSwiftAmount } from './swift/parse.js';

export type RuleMode = 'corrected' | 'legacy';
export const RULE_MODES: readonly RuleMode[] = ['corrected', 'legacy'];

/** One MT535 message as the rules see it. */
export interface StatementFact {
  /** Stable reference: archive file name (parity) or custody_messages.message_id (Oracle). */
  ref: string;
  messageId?: number;
  /** 97A::SAFE as sent; legacy keys off this text (BR-2). */
  safeRaw: string;
  safeNo: number;
  date: string;
  functionCode: string;
  /** `_NNN` suffix of the archive file name. */
  fileSeq: number;
  isEmpty: boolean;
  lines: { isin: string; qty: Dec; qtyType: QtyType }[];
}

/** One MT544–547 message as the rules see it. */
export interface ConfirmationFact {
  ref: string;
  messageId?: number;
  /** mt54x day folder (`yyyyMMdd`) the file was filed under; legacy cancels within it (BR-4). */
  folder: string;
  /** 97A::SAFE as sent; legacy matches this exact text (BR-3). */
  safeRaw: string;
  safeNo: number;
  seme: string;
  prevRef: string | null;
  functionCode: 'NEWM' | 'CANC';
  settleDate: string;
  isin: string;
  qty: Dec;
  qtyType: QtyType;
  direction: Direction;
  /** 19A::ESTT as sent (`GBP21637,5`), null when free of payment. */
  amountRaw: string | null;
}

/** An account to check: legacy `ACCOUNT.SAFE_CODE` text plus the normalized number. */
export interface AccountRef {
  accountId: number;
  safeCode: string;
  safeNo: number;
}

const byOrdinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// --- Statements -----------------------------------------------------------------------------

/** Statement lookup key: legacy strips leading zeros from the text (BR-2); corrected is numeric. */
export const statementKey = (s: Pick<StatementFact, 'safeRaw' | 'safeNo'>, mode: RuleMode): string =>
  mode === 'legacy' ? s.safeRaw.replace(/^0+/, '') : String(s.safeNo);

export const accountStatementKey = (a: AccountRef, mode: RuleMode): string =>
  mode === 'legacy' ? a.safeCode.replace(/^0+/, '') : String(a.safeNo);

const latestSeq = <T extends { fileSeq: number }>(xs: T[]): T | null =>
  xs.reduce<T | null>((best, x) => (!best || x.fileSeq > best.fileSeq ? x : best), null);

/**
 * Effective statement among the files for one (safe, date).
 * corrected (R-5, fixes D-4): latest `RPLC` by file seq → else latest `NEWM` → else latest of any.
 * legacy (BR-1): highest file seq wins, function code ignored.
 */
export function selectEffectiveStatement<T extends Pick<StatementFact, 'functionCode' | 'fileSeq'>>(candidates: T[], mode: RuleMode = 'corrected'): T | null {
  if (mode === 'legacy') return latestSeq(candidates);
  return latestSeq(candidates.filter(s => s.functionCode === 'RPLC'))
    ?? latestSeq(candidates.filter(s => s.functionCode === 'NEWM'))
    ?? latestSeq(candidates);
}

/** key → date → candidate files, as built by legacy `ArchiveIndex` (keys per `statementKey`). */
export type StatementIndex = Map<string, Map<string, StatementFact[]>>;

export function indexStatements(statements: StatementFact[], mode: RuleMode = 'corrected'): StatementIndex {
  const idx: StatementIndex = new Map();
  for (const s of statements) {
    const k = statementKey(s, mode);
    let byDate = idx.get(k);
    if (!byDate) idx.set(k, (byDate = new Map()));
    const day = byDate.get(s.date);
    if (day) day.push(s); else byDate.set(s.date, [s]);
  }
  return idx;
}

// --- Confirmations --------------------------------------------------------------------------

export interface CancellationResult {
  /** Non-CANC confirmations that are not cancelled. */
  active: ConfirmationFact[];
  /** ref of cancelled confirmation → ref of the CANC that cancelled it. */
  cancelledBy: Map<string, string>;
  /** CANCs whose PREV matched nothing (reported in the ingest summary). */
  unmatched: ConfirmationFact[];
}

/**
 * corrected (fixes D-3): a CANC cancels every confirmation with the same safe number and
 * `seme = prevRef`, wherever it was filed. legacy (BR-4): only confirmations in the CANC's own day
 * folder whose SEME equals PREV (any safe) are removed.
 */
export function applyCancellations(confirmations: ConfirmationFact[], mode: RuleMode = 'corrected'): CancellationResult {
  const cancelledBy = new Map<string, string>();
  const unmatched: ConfirmationFact[] = [];
  const cancels = confirmations.filter(c => c.functionCode === 'CANC');
  const live = confirmations.filter(c => c.functionCode !== 'CANC');
  const groupKey = (c: ConfirmationFact, seme: string) => (mode === 'legacy' ? `${c.folder}|${seme}` : `${c.safeNo}|${seme}`);
  const bySeme = new Map<string, ConfirmationFact[]>();
  for (const c of live) {
    const k = groupKey(c, c.seme);
    const list = bySeme.get(k);
    if (list) list.push(c); else bySeme.set(k, [c]);
  }
  for (const canc of cancels) {
    const targets = canc.prevRef ? bySeme.get(groupKey(canc, canc.prevRef)) ?? [] : [];
    if (!targets.length) unmatched.push(canc);
    for (const t of targets) if (!cancelledBy.has(t.ref)) cancelledBy.set(t.ref, canc.ref);
  }
  return { active: live.filter(c => !cancelledBy.has(c.ref)), cancelledBy, unmatched };
}

/** corrected: numeric safe match (fixes D-2); legacy (BR-3): exact text vs `SAFE_CODE.PadLeft(7,'0')`. */
export const confirmationMatchesAccount = (c: ConfirmationFact, a: AccountRef, mode: RuleMode = 'corrected'): boolean =>
  mode === 'legacy' ? c.safeRaw === a.safeCode.padStart(7, '0') : c.safeNo === a.safeNo;

/**
 * Legacy `SettlementReader.ToAmount` (BR-5): integer part + (fraction digits as an integer)/100,
 * so `GBP21637,5` → 21637.05 (D-1).
 */
export function legacyToAmount(raw: string): Dec {
  const parts = raw.slice(3).split(',');
  const toInt = (s: string) => {
    if (!/^[+-]?\d+$/.test(s.trim())) throw new Error(`Input string was not in a correct format: "${s}"`);
    return BigInt(s.trim());
  };
  const int = toInt(parts[0]);
  const frac = parts.length > 1 && parts[1].length > 0 ? toInt(parts[1]) : 0n;
  const cents = int * 100n + frac;
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  return `${neg ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

/** Settled amount in `mode` (corrected parses SWIFT decimals exactly, fixing D-1). */
export function confirmationAmount(amountRaw: string | null, mode: RuleMode = 'corrected'): Dec | null {
  if (amountRaw === null) return null;
  return mode === 'legacy' ? legacyToAmount(amountRaw) : parseSwiftAmount(amountRaw).amount;
}

// --- Reconciliation (position check) --------------------------------------------------------

export interface ReconciliationRow {
  isin: string;
  /** corrected reconciles per (ISIN, qty type); legacy ignores qty type and reports the first seen. */
  qtyType: QtyType;
  previousQty: Dec;
  settledNet: Dec;
  expectedQty: Dec;
  reportedQty: Dec;
  /** reported − expected. */
  difference: Dec;
  /** refs of the confirmations that fed `settledNet`. */
  settlementRefs: string[];
}

/** Statement quantity as legacy holds it: `Math.Round(qty, 4)` (banker's rounding). */
const lineQty = (q: Dec, mode: RuleMode) => (mode === 'legacy' ? decRound(q, 4, 'half-even') : q);

/**
 * BR-6/BR-7: expected = previous qty + Σ RECEIVE − Σ DELIVER over `settlements` (caller supplies the
 * window (previous date, date]); every non-zero difference is a break. Rows sorted by ISIN (BR-8).
 * corrected keys on (ISIN, qty type) and sums duplicate lines; legacy keys on ISIN, last line wins.
 */
export function reconcile(previous: StatementFact | null, current: StatementFact | null, settlements: ConfirmationFact[], mode: RuleMode = 'corrected'): ReconciliationRow[] {
  type Acc = { isin: string; qtyType: QtyType; prev: Dec; net: Dec; stmt: Dec; refs: string[] };
  const rows = new Map<string, Acc>();
  const key = (isin: string, qt: QtyType) => (mode === 'legacy' ? isin : `${isin}|${qt}`);
  const get = (isin: string, qt: QtyType) => {
    const k = key(isin, qt);
    let r = rows.get(k);
    if (!r) rows.set(k, (r = { isin, qtyType: qt, prev: '0', net: '0', stmt: '0', refs: [] }));
    return r;
  };
  for (const l of previous?.lines ?? []) {
    const r = get(l.isin, l.qtyType);
    r.prev = mode === 'legacy' ? lineQty(l.qty, mode) : decAdd(r.prev, l.qty);
  }
  for (const l of current?.lines ?? []) {
    const r = get(l.isin, l.qtyType);
    r.stmt = mode === 'legacy' ? lineQty(l.qty, mode) : decAdd(r.stmt, l.qty);
  }
  for (const s of settlements) {
    const r = get(s.isin, s.qtyType);
    r.net = s.direction === 'RECEIVE' ? decAdd(r.net, s.qty) : decSub(r.net, s.qty);
    r.refs.push(s.ref);
  }
  const out: ReconciliationRow[] = [];
  for (const r of rows.values()) {
    const expected = decAdd(r.prev, r.net);
    const diff = decSub(r.stmt, expected);
    if (decIsZero(diff)) continue;
    out.push({
      isin: r.isin, qtyType: r.qtyType, previousQty: normalizeDec(r.prev), settledNet: normalizeDec(r.net),
      expectedQty: expected, reportedQty: normalizeDec(r.stmt), difference: diff, settlementRefs: r.refs,
    });
  }
  return out.sort((a, b) => byOrdinal(a.isin, b.isin) || byOrdinal(a.qtyType, b.qtyType));
}

/** Pre-indexed inputs for many position checks over the same data. */
export interface RuleContext {
  mode: RuleMode;
  statements: StatementIndex;
  cancellations: CancellationResult;
}

export const buildRuleContext = (statements: StatementFact[], confirmations: ConfirmationFact[], mode: RuleMode = 'corrected'): RuleContext => ({
  mode, statements: indexStatements(statements, mode), cancellations: applyCancellations(confirmations, mode),
});

/** Statement dates on file for an account, newest first. */
export function statementDates(ctx: RuleContext, account: AccountRef): string[] {
  const byDate = ctx.statements.get(accountStatementKey(account, ctx.mode));
  return byDate ? [...byDate.keys()].sort().reverse() : [];
}

/** Effective statement for (account, date) in ctx.mode, or null. */
export function statementFor(ctx: RuleContext, account: AccountRef, date: string): StatementFact | null {
  const day = ctx.statements.get(accountStatementKey(account, ctx.mode))?.get(date);
  return day ? selectEffectiveStatement(day, ctx.mode) : null;
}

/** Active confirmations for an account with settle date in [from, to] (inclusive), newest first. */
export function settlementsFor(ctx: RuleContext, account: AccountRef, from: string, to: string): ConfirmationFact[] {
  return ctx.cancellations.active
    .filter(c => confirmationMatchesAccount(c, account, ctx.mode) && c.settleDate >= from && c.settleDate <= to)
    .sort((a, b) => byOrdinal(b.settleDate, a.settleDate));
}

export interface PositionCheckOutcome {
  accountId: number;
  safeNo: number;
  date: string;
  statementRef: string | null;
  previousDate: string | null;
  previousRef: string | null;
  /** Empty when there is no previous statement (legacy "No previous statement on file."). */
  rows: ReconciliationRow[];
}

const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Legacy `PositionCheck.Run` semantics for one (account, statement date), in ctx.mode. */
export function positionCheck(ctx: RuleContext, account: AccountRef, date: string): PositionCheckOutcome {
  const current = statementFor(ctx, account, date);
  const prevDate = statementDates(ctx, account).find(d => d < date) ?? null;
  const previous = prevDate ? statementFor(ctx, account, prevDate) : null;
  const base = { accountId: account.accountId, safeNo: account.safeNo, date, statementRef: current?.ref ?? null, previousDate: prevDate, previousRef: previous?.ref ?? null };
  if (!previous || !prevDate) return { ...base, rows: [] };
  const settles = settlementsFor(ctx, account, nextDay(prevDate), date);
  return { ...base, rows: reconcile(previous, current, settles, ctx.mode) };
}

/** Position check for every account and every statement date on file (oldest first). */
export function positionChecksForAll(ctx: RuleContext, accounts: AccountRef[], filter?: { date?: string }): PositionCheckOutcome[] {
  const out: PositionCheckOutcome[] = [];
  for (const a of accounts) {
    for (const d of statementDates(ctx, a).reverse()) {
      if (filter?.date && d !== filter.date) continue;
      out.push(positionCheck(ctx, a, d));
    }
  }
  return out;
}

export const countBreaks = (outcomes: PositionCheckOutcome[]): number => outcomes.reduce((n, o) => n + o.rows.length, 0);
