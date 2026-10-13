import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import oracledb from 'oracledb';
import { dbConfig } from './pool';
import { splitSqlScript } from './sql-script';
import { defaultArchiveDir, formatIngestSummary, ingestArchive } from '../custody/ingest.js';
import { defaultSeedDir, migrateLegacy } from '../custody/migrate-legacy.js';
import { readLegacySeed } from '../custody/legacy-seed.js';

const DIR = fileURLToPath(new URL('.', import.meta.url));

/** Creates the schema and loads the seed data into the configured database. */
export async function setupDatabase(config: oracledb.ConnectionAttributes = dbConfig, files = ['schema.sql', 'seed.sql']) {
  const conn = await oracledb.getConnection(config);
  try {
    for (const file of files) {
      const statements = splitSqlScript(readFileSync(DIR + file, 'utf8'));
      for (const sql of statements) await conn.execute(sql);
      console.log(`${file}: ${statements.length} statements`);
    }
    await conn.commit();
  } finally {
    await conn.close();
  }
}

/**
 * Loads the legacy Portfolio Viewer data into custody_* tables: reference-data migration from
 * `data/legacy-pv/seed` then ingest of `data/legacy-pv/archive` (both overridable via LEGACY_PV_DIR).
 */
export async function loadLegacyCustody(config: oracledb.ConnectionAttributes = dbConfig, dirs = { seed: defaultSeedDir(), archive: defaultArchiveDir() }) {
  const conn = await oracledb.getConnection(config);
  try {
    const m = await migrateLegacy(conn, readLegacySeed(dirs.seed));
    console.log(`legacy migration: ${m.users} users, ${m.clients} clients, ${m.accounts} accounts, ${m.instruments} instruments, ${m.breakNotes} break notes`);
    const summary = await ingestArchive(conn, dirs.archive, { triggeredBy: 'db:setup' });
    console.log(formatIngestSummary(summary));
    return summary;
  } finally {
    await conn.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const files = args.filter(a => !a.startsWith('--'));
  const withCustody = !files.length && !args.includes('--no-custody');
  setupDatabase(dbConfig, files.length ? files : undefined).then(() => (withCustody ? loadLegacyCustody() : undefined)).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
