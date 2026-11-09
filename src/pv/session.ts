import type { PvUser } from '../api/pv-types';

/** Per-tab storage, like the legacy non-persistent Forms Authentication cookie. */
export const PV_SESSION_KEY = 'pv.session';

export interface StoredPvSession {
  token: string;
  user: PvUser;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const memory = new Map<string, string>();
const memoryStore: Store = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v), removeItem: k => void memory.delete(k) };

function defaultStore(): Store {
  try {
    const s = globalThis.sessionStorage;
    s.setItem('pv.probe', '1');
    s.removeItem('pv.probe');
    return s;
  } catch {
    return memoryStore;
  }
}

/** Expiry (epoch ms) carried in the spec-004 token body; null if unreadable. Not trusted for auth, only to expire early. */
export function tokenExp(token: string): number | null {
  try {
    const body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const exp = (JSON.parse(atob(body)) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

export const isTokenExpired = (token: string, now = Date.now()) => { const exp = tokenExp(token); return exp !== null && exp <= now; };

export function readStoredSession(store: Store = defaultStore()): StoredPvSession | null {
  try {
    const s = JSON.parse(store.getItem(PV_SESSION_KEY) ?? 'null') as StoredPvSession | null;
    return s && typeof s.token === 'string' && s.user && typeof s.user.username === 'string' && typeof s.user.role === 'string' ? s : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(s: StoredPvSession | null, store: Store = defaultStore()) {
  if (s) store.setItem(PV_SESSION_KEY, JSON.stringify(s));
  else store.removeItem(PV_SESSION_KEY);
}
