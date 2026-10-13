import type {
  ActivityDto, AlternativesDto, CustodyClientPage, CustodyClientSummary, CustodyConfirmation, CustodyStatement, CustodyStatementDate,
  HouseholdDto, PaymentsDto, PerformanceDto, PortfolioDto, PositionCheckMode, PositionCheckResult, RebalanceDto, SettlementExceptionsDto,
  WealthData,
} from './types';

/** Household shown when no `?client=` is given. */
export const DEFAULT_HOUSEHOLD_ID = 'HH-WHITFIELD';
/** @deprecated use `selectedClient()`; kept for existing imports. */
export const HOUSEHOLD_ID = DEFAULT_HOUSEHOLD_ID;
export const CLIENT_ID = 'C-00418823';
export const OPS_QUEUE = 'Wealth Ops – Toronto';

async function get<T>(path: string): Promise<T> {
  const res = await fetch('/api' + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Client selected via `?client=`: a platform household id (`HH-WHITFIELD`) or a custody client id
 * (digits, e.g. `?client=1001`). Defaults to the existing household.
 */
export type ClientSelection = { kind: 'household'; id: string } | { kind: 'custody'; clientId: number };

export function parseClientSelection(value: string | null | undefined): ClientSelection {
  const v = value?.trim();
  if (v && /^\d{1,10}$/.test(v)) return { kind: 'custody', clientId: Number(v) };
  return { kind: 'household', id: v || DEFAULT_HOUSEHOLD_ID };
}

export const selectedClient = (search: string = typeof window === 'undefined' ? '' : window.location.search): ClientSelection =>
  parseClientSelection(new URLSearchParams(search).get('client'));

/** `?client=` value for a selection (used by the client picker). */
export const clientParam = (sel: ClientSelection) => (sel.kind === 'custody' ? String(sel.clientId) : sel.id);

const EMPTY_PERFORMANCE: PerformanceDto = { periods: [] };
const EMPTY_REBALANCE: RebalanceDto = { proposal: { id: '', status: 'Not available', trackingErrorBeforePct: 0, trackingErrorAfterPct: 0 }, trades: [], checks: [], drift: [] };
const EMPTY_ALTERNATIVES: AlternativesDto = { commitments: [], capitalCalls: [], distributions: [] };
const EMPTY_ACTIVITY: ActivityDto = { feed: [], pending: [], transactions: [] };

export async function loadWealthData(selection: ClientSelection = selectedClient()): Promise<WealthData> {
  if (selection.kind === 'custody') return loadCustodyWealthData(selection.clientId);
  const hh = '/households/' + encodeURIComponent(selection.id);
  const client = '/portal/clients/' + encodeURIComponent(CLIENT_ID);
  const [household, portfolio, performance, rebalance, alternatives, exceptions, activity, payments] = await Promise.all([
    get<HouseholdDto>(hh),
    get<PortfolioDto>(hh + '/portfolio'),
    get<PerformanceDto>(hh + '/performance'),
    get<RebalanceDto>(hh + '/rebalance'),
    get<AlternativesDto>(hh + '/alternatives'),
    get<SettlementExceptionsDto>('/ops/queues/' + encodeURIComponent(OPS_QUEUE) + '/settlement-exceptions'),
    get<ActivityDto>(client + '/activity'),
    get<PaymentsDto>(client + '/payments'),
  ]);
  return { household, portfolio, performance, rebalance, alternatives, exceptions, activity, payments };
}

/**
 * A custody client through the existing screens: household + portfolio from the custody adapter
 * (GBP); panels with no legacy source are empty and listed in `household.source.unavailable`.
 */
async function loadCustodyWealthData(clientId: number): Promise<WealthData> {
  const [household, portfolio, exceptions, payments] = await Promise.all([
    getCustodyHousehold(clientId),
    getCustodyPortfolio(clientId),
    get<SettlementExceptionsDto>('/ops/queues/' + encodeURIComponent(OPS_QUEUE) + '/settlement-exceptions'),
    get<PaymentsDto>('/portal/clients/' + encodeURIComponent(CLIENT_ID) + '/payments').then(p => ({ ...p, payees: [] })),
  ]);
  return { household, portfolio, performance: EMPTY_PERFORMANCE, rebalance: EMPTY_REBALANCE, alternatives: EMPTY_ALTERNATIVES, exceptions, activity: EMPTY_ACTIVITY, payments };
}

// --- Custody fetch helpers (contracts/api.md) ---

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
};
const custody = (path: string) => '/custody' + path;

export const getCustodyClients = (q = '', page = 1) => get<CustodyClientPage>(custody('/clients' + qs({ q, page })));
export const getCustodyClient = (clientId: number) => get<CustodyClientSummary>(custody(`/clients/${clientId}`));
export const getCustodyHousehold = (clientId: number) => get<HouseholdDto>(custody(`/clients/${clientId}/household`));
export const getCustodyPortfolio = (clientId: number) => get<PortfolioDto>(custody(`/clients/${clientId}/portfolio`));
export const getStatementDates = (accountId: number) => get<CustodyStatementDate[]>(custody(`/accounts/${accountId}/statements`));
export const getStatement = (accountId: number, date: string) => get<CustodyStatement>(custody(`/accounts/${accountId}/statements/${date}`));
export const getConfirmations = (accountId: number, from?: string, to?: string) =>
  get<CustodyConfirmation[]>(custody(`/accounts/${accountId}/confirmations` + qs({ from, to })));
export const getPositionChecks = (opts: { date?: string; accountId?: number; mode?: PositionCheckMode } = {}) =>
  get<PositionCheckResult>(custody('/position-checks' + qs(opts)));
