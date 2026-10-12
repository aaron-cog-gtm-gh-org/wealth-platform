export const fmt = (n: number, d = 0) => Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });
export const money = (n: number, d = 0) => (n < 0 ? '−$' : '$') + fmt(n, d);
export const signedMoney = (n: number, d = 0) => (n > 0 ? '+$' : n < 0 ? '−$' : '$') + fmt(n, d);
export const pct = (n: number, d = 2) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(n, d) + '%';

export const GREEN = '#00804a';
export const RED = '#d6302f';
export const AMBER = '#b86a00';
export const MUTE = 'rgba(25,25,25,.56)';
export const INK = '#191919';

export type PillKind = 'ok' | 'warn' | 'bad' | 'info' | 'mute';
const PILLS: Record<PillKind, [string, string]> = {
  ok: ['#e3f5ec', '#00703f'],
  warn: ['#fdf0dd', '#94520a'],
  bad: ['#fdecec', '#b3201f'],
  info: ['#e6eef8', '#00498a'],
  mute: ['#eef0f3', '#4b5563'],
};
export const pill = (k: PillKind) => PILLS[k];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isoParts = (iso: string) => iso.split('-');

/** `2026-10-09` → `09-Oct` */
export const dayMonth = (iso: string) => { const [, m, d] = isoParts(iso); return `${d}-${MONTHS[+m - 1]}`; };
/** `2026-10-09` → `09-Oct-2026` */
export const dayMonthYear = (iso: string) => dayMonth(iso) + '-' + isoParts(iso)[0];
/** `2026-11-04` → `Wed 04-Nov-2026` */
export const weekdayDate = (iso: string) => { const [y, m, d] = isoParts(iso).map(Number); return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ' ' + dayMonthYear(iso); };
/** Whole years between two ISO dates. */
export const yearsBetween = (fromIso: string, toIso: string) => {
  const [fy, fm, fd] = isoParts(fromIso).map(Number), [ty, tm, td] = isoParts(toIso).map(Number);
  return ty - fy - (tm < fm || (tm === fm && td < fd) ? 1 : 0);
};
export const signedPts = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
