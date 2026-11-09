// PositionCheck.aspx(.cs) → `exceptions` with PV context (spec 006). Data comes only from /api/pv.
import type { IsoDate, PvCheckAll, PvPositionCheck, PvSaveNote } from '../../api/pv-types';
import { dayMonthYear, pill } from '../../format';
import type { PillKind } from '../../format';
import type { Screen, SetUiState, UiState } from '../../types';
import { ukDate } from '../admin';
import type { PvContext, PvContextPatch } from './context';
import { PREVIEW_POSITION_CHECK } from './preview';
import type { PvApi, PvOp, PvSliceDef } from './slice';

export interface PvPositionCheckAccount { acctId: number; acctNo: string; clientName: string }

/** Everything the page shows for one URL context: the two pickers, and the grid that was run (if any). */
export interface PvPositionCheckData {
  accounts: PvPositionCheckAccount[];
  /** Selected account: `?acct=` when it exists, else the first account (legacy ddlAcct default). */
  acctId: number | null;
  /** Selected account's statement dates, newest first (FillDates). */
  dates: IsoDate[];
  /** Every statement date in the archive, newest first (ddlAllDate). */
  allDates: IsoDate[];
  check: PvPositionCheck | null;
  all: PvCheckAll | null;
}

/** ddlStatus items (PositionCheck.aspx). */
export const EDIT_STATUSES = ['OPEN', 'CHASED', 'RESOLVED', 'WRITEOFF'] as const;
export const POSITION_CHECK_MESSAGES = {
  pick: 'Pick an account and a statement date.',
  noDiffs: 'No differences.',
  noStatements: 'No statements on file for that date.',
  saved: 'Notes saved.',
  saveFailed: 'The note was not saved. Nothing was changed; try again.',
} as const;

/** PositionCheck.aspx is reached with `?pc=1`, an account (`?acct=`) or a Check All date (`?all=`). */
export const isPositionCheckContext = (ctx: PvContext) => ctx.pc || ctx.acct !== null || ctx.all !== null;

/** Page_Load: account/date lists, then Check All (`?all=`) or the deep-linked run (`?stmt=` in the account's dates). */
export async function loadPositionCheck(api: PvApi, ctx: PvContext): Promise<PvPositionCheckData> {
  const [{ accounts }, { dates: allDates }] = await Promise.all([api.accounts(), api.positionCheckDates()]);
  const sel = accounts.find(a => a.acctId === ctx.acct) ?? accounts[0] ?? null;
  const dates = sel ? (await api.statementDates(sel.acctId)).dates : [];
  const all = ctx.all ? await api.checkAll(ctx.all) : null;
  const run = !all && sel && ctx.stmt && dates.includes(ctx.stmt) ? ctx.stmt : null;
  const check = sel && run ? await api.positionCheck(sel.acctId, run) : null;
  return { accounts: accounts.map(a => ({ acctId: a.acctId, acctNo: a.acctNo, clientName: a.clientName })), acctId: sel?.acctId ?? null, dates, allDates, check, all };
}

export const positionCheckSlice: PvSliceDef<PvPositionCheckData> = {
  needs: 'none',
  active: isPositionCheckContext,
  load: loadPositionCheck,
  isEmpty: d => d.accounts.length === 0 || d.allDates.length === 0,
  preview: () => PREVIEW_POSITION_CHECK,
};

/** gv_RowUpdating: save (update-else-insert on the server), then rebind the same check. */
export async function saveReconNote(api: PvApi, current: PvPositionCheckData | null, op: Exclude<PvOp, 'reloadArchive'>): Promise<PvPositionCheckData> {
  await api.saveNote(op.acctId, op.note);
  const check = await api.positionCheck(op.acctId, op.note.stmtDate);
  if (!current) throw new Error('No position check loaded.');
  return { ...current, check };
}

/** WebUtil.FmtQty: decimal.ToString("#,##0.####") on the API's decimal strings (no float rounding). */
export function fmtQty(v: string): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) return v;
  const [, sign, int, frac = ''] = m;
  let scaled = BigInt(int + frac.slice(0, 4).padEnd(4, '0'));
  if (frac.length > 4 && Number(frac[4]) >= 5) scaled += 1n;
  if (scaled === 0n) return '0';
  const whole = (scaled / 10000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dec = (scaled % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
  return `${sign}${whole}${dec ? '.' + dec : ''}`;
}

/** DateUtil.FormatDate (Q14): dd-MMM-yyyy upper-case. */
export const pvDate = (iso: IsoDate) => dayMonthYear(iso).toUpperCase();

/** Status is RECON_NOTE.STATUS verbatim (Q12 mixed values); only the pill colour is derived. */
const STATUS_PILL: Record<string, PillKind> = { NEW: 'bad', OPEN: 'warn', CHASED: 'info', RESOLVED: 'ok', WRITEOFF: 'mute' };
export const statusPill = (status: string) => pill(STATUS_PILL[status] ?? 'mute');

const RESET: Partial<UiState> = { pcDate: null, pcAllDate: null, pcEdit: null, pcBusy: false, pcNotice: null, pcError: null };

export function buildPositionCheck(d: PvPositionCheckData, st: UiState, setState: SetUiState, run: (op: PvOp) => Promise<void>, goPv: (s: Screen, patch?: PvContextPatch) => void) {
  const acct = d.accounts.find(a => a.acctId === d.acctId) ?? null;
  const go = (patch: PvContextPatch) => { setState(RESET); goPv('exceptions', { pc: '1', ...patch }); };
  const date = st.pcDate ?? d.check?.stmtDate ?? d.dates[0] ?? '';
  const allDate = st.pcAllDate ?? d.all?.stmtDate ?? d.allDates[0] ?? '';
  const c = d.all ? null : d.check;
  const showRows = !!c && c.noPrevMessage === null;

  const message = st.pcNotice
    ?? (d.all ? (d.all.rows.length === 0 ? POSITION_CHECK_MESSAGES.noStatements : null)
      : c ? (c.noPrevMessage ?? (c.rows.length === 0 ? POSITION_CHECK_MESSAGES.noDiffs : null)) : null);

  const save = (isin: string) => {
    if (!c || d.acctId === null || st.pcBusy) return;
    const note: PvSaveNote = { isin, stmtDate: c.stmtDate, status: st.pcEditStatus, note: st.pcEditNote === '' ? null : st.pcEditNote };
    setState({ pcBusy: true, pcError: null });
    run({ kind: 'saveReconNote', acctId: d.acctId, note }).then(
      () => setState({ pcBusy: false, pcEdit: null, pcNotice: POSITION_CHECK_MESSAGES.saved }),
      () => setState({ pcBusy: false, pcError: POSITION_CHECK_MESSAGES.saveFailed }),
    );
  };

  const rows = showRows ? c!.rows.map(r => {
    const [bg, fg] = statusPill(r.status);
    const editing = st.pcEdit === r.isin;
    return {
      isin: r.isin, instrument: r.instrument,
      prevQty: fmtQty(r.prevQty), netSettled: fmtQty(r.netSettled), expected: fmtQty(r.expected), stmtQty: fmtQty(r.stmtQty),
      diff: fmtQty(r.diff), diffColor: r.diff.startsWith('-') ? '#b3201f' : '#00498a',
      status: r.status, statusBg: bg, statusFg: fg,
      note: r.note ?? '', updatedBy: r.updatedBy ?? '', updated: r.updatedDt ? ukDate(r.updatedDt) : '',
      editing,
      onEdit: () => { if (!st.pcBusy) setState({ pcEdit: r.isin, pcEditStatus: (EDIT_STATUSES as readonly string[]).includes(r.status) ? r.status : 'OPEN', pcEditNote: r.note ?? '', pcNotice: null, pcError: null }); },
      onCancel: () => setState({ pcEdit: null, pcError: null }),
      onSave: () => save(r.isin),
    };
  }) : [];

  const statuses = new Map<string, number>();
  for (const r of rows) statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
  const breaks = d.all ? d.all.rows.reduce((n, r) => n + (/^\d+$/.test(r.diffs) ? Number(r.diffs) : 0), 0) : rows.length;

  return {
    title: d.all ? `Check all accounts · ${pvDate(d.all.stmtDate)}` : c ? `Position check · ${acct?.acctNo ?? ''} · ${pvDate(c.stmtDate)}` : 'Position check',
    kpis: d.all ? [
      { k: 'Statement date', v: pvDate(d.all.stmtDate), sub: 'Check All Accounts', color: '#191919' },
      { k: 'Accounts checked', v: String(d.all.rows.length), sub: 'with a statement on that date', color: '#191919' },
      { k: 'Accounts with differences', v: String(d.all.rows.filter(r => /^\d+$/.test(r.diffs) && r.diffs !== '0').length), sub: `${breaks} difference${breaks === 1 ? '' : 's'} in total`, color: breaks ? '#b3201f' : '#00804a' },
      { k: 'No previous statement', v: String(d.all.rows.filter(r => r.diffs === '-').length), sub: 'shown as “-”', color: '#191919' },
    ] : [
      { k: 'Account', v: acct?.acctNo ?? '—', sub: acct?.clientName ?? 'No account selected', color: '#191919' },
      { k: 'Statement date', v: c ? pvDate(c.stmtDate) : '—', sub: c?.statementFile ?? (c ? 'No statement file' : 'Not run'), color: '#191919' },
      { k: 'Previous statement', v: c ? (c.prevStmtDate ? pvDate(c.prevStmtDate) : 'None on file') : '—', sub: c?.prevStmtDate ? 'settlements counted from the day after' : 'Opening position for the check', color: '#191919' },
      { k: 'Differences', v: c ? (showRows ? String(rows.length) : '-') : '—', sub: showRows ? ([...statuses].map(([s, n]) => `${n} ${s}`).join(' · ') || 'Expected agrees to statement') : 'Expected vs statement quantity', color: rows.length ? '#b3201f' : '#191919' },
    ],
    accountOptions: d.accounts.map(a => ({ value: String(a.acctId), label: `${a.acctNo} - ${a.clientName}` })),
    acctValue: d.acctId === null ? '' : String(d.acctId),
    dateOptions: d.dates.map(x => ({ value: x, label: pvDate(x) })),
    dateValue: date,
    allDateOptions: d.allDates.map(x => ({ value: x, label: pvDate(x) })),
    allDateValue: allDate,
    onAccount: (v: string) => go({ acct: v, stmt: null, all: null }),
    onDate: (v: string) => setState({ pcDate: v }),
    onRun: () => (d.acctId === null || !date ? setState({ ...RESET, pcNotice: POSITION_CHECK_MESSAGES.pick }) : go({ acct: String(d.acctId), stmt: date, all: null })),
    onAllDate: (v: string) => setState({ pcAllDate: v }),
    onCheckAll: () => { if (allDate) go({ all: allDate, stmt: null }); },
    message,
    messageKind: (st.pcNotice === POSITION_CHECK_MESSAGES.saved ? 'ok' : 'info') as 'ok' | 'info',
    error: st.pcError,
    showRows,
    rows,
    statusOptions: [...EDIT_STATUSES],
    editStatus: st.pcEditStatus,
    editNote: st.pcEditNote,
    onEditStatus: (v: string) => setState({ pcEditStatus: v }),
    onEditNote: (v: string) => setState({ pcEditNote: v }),
    busy: st.pcBusy,
    showAll: !!d.all && d.all.rows.length > 0,
    allRows: (d.all?.rows ?? []).map(r => ({
      acctNo: r.acctNo, client: r.client, diffs: r.diffs,
      diffsColor: r.diffs === '-' ? 'rgba(25,25,25,.56)' : r.diffs === '0' ? '#191919' : '#b3201f',
      onView: () => go({ acct: String(r.acctId), stmt: d.all!.stmtDate, all: null }),
    })),
  };
}

export type PositionCheckView = ReturnType<typeof buildPositionCheck>;
