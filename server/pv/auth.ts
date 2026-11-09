// Portfolio Viewer sign-in and role checks (spec 004, Q17). Legacy SHA1 hashes are not carried forward.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { query } from '../db/pool';
import { HttpError } from '../workflows/errors';

export type PvRole = 'ADVISER' | 'OPS' | 'ADMIN';
export interface PvSession { userId: number; username: string; role: string; exp: number }

const SECRET = process.env.PV_SESSION_SECRET ?? randomBytes(32).toString('hex');
const TTL_MS = 8 * 60 * 60 * 1000;
const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sign = (body: string) => b64(createHmac('sha256', SECRET).update(body).digest());

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${b64(salt)}$${b64(scryptSync(password, salt, 32))}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  const [kind, salt, hash] = (stored ?? '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function issueToken(s: Omit<PvSession, 'exp'>, now = Date.now()): string {
  const body = b64(JSON.stringify({ ...s, exp: now + TTL_MS }));
  return `${body}.${sign(body)}`;
}

export function readToken(token: string, now = Date.now()): PvSession | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PvSession;
  return s.exp > now ? s : null;
}

interface UserRow { user_id: number; username: string; password_hash: string | null; full_name: string | null; role_cd: string; active_flg: string }

/** legacy: Login.aspx + usp_GetUserByName (UPPER(TRIM(username))) + usp_SetLastLogin */
export async function login(username: string, password: string) {
  const [u] = await query<UserRow>(
    'SELECT user_id, username, password_hash, full_name, role_cd, active_flg FROM pv.app_user WHERE username = upper(trim($1))', [username]);
  if (!u || !verifyPassword(password, u.password_hash)) throw new HttpError(401, 'Invalid user name or password.');
  if (u.active_flg !== 'Y') throw new HttpError(403, 'Account disabled.');
  await query('UPDATE pv.app_user SET last_login_dt = localtimestamp(3) WHERE user_id = $1', [u.user_id]);
  return {
    token: issueToken({ userId: u.user_id, username: u.username, role: u.role_cd }),
    user: { userId: u.user_id, username: u.username, fullName: u.full_name, role: u.role_cd },
  };
}

export async function setPassword(username: string, password: string): Promise<boolean> {
  const rows = await query('UPDATE pv.app_user SET password_hash = $2 WHERE username = upper(trim($1)) RETURNING user_id', [username, hashPassword(password)]);
  return rows.length > 0;
}

export const session = (res: Response) => res.locals.pvSession as PvSession;

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
  const s = m ? readToken(m[1]) : null;
  if (!s) return next(new HttpError(401, 'Sign in required.'));
  res.locals.pvSession = s;
  next();
}

/** legacy: BasePage.RequiredRoles (exact role match) */
export const requireRole = (...roles: PvRole[]) => (_req: Request, res: Response, next: NextFunction) =>
  next(roles.includes(session(res).role as PvRole) ? undefined : new HttpError(403, 'Not authorised for this page.'));
