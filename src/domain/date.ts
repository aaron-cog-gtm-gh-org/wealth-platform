// Calendar dates without time zone, as ISO `YYYY-MM-DD` strings. Legacy DateTime
// values in PV.Core are always dates (time 00:00); DateTime.MinValue is `0001-01-01`.

export type IsoDate = string;
export const MIN_DATE: IsoDate = '0001-01-01';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysIn = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

export function makeDate(y: number, m: number, d: number): IsoDate | null {
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const isIsoDate = (s: string): s is IsoDate =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && makeDate(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)) === s;

const parts = (d: IsoDate) => [+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)] as const;

// legacy: DateTime.ParseExact(s, "yyyyMMdd", InvariantCulture) - throws on bad input
export function parseYmd(s: string): IsoDate {
  const t = s.trim();
  const d = /^\d{8}$/.test(t) ? makeDate(+t.slice(0, 4), +t.slice(4, 6), +t.slice(6, 8)) : null;
  if (!d) throw new Error(`String '${s}' was not recognized as a valid DateTime.`);
  return d;
}

// legacy: DateTime.TryParseExact(s, "yyyyMMdd", ...) - null instead of false
export function tryParseYmd(s: string): IsoDate | null {
  try { return parseYmd(s); } catch { return null; }
}

export const toYmd = (d: IsoDate) => d.replace(/-/g, '');

// legacy: DateTime.AddDays
export function addDays(d: IsoDate, days: number): IsoDate {
  const [y, m, day] = parts(d);
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, day + days);
  const out = makeDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  if (!out) throw new RangeError('The added or subtracted value results in an un-representable DateTime.');
  return out;
}

/** ISO dates compare correctly as strings. */
export const compareDates = (a: IsoDate, b: IsoDate) => (a < b ? -1 : a > b ? 1 : 0);

// legacy: PV.Core.DateUtil.FormatDate - dd-MMM-yyyy upper case (Q14)
export function formatDate(d: IsoDate): string {
  const [y, m, day] = parts(d);
  return `${String(day).padStart(2, '0')}-${MONTHS[m - 1]}-${String(y).padStart(4, '0')}`;
}
