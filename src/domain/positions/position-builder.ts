// legacy: PV.Core/PositionBuilder.cs - positions read off the statement index.
import { compareDates, type IsoDate } from '../date';
import type { Decimal } from '../decimal';
import type { ArchiveIndex } from '../archive/archive-index';
import { statementKey } from '../archive/archive-index';
import type { Mt535Statement } from '../swift/models';
import type { InstrumentNameProvider } from './providers';

const key = (safe: string | null) => (safe === null ? '' : statementKey(safe));
const byDate = (idx: ArchiveIndex | null, safe: string | null) => idx?.statements.get(key(safe)) ?? null;

/** legacy: GetStatementDates - newest first */
export function getStatementDates(idx: ArchiveIndex | null, safekeepingAcct: string | null): IsoDate[] {
  const m = byDate(idx, safekeepingAcct);
  return m ? [...m.keys()].sort((a, b) => compareDates(b, a)) : [];
}

/** legacy: GetStatement - highest file seq for the date wins, regardless of 23G (Q8) */
export function getStatement(idx: ArchiveIndex | null, safekeepingAcct: string | null, date: IsoDate): Mt535Statement | null {
  const day = byDate(idx, safekeepingAcct)?.get(date);
  if (!day || day.length === 0) return null;
  return day.reduce((best, s) => (s.fileSeq > best.fileSeq ? s : best));
}

/** legacy: GetLatest */
export function getLatest(idx: ArchiveIndex | null, safekeepingAcct: string | null): Mt535Statement | null {
  const dates = getStatementDates(idx, safekeepingAcct);
  return dates.length === 0 ? null : getStatement(idx, safekeepingAcct, dates[0]);
}

/** legacy: GetPrevious - latest statement strictly before the date */
export function getPrevious(idx: ArchiveIndex | null, safekeepingAcct: string | null, date: IsoDate): Mt535Statement | null {
  const m = byDate(idx, safekeepingAcct);
  if (!m) return null;
  let best: IsoDate | null = null;
  for (const d of m.keys()) if (d < date && (best === null || d > best)) best = d;
  return best === null ? null : getStatement(idx, safekeepingAcct, best);
}

/** legacy: InstrumentName - reference name, else `UNKNOWN INSTRUMENT <isin>` (Q13; statement description unused) */
export function instrumentName(names: InstrumentNameProvider, isin: string | null): string {
  const name = isin === null ? null : names.getName(isin);
  return name ?? `UNKNOWN INSTRUMENT ${isin ?? ''}`;
}

export interface HoldingLine {
  isin: string | null;
  instrumentName: string;
  msgDescription: string | null;
  qty: Decimal;
  qtyType: string | null;
  price: Decimal;
  ccy: string | null;
  mktVal: Decimal;
  mktValGbp: Decimal;
  fileName: string | null;
  fileSeq: number;
  function: string | null;
}

/** Holdings.aspx rows: the selected statement's lines in file order, named via the instrument provider. */
export function holdingLines(names: InstrumentNameProvider, st: Mt535Statement): HoldingLine[] {
  return st.lines.map(l => ({
    isin: l.isin, instrumentName: instrumentName(names, l.isin), msgDescription: l.msgDescription,
    qty: l.qty, qtyType: l.qtyType, price: l.price, ccy: l.ccy, mktVal: l.mktVal, mktValGbp: l.mktValGbp,
    fileName: st.fileName, fileSeq: st.fileSeq, function: st.function,
  }));
}
