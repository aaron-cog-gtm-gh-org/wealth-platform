import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { getCustodyMessage, getCustodyMessages } from '../api/client';
import type { CustodyMessage, CustodyMessagePage } from '../api/types';
import { dayMonthYear, fmt } from '../format';
import { detectLineEndings, holdingsHref, messageBrowserHref, settlementsHref } from '../model/messages';

// Ops screen for US4: filters live in the URL (?type=&date=&safe=&page=&message=) so legacy-style
// deep links work; raw text is rendered escaped in a <pre>, never through innerHTML.

const MONO = "'IBM Plex Mono',monospace";
const input: React.CSSProperties = { padding: '4px 7px', border: '1px solid #cfd5dd', borderRadius: '4px', font: '12px Inter,sans-serif', background: '#fff' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e1e5eb', borderRadius: '6px', minWidth: 0 };
const pill = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '1px 7px', borderRadius: '9px', fontSize: '10.5px', fontWeight: 600, background: bg, color: fg });

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All types' },
  { value: '535', label: 'MT535' },
  { value: '54x', label: 'MT54x' },
  { value: '544', label: 'MT544' },
  { value: '545', label: 'MT545' },
  { value: '546', label: 'MT546' },
  { value: '547', label: 'MT547' },
];

interface Filters { type: string; date: string; safe: string; page: number }

const readFilters = (): { f: Filters; message: number | null } => {
  const q = new URLSearchParams(window.location.search);
  const m = Number(q.get('message') ?? q.get('messageId') ?? '');
  return {
    f: { type: q.get('type') ?? '', date: q.get('date') ?? '', safe: q.get('safe') ?? '', page: Math.max(1, Number(q.get('page') ?? 1) || 1) },
    message: Number.isInteger(m) && m > 0 ? m : null,
  };
};

const pushParams = (params: Record<string, string | number | null>) => {
  const q = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === '') q.delete(k); else q.set(k, String(v));
  }
  window.history.pushState(null, '', '?' + q.toString());
};

const PAGE_SIZE = 50;

export function MessageBrowser() {
  const [draft, setDraft] = useState(() => readFilters().f);          // what's in the boxes
  const [applied, setApplied] = useState(() => readFilters().f);      // what the list shows
  const [list, setList] = useState<CustodyMessagePage | null>(null);
  const [listState, setListState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [selId, setSelId] = useState<number | null>(() => readFilters().message);
  const [detail, setDetail] = useState<CustodyMessage | null>(null);
  const [detailErr, setDetailErr] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadList = useCallback((f: Filters) => {
    setListState('loading');
    getCustodyMessages({ type: f.type || undefined, date: f.date || undefined, safe: f.safe || undefined, page: f.page })
      .then(p => { setList(p); setListState(p.total === 0 ? 'ok' : 'ok'); })
      .catch(() => setListState('error'));
  }, []);

  useEffect(() => {
    const sync = () => {
      const { f, message } = readFilters();
      setDraft(f); setApplied(f); setSelId(message);
      loadList(f);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [loadList]);

  useEffect(() => { loadList(applied); }, [applied, loadList]);

  useEffect(() => {
    if (selId === null) { setDetail(null); return; }
    setDetail(null); setDetailErr(false); setCopied(false);
    getCustodyMessage(selId).then(setDetail, () => setDetailErr(true));
  }, [selId]);

  const apply = () => {
    const f = { ...draft, page: 1 };
    pushParams({ type: f.type, date: f.date, safe: f.safe, page: null });
    setApplied(f);
  };
  const setPage = (page: number) => {
    const f = { ...applied, page };
    pushParams({ page: page > 1 ? page : null });
    setDraft(f); setApplied(f);
  };
  const open = (messageId: number) => {
    pushParams({ message: messageId });
    setSelId(messageId);
  };

  const endings = useMemo(() => detail ? detectLineEndings(detail.rawText) : null, [detail]);
  const baseName = detail?.sourceFile.split('/').pop() ?? '';

  const download = () => {
    if (!detail) return;
    const url = URL.createObjectURL(new Blob([detail.rawText], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: baseName });
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;
  const first = list ? (applied.page - 1) * PAGE_SIZE + 1 : 0;
  const last = list ? Math.min(list.total, applied.page * PAGE_SIZE) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ ...card, padding: '8px 12px', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
          Type
          <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} style={input}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
          Business date
          <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} style={input} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
          Safe code
          <input value={draft.safe} onChange={e => setDraft(d => ({ ...d, safe: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') apply(); }} placeholder="e.g. 16598" style={{ ...input, width: '90px', fontFamily: MONO }} />
        </label>
        <div onClick={apply} style={{ padding: '5px 14px', background: '#005daa', color: '#fff', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>List</div>
        <span style={{ fontSize: '11px', color: 'rgba(25,25,25,.5)' }}>Type filters accept MT535 / MT54x / MT544–MT547.</span>
      </div>

      <div style={card}>
        {listState === 'loading' && <div style={{ padding: '14px', color: 'rgba(25,25,25,.56)' }}>Loading messages…</div>}
        {listState === 'error' && <div style={{ padding: '14px', color: '#b3201f' }}>Messages didn’t load — retry in a minute.</div>}
        {listState === 'ok' && list && list.rows.length === 0 && <div style={{ padding: '14px', color: 'rgba(25,25,25,.56)' }}>No files match.</div>}
        {listState === 'ok' && list && list.rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}><div style={{ minWidth: '900px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px,1fr) 64px 92px 80px 100px 70px 70px', gap: '10px', padding: '6px 12px', background: '#f8f9fb', color: 'rgba(25,25,25,.56)', fontSize: '11px' }}>
              <span>File</span><span>Type</span><span>Function</span><span>Safe</span><span>Business date</span><span style={{ textAlign: 'right' }}>Size</span><span>Status</span>
            </div>
            {list.rows.map(r => (
              <Fragment key={r.messageId}>
                <div onClick={() => open(r.messageId)} className="hov-row"
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(230px,1fr) 64px 92px 80px 100px 70px 70px', gap: '10px', padding: '5px 12px', borderTop: '1px solid #f3f4f6', alignItems: 'center', cursor: 'pointer', background: selId === r.messageId ? '#eaf1fa' : undefined }}>
                  <span style={{ fontFamily: MONO, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#005daa' }}>{r.sourceFile}</span>
                  <span style={{ fontFamily: MONO }}>MT{r.mtType}</span>
                  <span style={{ fontFamily: MONO, fontSize: '11px' }}>{r.functionCode}</span>
                  <span style={{ fontFamily: MONO }}>{r.safeNo ?? '—'}</span>
                  <span>{dayMonthYear(r.businessDate)}</span>
                  <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: '11px' }}>{fmt(r.sizeBytes)}</span>
                  <span>{r.parseStatus === 'ERROR' ? <span style={pill('#fdecec', '#b3201f')}>ERROR</span> : <span style={pill('#e3f5ec', '#00703f')}>OK</span>}</span>
                </div>
              </Fragment>
            ))}
          </div></div>
        )}
        {list && list.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderTop: '1px solid #eef0f3' }}>
            <span style={{ fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>Showing {fmt(first)}–{fmt(last)} of {fmt(list.total)}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div onClick={() => applied.page > 1 && setPage(applied.page - 1)}
                style={{ padding: '4px 10px', border: '1px solid #cfd5dd', borderRadius: '6px', fontWeight: 500, cursor: applied.page > 1 ? 'pointer' : 'default', color: applied.page > 1 ? '#191919' : 'rgba(25,25,25,.35)' }}>Previous</div>
              <div onClick={() => applied.page < totalPages && setPage(applied.page + 1)}
                style={{ padding: '4px 10px', border: '1px solid #cfd5dd', borderRadius: '6px', fontWeight: 500, cursor: applied.page < totalPages ? 'pointer' : 'default', color: applied.page < totalPages ? '#191919' : 'rgba(25,25,25,.35)' }}>Next</div>
            </div>
          </div>
        )}
      </div>

      {selId !== null && (
        <div style={card}>
          {detail === null && !detailErr && <div style={{ padding: '14px', color: 'rgba(25,25,25,.56)' }}>Loading message {selId}…</div>}
          {detailErr && <div style={{ padding: '14px', color: '#b3201f' }}>Message {selId} didn’t load.</div>}
          {detail && (<>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ font: `600 13px ${MONO}` }}>{baseName}</span>
                <span style={{ fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
                  message <span style={{ fontFamily: MONO }}>#{detail.messageId}</span> · MT{detail.mtType} {detail.functionCode} · {fmt(detail.sizeBytes)} bytes
                  {endings && <> · <span style={pill('#e6eef8', '#00498a')}>{endings}</span></>}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div onClick={download} style={{ padding: '5px 12px', background: '#005daa', color: '#fff', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Download original</div>
                <div onClick={() => { navigator.clipboard?.writeText(detail.rawText); setCopied(true); }}
                  style={{ padding: '5px 12px', border: '1px solid #cfd5dd', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}>{copied ? 'Copied' : 'Copy'}</div>
              </div>
            </div>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #eef0f3', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
              <span>sha256 <span style={{ fontFamily: MONO, color: '#191919' }}>{detail.contentSha256}</span></span>
              <span>source <span style={{ fontFamily: MONO, color: '#191919' }}>{detail.sourceFile}</span></span>
            </div>
            {detail.parseError && (
              <div style={{ margin: '10px 12px 0', padding: '8px 10px', background: '#fdecec', border: '1px solid #f3c2c1', borderRadius: '6px', color: '#b3201f' }}>
                Parse error: {detail.parseError}
              </div>
            )}
            {detail.derived && (
              <div style={{ margin: '10px 12px 0', padding: '8px 10px', border: '1px solid #e1e5eb', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>Derived record</span>
                {detail.derived.kind === 'statement' ? (
                  <span>
                    Statement · account <span style={{ fontFamily: MONO }}>{detail.derived.accountId ?? '—'}</span> · {dayMonthYear(detail.derived.date)} ·{' '}
                    {detail.derived.effective ? 'effective' : 'superseded'} · {fmt(detail.derived.lineCount ?? 0)} lines
                  </span>
                ) : (
                  <span>
                    Confirmation <span style={{ fontFamily: MONO }}>{detail.derived.reference}</span> · {detail.derived.isin} · settles {dayMonthYear(detail.derived.date)}
                  </span>
                )}
                <span style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  {detail.derived.kind === 'statement' && detail.derived.accountId != null && detail.derived.clientId != null && (
                    <a href={holdingsHref(detail.derived.clientId, detail.derived.accountId, detail.derived.date)} style={{ color: '#005daa' }}>Open holdings</a>
                  )}
                  {detail.derived.kind === 'confirmation' && detail.derived.accountId != null && detail.derived.clientId != null && (
                    <a href={settlementsHref(detail.derived.clientId, detail.derived.accountId, detail.derived.date, detail.derived.date)} style={{ color: '#005daa' }}>Open settlements</a>
                  )}
                  {detail.derived.cancelsMessageId != null && (
                    <a href={messageBrowserHref(detail.derived.cancelsMessageId)} style={{ color: '#005daa' }}>Cancels message #{detail.derived.cancelsMessageId}</a>
                  )}
                  {detail.derived.cancelledByMessageId != null && (
                    <a href={messageBrowserHref(detail.derived.cancelledByMessageId)} style={{ color: '#005daa' }}>Cancelled by message #{detail.derived.cancelledByMessageId}</a>
                  )}
                </span>
              </div>
            )}
            <pre data-testid="raw-message" style={{ margin: '10px 12px 12px', padding: '10px', background: '#f8f9fb', border: '1px solid #eef0f3', borderRadius: '6px', overflowX: 'auto', whiteSpace: 'pre', font: `11px/15px ${MONO}`, maxHeight: '480px', overflowY: 'auto' }}>{detail.rawText}</pre>
          </>)}
        </div>
      )}
    </div>
  );
}
