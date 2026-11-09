import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { workspaceHref } from '../model';
import { errorMessage } from '../ui';
import type { CustodyAccount } from './api';
import { custodyDate, custodyParams, reconTone } from './model';
import type { CustodyRoute, CustodyView } from './model';

type LinkExtra = Parameters<typeof custodyParams>[1];

export interface CustodyCtx {
  route: CustodyRoute;
  /** Pushes a Custody deep link so Back/Forward return to the previous view. */
  nav: (view: CustodyView, extra?: LinkExtra) => void;
  accounts: Load<CustodyAccount[]>;
  /** Refetches workspace bootstrap so the audit trail shows server-recorded changes. */
  refreshAudit: () => Promise<void>;
}

export const CustodyContext = createContext<CustodyCtx | null>(null);

export function useCustody() {
  const ctx = useContext(CustodyContext);
  if (!ctx) throw new Error('useCustody must be used inside the Custody area');
  return ctx;
}

export type Load<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/**
 * Loads data for `key`; a null key means "nothing to load yet". Responses for a superseded key are
 * discarded. `refetch` reloads in place without flashing the loading state.
 */
export function useLoad<T>(key: string | null, fn: () => Promise<T>) {
  const [state, setState] = useState<Load<T>>(key === null ? { status: 'idle' } : { status: 'loading' });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (key === null) { setState({ status: 'idle' }); return; }
    let live = true;
    setState({ status: 'loading' });
    fnRef.current().then(
      data => { if (live) setState({ status: 'ready', data }); },
      e => { if (live) setState({ status: 'error', message: errorMessage(e) }); },
    );
    return () => { live = false; };
  }, [key]);

  const refetch = useCallback(async () => {
    const at = keyRef.current;
    if (at === null) return;
    const data = await fnRef.current();
    if (keyRef.current === at) setState({ status: 'ready', data });
  }, []);

  return { state, refetch };
}

export function LoadState({ state, what }: { state: Load<unknown>; what: string }) {
  if (state.status === 'loading') return <p className="ws-pad ws-muted" role="status">Loading {what}…</p>;
  if (state.status === 'error') return <div className="ws-pad"><div role="alert" className="ws-notice ws-notice--error">{what[0].toUpperCase() + what.slice(1)} couldn’t be loaded: {state.message}</div></div>;
  return null;
}

/** A real link to a Custody deep link; plain clicks navigate in place. */
export function CustodyLink({ view, extra, children, className = '', ...rest }: { view: CustodyView; extra?: LinkExtra; children: ReactNode; className?: string; 'aria-label'?: string; 'aria-current'?: 'page' | undefined }) {
  const { nav } = useCustody();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    nav(view, extra);
  };
  return <a href={workspaceHref('custody', custodyParams(view, extra))} className={className} onClick={onClick} {...rest}>{children}</a>;
}

export function accountLabel(a: Pick<CustodyAccount, 'acctNo' | 'clientName'>) {
  return `${a.acctNo} · ${a.clientName}`;
}

export function AccountSelect({ id, accounts, value, onChange }: { id: string; accounts: CustodyAccount[]; value: number | null; onChange: (acctId: number) => void }) {
  return (
    <div className="ws-field ws-field--grow">
      <label htmlFor={id}>Account</label>
      <select id={id} value={value ?? ''} onChange={e => onChange(Number(e.target.value))}>
        {value === null && <option value="" disabled>Choose an account</option>}
        {accounts.map(a => <option key={a.acctId} value={a.acctId}>{accountLabel(a)}</option>)}
      </select>
    </div>
  );
}

export function DateSelect({ id, label, dates, value, onChange, disabled }: { id: string; label: string; dates: string[]; value: string | null; onChange: (date: string) => void; disabled?: boolean }) {
  return (
    <div className="ws-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={disabled || dates.length === 0}>
        {dates.length === 0 && <option value="">No statements on file</option>}
        {dates.map(d => <option key={d} value={d}>{custodyDate(d)}</option>)}
      </select>
    </div>
  );
}

export function ReconPill({ status }: { status: string }) {
  return <span className={`ws-pill ws-pill--${reconTone(status)}`}>{status}</span>;
}
