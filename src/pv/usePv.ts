import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PvApiError, createPvClient } from '../api/pv';
import type { PvAdminStats } from '../api/pv-types';
import type { PvContext } from '../model/pv/context';
import { pvContextKey } from '../model/pv/context';
import { pvSliceFor, resolvePvSlice } from '../model/pv/slice';
import type { PvSliceStatus } from '../model/pv/slice';
import type { DataState, Screen } from '../types';
import { isTokenExpired, readStoredSession, tokenExp, writeStoredSession } from './session';
import type { StoredPvSession } from './session';

const SUPPORT_EXT = '4417';
/** Login.aspx.cs messages (legacy text). */
export const SIGN_IN_MESSAGES = {
  invalid: 'Invalid user ID or password.',
  disabled: `Your account has been disabled. Please contact Support (ext. ${SUPPORT_EXT}).`,
  unavailable: 'Sign-in is unavailable right now. Try again in a few minutes.',
  expired: 'Your session has expired. Sign in again.',
} as const;

export type PvOp = 'reloadArchive';

function initialAuth(): { auth: StoredPvSession | null; expired: boolean } {
  const s = readStoredSession();
  if (s && isTokenExpired(s.token)) { writeStoredSession(null); return { auth: null, expired: true }; }
  return { auth: s, expired: false };
}

/**
 * Shell PV state: session (sign-in / sign-out / 401 expiry), and the current screen's PV slice
 * resolved to a gate + DataState. Screens without a registered slice get `slice: null` (no PV I/O).
 */
export function usePv(screen: Screen, ctx: PvContext, forced: DataState | null) {
  const [{ auth, expired }, setAuthState] = useState(initialAuth);
  const tokenRef = useRef<string | null>(auth?.token ?? null);
  tokenRef.current = auth?.token ?? null;
  const api = useMemo(() => createPvClient({ token: () => tokenRef.current }), []);
  const [status, setStatus] = useState<{ key: string; s: PvSliceStatus }>({ key: '', s: { kind: 'idle' } });
  const [nonce, setNonce] = useState(0);
  const [signIn, setSignIn] = useState<{ pending: boolean; error: string | null }>({ pending: false, error: null });

  const endSession = useCallback((why: 'signout' | 'expired') => {
    writeStoredSession(null);
    setAuthState({ auth: null, expired: why === 'expired' });
    setStatus({ key: '', s: { kind: 'idle' } });
  }, []);

  useEffect(() => {
    const exp = auth && tokenExp(auth.token);
    if (!exp) return;
    const t = setTimeout(() => endSession('expired'), Math.max(0, exp - Date.now()));
    return () => clearTimeout(t);
  }, [auth, endSession]);

  const def = pvSliceFor(screen, ctx);
  const user = auth?.user ?? null;
  const key = `${screen}|${pvContextKey(ctx)}|${auth?.token ?? ''}|${nonce}`;
  const current = status.key === key ? status.s : { kind: 'idle' as const };
  const resolved = def ? resolvePvSlice(screen, def, forced, user, current) : null;
  const shouldFetch = !!resolved?.fetch;

  const fail = useCallback((k: string, e: unknown) => {
    if (e instanceof PvApiError && e.status === 401) { endSession('expired'); return; }
    console.error(e);
    setStatus({ key: k, s: { kind: 'error', status: e instanceof PvApiError ? e.status : null, message: e instanceof Error ? e.message : String(e) } });
  }, [endSession]);

  useEffect(() => {
    if (!shouldFetch || !def) return;
    let live = true;
    setStatus({ key, s: { kind: 'loading' } });
    def.load(api, ctx).then(data => { if (live) setStatus({ key, s: { kind: 'ready', data } }); }, e => { if (live) fail(key, e); });
    return () => { live = false; };
    // ctx/def are captured through `key`.
  }, [key, shouldFetch]);

  const doSignIn = useCallback((username: string, password: string) => {
    if (signIn.pending) return;
    if (!username.trim() || !password) { setSignIn({ pending: false, error: SIGN_IN_MESSAGES.invalid }); return; }
    setSignIn({ pending: true, error: null });
    api.login(username, password).then(
      r => { const s = { token: r.token, user: r.user }; writeStoredSession(s); setAuthState({ auth: s, expired: false }); setSignIn({ pending: false, error: null }); },
      e => setSignIn({ pending: false, error: e instanceof PvApiError ? (e.status === 401 ? SIGN_IN_MESSAGES.invalid : e.status === 403 ? SIGN_IN_MESSAGES.disabled : SIGN_IN_MESSAGES.unavailable) : SIGN_IN_MESSAGES.unavailable }),
    );
  }, [api, signIn.pending]);

  /** Mutations on the current slice. Previews (no session) resolve without I/O. */
  const run = useCallback(async (op: PvOp) => {
    if (!tokenRef.current) return;
    try {
      const next: PvAdminStats = op === 'reloadArchive' ? await api.reloadArchive() : (undefined as never);
      setStatus({ key, s: { kind: 'ready', data: next } });
    } catch (e) {
      if (e instanceof PvApiError && (e.status === 401 || e.status === 403)) fail(key, e);
      throw e;
    }
  }, [api, key, fail]);

  return {
    user,
    expired,
    signIn: { ...signIn, notice: expired ? SIGN_IN_MESSAGES.expired : null, submit: doSignIn },
    signOut: () => endSession('signout'),
    slice: resolved && { screen, ...resolved, retry: () => setNonce(n => n + 1) },
    run,
  };
}

export type PvShellState = ReturnType<typeof usePv>;
