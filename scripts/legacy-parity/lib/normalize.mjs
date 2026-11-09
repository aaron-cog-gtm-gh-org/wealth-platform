// Converts Portfolio Viewer display text into contract-shaped values (contracts/custody-api.md).

const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

export function text(s) {
  const t = (s ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

/** "1,234.5678" / "-12" -> number; "" / "-" -> null */
export function num(s) {
  const t = text(s);
  if (t === null || t === '-') return null;
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n)) throw new Error(`not a number: ${JSON.stringify(s)}`);
  return n;
}

/** "15-NOV-2018" (DateUtil.FormatDate), "15/11/2018" (WebUtil.FmtDt) or "20181115" -> "2018-11-15" */
export function isoDate(s) {
  const t = text(s);
  if (t === null) return null;
  let m = /^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(t.toUpperCase());
  if (m && MONTHS[m[2]]) return `${m[3]}-${MONTHS[m[2]]}-${m[1]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  throw new Error(`not a PV date: ${JSON.stringify(s)}`);
}

const LONDON_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

/** API ISO timestamp -> the Europe/London calendar date PV displays (PV shows recon-note "Updated" as a date only) */
export function londonDate(ts) {
  if (ts === null || ts === undefined) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) throw new Error(`not a timestamp: ${JSON.stringify(ts)}`);
  return LONDON_DATE.format(d);
}

export const compactDate = (iso) => iso.replace(/-/g, '');
/** ISO -> dd/MM/yyyy, the format PV's Settlements query string expects */
export const ukDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** "MT545" / "545" / 545 -> 545 */
export function mtType(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/^MT/i, ''));
  return Number.isInteger(n) ? n : null;
}
