// Legacy archive layout: <root>/mt535/MT535_<safe>_<yyyyMMdd>_<seq>.txt and
// <root>/mt54x/<yyyyMMdd>/MT54n_<safe>_<yyyyMMdd>_<seq>.txt. Shared by ingest and parity tests.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfirmationFact, StatementFact } from './rules.js';
import { parseMt535, type Mt535Statement } from './swift/mt535.js';
import { parseMt54x, type Mt54xConfirmation } from './swift/mt54x.js';
import { parseSwiftDate } from './swift/parse.js';

export interface ArchiveEntry {
  /** `mt535` or `mt54x/<yyyyMMdd>` (POSIX separators). */
  sourceFolder: string;
  fileName: string;
  /** `<sourceFolder>/<fileName>`; unique key of a message (custody_messages.source_file). */
  sourceFile: string;
  family: 'MT535' | 'MT54x';
  /** Day folder name for MT54x (legacy cancels within it), `mt535` for statements. */
  folder: string;
  /** Business date from the file name. */
  businessDate: string;
  fileSeq: number;
}

const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const txt = (dir: string) => readdirSync(dir).filter(f => f.toLowerCase().endsWith('.txt')).sort(ordinal);

/** Trailing `_NNN` of the file name, 0 when absent (legacy `SwiftParser.FileSeq`). */
export function fileSeqOf(fileName: string): number {
  const base = fileName.replace(/\.[^.]*$/, '');
  const m = /_(\d+)$/.exec(base);
  return m ? Number(m[1]) : 0;
}

function entry(sourceFolder: string, fileName: string, family: ArchiveEntry['family'], folder: string): ArchiveEntry {
  const parts = fileName.replace(/\.[^.]*$/, '').split('_');
  let businessDate = '';
  try { businessDate = parseSwiftDate(parts[2] ?? ''); } catch { /* fall back to folder */ }
  if (!businessDate && /^\d{8}$/.test(folder)) businessDate = parseSwiftDate(folder);
  return { sourceFolder, fileName, sourceFile: `${sourceFolder}/${fileName}`, family, folder, businessDate, fileSeq: fileSeqOf(fileName) };
}

/** Every archive file in a stable (ordinal) order. */
export function listArchive(root: string): ArchiveEntry[] {
  const out: ArchiveEntry[] = [];
  const d535 = join(root, 'mt535');
  if (existsSync(d535)) for (const f of txt(d535)) out.push(entry('mt535', f, 'MT535', 'mt535'));
  const d54x = join(root, 'mt54x');
  if (existsSync(d54x)) {
    for (const day of readdirSync(d54x, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort(ordinal)) {
      for (const f of txt(join(d54x, day))) out.push(entry(`mt54x/${day}`, f, 'MT54x', day));
    }
  }
  return out;
}

export const readArchiveBytes = (root: string, e: ArchiveEntry): Buffer => readFileSync(join(root, ...e.sourceFile.split('/')));
export const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

export type ParsedArchiveFile =
  | { entry: ArchiveEntry; kind: 'statement'; statement: Mt535Statement }
  | { entry: ArchiveEntry; kind: 'confirmation'; confirmation: Mt54xConfirmation }
  | { entry: ArchiveEntry; kind: 'error'; error: string };

export function parseArchiveText(e: ArchiveEntry, text: string): ParsedArchiveFile {
  try {
    return e.family === 'MT535'
      ? { entry: e, kind: 'statement', statement: parseMt535(text) }
      : { entry: e, kind: 'confirmation', confirmation: parseMt54x(text) };
  } catch (err) {
    return { entry: e, kind: 'error', error: (err as Error).message };
  }
}

export const statementFact = (e: ArchiveEntry, s: Mt535Statement, messageId?: number): StatementFact => ({
  ref: messageId !== undefined ? String(messageId) : e.fileName, messageId,
  safeRaw: s.safeRaw, safeNo: s.safeNo, date: s.statementDate, functionCode: s.functionCode,
  fileSeq: e.fileSeq, isEmpty: s.isEmpty, lines: s.lines.map(l => ({ isin: l.isin, qty: l.qty, qtyType: l.qtyType })),
});

export const confirmationFact = (e: ArchiveEntry, c: Mt54xConfirmation, messageId?: number): ConfirmationFact => ({
  ref: messageId !== undefined ? String(messageId) : e.fileName, messageId, folder: e.folder,
  safeRaw: c.safeRaw, safeNo: c.safeNo, seme: c.seme, prevRef: c.prevRef, functionCode: c.functionCode,
  settleDate: c.settleDate, isin: c.isin, qty: c.qty, qtyType: c.qtyType, direction: c.direction, amountRaw: c.amountRaw,
});

export interface ArchiveFacts {
  files: ParsedArchiveFile[];
  statements: StatementFact[];
  confirmations: ConfirmationFact[];
  errors: { sourceFile: string; error: string }[];
}

/** Parse a whole archive directory into rule facts (refs = file names). */
export function loadArchiveFacts(root: string): ArchiveFacts {
  const files = listArchive(root).map(e => parseArchiveText(e, readArchiveBytes(root, e).toString('utf8')));
  return factsFrom(files);
}

export function factsFrom(files: ParsedArchiveFile[]): ArchiveFacts {
  const statements: StatementFact[] = [];
  const confirmations: ConfirmationFact[] = [];
  const errors: ArchiveFacts['errors'] = [];
  for (const f of files) {
    if (f.kind === 'statement') statements.push(statementFact(f.entry, f.statement));
    else if (f.kind === 'confirmation') confirmations.push(confirmationFact(f.entry, f.confirmation));
    else errors.push({ sourceFile: f.entry.sourceFile, error: f.error });
  }
  return { files, statements, confirmations, errors };
}
