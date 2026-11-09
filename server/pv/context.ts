// Process-wide archive index (legacy ArchiveIndex.Current/Reload) and PostgreSQL-backed providers.
import { buildArchiveIndex, type ArchiveIndex } from '../../src/domain/archive/archive-index';
import type { IsoDate } from '../../src/domain/date';
import { mapInstrumentNames, type InstrumentNameProvider, type ReconNote, type ReconNoteProvider } from '../../src/domain/positions/providers';
import { query } from '../db/pool';
import { fsArchiveSource } from './archive-fs';

let index: ArchiveIndex | null = null;
let instruments: InstrumentNameProvider | null = null;
export const archiveRoot = () => fsArchiveSource().root;

export function getIndex(): ArchiveIndex {
  index ??= buildArchiveIndex(fsArchiveSource(), { clock: () => new Date() });
  return index;
}
export function reloadIndex(): ArchiveIndex {
  index = buildArchiveIndex(fsArchiveSource(), { clock: () => new Date() });
  return index;
}

/** legacy: InstrumentData.GetNameMap - whole map, cached until restart (Q13) */
export async function getInstruments(): Promise<InstrumentNameProvider> {
  if (!instruments) {
    const rows = await query<{ isin: string; instr_name: string }>('SELECT isin, instr_name FROM pv.instrument');
    instruments = mapInstrumentNames(rows.map(r => [r.isin, r.instr_name] as const));
  }
  return instruments;
}

interface NoteRow { acct_id: number; isin: string; stmt_dt: string; status_cd: string; note_txt: string | null; updated_by: string | null; updated_dt: string | null }
const NOTE_COLS = `acct_id, trim(isin) AS isin, to_char(stmt_dt, 'YYYY-MM-DD') AS stmt_dt, status_cd, note_txt, updated_by,
  to_char(updated_dt, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS updated_dt`;

/** legacy: ReconNoteData.GetNotes */
export const pgReconNotes: ReconNoteProvider = {
  async getNotes(acctId: number, stmtDate: IsoDate): Promise<ReconNote[]> {
    const rows = await query<NoteRow>(`SELECT ${NOTE_COLS} FROM pv.recon_note WHERE acct_id = $1 AND stmt_dt = $2`, [acctId, stmtDate]);
    return rows.map(r => ({ acctId: r.acct_id, isin: r.isin, stmtDate: r.stmt_dt, status: r.status_cd, note: r.note_txt, updatedBy: r.updated_by, updatedDt: r.updated_dt }));
  },
};

/** legacy: ReconNoteData.SaveNote - update first, insert when nothing matched */
export async function saveNote(acctId: number, isin: string, stmtDate: IsoDate, status: string, note: string | null, userName: string): Promise<ReconNote> {
  const set = [acctId, isin, stmtDate, status, note, userName];
  let rows = await query<NoteRow>(`UPDATE pv.recon_note SET status_cd = $4, note_txt = $5, updated_by = $6, updated_dt = localtimestamp(3)
    WHERE acct_id = $1 AND isin = $2 AND stmt_dt = $3 RETURNING ${NOTE_COLS}`, set);
  if (rows.length === 0) {
    rows = await query<NoteRow>(`INSERT INTO pv.recon_note (acct_id, isin, stmt_dt, status_cd, note_txt, updated_by, updated_dt)
      VALUES ($1, $2, $3, $4, $5, $6, localtimestamp(3)) RETURNING ${NOTE_COLS}`, set);
  }
  const r = rows[0];
  return { acctId: r.acct_id, isin: r.isin, stmtDate: r.stmt_dt, status: r.status_cd, note: r.note_txt, updatedBy: r.updated_by, updatedDt: r.updated_dt };
}
