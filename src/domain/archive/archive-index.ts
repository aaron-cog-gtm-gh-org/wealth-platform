// legacy: PV.Core/ArchiveIndex.cs - whole-archive index built at startup (Q7).
// The legacy static ArchiveIndex.Current singleton is replaced by an explicit value passed to callers.
import { MIN_DATE, tryParseYmd, type IsoDate } from '../date';
import { compareOrdinal, fileName, fileNameWithoutExtension, trimChars } from '../dotnet';
import { parseConfirm, parseStatement } from '../swift/parser';
import type { Mt535Statement, SettlementConfirm } from '../swift/models';
import type { ArchiveSource } from './source';

export type ArchiveMsgType = 'MT535' | 'MT54x';

/** legacy: ArchiveIndex.ArchiveFileEntry (FullPath is archive-relative here) */
export interface ArchiveFileEntry {
  path: string;
  fileName: string;
  msgType: ArchiveMsgType;
  /** date from the file name; MIN_DATE when it does not parse */
  date: IsoDate;
  /** second `_` part of the file name; null with fewer than 3 parts */
  safeCode: string | null;
  size: number;
}

export interface ArchiveParseError {
  fileName: string;
  message: string;
}

export interface ArchiveIndex {
  root: string;
  /** ISO timestamp from the injected clock; null without one */
  loadedAt: string | null;
  loadMs: number;
  mt535Count: number;
  mt54xCount: number;
  parseErrors: number;
  /** legacy log4net "archive parse error <file>: <message>" warnings */
  parseErrorLog: ArchiveParseError[];
  /** safe acct with leading zeros trimmed -> statement date -> statements for that day (file order) */
  statements: Map<string, Map<IsoDate, Mt535Statement[]>>;
  /** day folder -> confirmations in ordinal file-name order */
  confirmFolders: Map<string, SettlementConfirm[]>;
  /** every file, ordinal by path (Message Browser) */
  files: ArchiveFileEntry[];
}

export interface BuildOptions {
  /** wall clock for loadedAt/loadMs; omitted in pure tests */
  clock?: () => Date;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** legacy: ArchiveIndex.Build */
export function buildArchiveIndex(source: ArchiveSource, options: BuildOptions = {}): ArchiveIndex {
  const started = options.clock?.();
  const idx: ArchiveIndex = {
    root: source.root, loadedAt: null, loadMs: 0, mt535Count: 0, mt54xCount: 0, parseErrors: 0,
    parseErrorLog: [], statements: new Map(), confirmFolders: new Map(), files: [],
  };
  const fail = (path: string, e: unknown) => {
    idx.parseErrors++;
    idx.parseErrorLog.push({ fileName: fileName(path), message: errorMessage(e) });
  };
  const byOrdinal = <T extends { path: string }>(xs: T[]) => [...xs].sort((a, b) => compareOrdinal(a.path, b.path));
  const listing = source.list();

  for (const f of byOrdinal(listing.mt535 ?? [])) {
    idx.mt535Count++;
    idx.files.push(makeEntry(f.path, f.size, 'MT535'));
    try {
      const st = parseStatement(source.read(f.path), f.path);
      const key = st.safekeepingAcct !== null ? trimChars(st.safekeepingAcct, '0', 'start') : '';
      let byDate = idx.statements.get(key);
      if (!byDate) idx.statements.set(key, (byDate = new Map()));
      let day = byDate.get(st.statementDate);
      if (!day) byDate.set(st.statementDate, (day = []));
      day.push(st);
    } catch (e) {
      fail(f.path, e);
    }
  }

  const folders = [...(listing.mt54x ?? [])].sort((a, b) => compareOrdinal(a.folder, b.folder));
  for (const dir of folders) {
    const confs: SettlementConfirm[] = [];
    for (const f of byOrdinal(dir.files)) {
      idx.mt54xCount++;
      idx.files.push(makeEntry(f.path, f.size, 'MT54x'));
      try {
        confs.push(parseConfirm(source.read(f.path), f.path));
      } catch (e) {
        fail(f.path, e);
      }
    }
    // Directory.GetFiles order is not guaranteed; keep name order
    confs.sort((a, b) => compareOrdinal(fileName(a.filePath ?? ''), fileName(b.filePath ?? '')));
    idx.confirmFolders.set(dir.folder, confs);
  }

  idx.files.sort((a, b) => compareOrdinal(a.path, b.path));
  if (options.clock && started) {
    const done = options.clock();
    idx.loadedAt = done.toISOString();
    idx.loadMs = done.getTime() - started.getTime();
  }
  return idx;
}

/** legacy: ArchiveIndex.MakeEntry - MT535_<safe>_<yyyyMMdd>_NNN.txt / MT54n_<safe>_<yyyyMMdd>_NNN.txt */
export function makeEntry(path: string, size: number, msgType: ArchiveMsgType): ArchiveFileEntry {
  const parts = fileNameWithoutExtension(path).split('_');
  const ok = parts.length >= 3;
  return {
    path, fileName: fileName(path), msgType, size,
    safeCode: ok ? parts[1] : null,
    date: (ok ? tryParseYmd(parts[2]) : null) ?? MIN_DATE,
  };
}

/** Indexed lookup for raw-file access (never build paths from user input). */
export function findArchiveFile(idx: ArchiveIndex, path: string): ArchiveFileEntry | null {
  let lo = 0;
  let hi = idx.files.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = compareOrdinal(idx.files[mid].path, path);
    if (c === 0) return idx.files[mid];
    if (c < 0) lo = mid + 1; else hi = mid - 1;
  }
  return null;
}

/** MessageBrowser.ShowFile: the first index entry (index order) with this file name; never a path built from input. */
export function findArchiveFileByName(idx: ArchiveIndex, fileName: string): ArchiveFileEntry | null {
  return idx.files.find(f => f.fileName === fileName) ?? null;
}

/** Statement key used by the index: safekeeping account without leading zeros. */
export const statementKey = (safeCode: string) => trimChars(safeCode, '0', 'start');
