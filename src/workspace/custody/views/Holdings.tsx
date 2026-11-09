import { useId } from 'react';
import type { ReactNode } from 'react';
import { Panel } from '../../ui';
import { custodyApi } from '../api';
import type { CustodyAccount, HoldingLine } from '../api';
import { custodyAmount, custodyDate, custodyPrice, custodyQty, gbp } from '../model';
import { AccountSelect, CustodyLink, DateSelect, LoadState, useCustody, useLoad } from '../shared';

/** Resolves the account for an account view: the deep-linked one, otherwise the first on file. */
export function useSelectedAccount() {
  const { route, accounts } = useCustody();
  const list = accounts.status === 'ready' ? accounts.data : [];
  const acctId = route.acct ?? list[0]?.acctId ?? null;
  const account = list.find(a => a.acctId === acctId) ?? null;
  return { accounts, list, acctId, account, missing: accounts.status === 'ready' && route.acct !== null && !account };
}

export function AccountMeta({ account, children }: { account: CustodyAccount; children?: ReactNode }) {
  return (
    <dl className="cu-meta">
      <div><dt>Account</dt><dd className="ws-mono">{account.acctNo}</dd></div>
      <div><dt>Client</dt><dd>{account.clientName}</dd></div>
      <div><dt>Safekeeping account</dt><dd className="ws-mono">{account.safeCode}</dd></div>
      {children}
    </dl>
  );
}

export function HoldingsTable({ caption, lines, totalGbp }: { caption: string; lines: HoldingLine[]; totalGbp: number }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="cu-caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">ISIN</th>
            <th scope="col">Instrument</th>
            <th scope="col" className="ws-num">Quantity</th>
            <th scope="col" className="ws-num">Price</th>
            <th scope="col">Currency</th>
            <th scope="col" className="ws-num">Market value</th>
            <th scope="col" className="ws-num">Market value (GBP)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.isin}>
              <th scope="row" className="ws-mono">{l.isin}</th>
              <td>{l.instrument}</td>
              <td className="ws-num">{custodyQty(l.qty)}{l.qtyType && l.qtyType !== 'UNIT' && <span className="ws-muted"> {l.qtyType}</span>}</td>
              <td className="ws-num">{custodyPrice(l.price)}</td>
              <td>{l.ccy}</td>
              <td className="ws-num">{custodyAmount(l.mktVal)}</td>
              <td className="ws-num">{custodyAmount(l.mktValGbp)}</td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan={7} className="ws-empty">No holdings on this statement.</td></tr>}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={6}>Total market value (GBP)</th>
            <td className="ws-num">{gbp(totalGbp)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function HoldingsView() {
  const { route, nav } = useCustody();
  const { accounts, list, acctId, account, missing } = useSelectedAccount();
  const ids = { acct: useId(), date: useId() };
  const dates = useLoad(account ? `dates:${account.acctId}` : null, () => custodyApi.statementDates(account!.acctId));
  const dateList = dates.state.status === 'ready' ? dates.state.data : [];
  const date = route.date && dateList.includes(route.date) ? route.date : dateList[0] ?? null;
  const stmt = useLoad(account && date ? `holdings:${account.acctId}:${date}` : null, () => custodyApi.holdings(account!.acctId, date!));

  return (
    <Panel
      title="Holdings"
      titleId="cu-holdings-title"
      actions={account && date && (
        <span className="cu-links">
          <CustodyLink view="check" extra={{ acct: account.acctId, date }}>Position check</CustodyLink>
          <CustodyLink view="settlements" extra={{ acct: account.acctId }}>Settlements</CustodyLink>
        </span>
      )}
    >
      <LoadState state={accounts} what="custody accounts" />
      {accounts.status === 'ready' && (
        <>
          <form className="ws-filters" aria-label="Choose statement" onSubmit={e => e.preventDefault()}>
            <AccountSelect id={ids.acct} accounts={list} value={account ? acctId : null} onChange={a => nav('holdings', { acct: a })} />
            <DateSelect id={ids.date} label="Statement date" dates={dateList} value={date} onChange={d => nav('holdings', { acct: acctId, date: d })} disabled={dates.state.status !== 'ready'} />
          </form>
          {missing && <div className="ws-pad"><div role="alert" className="ws-notice ws-notice--error">Account {route.acct} is not on file. Choose an account from the list.</div></div>}
          {account && (
            <AccountMeta account={account}>
              {stmt.state.status === 'ready' && (
                <>
                  <div><dt>Statement function</dt><dd>{stmt.state.data.statement.function ?? '—'}</dd></div>
                  <div><dt>Source file</dt><dd className="ws-mono">{stmt.state.data.statement.fileName}</dd></div>
                </>
              )}
            </AccountMeta>
          )}
          <LoadState state={dates.state} what="statement dates" />
          {dates.state.status === 'ready' && dateList.length === 0 && <p className="ws-pad ws-muted">No statements on file for this account.</p>}
          <LoadState state={stmt.state} what="the statement" />
          {account && stmt.state.status === 'ready' && (
            <HoldingsTable
              caption={`Holdings for ${account.acctNo} at ${custodyDate(stmt.state.data.statement.statementDate)}`}
              lines={stmt.state.data.lines}
              totalGbp={stmt.state.data.totalGbp}
            />
          )}
        </>
      )}
    </Panel>
  );
}
