// Local/dev only: PV_DEMO_PASSWORD=<synthetic> npm run pv:demo-passwords [-- USERNAME ...]
// Sets the same synthetic password on the given (default: every active) seeded PV user. Nothing is committed.
import { closePool, query } from '../db/pool';
import { setPassword } from './auth';

const password = process.env.PV_DEMO_PASSWORD;
if (process.env.NODE_ENV === 'production') {
  console.error('pv:demo-passwords is a local/dev helper and refuses to run with NODE_ENV=production');
  process.exit(2);
}
if (!password || password.length < 8) {
  console.error('usage: PV_DEMO_PASSWORD=<at least 8 chars> npm run pv:demo-passwords [-- USERNAME ...]');
  process.exit(2);
}

async function main(pw: string) {
  const named = process.argv.slice(2);
  const users = named.length ? named : (await query<{ username: string }>(`SELECT username FROM pv.app_user WHERE active_flg = 'Y' ORDER BY username`)).map(r => r.username);
  for (const u of users) console.log((await setPassword(u, pw)) ? `password set for ${u.trim().toUpperCase()}` : `no such user ${u}`);
}

main(password).finally(() => closePool());
