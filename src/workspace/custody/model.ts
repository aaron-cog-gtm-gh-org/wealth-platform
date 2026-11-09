import type { ReconEditStatus } from './api';

export const CUSTODY_VIEWS = ['clients', 'client', 'holdings', 'settlements', 'check', 'checkall', 'messages', 'archive'] as const;
export type CustodyView = (typeof CUSTODY_VIEWS)[number];

/** Views shown in the Custody sub-navigation; `client` is reached from search results. */
export const NAV_VIEWS: { view: CustodyView; label: string }[] = [
  { view: 'clients', label: 'Client search' },
  { view: 'holdings', label: 'Holdings' },
  { view: 'settlements', label: 'Settlements' },
  { view: 'check', label: 'Position check' },
  { view: 'checkall', label: 'Check all accounts' },
  { view: 'messages', label: 'Messages' },
  { view: 'archive', label: 'Archive' },
];

export const VIEW_LABELS: Record<CustodyView, string> = {
  clients: 'Client search',
  client: 'Client summary',
  holdings: 'Holdings',
  settlements: 'Settlements',
  check: 'Position check',
  checkall: 'Check all accounts',
  messages: 'Messages',
  archive: 'Archive',
};

export const RECON_EDIT_STATUSES: ReconEditStatus[] = ['OPEN', 'CHASED', 'RESOLVED', 'WRITEOFF'];
export const RECON_NOTE_MAX = 500;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INT = /^[1-9]\d{0,9}$/;

export const isIsoDate = (s: string | null | undefined): s is string => !!s && ISO_DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

export interface CustodyRoute {
  view: CustodyView;
  client: number | null;
  acct: number | null;
  date: string | null;
  from: string | null;
  to: string | null;
  file: string | null;
  q: string;
}

/** Parses the Custody deep-link parameters; anything malformed is dropped rather than sent to the API. */
export function readCustodyRoute(params: URLSearchParams): CustodyRoute {
  const v = params.get('view');
  const int = (k: string) => { const s = params.get(k); return s && POSITIVE_INT.test(s) ? Number(s) : null; };
  const date = (k: string) => { const s = params.get(k); return isIsoDate(s) ? s : null; };
  const file = params.get('file');
  return {
    view: CUSTODY_VIEWS.find(x => x === v) ?? 'clients',
    client: int('client'),
    acct: int('acct'),
    date: date('date'),
    from: date('from'),
    to: date('to'),
    file: file && file.length <= 64 ? file : null,
    q: (params.get('q') ?? '').slice(0, 100),
  };
}

/** Query parameters for `go('custody', ...)`; empty values are omitted so links stay short. */
export function custodyParams(view: CustodyView, extra: Partial<Record<'client' | 'acct' | 'date' | 'from' | 'to' | 'file' | 'q', string | number | null | undefined>> = {}) {
  const out: Record<string, string> = { view };
  for (const [k, val] of Object.entries(extra)) if (val !== null && val !== undefined && val !== '') out[k] = String(val);
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One date format across every Custody view: `09 Oct 2026`. Calendar dates never shift with the browser's time zone. */
export function custodyDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** `09 Oct 2026 16:02` in London time, matching the custody desk's working day. */
export function custodyTimestamp(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).map(p => [p.type, p.value]));
  return `${custodyDate(`${parts.year}-${parts.month}-${parts.day}`)} ${parts.hour}:${parts.minute}`;
}

/** Account types are stored verbatim from the source system, some with trailing spaces. */
export const displayAcctType = (t: string | null | undefined) => (t ?? '').trim() || '—';

export const CLIENT_STATUS_LABELS: Record<string, string> = { A: 'Active', D: 'Dormant', C: 'Closed' };
export const ACCOUNT_STATUS_LABELS: Record<string, string> = { O: 'Open', C: 'Closed' };
export const clientStatusLabel = (s: string) => CLIENT_STATUS_LABELS[s.trim()] ?? s;
export const accountStatusLabel = (s: string) => ACCOUNT_STATUS_LABELS[s.trim()] ?? s;

/** Pill tone for a recon status; historic O/C codes are shown verbatim with the closest tone. */
export function reconTone(status: string): 'ok' | 'warn' | 'bad' | 'info' | 'mute' {
  switch (status) {
    case 'NEW': return 'bad';
    case 'OPEN': case 'O': return 'info';
    case 'CHASED': return 'warn';
    case 'RESOLVED': case 'C': return 'ok';
    default: return 'mute';
  }
}

/** Status pre-selected in the editor: the saved status if it can still be chosen, otherwise OPEN. */
export const initialEditStatus = (status: string): ReconEditStatus =>
  (RECON_EDIT_STATUSES as string[]).includes(status) ? (status as ReconEditStatus) : 'OPEN';

const qtyFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });
const priceFmt = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const amountFmt = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat('en-GB');

export const custodyQty = (n: number) => qtyFmt.format(n);
export const signedQty = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + qtyFmt.format(Math.abs(n));
export const custodyPrice = (n: number) => priceFmt.format(n);
export const custodyAmount = (n: number | null) => (n === null ? '—' : amountFmt.format(n));
export const gbp = (n: number) => '£' + amountFmt.format(n);
export const count = (n: number) => intFmt.format(n);

export function fileSize(bytes: number) {
  return bytes < 1024 ? `${intFmt.format(bytes)} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export const pageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));

/** Validates a settlements date range before it is sent; returns a message or null. */
export function rangeError(from: string, to: string) {
  if (!isIsoDate(from) || !isIsoDate(to)) return 'Enter both dates as YYYY-MM-DD.';
  if (from > to) return 'The From date must be on or before the To date.';
  return null;
}

/** Leading zeros on safekeeping account codes are not significant. */
export const normaliseSafe = (s: string) => s.trim().replace(/^0+(?=\d)/, '');
