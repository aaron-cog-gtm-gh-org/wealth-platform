import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Panel } from '../../ui';
import { custodyApi } from '../api';
import type { Settlement } from '../api';
import { count, custodyAmount, custodyDate, custodyQty, rangeError } from '../model';
import { AccountSelect, CustodyLink, LoadState, useCustody, useLoad } from '../shared';
import { AccountMeta, useSelectedAccount } from './Holdings';

export const NO_SETTLEMENTS = 'No settlements in period.';

export function SettlementsTable({ caption, rows }: { caption: string; rows: Settlement[] }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="cu-caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Trade date</th>
            <th scope="col">Settlement date</th>
            <th scope="col">Message</th>
            <th scope="col">Direction</th>
            <th scope="col">ISIN</th>
            <th scope="col">Instrument</th>
            <th scope="col" className="ws-num">Quantity</th>
            <th scope="col" className="ws-num">Amount</th>
            <th scope="col">Currency</th>
            <th scope="col">Sender’s reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.fileName}>
              <td>{custodyDate(s.tradeDate)}</td>
              <th scope="row">{custodyDate(s.settleDate)}</th>
              <td className="ws-mono">MT{s.mtType}</td>
              <td><span className={`ws-side ${s.direction === 'REC' ? 'ws-side--buy' : 'ws-side--sell'}`} title={s.direction === 'REC' ? 'Receipt' : 'Delivery'}>{s.direction}</span></td>
              <td className="ws-mono">{s.isin}</td>
              <td>{s.instrument}</td>
              <td className="ws-num">{custodyQty(s.qty)}</td>
              <td className="ws-num">{custodyAmount(s.amount)}</td>
              <td>{s.ccy}</td>
              <td className="ws-mono">{s.seme}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={10} className="ws-empty">{NO_SETTLEMENTS}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function SettlementsView() {
  const { route, nav } = useCustody();
  const { accounts, list, acctId, account, missing } = useSelectedAccount();
  const ids = { acct: useId(), from: useId(), to: useId(), err: useId() };
  const key = account ? `settlements:${account.acctId}:${route.from ?? ''}:${route.to ?? ''}` : null;
  const data = useLoad(key, () => custodyApi.settlements(account!.acctId, route.from ?? undefined, route.to ?? undefined));
  const [from, setFrom] = useState(route.from ?? '');
  const [to, setTo] = useState(route.to ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  // Show the period the server applied (the default window when none was chosen).
  useEffect(() => {
    if (data.state.status === 'ready') { setFrom(data.state.data.from); setTo(data.state.data.to); }
  }, [data.state]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = rangeError(from, to);
    setFormError(err);
    if (!err) nav('settlements', { acct: acctId, from, to });
  };

  return (
    <Panel
      title="Settlements"
      titleId="cu-settlements-title"
      actions={account && <CustodyLink view="holdings" extra={{ acct: account.acctId }}>Holdings</CustodyLink>}
    >
      <LoadState state={accounts} what="custody accounts" />
      {accounts.status === 'ready' && (
        <>
          <form className="ws-filters" aria-label="Settlement period" onSubmit={submit} noValidate>
            <AccountSelect id={ids.acct} accounts={list} value={account ? acctId : null} onChange={a => nav('settlements', { acct: a })} />
            <div className="ws-field">
              <label htmlFor={ids.from}>From</label>
              <input id={ids.from} type="date" value={from} onChange={e => { setFrom(e.target.value); setFormError(null); }} aria-invalid={!!formError} aria-describedby={formError ? ids.err : undefined} />
            </div>
            <div className="ws-field">
              <label htmlFor={ids.to}>To</label>
              <input id={ids.to} type="date" value={to} onChange={e => { setTo(e.target.value); setFormError(null); }} aria-invalid={!!formError} aria-describedby={formError ? ids.err : undefined} />
            </div>
            <button type="submit" className="ws-btn ws-btn--primary" disabled={!account}>Show settlements</button>
          </form>
          {formError && <div className="ws-pad"><div id={ids.err} role="alert" className="ws-notice ws-notice--error">{formError}</div></div>}
          {missing && <div className="ws-pad"><div role="alert" className="ws-notice ws-notice--error">Account {route.acct} is not on file. Choose an account from the list.</div></div>}
          {account && <AccountMeta account={account} />}
          <LoadState state={data.state} what="settlements" />
          {account && data.state.status === 'ready' && (
            <>
              <p className="ws-pad-x ws-count" aria-live="polite">{count(data.state.data.settlements.length)} confirmations, newest first</p>
              <SettlementsTable
                caption={`Settlement confirmations for ${account.acctNo}, ${custodyDate(data.state.data.from)} to ${custodyDate(data.state.data.to)}`}
                rows={data.state.data.settlements}
              />
            </>
          )}
        </>
      )}
    </Panel>
  );
}
