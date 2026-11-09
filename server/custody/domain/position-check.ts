/** Statement-vs-settlements position check ported from PV `PositionCheck.Run`. Pure. */
import { fixedFromNumber, fixedToNumber, rescale, type Fixed } from '../swift/decimal';
import type { Confirmation, Statement } from '../swift/types';
import { addDays } from './dates';
import { previousStatement, statementFor, type StatementFile } from './holdings';
import { instrumentName, type InstrumentNames } from './instruments';
import { activeConfirmations, settlementsFor, type ArchivedConfirmation } from './settlements';

export const NO_PREVIOUS_MESSAGE = 'No previous statement on file.';

export interface ReconNote {
  isin: string;
  status: string;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface PositionCheckRow {
  isin: string;
  instrument: string;
  prevQty: number;
  netSettled: number;
  expected: number;
  stmtQty: number;
  /** stmtQty − expected; never 0. */
  diff: number;
  /** Note status, or `NEW` when the break has no note. */
  status: string;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface PositionCheckResult {
  prevStmtDate: string | null;
  /** Set (and rows empty) when there is no previous statement. */
  noPrevMessage: string | null;
  rows: PositionCheckRow[];
  statement: Statement | null;
}

/** Settlements counted for a check: settle date in (previous statement date, statement date]. */
export function positionCheckWindow(prevStmtDate: string, stmtDate: string): { from: string; to: string } {
  return { from: addDays(prevStmtDate, 1), to: stmtDate };
}

class Exact {
  private scale = 0;
  private units = 0n;

  add(value: Fixed): void {
    if (value.scale > this.scale) {
      this.units *= 10n ** BigInt(value.scale - this.scale);
      this.scale = value.scale;
    }
    this.units += rescale(value, this.scale);
  }

  get value(): Fixed {
    return { units: this.units, scale: this.scale };
  }
}

function sub(a: Fixed, b: Fixed): Fixed {
  const r = new Exact();
  r.add(a);
  r.add({ units: -b.units, scale: b.scale });
  return r.value;
}

/**
 * Compares `curr` against `prev` plus net settlements (REC +, DEL −) per ISIN. `settles` must
 * already be limited to the account and `positionCheckWindow`. Exact decimal arithmetic, no
 * tolerance: any non-zero difference is a row. Rows sorted by ISIN (ordinal).
 */
export function positionCheck(
  prev: Statement | null,
  curr: Statement | null,
  settles: readonly Confirmation[],
  notes: readonly ReconNote[] = [],
  names?: InstrumentNames,
): PositionCheckResult {
  const result: PositionCheckResult = { prevStmtDate: null, noPrevMessage: null, rows: [], statement: curr };
  if (!prev) {
    result.noPrevMessage = NO_PREVIOUS_MESSAGE;
    return result;
  }
  result.prevStmtDate = prev.statementDate;

  const prevQty = new Map<string, Fixed>();
  for (const l of prev.lines) prevQty.set(l.isin, fixedFromNumber(l.qty));
  const stmtQty = new Map<string, Fixed>();
  for (const l of curr?.lines ?? []) stmtQty.set(l.isin, fixedFromNumber(l.qty));

  const isins = new Set<string>([...prevQty.keys(), ...stmtQty.keys()]);
  const net = new Map<string, Exact>();
  for (const s of settles) {
    if (s.isin === null) throw new TypeError(`Settlement ${s.seme ?? '(no SEME)'} has no ISIN`);
    isins.add(s.isin);
    let sum = net.get(s.isin);
    if (!sum) net.set(s.isin, (sum = new Exact()));
    const q = fixedFromNumber(s.qty);
    sum.add(s.direction === 'REC' ? q : { units: -q.units, scale: q.scale });
  }

  const noteByIsin = new Map(notes.map((n) => [n.isin, n]));
  const zero: Fixed = { units: 0n, scale: 0 };
  for (const isin of isins) {
    const pq = prevQty.get(isin) ?? zero;
    const ns = net.get(isin)?.value ?? zero;
    const sq = stmtQty.get(isin) ?? zero;
    const expected = new Exact();
    expected.add(pq);
    expected.add(ns);
    const diff = sub(sq, expected.value);
    if (diff.units === 0n) continue;
    const note = noteByIsin.get(isin);
    result.rows.push({
      isin,
      instrument: instrumentName(isin, names),
      prevQty: fixedToNumber(pq),
      netSettled: fixedToNumber(ns),
      expected: fixedToNumber(expected.value),
      stmtQty: fixedToNumber(sq),
      diff: fixedToNumber(diff),
      status: note?.status ?? 'NEW',
      note: note?.note ?? null,
      updatedBy: note?.updatedBy ?? null,
      updatedAt: note?.updatedAt ?? null,
    });
  }
  result.rows.sort((a, b) => (a.isin < b.isin ? -1 : a.isin > b.isin ? 1 : 0));
  return result;
}

/**
 * PV `PositionCheck.Run` end to end for one account/statement date: picks the statement and the
 * latest strictly earlier one, applies cancellations (D2) and the settlement window, then checks.
 * `notes` are the recon notes for this account and statement date.
 */
export function runPositionCheck(
  statements: readonly StatementFile[],
  confirmations: readonly ArchivedConfirmation[],
  safeCode: string,
  stmtDate: string,
  notes: readonly ReconNote[] = [],
  names?: InstrumentNames,
): PositionCheckResult {
  const curr = statementFor(statements, safeCode, stmtDate);
  const prev = previousStatement(statements, safeCode, stmtDate);
  if (!prev) return positionCheck(null, curr, [], notes, names);
  const { from, to } = positionCheckWindow(prev.statementDate, stmtDate);
  return positionCheck(prev, curr, settlementsFor(activeConfirmations(confirmations), safeCode, from, to), notes, names);
}
