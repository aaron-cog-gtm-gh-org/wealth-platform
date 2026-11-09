// Spec 008: legacy ClientSearch.aspx + ClientSummary.aspx → PV client search and custody Client 360.
import { PvApiError } from '../api/pv';
import type { IsoDate, PvClientSearchRow, PvClientSummary, PvClientSummaryAccount } from '../api/pv-types';
import { formatDate } from '../domain/date';
import { Decimal } from '../domain/decimal';
import { fmtMoney, statusText } from '../domain/format';
import type { Screen, SetUiState, UiState } from '../types';
import { canAccess, PV_PAGES } from './pv/access';
import type { PvContextKey } from './pv/context';
import { PREVIEW_CLIENT_SEARCH, PREVIEW_CLIENT_SUMMARY } from './pv/preview';
import type { PvSliceDef } from './pv/slice';

export interface ClientSearchData { query: string | null; clients: PvClientSearchRow[] }
export interface ClientSummaryData { client: PvClientSummary | null }

/** legacy GridView PageSize="25" */
export const CLIENT_PAGE_SIZE = 25;

/** Blank `?q` is never sent; an omitted query (null) means "not searched yet", as on the legacy first GET. */
export const clientSearchSlice: PvSliceDef<ClientSearchData> = {
  needs: 'none',
  load: async (api, ctx) => (ctx.q == null ? { query: null, clients: [] } : { query: ctx.q, clients: (await api.searchClients(ctx.q)).clients }),
  isEmpty: d => d.query === '' && d.clients.length === 0,
  preview: () => PREVIEW_CLIENT_SEARCH,
};

/** Only with `?cid=`: without it `c360` stays the Whitfield mockup Client 360. Unknown client (404) → Empty. */
export const clientSummarySlice: PvSliceDef<ClientSummaryData> = {
  needs: 'none',
  active: ctx => ctx.cid != null,
  load: async (api, ctx) => {
    try { return { client: await api.clientSummary(ctx.cid!) }; }
    catch (e) { if (e instanceof PvApiError && e.status === 404) return { client: null }; throw e; }
  },
  isEmpty: d => d.client === null,
  preview: () => ({ client: PREVIEW_CLIENT_SUMMARY }),
};

type OpenPv = (s: Screen, patch: Partial<Record<PvContextKey, string | null>>) => void;

const dt = (d: IsoDate | null) => (d ? formatDate(d) : '');
const money = (v: string | null) => (v === null ? '-' : fmtMoney(Decimal.parse(v)));
const pageScreen = (page: string) => PV_PAGES.find(p => p.page === page) ?? null;

/** ClientSearch.aspx: Client Ref, Client Name (link), Adviser, Status (WebUtil.StatusText), No. Accts. */
export function buildClientSearch(d: ClientSearchData, st: UiState, setState: SetUiState, openPv: OpenPv) {
  const pages = Math.max(1, Math.ceil(d.clients.length / CLIENT_PAGE_SIZE));
  const page = Math.min(Math.max(0, st.clientPage), pages - 1);
  const slice = d.clients.slice(page * CLIENT_PAGE_SIZE, (page + 1) * CLIENT_PAGE_SIZE);
  return {
    query: d.query,
    searched: d.query !== null,
    total: d.clients.length,
    resultLabel: d.clients.length === 1 ? '1 client' : `${d.clients.length} clients`,
    noResults: d.query !== null && d.clients.length === 0 ? 'No clients found.' : null,
    rangeLabel: d.clients.length ? `${page * CLIENT_PAGE_SIZE + 1}–${page * CLIENT_PAGE_SIZE + slice.length} of ${d.clients.length} · sorted by client name` : '',
    rows: slice.map(c => ({
      key: c.clientId,
      ref: c.clientRef,
      name: c.clientName,
      href: `?screen=c360&cid=${c.clientId}`,
      open: () => openPv('c360', { cid: String(c.clientId), acct: null, stmt: null }),
      adviser: c.adviserName ?? '',
      status: statusText(c.statusCd) ?? '',
      statusTone: c.statusCd === 'A' ? 'ok' : c.statusCd === 'D' ? 'warn' : 'off',
      accts: String(c.acctCount),
    })),
    pager: pages > 1 ? Array.from({ length: pages }, (_, i) => ({ label: String(i + 1), current: i === page, go: () => setState({ clientPage: i }) })) : [],
    prev: page > 0 ? () => setState({ clientPage: page - 1 }) : null,
    next: page < pages - 1 ? () => setState({ clientPage: page + 1 }) : null,
    search: (text: string) => { setState({ clientPage: 0 }); openPv('clients', { q: text }); },
  };
}

function accountLinks(a: PvClientSummaryAccount, role: string | null, openPv: OpenPv) {
  const link = (page: string, label: string, patch: Partial<Record<PvContextKey, string | null>>, when: boolean) => {
    const p = pageScreen(page);
    if (!when || !p || !canAccess(p.roles, role)) return null;
    return { label, enabled: p.screen !== null, go: () => p.screen && openPv(p.screen, patch) };
  };
  const acct = String(a.acctId);
  return [
    link('Holdings.aspx', 'Holdings', { acct, stmt: a.stmtDate }, a.stmtDate !== null),
    link('Settlements.aspx', 'Settlements', { acct, stmt: null }, true),
    link('PositionCheck.aspx', 'Position check', { acct, stmt: a.stmtDate }, a.stmtDate !== null),
  ].filter(<T,>(l: T | null): l is T => l !== null);
}

/** ClientSummary.aspx: client fields, accounts by ACCT_NO with latest statement + GBP value, grand total. */
export function buildClientSummary(c: PvClientSummary, role: string | null, openPv: OpenPv) {
  const withStmt = c.accounts.filter(a => a.stmtDate !== null);
  const latest = withStmt.map(a => a.stmtDate!).sort().slice(-1)[0] ?? null;
  const open = c.accounts.filter(a => a.statusCd === 'O').length;
  return {
    kpis: [
      { k: 'Grand total (GBP)', v: money(c.totalMktValGbp), sub: `Σ latest MT535 MktValGbp · ${withStmt.length} of ${c.accounts.length} accounts` },
      { k: 'Accounts', v: String(c.accounts.length), sub: `${open} open · ${c.accounts.length - open} closed` },
      { k: 'Latest statement', v: latest ? formatDate(latest) : '-', sub: 'Highest file sequence for the date' },
      { k: 'Adviser', v: c.adviserName ?? '-', sub: c.adviserUsername ?? 'No adviser assigned' },
    ],
    fields: [
      { k: 'Client ref', v: c.clientRef },
      { k: 'Client name', v: c.clientName },
      { k: 'Adviser', v: c.adviserName ?? '' },
      { k: 'Status', v: statusText(c.statusCd) ?? '' },
      { k: 'Client since', v: dt(c.createdDt) },
    ],
    accounts: c.accounts.map(a => ({
      key: a.acctId,
      no: a.acctNo,
      type: a.acctType ?? '',
      ccy: a.baseCcy,
      safe: a.safeCode ?? '',
      status: a.statusCd === 'O' ? 'Open' : 'Closed',
      open: a.statusCd === 'O',
      opened: dt(a.openDt),
      closed: dt(a.closeDt),
      stmt: a.stmtDate ? formatDate(a.stmtDate) : '-',
      value: money(a.mktValGbp),
      links: accountLinks(a, role, openPv),
    })),
    totalLabel: 'Grand Total (GBP):',
    total: money(c.totalMktValGbp),
    back: () => openPv('clients', { cid: null }),
  };
}

/** Shell copy for the custody Client 360 (`c360` with `?cid=`); the Whitfield copy stays for the default view. */
export function clientSummaryCopy(data: unknown) {
  const c = (data as ClientSummaryData | null)?.client ?? null;
  const latest = c?.accounts.map(a => a.stmtDate).filter((d): d is string => d !== null).sort().slice(-1)[0] ?? null;
  return {
    meta: [
      c ? `Portfolio Viewer / Client search / ${c.clientRef}` : 'Portfolio Viewer / Client search',
      c ? c.clientName : 'Client 360',
      c ? `Client 360 · ${c.accounts.length} custody account${c.accounts.length === 1 ? '' : 's'}${latest ? ` · statements to ${formatDate(latest)}` : ''}` : 'Custody client summary',
    ] as [string, string, string],
    empty: ['Client not found', 'No custody client has this client ID. It may have been mistyped in the link. Search by client name or client reference instead.', 'Go to client search'] as [string, string, string],
    err: ['Couldn’t load client summary', 'The Portfolio Viewer service did not return this client’s accounts or latest statements. Nothing has changed. Retry, or go back to client search.', 'Go to client search'] as [string, string, string],
  };
}
