// Screenshots every screen × data state of the app and the mockup, then pixel-diffs them.
// App-only screens (no mockup counterpart, e.g. Admin, Settlements) are checked by text assertions and against
// committed PNG baselines in scripts/visual-baselines/ instead.
// Usage: node scripts/visual-diff.mjs [screen[:state] | flow-name | flows | app ...]
// Env: APP_URL (default http://localhost:5173), MOCK_URL (mockup .dc.html served over http), CHROME (executable path), WIDTH, HEIGHT,
//      UPDATE_BASELINES=1 (rewrite app-only baselines), BASELINE_MAX (allowed app-only diff ratio, default 0.005).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const MOCK_URL = process.env.MOCK_URL ?? 'http://localhost:8090/RBC%20Wealth%20Platform.dc.html';
const CHROME = process.env.CHROME ?? 'C:/devin/chrome/chrome-win64/chrome.exe';
const WIDTH = Number(process.env.WIDTH ?? 1440);
const HEIGHT = Number(process.env.HEIGHT ?? 900);
const OUT = 'visual-diff-output';

const SCREENS = ['c360', 'portfolio', 'orders', 'alts', 'exceptions', 'home', 'activity', 'money'];
const STATES = ['Populated', 'Loading', 'Empty', 'Error'];

// Interaction flows replayed identically against the mockup and the app.
const FLOWS = [
  { name: 'flow-portfolio-filters', screen: 'portfolio', steps: [['click', 'Bonds 6'], ['click', '3Y']] },
  { name: 'flow-portfolio-since-inception', screen: 'portfolio', steps: [['click', 'Alternatives 2'], ['click', 'Since inception']] },
  { name: 'flow-orders-exclude', screen: 'orders', steps: [['click', 'Exclude', 2]] },
  { name: 'flow-orders-blocked', screen: 'orders', steps: [['click', 'Resolve 1 failed check to approve']] },
  { name: 'flow-orders-approve', screen: 'orders', steps: [['click', 'Exclude', 6], ['click', /^Approve and route/]] },
  { name: 'flow-exceptions-filter', screen: 'exceptions', steps: [['click', /^SSI mismatch \d+$/], ['click', /^SF-\d+$/, 2]] },
  { name: 'flow-c360-to-orders', screen: 'c360', steps: [['click', 'Propose rebalance']] },
  { name: 'flow-nav-home', screen: 'c360', steps: [['click', 'Client home']] },
  { name: 'flow-home-to-money', screen: 'home', steps: [['click', 'Move money', 1]] },
  { name: 'flow-money-amount-error', screen: 'money', steps: [['fill', 'input', '500000']] },
  { name: 'flow-money-bene-eft', screen: 'money', steps: [['click', 'Ontario Land Registry Trust'], ['click', 'EFT'], ['fill', 'input', '12000']] },
  { name: 'flow-money-review', screen: 'money', steps: [['click', 'Review payment']] },
  { name: 'flow-money-confirm', screen: 'money', steps: [['click', 'Review payment'], ['click', 'Confirm and send']] },
  { name: 'flow-hover-nav-row', screen: 'portfolio', steps: [['hover', 'Alternatives', 0], ['hover', 'Royal Bank of Canada']] },
  { name: 'flow-hover-tile', screen: 'home', steps: [['hover', 'Move money', 1]] },
  { name: 'flow-money-edit', screen: 'money', steps: [['click', 'Review payment'], ['click', 'Edit']] },
];

// App-only cases (spec 010+). `expect`: text that must be visible. `api`: routed /api/pv responses
// ({ 'POST /login': [status, body] }, or a list of those for successive calls). `session`: sessionStorage pv.session to seed. Default URL is ?screen=&state=.
const BASELINES = 'scripts/visual-baselines';
const PV_TOKEN = (role, exp = 4102444800000) => `${Buffer.from(JSON.stringify({ userId: 1, username: 'PV' + role, role, exp })).toString('base64url')}.harness`;
const PV_USER = role => ({ userId: role === 'OPS' ? 9 : 1, username: role === 'OPS' ? 'LBRENNAN' : 'PVADMIN', fullName: role === 'OPS' ? 'Lauren Brennan' : 'System Administrator', role });
const PV_STATS = {
  archive: { mt535Count: 1184, mt54xCount: 2642, statements: 1184, confirms: 2642, parseErrors: 0, parseErrorLog: [], loadedAt: '2026-11-09T14:47:12.000Z', loadMs: 1286, statementAccounts: 48, confirmFolders: 46 },
  users: [
    { userId: 7, username: 'JSMITH', fullName: 'James Smith', role: 'ADVISER', activeFlg: 'Y', lastLoginDt: '2026-11-06T09:12:41.000' },
    { userId: 9, username: 'LBRENNAN', fullName: 'Lauren Brennan', role: 'OPS', activeFlg: 'Y', lastLoginDt: '2026-11-09T08:03:19.000' },
    { userId: 1, username: 'PVADMIN', fullName: 'System Administrator', role: 'ADMIN', activeFlg: 'Y', lastLoginDt: '2026-11-09T09:41:57.000' },
  ],
};
const SIGN_IN = [['fill', 'input[name=username]', 'pvadmin'], ['fill', 'input[name=password]', 'synthetic-pass'], ['click', 'Sign in']];
const ADMIN_EXPECT = {
  Populated: ['Archive index', 'MT535 files', 'Parse errors (2)', 'Last loaded', '09/11/2026 09:47:12', '1286 ms', 'Reload archive', 'Users (6)', 'LBRENNAN', 'Portfolio Viewer'],
  Loading: ['Loading admin…'],
  Empty: ['Archive is empty'],
  Error: ['Couldn’t load archive status', 'Retry'],
};
const C360_PV = '?screen=c360&cid=1001';
const PV_ADVISER = { userId: 7, username: 'JSMITH', fullName: 'James Smith', role: 'ADVISER' };
const ADVISER_SESSION = { token: PV_TOKEN('ADVISER'), user: PV_ADVISER };
const OPS_SESSION = { token: PV_TOKEN('OPS'), user: PV_USER('OPS') };
const SMITHS = Array.from({ length: 30 }, (_, i) => ({
  clientId: 1100 + i, clientRef: `C20${18 + (i % 4)}-0${String(410 + i * 7)}`, clientName: `${['Mr', 'Mrs', 'Dr', 'Ms', 'Prof'][i % 5]} ${'ABCDEFGHJKLMNPRSTW'[i % 18]} Smith${i >= 18 ? 'son' : ''}`,
  statusCd: i % 11 === 4 ? 'D' : 'A', adviserUsername: 'JSMITH', adviserName: 'James Smith', acctCount: 1 + (i % 4),
})).sort((a, b) => a.clientName.toLowerCase().localeCompare(b.clientName.toLowerCase()));
const PENHALIGON_ROW = { clientId: 1001, clientRef: 'C2017-0124', clientName: 'The Penhaligon Family Trust', statusCd: 'A', adviserUsername: 'JSMITH', adviserName: 'James Smith', acctCount: 2 };
const acct = (acctId, acctNo, acctType, safeCode, openDt, closeDt, stmtDate, mktValGbp) =>
  ({ acctId, acctNo, clientId: 1063, clientName: 'Dr T Okonjo', acctType, baseCcy: 'GBP', safeCode, openDt, closeDt, statusCd: closeDt ? 'C' : 'O', stmtDate, mktValGbp });
const SUMMARY_1063 = {
  clientId: 1063, clientRef: 'C2017-0306', clientName: 'Dr T Okonjo', statusCd: 'A', createdDt: '2017-06-01', adviserUsername: 'JSMITH', adviserName: 'James Smith',
  accounts: [acct(2115, '01063-01', 'Stocks & Shares ISA', '15318', '2017-07-04', null, '2026-10-09', '188488.45'),
    acct(2116, '01063-02', 'General Investment Account', '18792', '2019-01-11', '2026-08-21', '2026-08-21', '0.00')],
  totalMktValGbp: '188488.45',
};
const SUMMARY_1001 = {
  clientId: 1001, clientRef: 'C2017-0124', clientName: 'The Penhaligon Family Trust', statusCd: 'A', createdDt: '2017-06-15', adviserUsername: 'JSMITH', adviserName: 'James Smith',
  accounts: [
    { acctId: 2001, acctNo: '01001-01', clientId: 1001, clientName: 'The Penhaligon Family Trust', acctType: 'SIPP', baseCcy: 'GBP', safeCode: '16598', openDt: '2019-06-10', closeDt: null, statusCd: 'O', stmtDate: '2026-10-09', mktValGbp: '283880.39' },
    { acctId: 2002, acctNo: '01001-02', clientId: 1001, clientName: 'The Penhaligon Family Trust', acctType: 'S&S ISA', baseCcy: 'GBP', safeCode: '15169', openDt: '2018-04-22', closeDt: null, statusCd: 'O', stmtDate: '2026-10-09', mktValGbp: '76295.23' },
  ],
  totalMktValGbp: '360175.62',
};
const CLIENTS_EXPECT = {
  Populated: ['Find a custody client', 'All clients', 'Dr B Yeoman', 'Miss M Juniper', 'Active'],
  Loading: ['Loading client search…'], Empty: ['No custody clients on file'], Error: ['Couldn’t search clients'],
};
const C360PV_EXPECT = {
  Populated: ['The Penhaligon Family Trust', 'C2017-0124', '15-JUN-2017', 'Grand Total (GBP):', '360,175.62', '283,880.39', '09-OCT-2026', 'Position check'],
  Loading: ['Loading client 360…'], Empty: ['Client not found'], Error: ['Couldn’t load client summary'],
};
const SEARCH = text => [['fill', 'input[name=q]', text], ['click', 'Search']];
// Settlements (spec 007): synthetic archive rows for account 01001-01 (safe 16598).
const STL_ACCT = {acctId: 2001,acctNo: '01001-01',clientId: 1001,clientName: 'The Penhaligon Family Trust',acctType: 'SIPP',baseCcy: 'GBP',safeCode: '16598',openDt: '2019-06-10',closeDt: null,statusCd: 'O'};
const STL_DEFAULT = { acctId: 2001, custAcct: '0016598', from: '2026-07-11', to: '2026-10-09', items: [
  {mtType: 547,seme: 'KS5400064539',prev: null,function: 'NEWM',tradeDate: '2026-10-08',settleDate: '2026-10-09',isin: 'XS00ZZ014941',instrumentName: 'Westray Housing 3.75% 2037',qty: '12000',custAcct: '0016598',amountRaw: 'GBP11524,8',amount: '11524.08',amountError: null,ccy: 'GBP',direction: 'DEL',filePath: 'mt54x/20261009/MT547_16598_20261009_001.txt',fileName: 'MT547_16598_20261009_001.txt',folder: '20261009'},
  {mtType: 545,seme: 'KS5400064495',prev: null,function: 'NEWM',tradeDate: '2026-10-05',settleDate: '2026-10-08',isin: 'GB00ZZ012309',instrumentName: 'Bellmere Multi Asset Balanced Fund Inc',qty: '2437.027',custAcct: '0016598',amountRaw: 'GBP10857,93',amount: '10857.93',amountError: null,ccy: 'GBP',direction: 'REC',filePath: 'mt54x/20261008/MT545_16598_20261008_001.txt',fileName: 'MT545_16598_20261008_001.txt',folder: '20261008'},
  {mtType: 547,seme: 'KS5400064435',prev: null,function: 'NEWM',tradeDate: '2026-10-05',settleDate: '2026-10-07',isin: 'GB00ZZ009024',instrumentName: 'Tavistock Housing PLC Ord',qty: '513',custAcct: '0016598',amountRaw: 'GBP21036,08',amount: '21036.08',amountError: null,ccy: 'GBP',direction: 'DEL',filePath: 'mt54x/20261007/MT547_16598_20261007_001.txt',fileName: 'MT547_16598_20261007_001.txt',folder: '20261007'},
  {mtType: 545,seme: 'KS5400064213',prev: null,function: 'NEWM',tradeDate: '2026-09-29',settleDate: '2026-10-01',isin: 'GB00ZZ000775',instrumentName: 'Larchmont Property PLC Ord',qty: '560',custAcct: '0016598',amountRaw: 'GBP8514,24',amount: '8514.24',amountError: null,ccy: 'GBP',direction: 'REC',filePath: 'mt54x/20261001/MT545_16598_20261001_001.txt',fileName: 'MT545_16598_20261001_001.txt',folder: '20261001'},
  {mtType: 545,seme: 'KS5400064077',prev: null,function: 'NEWM',tradeDate: '2026-09-25',settleDate: '2026-09-29',isin: 'GB00ZZ002573',instrumentName: 'Hythe Engineering PLC Ord',qty: '530',custAcct: '0016598',amountRaw: 'GBP15355,69',amount: '15355.69',amountError: null,ccy: 'GBP',direction: 'REC',filePath: 'mt54x/20260929/MT545_16598_20260929_001.txt',fileName: 'MT545_16598_20260929_001.txt',folder: '20260929'},
  {mtType: 545,seme: 'KS5400064025',prev: null,function: 'NEWM',tradeDate: '2026-09-23',settleDate: '2026-09-28',isin: 'LU00ZZ013430',instrumentName: 'Bellmere Multi Asset Balanced Fund R Inc',qty: '2166.5',custAcct: '0016598',amountRaw: 'GBP7486,99',amount: '7486.99',amountError: null,ccy: 'GBP',direction: 'REC',filePath: 'mt54x/20260928/MT545_16598_20260928_001.txt',fileName: 'MT545_16598_20260928_001.txt',folder: '20260928'},
] };
const STL_SEP = { acctId: 2001, custAcct: '0016598', from: '2026-09-01', to: '2026-09-30', items: [
  {mtType: 545,seme: 'KS5400064077',prev: null,function: 'NEWM',tradeDate: '2026-09-25',settleDate: '2026-09-29',isin: 'GB00ZZ002573',instrumentName: 'Hythe Engineering PLC Ord',qty: '530',custAcct: '0016598',amountRaw: 'GBP15355,69',amount: '15355.69',amountError: null,ccy: 'GBP',direction: 'REC',filePath: 'mt54x/20260929/MT545_16598_20260929_001.txt',fileName: 'MT545_16598_20260929_001.txt',folder: '20260929'},
  {mtType: 545,seme: 'KS5400064025',prev: null,function: 'NEWM',tradeDate: '2026-09-23',settleDate: '2026-09-28',isin: 'LU00ZZ013430',instrumentName: 'Bellmere Multi Asset Balanced Fund R Inc',qty: '2166.5',custAcct: '0016598',amountRaw: 'GBP7486,99',amount: '7486.99',amountError: null,ccy: 'GBP',direction: 'REC',filePath: 'mt54x/20260928/MT545_16598_20260928_001.txt',fileName: 'MT545_16598_20260928_001.txt',folder: '20260928'},
  {mtType: 545,seme: 'KS5400063829',prev: null,function: 'NEWM',tradeDate: '2026-09-18',settleDate: '2026-09-22',isin: 'GB00ZZ004694',instrumentName: 'Alder Property PLC Ord',qty: '380',custAcct: '0016598',amountRaw: 'GBP17873,68',amount: '17873.68',amountError: null,ccy: 'GBP',direction: 'REC',filePath: 'mt54x/20260922/MT545_16598_20260922_001.txt',fileName: 'MT545_16598_20260922_001.txt',folder: '20260922'},
  {mtType: 547,seme: 'KS5400063701',prev: null,function: 'NEWM',tradeDate: '2026-09-16',settleDate: '2026-09-18',isin: 'GB00ZZ002631',instrumentName: 'Larchmont Foods PLC Ord',qty: '458',custAcct: '0016598',amountRaw: 'GBP10409,42',amount: '10409.42',amountError: null,ccy: 'GBP',direction: 'DEL',filePath: 'mt54x/20260918/MT547_16598_20260918_001.txt',fileName: 'MT547_16598_20260918_001.txt',folder: '20260918'},
  {mtType: 545,seme: 'KS5400063496',prev: null,function: 'NEWM',tradeDate: '2026-09-10',settleDate: '2026-09-14',isin: 'GB00ZZ004439',instrumentName: 'Kirkwall Logistics PLC Ord',qty: '340',custAcct: '0016598',amountRaw: 'GBP8464,64',amount: '8464.64',amountError: null,ccy: 'GBP',direction: 'REC',filePath: 'mt54x/20260914/MT545_16598_20260914_001.txt',fileName: 'MT545_16598_20260914_001.txt',folder: '20260914'},
  {mtType: 547,seme: 'KS5400063102',prev: null,function: 'NEWM',tradeDate: '2026-09-01',settleDate: '2026-09-03',isin: 'GB00ZZ011095',instrumentName: 'Larchmont Capital PLC Ord',qty: '6759',custAcct: '0016598',amountRaw: 'GBP23054,95',amount: '23054.95',amountError: null,ccy: 'GBP',direction: 'DEL',filePath: 'mt54x/20260903/MT547_16598_20260903_001.txt',fileName: 'MT547_16598_20260903_001.txt',folder: '20260903'},
] };
const STL_ACCOUNTS = { accounts: [
  {acctId: 2001,acctNo: '01001-01',clientId: 1001,clientName: 'The Penhaligon Family Trust',acctType: 'SIPP',baseCcy: 'GBP',safeCode: '16598',openDt: '2019-06-10',closeDt: null,statusCd: 'O'},
  {acctId: 2002,acctNo: '01001-02',clientId: 1001,clientName: 'The Penhaligon Family Trust',acctType: 'S&S ISA',baseCcy: 'GBP',safeCode: '15169',openDt: '2018-04-22',closeDt: null,statusCd: 'O'},
  {acctId: 2004,acctNo: '01002-01',clientId: 1002,clientName: 'Mrs K Drummond',acctType: 'General Investment Account',baseCcy: 'GBP',safeCode: '14022',openDt: '2013-07-18',closeDt: null,statusCd: 'O'},
  {acctId: 2006,acctNo: '01005-01',clientId: 1005,clientName: 'Miss D Mcintyre',acctType: 'Discretionary',baseCcy: 'GBP',safeCode: '15721',openDt: '2013-08-04',closeDt: null,statusCd: 'O'},
  {acctId: 2007,acctNo: '01005-02',clientId: 1005,clientName: 'Miss D Mcintyre',acctType: 'SIPP ',baseCcy: 'GBP',safeCode: '13760',openDt: '2013-04-01',closeDt: null,statusCd: 'O'},
  {acctId: 2008,acctNo: '01006-01',clientId: 1006,clientName: 'The Gilchrist Family Trust',acctType: 'ISA',baseCcy: 'GBP',safeCode: '18722',openDt: '2010-09-27',closeDt: null,statusCd: 'O'},
] };
const STL_SESSION = { token: PV_TOKEN('OPS'), user: PV_USER('OPS') };
const STL_API = { 'GET /accounts/2001': [200, STL_ACCT], 'GET /accounts/2001/settlements': [200, STL_DEFAULT], 'GET /accounts/2001/settlements?from=2026-09-01&to=2026-09-30': [200, STL_SEP] };
const STL_EXPECT = {
  Populated: ['Settlement confirmations (18)', '11-JUL-2026 – 09-OCT-2026', 'The Penhaligon Family Trust', 'MT547', 'XS00ZZ014941', 'Westray Housing 3.75% 2037', '11,524.08', 'KS5400064539', '91 days', 'Portfolio Viewer'],
  Loading: ['Loading settlements…'],
  Empty: ['No settlements in period'],
  Error: ['Couldn’t load settlements', 'Retry'],
};
const STL_WINDOW = [['fill', 'input[name=from]', '2026-09-01'], ['fill', 'input[name=to]', '2026-09-30'], ['click', 'Show']];
const POSCHECK_EXPECT = {
  Populated: ['Position check · 01028-01 · 26-JUN-2026', 'Run check', 'Check all', 'GB00ZZ003373', 'Foxley Telecom PLC Ord', '-1,250', 'OPEN', 'LBRENNAN', '30/06/2026', 'MT535_16558_20260626_003.txt'],
  Loading: ['Loading position check…'],
  Empty: ['No statements to check'],
  Error: ['Couldn’t run the position check', 'Retry'],
};
const PC_DATES = ['2026-09-18', '2026-09-11', '2026-09-04'];
const PC_ACCOUNTS = [[2001, '01001-01', 'The Penhaligon Family Trust', '16598'], [2125, '01068-02', 'Mrs R Szabo', '10554'], [2129, '01072-01', 'Mr E Marchetti', '11397']]
  .map(([acctId, acctNo, clientName, safeCode]) => ({ acctId, acctNo, clientId: 1000 + acctId, clientName, acctType: 'SIPP', baseCcy: 'GBP', safeCode, openDt: '2019-06-10', closeDt: null, statusCd: 'O' }));
const PC_LISTS = {
  'GET /accounts': [200, { accounts: PC_ACCOUNTS }], 'GET /position-check/dates': [200, { dates: PC_DATES }],
  'GET /accounts/2001/statement-dates': [200, { acctId: 2001, dates: [...PC_DATES, '2026-04-17'] }], 'GET /accounts/2125/statement-dates': [200, { acctId: 2125, dates: PC_DATES }],
};
// Q18: the 8-digit-SAFE MT54x for 01068-02 is not matched, so the fund units surface as a NEW break on 18-SEP-2026.
const PC_Q18_ROW = { isin: 'LU00ZZ014180', instrument: 'Greystoke Emerging Markets Fund I Acc', prevQty: '8462.307', netSettled: '0', expected: '8462.307', stmtQty: '12238.377', diff: '3776.07', status: 'NEW', note: null, updatedBy: null, updatedDt: null };
const PC_Q18 = { acctId: 2125, stmtDate: '2026-09-18', prevStmtDate: '2026-09-11', noPrevMessage: null, statementFile: 'MT535_10554_20260918_001.txt', rows: [PC_Q18_ROW] };
const PC_Q18_SAVED = { ...PC_Q18, rows: [{ ...PC_Q18_ROW, status: 'CHASED', note: 'asked custodian', updatedBy: 'LBRENNAN', updatedDt: '2026-11-09T10:15:00.000' }] };
const PC_ALL = { stmtDate: '2026-09-18', rows: [
  { acctId: 2001, acctNo: '01001-01', client: 'The Penhaligon Family Trust', diffs: '0' }, { acctId: 2125, acctNo: '01068-02', client: 'Mrs R Szabo', diffs: '1' }, { acctId: 2129, acctNo: '01072-01', client: 'Mr E Marchetti', diffs: '1' },
] };
const APP_ONLY = [
  ...STATES.map(state => ({ name: `admin-${state}`, screen: 'admin', state, expect: ADMIN_EXPECT[state] })),
  { name: 'flow-admin-reload-confirm', screen: 'admin', steps: [['click', 'Reload archive']], expect: ['Reload the archive index?', 'Cancel'] },
  { name: 'flow-admin-reload', screen: 'admin', steps: [['click', 'Reload archive'], ['click', 'Reload']], expect: ['Archive reloaded.'] },
  { name: 'flow-admin-signin', screen: 'admin', url: '?screen=admin', expect: ['Sign in to Portfolio Viewer', 'User ID', 'Password'] },
  { name: 'flow-admin-signin-ok', screen: 'admin', url: '?screen=admin', api: { 'POST /login': [200, { token: PV_TOKEN('ADMIN'), user: PV_USER('ADMIN') }], 'GET /admin/stats': [200, PV_STATS] }, steps: SIGN_IN, expect: ['Archive index', 'No parse errors at the last load.', 'Users (3)', 'Sign out', 'PVADMIN · ADMIN'] },
  { name: 'flow-admin-signin-invalid', screen: 'admin', url: '?screen=admin', api: { 'POST /login': [401, { error: 'Invalid user name or password.' }] }, steps: SIGN_IN, expect: ['Invalid user ID or password.'] },
  { name: 'flow-admin-signin-disabled', screen: 'admin', url: '?screen=admin', api: { 'POST /login': [403, { error: 'Account disabled.' }] }, steps: SIGN_IN, expect: ['Your account has been disabled. Please contact Support (ext. 4417).'] },
  { name: 'flow-admin-forbidden', screen: 'admin', url: '?screen=admin', api: { 'POST /login': [200, { token: PV_TOKEN('OPS'), user: PV_USER('OPS') }] }, steps: SIGN_IN, expect: ['Not authorised for this page', 'Admin requires the ADMIN role. You are signed in as LBRENNAN (OPS).'] },
  { name: 'flow-admin-expired', screen: 'admin', url: '?screen=admin', session: { token: PV_TOKEN('ADMIN'), user: PV_USER('ADMIN') }, api: { 'GET /admin/stats': [401, { error: 'Session expired.' }] }, expect: ['Your session has expired. Sign in again.', 'Sign in to Portfolio Viewer'] },
  { name: 'flow-admin-signout', screen: 'admin', url: '?screen=admin', session: { token: PV_TOKEN('ADMIN'), user: PV_USER('ADMIN') }, api: { 'GET /admin/stats': [200, PV_STATS] }, steps: [['click', 'Sign out']], expect: ['Sign in to Portfolio Viewer'] },
  ...STATES.map(state => ({ name: `settlements-${state}`, screen: 'settlements', state, expect: STL_EXPECT[state] })),
  { name: 'flow-settlements-signin', screen: 'settlements', url: '?screen=settlements&acct=2001', expect: ['Sign in to Portfolio Viewer', 'Settlements is part of Portfolio Viewer.'] },
  { name: 'flow-settlements-default', screen: 'settlements', url: '?screen=settlements&acct=2001', session: STL_SESSION, api: STL_API, expect: ['Settlement confirmations (6)', '11-JUL-2026 – 09-OCT-2026', '0016598', 'Settlements', 'LBRENNAN · OPS'] },
  { name: 'flow-settlements-window', screen: 'settlements', url: '?screen=settlements&acct=2001', session: STL_SESSION, api: STL_API, steps: STL_WINDOW, expect: ['Settlement confirmations (6)', '01-SEP-2026 – 30-SEP-2026', 'KS5400063102', '30 days'] },
  { name: 'flow-settlements-invalid-date', screen: 'settlements', url: '?screen=settlements&acct=2001', session: STL_SESSION, api: STL_API, steps: [['fill', 'input[name=from]', '31/02/2026'], ['click', 'Show']], expect: ['Enter dates as yyyy-mm-dd.', '11-JUL-2026 – 09-OCT-2026'] },
  { name: 'flow-settlements-legacy-link', screen: 'settlements', url: '?screen=settlements&acct=2001&from=01/09/2026&to=30/09/2026', session: STL_SESSION, api: STL_API, expect: ['01-SEP-2026 – 30-SEP-2026', 'KS5400064077'] },
  { name: 'flow-settlements-empty-window', screen: 'settlements', url: '?screen=settlements&acct=2001&from=2026-01-01&to=2026-01-31', session: STL_SESSION, api: { ...STL_API, 'GET /accounts/2001/settlements?from=2026-01-01&to=2026-01-31': [200, { ...STL_SEP, from: '2026-01-01', to: '2026-01-31', items: [] }] }, expect: ['No settlements in period', 'The Penhaligon Family Trust', 'Show'] },
  { name: 'flow-settlements-picker', screen: 'settlements', url: '?screen=settlements', session: STL_SESSION, api: { ...STL_API, 'GET /accounts': [200, STL_ACCOUNTS] }, steps: [['click', '01001-01']], expect: ['Settlement confirmations (6)', 'The Penhaligon Family Trust'] },
  { name: 'flow-settlements-not-found', screen: 'settlements', url: '?screen=settlements&acct=9999', session: STL_SESSION, api: { 'GET /accounts/9999': [404, { error: 'Account not found' }], 'GET /accounts/9999/settlements': [404, { error: 'Account not found' }], 'GET /accounts': [200, STL_ACCOUNTS] }, expect: ['Account 9999 was not found.', 'Choose a custody account (6)'] },
  // Spec 006: PositionCheck.aspx on `exceptions` with PV context. `screen: 'poscheck'` keeps `exceptions:<state>` on the mockup comparison.
  ...STATES.map(state => ({ name: `poscheck-${state}`, screen: 'poscheck', state, url: `?screen=exceptions&pc=1&state=${state}`, expect: POSCHECK_EXPECT[state] })),
  { name: 'flow-poscheck-nav', screen: 'admin', steps: [['click', 'Position check']], expect: ['Run check', 'Check all', 'GB00ZZ003373'] },
  { name: 'flow-poscheck-edit', screen: 'poscheck', url: '?screen=exceptions&pc=1&state=Populated', steps: [['click', 'Edit']], expect: ['Update', 'Cancel'] },
  { name: 'flow-poscheck-save', screen: 'poscheck', url: '?screen=exceptions&pc=1&state=Populated', steps: [['click', 'Edit'], ['click', 'Update']], expect: ['Notes saved.', 'Edit'] },
  { name: 'flow-poscheck-live-save', screen: 'poscheck', url: '?screen=exceptions&acct=2125&stmt=2026-09-18', session: { token: PV_TOKEN('OPS'), user: PV_USER('OPS') },
    api: { ...PC_LISTS, 'GET /accounts/2125/position-check': [[200, PC_Q18], [200, PC_Q18_SAVED]], 'PUT /accounts/2125/position-check/notes': [200, PC_Q18_SAVED.rows[0]] },
    steps: [['click', 'Edit'], ['select', 'select[aria-label=Status]', 'CHASED'], ['fill', 'textarea[aria-label=Note]', 'asked custodian'], ['click', 'Update']],
    expect: ['Notes saved.', 'CHASED', 'asked custodian', 'LBRENNAN', '09/11/2026', 'Position check · 01068-02 · 18-SEP-2026'] },
  { name: 'flow-poscheck-check-all', screen: 'poscheck', url: '?screen=exceptions&pc=1', session: { token: PV_TOKEN('OPS'), user: PV_USER('OPS') },
    api: { ...PC_LISTS, 'GET /position-check/all': [200, PC_ALL] }, steps: [['click', 'Check all']], expect: ['Check all accounts · 18-SEP-2026', 'Accounts with differences', '2 differences in total', 'View'] },
  { name: 'flow-poscheck-check-all-view', screen: 'poscheck', url: '?screen=exceptions&pc=1', session: { token: PV_TOKEN('OPS'), user: PV_USER('OPS') },
    api: { ...PC_LISTS, 'GET /position-check/all': [200, PC_ALL], 'GET /accounts/2125/position-check': [200, PC_Q18] }, steps: [['click', 'Check all'], ['click', 'View', 1]],
    expect: ['Position check · 01068-02 · 18-SEP-2026', 'LU00ZZ014180', 'Greystoke Emerging Markets Fund I Acc', '3,776.07', 'NEW'] },
  { name: 'flow-poscheck-no-prev', screen: 'poscheck', url: '?screen=exceptions&acct=2001&stmt=2026-04-17', session: { token: PV_TOKEN('OPS'), user: PV_USER('OPS') },
    api: { ...PC_LISTS, 'GET /accounts/2001/position-check': [200, { acctId: 2001, stmtDate: '2026-04-17', prevStmtDate: null, noPrevMessage: 'No previous statement on file.', statementFile: 'MT535_16598_20260417_001.txt', rows: [] }] },
    expect: ['No previous statement on file.', 'None on file'] },
  { name: 'flow-poscheck-forbidden', screen: 'poscheck', url: '?screen=exceptions&pc=1', session: { token: PV_TOKEN('ADVISER'), user: { userId: 7, username: 'JSMITH', fullName: 'James Smith', role: 'ADVISER' } },
    expect: ['Not authorised for this page', 'Position check requires the OPS or ADMIN role. You are signed in as JSMITH (ADVISER).'] },
].map(c => ({ ...c, appOnly: true }));
APP_ONLY.push(
  ...STATES.map(state => ({ name: `clients-${state}`, screen: 'clients', state, expect: CLIENTS_EXPECT[state] })),
  ...STATES.map(state => ({ name: `c360pv-${state}`, screen: 'c360pv', state, url: `${C360_PV}&state=${state}`, expect: C360PV_EXPECT[state] })),
  { name: 'flow-clients-search', screen: 'clients', url: '?screen=clients', session: ADVISER_SESSION, api: { 'GET /clients/search': [200, { clients: SMITHS }] }, steps: SEARCH('smith'), expect: ['Results for “smith”', '30 clients', '1–25 of 30 · sorted by client name', 'Dormant'] },
  { name: 'flow-clients-page2', screen: 'clients', url: '?screen=clients&q=smith', session: ADVISER_SESSION, api: { 'GET /clients/search': [200, { clients: SMITHS }] }, steps: [['click', 'Next ›']], expect: ['26–30 of 30 · sorted by client name'] },
  { name: 'flow-clients-no-results', screen: 'clients', url: '?screen=clients', session: ADVISER_SESSION, api: { 'GET /clients/search': [200, { clients: [] }] }, steps: SEARCH('zz'), expect: ['Results for “zz”', 'No clients found.'] },
  { name: 'flow-clients-open-summary', screen: 'clients', url: '?screen=clients', session: OPS_SESSION, api: { 'GET /clients/search': [200, { clients: [PENHALIGON_ROW] }], 'GET /clients/1001/summary': [200, SUMMARY_1001] }, steps: [...SEARCH('penhal'), ['click', 'The Penhaligon Family Trust']], expect: ['Grand Total (GBP):', '360,175.62', 'Position check', 'LBRENNAN · OPS'] },
  { name: 'flow-c360pv-adviser-closed', screen: 'c360pv', url: '?screen=c360&cid=1063', session: ADVISER_SESSION, api: { 'GET /clients/1063/summary': [200, SUMMARY_1063] }, expect: ['Dr T Okonjo', 'Closed', '21-AUG-2026', '0.00', '188,488.45', 'JSMITH · ADVISER'] },
  { name: 'flow-c360pv-back-to-search', screen: 'c360pv', url: '?screen=c360&cid=1001&q=penhal', session: ADVISER_SESSION, api: { 'GET /clients/1001/summary': [200, SUMMARY_1001], 'GET /clients/search': [200, { clients: [PENHALIGON_ROW] }] }, steps: [['click', 'Back to search']], expect: ['Results for “penhal”', '1 client', 'The Penhaligon Family Trust'] },
  { name: 'flow-c360pv-not-found', screen: 'c360pv', url: '?screen=c360&cid=999999', session: ADVISER_SESSION, api: { 'GET /clients/999999/summary': [404, { error: 'Not found' }] }, expect: ['Client not found'] },
  { name: 'flow-c360pv-signin', screen: 'c360pv', url: C360_PV, expect: ['Sign in to Portfolio Viewer', 'Client 360 is part of Portfolio Viewer.'] },
);
APP_ONLY.forEach(c => { c.appOnly = true; });
const APP_ONLY_SCREENS = [...new Set(APP_ONLY.map(c => c.screen))];

const args = process.argv.slice(2);
const STATIC = SCREENS.flatMap(screen => STATES.map(state => ({ name: `${screen}-${state}`, screen, state })));
const named = name => APP_ONLY.find(c => c.name === name);
const cases = !args.length
  ? [...STATIC, ...FLOWS, ...APP_ONLY]
  : args.flatMap(a => a === 'flows' ? FLOWS : a === 'app' ? APP_ONLY : a.startsWith('flow-') ? [...FLOWS, ...APP_ONLY].filter(f => f.name === a)
    : (([screen, state = 'Populated']) => APP_ONLY_SCREENS.includes(screen) ? [named(`${screen}-${state}`)].filter(Boolean) : [{ name: `${screen}-${state}`, screen, state }])(a.split(':')));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--headless=new', '--hide-scrollbars'] });

async function shoot(url, setup, steps = [], expect = []) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  if (setup) await setup(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  for (const [kind, target, arg] of steps) {
    if (kind === 'click') await page.getByText(target, { exact: true }).nth(arg ?? 0).click();
    else if (kind === 'hover') await page.getByText(target, { exact: true }).nth(arg ?? 0).hover();
    else if (kind === 'fill') await page.locator(target).first().fill(arg);
    else if (kind === 'select') await page.locator(target).first().selectOption(arg);
  }
  if (!steps.some(s => s[0] === 'hover')) await page.mouse.move(0, HEIGHT - 1);
  await page.waitForTimeout(400);
  const missing = [];
  for (const t of expect) if (!(await page.getByText(t, { exact: false }).first().isVisible().catch(() => false))) missing.push(t);
  const buf = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await page.close();
  const png = PNG.sync.read(buf);
  png.missing = missing;
  return png;
}

function pvSetup({ api = {}, session }) {
  return async page => {
    if (session) await page.addInitScript(s => sessionStorage.setItem('pv.session', s), JSON.stringify(session));
    await page.route('**/api/pv/**', async route => {
      const r = route.request(), u = new URL(r.url()), key = `${r.method()} ${u.pathname.replace(/^\/api\/pv/, '')}`;
      const entry = api[key + u.search] ?? api[key];
      // [[status, body], ...] answers successive requests in order (the last one repeats).
      const hit = Array.isArray(entry?.[0]) ? (entry.length > 1 ? entry.shift() : entry[0]) : entry;
      if (!hit) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: `harness: no route for ${key}` }) });
      await route.fulfill({ status: hit[0], contentType: 'application/json', body: JSON.stringify(hit[1]) });
    });
  };
}

function pad(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const out = new PNG({ width: w, height: h });
  out.data.fill(255);
  PNG.bitblt(img, out, 0, 0, Math.min(img.width, w), Math.min(img.height, h), 0, 0);
  return out;
}

let worst = 0, failures = 0;
mkdirSync(BASELINES, { recursive: true });
const BASELINE_MAX = Number(process.env.BASELINE_MAX ?? 0.005);
for (const c of cases.filter(c => c.appOnly)) {
  const { name, screen, state = 'Populated', steps, expect = [], url } = c;
  const app = await shoot(`${APP_URL}/${url ?? `?screen=${screen}&state=${state}`}`, pvSetup(c), steps, expect);
  writeFileSync(`${OUT}/${name}-app.png`, PNG.sync.write(app));
  const file = `${BASELINES}/${name}.png`;
  let note;
  if (process.env.UPDATE_BASELINES === '1' || !existsSync(file)) {
    writeFileSync(file, PNG.sync.write(app));
    note = 'baseline written';
  } else {
    const base = PNG.sync.read(readFileSync(file));
    const w = Math.max(base.width, app.width), h = Math.max(base.height, app.height);
    const diff = new PNG({ width: w, height: h });
    const n = pixelmatch(pad(base, w, h).data, pad(app, w, h).data, diff.data, w, h, { threshold: 0.1 });
    writeFileSync(`${OUT}/${name}-diff.png`, PNG.sync.write(diff));
    const ratio = n / (w * h);
    if (ratio > BASELINE_MAX) failures++;
    note = `${n.toString().padStart(8)} px  ${(ratio * 100).toFixed(3)}% vs baseline${ratio > BASELINE_MAX ? '  FAIL' : ''}${base.height !== app.height ? ` size base ${base.width}x${base.height} app ${app.width}x${app.height}` : ''}`;
  }
  if (app.missing.length) failures++;
  console.log(`${name.padEnd(34)} ${note}  assertions ${expect.length - app.missing.length}/${expect.length}${app.missing.length ? `  MISSING ${JSON.stringify(app.missing)}` : ''}`);
}

for (const { name, screen, state = 'Populated', steps } of cases.filter(c => !c.appOnly)) {
  const mock = await shoot(MOCK_URL, page => page.route(MOCK_URL, async route => {
    const res = await route.fetch();
    const body = (await res.text())
      .replace('default&quot;:&quot;c360', `default&quot;:&quot;${screen}`)
      .replace('default&quot;:&quot;Populated', `default&quot;:&quot;${state}`);
    await route.fulfill({ response: res, body });
  }), steps);
  const app = await shoot(`${APP_URL}/?screen=${screen}&state=${state}`, null, steps);
  const w = Math.max(mock.width, app.width), h = Math.max(mock.height, app.height);
  const a = pad(mock, w, h), b = pad(app, w, h);
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.1 });
  const ratio = n / (w * h);
  worst = Math.max(worst, ratio);
  writeFileSync(`${OUT}/${name}-mock.png`, PNG.sync.write(mock));
  writeFileSync(`${OUT}/${name}-app.png`, PNG.sync.write(app));
  writeFileSync(`${OUT}/${name}-diff.png`, PNG.sync.write(diff));
  const sizeNote = mock.height !== app.height || mock.width !== app.width ? ` size mock ${mock.width}x${mock.height} app ${app.width}x${app.height}` : '';
  console.log(`${name.padEnd(34)} ${n.toString().padStart(8)} px  ${(ratio * 100).toFixed(3)}%${sizeNote}`);
}
await browser.close();
console.log(`worst ${(worst * 100).toFixed(3)}%`);
if (failures) { console.log(`${failures} app-only case(s) failed`); process.exitCode = 1; }
