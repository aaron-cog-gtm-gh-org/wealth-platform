import type { PvAdminStats, PvClientSearchRow, PvClientSummary, PvUser } from '../../api/pv-types';

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

const searchRow = (clientId: number, clientRef: string, clientName: string, adviser: [string, string] | null, acctCount: number): PvClientSearchRow =>
  ({ clientId, clientRef, clientName, statusCd: 'A', adviserUsername: adviser?.[0] ?? null, adviserName: adviser?.[1] ?? null, acctCount });
const JSMITH: [string, string] = ['JSMITH', 'James Smith'];

/** Client search preview (spec 008): a blank search over the seeded custody clients, first 12 by name. */
export const PREVIEW_CLIENT_SEARCH: { query: string | null; clients: PvClientSearchRow[] } = {
  query: '',
  clients: [
    searchRow(1029, 'PV1550', 'Dr B Yeoman', JSMITH, 1),
    searchRow(1021, 'C2017-0038', 'Dr H Northcott', ['DHOLT', 'Diane Holt'], 3),
    searchRow(1062, 'C2019-0302', 'Dr J Wetherall', JSMITH, 1),
    searchRow(1018, 'C2017-0172', 'Dr R Zaleski', JSMITH, 2),
    searchRow(1063, 'C2017-0306', 'Dr T Okonjo', JSMITH, 2),
    searchRow(1039, 'PV1815', 'Dr W Vickery', ['RMCKAY', 'Robert McKay'], 3),
    searchRow(1053, 'PV1482', 'Iqbal Holdings Ltd', JSMITH, 2),
    searchRow(1005, 'PV3908', 'Miss D Mcintyre', JSMITH, 2),
    searchRow(1034, 'PV1190', 'Miss F Varga', JSMITH, 4),
    searchRow(1054, 'PV1673', 'Miss G Kilbride', JSMITH, 1),
    searchRow(1031, 'C2019-0248', 'Miss H Elphick', JSMITH, 4),
    searchRow(1044, 'C2018-0013', 'Miss M Juniper', null, 4),
  ],
};

/** Client summary preview (spec 008): seeded client 1001 with its latest (09-Oct-2026) MT535 values. */
export const PREVIEW_CLIENT_SUMMARY: PvClientSummary = {
  clientId: 1001, clientRef: 'C2017-0124', clientName: 'The Penhaligon Family Trust', statusCd: 'A', createdDt: '2017-06-15',
  adviserUsername: 'JSMITH', adviserName: 'James Smith',
  accounts: [
    { acctId: 2001, acctNo: '01001-01', clientId: 1001, clientName: 'The Penhaligon Family Trust', acctType: 'SIPP', baseCcy: 'GBP', safeCode: '16598', openDt: '2019-06-10', closeDt: null, statusCd: 'O', stmtDate: '2026-10-09', mktValGbp: '283880.39' },
    { acctId: 2002, acctNo: '01001-02', clientId: 1001, clientName: 'The Penhaligon Family Trust', acctType: 'S&S ISA', baseCcy: 'GBP', safeCode: '15169', openDt: '2018-04-22', closeDt: null, statusCd: 'O', stmtDate: '2026-10-09', mktValGbp: '76295.23' },
  ],
  totalMktValGbp: '360175.62',
};
