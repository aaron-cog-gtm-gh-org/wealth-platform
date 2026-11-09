import type { createPvClient } from '../../api/pv';
import type { PvAdminStats, PvUser } from '../../api/pv-types';
import type { DataState, Screen } from '../../types';
import { canAccess, pvPageForScreen } from './access';
import type { PvContext } from './context';
import { PREVIEW_ADMIN_STATS } from './preview';
import { messagesSlice } from './messages-slice';

export type PvApi = ReturnType<typeof createPvClient>;

/**
 * A screen's PV data needs. Specs 005–009 register one per migrated screen in `PV_SLICES`.
 * `needs` gates on the URL context: a screen that needs `acct` but has none keeps its existing
 * (mockup) behaviour, so `?screen=portfolio` is unchanged while `?screen=portfolio&acct=2001` is PV.
 */
export interface PvSliceDef<T> {
  needs: 'none' | 'acct' | 'acct+stmt';
  load: (api: PvApi, ctx: PvContext) => Promise<T>;
  isEmpty: (data: T) => boolean;
  /** Fixed synthetic data rendered for `?state=Populated` without a session (design preview / visual-diff). */
  preview: () => T;
}

export type PvSliceStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: unknown }
  | { kind: 'error'; status: number | null; message: string };

export type PvGate = 'signin' | 'forbidden' | null;

export interface PvResolved {
  gate: PvGate;
  dataState: DataState;
  data: unknown;
  preview: boolean;
  /** Whether the live slice should be (or stay) fetched. */
  fetch: boolean;
}

const adminSlice: PvSliceDef<PvAdminStats> = {
  needs: 'none',
  load: api => api.adminStats(),
  isEmpty: s => s.archive.mt535Count === 0 && s.archive.mt54xCount === 0,
  preview: () => PREVIEW_ADMIN_STATS,
};

// Specs 005–009: add `<screen>: <slice>` here (additively).
export const PV_SLICES: Partial<Record<Screen, PvSliceDef<unknown>>> = {
  admin: adminSlice as PvSliceDef<unknown>,
  messages: messagesSlice as PvSliceDef<unknown>,
};

/** The PV slice that drives `screen` for this URL context, or null (existing behaviour). */
export function pvSliceFor(screen: Screen, ctx: PvContext): PvSliceDef<unknown> | null {
  const def = PV_SLICES[screen];
  if (!def) return null;
  if (def.needs !== 'none' && ctx.acct === null) return null;
  if (def.needs === 'acct+stmt' && ctx.stmt === null) return null;
  return def;
}

/**
 * Maps (forced `?state=`, session, slice status) → what the shell shows. `?state=` always wins so the
 * harness never needs to sign in; without a session `Populated` renders the slice's preview fixture.
 */
export function resolvePvSlice(screen: Screen, def: PvSliceDef<unknown>, forced: DataState | null, user: PvUser | null, status: PvSliceStatus): PvResolved {
  const none = { data: null, preview: false };
  if (forced && forced !== 'Populated') return { ...none, gate: null, dataState: forced, preview: !user, fetch: false };
  if (!user) {
    if (forced === 'Populated') return { gate: null, dataState: 'Populated', data: def.preview(), preview: true, fetch: false };
    return { ...none, gate: 'signin', dataState: 'Loading', fetch: false };
  }
  if (!canAccess(pvPageForScreen(screen)?.roles ?? null, user.role)) return { ...none, gate: 'forbidden', dataState: 'Loading', fetch: false };
  switch (status.kind) {
    case 'idle':
    case 'loading':
      return { ...none, gate: null, dataState: 'Loading', fetch: true };
    case 'error':
      return status.status === 403
        ? { ...none, gate: 'forbidden', dataState: 'Loading', fetch: true }
        : { ...none, gate: null, dataState: 'Error', fetch: true };
    case 'ready':
      return { gate: null, dataState: def.isEmpty(status.data) ? 'Empty' : 'Populated', data: status.data, preview: false, fetch: true };
  }
}

/** What `buildModel` needs from the shell's PV state (`src/pv/usePv.ts` provides it). Null = no PV at all. */
export interface PvModelInput {
  user: PvUser | null;
  slice: (PvResolved & { screen: Screen; retry: () => void }) | null;
  signIn: { pending: boolean; error: string | null; notice: string | null; submit: (username: string, password: string) => void };
  signOut: () => void;
  run: (op: 'reloadArchive') => Promise<void>;
  /** Navigate to a PV screen keeping `acct`/`stmt`. */
  goPv: (s: Screen) => void;
  /** Set (string) or remove (null) URL keys on the current screen, e.g. Message Browser filters (spec 009). */
  setParams?: (params: Record<string, string | null>) => void;
}
