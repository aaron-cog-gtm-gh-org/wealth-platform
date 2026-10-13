import type {
  ActivityDto, AlternativesDto, BreakNote, BreakNoteHistory, BreakNotePatch, BreakNoteRow, ClientPickerPage, CustodyClientPage,
  CustodyClientSummary, CustodyConfirmation, CustodyMessage, CustodyMessagePage, CustodyStatement, CustodyStatementDate,
  HouseholdDto, IngestRun, IngestionStatus, PaymentsDto, PerformanceDto, PortfolioDto, PositionCheckMode, PositionCheckResult,
  RebalanceDto, SettlementExceptionsDto, WealthData,
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

async function send<T>(method: string, path: string, body: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message: string | undefined;
    try {
      const payload = await res.json() as { error?: unknown };
      if (typeof payload.error === 'string') message = payload.error;
    } catch {}
    throw new Error(message ?? `${method} ${path} failed with ${res.status}`);
  }
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

// Legacy custody has no performance history: flat zero series keep the existing screens renderable.
const PERIOD_CODES = ['1M', '3M', 'YTD', '1Y', '3Y', 'Since inception'];
const EMPTY_PERFORMANCE: PerformanceDto = {
  periods: PERIOD_CODES.map(code => ({ code, startDate: '', portfolioReturnPct: 0, benchmarkReturnPct: 0, portfolio: [0, 0], benchmark: [0, 0] })),
};
const EMPTY_REBALANCE: RebalanceDto = { proposal: { id: '', status: 'Not available', trackingErrorBeforePct: 0, trackingErrorAfterPct: 0 }, trades: [], checks: [], drift: [] };
const EMPTY_ALTERNATIVES: AlternativesDto = { commitments: [], capitalCalls: [], distributions: [] };
const EMPTY_ACTIVITY: ActivityDto = { feed: [], pending: [], transactions: [] };
const EMPTY_PAYMENTS: PaymentsDto = { payees: [], rails: [] };

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
  const [household, portfolio, exceptions] = await Promise.all([
    getCustodyHousehold(clientId),
    getCustodyPortfolio(clientId),
    get<SettlementExceptionsDto>('/ops/queues/' + encodeURIComponent(OPS_QUEUE) + '/settlement-exceptions'),
  ]);
  return { household, portfolio, performance: EMPTY_PERFORMANCE, rebalance: EMPTY_REBALANCE, alternatives: EMPTY_ALTERNATIVES, exceptions, activity: EMPTY_ACTIVITY, payments: EMPTY_PAYMENTS };
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
export const searchClients = (q = '', page = 1) => get<ClientPickerPage>('/clients' + qs({ q, page }));
export const getCustodyClient = (clientId: number) => get<CustodyClientSummary>(custody(`/clients/${clientId}`));
export const getCustodyHousehold = (clientId: number) => get<HouseholdDto>(custody(`/clients/${clientId}/household`));
export const getCustodyPortfolio = (clientId: number) => get<PortfolioDto>(custody(`/clients/${clientId}/portfolio`));
export const getStatementDates = (accountId: number) => get<CustodyStatementDate[]>(custody(`/accounts/${accountId}/statements`));
export const getStatement = (accountId: number, date: string) => get<CustodyStatement>(custody(`/accounts/${accountId}/statements/${date}`));
export const getConfirmations = (accountId: number, from?: string, to?: string) =>
  get<CustodyConfirmation[]>(custody(`/accounts/${accountId}/confirmations` + qs({ from, to })));
export const getPositionChecks = (opts: { date?: string; accountId?: number; mode?: PositionCheckMode } = {}) =>
  get<PositionCheckResult>(custody('/position-checks' + qs(opts)));
export const getPositionCheckDates = () => get<string[]>(custody('/position-check-dates'));
export const getBreakNotes = () => get<BreakNoteRow[]>(custody('/break-notes'));
export const patchBreakNote = (accountId: number, isin: string, date: string, patch: BreakNotePatch) =>
  send<BreakNote>('PATCH', custody(`/breaks/${accountId}/${isin}/${date}`), patch);
export const getBreakHistory = (accountId: number, isin: string, date: string) =>
  get<BreakNoteHistory[]>(custody(`/breaks/${accountId}/${isin}/${date}/history`));

export const getCustodyMessages = (f: { type?: string; date?: string; safe?: string | number; page?: number } = {}) =>
  get<CustodyMessagePage>(custody('/messages' + qs({ type: f.type, date: f.date, safe: f.safe, page: f.page })));
export const getCustodyMessage = (messageId: number) => get<CustodyMessage>(custody(`/messages/${messageId}`));
export const getIngestionStatus = () => get<IngestionStatus>(custody('/admin/ingestion'));

/** POST an incremental ingest run; non-2xx bodies carry `{ error }` (409 busy/conflict). */
export async function postIngestRun(): Promise<IngestRun> {
  const res = await fetch('/api/custody/admin/ingest-runs', { method: 'POST', headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `POST /custody/admin/ingest-runs failed with ${res.status}`);
  }
  return res.json() as Promise<IngestRun>;
}
