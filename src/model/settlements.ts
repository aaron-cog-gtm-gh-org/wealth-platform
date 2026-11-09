import { PvApiError } from '../api/pv';
import type { IsoDate, PvAccount, PvSettlements } from '../api/pv-types';
import type { SetUiState, UiState } from '../types';
import { parseDateInput } from './pv/context';
import type { PvContextKey } from './pv/context';
import type { PvSliceDef } from './pv/slice';
import { PREVIEW_SETTLEMENTS, PREVIEW_SETTLEMENTS_ACCOUNT } from './pv/preview-settlements';

/** Settlements.aspx (spec 007): one account's MT54x confirmations, or the account picker (D-007-3). */
export type SettlementsData =
  | { kind: 'list'; account: PvAccount; settlements: PvSettlements }
  | { kind: 'pick'; accounts: PvAccount[]; notFound: number | null };

export const settlementsSlice: PvSliceDef<SettlementsData> = {
  needs: 'none',
  load: async (api, ctx) => {
    if (ctx.acct !== null) {
      try {
        const [account, settlements] = await Promise.all([api.account(ctx.acct), api.settlements(ctx.acct, { from: ctx.from, to: ctx.to })]);
        return { kind: 'list', account, settlements };
      } catch (e) {
        if (!(e instanceof PvApiError && e.status === 404)) throw e;
      }
    }
    return { kind: 'pick', accounts: (await api.accounts()).accounts, notFound: ctx.acct };
  },
  isEmpty: d => (d.kind === 'list' ? d.settlements.items.length === 0 : d.accounts.length === 0),
  preview: () => ({ kind: 'list', account: PREVIEW_SETTLEMENTS_ACCOUNT, settlements: PREVIEW_SETTLEMENTS }),
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** legacy DateUtil.FormatDate: `dd-MMM-yyyy` (Q14). */
export const fmtDate = (d: IsoDate) => `${d.slice(8, 10)}-${MONTHS[Number(d.slice(5, 7)) - 1]}-${d.slice(0, 4)}`;

/** `#,##0.<minDp..maxDp>` on a decimal string, rounding half away from zero (.NET ToString), no floats. */
export function fmtDecimal(raw: string, minDp: number, maxDp: number): string {
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(raw.trim());
  if (!m) return raw;
  let digits = (m[2] || '0') + (m[3] ?? '').padEnd(maxDp, '0').slice(0, maxDp);
  if (Number((m[3] ?? '')[maxDp] ?? '0') >= 5) {
    const a = digits.split('').map(Number);
    let i = a.length - 1;
    while (i >= 0 && a[i] === 9) a[i--] = 0;
    if (i < 0) a.unshift(1); else a[i]++;
    digits = a.join('');
  }
  const int = digits.slice(0, digits.length - maxDp).replace(/^0+(?=\d)/, '') || '0';
  let frac = digits.slice(digits.length - maxDp);
  while (frac.length > minDp && frac.endsWith('0')) frac = frac.slice(0, -1);
  const neg = m[1] && /[1-9]/.test(int + frac) ? '-' : '';
  return neg + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '');
}

/** legacy WebUtil.FmtQty `#,##0.####` / FmtMoney `#,##0.00` (Q14). */
export const fmtQty = (q: string) => fmtDecimal(q, 0, 4);
export const fmtMoney = (m: string) => fmtDecimal(m, 2, 2);

const dayCount = (from: IsoDate, to: IsoDate) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;

export const DATE_FORMAT_MSG = 'Enter dates as yyyy-mm-dd.';

type SetPvContext = (patch: Partial<Record<PvContextKey, string | null>>) => void;

export function buildSettlements(d: SettlementsData, st: UiState, setState: SetUiState, setPvContext: SetPvContext | undefined) {
  if (d.kind === 'pick') {
    return {
      kind: 'pick' as const,
      notice: d.notFound !== null ? `Account ${d.notFound} was not found.` : null,
      title: `Choose a custody account (${d.accounts.length})`,
      accounts: d.accounts.map(a => ({
        acctId: a.acctId, acctNo: a.acctNo, client: a.clientName, type: (a.acctType ?? '').trim(), safeCode: a.safeCode ?? '', ccy: a.baseCcy,
        status: a.statusCd === 'O' ? 'Open' : a.statusCd === 'C' ? 'Closed' : a.statusCd,
        onClick: () => { setState({ stlFrom: null, stlTo: null, stlMsg: null }); setPvContext?.({ acct: String(a.acctId), stmt: null, from: null, to: null }); },
      })),
      header: null, range: null, kpis: [], rows: [],
    };
  }
  const { account: a, settlements: s } = d;
  const items = s.items;
  const rec = items.filter(i => i.direction === 'REC').length;
  const days = dayCount(s.from, s.to);
  return {
    kind: 'list' as const,
    notice: null,
    title: `Settlement confirmations (${items.length})`,
    accounts: [],
    header: [
      { k: 'Acct No', v: a.acctNo },
      { k: 'Client', v: a.clientName },
      { k: 'Safe Code', v: a.safeCode ?? '' },
      { k: 'Account type', v: (a.acctType ?? '').trim() },
      { k: 'Base ccy', v: a.baseCcy },
    ],
    range: {
      from: st.stlFrom ?? s.from,
      to: st.stlTo ?? s.to,
      label: `${fmtDate(s.from)} – ${fmtDate(s.to)}`,
      msg: st.stlMsg,
      onFrom: (v: string) => setState({ stlFrom: v, stlMsg: null }),
      onTo: (v: string) => setState({ stlTo: v, stlMsg: null }),
      onShow: () => {
        const from = parseDateInput(st.stlFrom ?? s.from), to = parseDateInput(st.stlTo ?? s.to);
        if (!from || !to) { setState({ stlMsg: DATE_FORMAT_MSG }); return; }
        setState({ stlFrom: null, stlTo: null, stlMsg: null });
        setPvContext?.({ from, to });
      },
    },
    kpis: [
      { k: 'Confirmations', v: String(items.length), sub: 'Cancelled pairs removed' },
      { k: 'Receipts (REC)', v: String(rec), sub: 'MT544 / MT545' },
      { k: 'Deliveries (DEL)', v: String(items.length - rec), sub: 'MT546 / MT547' },
      { k: 'Window', v: `${days} day${days === 1 ? '' : 's'}`, sub: `${fmtDate(s.from)} – ${fmtDate(s.to)}` },
      { k: 'Custody account', v: s.custAcct, sub: 'Safe code padded to 7 digits' },
    ],
    rows: items.map((i, n) => ({
      key: `${i.filePath ?? ''}#${n}`,
      trade: fmtDate(i.tradeDate),
      settle: fmtDate(i.settleDate),
      msg: `MT${i.mtType}`,
      dir: i.direction,
      dirBg: i.direction === 'REC' ? '#e3f4ea' : '#e6eef8',
      dirFg: i.direction === 'REC' ? '#00703f' : '#00498a',
      isin: i.isin ?? '',
      instrument: i.instrumentName,
      qty: fmtQty(i.qty),
      amount: fmtMoney(i.amount),
      amountWarn: i.amountError ? `Amount ${i.amountRaw ?? ''} could not be read: ${i.amountError}` : null,
      ccy: i.ccy ?? '',
      seme: i.seme ?? '',
      source: i.filePath ?? '',
    })),
  };
}

export type SettlementsModel = ReturnType<typeof buildSettlements>;
