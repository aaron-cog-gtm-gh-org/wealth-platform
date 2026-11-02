import { useId, useState } from 'react';
import type { Position } from '../api';
import { useWorkspace } from '../context';
import { money, qty } from '../format';
import { availableCash, portfolioInstrumentOptions, reservedCash, sortCurrencies, totalsByCurrency } from '../model';
import { EmptyRow, Panel, SortHeader, useSort } from '../ui';

const ALL = 'All';

export function PortfolioArea() {
  const { data, lk, params } = useWorkspace();
  const [clientId, setClientId] = useState(() => (lk.clients.has(params.get('client') ?? '') ? params.get('client')! : ALL));
  const [accountId, setAccountId] = useState(ALL);
  const [symbol, setSymbol] = useState(ALL);
  const [query, setQuery] = useState('');
  const ids = { client: useId(), account: useId(), symbol: useId(), search: useId() };

  const accountChoices = data.accounts.filter(a => clientId === ALL || a.clientId === clientId);
  const scopedAccounts = accountChoices.filter(a => accountId === ALL || a.id === accountId);
  const scopedIds = new Set(scopedAccounts.map(a => a.id));
  const symbols = portfolioInstrumentOptions(data);

  const q = query.trim().toLowerCase();
  const positions = data.positions.filter(p => scopedIds.has(p.accountId)
    && (symbol === ALL || p.symbol === symbol)
    && (!q || p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)));

  const ccy = (p: Position) => lk.accounts.get(p.accountId)?.currency ?? '';
  const sort = useSort(positions, 'value', {
    symbol: p => p.symbol,
    name: p => p.name,
    account: p => lk.accountLabel(p.accountId),
    quantity: p => p.quantity,
    price: p => p.price,
    value: p => p.quantity * p.price,
  }, 'descending');

  const securities = totalsByCurrency(positions, ccy, p => p.quantity * p.price);
  const cashApplies = symbol === ALL && !q;
  const cash = totalsByCurrency(cashApplies ? scopedAccounts : [], a => a.currency, a => a.cash);
  const currencies = sortCurrencies(securities.keys());

  const onClient = (v: string) => { setClientId(v); setAccountId(ALL); setSymbol(ALL); };
  const onAccount = (v: string) => { setAccountId(v); setSymbol(ALL); };
  const reset = () => { setClientId(ALL); setAccountId(ALL); setSymbol(ALL); setQuery(''); };
  const filtered = clientId !== ALL || accountId !== ALL || symbol !== ALL || !!q;

  return (
    <div className="ws-stack">
      <Panel title="Filters" titleId="ws-portfolio-filters-title">
        <div className="ws-filters" role="search" aria-label="Filter portfolio">
          <div className="ws-field">
            <label htmlFor={ids.client}>Client</label>
            <select id={ids.client} value={clientId} onChange={e => onClient(e.target.value)}>
              <option value={ALL}>All clients</option>
              {data.clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor={ids.account}>Account</label>
            <select id={ids.account} value={accountId} onChange={e => onAccount(e.target.value)}>
              <option value={ALL}>All accounts</option>
              {accountChoices.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id}) · {a.currency}</option>)}
            </select>
          </div>
          <div className="ws-field">
            <label htmlFor={ids.symbol}>Instrument</label>
            <select id={ids.symbol} value={symbol} onChange={e => setSymbol(e.target.value)}>
              <option value={ALL}>All instruments</option>
              {symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="ws-field ws-field--grow">
            <label htmlFor={ids.search}>Search holdings</label>
            <input id={ids.search} type="search" value={query} placeholder="Symbol or name" onChange={e => setQuery(e.target.value)} />
          </div>
          <button type="button" className="ws-btn ws-btn--secondary ws-filters__reset" onClick={reset} disabled={!filtered}>Clear filters</button>
        </div>
      </Panel>

      <section className="ws-totals" aria-labelledby="ws-totals-title">
        <h2 id="ws-totals-title" className="ws-sr">Totals by currency</h2>
        {currencies.length === 0 && <p className="ws-panel ws-pad ws-muted">No holdings in scope, so there is no market value to total.</p>}
        {currencies.map(c => {
          const sec = securities.get(c) ?? 0, ca = cash.get(c) ?? 0;
          return (
            <dl key={c} className="ws-total" aria-label={`${c} totals`} data-currency={c}>
              <div className="ws-total__head"><dt>Market value ({c})</dt><dd className="ws-total__value">{money(sec, c)}</dd></div>
              <div><dt>Positions ({c})</dt><dd>{positions.filter(p => ccy(p) === c).length}</dd></div>
              <div><dt>Cash balance ({c})</dt><dd>{cashApplies ? money(ca, c) : 'Not shown while filtering by instrument'}</dd></div>
            </dl>
          );
        })}
        <p className="ws-totals__note">Market value is quantity × price, totalled per currency. CAD and USD are never added together and no FX conversion is applied. Cash is shown separately and is not part of market value.</p>
      </section>

      <Panel title="Holdings" titleId="ws-holdings-title" actions={<span className="ws-count" aria-live="polite">{positions.length} of {data.positions.length} positions</span>}>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="ws-sr">Holdings</caption>
            <thead>
              <tr>
                <SortHeader label="Symbol" k="symbol" sort={sort} />
                <SortHeader label="Instrument" k="name" sort={sort} />
                <SortHeader label="Account" k="account" sort={sort} />
                <th scope="col">Currency</th>
                <SortHeader label="Quantity" k="quantity" sort={sort} align="right" />
                <SortHeader label="Price" k="price" sort={sort} align="right" />
                <SortHeader label="Market value" k="value" sort={sort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sort.sorted.map(p => {
                const c = ccy(p);
                return (
                  <tr key={p.id}>
                    <th scope="row" className="ws-mono">{p.symbol}</th>
                    <td>{p.name}</td>
                    <td>{lk.accountLabel(p.accountId)}</td>
                    <td>{c}</td>
                    <td className="ws-num">{qty(p.quantity)}</td>
                    <td className="ws-num">{money(p.price, c)}</td>
                    <td className="ws-num ws-strong">{money(p.quantity * p.price, c)}</td>
                  </tr>
                );
              })}
              {sort.sorted.length === 0 && <EmptyRow colSpan={7}>No holdings match these filters.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Cash by account" titleId="ws-cash-title">
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="ws-sr">Cash by account</caption>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Client</th>
                <th scope="col">Currency</th>
                <th scope="col" className="ws-num">Cash balance</th>
                <th scope="col" className="ws-num">Reserved for open buys</th>
                <th scope="col" className="ws-num">Available cash</th>
              </tr>
            </thead>
            <tbody>
              {scopedAccounts.map(a => (
                <tr key={a.id}>
                  <th scope="row">{a.name} <span className="ws-mono ws-muted">{a.id}</span></th>
                  <td>{lk.clients.get(a.clientId)?.name ?? a.clientId}</td>
                  <td>{a.currency}</td>
                  <td className="ws-num">{money(a.cash, a.currency)}</td>
                  <td className="ws-num">{money(reservedCash(data, a.id), a.currency)}</td>
                  <td className="ws-num ws-strong">{money(availableCash(data, a), a.currency)}</td>
                </tr>
              ))}
              {scopedAccounts.length === 0 && <EmptyRow colSpan={6}>No accounts for this client.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
