// Reader for the legacy SQL Server seed scripts (data/legacy-pv/seed/0n_*.sql): single-row
// `INSERT INTO T (cols) VALUES (...)` statements with T-SQL literals ('..', N'..', NULL, numbers).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type SeedValue = string | number | null;
export type SeedRow = Record<string, SeedValue>;

const INSERT_RE = /^INSERT INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*)\)\s*;?\s*$/i;

function parseValues(s: string): SeedValue[] {
  const out: SeedValue[] = [];
  let i = 0;
  while (i < s.length) {
    while (s[i] === ' ' || s[i] === ',') i++;
    if (i >= s.length) break;
    if (s[i] === "'" || (s[i] === 'N' && s[i + 1] === "'")) {
      if (s[i] === 'N') i++;
      let v = '';
      i++;
      for (;;) {
        if (i >= s.length) throw new Error(`Unterminated string in: ${s}`);
        if (s[i] === "'") {
          if (s[i + 1] === "'") { v += "'"; i += 2; continue; }
          i++;
          break;
        }
        v += s[i++];
      }
      out.push(v);
    } else {
      let j = i;
      while (j < s.length && s[j] !== ',') j++;
      const tok = s.slice(i, j).trim();
      out.push(/^null$/i.test(tok) ? null : Number(tok));
      if (tok && !/^null$/i.test(tok) && Number.isNaN(Number(tok))) throw new Error(`Bad literal ${tok}`);
      i = j;
    }
  }
  return out;
}

/** Rows of every INSERT into `table` in one seed script. */
export function parseSeedInserts(sql: string, table?: string): SeedRow[] {
  const rows: SeedRow[] = [];
  for (const line of sql.split(/\r?\n/)) {
    const m = INSERT_RE.exec(line.trim());
    if (!m || (table && m[1].toUpperCase() !== table.toUpperCase())) continue;
    const cols = m[2].split(',').map(c => c.trim().toUpperCase());
    const vals = parseValues(m[3]);
    if (vals.length !== cols.length) throw new Error(`Column/value mismatch: ${line}`);
    rows.push(Object.fromEntries(cols.map((c, k) => [c, vals[k]])));
  }
  return rows;
}

export interface LegacySeed {
  users: SeedRow[];
  clients: SeedRow[];
  accounts: SeedRow[];
  instruments: SeedRow[];
  reconNotes: SeedRow[];
}

/** Read `01_APP_USER` … `05_RECON_NOTE` from a seed directory. */
export function readLegacySeed(dir: string): LegacySeed {
  const files = readdirSync(dir).filter(f => /^0[1-5]_.*\.sql$/i.test(f)).sort();
  const sql = (prefix: string) => {
    const f = files.find(x => x.startsWith(prefix));
    if (!f) throw new Error(`Legacy seed ${prefix}_*.sql not found in ${dir}`);
    return readFileSync(join(dir, f), 'utf8');
  };
  return {
    users: parseSeedInserts(sql('01'), 'APP_USER'),
    clients: parseSeedInserts(sql('02'), 'CLIENT'),
    accounts: parseSeedInserts(sql('03'), 'ACCOUNT'),
    instruments: parseSeedInserts(sql('04'), 'INSTRUMENT'),
    reconNotes: parseSeedInserts(sql('05'), 'RECON_NOTE'),
  };
}

/** Accounts as rule inputs (legacy SAFE_CODE text kept for BR-2/BR-3). */
export const seedAccountRefs = (seed: LegacySeed) => seed.accounts
  .filter(a => a.SAFE_CODE !== null)
  .map(a => ({ accountId: Number(a.ACCT_ID), safeCode: String(a.SAFE_CODE), safeNo: Number(String(a.SAFE_CODE).trim()) }));
