import { existsSync, readdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const containerName = process.env.WEALTH_DB_CONTAINER ?? 'wealth-postgres';

function findPgCtl() {
  const candidates = new Set<string>();
  if (process.env.PG_BIN) candidates.add(process.env.PG_BIN);
  for (const entry of (process.env.PATH ?? '').split(delimiter)) candidates.add(entry);
  for (const root of ['/usr/lib/postgresql', '/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin', 'C:\\Program Files\\PostgreSQL']) {
    if (!existsSync(root)) continue;
    if (root.endsWith('PostgreSQL') || root === '/usr/lib/postgresql') {
      for (const version of readdirSync(root)) candidates.add(join(root, version, 'bin'));
    } else candidates.add(root);
  }
  const suffix = process.platform === 'win32' ? '.exe' : '';
  return [...candidates].map(directory => join(directory, `pg_ctl${suffix}`)).find(path => existsSync(path));
}

function dockerAvailable() {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const mode = process.env.WEALTH_DB_MODE ?? (dockerAvailable() ? 'docker' : 'local');
if (mode === 'docker') {
  const existing = execFileSync('docker', ['ps', '--filter', `name=^/${containerName}$`, '--format', '{{.Names}}'], { encoding: 'utf8' }).trim();
  if (!existing) console.log(`PostgreSQL container ${containerName} is not running.`);
  else execFileSync('docker', ['stop', containerName], { stdio: 'inherit' });
} else {
  const pgCtl = findPgCtl();
  const dataDir = join(process.cwd(), '.pgdata');
  if (!pgCtl || !existsSync(dataDir)) console.log('Local PostgreSQL is not initialized.');
  else execFileSync(pgCtl, ['-D', dataDir, 'stop', '-m', 'fast'], { stdio: 'inherit' });
}
