// Screenshots every screen × data state of the app and the mockup, then pixel-diffs them.
// App-only screens (no mockup counterpart, e.g. Admin) are checked by text assertions and against
// committed PNG baselines in scripts/visual-baselines/ instead. PV cases on mockup screens (e.g. portfolio-pv-*, spec 005)
// use `?acct=` and are named apart from the mockup cases.
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
// ({ 'POST /login': [status, body] }). `session`: sessionStorage pv.session to seed. Default URL is ?screen=&state=.
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
// Spec 005: custody holdings on `portfolio` with ?acct= (fixtures: synthetic archive statements, scripts/visual-fixtures/).
const HF = JSON.parse(readFileSync('scripts/visual-fixtures/pv-holdings.json', 'utf8'));
const HOLDINGS_API = {
  'GET /accounts/2018': [200, HF.account2018], 'GET /accounts/2018/statement-dates': [200, { acctId: 2018, dates: HF.dates2018 }],
  'GET /accounts/2018/holdings': [200, HF.holdings2018], 'GET /accounts/2018/holdings?date=2026-10-02': [200, HF.holdings2018_20261002],
};
const ADMIN_SESSION = { token: PV_TOKEN('ADMIN'), user: PV_USER('ADMIN') };
const HOLDINGS_EXPECT = {
  Populated: ['Portfolio Viewer / Custody holdings / 01012-01 · Prof J Castellan', 'Acct No', 'Safe Code', '10367', 'Latest of 26 statements', '295,859.50', 'UNKNOWN INSTRUMENT GB00ZZ004322', 'FAMT', 'MT535_10367_20261009_001.txt', 'Total Mkt Val (GBP)', 'Holdings'],
  Loading: ['Loading custody holdings…', 'Portfolio Viewer / Custody holdings / Account 2018'],
  Empty: ['No statement on file', 'has no MT535 statements of holdings'],
  Error: ['Couldn’t load custody holdings', 'Retry'],
};
const APP_ONLY = [
  ...STATES.map(state => ({ name: `admin-${state}`, screen: 'admin', state, expect: ADMIN_EXPECT[state] })),
  ...STATES.map(state => ({ name: `portfolio-pv-${state}`, screen: 'portfolio', url: `?screen=portfolio&acct=2018&state=${state}`, expect: HOLDINGS_EXPECT[state] })),
  { name: 'flow-portfolio-pv-stmt', screen: 'portfolio', url: '?screen=portfolio&acct=2018', session: ADMIN_SESSION, api: HOLDINGS_API, steps: [['select', 'select[name=stmt]', '2026-10-02']], expect: ['15 lines · statement 02-OCT-2026', 'MT535_10367_20261002_001.txt', '26 statements on file'] },
  { name: 'flow-portfolio-pv-no-holdings', screen: 'portfolio', url: '?screen=portfolio&acct=2051', session: ADMIN_SESSION, api: { 'GET /accounts/2051': [200, HF.account2051], 'GET /accounts/2051/statement-dates': [200, { acctId: 2051, dates: HF.dates2051 }], 'GET /accounts/2051/holdings': [200, HF.holdings2051] }, expect: ['No holdings on statement.', 'Mrs A Lindqvist'] },
  { name: 'flow-portfolio-pv-not-on-file', screen: 'portfolio', url: '?screen=portfolio&acct=2018&stmt=2026-01-02', session: ADMIN_SESSION, api: { ...HOLDINGS_API, 'GET /accounts/2018/holdings?date=2026-01-02': [200, { acctId: 2018, stmtDate: '2026-01-02', statement: null, lines: [] }] }, expect: ['No statement on file for this date.', 'statement 02-JAN-2026'] },
  { name: 'flow-portfolio-pv-unknown', screen: 'portfolio', url: '?screen=portfolio&acct=9999', session: ADMIN_SESSION, api: { 'GET /accounts/9999': [404, { error: 'Account not found.' }] }, expect: ['Custody account not found', 'No Portfolio Viewer account has ID 9999.'] },
  { name: 'flow-portfolio-pv-signin', screen: 'portfolio', url: '?screen=portfolio&acct=2018', api: { 'POST /login': [200, { token: PV_TOKEN('ADMIN'), user: PV_USER('ADMIN') }], ...HOLDINGS_API }, steps: SIGN_IN, expect: ['295,859.50', 'Latest of 26 statements', 'PVADMIN · ADMIN'] },
  { name: 'flow-admin-reload-confirm', screen: 'admin', steps: [['click', 'Reload archive']], expect: ['Reload the archive index?', 'Cancel'] },
  { name: 'flow-admin-reload', screen: 'admin', steps: [['click', 'Reload archive'], ['click', 'Reload']], expect: ['Archive reloaded.'] },
  { name: 'flow-admin-signin', screen: 'admin', url: '?screen=admin', expect: ['Sign in to Portfolio Viewer', 'User ID', 'Password'] },
  { name: 'flow-admin-signin-ok', screen: 'admin', url: '?screen=admin', api: { 'POST /login': [200, { token: PV_TOKEN('ADMIN'), user: PV_USER('ADMIN') }], 'GET /admin/stats': [200, PV_STATS] }, steps: SIGN_IN, expect: ['Archive index', 'No parse errors at the last load.', 'Users (3)', 'Sign out', 'PVADMIN · ADMIN'] },
  { name: 'flow-admin-signin-invalid', screen: 'admin', url: '?screen=admin', api: { 'POST /login': [401, { error: 'Invalid user name or password.' }] }, steps: SIGN_IN, expect: ['Invalid user ID or password.'] },
  { name: 'flow-admin-signin-disabled', screen: 'admin', url: '?screen=admin', api: { 'POST /login': [403, { error: 'Account disabled.' }] }, steps: SIGN_IN, expect: ['Your account has been disabled. Please contact Support (ext. 4417).'] },
  { name: 'flow-admin-forbidden', screen: 'admin', url: '?screen=admin', api: { 'POST /login': [200, { token: PV_TOKEN('OPS'), user: PV_USER('OPS') }] }, steps: SIGN_IN, expect: ['Not authorised for this page', 'Admin requires the ADMIN role. You are signed in as LBRENNAN (OPS).'] },
  { name: 'flow-admin-expired', screen: 'admin', url: '?screen=admin', session: { token: PV_TOKEN('ADMIN'), user: PV_USER('ADMIN') }, api: { 'GET /admin/stats': [401, { error: 'Session expired.' }] }, expect: ['Your session has expired. Sign in again.', 'Sign in to Portfolio Viewer'] },
  { name: 'flow-admin-signout', screen: 'admin', url: '?screen=admin', session: { token: PV_TOKEN('ADMIN'), user: PV_USER('ADMIN') }, api: { 'GET /admin/stats': [200, PV_STATS] }, steps: [['click', 'Sign out']], expect: ['Sign in to Portfolio Viewer'] },
].map(c => ({ ...c, appOnly: true }));
const APP_ONLY_SCREENS = [...new Set(APP_ONLY.map(c => c.screen))].filter(s => !SCREENS.includes(s));

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
    else if (kind === 'select') { await page.locator(target).first().selectOption(arg); await page.waitForLoadState('networkidle'); }
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
      const hit = api[key + u.search] ?? api[key];
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
