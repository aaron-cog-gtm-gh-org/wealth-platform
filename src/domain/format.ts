// legacy: PV.Web/App_Code/WebUtil.cs display helpers (Q14). .NET custom numeric
// formats round half away from zero; negative values that round to zero print without sign (.NET Framework).
import { Decimal } from './decimal';
import { makeDate, type IsoDate } from './date';

const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function formatNumber(d: Decimal, minFrac: number, maxFrac: number): string {
  const r = d.round(maxFrac, 'awayFromZero');
  const neg = r.isNegative();
  const [int, frac = ''] = (neg ? r.neg() : r).toString().split('.');
  const f = frac.padEnd(minFrac, '0');
  return (neg ? '-' : '') + group(int) + (f ? '.' + f : '');
}

/** legacy: WebUtil.FmtQty - `#,##0.####` */
export const fmtQty = (q: Decimal) => formatNumber(q, 0, 4);
/** legacy: WebUtil.FmtPx - `#,##0.0000` */
export const fmtPx = (p: Decimal) => formatNumber(p, 4, 4);
/** legacy: WebUtil.FmtMoney - `#,##0.00` */
export const fmtMoney = (m: Decimal) => formatNumber(m, 2, 2);

/** legacy: WebUtil.FmtDt - `dd/MM/yyyy`, '' for null */
export const fmtUkDate = (d: IsoDate | null | undefined) =>
  d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '';

/** legacy: WebUtil.TryParseUkDate - exact `dd/MM/yyyy` after Trim(); null when invalid */
export function parseUkDate(s: string): IsoDate | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  return m ? makeDate(+m[3], +m[2], +m[1]) : null;
}

/** legacy: WebUtil.StatusText - account status code to label */
export function statusText(cd: string | null): string | null {
  switch (cd) {
    case 'A': return 'Active';
    case 'D': return 'Dormant';
    case 'C': return 'Closed';
    default: return cd;
  }
}
