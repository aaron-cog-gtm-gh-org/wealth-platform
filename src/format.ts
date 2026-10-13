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

/** Currency symbols for the platform's reporting currencies (FR-024). CAD keeps the bare `$`. */
export const CURRENCY_SYMBOL: Record<'CAD' | 'USD' | 'GBP' | 'EUR', string> = { CAD: '$', USD: 'US$', GBP: '£', EUR: '€' };
/** Amount in a given currency: `ccyMoney(1234.5, 'GBP', 2)` → `£1,234.50`. CAD is identical to `money`. */
export const ccyMoney = (n: number, ccy: keyof typeof CURRENCY_SYMBOL = 'CAD', d = 0) => (n < 0 ? '−' : '') + CURRENCY_SYMBOL[ccy] + fmt(n, d);
export const gbp = (n: number, d = 2) => ccyMoney(n, 'GBP', d);
export const eur = (n: number, d = 2) => ccyMoney(n, 'EUR', d);
/** Fixed-point decimal string (custody `Dec`) formatted without float rounding of the digits shown. */
export const decMoney = (dec: string, ccy: keyof typeof CURRENCY_SYMBOL = 'GBP', d = 2) => {
  const m = /^(-)?(\d+)(?:\.(\d*))?$/.exec(dec.trim());
  if (!m) return dec;
  const frac = (m[3] ?? '').padEnd(d, '0');
  let units = BigInt(m[2] + frac.slice(0, d));
  if (frac.length > d && +frac[d] >= 5) units += 1n;
  const s = units.toString().padStart(d + 1, '0');
  const int = BigInt(s.slice(0, s.length - d)).toLocaleString('en-CA');
  return (m[1] && units !== 0n ? '−' : '') + CURRENCY_SYMBOL[ccy] + int + (d ? '.' + s.slice(s.length - d) : '');
};
/** GBP total of custody decimals (e.g. statement lines), formatted. */
export const gbpTotal = (values: (string | null)[], d = 2) => {
  let t = 0n;
  for (const v of values) if (v) { const [i, f = ''] = v.replace('-', '').split('.'); const u = BigInt(i + f.padEnd(8, '0').slice(0, 8)); t += v.startsWith('-') ? -u : u; }
  const neg = t < 0n, a = neg ? -t : t;
  return decMoney(`${neg ? '-' : ''}${a / 100000000n}.${(a % 100000000n).toString().padStart(8, '0')}`, 'GBP', d);
};
