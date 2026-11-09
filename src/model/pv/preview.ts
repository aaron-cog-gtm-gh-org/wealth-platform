import type { PvAdminStats, PvUser } from '../../api/pv-types';
import type { PvPositionCheckData } from './position-check';

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

const WEEKLY_STATEMENTS = ['2026-10-09', '2026-10-02', '2026-09-25', '2026-09-18', '2026-09-11', '2026-09-04', '2026-08-28', '2026-08-21', '2026-08-14',
  '2026-08-07', '2026-07-31', '2026-07-24', '2026-07-17', '2026-07-10', '2026-07-03', '2026-06-26', '2026-06-19', '2026-06-12', '2026-06-05',
  '2026-05-29', '2026-05-22', '2026-05-15', '2026-05-08', '2026-05-01', '2026-04-24', '2026-04-17'];

/** Deterministic synthetic Position check (spec 006): the seeded 01028-01 break on 26-JUN-2026 with its OPEN RECON_NOTE. */
export const PREVIEW_POSITION_CHECK: PvPositionCheckData = {
  accounts: [
    { acctId: 2001, acctNo: '01001-01', clientName: 'The Penhaligon Family Trust' },
    { acctId: 2002, acctNo: '01001-02', clientName: 'The Penhaligon Family Trust' },
    { acctId: 2038, acctNo: '01028-01', clientName: 'Miss M Whitlock' },
    { acctId: 2074, acctNo: '01040-05', clientName: 'Mr N Oyelaran' },
    { acctId: 2125, acctNo: '01068-02', clientName: 'Mrs R Szabo' },
    { acctId: 2129, acctNo: '01072-01', clientName: 'Mr E Marchetti' },
  ],
  acctId: 2038,
  dates: WEEKLY_STATEMENTS,
  allDates: WEEKLY_STATEMENTS,
  check: {
    acctId: 2038, stmtDate: '2026-06-26', prevStmtDate: '2026-06-19', noPrevMessage: null, statementFile: 'MT535_16558_20260626_003.txt',
    rows: [{
      isin: 'GB00ZZ003373', instrument: 'Foxley Telecom PLC Ord', prevQty: '0', netSettled: '1250', expected: '1250', stmtQty: '0', diff: '-1250',
      status: 'OPEN', note: 'custodian resent statement for this date, qty looks short vs contract note. raised with KSS',
      updatedBy: 'LBRENNAN', updatedDt: '2026-06-30T09:41:00.000',
    }],
  },
  all: null,
};
