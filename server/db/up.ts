import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgres://wealth:wealth@127.0.0.1:5432/wealth');
const port = Number(databaseUrl.port || 5432);
const containerName = process.env.WEALTH_DB_CONTAINER ?? 'wealth-postgres';

function dockerAvailable() {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function localBinaries() {
  const candidates = new Set<string>();
  if (process.env.PG_BIN) candidates.add(process.env.PG_BIN);
  for (const entry of (process.env.PATH ?? '').split(delimiter)) candidates.add(entry);
  for (const root of ['/usr/lib/postgresql', '/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin', 'C:\\Program Files\\PostgreSQL']) {
    if (!existsSync(root)) continue;
    if (root.endsWith('PostgreSQL')) {
      for (const version of readdirSync(root)) candidates.add(join(root, version, 'bin'));
    } else if (root === '/usr/lib/postgresql') {
      for (const version of readdirSync(root)) candidates.add(join(root, version, 'bin'));
    } else candidates.add(root);
  }
  for (const directory of candidates) {
    const suffix = process.platform === 'win32' ? '.exe' : '';
    const initdb = join(directory, `initdb${suffix}`);
    const pgCtl = join(directory, `pg_ctl${suffix}`);
    if (existsSync(initdb) && existsSync(pgCtl)) return { initdb, pgCtl };
  }
  return undefined;
}

function mode() {
  if (process.env.WEALTH_DB_MODE === 'docker' || process.env.WEALTH_DB_MODE === 'local') return process.env.WEALTH_DB_MODE;
  if (dockerAvailable()) return 'docker';
  if (localBinaries()) return 'local';
  throw new Error('No PostgreSQL runtime found. Install Docker or PostgreSQL binaries, or set WEALTH_DB_MODE.');
}

const selectedMode = mode();
if (selectedMode === 'docker') {
  const existing = execFileSync('docker', ['ps', '--filter', `name=^/${containerName}$`, '--format', '{{.Names}}'], { encoding: 'utf8' }).trim();
  if (existing === containerName) {
    console.log(`PostgreSQL container ${containerName} is already running.`);
  } else {
    const args = ['run', '-d', '--rm', '--name', containerName, '-p', `127.0.0.1:${port}:5432`,
      '-e', 'POSTGRES_USER=wealth', '-e', 'POSTGRES_PASSWORD=wealth', '-e', 'POSTGRES_DB=wealth'];
    if (process.env.WEALTH_DB_TMPFS === '1') args.push('--tmpfs', '/var/lib/postgresql/data:rw');
    args.push('postgres:16-alpine');
    execFileSync('docker', args, { stdio: 'inherit' });
  }
} else {
  const binaries = localBinaries();
  if (!binaries) throw new Error('PostgreSQL local binaries were not found in PG_BIN, PATH, or common install directories.');
  const dataDir = join(process.cwd(), '.pgdata');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    execFileSync(binaries.initdb, ['-D', dataDir, '-U', 'wealth', '--auth=trust'], { stdio: 'inherit' });
  }
  execFileSync(binaries.pgCtl, ['-D', dataDir, '-o', `-p ${port} -h 127.0.0.1`, '-l', join(dataDir, 'log'), 'start', '-w'], { stdio: 'inherit' });
}
