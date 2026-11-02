import type { Account, Bootstrap, Client, Order } from './api';

export const AREAS = ['clients', 'portfolio', 'orders', 'money', 'rebalance', 'settlements'] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  clients: 'Clients',
  portfolio: 'Portfolio',
  orders: 'Orders',
  money: 'Move money',
  rebalance: 'Rebalance',
  settlements: 'Settlements',
};

/** Audit actions are namespaced by entity (`order.created`, `client.updated`, ...). */
export const AREA_AUDIT_PREFIXES: Record<Area, string[]> = {
  clients: ['client'],
  portfolio: ['order', 'transfer'],
  orders: ['order'],
  money: ['transfer'],
  rebalance: ['allocation', 'rebalance'],
  settlements: ['exception'],
};

export function isWorkspaceLocation(search = window.location.search) {
  return new URLSearchParams(search).get('screen') === 'workspace';
}

export function readArea(search = window.location.search): Area {
  const a = new URLSearchParams(search).get('area');
  return AREAS.find(x => x === a) ?? 'clients';
}

export const workspaceHref = (area: Area, extra: Record<string, string> = {}) =>
  '/?' + new URLSearchParams({ screen: 'workspace', area, ...extra }).toString();

export const isOpen = (o: Order) => o.status === 'Open';

/** Cash held back for open buy orders on an account (quantity × price). */
export function reservedCash(data: Bootstrap, accountId: string) {
  return data.orders
    .filter(o => o.accountId === accountId && o.side === 'Buy' && isOpen(o))
    .reduce((s, o) => s + o.quantity * o.price, 0);
}

export const availableCash = (data: Bootstrap, account: Account) => account.cash - reservedCash(data, account.id);

export function heldQuantity(data: Bootstrap, accountId: string, symbol: string) {
  return data.positions.filter(p => p.accountId === accountId && p.symbol === symbol).reduce((s, p) => s + p.quantity, 0);
}

export function openSellQuantity(data: Bootstrap, accountId: string, symbol: string) {
  return data.orders
    .filter(o => o.accountId === accountId && o.symbol === symbol && o.side === 'Sell' && isOpen(o))
    .reduce((s, o) => s + o.quantity, 0);
}

export interface Instrument { symbol: string; name: string }

export function instruments(data: Bootstrap): Instrument[] {
  const seen = new Map<string, Instrument>();
  for (const p of data.positions) if (!seen.has(p.symbol)) seen.set(p.symbol, { symbol: p.symbol, name: p.name });
  return [...seen.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** Portfolio instrument filter choices: every instrument in the book, so a client/instrument combination may yield no holdings. */
export const portfolioInstrumentOptions = (data: Bootstrap) => instruments(data).map(i => i.symbol);

/** Indicative price: the account's own position first, otherwise any position in the symbol. */
export function indicativePrice(data: Bootstrap, accountId: string, symbol: string) {
  const own = data.positions.find(p => p.accountId === accountId && p.symbol === symbol);
  return (own ?? data.positions.find(p => p.symbol === symbol))?.price ?? null;
}

export function lookups(data: Bootstrap) {
  const accounts = new Map(data.accounts.map(a => [a.id, a]));
  const clients = new Map(data.clients.map(c => [c.id, c]));
  const clientOf = (accountId: string): Client | undefined => {
    const a = accounts.get(accountId);
    return a ? clients.get(a.clientId) : undefined;
  };
  const accountLabel = (accountId: string) => {
    const a = accounts.get(accountId);
    return a ? `${a.name} (${a.id})` : accountId;
  };
  return { accounts, clients, clientOf, accountLabel };
}

export type Lookups = ReturnType<typeof lookups>;

/** Sums per currency; CAD and USD are never added together. */
export function totalsByCurrency<T>(items: T[], currency: (t: T) => string, amount: (t: T) => number) {
  const out = new Map<string, number>();
  for (const it of items) out.set(currency(it), (out.get(currency(it)) ?? 0) + amount(it));
  return out;
}

export const sortCurrencies = (codes: Iterable<string>) => [...codes].sort((a, b) => (a === 'CAD' ? -1 : b === 'CAD' ? 1 : a.localeCompare(b)));
