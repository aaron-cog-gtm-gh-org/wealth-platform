import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { Order, Side } from '../api';
import { useWorkspace } from '../context';
import { money, qty } from '../format';
import { availableCash, heldQuantity, indicativePrice, openSellQuantity } from '../model';
import { EmptyRow, Notices, Panel, SortHeader, StatusPill, useAction, useSort } from '../ui';

const SIDES: Side[] = ['Buy', 'Sell'];

function quantityError(raw: string) {
  const v = raw.trim();
  if (!v) return 'Enter a quantity. Quantity must be a positive whole number of shares.';
  if (/^-?\d*\.\d+$/.test(v) && Number(v) > 0) return 'Fractional shares aren’t allowed. Enter a positive whole number of shares.';
  return 'Quantity must be a positive whole number of shares.';
}

export function OrdersArea() {
  return (
    <div className="ws-split ws-split--ticket">
      <OrderTicket />
      <OrderBlotter />
    </div>
  );
}

function OrderTicket() {
  const { data, lk, reload } = useWorkspace();
  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<Side>('Buy');
  const [quantity, setQuantity] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const action = useAction(reload);
  const ids = { account: useId(), symbol: useId(), symbolHint: useId(), qty: useId(), qtyHint: useId() };

  const account = lk.accounts.get(accountId);
  const catalog = data.positions.filter(p => p.accountId === accountId).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const price = accountId && symbol ? indicativePrice(data, accountId, symbol) : null;
  const n = Number(quantity.trim());
  const validQty = /^\d+$/.test(quantity.trim()) && n > 0;
  const estimate = account && price !== null && validQty ? n * price : null;
  const held = account && symbol ? heldQuantity(data, account.id, symbol) : 0;
  const sellable = account && symbol ? held - openSellQuantity(data, account.id, symbol) : 0;

  const touch = () => { setFieldError(null); action.clear(); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accountId) return setFieldError('Choose an account.');
    if (!symbol) return setFieldError('Choose an instrument.');
    if (!validQty) return setFieldError(quantityError(quantity));
    setFieldError(null);
    const ok = await action.run(
      () => api.placeOrder({ accountId, symbol, side, quantity: n }),
      o => `${side} order${o?.id ? ' ' + o.id : ''} for ${qty(n)} ${symbol} placed in ${lk.accountLabel(accountId)}. Status: ${o?.status ?? 'Open'}.`,
    );
    if (ok) setQuantity('');
  };

  return (
    <Panel title="New order" titleId="ws-ticket-title">
      <form className="ws-form ws-pad" onSubmit={submit} noValidate aria-labelledby="ws-ticket-title">
        <div className="ws-field">
          <label htmlFor={ids.account}>Account</label>
          <select id={ids.account} value={accountId} onChange={e => { setAccountId(e.target.value); setSymbol(''); touch(); }} aria-invalid={fieldError === 'Choose an account.'}>
            <option value="">Select an account</option>
            {data.clients.map(c => (
              <optgroup key={c.id} label={c.name}>
                {data.accounts.filter(a => a.clientId === c.id).map(a => <option key={a.id} value={a.id}>{a.name} ({a.id}) · {a.currency}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="ws-field">
          <label htmlFor={ids.symbol}>Instrument</label>
          <select id={ids.symbol} value={symbol} onChange={e => { setSymbol(e.target.value); touch(); }} aria-invalid={fieldError === 'Choose an instrument.'} disabled={!account} aria-describedby={ids.symbolHint}>
            <option value="">{account ? 'Select an instrument' : 'Choose an account first'}</option>
            {catalog.map(i => <option key={i.id} value={i.symbol}>{i.symbol} · {i.name}</option>)}
          </select>
          <span id={ids.symbolHint} className="ws-hint">Only instruments held in the selected account.</span>
        </div>
        <fieldset className="ws-field ws-segment">
          <legend>Side</legend>
          <div className="ws-segment__track">
            {SIDES.map(s => (
              <label key={s} className={`ws-segment__opt${side === s ? ' is-on' : ''}`}>
                <input type="radio" name="side" value={s} checked={side === s} onChange={() => { setSide(s); touch(); }} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="ws-field">
          <label htmlFor={ids.qty}>Quantity</label>
          <input id={ids.qty} inputMode="numeric" value={quantity} onChange={e => { setQuantity(e.target.value); touch(); }} aria-describedby={ids.qtyHint} aria-invalid={(!!fieldError && fieldError === quantityError(quantity) && !validQty) || undefined} />
          <span id={ids.qtyHint} className="ws-hint">Whole shares only.</span>
        </div>

        <dl className="ws-dl ws-dl--ticket" aria-label="Order estimate">
          <dt>Indicative price</dt><dd>{price !== null && account ? money(price, account.currency) : '—'}</dd>
          <dt>Estimated value</dt><dd className="ws-strong">{estimate !== null && account ? money(estimate, account.currency) : '—'}</dd>
          <dt>Available cash</dt><dd>{account ? money(availableCash(data, account), account.currency) : '—'}</dd>
          <dt>Held in account</dt><dd>{account && symbol ? `${qty(held)} ${symbol}` : '—'}</dd>
          <dt>Available to sell</dt><dd>{account && symbol ? `${qty(Math.max(sellable, 0))} ${symbol}` : '—'}</dd>
        </dl>
        <p className="ws-hint">Price comes from the account’s position price. Open buys reserve cash and open sells reserve shares until cancelled. Availability is confirmed by the order service when you place the order.</p>

        {fieldError && <div role="alert" className="ws-notice ws-notice--error">{fieldError}</div>}
        <Notices error={action.error} success={action.success} />
        <div className="ws-actions">
          <button type="submit" className="ws-btn ws-btn--primary" disabled={action.busy}>{action.busy ? 'Placing order…' : 'Place order'}</button>
        </div>
      </form>
    </Panel>
  );
}

const STATUS_FILTERS = ['All', 'Open', 'Cancelled'];

function OrderBlotter() {
  const { data, lk, reload } = useWorkspace();
  const [status, setStatus] = useState('All');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const action = useAction(reload);
  const ids = { status: useId(), search: useId() };

  const statuses = [...new Set([...STATUS_FILTERS, ...data.orders.map(o => o.status)])];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.orders.filter(o => (status === 'All' || o.status === status)
      && (!q || o.id.toLowerCase().includes(q) || o.symbol.toLowerCase().includes(q) || lk.accountLabel(o.accountId).toLowerCase().includes(q)));
  }, [data.orders, status, query, lk]);

  const sort = useSort(rows, 'id', {
    id: (o: Order) => o.id,
    account: (o: Order) => lk.accountLabel(o.accountId),
    symbol: (o: Order) => o.symbol,
    side: (o: Order) => o.side,
    quantity: (o: Order) => o.quantity,
    value: (o: Order) => o.quantity * o.price,
    status: (o: Order) => o.status,
  }, 'descending');

  const cancel = async (o: Order) => {
    setPending(o.id);
    await action.run(() => api.cancelOrder(o.id), () => `Order ${o.id} cancelled.`);
    setPending(null);
  };

  return (
    <Panel title="Orders" titleId="ws-orders-title" actions={<span className="ws-count" aria-live="polite">{rows.length} of {data.orders.length} orders</span>}>
      <div className="ws-filters" role="search" aria-label="Filter orders">
        <div className="ws-field">
          <label htmlFor={ids.status}>Order status</label>
          <select id={ids.status} value={status} onChange={e => setStatus(e.target.value)}>
            {statuses.map(s => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}
          </select>
        </div>
        <div className="ws-field ws-field--grow">
          <label htmlFor={ids.search}>Search orders</label>
          <input id={ids.search} type="search" value={query} placeholder="Order ID, symbol or account" onChange={e => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="ws-pad-x"><Notices error={action.error} success={action.success} /></div>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <caption className="ws-sr">Orders</caption>
          <thead>
            <tr>
              <SortHeader label="Order" k="id" sort={sort} />
              <SortHeader label="Account" k="account" sort={sort} />
              <SortHeader label="Symbol" k="symbol" sort={sort} />
              <SortHeader label="Side" k="side" sort={sort} />
              <SortHeader label="Quantity" k="quantity" sort={sort} align="right" />
              <th scope="col" className="ws-num">Price</th>
              <SortHeader label="Value" k="value" sort={sort} align="right" />
              <SortHeader label="Status" k="status" sort={sort} />
              <th scope="col"><span className="ws-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {sort.sorted.map(o => {
              const c = lk.accounts.get(o.accountId)?.currency ?? 'CAD';
              return (
                <tr key={o.id}>
                  <th scope="row" className="ws-mono">{o.id}</th>
                  <td>{lk.accountLabel(o.accountId)}</td>
                  <td className="ws-mono">{o.symbol}</td>
                  <td><span className={`ws-side ws-side--${o.side.toLowerCase()}`}>{o.side}</span></td>
                  <td className="ws-num">{qty(o.quantity)}</td>
                  <td className="ws-num">{money(o.price, c)}</td>
                  <td className="ws-num">{money(o.quantity * o.price, c)}</td>
                  <td><StatusPill status={o.status} /></td>
                  <td className="ws-num">
                    {o.status === 'Open' && (
                      <button type="button" className="ws-btn ws-btn--danger ws-btn--sm" aria-label={`Cancel order ${o.id}`} disabled={action.busy} onClick={() => cancel(o)}>
                        {pending === o.id ? 'Cancelling…' : 'Cancel order'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {sort.sorted.length === 0 && (
              <EmptyRow colSpan={9}>{data.orders.length === 0 ? 'No orders yet. Place one with the order ticket.' : 'No orders match these filters.'}</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
