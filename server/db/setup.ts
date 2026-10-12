import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import oracledb from 'oracledb';
import { dbConfig } from './pool';
import { splitSqlScript } from './sql-script';

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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2);
  setupDatabase(dbConfig, files.length ? files : undefined).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
