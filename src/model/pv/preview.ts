import type { PvAdminStats, PvUser } from '../../api/pv-types';

/** Identity shown for `?state=Populated` previews without a session. Mirrors the seeded PVADMIN. */
export const PREVIEW_USER: PvUser = { userId: 1, username: 'PVADMIN', fullName: 'System Administrator', role: 'ADMIN' };

/** Deterministic synthetic Admin figures (same shape and user list as the seeded PV schema). */
export const PREVIEW_ADMIN_STATS: PvAdminStats = {
  archive: {
    mt535Count: 1184, mt54xCount: 2642, statements: 1184, confirms: 2642, parseErrors: 2,
    parseErrorLog: [
      { path: 'MT535/2026/09/18/PV3908_20260918_MT535.fin', message: 'Missing :20C::SEME reference in block 4' },
      { path: 'MT54x/C2018-0374/MT541_20260921_0042.fin', message: 'Unexpected end of message after :35B: tag' },
    ],
    loadedAt: '2026-11-09T14:47:12.000Z', loadMs: 1286, statementAccounts: 48, confirmFolders: 46,
  },
  users: [
    { userId: 3, username: 'DHOLT', fullName: 'Diane Holt', role: 'ADVISER', activeFlg: 'N', lastLoginDt: '2019-03-14T16:22:05.000' },
    { userId: 7, username: 'JSMITH', fullName: 'James Smith', role: 'ADVISER', activeFlg: 'Y', lastLoginDt: '2026-11-06T09:12:41.000' },
    { userId: 9, username: 'LBRENNAN', fullName: 'Lauren Brennan', role: 'OPS', activeFlg: 'Y', lastLoginDt: '2026-11-09T08:03:19.000' },
    { userId: 1, username: 'PVADMIN', fullName: 'System Administrator', role: 'ADMIN', activeFlg: 'Y', lastLoginDt: '2026-11-09T09:41:57.000' },
    { userId: 2, username: 'RMCKAY', fullName: 'Robert McKay', role: 'ADVISER', activeFlg: 'N', lastLoginDt: null },
    { userId: 4, username: 'TGARNER', fullName: 'Tom Garner', role: 'OPS', activeFlg: 'N', lastLoginDt: '2021-07-30T17:45:00.000' },
  ],
};
