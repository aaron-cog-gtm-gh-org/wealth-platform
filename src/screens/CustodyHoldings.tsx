import { useEffect, useState } from 'react';
import { getCustodyClient, getStatement, getStatementDates, selectedClient } from '../api/client';
import type { CustodyClientSummary, CustodyStatement, CustodyStatementDate } from '../api/types';
import { decMoney, decQuantity, dayMonthYear } from '../format';

const card = { background: '#fff', border: '1px solid #e1e5eb', borderRadius: '6px' };
const muted = 'rgba(25,25,25,.56)';

function replaceStatementParams(accountId?: number, date?: string) {
  const q = new URLSearchParams(window.location.search);
  q.set('screen', 'custody-holdings');
  if (accountId === undefined) q.delete('account');
  else q.set('account', String(accountId));
  if (!date) q.delete('date');
  else q.set('date', date);
  window.history.replaceState(null, '', '?' + q.toString());
}

export function CustodyHoldings() {
  const selection = selectedClient();
  const clientId = selection.kind === 'custody' ? selection.clientId : null;
  const [client, setClient] = useState<CustodyClientSummary | null>(null);
  const [clientLoading, setClientLoading] = useState(clientId !== null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [dates, setDates] = useState<CustodyStatementDate[]>([]);
  const [date, setDate] = useState('');
  const [statement, setStatement] = useState<CustodyStatement | null>(null);
  const [statementMissing, setStatementMissing] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (clientId === null) {
      setClient(null);
      setClientLoading(false);
      setAccountId(null);
      return;
    }
    let active = true;
    setClientLoading(true);
    setError(false);
    getCustodyClient(clientId).then(value => {
      if (!active) return;
      setClient(value);
      const params = new URLSearchParams(window.location.search);
      const requested = Number(params.get('account'));
      const selected = value.accounts.find(a => a.accountId === requested) ?? value.accounts[0];
      if (selected) {
        setAccountId(selected.accountId);
        replaceStatementParams(selected.accountId, params.get('date') ?? undefined);
      } else {
        setAccountId(null);
        replaceStatementParams();
      }
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setClientLoading(false);
    });
    return () => { active = false; };
  }, [clientId]);

  useEffect(() => {
    if (accountId === null) {
      setDates([]);
      setDate('');
      setStatement(null);
      setStatementMissing(false);
      return;
    }
    let active = true;
    setLoadingDates(true);
    setError(false);
    getStatementDates(accountId).then(values => {
      if (!active) return;
      setDates(values);
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('date');
      const selected = requested === null ? values[0] : values.find(d => d.date === requested);
      const nextDate = selected?.date ?? requested ?? '';
      setDate(nextDate);
      replaceStatementParams(accountId, nextDate || undefined);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoadingDates(false);
    });
    return () => { active = false; };
  }, [accountId]);

  useEffect(() => {
    if (accountId === null || !date) {
      setStatement(null);
      setStatementMissing(false);
      return;
    }
    let active = true;
    setLoadingStatement(true);
    setStatementMissing(false);
    setError(false);
    getStatement(accountId, date).then(value => {
      if (active) setStatement(value);
    }).catch(err => {
      if (!active) return;
      if (err instanceof Error && err.message.includes('404')) setStatementMissing(true);
      else setError(true);
      setStatement(null);
    }).finally(() => {
      if (active) setLoadingStatement(false);
    });
    return () => { active = false; };
  }, [accountId, date]);

  if (selection.kind === 'household') {
    return (
      <div style={{ ...card, padding: '24px', color: '#4b5563' }}>
        Custodian statements are available for migrated custody clients — pick one from client search.
      </div>
    );
  }
  if (clientLoading) return <div style={{ ...card, padding: '18px', color: muted }}>Loading custodian statements…</div>;
  if (error) return <div style={{ ...card, padding: '18px', borderColor: '#f3c2c1', color: '#b3201f' }}>Could not load custodian statements. Retry by reopening this screen.</div>;
  if (!client) return <div style={{ ...card, padding: '18px', color: muted }}>No custody client found.</div>;

  const account = client.accounts.find(a => a.accountId === accountId);
  const selectedDate = dates.find(d => d.date === date);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <section style={card}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #eef0f3', fontWeight: 600 }}>Custodian statements</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '180px' }}>
            <span style={{ color: muted, fontSize: '11px' }}>Account</span>
            <select
              aria-label="Account"
              value={accountId ?? ''}
              onChange={event => {
                const next = Number(event.target.value);
                setAccountId(next);
                setDate('');
                setStatement(null);
                replaceStatementParams(next);
              }}
              style={{ border: '1px solid #cfd5dd', borderRadius: '4px', background: '#fff', padding: '6px 8px', color: '#191919' }}
            >
              {client.accounts.map(a => (
                <option key={a.accountId} value={a.accountId}>
                  {a.accountType} {a.safeNo}{a.closed ? ' · closed' : ''}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '220px' }}>
            <span style={{ color: muted, fontSize: '11px' }}>Statement date</span>
            <select
              aria-label="Statement date"
              value={date}
              disabled={loadingDates || dates.length === 0}
              onChange={event => {
                setDate(event.target.value);
                replaceStatementParams(accountId ?? undefined, event.target.value);
              }}
              style={{ border: '1px solid #cfd5dd', borderRadius: '4px', background: '#fff', padding: '6px 8px', color: '#191919' }}
            >
              {dates.length === 0 && <option value="">{loadingDates ? 'Loading…' : 'No statements on file'}</option>}
              {date && !selectedDate && (
                <option value={date}>{dayMonthYear(date)} · no statement</option>
              )}
              {dates.map(d => (
                <option key={d.date} value={d.date}>
                  {dayMonthYear(d.date)}{d.isEmpty ? ' · empty' : ''}{d.superseded > 0 ? ` · ${d.superseded} superseded` : ''}
                </option>
              ))}
            </select>
          </label>
          {account && <span style={{ color: muted, fontSize: '11px' }}>{account.reportingCcy} reporting currency</span>}
        </div>
        {statement && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 12px 10px', color: muted, fontSize: '11px' }}>
            <span>Function {statement.functionCode}</span>
            <span>·</span>
            <span>Message {statement.messageId}</span>
            {selectedDate && selectedDate.superseded > 0 && (
              <span>· Effective statement — latest RPLC, else latest NEWM (duplicates ignored)</span>
            )}
          </div>
        )}
      </section>

      {loadingStatement && <div style={{ ...card, padding: '18px', color: muted }}>Loading statement…</div>}
      {!loadingStatement && statementMissing && <div style={{ ...card, padding: '18px', color: '#4b5563' }}>
        No statement on file for {dayMonthYear(date)} — choose one of the {dates.length} statement dates.
      </div>}
      {!loadingStatement && !statementMissing && !statement && !loadingDates && dates.length === 0 && (
        <div style={{ ...card, padding: '18px', color: '#4b5563' }}>No statement on file for this date</div>
      )}
      {!loadingStatement && statement?.isEmpty && (
        <div style={{ ...card, padding: '22px', borderColor: '#d5dbe3', background: '#f8f9fb', color: '#4b5563' }}>
          No holdings on statement — the custodian reported this account as empty (ACTI//N) on {dayMonthYear(statement.date)}.
        </div>
      )}
      {!loadingStatement && statement && !statement.isEmpty && (
        <section style={card}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '860px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(220px,1fr) 110px 100px 54px 130px 120px', gap: '8px', padding: '7px 12px', background: '#f8f9fb', color: muted, fontSize: '11px' }}>
                <span>ISIN</span><span>Instrument</span><span style={{ textAlign: 'right' }}>Quantity</span><span style={{ textAlign: 'right' }}>Price</span>
                <span>Ccy</span><span style={{ textAlign: 'right' }}>Market value</span><span style={{ textAlign: 'right' }}>GBP value</span>
              </div>
              {statement.lines.map((line, index) => (
                <div key={`${line.isin}:${index}`} style={{ display: 'grid', gridTemplateColumns: '140px minmax(220px,1fr) 110px 100px 54px 130px 120px', gap: '8px', padding: '7px 12px', borderTop: '1px solid #f3f4f6', alignItems: 'center' }}>
                  <span style={{ font: "11px 'IBM Plex Mono',monospace" }}>{line.isin}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                    <span>{line.name}</span>
                    {!line.nameVerified && (
                      <span title="Name from custodian message; ISIN not in reference data" style={{ padding: '1px 6px', borderRadius: '9px', background: '#fdf0dd', color: '#94520a', fontSize: '10px', fontWeight: 600 }}>
                        Unverified instrument
                      </span>
                    )}
                  </span>
                  <span style={{ textAlign: 'right' }}>{decQuantity(line.qty)}{line.qtyType === 'FAMT' ? ' face' : ''}</span>
                  <span style={{ textAlign: 'right' }}>{decMoney(line.price, line.ccy, 4)}</span>
                  <span>{line.ccy}</span>
                  <span style={{ textAlign: 'right' }}>{decMoney(line.marketValue, line.ccy, 2)}</span>
                  <span style={{ textAlign: 'right' }}>{line.reportingValue === null ? '—' : decMoney(line.reportingValue, 'GBP', 2)}</span>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px', padding: '9px 12px', borderTop: '1px solid #dfe4ea', fontWeight: 600 }}>
                <span>Total (GBP)</span><span style={{ textAlign: 'right' }}>{decMoney(statement.total, 'GBP', 2)}</span>
              </div>
            </div>
          </div>
          {statement.missingReportingValues > 0 && (
            <div style={{ padding: '7px 12px', borderTop: '1px solid #f3c2c1', color: '#b3201f', fontSize: '11px' }}>
              {statement.missingReportingValues} lines have no GBP value and are excluded from the total
            </div>
          )}
        </section>
      )}
    </div>
  );
}
