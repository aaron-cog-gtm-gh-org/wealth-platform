// T054: custody API and screen latency with the full archive loaded (SC-006: each screen < 2 s).
// Needs `npm run dev:full` (API :3001, Vite :5173) after `npm run db:setup`.
// Usage: node scripts/custody-perf.mjs   Env: API_URL, APP_URL, CHROME, RUNS (default 3).
import { chromium } from 'playwright-core';

const API = process.env.API_URL ?? 'http://localhost:3001';
const APP = process.env.APP_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? 'C:/devin/chrome/chrome-win64/chrome.exe';
const RUNS = Number(process.env.RUNS ?? 3);
const LIMIT_MS = 2000;

const msg = await (await fetch(`${API}/api/custody/messages?type=535&date=2026-07-17&safe=16598`)).json();
const messageId = msg.rows?.[0]?.messageId ?? msg.items?.[0]?.messageId ?? 1;

const API_CASES = [
  '/api/clients?q=',
  '/api/clients?q=Pen',
  '/api/custody/clients/1001',
  '/api/custody/clients/1001/household',
  '/api/custody/clients/1001/portfolio',
  '/api/custody/accounts/2001/statements',
  '/api/custody/accounts/2001/statements/2026-07-17',
  '/api/custody/accounts/2101/confirmations?from=2026-06-01&to=2026-07-31',
  '/api/custody/position-checks?date=2026-07-17',
  '/api/custody/position-checks?date=2026-07-17&mode=legacy',
  '/api/custody/position-checks',
  '/api/custody/position-checks?mode=legacy',
  '/api/custody/position-check-dates',
  '/api/custody/break-notes',
  '/api/custody/messages?type=535&page=1',
  `/api/custody/messages/${messageId}`,
  '/api/custody/admin/ingestion',
];

// [name, query, text that must be visible when the screen has rendered its data]
const SCREEN_CASES = [
  ['Client 360 (1001)', '?client=1001&screen=c360', 'The Penhaligon Family Trust'],
  ['Portfolio (1001)', '?client=1001&screen=portfolio', 'GB00ZZ011962'],
  ['Custody Holdings 2001 / 17-Jul-2026', '?client=1001&screen=custody-holdings&account=2001&date=2026-07-17', 'GB00ZZ011962'],
  ['Custody Settlements 2101', '?client=1055&screen=custody-settlements&account=2101&from=2026-06-01&to=2026-07-31', 'KS5400060214'],
  ['Position Check, all accounts 17-Jul-2026', '?screen=position-check&date=2026-07-17', 'GB00ZZ011962'],
  ['Position Check, all dates', '?screen=position-check', 'GB00ZZ000908'],
  ['Message Browser (MT535 list)', '?screen=message-browser&type=535', 'MT535_'],
  ['Custody Admin', '?screen=custody-admin', 'Archive root'],
  ['Client 360 HH-WHITFIELD (regression)', '?screen=c360', 'Whitfield'],
];

const stats = xs => { const s = [...xs].sort((a, b) => a - b); return { min: s[0], median: s[Math.floor(s.length / 2)], max: s.at(-1) }; };
const row = (name, ms, extra = '') => console.log(`${name.padEnd(62)} ${String(ms.min).padStart(6)} ${String(ms.median).padStart(6)} ${String(ms.max).padStart(6)}  ${ms.max < LIMIT_MS ? 'OK' : 'SLOW'} ${extra}`);
const header = t => console.log(`\n${t}\n${'case'.padEnd(62)} ${'min'.padStart(6)} ${'median'.padStart(6)} ${'max'.padStart(6)}  (ms, ${RUNS} runs, limit ${LIMIT_MS})`);

let slow = 0;
header('API');
for (const path of API_CASES) {
  const times = [];
  let status = 0, bytes = 0;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const res = await fetch(API + path);
    const body = await res.text();
    times.push(Math.round(performance.now() - t0));
    status = res.status; bytes = body.length;
  }
  const s = stats(times); if (s.max >= LIMIT_MS || status !== 200) slow++;
  row(path, s, `${status} ${bytes} B`);
}

header('Screens (navigation start → data text visible, fresh page each run)');
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--headless=new'] });
for (const [name, query, text] of SCREEN_CASES) {
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const t0 = performance.now();
    await page.goto(APP + '/' + query);
    await page.getByText(text).first().waitFor({ state: 'visible', timeout: 15000 });
    times.push(Math.round(performance.now() - t0));
    await page.close();
  }
  const s = stats(times); if (s.max >= LIMIT_MS) slow++;
  row(name, s);
}
await browser.close();
console.log(`\n${slow ? `${slow} case(s) over ${LIMIT_MS} ms or failed` : `all cases under ${LIMIT_MS} ms`}`);
process.exitCode = slow ? 1 : 0;
