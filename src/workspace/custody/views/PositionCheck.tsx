import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Notices, Panel, errorMessage } from '../../ui';
import { custodyApi } from '../api';
import type { BreakRow, CheckAllAccount, Operator, ReconEditStatus } from '../api';
import { count, custodyDate, custodyQty, custodyTimestamp, initialEditStatus, RECON_EDIT_STATUSES, RECON_NOTE_MAX, signedQty } from '../model';
import { AccountSelect, CustodyLink, DateSelect, LoadState, ReconPill, useCustody, useLoad } from '../shared';
import { AccountMeta, useSelectedAccount } from './Holdings';

const diffClass = (d: number) => (d < 0 ? 'cu-diff--neg' : d > 0 ? 'cu-diff--pos' : undefined);

export function BreaksTable({ caption, rows, selected, onEdit }: { caption: string; rows: BreakRow[]; selected: string | null; onEdit?: (isin: string) => void }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="cu-caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">ISIN</th>
            <th scope="col">Instrument</th>
            <th scope="col" className="ws-num">Previous qty</th>
            <th scope="col" className="ws-num">Net settled</th>
            <th scope="col" className="ws-num">Expected</th>
            <th scope="col" className="ws-num">Statement qty</th>
            <th scope="col" className="ws-num">Difference</th>
            <th scope="col">Status</th>
            <th scope="col">Note</th>
            <th scope="col">Updated by</th>
            <th scope="col">Updated</th>
            {onEdit && <th scope="col"><span className="ws-sr">Action</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.isin} className={r.isin === selected ? 'is-selected' : undefined}>
              <th scope="row" className="ws-mono">{r.isin}</th>
              <td>{r.instrument}</td>
              <td className="ws-num">{custodyQty(r.prevQty)}</td>
              <td className="ws-num">{signedQty(r.netSettled)}</td>
              <td className="ws-num">{custodyQty(r.expected)}</td>
              <td className="ws-num">{custodyQty(r.stmtQty)}</td>
              <td className={`ws-num ${diffClass(r.diff) ?? ''}`}>{signedQty(r.diff)}</td>
              <td><ReconPill status={r.status} /></td>
              <td className="cu-note">{r.note || <span className="ws-muted">—</span>}</td>
              <td>{r.updatedBy ?? <span className="ws-muted">—</span>}</td>
              <td>{custodyTimestamp(r.updatedAt)}</td>
              {onEdit && (
                <td>
                  <button type="button" className="ws-btn ws-btn--secondary ws-btn--sm" aria-label={`Update break ${r.isin}`} aria-pressed={r.isin === selected} onClick={() => onEdit(r.isin)}>Update</button>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={onEdit ? 12 : 11} className="ws-empty">No breaks: every position agrees with the statement.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function ReconEditor({ row, operators, busy, error, success, onSave, onCancel }: {
  row: BreakRow;
  operators: Operator[];
  busy: boolean;
  error: string | null;
  success: string | null;
  onSave: (input: { status: ReconEditStatus; note: string; operator: string }) => void;
  onCancel: () => void;
}) {
  const ids = { status: useId(), operator: useId(), note: useId(), counter: useId(), err: useId() };
  const [status, setStatus] = useState<ReconEditStatus>(() => initialEditStatus(row.status));
  const [note, setNote] = useState(row.note ?? '');
  const [operator, setOperator] = useState(() => (row.updatedBy && operators.some(o => o.username === row.updatedBy) ? row.updatedBy : ''));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const statusRef = useRef<HTMLSelectElement>(null);

  useEffect(() => { statusRef.current?.focus(); }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!operator) { setFieldError('Choose the operator recording this update.'); return; }
    if (note.length > RECON_NOTE_MAX) { setFieldError(`Notes are limited to ${RECON_NOTE_MAX} characters.`); return; }
    setFieldError(null);
    onSave({ status, note, operator });
  };

  return (
    <form className="ws-form ws-pad cu-editor" onSubmit={submit} noValidate aria-labelledby="cu-editor-title">
      <h3 id="cu-editor-title" className="ws-h3 ws-h3--flush">Update break {row.isin} · {row.instrument}</h3>
      <p className="ws-hint" style={{ margin: 0 }}>Current status <ReconPill status={row.status} />. Difference {signedQty(row.diff)}.</p>
      <div className="ws-grid2">
        <div className="ws-field">
          <label htmlFor={ids.status}>Status</label>
          <select id={ids.status} ref={statusRef} value={status} onChange={e => setStatus(e.target.value as ReconEditStatus)}>
            {RECON_EDIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="ws-field">
          <label htmlFor={ids.operator}>Operator</label>
          <select id={ids.operator} value={operator} onChange={e => { setOperator(e.target.value); setFieldError(null); }} aria-invalid={fieldError !== null && !operator} aria-describedby={fieldError ? ids.err : undefined}>
            <option value="">Choose operator</option>
            {operators.map(o => <option key={o.username} value={o.username}>{o.fullName} ({o.username})</option>)}
          </select>
        </div>
      </div>
      <div className="ws-field">
        <label htmlFor={ids.note}>Note</label>
        <textarea id={ids.note} rows={3} maxLength={RECON_NOTE_MAX} value={note} onChange={e => { setNote(e.target.value); setFieldError(null); }} aria-describedby={ids.counter} />
        <span id={ids.counter} className="cu-counter">{note.length} / {RECON_NOTE_MAX} characters</span>
      </div>
      {fieldError && <div id={ids.err} role="alert" className="ws-notice ws-notice--error">{fieldError}</div>}
      <Notices error={error} success={success} />
      <div className="ws-actions">
        <button type="button" className="ws-btn ws-btn--secondary" onClick={onCancel} disabled={busy}>Close</button>
        <button type="submit" className="ws-btn ws-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save break'}</button>
      </div>
    </form>
  );
}

export function PositionCheckView() {
  const { route, nav, refreshAudit } = useCustody();
  const { accounts, list, acctId, account, missing } = useSelectedAccount();
  const ids = { acct: useId(), date: useId() };
  const dates = useLoad(account ? `dates:${account.acctId}` : null, () => custodyApi.statementDates(account!.acctId));
  const dateList = dates.state.status === 'ready' ? dates.state.data : [];
  const date = route.date && dateList.includes(route.date) ? route.date : dateList[0] ?? null;
  const check = useLoad(account && date ? `check:${account.acctId}:${date}` : null, () => custodyApi.positionCheck(account!.acctId, date!));
  const operators = useLoad('operators', custodyApi.operators);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { setEditing(null); setError(null); setSuccess(null); }, [account?.acctId, date]);

  const rows = check.state.status === 'ready' ? check.state.data.rows : [];
  const row = rows.find(r => r.isin === editing) ?? null;

  const save = async (input: { status: ReconEditStatus; note: string; operator: string }) => {
    if (!account || !date || !row) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await custodyApi.saveReconNote({ acctId: account.acctId, isin: row.isin, stmtDate: date, ...input });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      return;
    }
    try {
      await Promise.all([check.refetch(), refreshAudit()]);
      setSuccess(`Break ${row.isin} saved as ${input.status} by ${input.operator}.`);
    } catch (e) {
      setSuccess(`Break ${row.isin} saved as ${input.status} by ${input.operator}.`);
      setError('Saved, but the latest data could not be loaded: ' + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ws-stack">
      <Panel
        title="Position check"
        titleId="cu-check-title"
        actions={account && date && (
          <span className="cu-links">
            <CustodyLink view="holdings" extra={{ acct: account.acctId, date }}>Holdings</CustodyLink>
            <CustodyLink view="checkall" extra={{ date }}>Check all accounts</CustodyLink>
          </span>
        )}
      >
        <LoadState state={accounts} what="custody accounts" />
        {accounts.status === 'ready' && (
          <>
            <form className="ws-filters" aria-label="Choose statement to check" onSubmit={e => e.preventDefault()}>
              <AccountSelect id={ids.acct} accounts={list} value={account ? acctId : null} onChange={a => nav('check', { acct: a })} />
              <DateSelect id={ids.date} label="Statement date" dates={dateList} value={date} onChange={d => nav('check', { acct: acctId, date: d })} disabled={dates.state.status !== 'ready'} />
            </form>
            {missing && <div className="ws-pad"><div role="alert" className="ws-notice ws-notice--error">Account {route.acct} is not on file. Choose an account from the list.</div></div>}
            {account && (
              <AccountMeta account={account}>
                {check.state.status === 'ready' && (
                  <>
                    <div><dt>Statement date</dt><dd>{custodyDate(check.state.data.statementDate)}</dd></div>
                    <div><dt>Previous statement</dt><dd>{custodyDate(check.state.data.previousStatementDate)}</dd></div>
                    <div><dt>Breaks</dt><dd>{check.state.data.rows.length}</dd></div>
                  </>
                )}
              </AccountMeta>
            )}
            <LoadState state={dates.state} what="statement dates" />
            {dates.state.status === 'ready' && dateList.length === 0 && <p className="ws-pad ws-muted">No statements on file for this account.</p>}
            <LoadState state={check.state} what="the position check" />
            {check.state.status === 'ready' && check.state.data.message && (
              <div className="ws-pad"><p className="ws-notice ws-notice--info" role="status">{check.state.data.message}</p></div>
            )}
            {account && check.state.status === 'ready' && !check.state.data.message && (
              <BreaksTable
                caption={`Breaks for ${account.acctNo} at ${custodyDate(check.state.data.statementDate)}: expected = previous quantity + net settled`}
                rows={rows}
                selected={editing}
                onEdit={isin => { setEditing(isin); setError(null); setSuccess(null); }}
              />
            )}
          </>
        )}
      </Panel>
      {row && (
        <Panel title="Record reconciliation" titleId="cu-recon-title">
          <LoadState state={operators.state} what="operators" />
          {operators.state.status === 'ready' && (
            <ReconEditor key={`${row.isin}:${date}`} row={row} operators={operators.state.data} busy={busy} error={error} success={success} onSave={save} onCancel={() => setEditing(null)} />
          )}
        </Panel>
      )}
    </div>
  );
}

export function CheckAllTable({ caption, accounts, date }: { caption: string; accounts: CheckAllAccount[]; date: string }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="cu-caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col">Client</th>
            <th scope="col">Previous statement</th>
            <th scope="col" className="ws-num">Breaks</th>
            <th scope="col" className="ws-num">New breaks</th>
            <th scope="col"><span className="ws-sr">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.acctId}>
              <th scope="row" className="ws-mono">{a.acctNo}</th>
              <td>{a.clientName}</td>
              <td>{custodyDate(a.previousStatementDate)}</td>
              <td className={`ws-num ${a.breaks > 0 ? 'ws-bad' : ''}`}>{a.breaks}</td>
              <td className="ws-num">{a.newBreaks}</td>
              <td><CustodyLink view="check" extra={{ acct: a.acctId, date }} aria-label={`View position check for ${a.acctNo}`}>View check</CustodyLink></td>
            </tr>
          ))}
          {accounts.length === 0 && <tr><td colSpan={6} className="ws-empty">No accounts to show for this statement date.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function CheckAllView() {
  const { route, nav } = useCustody();
  const ids = { date: useId(), only: useId() };
  const dates = useLoad('statement-dates', custodyApi.allStatementDates);
  const dateList = dates.state.status === 'ready' ? dates.state.data : [];
  const date = route.date && dateList.includes(route.date) ? route.date : dateList[0] ?? null;
  const result = useLoad(date ? `checkall:${date}` : null, () => custodyApi.checkAll(date!));
  const [onlyBreaks, setOnlyBreaks] = useState(false);
  const all = result.state.status === 'ready' ? result.state.data.accounts : [];
  const shown = onlyBreaks ? all.filter(a => a.breaks > 0) : all;
  const totalBreaks = all.reduce((s, a) => s + a.breaks, 0);

  return (
    <Panel title="Check all accounts" titleId="cu-checkall-title">
      <form className="ws-filters" aria-label="Choose statement date" onSubmit={e => e.preventDefault()}>
        <DateSelect id={ids.date} label="Statement date" dates={dateList} value={date} onChange={d => nav('checkall', { date: d })} disabled={dates.state.status !== 'ready'} />
        <label className="ws-check" htmlFor={ids.only}>
          <input id={ids.only} type="checkbox" checked={onlyBreaks} onChange={e => setOnlyBreaks(e.target.checked)} />
          Only accounts with breaks
        </label>
      </form>
      <LoadState state={dates.state} what="statement dates" />
      <LoadState state={result.state} what="the check" />
      {date && result.state.status === 'ready' && (
        <>
          <dl className="cu-stats">
            <div className="cu-stat"><dt>Accounts with a statement</dt><dd>{count(all.length)}</dd></div>
            <div className={`cu-stat${totalBreaks ? ' cu-stat--bad' : ''}`}><dt>Accounts with breaks</dt><dd>{count(all.filter(a => a.breaks > 0).length)}</dd></div>
            <div className="cu-stat"><dt>Total breaks</dt><dd>{count(totalBreaks)}</dd></div>
            <div className="cu-stat"><dt>New breaks</dt><dd>{count(all.reduce((s, a) => s + a.newBreaks, 0))}</dd></div>
          </dl>
          <CheckAllTable caption={`Position check for all accounts at ${custodyDate(date)}`} accounts={shown} date={date} />
        </>
      )}
    </Panel>
  );
}
