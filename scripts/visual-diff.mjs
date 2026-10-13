// Screenshots every screen × data state of the app and the mockup, then pixel-diffs them.
// Usage: node scripts/visual-diff.mjs [screen[:state] ...]
// Env: APP_URL (default http://localhost:5173), MOCK_URL (mockup .dc.html served over http), CHROME (executable path), WIDTH, HEIGHT.
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
const CUSTODY_CASES = STATES.map(state => ({ name: `custody-settlements-${state}`, screen: 'custody-settlements', state }));
const CUSTODY_CLIENT_ID = process.env.CUSTODY_CLIENT_ID ?? '1055';

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

const args = process.argv.slice(2);
const STATIC = SCREENS.flatMap(screen => STATES.map(state => ({ name: `${screen}-${state}`, screen, state })));
const cases = !args.length
  ? [...STATIC, ...FLOWS]
  : args.flatMap(a => a === 'flows' ? FLOWS : a.startsWith('flow-') ? FLOWS.filter(f => f.name === a) : a.startsWith('custody-settlements') ? [] : (([screen, state = 'Populated']) => [{ name: `${screen}-${state}`, screen, state }])(a.split(':')));
const custodyCases = !args.length
  ? CUSTODY_CASES
  : args.flatMap(a => {
    const [screen, state] = a.split(':');
    return screen === 'custody-settlements'
      ? CUSTODY_CASES.filter(c => state === undefined || c.state.toLowerCase() === state.toLowerCase())
      : [];
  });

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--headless=new', '--hide-scrollbars'] });

async function shoot(url, setup, steps = []) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  if (setup) await setup(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  for (const [kind, target, arg] of steps) {
    if (kind === 'click') await page.getByText(target, { exact: true }).nth(arg ?? 0).click();
    else if (kind === 'hover') await page.getByText(target, { exact: true }).nth(arg ?? 0).hover();
    else if (kind === 'fill') await page.locator(target).first().fill(arg);
  }
  if (!steps.some(s => s[0] === 'hover')) await page.mouse.move(0, HEIGHT - 1);
  await page.waitForTimeout(400);
  const buf = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await page.close();
  return PNG.sync.read(buf);
}

function pad(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const out = new PNG({ width: w, height: h });
  out.data.fill(255);
  PNG.bitblt(img, out, 0, 0, Math.min(img.width, w), Math.min(img.height, h), 0, 0);
  return out;
}

let worst = 0;
for (const { name, screen, state = 'Populated', steps } of cases) {
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
for (const { name, state } of custodyCases) {
  const appUrl = `${APP_URL}/?screen=${name.split('-').slice(0, 2).join('-')}&state=${state}&client=${CUSTODY_CLIENT_ID}&account=2101&from=2026-06-01&to=2026-07-31`;
  const app = await shoot(appUrl);
  const baselinePath = `design/baselines/${name}.png`;
  writeFileSync(`${OUT}/${name}-app.png`, PNG.sync.write(app));
  if (!existsSync(baselinePath)) {
    mkdirSync('design/baselines', { recursive: true });
    writeFileSync(baselinePath, PNG.sync.write(app));
    console.log(`${name.padEnd(34)} baseline captured`);
    continue;
  }
  const baseline = PNG.sync.read(readFileSync(baselinePath));
  const w = Math.max(baseline.width, app.width), h = Math.max(baseline.height, app.height);
  const a = pad(baseline, w, h), b = pad(app, w, h);
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.1 });
  const ratio = n / (w * h);
  worst = Math.max(worst, ratio);
  writeFileSync(`${OUT}/${name}-baseline.png`, PNG.sync.write(baseline));
  writeFileSync(`${OUT}/${name}-diff.png`, PNG.sync.write(diff));
  const sizeNote = baseline.height !== app.height || baseline.width !== app.width ? ` size baseline ${baseline.width}x${baseline.height} app ${app.width}x${app.height}` : '';
  console.log(`${name.padEnd(34)} ${n.toString().padStart(8)} px  ${(ratio * 100).toFixed(3)}%${sizeNote}`);
}
await browser.close();
console.log(`worst ${(worst * 100).toFixed(3)}%`);
