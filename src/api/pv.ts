// Client for /api/pv/* (spec 004). Screens pass a token getter; requests carry `Authorization: Bearer`.
import type {
  IsoDate, PvAccount, PvAdminStats, PvArchiveFiles, PvCheckAll, PvClient, PvClientSearchRow, PvHoldings, PvLoginResponse,
  PvPositionCheck, PvReconNote, PvSaveNote, PvSession, PvSettlements,
} from './pv-types';

export class PvApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'PvApiError'; }
}

export interface PvClientOptions { baseUrl?: string; token?: () => string | null; fetch?: typeof fetch }

const qs = (p: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1])).toString();
  return s ? `?${s}` : '';
};

export function createPvClient(opts: PvClientOptions = {}) {
  const base = opts.baseUrl ?? '/api/pv';
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  async function send(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = opts.token?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await doFetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => null) as { error?: string } | null;
      throw new PvApiError(res.status, err?.error ?? `${method} ${path} failed with ${res.status}`);
    }
    return res;
  }
  const json = async <T>(method: string, path: string, body?: unknown) => (await send(method, path, body)).json() as Promise<T>;
  const acct = (id: number) => `/accounts/${encodeURIComponent(String(id))}`;

  return {
    login: (username: string, password: string) => json<PvLoginResponse>('POST', '/login', { username, password }),
    session: () => json<PvSession>('GET', '/session'),
    accounts: () => json<{ accounts: PvAccount[] }>('GET', '/accounts'),
    account: (acctId: number) => json<PvAccount>('GET', acct(acctId)),
    searchClients: (q: string) => json<{ clients: PvClientSearchRow[] }>('GET', `/clients/search${qs({ q })}`),
    client: (clientId: number) => json<PvClient>('GET', `/clients/${encodeURIComponent(String(clientId))}`),
    statementDates: (acctId: number) => json<{ acctId: number; dates: IsoDate[] }>('GET', `${acct(acctId)}/statement-dates`),
    holdings: (acctId: number, date?: IsoDate) => json<PvHoldings>('GET', `${acct(acctId)}/holdings${qs({ date })}`),
    settlements: (acctId: number, range: { from?: IsoDate; to?: IsoDate } = {}) => json<PvSettlements>('GET', `${acct(acctId)}/settlements${qs(range)}`),
    positionCheck: (acctId: number, date: IsoDate) => json<PvPositionCheck>('GET', `${acct(acctId)}/position-check${qs({ date })}`),
    saveNote: (acctId: number, note: PvSaveNote) => json<PvReconNote>('PUT', `${acct(acctId)}/position-check/notes`, note),
    positionCheckDates: () => json<{ dates: IsoDate[] }>('GET', '/position-check/dates'),
    checkAll: (date: IsoDate) => json<PvCheckAll>('GET', `/position-check/all${qs({ date })}`),
    archiveFiles: (f: { type?: 'MT535' | 'MT54x'; safe?: string; date?: IsoDate } = {}) => json<PvArchiveFiles>('GET', `/archive/files${qs(f)}`),
    archiveRaw: async (path: string) => (await send('GET', `/archive/files/raw${qs({ path })}`)).text(),
    adminStats: () => json<PvAdminStats>('GET', '/admin/stats'),
    reloadArchive: () => json<PvAdminStats>('POST', '/admin/archive/reload'),
  };
}
export type PvApiClient = ReturnType<typeof createPvClient>;
