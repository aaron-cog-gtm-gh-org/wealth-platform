import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Panel } from '../../ui';
import { custodyApi } from '../api';
import type { CustodyClient, CustodyClientAccount } from '../api';
import { accountStatusLabel, clientStatusLabel, count, custodyDate, displayAcctType } from '../model';
import { CustodyLink, LoadState, useCustody, useLoad } from '../shared';

const STATUS_TONE: Record<string, string> = { A: 'ok', D: 'warn', C: 'mute', O: 'ok' };
const Pill = ({ code, label }: { code: string; label: string }) => <span className={`ws-pill ws-pill--${STATUS_TONE[code.trim()] ?? 'mute'}`}>{label}</span>;

export function ClientResultsTable({ clients, query }: { clients: CustodyClient[]; query: string }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="cu-caption">{query ? `Custody clients matching “${query}”` : 'All custody clients'}</caption>
        <thead>
          <tr>
            <th scope="col">Client ref</th>
            <th scope="col">Client name</th>
            <th scope="col">Adviser</th>
            <th scope="col">Status</th>
            <th scope="col" className="ws-num">Accounts</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.clientId}>
              <td className="ws-mono">{c.clientRef}</td>
              <th scope="row"><CustodyLink view="client" extra={{ client: c.clientId }} className="ws-linkbtn">{c.name}</CustodyLink></th>
              <td>{c.adviserName ?? <span className="ws-muted">Unassigned</span>}</td>
              <td><Pill code={c.status} label={clientStatusLabel(c.status)} /></td>
              <td className="ws-num">{c.accountCount}</td>
            </tr>
          ))}
          {clients.length === 0 && <tr><td colSpan={5} className="ws-empty">No custody clients match this search. Search by part of the name or the start of the client reference.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function ClientSearchView() {
  const { route, nav } = useCustody();
  const [q, setQ] = useState(route.q);
  const inputId = useId();
  const hintId = useId();
  const results = useLoad(`clients:${route.q}`, () => custodyApi.clients(route.q));

  useEffect(() => { setQ(route.q); }, [route.q]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav('clients', { q: q.trim() });
  };

  return (
    <Panel
      title="Client search"
      titleId="cu-clients-title"
      actions={results.state.status === 'ready' && <span className="ws-count" aria-live="polite">{count(results.state.data.length)} clients</span>}
    >
      <form className="ws-filters" role="search" aria-label="Search custody clients" onSubmit={submit}>
        <div className="ws-field ws-field--grow">
          <label htmlFor={inputId}>Client name or reference</label>
          <input id={inputId} type="search" value={q} maxLength={100} onChange={e => setQ(e.target.value)} aria-describedby={hintId} />
          <span id={hintId} className="ws-hint">Name contains, or reference starts with, the text entered.</span>
        </div>
        <button type="submit" className="ws-btn ws-btn--primary">Search</button>
      </form>
      <LoadState state={results.state} what="custody clients" />
      {results.state.status === 'ready' && <ClientResultsTable clients={results.state.data} query={route.q} />}
    </Panel>
  );
}

export function ClientAccountsTable({ clientName, accounts }: { clientName: string; accounts: CustodyClientAccount[] }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="cu-caption">Custody accounts for {clientName}</caption>
        <thead>
          <tr>
            <th scope="col">Account</th>
            <th scope="col">Type</th>
            <th scope="col">Currency</th>
            <th scope="col">Safekeeping account</th>
            <th scope="col">Opened</th>
            <th scope="col">Closed</th>
            <th scope="col">Status</th>
            <th scope="col">Open</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.acctId}>
              <th scope="row" className="ws-mono">{a.acctNo}</th>
              <td>{displayAcctType(a.acctType)}</td>
              <td>{a.baseCcy}</td>
              <td className="ws-mono">{a.safeCode}</td>
              <td>{custodyDate(a.openDate)}</td>
              <td>{custodyDate(a.closeDate)}</td>
              <td><Pill code={a.status} label={accountStatusLabel(a.status)} /></td>
              <td>
                <span className="cu-links">
                  <CustodyLink view="holdings" extra={{ acct: a.acctId }} aria-label={`Holdings for ${a.acctNo}`}>Holdings</CustodyLink>
                  <CustodyLink view="settlements" extra={{ acct: a.acctId }} aria-label={`Settlements for ${a.acctNo}`}>Settlements</CustodyLink>
                  <CustodyLink view="check" extra={{ acct: a.acctId }} aria-label={`Position check for ${a.acctNo}`}>Position check</CustodyLink>
                </span>
              </td>
            </tr>
          ))}
          {accounts.length === 0 && <tr><td colSpan={8} className="ws-empty">This client has no custody accounts.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function ClientSummaryView() {
  const { route } = useCustody();
  const data = useLoad(route.client === null ? null : `client:${route.client}`, () => custodyApi.client(route.client!));

  return (
    <Panel title={data.state.status === 'ready' ? data.state.data.client.name : 'Client summary'} titleId="cu-client-title" actions={<CustodyLink view="clients">Back to client search</CustodyLink>}>
      {route.client === null && <p className="ws-pad ws-muted">Choose a client from client search to see its accounts.</p>}
      <LoadState state={data.state} what="the client" />
      {data.state.status === 'ready' && (
        <>
          <dl className="cu-meta">
            <div><dt>Client ref</dt><dd className="ws-mono">{data.state.data.client.clientRef}</dd></div>
            <div><dt>Client name</dt><dd>{data.state.data.client.name}</dd></div>
            <div><dt>Adviser</dt><dd>{data.state.data.client.adviserName ?? 'Unassigned'}</dd></div>
            <div><dt>Status</dt><dd>{clientStatusLabel(data.state.data.client.status)}</dd></div>
            <div><dt>Accounts</dt><dd>{data.state.data.accounts.length}</dd></div>
          </dl>
          <ClientAccountsTable clientName={data.state.data.client.name} accounts={data.state.data.accounts} />
        </>
      )}
    </Panel>
  );
}
