// Injected reference data for positions/reconciliation (constitution II). Spec 004 supplies the
// PostgreSQL-backed implementations; tests use the in-memory ones below.
import type { IsoDate } from '../date';

/** legacy: PV.Data/InstrumentData (whole ISIN -> name map, cached until restart, Q13) */
export interface InstrumentNameProvider {
  getName(isin: string): string | null;
}

/** legacy: PV.Data/ReconNoteData.ReconNote */
export interface ReconNote {
  acctId: number;
  isin: string;
  stmtDate: IsoDate;
  /** raw STATUS_CD (mixed codes such as O / C / RESOLVED are not mapped, Q12) */
  status: string;
  note: string | null;
  updatedBy: string | null;
  /** `yyyy-MM-ddTHH:mm:ss.fff` local timestamp as stored */
  updatedDt: string | null;
}

/** legacy: ReconNoteData.GetNotes(acctId, stmtDate) */
export interface ReconNoteProvider {
  getNotes(acctId: number, stmtDate: IsoDate): ReconNote[] | Promise<ReconNote[]>;
}

/** The account fields PositionCheck.Run reads (legacy AccountRow). */
export interface AccountRef {
  acctId: number;
  safeCode: string;
}

export function mapInstrumentNames(names: Iterable<readonly [string, string]>): InstrumentNameProvider {
  const map = new Map<string, string>();
  for (const [isin, name] of names) map.set(isin.trim(), name);
  return { getName: isin => map.get(isin) ?? null };
}

export function memoryNotes(notes: ReconNote[]): ReconNoteProvider {
  return { getNotes: (acctId, stmtDate) => notes.filter(n => n.acctId === acctId && n.stmtDate === stmtDate) };
}
