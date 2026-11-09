// npm run pv:set-password -- <USERNAME>   (password from PV_PASSWORD)
import { closePool } from '../db/pool';
import { setPassword } from './auth';

const [username] = process.argv.slice(2);
const password = process.env.PV_PASSWORD;
if (!username || !password) {
  console.error('usage: PV_PASSWORD=... npm run pv:set-password -- <USERNAME>');
  process.exit(2);
}
setPassword(username, password)
  .then(ok => { console.log(ok ? `password set for ${username.trim().toUpperCase()}` : 'no such user'); process.exitCode = ok ? 0 : 1; })
  .finally(() => closePool());
