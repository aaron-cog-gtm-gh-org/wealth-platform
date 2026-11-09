import { PvApiError } from '../api/pv';
import type { IsoDate, PvAccount, PvHoldings } from '../api/pv-types';
import { GREEN, INK, MUTE } from '../format';
import type { PvContext } from './pv/context';
import { PREVIEW_HOLDINGS, PREVIEW_HOLDINGS_ACCOUNT, PREVIEW_HOLDINGS_DATES } from './pv/preview-holdings';
import type { PvSliceDef } from './pv/slice';

// Display helpers ported from PV.Web WebUtil / PV.Core DateUtil (Q14). Decimal strings from the API are
// formatted exactly (bigint), rounding half away from zero like .NET custom numeric formats.

const parseDec = (s: string | null | undefined) => {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec((s ?? '').trim());
  if (!m) return { units: 0n, scale: 0 };
  const frac = m[3] ?? '';
  const u = BigInt(m[2] + frac);
  return { units: m[1] ? -u : u, scale: frac.length };
};

const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function fmtDecimal(s: string | null | undefined, minFrac: number, maxFrac: number): string {
  let { units, scale } = parseDec(s);
  if (scale > maxFrac) {
    const div = 10n ** BigInt(scale - maxFrac), abs = units < 0n ? -units : units;
    const q = abs / div + (2n * (abs % div) >= div ? 1n : 0n);
    units = units < 0n ? -q : q;
    scale = maxFrac;
  }
  const digits = (units < 0n ? -units : units).toString().padStart(scale + 1, '0');
  const int = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale).replace(/0+$/, '').padEnd(minFrac, '0');
  return (units < 0n ? '-' : '') + group(int) + (frac ? '.' + frac : '');
}

/** legacy: WebUtil.FmtQty `#,##0.####` */
export const fmtQty = (s: string | null | undefined) => fmtDecimal(s, 0, 4);
/** legacy: WebUtil.FmtPx `#,##0.0000` */
export const fmtPx = (s: string | null | undefined) => fmtDecimal(s, 4, 4);
/** legacy: WebUtil.FmtMoney `#,##0.00` */
export const fmtMoney = (s: string | null | undefined) => fmtDecimal(s, 2, 2);

/** Exact sum of decimal strings (legacy `decimal total += l.MktValGbp`). */
export function sumDecimals(values: (string | null | undefined)[]): string {
  const parts = values.map(parseDec);
  const scale = Math.max(0, ...parts.map(p => p.scale));
  const units = parts.reduce((t, p) => t + p.units * 10n ** BigInt(scale - p.scale), 0n);
  const digits = (units < 0n ? -units : units).toString().padStart(scale + 1, '0');
  const int = digits.slice(0, digits.length - scale), frac = digits.slice(digits.length - scale);
  return (units < 0n ? '-' : '') + int + (frac ? '.' + frac : '');
}

const isZero = (s: string | null | undefined) => parseDec(s).units === 0n;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** legacy: DateUtil.FormatDate `dd-MMM-yyyy` upper case. `2026-10-09` → `09-OCT-2026` */
export const fmtStmtDate = (iso: IsoDate) => `${iso.slice(8, 10)}-${MONTHS[Number(iso.slice(5, 7)) - 1]}-${iso.slice(0, 4)}`;

/** Holdings.aspx data for one account and statement date, loaded through /api/pv only. */
export interface PvHoldingsSlice {
  acct: number;
  /** `?stmt=`; null → latest statement. */
  requested: IsoDate | null;
  /** Null when the API answers 404 (legacy redirected to ClientSearch.aspx; D-005-2). */
  account: PvAccount | null;
  dates: IsoDate[];
  holdings: PvHoldings | null;
}

export const MSG_NO_STATEMENT = 'No statement on file for this date.';
export const MSG_NO_HOLDINGS = 'No holdings on statement.';

const accountLabel = (d: PvHoldingsSlice | null, ctx: PvContext | null) =>
  d?.account ? `${d.account.acctNo} · ${d.account.clientName}` : `Account ${d?.acct ?? ctx?.acct ?? ''}`.trim();

/** legacy: Holdings.aspx Page_Load. Registered as `PV_SLICES.portfolio`; needs `?acct=`. */
export const holdingsSlice: PvSliceDef<PvHoldingsSlice> = {
  needs: 'acct',
  async load(api, ctx) {
    const acct = ctx.acct as number;
    const base = { acct, requested: ctx.stmt };
    let account: PvAccount;
    try {
      account = await api.account(acct);
    } catch (e) {
      if (e instanceof PvApiError && e.status === 404) return { ...base, account: null, dates: [], holdings: null };
      throw e;
    }
    const [{ dates }, holdings] = await Promise.all([api.statementDates(acct), api.holdings(acct, ctx.stmt ?? undefined)]);
    return { ...base, account, dates, holdings };
  },
  isEmpty: d => !d.account || d.dates.length === 0,
  preview: () => ({ acct: PREVIEW_HOLDINGS_ACCOUNT.acctId, requested: null, account: PREVIEW_HOLDINGS_ACCOUNT, dates: PREVIEW_HOLDINGS_DATES, holdings: PREVIEW_HOLDINGS }),
  copy: (d, ctx) => ({
    meta: [
      `Portfolio Viewer / Custody holdings / ${accountLabel(d, ctx)}`,
      'Portfolio detail',
      d?.account ? `MT535 statement of holdings · safe code ${d.account.safeCode ?? '—'} · values in statement currency and GBP` : 'MT535 statement of holdings · values in statement currency and GBP',
    ],
    loading: 'Loading custody holdings…',
    empty: d && !d.account
      ? ['Custody account not found', `No Portfolio Viewer account has ID ${d.acct}. Check the account in Client search, or open it from the client summary.`, 'Search clients']
      : ['No statement on file', `${d?.account ? `Account ${d.account.acctNo}` : 'This account'} has no MT535 statements of holdings in the custody archive. Holdings appear here once the custodian’s first statement is indexed.`, 'Search clients'],
    error: ['Couldn’t load custody holdings', 'The Portfolio Viewer service did not return the account or its statement of holdings. No figures are shown rather than a partial statement. Retry, or check the service health page.', 'Open health check'],
  }),
};

/** Holdings.aspx(.cs) view: header labels, statement-date picker, grid and GBP total. */
export function buildPvHoldings(d: PvHoldingsSlice, onStmt?: (stmt: IsoDate) => void) {
  const a = d.account;
  const h = d.holdings;
  const st = h?.statement ?? null;
  const selected = st?.statementDate ?? h?.stmtDate ?? d.requested ?? d.dates[0] ?? '';
  const onFile = d.dates.includes(selected);
  const lines = st ? h?.lines ?? [] : [];
  const message = !st ? MSG_NO_STATEMENT : lines.length === 0 ? MSG_NO_HOLDINGS : null;
  const total = sumDecimals(lines.map(l => l.mktValGbp));
  const nonGbp = lines.filter(l => l.ccy !== 'GBP');
  const noGbpHold = nonGbp.filter(l => isZero(l.mktValGbp)).length;
  const ccys = [...new Set(lines.map(l => l.ccy ?? '—'))];
  const dash = '—';
  return {
    fields: ([['Acct No', a?.acctNo], ['Client', a?.clientName], ['Safe Code', a?.safeCode], ['Account type', a?.acctType], ['Base ccy', a?.baseCcy]] as [string, string | null | undefined][])
      .map(([k, v]) => ({ k, v: v || dash })),
    picker: {
      value: selected,
      options: [
        ...(selected && !onFile ? [{ value: selected, label: `${fmtStmtDate(selected)} (not on file)` }] : []),
        ...d.dates.map(v => ({ value: v, label: fmtStmtDate(v) })),
      ],
      note: d.dates.length ? (selected === d.dates[0] ? `Latest of ${d.dates.length} statements` : `${d.dates.length} statements on file`) : 'No statements on file',
      onChange: (v: string) => { if (v && v !== selected) onStmt?.(v); },
    },
    statement: st ? { date: fmtStmtDate(st.statementDate), fn: st.function ?? dash, file: st.fileName ?? dash, seq: st.fileSeq } : null,
    message,
    kpis: [
      { k: 'Total mkt val (GBP)', v: st ? fmtMoney(total) : dash, sub: st ? `Sum of ${lines.length} line${lines.length === 1 ? '' : 's'} · GBP 19A::HOLD`  : MSG_NO_STATEMENT, color: INK, src: st ? `Sum of Mkt Val (GBP) over ${lines.length} lines of ${st.fileName ?? 'the statement'}` : '' },
      { k: 'Holdings', v: st ? String(lines.length) : dash, sub: st ? (lines.length ? ccys.join(' · ') : MSG_NO_HOLDINGS) : dash, color: INK, src: '' },
      { k: 'Non-GBP lines', v: st ? String(nonGbp.length) : dash, sub: !st ? dash : noGbpHold ? `${noGbpHold} without a GBP value` : nonGbp.length ? 'All valued in GBP' : 'All lines in GBP', color: noGbpHold ? '#b86a00' : INK, src: '' },
      { k: 'Statement', v: st ? fmtStmtDate(st.statementDate) : selected ? fmtStmtDate(selected) : dash, sub: st ? `${st.function ?? dash} · seq ${String(st.fileSeq).padStart(3, '0')}` : 'Not on file', color: st ? (st.statementDate === d.dates[0] ? GREEN : INK) : MUTE, src: st?.fileName ?? '' },
    ],
    title: st ? `${lines.length} line${lines.length === 1 ? '' : 's'} · statement ${fmtStmtDate(st.statementDate)}` : `statement ${selected ? fmtStmtDate(selected) : dash}`,
    rows: lines.map(l => {
      const gbpLine = l.ccy === 'GBP';
      return {
        isin: l.isin ?? '',
        instrument: l.instrumentName,
        unknown: l.instrumentName.startsWith('UNKNOWN INSTRUMENT'),
        qty: fmtQty(l.qty),
        qtyType: l.qtyType ?? '',
        px: fmtPx(l.price),
        ccy: l.ccy ?? '',
        mv: fmtMoney(l.mktVal),
        mvGbp: fmtMoney(l.mktValGbp),
        gbpSrc: gbpLine ? 'GBP 19A::HOLD' : isZero(l.mktValGbp) ? `No GBP 19A::HOLD on the statement · ${l.ccy ?? ''} line valued at 0 in GBP` : `GBP 19A::HOLD on the statement (${l.ccy ?? ''} line)`,
        gbpColor: !gbpLine && isZero(l.mktValGbp) ? '#b86a00' : INK,
      };
    }),
    total: fmtMoney(total),
    totalSrc: st ? `Sum of ${lines.length} Mkt Val (GBP) values · ${st.fileName ?? ''}` : '',
  };
}

export type PvHoldingsView = ReturnType<typeof buildPvHoldings>;
