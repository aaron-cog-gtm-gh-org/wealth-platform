// legacy: PV.Core/PositionCheck.cs - statement vs settlements check (Q11).
import { addDays, type IsoDate } from '../date';
import { Decimal } from '../decimal';
import { compareOrdinal } from '../dotnet';
import type { ArchiveIndex } from '../archive/archive-index';
import { getSettlements } from '../archive/settlements';
import type { Mt535Statement } from '../swift/models';
import { getPrevious, getStatement, getStatementDates, instrumentName } from './position-builder';
import type { AccountRef, InstrumentNameProvider, ReconNote, ReconNoteProvider } from './providers';

export const NO_PREVIOUS_STATEMENT = 'No previous statement on file.';
export const DEFAULT_STATUS = 'NEW';

export interface PositionCheckRow {
  isin: string;
  instrument: string;
  prevQty: Decimal;
  netSettled: Decimal;
  expected: Decimal;
  stmtQty: Decimal;
  /** stmtQty - expected */
  diff: Decimal;
  status: string;
  note: string | null;
  updatedBy: string | null;
  updatedDt: string | null;
}

export interface PositionCheckResult {
  prevStmtDate: IsoDate | null;
  /** set when there is no previous statement (no rows then) */
  noPrevMessage: string | null;
  rows: PositionCheckRow[];
  /** statement for stmtDate; null when missing (all stmt quantities are then 0) */
  statement: Mt535Statement | null;
}

export interface PositionCheckDeps {
  index: ArchiveIndex | null;
  instruments: InstrumentNameProvider;
  notes: ReconNoteProvider;
}

const nullKey = () => new TypeError('Value cannot be null. (Parameter \'key\')');
const noteKey = (isin: string) => isin.trim().toUpperCase();

/** legacy: PositionCheck.Run */
export async function runPositionCheck(deps: PositionCheckDeps, acct: AccountRef, stmtDate: IsoDate): Promise<PositionCheckResult> {
  const { index } = deps;
  const current = getStatement(index, acct.safeCode, stmtDate);
  const res: PositionCheckResult = { prevStmtDate: null, noPrevMessage: null, rows: [], statement: current };
  const previous = getPrevious(index, acct.safeCode, stmtDate);
  if (!previous) {
    res.noPrevMessage = NO_PREVIOUS_STATEMENT;
    return res;
  }
  res.prevStmtDate = previous.statementDate;
  const settles = getSettlements(index, acct.safeCode.padStart(7, '0'), addDays(previous.statementDate, 1), stmtDate);

  const prevQty = new Map<string, Decimal>();
  for (const l of previous.lines) prevQty.set(l.isin!, l.qty);
  const stmtQty = new Map<string, Decimal>();
  if (current) for (const l of current.lines) stmtQty.set(l.isin!, l.qty);
  const net = new Map<string, Decimal>();
  const isins = new Set<string | null>([...prevQty.keys(), ...stmtQty.keys()]);
  for (const s of settles) {
    isins.add(s.isin);
    if (s.isin === null) throw nullKey(); // Dictionary<string,..> rejects a null key
    const q = net.get(s.isin) ?? Decimal.ZERO;
    net.set(s.isin, s.direction === 'REC' ? q.add(s.qty) : q.sub(s.qty));
  }

  // ReconNoteData.GetNotes: OrdinalIgnoreCase dictionary on the trimmed ISIN, later rows win
  const notes = new Map<string, ReconNote>();
  for (const n of await deps.notes.getNotes(acct.acctId, stmtDate)) notes.set(noteKey(n.isin), n);

  for (const isin of isins) {
    if (isin === null) throw nullKey();
    const pq = prevQty.get(isin) ?? Decimal.ZERO;
    const ns = net.get(isin) ?? Decimal.ZERO;
    const sq = stmtQty.get(isin) ?? Decimal.ZERO;
    const expected = pq.add(ns);
    if (expected.sub(sq).isZero()) continue; // no tolerance
    const n = notes.get(noteKey(isin));
    res.rows.push({
      isin, instrument: instrumentName(deps.instruments, isin), prevQty: pq, netSettled: ns, expected, stmtQty: sq,
      diff: sq.sub(expected), status: n ? n.status : DEFAULT_STATUS, note: n?.note ?? null,
      updatedBy: n?.updatedBy ?? null, updatedDt: n?.updatedDt ?? null,
    });
  }
  res.rows.sort((a, b) => compareOrdinal(a.isin, b.isin));
  return res;
}

export interface CheckAllAccount extends AccountRef {
  acctNo: string;
  clientName: string | null;
}

export interface CheckAllRow {
  acctId: number;
  acctNo: string;
  client: string | null;
  /** `-` without a previous statement, else the row count */
  diffs: string;
}

/** legacy: PositionCheck.aspx btnAll_Click - accounts (in the given order) with a statement on the date */
export async function checkAll(deps: PositionCheckDeps, accounts: CheckAllAccount[], stmtDate: IsoDate): Promise<CheckAllRow[]> {
  const rows: CheckAllRow[] = [];
  for (const a of accounts) {
    if (!getStatementDates(deps.index, a.safeCode).includes(stmtDate)) continue;
    const r = await runPositionCheck(deps, a, stmtDate);
    rows.push({ acctId: a.acctId, acctNo: a.acctNo, client: a.clientName, diffs: r.noPrevMessage !== null ? '-' : String(r.rows.length) });
  }
  return rows;
}
