import { badRequest } from '../workflows/errors';

export const RECON_STATUSES = ['OPEN', 'CHASED', 'RESOLVED', 'WRITEOFF'] as const;
export type ReconStatus = typeof RECON_STATUSES[number];
export const MESSAGE_FAMILIES = ['MT535', 'MT54x'] as const;
export const MESSAGES_PAGE_SIZE = 50;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const MAX_ID = 2_147_483_647;

export type Query = Record<string, unknown>;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function parseIsoDate(value: unknown, field: string): string {
  if (!isIsoDate(value)) badRequest(`${field} must be a valid date (YYYY-MM-DD).`);
  return value;
}

export function parseId(value: unknown, field: string): number {
  if (typeof value !== 'string' && typeof value !== 'number') badRequest(`${field} must be a positive whole number.`);
  const text = String(value);
  if (!/^[1-9]\d{0,9}$/.test(text) || Number(text) > MAX_ID) badRequest(`${field} must be a positive whole number.`);
  return Number(text);
}

/** Rejects unknown or repeated query parameters; returns the query as single string values. */
export function queryParams(query: Query, allowed: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.includes(key)) badRequest(`Unknown query parameter "${key}".`);
    if (typeof value !== 'string') badRequest(`Query parameter "${key}" must be given once.`);
    out[key] = value;
  }
  return out;
}

export function parseClientQuery(query: Query): string {
  const { q = '' } = queryParams(query, ['q']);
  if (q.length > 100) badRequest('Search must be 100 characters or fewer.');
  return q;
}

export function parseSettlementRange(query: Query): { from?: string; to?: string } {
  const { from, to } = queryParams(query, ['from', 'to']);
  const range = {
    from: from === undefined || from === '' ? undefined : parseIsoDate(from, 'From date'),
    to: to === undefined || to === '' ? undefined : parseIsoDate(to, 'To date'),
  };
  if (range.from && range.to && range.from > range.to) badRequest('From date must be on or before the to date.');
  return range;
}

export interface MessageFilters {
  family?: typeof MESSAGE_FAMILIES[number];
  date?: string;
  safe?: string;
  page: number;
}

export function parseMessageFilters(query: Query): MessageFilters {
  const { family, date, safe, page } = queryParams(query, ['family', 'date', 'safe', 'page']);
  const filters: MessageFilters = { page: 1 };
  if (family !== undefined && family !== '') {
    if (!(MESSAGE_FAMILIES as readonly string[]).includes(family)) badRequest('Message type must be MT535 or MT54x.');
    filters.family = family as MessageFilters['family'];
  }
  if (date !== undefined && date !== '') filters.date = parseIsoDate(date, 'Date');
  if (safe !== undefined && safe.trim() !== '') {
    const code = safe.trim();
    if (!/^\d{1,10}$/.test(code)) badRequest('Safekeeping account must be up to 10 digits.');
    filters.safe = code.replace(/^0+(?=\d)/, '');
  }
  if (page !== undefined && page !== '') {
    if (!/^[1-9]\d{0,4}$/.test(page)) badRequest('Page must be a whole number from 1 to 99999.');
    filters.page = Number(page);
  }
  return filters;
}

export function parseFileName(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(value)) badRequest('File name is invalid.');
  return value;
}

export interface ReconNoteInput {
  acctId: number;
  isin: string;
  stmtDate: string;
  status: ReconStatus;
  note: string;
  operator: string;
}

export function validateReconNote(value: unknown): ReconNoteInput {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) badRequest('Request body must be a JSON object.');
  const body = value as Record<string, unknown>;
  const allowed = ['acctId', 'isin', 'stmtDate', 'status', 'note', 'operator'];
  const unknown = Object.keys(body).find(key => !allowed.includes(key));
  if (unknown) badRequest(`Unknown field "${unknown}".`);
  if (typeof body.acctId !== 'number' || !Number.isSafeInteger(body.acctId) || body.acctId < 1 || body.acctId > MAX_ID) {
    badRequest('Account ID must be a positive whole number.');
  }
  if (typeof body.isin !== 'string' || !ISIN.test(body.isin)) badRequest('ISIN must be 12 characters (e.g. GB00ZZ001500).');
  const stmtDate = parseIsoDate(body.stmtDate, 'Statement date');
  if (typeof body.status !== 'string' || !(RECON_STATUSES as readonly string[]).includes(body.status)) {
    badRequest('Status must be OPEN, CHASED, RESOLVED or WRITEOFF.');
  }
  if (typeof body.note !== 'string') badRequest('Note must be a string.');
  const note = body.note.trim();
  if (note.length > 500) badRequest('Note must be 500 characters or fewer.');
  if (typeof body.operator !== 'string' || !body.operator.trim()) badRequest('Operator is required.');
  const operator = body.operator.trim().toUpperCase();
  if (operator.length > 20) badRequest('Operator must be an active operations user.');
  return { acctId: body.acctId, isin: body.isin, stmtDate, status: body.status as ReconStatus, note, operator };
}

export function rejectBody(value: unknown) {
  if (value === undefined) return;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) badRequest('Request body must be a JSON object.');
  const unknown = Object.keys(value)[0];
  if (unknown) badRequest(`Unknown field "${unknown}".`);
}
