import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, KYC_STATUSES, RISK_PROFILES } from '../api';
import type { Client, KycStatus, RiskProfile } from '../api';
import { useWorkspace } from '../context';
import { money } from '../format';
import { availableCash, withSearchParam } from '../model';
import { EmptyRow, Notices, Panel, SortHeader, StatusPill, useAction, useSort } from '../ui';

export function ClientsArea() {
  const { data, go, params } = useWorkspace();
  const [query, setQuery] = useState('');
  const [kyc, setKyc] = useState<'All' | KycStatus>('All');
  const [risk, setRisk] = useState<'All' | RiskProfile>('All');
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('client') ?? data.clients[0]?.id ?? null);
  const ids = { search: useId(), kyc: useId(), risk: useId() };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.clients.filter(c =>
      (!q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      && (kyc === 'All' || c.kycStatus === kyc)
      && (risk === 'All' || c.riskProfile === risk));
  }, [data.clients, query, kyc, risk]);

  const sort = useSort(rows, 'name', {
    name: (c: Client) => c.name,
    id: (c: Client) => c.id,
    riskProfile: (c: Client) => RISK_PROFILES.indexOf(c.riskProfile),
    kycStatus: (c: Client) => c.kycStatus,
  });

  const selected = data.clients.find(c => c.id === selectedId) ?? null;
  const openExceptions = (clientId: string) => data.exceptions.filter(e => e.status !== 'Resolved' && data.accounts.some(a => a.id === e.accountId && a.clientId === clientId)).length;
  const select = (id: string) => {
    setSelectedId(id);
    window.history.replaceState(window.history.state, '', withSearchParam(window.location.search, 'client', id));
  };

  return (
    <div className="ws-split">
      <Panel title="Client book" titleId="ws-clients-title">
        <div className="ws-filters" role="search" aria-label="Filter clients">
          <div className="ws-field ws-field--grow">
            <label htmlFor={ids.search}>Search clients</label>
            <input id={ids.search} type="search" value={query} placeholder="Name or client ID" onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="ws-field">
            <label htmlFor={ids.kyc}>Filter by KYC status</label>
            <select id={ids.kyc} value={kyc} onChange={e => setKyc(e.target.value as typeof kyc)}>
              <option value="All">All statuses</option>
              {KYC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor={ids.risk}>Filter by risk profile</label>
            <select id={ids.risk} value={risk} onChange={e => setRisk(e.target.value as typeof risk)}>
              <option value="All">All profiles</option>
              {RISK_PROFILES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <p className="ws-count" aria-live="polite">{rows.length} of {data.clients.length} clients</p>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="ws-sr">Clients</caption>
            <thead>
              <tr>
                <SortHeader label="Client" k="name" sort={sort} />
                <SortHeader label="Client ID" k="id" sort={sort} />
                <SortHeader label="Risk profile" k="riskProfile" sort={sort} />
                <SortHeader label="KYC status" k="kycStatus" sort={sort} />
                <th scope="col" className="ws-num">Accounts</th>
                <th scope="col" className="ws-num">Open exceptions</th>
              </tr>
            </thead>
            <tbody>
              {sort.sorted.map(c => (
                <tr key={c.id} className={c.id === selectedId ? 'is-selected' : undefined}>
                  <th scope="row">
                    <button type="button" className="ws-linkbtn" onClick={() => select(c.id)} aria-pressed={c.id === selectedId}>{c.name}</button>
                  </th>
                  <td className="ws-mono">{c.id}</td>
                  <td>{c.riskProfile}</td>
                  <td><StatusPill status={c.kycStatus} /></td>
                  <td className="ws-num">{data.accounts.filter(a => a.clientId === c.id).length}</td>
                  <td className="ws-num">{openExceptions(c.id)}</td>
                </tr>
              ))}
              {sort.sorted.length === 0 && <EmptyRow colSpan={6}>No clients match these filters. Clear the search or choose another status.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected ? (
        <ClientDetail key={selected.id} client={selected} onPortfolio={() => go('portfolio', { client: selected.id })} />
      ) : (
        <Panel title="Client details" titleId="ws-client-detail-title"><p className="ws-pad ws-muted">Select a client to see accounts and edit their profile.</p></Panel>
      )}
    </div>
  );
}

function ClientDetail({ client, onPortfolio }: { client: Client; onPortfolio: () => void }) {
  const { data, reload } = useWorkspace();
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(client.riskProfile);
  const [kycStatus, setKycStatus] = useState<KycStatus>(client.kycStatus);
  const [editing, setEditing] = useState(false);
  const action = useAction(reload);
  const ids = { risk: useId(), kyc: useId() };

  useEffect(() => { setRiskProfile(client.riskProfile); setKycStatus(client.kycStatus); }, [client.riskProfile, client.kycStatus]);

  const dirty = riskProfile !== client.riskProfile || kycStatus !== client.kycStatus;
  const accounts = data.accounts.filter(a => a.clientId === client.id);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) { action.fail('No changes to save. Change the risk profile or KYC status first.'); return; }
    const ok = await action.run(() => api.updateClient(client.id, { riskProfile, kycStatus }), () => `Profile saved for ${client.name}: risk profile ${riskProfile}, KYC status ${kycStatus}.`);
    if (ok) setEditing(false);
  };

  const cancel = () => { setRiskProfile(client.riskProfile); setKycStatus(client.kycStatus); setEditing(false); action.clear(); };

  return (
    <Panel title={client.name} titleId="ws-client-detail-title" actions={<button type="button" className="ws-btn ws-btn--secondary ws-btn--sm" onClick={onPortfolio}>View portfolio</button>}>
      <dl className="ws-dl ws-pad">
        <dt>Client ID</dt><dd className="ws-mono">{client.id}</dd>
        <dt>Risk profile</dt><dd>{client.riskProfile}</dd>
        <dt>KYC status</dt><dd><StatusPill status={client.kycStatus} /></dd>
      </dl>

      <h3 className="ws-h3">Accounts</h3>
      <div className="ws-table-wrap">
        <table className="ws-table ws-table--compact">
          <caption className="ws-sr">Accounts for {client.name}</caption>
          <thead>
            <tr><th scope="col">Account</th><th scope="col">Currency</th><th scope="col" className="ws-num">Cash</th><th scope="col" className="ws-num">Available</th></tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id}>
                <th scope="row">{a.name} <span className="ws-mono ws-muted">{a.id}</span></th>
                <td>{a.currency}</td>
                <td className="ws-num">{money(a.cash, a.currency)}</td>
                <td className="ws-num">{money(availableCash(data, a), a.currency)}</td>
              </tr>
            ))}
            {accounts.length === 0 && <EmptyRow colSpan={4}>No accounts open for this client.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {!editing ? (
        <div className="ws-form ws-pad">
          <Notices error={action.error} success={action.success} />
          <div className="ws-actions">
            <button type="button" className="ws-btn ws-btn--primary" onClick={() => { action.clear(); setEditing(true); }}>Edit profile</button>
          </div>
        </div>
      ) : (
      <form className="ws-form ws-pad" onSubmit={submit} aria-labelledby="ws-profile-form-title" noValidate>
        <h3 id="ws-profile-form-title" className="ws-h3 ws-h3--flush">Edit profile</h3>
        <div className="ws-grid2">
          <div className="ws-field">
            <label htmlFor={ids.risk}>Risk profile</label>
            <select id={ids.risk} value={riskProfile} onChange={e => { setRiskProfile(e.target.value as RiskProfile); action.clear(); }}>
              {RISK_PROFILES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor={ids.kyc}>KYC status</label>
            <select id={ids.kyc} value={kycStatus} onChange={e => { setKycStatus(e.target.value as KycStatus); action.clear(); }}>
              {KYC_STATUSES.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <Notices error={action.error} success={action.success} />
        <div className="ws-actions">
          <button type="button" className="ws-btn ws-btn--secondary" disabled={action.busy} onClick={cancel}>Cancel</button>
          <button type="submit" className="ws-btn ws-btn--primary" disabled={action.busy}>{action.busy ? 'Saving profile…' : 'Save profile'}</button>
        </div>
      </form>
      )}
    </Panel>
  );
}
