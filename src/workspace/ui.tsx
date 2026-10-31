import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from './api';

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'mute';

const STATUS_TONES: Record<string, Tone> = {
  Open: 'info',
  'In progress': 'warn',
  Resolved: 'ok',
  Completed: 'ok',
  Filled: 'ok',
  Cancelled: 'mute',
  Rejected: 'bad',
  Current: 'ok',
  'Review due': 'warn',
  Ready: 'warn',
  'Within tolerance': 'ok',
  'Proposed change': 'warn',
  Unassigned: 'mute',
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`ws-pill ws-pill--${STATUS_TONES[status] ?? 'mute'}`}>{status}</span>;
}

export function Panel({ title, titleId, actions, children, className = '' }: { title: string; titleId?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`ws-panel ${className}`} aria-labelledby={titleId}>
      <header className="ws-panel__head">
        <h2 id={titleId} className="ws-panel__title">{title}</h2>
        {actions && <div className="ws-panel__actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function Notices({ error, success }: { error: string | null; success: string | null }) {
  return (
    <>
      {error && <div role="alert" className="ws-notice ws-notice--error">{error}</div>}
      {success && <div role="status" className="ws-notice ws-notice--success">{success}</div>}
    </>
  );
}

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Try again.';

/**
 * Runs a server mutation, then refetches the workspace so the screen reflects persisted state.
 * Success is only reported after the server has accepted the change.
 */
export function useAction(reload: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clear = useCallback(() => { setError(null); setSuccess(null); }, []);
  const fail = useCallback((msg: string) => { setSuccess(null); setError(msg); }, []);

  const run = useCallback(async <T,>(fn: () => Promise<T>, message: (result: T) => string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fn();
      try {
        await reload();
      } catch (e) {
        setSuccess(message(result));
        setError('Saved, but the latest data could not be loaded: ' + errorMessage(e));
        return true;
      }
      setSuccess(message(result));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [reload]);

  return { busy, error, success, run, clear, fail };
}

export type SortDir = 'ascending' | 'descending';

export function useSort<T, K extends string>(rows: T[], initial: NoInfer<K>, accessors: Record<K, (row: T) => string | number>, initialDir: SortDir = 'ascending') {
  const [key, setKey] = useState<K>(initial);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const sorted = useMemo(() => {
    const get = accessors[key];
    const out = [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en-CA', { numeric: true });
      return dir === 'ascending' ? c : -c;
    });
    return out;
  }, [rows, key, dir]);
  const toggle = (k: K) => {
    if (k === key) setDir(d => (d === 'ascending' ? 'descending' : 'ascending'));
    else { setKey(k); setDir('ascending'); }
  };
  return { sorted, key, dir, toggle };
}

export function SortHeader<K extends string>({ label, k, sort, align }: { label: string; k: K; sort: { key: K; dir: SortDir; toggle: (k: K) => void }; align?: 'right' }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? sort.dir : 'none'} className={align === 'right' ? 'ws-num' : undefined}>
      <button type="button" className="ws-sort" onClick={() => sort.toggle(k)}>
        {label}
        <span aria-hidden="true" className="ws-sort__icon">{active ? (sort.dir === 'ascending' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr><td colSpan={colSpan} className="ws-empty">{children}</td></tr>
  );
}
