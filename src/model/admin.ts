import type { PvAdminStats } from '../api/pv-types';
import { GREEN, INK, RED, fmt, pill } from '../format';
import type { SetUiState, UiState } from '../types';

/** WebUtil.FmtDt (Q14: Admin keeps dd/MM/yyyy). `2026-11-09T08:03:19` → `09/11/2026`. */
export const ukDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

/** Admin.aspx `LAST_LOGIN`: FmtDt + " " + HH:mm, from the DB's naive local timestamp. Null → "" as FmtDt. */
export const ukDateTimeMinutes = (local: string | null) => (local ? `${ukDate(local)} ${local.slice(11, 16)}` : '');

/** Admin.aspx `lblLoaded`: FmtDt(LoadedAt) + " " + HH:mm:ss, shown in Toronto time (the API reports UTC). */
export function ukLoadedAt(isoUtc: string | null, timeZone = 'America/Toronto') {
  if (!isoUtc) return 'Not loaded';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(isoUtc)).map(p => [p.type, p.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

const ROLE_PILL = { ADMIN: 'info', OPS: 'warn', ADVISER: 'mute' } as const;

/** Admin.aspx(.cs): archive status, reload, user grid. `run` performs the API reload and replaces the slice. */
export function buildAdmin(stats: PvAdminStats, st: UiState, setState: SetUiState, run: (op: 'reloadArchive') => Promise<void>) {
  const a = stats.archive;
  const n = (v: number) => fmt(v);
  const loaded = ukLoadedAt(a.loadedAt);
  const confirmReload = () => {
    setState({ adminConfirm: false, adminBusy: true, adminNotice: null });
    run('reloadArchive').then(
      () => setState({ adminBusy: false, adminNotice: 'Archive reloaded.' }),
      () => setState({ adminBusy: false }),
    );
  };
  return {
    kpis: [
      { k: 'MT535 files', v: n(a.mt535Count), sub: `${n(a.statementAccounts)} statement accounts`, color: INK },
      { k: 'MT54x files', v: n(a.mt54xCount), sub: `${n(a.confirmFolders)} confirmation folders`, color: INK },
      { k: 'Statements', v: n(a.statements), sub: 'MT535 by account and date', color: INK },
      { k: 'Confirmations', v: n(a.confirms), sub: 'MT54x by account', color: INK },
      { k: 'Parse errors', v: n(a.parseErrors), sub: a.parseErrors ? 'Files skipped at load' : 'All files parsed', color: a.parseErrors ? RED : GREEN },
      { k: 'Load time', v: `${a.loadMs} ms`, sub: `Last loaded ${loaded}`, color: INK },
    ],
    fields: [
      ['Last loaded', loaded], ['Load time', `${a.loadMs} ms`], ['Statement accounts', n(a.statementAccounts)], ['Confirmation folders', n(a.confirmFolders)],
    ].map(([k, v]) => ({ k, v })),
    errorTitle: `Parse errors (${n(a.parseErrors)})`,
    errors: a.parseErrorLog.map(e => ({ path: e.path, message: e.message })),
    noErrors: a.parseErrorLog.length === 0,
    usersTitle: `Users (${stats.users.length})`,
    users: stats.users.map(u => {
      const [rbg, rfg] = pill(ROLE_PILL[u.role as keyof typeof ROLE_PILL] ?? 'mute');
      const [abg, afg] = pill(u.activeFlg === 'Y' ? 'ok' : 'mute');
      return { username: u.username, name: u.fullName ?? '', role: u.role, roleBg: rbg, roleFg: rfg, active: u.activeFlg, activeBg: abg, activeFg: afg, lastLogin: ukDateTimeMinutes(u.lastLoginDt) || '—' };
    }),
    reload: {
      confirm: st.adminConfirm,
      busy: st.adminBusy,
      notice: st.adminNotice,
      label: st.adminBusy ? 'Reloading…' : 'Reload archive',
      onAsk: () => { if (!st.adminBusy) setState({ adminConfirm: true, adminNotice: null }); },
      onCancel: () => setState({ adminConfirm: false }),
      onConfirm: confirmReload,
    },
  };
}

export type AdminView = ReturnType<typeof buildAdmin>;
