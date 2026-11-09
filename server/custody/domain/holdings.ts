/** Statement selection and holdings view, ported from PV `PositionBuilder` and `Holdings.aspx.cs`. Pure. */
import { fixedFromNumber, fixedToNumber, rescale } from '../swift/decimal';
import { safeKey } from '../swift/parse';
import type { Statement } from '../swift/types';
import { instrumentName, type InstrumentNames } from './instruments';

/** A parsed MT535 plus the `_NNN` sequence from its file name. */
export interface StatementFile {
  fileSeq: number;
  statement: Statement;
}

/**
 * Statements for one account keyed by statement date (98A::STAT), keeping the highest file
 * sequence per date (custodian resends). Accounts match on 97A::SAFE with leading zeros
 * stripped, as PV's archive index does. Ties keep the first in input order.
 */
export function statementsByDate(files: readonly StatementFile[], safeCode: string): Map<string, StatementFile> {
  const key = safeKey(safeCode);
  const byDate = new Map<string, StatementFile>();
  for (const file of files) {
    if (safeKey(file.statement.safekeepingAcct) !== key) continue;
    const best = byDate.get(file.statement.statementDate);
    if (!best || file.fileSeq > best.fileSeq) byDate.set(file.statement.statementDate, file);
  }
  return byDate;
}

/** Statement dates for the account, newest first. */
export function statementDates(files: readonly StatementFile[], safeCode: string): string[] {
  return [...statementsByDate(files, safeCode).keys()].sort().reverse();
}

/** The statement for an exact date (highest file sequence), or null. */
export function statementFor(files: readonly StatementFile[], safeCode: string, date: string): Statement | null {
  return statementsByDate(files, safeCode).get(date)?.statement ?? null;
}

export function latestStatement(files: readonly StatementFile[], safeCode: string): Statement | null {
  const [latest] = statementDates(files, safeCode);
  return latest === undefined ? null : statementFor(files, safeCode, latest);
}

/** Latest statement strictly before `date`, or null. */
export function previousStatement(files: readonly StatementFile[], safeCode: string, date: string): Statement | null {
  const earlier = statementDates(files, safeCode).find((d) => d < date);
  return earlier === undefined ? null : statementFor(files, safeCode, earlier);
}

export interface HoldingRow {
  isin: string;
  /** Reference-data name or `UNKNOWN INSTRUMENT <ISIN>`. */
  instrument: string;
  qty: number;
  qtyType: string;
  price: number;
  ccy: string;
  mktVal: number;
  mktValGbp: number;
}

export interface Holdings {
  statementDate: string;
  function: string | null;
  /** In statement order. */
  rows: HoldingRow[];
  /** Exact sum of `mktValGbp` (2 dp). */
  totalGbp: number;
}

export function holdings(statement: Statement, names?: InstrumentNames): Holdings {
  let total = 0n;
  const rows = statement.lines.map((line) => {
    total += rescale(fixedFromNumber(line.mktValGbp), 2);
    return {
      isin: line.isin,
      instrument: instrumentName(line.isin, names),
      qty: line.qty,
      qtyType: line.qtyType,
      price: line.price,
      ccy: line.ccy,
      mktVal: line.mktVal,
      mktValGbp: line.mktValGbp,
    };
  });
  return {
    statementDate: statement.statementDate,
    function: statement.function,
    rows,
    totalGbp: fixedToNumber({ units: total, scale: 2 }),
  };
}
