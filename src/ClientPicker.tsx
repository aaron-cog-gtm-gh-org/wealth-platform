import { useEffect, useRef, useState } from 'react';
import { searchClients } from './api/client';
import type { ClientPickerItem, ClientPickerPage } from './api/types';

const closedStyle = {
  flex: '1', minWidth: '0', maxWidth: '520px', height: '30px', background: 'rgba(255,255,255,.14)', borderRadius: '6px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 10px', color: 'rgba(255,255,255,.85)',
};
const muted = 'rgba(25,25,25,.56)';

export function ClientPicker({ onPick }: { onPick: (item: ClientPickerItem) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<ClientPickerPage>({ items: [], page: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      searchClients(query, page).then(
        setResults,
        () => setError(true),
      ).finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, query, page]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuery('');
        setPage(1);
        setOpen(true);
      } else if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (item: ClientPickerItem) => {
    setOpen(false);
    onPick(item);
  };
  const first = results.total ? (page - 1) * 25 + 1 : 0;
  const last = Math.min(page * 25, results.total);

  return (
    <div
      ref={root}
      style={{ ...closedStyle, position: 'relative', zIndex: open ? 20 : undefined, cursor: open ? 'text' : 'pointer' }}
      onClick={() => { if (!open) setOpen(true); }}
      onKeyDown={event => { if (!open && (event.key === 'Enter' || event.key === ' ')) setOpen(true); }}
      tabIndex={0}
      role="combobox"
      aria-expanded={open}
    >
      {open ? (
        <input
          ref={input}
          aria-label="Search clients"
          placeholder="Search clients, accounts, instruments, exceptions"
          value={query}
          onChange={event => { setQuery(event.target.value); setPage(1); }}
          onClick={event => event.stopPropagation()}
          style={{ border: 0, outline: 0, background: 'transparent', color: '#fff', font: 'inherit', width: '100%', minWidth: 0 }}
        />
      ) : (
        <>
          <span style={{ minWidth: '0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Search clients, accounts, instruments, exceptions</span>
          <span style={{ font: "500 11px 'IBM Plex Mono',monospace", flex: 'none' }}>⌘K</span>
        </>
      )}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 'min(520px, calc(100vw - 32px))',
            background: '#fff', color: '#191919', border: '1px solid #e1e5eb', borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,.18)', zIndex: 30, overflow: 'hidden',
          }}
          onClick={event => event.stopPropagation()}
        >
          {loading && <div style={{ padding: '12px', color: muted }}>Searching clients…</div>}
          {error && <div style={{ padding: '12px', color: '#b3201f' }}>Could not load clients.</div>}
          {!loading && !error && results.items.map(item => (
            <div
              key={`${item.kind}:${item.id}`}
              role="option"
              aria-selected="false"
              onClick={() => pick(item)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
            >
              <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                <span style={{ color: muted, fontSize: '11px' }}>{item.clientRef ?? '—'} · {item.kind === 'household' ? 'Household' : 'Custody client'}</span>
              </span>
              <span style={{ flex: 'none', padding: '2px 7px', borderRadius: '10px', background: '#eef0f3', color: '#4b5563', font: "500 10px 'IBM Plex Mono',monospace" }}>
                {item.reportingCurrency}
              </span>
            </div>
          ))}
          {!loading && !error && results.items.length === 0 && <div style={{ padding: '12px', color: muted }}>No clients found.</div>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', fontSize: '11px', color: muted }}>
            <span>Showing {first}–{last} of {results.total}</span>
            <span style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ border: '1px solid #d5dbe3', borderRadius: '4px', background: '#fff', padding: '3px 7px', color: page <= 1 ? '#9aa3af' : '#191919' }}>Prev</button>
              <button disabled={page * 25 >= results.total} onClick={() => setPage(p => p + 1)} style={{ border: '1px solid #d5dbe3', borderRadius: '4px', background: '#fff', padding: '3px 7px', color: page * 25 >= results.total ? '#9aa3af' : '#191919' }}>Next</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
