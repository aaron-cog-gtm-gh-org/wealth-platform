import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientBase } from 'pg';

export const ARCHIVE_DIR = fileURLToPath(new URL('./archive/', import.meta.url));

const FILE_NAME = /^MT(535|54[4-7])_(\d{1,10})_(\d{8})_(\d{3})\.txt$/;
const DAY = /^\d{8}$/;
const BATCH = 1000;

export interface ArchiveFile {
  fileName: string;
  relPath: string;
  family: 'MT535' | 'MT54x';
  mtType: number;
  safeCode: string;
  msgDate: string;
  fileSeq: number;
  dayFolder: string | null;
}

export interface ArchiveLoadResult {
  mt535: number;
  mt54x: number;
  inserted: number;
  updated: number;
  removed: number;
}

function isoDate(yyyymmdd: string, context: string) {
  const iso = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error(`Invalid date ${yyyymmdd} in ${context}`);
  return iso;
}

/** Metadata from an archive path: `mt535/<file>` or `mt54x/<yyyyMMdd>/<file>`. */
export function describeArchiveFile(relPath: string): ArchiveFile {
  const parts = relPath.split('/');
  const fileName = parts[parts.length - 1];
  const match = FILE_NAME.exec(fileName);
  if (!match) throw new Error(`Unexpected archive file name: ${relPath}`);
  const [, mt, safe, date, seq] = match;
  const family = mt === '535' ? 'MT535' : 'MT54x';
  if (family === 'MT535' && (parts.length !== 2 || parts[0] !== 'mt535')) throw new Error(`MT535 file outside mt535/: ${relPath}`);
  if (family === 'MT54x' && (parts.length !== 3 || parts[0] !== 'mt54x' || !DAY.test(parts[1]))) {
    throw new Error(`MT54x file outside mt54x/<yyyyMMdd>/: ${relPath}`);
  }
  const dayFolder = family === 'MT54x' ? parts[1] : null;
  if (dayFolder) isoDate(dayFolder, relPath);
  return {
    fileName,
    relPath,
    family,
    mtType: Number(mt),
    safeCode: safe.replace(/^0+(?=\d)/, ''),
    msgDate: isoDate(date, relPath),
    fileSeq: Number(seq),
    dayFolder,
  };
}

export function listArchiveFiles(dir = ARCHIVE_DIR): string[] {
  const files = readdirSync(join(dir, 'mt535')).filter(name => name.endsWith('.txt')).map(name => `mt535/${name}`);
  for (const day of readdirSync(join(dir, 'mt54x')).filter(name => DAY.test(name))) {
    for (const name of readdirSync(join(dir, 'mt54x', day)).filter(file => file.endsWith('.txt'))) files.push(`mt54x/${day}/${name}`);
  }
  return files.sort();
}

const UPSERT = `
INSERT INTO custody_messages AS m
  (file_name, rel_path, msg_family, mt_type, safe_code, msg_date, file_seq, day_folder, size_bytes, raw_text, parse_status)
SELECT f.*, 'pending'
FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::smallint[], $5::varchar[], $6::date[], $7::int[],
            $8::bpchar[], $9::int[], $10::text[]) AS f
ON CONFLICT (file_name) DO UPDATE SET
  rel_path = EXCLUDED.rel_path, msg_family = EXCLUDED.msg_family, mt_type = EXCLUDED.mt_type,
  safe_code = EXCLUDED.safe_code, msg_date = EXCLUDED.msg_date, file_seq = EXCLUDED.file_seq,
  day_folder = EXCLUDED.day_folder, size_bytes = EXCLUDED.size_bytes, raw_text = EXCLUDED.raw_text,
  parse_status = 'pending', parse_error = NULL
WHERE (m.rel_path, m.msg_family, m.mt_type, m.safe_code, m.msg_date, m.file_seq, m.day_folder, m.size_bytes, m.raw_text)
  IS DISTINCT FROM (EXCLUDED.rel_path, EXCLUDED.msg_family, EXCLUDED.mt_type, EXCLUDED.safe_code, EXCLUDED.msg_date,
                    EXCLUDED.file_seq, EXCLUDED.day_folder, EXCLUDED.size_bytes, EXCLUDED.raw_text)
RETURNING (xmax = 0) AS inserted`;

/**
 * Synchronises custody_messages with the archive folder: new files are inserted, changed files are
 * rewritten and set back to parse_status 'pending', files no longer on disk are removed. Unchanged
 * rows are left untouched, so re-running is a no-op.
 */
export async function loadArchive(client: ClientBase, dir = ARCHIVE_DIR): Promise<ArchiveLoadResult> {
  const files = listArchiveFiles(dir).map(describeArchiveFile);
  const result: ArchiveLoadResult = { mt535: 0, mt54x: 0, inserted: 0, updated: 0, removed: 0 };
  for (let start = 0; start < files.length; start += BATCH) {
    const batch = files.slice(start, start + BATCH);
    const raw = batch.map(file => readFileSync(join(dir, file.relPath)));
    const { rows } = await client.query<{ inserted: boolean }>(UPSERT, [
      batch.map(file => file.fileName),
      batch.map(file => file.relPath),
      batch.map(file => file.family),
      batch.map(file => file.mtType),
      batch.map(file => file.safeCode),
      batch.map(file => file.msgDate),
      batch.map(file => file.fileSeq),
      batch.map(file => file.dayFolder),
      raw.map(buffer => buffer.length),
      raw.map(buffer => buffer.toString('utf8')),
    ]);
    for (const row of rows) result[row.inserted ? 'inserted' : 'updated'] += 1;
  }
  const removed = await client.query('DELETE FROM custody_messages WHERE NOT (file_name = ANY($1::varchar[]))',
    [files.map(file => file.fileName)]);
  result.removed = removed.rowCount ?? 0;
  for (const file of files) result[file.family === 'MT535' ? 'mt535' : 'mt54x'] += 1;
  return result;
}
