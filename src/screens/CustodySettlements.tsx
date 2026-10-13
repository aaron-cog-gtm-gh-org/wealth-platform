import { useEffect, useState } from 'react';
import { getConfirmations, getCustodyClient, selectedClient } from '../api/client';
import type { CustodyAccountSummary, CustodyConfirmation } from '../api/types';
import type { Model } from '../model';
import { dayMonthYear } from '../format';
import { defaultSettlementRange, toSettlementRows } from '../model/custody-settlements';

interface ConfirmationQuery {
  accountId: number;
  from: string;
  to: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function replaceSettlementUrl(clientId: number, accountId: number, from: string, to: string) {
  const params = new URLSearchParams(window.location.search);
  params.set('screen', 'custody-settlements');
  params.set('client', String(clientId));
  params.set('account', String(accountId));
  if (from) params.set('from', from);
  else params.delete('from');
  if (to) params.set('to', to);
  else params.delete('to');
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
}

const cardStyle = { background: '#fff', border: '1px solid #e1e5eb', borderRadius: '6px' };
const inputStyle = { border: '1px solid #cfd5dd', borderRadius: '5px', padding: '6px 8px', color: '#191919', background: '#fff' };

export function CustodySettlements({ m }: { m: Model }) {
  void m;
  const selection = selectedClient();
  const clientId = selection.kind === 'custody' ? selection.clientId : null;
  const [clientRetry, setClientRetry] = useState(0);
  const [clientLoading, setClientLoading] = useState(true);
  const [clientError, setClientError] = useState(false);
  const [accounts, setAccounts] = useState<CustodyAccountSummary[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [validation, setValidation] = useState('');
  const [applied, setApplied] = useState<ConfirmationQuery | null>(null);
  const [confirmations, setConfirmations] = useState<CustodyConfirmation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (clientId === null) return;
    let active = true;
    setClientLoading(true);
    setClientError(false);
    getCustodyClient(clientId).then((client) => {
      if (!active) return;
      const nextAccounts = client.accounts;
      const params = new URLSearchParams(window.location.search);
      const requested = Number(params.get('account'));
      const account = nextAccounts.find((item) => item.accountId === requested)
        ?? nextAccounts.find((item) => item.latestStatementDate !== null)
        ?? nextAccounts[0];
      setAccounts(nextAccounts);
      if (account) {
        const defaults = defaultSettlementRange(account.latestStatementDate, todayIso());
        const nextFrom = params.get('from') || defaults.from;
        const nextTo = params.get('to') || defaults.to;
        setAccountId(account.accountId);
        setFrom(nextFrom);
        setTo(nextTo);
        setApplied({ accountId: account.accountId, from: nextFrom, to: nextTo });
      }
      setClientLoading(false);
    }).catch((error: unknown) => {
      console.error(error);
      if (active) {
        setClientError(true);
        setClientLoading(false);
      }
    });
    return () => { active = false; };
  }, [clientId, clientRetry]);

  useEffect(() => {
    if (!applied) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    getConfirmations(applied.accountId, applied.from, applied.to).then((rows) => {
      if (active) setConfirmations(rows);
    }).catch((error: unknown) => {
      console.error(error);
      if (active) setLoadError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [applied]);

  if (clientId === null) {
    return (
      <div style={{ ...cardStyle, padding: '22px 24px' }}>
        <div style={{ font: '600 15px Inter,sans-serif', marginBottom: '6px' }}>Pick a custodian client</div>
        <div style={{ color: 'rgba(25,25,25,.7)' }}>
          Settlement confirmations come from the legacy custodian feed. Choose a migrated client in the client picker (or open ?client=&lt;id&gt;).
        </div>
      </div>
    );
  }

  if (clientLoading) {
    return <div style={{ ...cardStyle, padding: '16px', color: 'rgba(25,25,25,.56)' }}>Loading custody accounts…</div>;
  }

  if (clientError) {
    return (
      <div style={{ ...cardStyle, padding: '16px 18px', borderColor: '#f3c2c1' }}>
        <div style={{ font: '600 14px Inter,sans-serif', marginBottom: '8px' }}>Custody accounts didn’t load</div>
        <button type="button" onClick={() => setClientRetry((value) => value + 1)} style={{ ...inputStyle, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return <div style={{ ...cardStyle, padding: '22px 24px' }}>No custody accounts are linked to this client.</div>;
  }

  const account = accounts.find((item) => item.accountId === accountId) ?? null;
  const rows = toSettlementRows(confirmations);

  const showRange = () => {
    if (from && to && from > to) {
      setValidation('From must be on or before To');
      return;
    }
    if (accountId === null) return;
    setValidation('');
    replaceSettlementUrl(clientId, accountId, from, to);
    setApplied({ accountId, from, to });
  };

  const changeAccount = (nextId: number) => {
    const next = accounts.find((item) => item.accountId === nextId);
    if (!next) return;
    const range = defaultSettlementRange(next.latestStatementDate, todayIso());
    setAccountId(next.accountId);
    setFrom(range.from);
    setTo(range.to);
    setValidation('');
    replaceSettlementUrl(clientId, next.accountId, range.from, range.to);
    setApplied({ accountId: next.accountId, ...range });
  };

  const retryConfirmations = () => {
    if (applied) setApplied({ ...applied });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ ...cardStyle, padding: '10px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '10px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
          Account
          <select value={accountId ?? ''} onChange={(event) => changeAccount(Number(event.target.value))} style={{ ...inputStyle, minWidth: '280px', fontSize: '12px' }}>
            {accounts.map((item) => (
              <option key={item.accountId} value={item.accountId}>
                Account {item.accountId} · {item.accountType} · safe {item.safeNo}{item.closed ? ' · closed' : ''}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} style={inputStyle} />
        </label>
        <button type="button" onClick={showRange} style={{ border: '0', borderRadius: '5px', padding: '7px 14px', background: '#005daa', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Show
        </button>
        {validation && <span role="alert" style={{ color: '#b42318', fontSize: '12px' }}>{validation}</span>}
        <div style={{ width: '100%', fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>
          Default: 90 days ending at the latest statement ({dayMonthYear(account?.latestStatementDate ?? todayIso())})
        </div>
      </div>

      {account && !loading && !loadError && (
        <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap' }}>
          {[
            ['Confirmations', confirmations.length],
            ['Receipts', confirmations.filter((row) => row.direction === 'Receive').length],
            ['Deliveries', confirmations.filter((row) => row.direction === 'Deliver').length],
            ['Free of payment', confirmations.filter((row) => row.freeOfPayment).length],
          ].map(([label, count]) => (
            <div key={label} style={{ padding: '9px 14px', borderRight: '1px solid #eef0f3', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span style={{ fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>{label}</span>
              <strong style={{ font: '600 16px/20px Inter,sans-serif' }}>{count}</strong>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ ...cardStyle, padding: '16px', color: 'rgba(25,25,25,.56)' }}>Loading settlement confirmations…</div>}
      {loadError && (
        <div style={{ ...cardStyle, padding: '16px 18px', borderColor: '#f3c2c1' }}>
          <div style={{ font: '600 14px Inter,sans-serif', marginBottom: '8px' }}>Settlement confirmations didn’t load</div>
          <button type="button" onClick={retryConfirmations} style={{ ...inputStyle, cursor: 'pointer' }}>Retry</button>
        </div>
      )}
      {account && !loading && !loadError && confirmations.length === 0 && (
        <div style={{ ...cardStyle, padding: '30px 22px', textAlign: 'center', color: 'rgba(25,25,25,.7)' }}>
          No settlement confirmations settled between {from && dayMonthYear(from)} and {to && dayMonthYear(to)}.
        </div>
      )}
      {account && !loading && !loadError && rows.length > 0 && (
        <div style={{ ...cardStyle, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '1120px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 100px 64px 128px 116px minmax(180px,1fr) 130px 112px 54px 160px', gap: '8px', padding: '7px 12px', background: '#f8f9fb', color: 'rgba(25,25,25,.56)', fontSize: '11px' }}>
                <span>Trade date</span><span>Settle date</span><span>Msg</span><span>Direction</span><span>ISIN</span><span>Instrument</span><span style={{ textAlign: 'right' }}>Quantity</span><span style={{ textAlign: 'right' }}>Amount</span><span>Ccy</span><span>Reference</span>
              </div>
              {rows.map((row) => (
                <div key={row.messageId} style={{ display: 'grid', gridTemplateColumns: '100px 100px 64px 128px 116px minmax(180px,1fr) 130px 112px 54px 160px', gap: '8px', padding: '6px 12px', borderTop: '1px solid #f3f4f6', alignItems: 'center', fontSize: '12px' }} className="hov-row">
                  <span>{row.tradeDate}</span>
                  <span>{row.settleDate}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px' }}>{row.msg}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: '10px', background: row.direction === 'Receive' ? '#e8f5ee' : '#fbe9e9', color: row.direction === 'Receive' ? '#23734d' : '#a13a3a', fontSize: '11px' }}>{row.direction}</span>
                    {row.fopLabel && <span style={{ padding: '2px 5px', borderRadius: '9px', background: '#f1f3f6', color: 'rgba(25,25,25,.62)', fontSize: '10px' }}>{row.fopLabel}</span>}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px' }}>{row.isin}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{row.qtyFmt} <small style={{ color: 'rgba(25,25,25,.56)' }}>{row.qtyType}</small></span>
                  <span style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono',monospace" }}>{row.amountFmt}</span>
                  <span>{row.ccy}</span>
                  <span title={`Message ${row.messageId}`} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.reference}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {account && !loading && !loadError && (
        <div style={{ color: 'rgba(25,25,25,.56)', fontSize: '11px' }}>
          Cancelled confirmations and their cancellations are excluded, including cancellations filed on a later day.
        </div>
      )}
    </div>
  );
}
