import { ApiError } from '../api';

export type MessageFamily = 'MT535' | 'MT54x';
export type ReconEditStatus = 'OPEN' | 'CHASED' | 'RESOLVED' | 'WRITEOFF';

export interface CustodyClient { clientId: number; clientRef: string; name: string; status: string; adviserUsername: string | null; adviserName: string | null; accountCount: number }
export interface CustodyClientAccount { acctId: number; acctNo: string; acctType: string; baseCcy: string; safeCode: string; openDate: string | null; closeDate: string | null; status: string }
export interface CustodyAccount { acctId: number; acctNo: string; clientId: number; clientName: string; safeCode: string; status: string }
export interface HoldingLine { isin: string; instrument: string; qty: number; qtyType: string; price: number; ccy: string; mktVal: number; mktValGbp: number }
export interface StatementInfo { statementDate: string; function: string | null; fileSeq: number; fileName: string }
export interface HoldingsStatement { statement: StatementInfo; lines: HoldingLine[]; totalGbp: number }
export interface Settlement { tradeDate: string; settleDate: string; mtType: number; direction: 'REC' | 'DEL'; isin: string; instrument: string; qty: number; amount: number | null; ccy: string; seme: string; fileName: string }
export interface SettlementList { from: string; to: string; settlements: Settlement[] }
export interface BreakRow { isin: string; instrument: string; prevQty: number; netSettled: number; expected: number; stmtQty: number; diff: number; status: string; note: string | null; updatedBy: string | null; updatedAt: string | null }
export interface PositionCheck { statementDate: string; previousStatementDate: string | null; message: string | null; rows: BreakRow[] }
export interface CheckAllAccount { acctId: number; acctNo: string; clientName: string; breaks: number; newBreaks: number; previousStatementDate: string | null }
export interface CheckAll { statementDate: string; accounts: CheckAllAccount[] }
export interface Operator { username: string; fullName: string; role: string }
export interface MessageFile { fileName: string; family: MessageFamily; mtType: number; msgDate: string; safeCode: string; sizeBytes: number; parseStatus: string }
export interface MessageList { total: number; page: number; files: MessageFile[] }
export interface RawMessage { fileName: string; relPath: string; family: MessageFamily; raw: string }
export interface ArchiveStatus { root: string; mt535Count: number; mt54xCount: number; statements: number; confirmations: number; parseErrors: number; loadedAt: string | null; loadMs: number | null }
export interface ReconNoteInput { acctId: number; isin: string; stmtDate: string; status: ReconEditStatus; note: string; operator: string }

export const MESSAGES_PAGE_SIZE = 50;

const BASE = '/api/custody';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('The custody service could not be reached. Check your connection and try again.', 0);
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
const optNum = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const optStr = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

function qs(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? '?' + s : '';
}

const id = (v: number | string) => encodeURIComponent(String(v));

/** NUMERIC columns arrive as strings from pg; normalise to numbers at the boundary. */
export const custodyApi = {
  clients: async (q: string) => {
    const r = await request<{ clients: CustodyClient[] }>('GET', '/clients' + qs({ q: q.trim() }));
    return r.clients.map(c => ({ ...c, clientId: num(c.clientId), accountCount: num(c.accountCount), adviserUsername: optStr(c.adviserUsername), adviserName: optStr(c.adviserName) }));
  },
  client: async (clientId: number) => {
    const r = await request<{ client: CustodyClient; accounts: CustodyClientAccount[] }>('GET', '/clients/' + id(clientId));
    return {
      client: { ...r.client, clientId: num(r.client.clientId), accountCount: num(r.client.accountCount ?? r.accounts.length), adviserUsername: optStr(r.client.adviserUsername), adviserName: optStr(r.client.adviserName) },
      accounts: r.accounts.map(a => ({ ...a, acctId: num(a.acctId), openDate: optStr(a.openDate), closeDate: optStr(a.closeDate) })),
    };
  },
  accounts: async () => {
    const r = await request<{ accounts: CustodyAccount[] }>('GET', '/accounts');
    return r.accounts.map(a => ({ ...a, acctId: num(a.acctId), clientId: num(a.clientId) }));
  },
  statementDates: async (acctId: number) => (await request<{ dates: string[] }>('GET', `/accounts/${id(acctId)}/statements`)).dates,
  holdings: async (acctId: number, date: string): Promise<HoldingsStatement> => {
    const r = await request<HoldingsStatement>('GET', `/accounts/${id(acctId)}/statements/${id(date)}`);
    return {
      statement: { ...r.statement, fileSeq: num(r.statement.fileSeq), function: optStr(r.statement.function) },
      lines: r.lines.map(l => ({ ...l, qty: num(l.qty), price: num(l.price), mktVal: num(l.mktVal), mktValGbp: num(l.mktValGbp) })),
      totalGbp: num(r.totalGbp),
    };
  },
  settlements: async (acctId: number, from?: string, to?: string): Promise<SettlementList> => {
    const r = await request<SettlementList>('GET', `/accounts/${id(acctId)}/settlements` + qs({ from, to }));
    return { ...r, settlements: r.settlements.map(s => ({ ...s, mtType: num(s.mtType), qty: num(s.qty), amount: optNum(s.amount) })) };
  },
  positionCheck: async (acctId: number, date: string): Promise<PositionCheck> => {
    const r = await request<PositionCheck>('GET', `/accounts/${id(acctId)}/position-check/${id(date)}`);
    return {
      ...r,
      previousStatementDate: optStr(r.previousStatementDate),
      message: optStr(r.message),
      rows: r.rows.map(b => ({ ...b, prevQty: num(b.prevQty), netSettled: num(b.netSettled), expected: num(b.expected), stmtQty: num(b.stmtQty), diff: num(b.diff), note: optStr(b.note), updatedBy: optStr(b.updatedBy), updatedAt: optStr(b.updatedAt) })),
    };
  },
  checkAll: async (date: string): Promise<CheckAll> => {
    const r = await request<CheckAll>('GET', `/position-check/${id(date)}`);
    return { ...r, accounts: r.accounts.map(a => ({ ...a, acctId: num(a.acctId), breaks: num(a.breaks), newBreaks: num(a.newBreaks), previousStatementDate: optStr(a.previousStatementDate) })) };
  },
  allStatementDates: async () => (await request<{ dates: string[] }>('GET', '/statement-dates')).dates,
  operators: async () => (await request<{ operators: Operator[] }>('GET', '/operators')).operators,
  saveReconNote: (body: ReconNoteInput) => request<{ note: unknown }>('PUT', '/recon-notes', body),
  messages: async (filters: { family?: string; date?: string; safe?: string; page?: number }): Promise<MessageList> => {
    const r = await request<MessageList>('GET', '/messages' + qs(filters));
    return { total: num(r.total), page: num(r.page), files: r.files.map(f => ({ ...f, mtType: num(f.mtType), sizeBytes: num(f.sizeBytes) })) };
  },
  message: (fileName: string) => request<RawMessage>('GET', '/messages/' + id(fileName)),
  archiveStatus: async () => normaliseStatus(await request<ArchiveStatus>('GET', '/archive/status')),
  reloadArchive: async () => normaliseStatus(await request<ArchiveStatus>('POST', '/archive/reload', {})),
};

function normaliseStatus(s: ArchiveStatus): ArchiveStatus {
  return { ...s, mt535Count: num(s.mt535Count), mt54xCount: num(s.mt54xCount), statements: num(s.statements), confirmations: num(s.confirmations), parseErrors: num(s.parseErrors), loadedAt: optStr(s.loadedAt), loadMs: optNum(s.loadMs) };
}
