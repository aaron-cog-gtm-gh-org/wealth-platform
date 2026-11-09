import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Panel } from '../../ui';
import { custodyApi, MESSAGES_PAGE_SIZE } from '../api';
import type { MessageFile } from '../api';
import { count, custodyDate, fileSize, isIsoDate, pageCount } from '../model';
import { LoadState, useCustody, useLoad } from '../shared';

interface Filters { family: '' | 'MT535' | 'MT54x'; date: string; safe: string }
const EMPTY: Filters = { family: '', date: '', safe: '' };

const PARSE_TONE: Record<string, string> = { ok: 'ok', error: 'bad', pending: 'warn' };
const PARSE_LABEL: Record<string, string> = { ok: 'Parsed', error: 'Parse error', pending: 'Pending' };

export function MessagesTable({ files, selected, onOpen, caption }: { files: MessageFile[]; selected: string | null; onOpen: (fileName: string) => void; caption: string }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table ws-table--compact">
        <caption className="cu-caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">File name</th>
            <th scope="col">Message</th>
            <th scope="col">Date</th>
            <th scope="col">Safekeeping account</th>
            <th scope="col" className="ws-num">Size</th>
            <th scope="col">Parse status</th>
          </tr>
        </thead>
        <tbody>
          {files.map(f => (
            <tr key={f.fileName} className={f.fileName === selected ? 'is-selected' : undefined}>
              <th scope="row">
                <button type="button" className="ws-linkbtn ws-mono" aria-pressed={f.fileName === selected} onClick={() => onOpen(f.fileName)}>{f.fileName}</button>
              </th>
              <td className="ws-mono">MT{f.mtType}</td>
              <td>{custodyDate(f.msgDate)}</td>
              <td className="ws-mono">{f.safeCode}</td>
              <td className="ws-num">{fileSize(f.sizeBytes)}</td>
              <td><span className={`ws-pill ws-pill--${PARSE_TONE[f.parseStatus] ?? 'mute'}`}>{PARSE_LABEL[f.parseStatus] ?? f.parseStatus}</span></td>
            </tr>
          ))}
          {files.length === 0 && <tr><td colSpan={6} className="ws-empty">No custodian messages match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RawViewer({ fileName }: { fileName: string }) {
  const { nav } = useCustody();
  const msg = useLoad(`message:${fileName}`, () => custodyApi.message(fileName));
  return (
    <Panel title={`Message ${fileName}`} titleId="cu-raw-title" actions={<button type="button" className="ws-btn ws-btn--secondary ws-btn--sm" onClick={() => nav('messages')}>Close message</button>}>
      <LoadState state={msg.state} what="the message" />
      {msg.state.status === 'ready' && (
        <>
          <p className="ws-pad ws-muted" style={{ margin: 0 }}>{msg.state.data.family} · <span className="ws-mono">{msg.state.data.relPath}</span></p>
          <pre className="cu-raw" tabIndex={0} aria-label={`Raw SWIFT text of ${fileName}`}>{msg.state.data.raw}</pre>
        </>
      )}
    </Panel>
  );
}

export function MessagesView() {
  const { route, nav } = useCustody();
  const ids = { family: useId(), date: useId(), safe: useId(), err: useId() };
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const key = `messages:${applied.family}:${applied.date}:${applied.safe}:${page}`;
  const list = useLoad(key, () => custodyApi.messages({ family: applied.family || undefined, date: applied.date || undefined, safe: applied.safe.trim() || undefined, page }));
  const pages = list.state.status === 'ready' ? pageCount(list.state.data.total, MESSAGES_PAGE_SIZE) : 1;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.date && !isIsoDate(draft.date)) { setFormError('Enter the date as YYYY-MM-DD.'); return; }
    if (draft.safe.trim() && !/^\d{1,10}$/.test(draft.safe.trim())) { setFormError('Safekeeping account must be digits only.'); return; }
    setFormError(null);
    setApplied({ ...draft, safe: draft.safe.trim() });
    setPage(1);
  };

  const reset = () => { setDraft(EMPTY); setApplied(EMPTY); setPage(1); setFormError(null); };

  return (
    <>
      <Panel
        title="Custodian messages"
        titleId="cu-messages-title"
        actions={list.state.status === 'ready' && <span className="ws-count" aria-live="polite">{count(list.state.data.total)} files</span>}
      >
        <form className="ws-filters" role="search" aria-label="Filter custodian messages" onSubmit={submit} noValidate>
          <div className="ws-field">
            <label htmlFor={ids.family}>Message type</label>
            <select id={ids.family} value={draft.family} onChange={e => setDraft(d => ({ ...d, family: e.target.value as Filters['family'] }))}>
              <option value="">All types</option>
              <option value="MT535">MT535 statements</option>
              <option value="MT54x">MT54x confirmations</option>
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor={ids.date}>Message date</label>
            <input id={ids.date} type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} />
          </div>
          <div className="ws-field">
            <label htmlFor={ids.safe}>Safekeeping account</label>
            <input id={ids.safe} type="text" inputMode="numeric" maxLength={10} value={draft.safe} onChange={e => setDraft(d => ({ ...d, safe: e.target.value }))} aria-invalid={!!formError} aria-describedby={formError ? ids.err : undefined} />
          </div>
          <button type="submit" className="ws-btn ws-btn--primary">List messages</button>
          <button type="button" className="ws-btn ws-btn--secondary" onClick={reset}>Clear filters</button>
        </form>
        {formError && <div className="ws-pad"><div id={ids.err} role="alert" className="ws-notice ws-notice--error">{formError}</div></div>}
        <LoadState state={list.state} what="custodian messages" />
        {list.state.status === 'ready' && (
          <>
            <MessagesTable
              files={list.state.data.files}
              selected={route.file}
              onOpen={f => nav('messages', { file: f })}
              caption={`Custodian message files, page ${list.state.data.page} of ${pages}`}
            />
            <nav className="cu-pager" aria-label="Message pages">
              <button type="button" className="ws-btn ws-btn--secondary ws-btn--sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Previous page</button>
              <span className="ws-count" aria-live="polite">Page {page} of {pages}</span>
              <button type="button" className="ws-btn ws-btn--secondary ws-btn--sm" onClick={() => setPage(p => p + 1)} disabled={page >= pages}>Next page</button>
            </nav>
          </>
        )}
      </Panel>
      {route.file && <RawViewer key={route.file} fileName={route.file} />}
    </>
  );
}
