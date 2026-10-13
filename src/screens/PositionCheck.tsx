import { Fragment, useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { getBreakHistory, getBreakNotes, getPositionCheckDates, getPositionChecks, patchBreakNote } from '../api/client';
import type { BreakCause, BreakNoteHistory, BreakNotePatch, BreakNoteRow, BreakStatus, PositionBreak, PositionCheckMode, PositionCheckResult } from '../api/types';
import { AMBER, GREEN, INK, MUTE, RED, dayMonthYear, dayMonthYearTime, pill } from '../format';
import type { PillKind } from '../format';
import { SourceMessageLink } from './SourceMessageLink';

const AUTHOR_KEY = 'wealth.positionCheck.author';
const EDIT_STATUSES: Exclude<BreakStatus, 'NEW'>[] = ['OPEN', 'CHASED', 'RESOLVED', 'WRITEOFF'];
const CAUSES: BreakCause[] = ['CORP_ACTION', 'MISSING_CONFIRM', 'OTHER'];
const CAUSE_LABEL: Record<BreakCause, string> = { CORP_ACTION: 'Corporate action', MISSING_CONFIRM: 'Missing confirmation', OTHER: 'Other' };
const STATUS_PILL: Record<BreakStatus, PillKind> = { NEW: 'info', OPEN: 'bad', CHASED: 'warn', RESOLVED: 'ok', WRITEOFF: 'mute' };
const ALL_DATES = '';

interface BreakKey { accountId: number; isin: string; date: string }
const keyOf = (b: BreakKey) => `${b.accountId}|${b.isin}|${b.date}`;

/** `1600.00` → `1,600`; `-1250.5` → `−1,250.5`; `signed` adds `+` for positives. */
export function fmtQty(dec: string, signed = false) {
  const neg = dec.startsWith('-');
  const [int, frac = ''] = (neg ? dec.slice(1) : dec).split('.');
  const f = frac.replace(/0+$/, '');
  const body = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
  const zero = /^0*$/.test(int) && !f;
  return (neg && !zero ? '−' : signed && !zero ? '+' : '') + body;
}

function readParams() {
  const q = new URLSearchParams(window.location.search);
  const date = q.get('date') ?? ALL_DATES;
  const acct = q.get('acct') ?? '';
  const mode: PositionCheckMode = q.get('mode') === 'legacy' ? 'legacy' : 'corrected';
  return { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ALL_DATES, acct: /^\d{1,10}$/.test(acct) ? acct : '', mode };
}

function writeParams(p: { date: string; acct: string; mode: PositionCheckMode }) {
  const q = new URLSearchParams(window.location.search);
  for (const [k, v] of [['date', p.date], ['acct', p.acct], ['mode', p.mode === 'legacy' ? 'legacy' : '']] as const) {
    if (v) q.set(k, v); else q.delete(k);
  }
  window.history.replaceState(null, '', '?' + q.toString());
}

const card: CSSProperties = { background: '#fff', border: '1px solid #e1e5eb', borderRadius: '6px' };
const btn = (primary: boolean): CSSProperties => ({
  padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', font: '600 12px Inter,sans-serif',
  border: primary ? '1px solid #005daa' : '1px solid #cfd5dd', background: primary ? '#005daa' : '#fff', color: primary ? '#fff' : INK,
});
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, color: '#005daa', cursor: 'pointer', font: '500 12px Inter,sans-serif' };
const input: CSSProperties = { height: '28px', border: '1px solid #cfd5dd', borderRadius: '5px', padding: '0 8px', font: '12px Inter,sans-serif', background: '#fff', color: INK };
const label: CSSProperties = { fontSize: '11px', color: MUTE };
const mono: CSSProperties = { fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px' };

function StatusPill({ status }: { status: BreakStatus }) {
  const [bg, fg] = pill(STATUS_PILL[status]);
  return <span style={{ padding: '1px 7px', borderRadius: '9px', background: bg, color: fg, fontSize: '10.5px', fontWeight: 600, letterSpacing: '.02em' }}>{status}</span>;
}

function SourceLinks({ ids }: { ids: number[] }) {
  const sourceIds = ids.filter(id => Number.isInteger(id) && id > 0);
  if (!sourceIds.length) return <span style={{ color: MUTE }}>—</span>;
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
      {sourceIds.map((id, i) => (
        <SourceMessageLink key={`${id}:${i}`} messageId={id} label={i === 0 ? 'prev stmt' : i === 1 ? 'stmt' : `settl. ${id}`} />
      ))}
    </span>
  );
}

interface EditProps { b: PositionBreak; author: string; onAuthor: (a: string) => void; onSaved: () => void; onCancel: () => void }

/** Inline editor. Pre-filled with the current values; only fields the user changed are sent [fix D-6]. */
function EditForm({ b, author, onAuthor, onSaved, onCancel }: EditProps) {
  const [status, setStatus] = useState<BreakStatus>(b.status);
  const [cause, setCause] = useState<BreakCause | ''>(b.cause ?? '');
  const [note, setNote] = useState(b.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!author.trim()) { setErr('Enter your name — it is recorded as the author of this change.'); return; }
    const patch: BreakNotePatch = { author: author.trim() };
    if (status !== b.status && status !== 'NEW') patch.status = status;
    if ((cause || null) !== b.cause) patch.cause = cause || null;
    if ((note.trim() || null) !== (b.note ?? null)) patch.note = note.trim() || null;
    if (!('status' in patch) && !('cause' in patch) && !('note' in patch)) { setErr('Nothing has changed.'); return; }
    setBusy(true); setErr(null);
    try { await patchBreakNote(b.accountId, b.isin, b.date, patch); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <div data-testid="break-edit" style={{ padding: '10px 12px 12px', background: '#f7faff', borderTop: '1px solid #e6eef8', display: 'grid', gridTemplateColumns: '150px 190px minmax(0,1fr) 180px', gap: '10px', alignItems: 'start' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span style={label}>Status</span>
        <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value as BreakStatus)} style={input}>
          {b.status === 'NEW' && <option value="NEW">NEW (not yet worked)</option>}
          {EDIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span style={label}>Cause</span>
        <select aria-label="Cause" value={cause} onChange={e => setCause(e.target.value as BreakCause | '')} style={input}>
          <option value="">— Not set —</option>
          {CAUSES.map(c => <option key={c} value={c}>{CAUSE_LABEL[c]}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span style={label}>Note</span>
        <textarea aria-label="Note" value={note} maxLength={2000} rows={2} onChange={e => setNote(e.target.value)} style={{ ...input, height: 'auto', padding: '6px 8px', resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span style={label}>Your name (author)</span>
          <input aria-label="Author" value={author} maxLength={80} onChange={e => onAuthor(e.target.value)} placeholder="e.g. L. Brennan" style={input} />
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onClick={save} disabled={busy} style={btn(true)}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={onCancel} disabled={busy} style={btn(false)}>Cancel</button>
        </div>
        {err && <span role="alert" style={{ fontSize: '11px', color: RED }}>{err}</span>}
      </div>
    </div>
  );
}

function describeChange(h: BreakNoteHistory, prev: BreakNoteHistory | undefined): string[] {
  if (!prev) {
    const out = [`Status ${h.status}`];
    if (h.cause) out.push(`Cause ${CAUSE_LABEL[h.cause]}`);
    if (h.note) out.push(`Note “${h.note}”`);
    return out;
  }
  const out: string[] = [];
  if (h.status !== prev.status) out.push(`Status ${prev.status} → ${h.status}`);
  if (h.cause !== prev.cause) out.push(`Cause ${prev.cause ? CAUSE_LABEL[prev.cause] : '—'} → ${h.cause ? CAUSE_LABEL[h.cause] : '—'}`);
  if (h.note !== prev.note) out.push(`Note “${prev.note ?? ''}” → “${h.note ?? ''}”`);
  return out.length ? out : ['No field changes'];
}

function HistoryDrawer({ k, title, onClose }: { k: BreakKey; title: string; onClose: () => void }) {
  const [rows, setRows] = useState<BreakNoteHistory[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setRows(null); setErr(null);
    getBreakHistory(k.accountId, k.isin, k.date).then(r => { if (live) setRows(r); }, e => { if (live) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [k.accountId, k.isin, k.date]);
  return (
    <div role="dialog" aria-label="Break note history" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: '#fff', borderLeft: '1px solid #e1e5eb', boxShadow: '-8px 0 24px rgba(0,0,0,.08)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef0f3', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ font: '600 14px Inter,sans-serif' }}>Note history</span>
          <span style={{ fontSize: '12px' }}>{title}</span>
          <span style={{ ...mono, color: MUTE }}>Account {k.accountId} · {k.isin} · {dayMonthYear(k.date)}</span>
        </div>
        <button type="button" aria-label="Close history" onClick={onClose} style={{ ...btn(false), padding: '2px 8px' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {err && <span role="alert" style={{ color: RED }}>{err}</span>}
        {!rows && !err && <span style={{ color: MUTE }}>Loading history…</span>}
        {rows && rows.length === 0 && <span style={{ color: MUTE }}>No changes recorded for this break yet.</span>}
        {rows?.map((h, i) => (
          <div key={i} data-testid="history-entry" style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600 }}>{h.updatedBy}</span>
              <span style={{ color: MUTE, fontSize: '11px' }}>{dayMonthYearTime(h.updatedAt)}</span>
              <span style={{ flex: 1 }} />
              {h.source === 'LEGACY_MIGRATION' && <span style={{ whiteSpace: 'nowrap', fontSize: '10px', color: MUTE, border: '1px solid #e1e5eb', borderRadius: '8px', padding: '0 6px' }}>Migrated from Portfolio Viewer</span>}
              <StatusPill status={h.status} />
            </div>
            {describeChange(h, rows[i + 1]).map((c, j) => <span key={j} style={{ fontSize: '12px', color: INK }}>{c}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

type Tab = 'breaks' | 'notes';
const COLS = '112px minmax(160px,1fr) 76px 76px 76px 76px 84px 84px minmax(160px,1fr) 112px';

export function PositionCheck() {
  const init = readParams();
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState(init.date);
  const [acct, setAcct] = useState(init.acct);
  const [mode, setMode] = useState<PositionCheckMode>(init.mode);
  const [tab, setTab] = useState<Tab>('breaks');
  const [result, setResult] = useState<PositionCheckResult | null>(null);
  const [notes, setNotes] = useState<BreakNoteRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [history, setHistory] = useState<{ k: BreakKey; title: string } | null>(null);
  const [author, setAuthorState] = useState(() => { try { return localStorage.getItem(AUTHOR_KEY) ?? ''; } catch { return ''; } });
  const setAuthor = (a: string) => { setAuthorState(a); try { localStorage.setItem(AUTHOR_KEY, a); } catch { /* storage unavailable */ } };

  const run = useCallback(async (p: { date: string; acct: string; mode: PositionCheckMode }) => {
    writeParams(p);
    setLoading(true); setErr(null); setEditing(null);
    try {
      const [r, n] = await Promise.all([
        getPositionChecks({ date: p.date || undefined, accountId: p.acct ? Number(p.acct) : undefined, mode: p.mode }),
        getBreakNotes(),
      ]);
      setResult(r); setNotes(n);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setResult(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    getPositionCheckDates().then(setDates, () => setDates([]));
    void run(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAll = () => { setAcct(''); void run({ date, acct: '', mode }); };
  const checkAccount = () => void run({ date, acct, mode });
  const switchMode = (m: PositionCheckMode) => { setMode(m); void run({ date, acct, mode: m }); };
  const refresh = () => void run({ date, acct, mode });
  const openCheck = (n: BreakNoteRow) => { setTab('breaks'); setDate(n.date); setAcct(String(n.accountId)); void run({ date: n.date, acct: String(n.accountId), mode }); };

  const breaks = result?.breaks ?? [];
  const worked = breaks.filter(b => b.status !== 'NEW').length;
  const open = breaks.filter(b => b.status === 'NEW' || b.status === 'OPEN' || b.status === 'CHASED').length;
  const scope = acct && result ? `Account ${acct}` : 'All accounts';
  const kpis = [
    { k: 'Breaks', v: result ? String(breaks.length) : '—', sub: result ? `${result.accountsChecked} account${result.accountsChecked === 1 ? '' : 's'} checked` : '', color: breaks.length ? RED : GREEN },
    { k: 'Outstanding', v: result ? String(open) : '—', sub: 'New, open or chased', color: open ? AMBER : GREEN },
    { k: 'With notes', v: result ? String(worked) : '—', sub: 'Status set by an analyst', color: INK },
    { k: 'Statement date', v: date ? dayMonthYear(date) : 'All dates', sub: scope, color: INK },
    { k: 'Rules', v: mode === 'legacy' ? 'Legacy' : 'Corrected', sub: mode === 'legacy' ? 'Portfolio Viewer parity' : 'Standard', color: mode === 'legacy' ? AMBER : INK },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ ...card, padding: '10px 12px', display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span style={label}>Statement date</span>
          <select aria-label="Statement date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, minWidth: '150px' }}>
            <option value={ALL_DATES}>All statement dates</option>
            {date && !dates.includes(date) && <option value={date}>{dayMonthYear(date)}</option>}
            {dates.map(d => <option key={d} value={d}>{dayMonthYear(d)}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span style={label}>Custody account</span>
          <input aria-label="Custody account" value={acct} inputMode="numeric" placeholder="All accounts" onChange={e => setAcct(e.target.value.replace(/\D/g, ''))} onKeyDown={e => { if (e.key === 'Enter') checkAccount(); }} style={{ ...input, width: '120px' }} />
        </label>
        <button type="button" onClick={checkAccount} disabled={!acct} style={{ ...btn(false), opacity: acct ? 1 : 0.5 }}>Check account</button>
        <button type="button" onClick={checkAll} style={btn(true)}>Check All</button>
        <span style={{ flex: 1 }} />
        <div role="group" aria-label="Rule mode" style={{ display: 'flex', border: '1px solid #cfd5dd', borderRadius: '6px', overflow: 'hidden' }}>
          {(['corrected', 'legacy'] as const).map(m2 => (
            <button key={m2} type="button" aria-pressed={mode === m2} onClick={() => switchMode(m2)} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', font: '600 12px Inter,sans-serif', background: mode === m2 ? (m2 === 'legacy' ? '#fdf0dd' : '#e6eef8') : '#fff', color: mode === m2 ? (m2 === 'legacy' ? '#94520a' : '#00498a') : MUTE }}>
              {m2 === 'corrected' ? 'Corrected rules' : 'Legacy rules'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'legacy' && (
        <div role="note" style={{ ...card, borderColor: '#f3d9b1', background: '#fffaf2', padding: '8px 12px', fontSize: '12px', color: '#94520a' }}>
          Legacy rules reproduce Portfolio Viewer exactly — including known defects (pending settlements counted, no cancellation matching, settlement date ignored, superseded statements kept). Use for parity sign-off only; breaks shown here may not be genuine.
        </div>
      )}

      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ padding: '10px 14px', borderRight: '1px solid #eef0f3', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={label}>{k.k}</span>
            <span style={{ font: '600 17px/22px Inter,sans-serif', color: k.color }}>{k.v}</span>
            <span style={label}>{k.sub}</span>
          </div>
        ))}
      </div>

      <div style={{ ...card, minWidth: 0 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #eef0f3', display: 'flex', gap: '14px', alignItems: 'center' }}>
          {([['breaks', `Breaks${result ? ` (${breaks.length})` : ''}`], ['notes', `All break notes${notes ? ` (${notes.length})` : ''}`]] as const).map(([t, l]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', font: '600 13px Inter,sans-serif', color: tab === t ? '#005daa' : MUTE, borderBottom: tab === t ? '2px solid #005daa' : '2px solid transparent' }}>{l}</button>
          ))}
          <span style={{ flex: 1 }} />
          <span style={label}>Quantities in units (nominal for bonds); expected = previous statement + settled movements</span>
        </div>

        {loading && <div data-testid="pc-loading" style={{ padding: '28px 16px', color: MUTE }}>Running position check…</div>}
        {!loading && err && (
          <div role="alert" style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: 600, color: RED }}>Position check could not be run</span>
            <span style={{ color: MUTE }}>{err}</span>
            <span><button type="button" onClick={refresh} style={btn(false)}>Try again</button></span>
          </div>
        )}

        {!loading && !err && tab === 'breaks' && (breaks.length === 0 ? (
          <div data-testid="pc-empty" style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 600, color: GREEN }}>No breaks — every reported position reconciles</span>
            <span style={{ color: MUTE }}>{result ? `${result.accountsChecked} account${result.accountsChecked === 1 ? '' : 's'} checked for ${date ? dayMonthYear(date) : 'all statement dates'} using ${mode} rules.` : ''}</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}><div style={{ minWidth: '1100px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '10px', padding: '6px 12px', background: '#f8f9fb', color: MUTE, fontSize: '11px' }}>
              <span>Account · date</span><span>Instrument</span><span style={{ textAlign: 'right' }}>Previous</span><span style={{ textAlign: 'right' }}>Settled net</span><span style={{ textAlign: 'right' }}>Expected</span><span style={{ textAlign: 'right' }}>Reported</span><span style={{ textAlign: 'right' }}>Difference</span><span>Status</span><span>Note</span><span>Sources</span>
            </div>
            {breaks.map(b => {
              const k = keyOf(b);
              const isEditing = editing === k;
              return (
                <Fragment key={k}>
                  <div data-testid="break-row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: '10px', padding: '6px 12px', borderTop: '1px solid #f3f4f6', alignItems: 'center', background: isEditing ? '#f7faff' : undefined }} className="hov-row">
                    <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>{b.accountId}</span><span style={{ ...mono, color: MUTE }}>Safe {b.safeNo}</span><span style={{ ...mono, color: MUTE }}>{dayMonthYear(b.date)}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span><span style={{ ...mono, color: MUTE }}>{b.isin} · {b.qtyType}</span></div>
                    <span style={{ textAlign: 'right' }}>{fmtQty(b.previousQty)}</span>
                    <span style={{ textAlign: 'right' }}>{fmtQty(b.settledNet, true)}</span>
                    <span style={{ textAlign: 'right' }}>{fmtQty(b.expectedQty)}</span>
                    <span style={{ textAlign: 'right' }}>{fmtQty(b.reportedQty)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600, color: RED }}>{fmtQty(b.difference, true)}</span>
                    <span><StatusPill status={b.status} /></span>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span title={b.note ?? ''} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: b.note ? INK : MUTE }}>{b.note ?? 'No note'}</span>
                      <span style={{ fontSize: '10.5px', color: MUTE }}>{b.cause ? CAUSE_LABEL[b.cause] + ' · ' : ''}{b.updatedBy ? `${b.updatedBy} · ${dayMonthYearTime(b.updatedAt)}` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <SourceLinks ids={b.sourceMessageIds} />
                      <span style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => setEditing(isEditing ? null : k)} style={linkBtn}>{isEditing ? 'Close' : 'Edit'}</button>
                        <button type="button" onClick={() => setHistory({ k: b, title: b.name })} style={linkBtn}>History</button>
                      </span>
                    </div>
                  </div>
                  {isEditing && <EditForm b={b} author={author} onAuthor={setAuthor} onCancel={() => setEditing(null)} onSaved={refresh} />}
                </Fragment>
              );
            })}
          </div></div>
        ))}

        {!loading && !err && tab === 'notes' && (
          <div style={{ overflowX: 'auto' }}><div style={{ minWidth: '980px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(170px,1fr) 92px minmax(200px,1.4fr) 150px 140px', gap: '10px', padding: '6px 12px', background: '#f8f9fb', color: MUTE, fontSize: '11px' }}>
              <span>Account · date</span><span>Instrument</span><span>Status</span><span>Note</span><span>Last updated</span><span />
            </div>
            {(notes ?? []).map(n => (
              <div key={keyOf(n)} data-testid="note-row" style={{ display: 'grid', gridTemplateColumns: '120px minmax(170px,1fr) 92px minmax(200px,1.4fr) 150px 140px', gap: '10px', padding: '6px 12px', borderTop: '1px solid #f3f4f6', alignItems: 'center' }} className="hov-row">
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>{n.accountId}</span><span style={{ ...mono, color: MUTE }}>{dayMonthYear(n.date)}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span><span style={{ ...mono, color: MUTE }}>{n.isin}</span></div>
                <span><StatusPill status={n.status} /></span>
                <span style={{ color: n.note ? INK : MUTE }}>{n.note ?? 'No note'}{n.cause ? <span style={{ color: MUTE }}> · {CAUSE_LABEL[n.cause]}</span> : null}</span>
                <span style={{ fontSize: '11px' }}>{n.updatedBy}<br /><span style={{ color: MUTE }}>{dayMonthYearTime(n.updatedAt)}</span></span>
                <span style={{ display: 'flex', gap: '10px', whiteSpace: 'nowrap' }}>
                  <button type="button" onClick={() => openCheck(n)} style={linkBtn}>Open check</button>
                  <button type="button" onClick={() => setHistory({ k: n, title: n.name })} style={linkBtn}>History</button>
                </span>
              </div>
            ))}
          </div></div>
        )}
      </div>

      {history && <HistoryDrawer k={history.k} title={history.title} onClose={() => setHistory(null)} />}
    </div>
  );
}
