import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { dbConfig, getConnectionString, maintenanceConnectionString } from './pool';
import { splitSqlScript } from './sql-script';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_FILES = ['schema.sql', 'seed.sql', 'workflow-seed.sql'];

export function databaseName(databaseUrl: string) {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error('DATABASE_URL database name must match ^[a-z_][a-z0-9_]{0,62}$.');
  return name;
}

export async function setupDatabase(databaseUrl = dbConfig, files = DEFAULT_FILES) {
  const targetName = databaseName(databaseUrl);
  const maintenance = new pg.Client({ connectionString: maintenanceConnectionString(databaseUrl) });
  await maintenance.connect();
  try {
    const existing = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetName]);
    if (!existing.rowCount) await maintenance.query(`CREATE DATABASE "${targetName}"`);
  } finally {
    await maintenance.end();
  }

  const client = new pg.Client({ connectionString: getConnectionString(databaseUrl) });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      const statements = splitSqlScript(readFileSync(DIR + file, 'utf8'));
      for (const sql of statements) await client.query(sql);
      console.log(`${file}: ${statements.length} statements`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2);
  setupDatabase(dbConfig, files.length ? files : DEFAULT_FILES).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
