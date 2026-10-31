import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, EXCEPTION_OWNERS, EXCEPTION_STATUSES } from '../api';
import type { ExceptionStatus, SettlementException } from '../api';
import { useWorkspace } from '../context';
import { EmptyRow, Notices, Panel, SortHeader, StatusPill, useAction, useSort } from '../ui';

const NOTE_MIN = 10;
const UNASSIGNED = 'Unassigned';

export function SettlementsArea() {
  const { data, lk } = useWorkspace();
  const [status, setStatus] = useState<'All' | 'Active' | ExceptionStatus>('Active');
  const [owner, setOwner] = useState('All');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => data.exceptions[0]?.id ?? null);
  const ids = { status: useId(), owner: useId(), search: useId() };

  const owners = [...new Set([...EXCEPTION_OWNERS, ...data.exceptions.map(e => e.owner).filter((o): o is string => !!o)])];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.exceptions.filter(e =>
      (status === 'All' || (status === 'Active' ? e.status !== 'Resolved' : e.status === status))
      && (owner === 'All' || (owner === UNASSIGNED ? !e.owner : e.owner === owner))
      && (!q || [e.id, e.reason, e.note ?? '', lk.accountLabel(e.accountId), lk.clientOf(e.accountId)?.name ?? ''].some(v => v.toLowerCase().includes(q))));
  }, [data.exceptions, status, owner, query, lk]);

  const sort = useSort(rows, 'id', {
    id: (e: SettlementException) => e.id,
    reason: (e: SettlementException) => e.reason,
    owner: (e: SettlementException) => e.owner ?? '\uffff',
    status: (e: SettlementException) => EXCEPTION_STATUSES.indexOf(e.status),
  });

  const selected = data.exceptions.find(e => e.id === selectedId) ?? null;

  return (
    <div className="ws-split">
      <Panel title="Exception queue" titleId="ws-exceptions-title" actions={<span className="ws-count" aria-live="polite">{rows.length} of {data.exceptions.length} exceptions</span>}>
        <div className="ws-filters" role="search" aria-label="Filter exceptions">
          <div className="ws-field">
            <label htmlFor={ids.status}>Filter by status</label>
            <select id={ids.status} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
              <option value="Active">Open and in progress</option>
              <option value="All">All statuses</option>
              {EXCEPTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor={ids.owner}>Filter by owner</label>
            <select id={ids.owner} value={owner} onChange={e => setOwner(e.target.value)}>
              <option value="All">All owners</option>
              <option value={UNASSIGNED}>Unassigned</option>
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="ws-field ws-field--grow">
            <label htmlFor={ids.search}>Search exceptions</label>
            <input id={ids.search} type="search" value={query} placeholder="ID, reason, client or account" onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="ws-sr">Settlement exceptions</caption>
            <thead>
              <tr>
                <SortHeader label="Exception" k="id" sort={sort} />
                <SortHeader label="Reason" k="reason" sort={sort} />
                <th scope="col">Account</th>
                <SortHeader label="Owner" k="owner" sort={sort} />
                <SortHeader label="Status" k="status" sort={sort} />
              </tr>
            </thead>
            <tbody>
              {sort.sorted.map(e => (
                <tr key={e.id} className={e.id === selectedId ? 'is-selected' : undefined}>
                  <th scope="row">
                    <button type="button" className="ws-linkbtn ws-mono" aria-pressed={e.id === selectedId} aria-label={`Open exception ${e.id}`} onClick={() => setSelectedId(e.id)}>{e.id}</button>
                  </th>
                  <td>{e.reason}</td>
                  <td>{lk.accountLabel(e.accountId)}<div className="ws-muted">{lk.clientOf(e.accountId)?.name}</div></td>
                  <td>{e.owner ?? <span className="ws-muted">Unassigned</span>}</td>
                  <td><StatusPill status={e.status} /></td>
                </tr>
              ))}
              {sort.sorted.length === 0 && <EmptyRow colSpan={5}>No exceptions match these filters. Choose All statuses to include resolved items.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected ? (
        <ExceptionDetail key={selected.id} ex={selected} />
      ) : (
        <Panel title="Exception details" titleId="ws-exception-detail-title"><p className="ws-pad ws-muted">Select an exception to assign, annotate or resolve it.</p></Panel>
      )}
    </div>
  );
}

function ExceptionDetail({ ex }: { ex: SettlementException }) {
  const { lk, reload } = useWorkspace();
  const [owner, setOwner] = useState(ex.owner ?? '');
  const [note, setNote] = useState(ex.note ?? '');
  const [status, setStatus] = useState<ExceptionStatus>(ex.status);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const action = useAction(reload);
  const ids = { owner: useId(), note: useId(), noteHint: useId(), status: useId() };
  const resolved = ex.status === 'Resolved';
  const owners = [...new Set([...EXCEPTION_OWNERS, ...(ex.owner ? [ex.owner] : [])])];

  useEffect(() => { setOwner(ex.owner ?? ''); setNote(ex.note ?? ''); setStatus(ex.status); }, [ex.owner, ex.note, ex.status]);

  const touch = () => { setFieldError(null); action.clear(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: { owner?: string; note?: string; status?: ExceptionStatus } = {};
    if (owner && owner !== (ex.owner ?? '')) body.owner = owner;
    if (note.trim() !== (ex.note ?? '').trim() || (status === 'Resolved' && note !== (ex.note ?? ''))) body.note = note;
    if (status !== ex.status) body.status = status;
    if (!Object.keys(body).length) { setFieldError('No changes to save. Change the owner, note or status first.'); return; }
    setFieldError(null);
    const parts = [body.owner && `assigned to ${body.owner}`, body.note !== undefined && 'note saved', body.status && `status ${body.status}`].filter(Boolean).join(', ');
    await action.run(() => api.updateException(ex.id, body), () => `Exception ${ex.id} updated: ${parts}.`);
  };

  const client = lk.clientOf(ex.accountId);

  return (
    <Panel title={`Exception ${ex.id}`} titleId="ws-exception-detail-title">
      <dl className="ws-dl ws-pad">
        <dt>Reason</dt><dd className="ws-strong">{ex.reason}</dd>
        <dt>Account</dt><dd>{lk.accountLabel(ex.accountId)}</dd>
        <dt>Client</dt><dd>{client?.name ?? '—'}</dd>
        <dt>Status</dt><dd><StatusPill status={ex.status} /></dd>
        <dt>Owner</dt><dd>{ex.owner ?? 'Unassigned'}</dd>
        <dt>Note</dt><dd>{ex.note || <span className="ws-muted">No note yet</span>}</dd>
      </dl>

      {resolved ? (
        <div className="ws-pad">
          <p className="ws-notice ws-notice--info">Resolved exceptions are closed and can’t be reopened or edited.</p>
          <Notices error={action.error} success={action.success} />
        </div>
      ) : (
        <form className="ws-form ws-pad" onSubmit={submit} noValidate aria-labelledby="ws-exception-form-title">
          <h3 id="ws-exception-form-title" className="ws-h3 ws-h3--flush">Work this exception</h3>
          <div className="ws-grid2">
            <div className="ws-field">
              <label htmlFor={ids.owner}>Owner</label>
              <select id={ids.owner} value={owner} onChange={e => { setOwner(e.target.value); touch(); }}>
                {!ex.owner && <option value="">Unassigned</option>}
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="ws-field">
              <label htmlFor={ids.status}>Status</label>
              <select id={ids.status} value={status} onChange={e => { setStatus(e.target.value as ExceptionStatus); touch(); }}>
                {EXCEPTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="ws-field">
            <label htmlFor={ids.note}>Note</label>
            <textarea id={ids.note} rows={3} value={note} onChange={e => { setNote(e.target.value); touch(); }} aria-describedby={ids.noteHint} />
            <span id={ids.noteHint} className="ws-hint">At least {NOTE_MIN} characters. Required to resolve, along with an owner.</span>
          </div>
          {fieldError && <div role="alert" className="ws-notice ws-notice--error">{fieldError}</div>}
          <Notices error={action.error} success={action.success} />
          <div className="ws-actions">
            <button type="submit" className="ws-btn ws-btn--primary" disabled={action.busy}>{action.busy ? 'Saving changes…' : 'Save changes'}</button>
          </div>
        </form>
      )}
    </Panel>
  );
}
