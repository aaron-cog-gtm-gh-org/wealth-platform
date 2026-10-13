// One-time migration of legacy Portfolio Viewer reference data (FR-021/FR-022) from the SQL Server
// seed scripts into custody_* tables. Re-runnable: replaces all custody reference data and notes.
// Password hashes are never read into Oracle (no login, FR-022).
//   npm run custody:migrate-legacy -- [--seed data/legacy-pv/seed]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import oracledb from 'oracledb';
import { dbConfig } from '../db/pool';
import { prepareCustodySession, recomputeDerived } from './ingest.js';
import { readLegacySeed, type LegacySeed, type SeedRow } from './legacy-seed.js';

export const defaultSeedDir = () => resolve(process.env.LEGACY_PV_DIR ? `${process.env.LEGACY_PV_DIR}/seed` : 'data/legacy-pv/seed');

/** Free-text legacy `ACCT_TYPE` → ISA | SIPP | GIA (original kept in legacy_account_type). */
export function normalizeAccountType(legacy: string): 'ISA' | 'SIPP' | 'GIA' {
  const t = legacy.trim().toUpperCase();
  if (/\bJ?ISA\b/.test(t) || t.includes('STOCKS & SHARES')) return 'ISA';
  if (t.startsWith('SIPP') || t.includes('PENSION')) return 'SIPP';
  return 'GIA';
}

const CLIENT_STATUS: Record<string, string> = { A: 'ACTIVE', D: 'DORMANT', C: 'CLOSED' };
/** Legacy note status: old single-letter codes (`O`/`C`) plus the later full codes. */
export const NOTE_STATUS: Record<string, 'OPEN' | 'CHASED' | 'RESOLVED' | 'WRITEOFF'> = {
  O: 'OPEN', C: 'RESOLVED', OPEN: 'OPEN', CHASED: 'CHASED', RESOLVED: 'RESOLVED', WRITEOFF: 'WRITEOFF',
};
/** Author recorded when a legacy note has no UPDATED_BY. */
export const LEGACY_UNKNOWN_AUTHOR = 'LEGACY';

/** `Mrs K Drummond` → forename `K`, surname `Drummond`; organisations/trusts keep the full name as surname. */
export function splitClientName(name: string): { surname: string; forename: string | null } {
  const m = /^(?:Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Lady|Rev)\.?\s+(.+?)\s+(\S+)$/i.exec(name.trim());
  if (m) return { forename: m[1], surname: m[2] };
  const p = /^([A-Z][a-z]+)\s+([A-Z][A-Za-z'-]+)$/.exec(name.trim());
  return p ? { forename: p[1], surname: p[2] } : { surname: name.trim(), forename: null };
}

const str = (r: SeedRow, k: string) => (r[k] === null || r[k] === undefined ? null : String(r[k]));
const req = (r: SeedRow, k: string) => {
  const v = str(r, k);
  if (v === null) throw new Error(`Legacy row missing ${k}: ${JSON.stringify(r)}`);
  return v;
};

export interface MigrationSummary { users: number; clients: number; accounts: number; instruments: number; breakNotes: number }

export async function migrateLegacy(conn: oracledb.Connection, seed: LegacySeed): Promise<MigrationSummary> {
  await prepareCustodySession(conn);
  for (const sql of [
    `DELETE FROM custody_break_note_history`, `DELETE FROM custody_break_notes`,
    `UPDATE custody_statements SET account_id = NULL`, `UPDATE custody_confirmations SET account_id = NULL`,
    `DELETE FROM custody_accounts`, `DELETE FROM custody_clients`, `DELETE FROM custody_users`,
  ]) await conn.execute(sql);

  const userById = new Map<string, string>();
  const users = seed.users.map(u => {
    const role = req(u, 'ROLE_CD').toUpperCase();
    if (!['ADVISER', 'OPS', 'ADMIN'].includes(role)) throw new Error(`Unknown legacy role ${role}`);
    userById.set(req(u, 'USER_ID'), req(u, 'USERNAME'));
    return { u: req(u, 'USERNAME'), n: req(u, 'FULL_NAME'), r: role, a: str(u, 'ACTIVE_FLG') === 'N' ? 0 : 1 };
  });
  await conn.executeMany(`INSERT INTO custody_users (user_name, display_name, role, is_active) VALUES (:u, :n, :r, :a)`, users);

  const clients = seed.clients.map(c => {
    const name = req(c, 'CLIENT_NAME');
    const { surname, forename } = splitClientName(name);
    const adv = str(c, 'ADVISER_USER_ID');
    return {
      id: Number(req(c, 'CLIENT_ID')), b_ref: req(c, 'CLIENT_REF'), name, surname, forename,
      adv: adv ? userById.get(adv) ?? null : null, st: CLIENT_STATUS[req(c, 'STATUS_CD')] ?? req(c, 'STATUS_CD'),
    };
  });
  await conn.executeMany(
    `INSERT INTO custody_clients (client_id, client_ref, client_name, surname, forename, adviser, status) VALUES (:id, :b_ref, :name, :surname, :forename, :adv, :st)`,
    clients);

  const accounts = seed.accounts.map(a => ({
    id: Number(req(a, 'ACCT_ID')), cid: Number(req(a, 'CLIENT_ID')), safe: Number(req(a, 'SAFE_CODE').trim()),
    t: normalizeAccountType(req(a, 'ACCT_TYPE')), lt: req(a, 'ACCT_TYPE'), ccy: str(a, 'BASE_CCY') ?? 'GBP',
    od: req(a, 'OPEN_DT').slice(0, 10), cd: str(a, 'CLOSE_DT')?.slice(0, 10) ?? null,
  }));
  await conn.executeMany(
    `INSERT INTO custody_accounts (account_id, client_id, safe_no, account_type, legacy_account_type, reporting_ccy, open_date, close_date)
     VALUES (:id, :cid, :safe, :t, :lt, :ccy, TO_DATE(:od, 'YYYY-MM-DD'), TO_DATE(:cd, 'YYYY-MM-DD'))`, accounts);

  await conn.executeMany(
    `MERGE INTO custody_instruments t USING (SELECT :isin AS isin, :name AS name FROM dual) s ON (t.isin = s.isin)
     WHEN MATCHED THEN UPDATE SET t.name = s.name, t.source = 'LEGACY_REF'
     WHEN NOT MATCHED THEN INSERT (isin, name, source) VALUES (s.isin, s.name, 'LEGACY_REF')`,
    seed.instruments.map(i => ({ isin: req(i, 'ISIN'), name: req(i, 'INSTR_NAME') })));

  const notes = seed.reconNotes.map(n => {
    const status = NOTE_STATUS[req(n, 'STATUS_CD').trim().toUpperCase()];
    if (!status) throw new Error(`Unknown RECON_NOTE status ${str(n, 'STATUS_CD')}`);
    return {
      acct: Number(req(n, 'ACCT_ID')), isin: req(n, 'ISIN'), d: req(n, 'STMT_DT').slice(0, 10), st: status,
      note: str(n, 'NOTE_TXT') || null, b_by: str(n, 'UPDATED_BY') ?? LEGACY_UNKNOWN_AUTHOR,
      b_at: (str(n, 'UPDATED_DT') ?? `${req(n, 'STMT_DT').slice(0, 10)} 00:00`).slice(0, 16),
    };
  });
  if (notes.length) {
    await conn.executeMany(
      `INSERT INTO custody_break_notes (account_id, isin, statement_date, status, note, updated_by, updated_at)
       VALUES (:acct, :isin, TO_DATE(:d, 'YYYY-MM-DD'), :st, :note, :b_by, TO_TIMESTAMP(:b_at, 'YYYY-MM-DD HH24:MI'))`, notes);
    await conn.executeMany(
      `INSERT INTO custody_break_note_history (history_id, account_id, isin, statement_date, status, note, changed_by, changed_at, source)
       VALUES (:id, :acct, :isin, TO_DATE(:d, 'YYYY-MM-DD'), :st, :note, :b_by, TO_TIMESTAMP(:b_at, 'YYYY-MM-DD HH24:MI'), 'LEGACY_MIGRATION')`,
      notes.map((n, i) => ({ id: i + 1, ...n })));
  }
  await conn.commit();
  await recomputeDerived(conn);
  return { users: users.length, clients: clients.length, accounts: accounts.length, instruments: seed.instruments.length, breakNotes: notes.length };
}

const argValue = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  (async () => {
    const conn = await oracledb.getConnection(dbConfig);
    try {
      const dir = resolve(argValue('--seed') ?? defaultSeedDir());
      const s = await migrateLegacy(conn, readLegacySeed(dir));
      console.log(`legacy migration (${dir}): ${s.users} users, ${s.clients} clients, ${s.accounts} accounts, ${s.instruments} instruments, ${s.breakNotes} break notes`);
    } finally {
      await conn.close();
    }
  })().catch(err => { console.error(err.message); process.exit(1); });
}
