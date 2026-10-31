export type RiskProfile = 'Conservative' | 'Moderate' | 'Growth';
export type KycStatus = 'Current' | 'Review due';
export type Side = 'Buy' | 'Sell';
export type ExceptionStatus = 'Open' | 'In progress' | 'Resolved';

export const RISK_PROFILES: RiskProfile[] = ['Conservative', 'Moderate', 'Growth'];
export const KYC_STATUSES: KycStatus[] = ['Current', 'Review due'];
export const EXCEPTION_STATUSES: ExceptionStatus[] = ['Open', 'In progress', 'Resolved'];
export const EXCEPTION_OWNERS = ['A. Nguyen', 'S. Patel'];

export interface Client { id: string; name: string; riskProfile: RiskProfile; kycStatus: KycStatus }
export interface Account { id: string; clientId: string; name: string; currency: string; cash: number }
export interface Position { id: string; accountId: string; symbol: string; name: string; quantity: number; price: number }
export interface Order { id: string; accountId: string; symbol: string; side: Side; quantity: number; price: number; status: string }
export interface Transfer { id: string; fromAccountId: string; toAccountId: string; amount: number; status: string; reference: string | null }
export interface SettlementException { id: string; accountId: string; reason: string; status: ExceptionStatus; owner: string | null; note: string | null }
export interface Allocation { assetClass: string; currentWeight: number; targetWeight: number }
export interface AuditEntry { id: string; action: string; entityId: string; detail: string; createdAt: string }

export interface Bootstrap {
  clients: Client[];
  accounts: Account[];
  positions: Position[];
  orders: Order[];
  transfers: Transfer[];
  exceptions: SettlementException[];
  allocations: Allocation[];
  audit: AuditEntry[];
}

export interface PreviewTrade { assetClass: string; currentWeight: number; targetWeight: number; drift: number }
export interface RebalancePreview { trades: PreviewTrade[]; status: 'Ready' | 'Within tolerance' }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const BASE = '/api/workflows';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('The workspace service could not be reached. Check your connection and try again.', 0);
  }
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = null; }
  }
  if (!res.ok) {
    const msg = json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string'
      ? (json as { error: string }).error
      : `Request failed (${res.status}).`;
    throw new ApiError(msg, res.status);
  }
  return json as T;
}

const num = (v: unknown) => Number(v);
const str = (v: unknown) => String(v);
const optStr = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

/** Defensive normalisation: IDs as strings, numeric fields as numbers. */
function normalise(raw: Bootstrap): Bootstrap {
  return {
    clients: (raw.clients ?? []).map(c => ({ ...c, id: str(c.id) })),
    accounts: (raw.accounts ?? []).map(a => ({ ...a, id: str(a.id), clientId: str(a.clientId), cash: num(a.cash) })),
    positions: (raw.positions ?? []).map(p => ({ ...p, id: str(p.id), accountId: str(p.accountId), quantity: num(p.quantity), price: num(p.price) })),
    orders: (raw.orders ?? []).map(o => ({ ...o, id: str(o.id), accountId: str(o.accountId), quantity: num(o.quantity), price: num(o.price) })),
    transfers: (raw.transfers ?? []).map(t => ({ ...t, id: str(t.id), fromAccountId: str(t.fromAccountId), toAccountId: str(t.toAccountId), amount: num(t.amount), reference: optStr(t.reference) })),
    exceptions: (raw.exceptions ?? []).map(e => ({ ...e, id: str(e.id), accountId: str(e.accountId), owner: optStr(e.owner), note: optStr(e.note) })),
    allocations: (raw.allocations ?? []).map(a => ({ ...a, currentWeight: num(a.currentWeight), targetWeight: num(a.targetWeight) })),
    audit: (raw.audit ?? []).map(a => ({ ...a, id: str(a.id), entityId: str(a.entityId) })),
  };
}

export const api = {
  bootstrap: async () => normalise(await request<Bootstrap>('GET', '/bootstrap')),
  updateClient: (id: string, body: { riskProfile: RiskProfile; kycStatus: KycStatus }) =>
    request<unknown>('PATCH', '/clients/' + encodeURIComponent(id), body),
  placeOrder: (body: { accountId: string; symbol: string; side: Side; quantity: number }) =>
    request<Order>('POST', '/orders', body),
  cancelOrder: (id: string) => request<unknown>('POST', '/orders/' + encodeURIComponent(id) + '/cancel', {}),
  createTransfer: (body: { fromAccountId: string; toAccountId: string; amount: number; reference: string }) =>
    request<Transfer>('POST', '/transfers', body),
  saveAllocations: (allocations: { assetClass: string; targetWeight: number }[]) =>
    request<unknown>('PUT', '/allocations', { allocations }),
  previewRebalance: () => request<RebalancePreview>('POST', '/rebalance/preview', {}),
  updateException: (id: string, body: { owner?: string; note?: string; status?: ExceptionStatus }) =>
    request<unknown>('PATCH', '/exceptions/' + encodeURIComponent(id), body),
};
