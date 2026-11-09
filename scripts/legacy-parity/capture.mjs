#!/usr/bin/env node
// Captures the running legacy Portfolio Viewer's screens into a normalized golden snapshot.
// usage: node scripts/legacy-parity/capture.mjs [--pv http://localhost:8080] [--out <dir>]
//        [--user PVADMIN] [--password portfolio1] [--concurrency 6] [--accounts 2001,2002]
// Writes <out>/pv-golden.json.gz and <out>/manifest.json (counts). See README.md.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { compactDate, isoDate, num, text, ukDate } from './lib/normalize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SETTLEMENTS_FROM = '2026-04-01';
export const SETTLEMENTS_TO = '2026-10-31';

function parseArgs(argv) {
  const opts = { pv: 'http://localhost:8080', out: path.join(HERE, 'golden'), user: 'PVADMIN',
    password: process.env.PV_PASSWORD ?? 'portfolio1', concurrency: 6, accounts: null, queries: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (!(key in opts) || value === undefined) throw new Error(`unknown or incomplete option ${argv[i]}`);
    i += 1;
    if (key === 'concurrency') opts.concurrency = Number(value);
    else if (key === 'accounts') opts.accounts = value.split(',').map(Number);
    else if (key === 'queries') opts.queries = value.split(',');
    else opts[key] = value;
  }
  opts.pv = opts.pv.replace(/\/$/, '');
  return opts;
}

// Grid extraction runs in the page: header texts + cell texts (+ first link href per row).
async function readGrid(page, headerText) {
  return page.evaluate((wanted) => {
    for (const table of document.querySelectorAll('table.grid')) {
      const rows = [...table.rows];
      if (!rows.length) continue;
      const headers = [...rows[0].cells].map((c) => c.textContent.trim());
      if (!headers.includes(wanted)) continue;
      const body = rows.slice(1).filter((r) => r.cells.length === headers.length && r.querySelector('td'));
      return body.map((r) => {
        const cells = {};
        [...r.cells].forEach((c, i) => {
          cells[headers[i] || `col${i}`] = c.textContent;
          const a = c.querySelector('a[href]');
          if (a) cells[`${headers[i] || `col${i}`}@href`] = a.getAttribute('href');
        });
        return cells;
      });
    }
    return [];
  }, headerText);
}

const label = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`[id$="MainContent_${i}"]`);
  return el ? el.textContent : null;
}, id);

const options = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`select[id$="MainContent_${i}"]`);
  return el ? [...el.options].map((o) => ({ value: o.value, text: o.textContent })) : [];
}, id);

class PvSession {
  constructor(browser, opts) { this.browser = browser; this.opts = opts; }

  async open() {
    this.context = await this.browser.newContext();
    await this.context.route(/\.(gif|png|jpg|css)$/, (r) => r.abort());
    this.page = await this.context.newPage();
    await this.login();
    return this;
  }

  async login() {
    const { page, opts } = this;
    await page.goto(`${opts.pv}/Login.aspx`);
    await page.fill('input[name$="txtUser"]', opts.user);
    await page.fill('input[name$="txtPwd"]', opts.password);
    await Promise.all([page.waitForURL(/ClientSearch\.aspx/), page.click('input[type=submit][value="Log In"]')]);
  }

  async goto(rel) {
    const url = `${this.opts.pv}/${rel}`;
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        const at = this.page.url();
        if (/Login\.aspx/.test(at)) { await this.login(); continue; }
        if (/Error\.aspx/.test(at)) throw new Error(`PV error page for ${rel}`);
        return this.page;
      } catch (err) {
        if (attempt >= 3) throw err;
      }
    }
  }

  async postback(clickSelector) {
    await Promise.all([this.page.waitForLoadState('domcontentloaded'),
      this.page.waitForNavigation(), this.page.click(clickSelector)]);
    if (/Error\.aspx/.test(this.page.url())) throw new Error('PV error page after postback');
  }

  close() { return this.context.close(); }
}

async function pool(items, sessions, fn, onProgress) {
  const results = new Array(items.length);
  let next = 0; let done = 0;
  await Promise.all(sessions.map(async (s) => {
    while (next < items.length) {
      const i = next; next += 1;
      results[i] = await fn(s, items[i]);
      done += 1;
      if (onProgress) onProgress(done, items.length);
    }
  }));
  return results;
}

function progress(name) {
  let last = 0;
  return (done, total) => {
    const now = Date.now();
    if (done === total || now - last > 5000) { last = now; console.log(`  ${name}: ${done}/${total}`); }
  };
}

// --- screens -----------------------------------------------------------------------------

async function captureClientSearch(s, q) {
  const page = await s.goto('ClientSearch.aspx');
  await page.fill('input[name$="txtSearch"]', q);
  await s.postback('input[type=submit][value="Search"]');
  const clients = [];
  for (let pageNo = 1; ; pageNo += 1) {
    for (const r of await readGrid(s.page, 'Client Ref')) {
      clients.push({
        clientId: Number(/cid=(\d+)/.exec(r['Client Name@href'])[1]),
        clientRef: text(r['Client Ref']),
        name: text(r['Client Name']),
        status: text(r.Status),
        adviserName: text(r.Adviser),
        accountCount: num(r['No. Accts']),
      });
    }
    // GridView pager: numbered links in the last row; follow the next page number if present
    const nextLink = s.page.locator(`table.grid tr:last-child a:text-is("${pageNo + 1}")`);
    if (await nextLink.count() === 0) break;
    await Promise.all([s.page.waitForNavigation(), nextLink.first().click()]);
  }
  return { q, clients };
}

async function captureClientSummary(s, clientId) {
  const page = await s.goto(`ClientSummary.aspx?cid=${clientId}`);
  const accounts = (await readGrid(page, 'Acct No')).map((r) => ({
    acctNo: text(r['Acct No']),
    acctType: text(r['Acct Type']),
    baseCcy: text(r.Ccy),
    safeCode: text(r['Safe Code']),
    status: text(r.Status),
    openDate: isoDate(r.Opened),
    closeDate: isoDate(r.Closed),
    latestStatementDate: isoDate(r['Stmt Date']),
    latestMktValGbp: num(r['Mkt Val (GBP)']),
  }));
  return {
    client: {
      clientId,
      clientRef: text(await label(page, 'lblRef')),
      name: text(await label(page, 'lblName')),
      adviserName: text(await label(page, 'lblAdviser')),
      status: text(await label(page, 'lblStatus')),
      clientSince: isoDate(await label(page, 'lblSince')),
    },
    accounts,
    grandTotalGbp: num(await label(page, 'lblTotal')),
  };
}

async function captureAccountHeader(s, acct) {
  const page = await s.goto(`Holdings.aspx?acct=${acct.acctId}`);
  return {
    ...acct,
    safeCode: text(await label(page, 'lblSafe')),
    statementDates: (await options(page, 'ddlDate')).map((o) => isoDate(o.value)),
  };
}

async function captureHoldings(s, { acctId, date }) {
  const page = await s.goto(`Holdings.aspx?acct=${acctId}&stmt=${compactDate(date)}`);
  const lines = (await readGrid(page, 'ISIN')).map((r) => ({
    isin: text(r.ISIN),
    instrument: text(r.Instrument),
    qty: num(r.Qty),
    price: num(r.Px),
    ccy: text(r.Ccy),
    mktVal: num(r['Mkt Val']),
    mktValGbp: num(r['Mkt Val (GBP)']),
  }));
  return { acctId, statementDate: date, message: text(await label(page, 'lblMsg')),
    lines, totalGbp: lines.length ? num(await label(page, 'lblTotal')) : null };
}

async function captureSettlements(s, acctId) {
  const page = await s.goto(
    `Settlements.aspx?acct=${acctId}&from=${ukDate(SETTLEMENTS_FROM)}&to=${ukDate(SETTLEMENTS_TO)}`);
  const settlements = (await readGrid(page, 'Settle Date')).map((r) => ({
    tradeDate: isoDate(r['Trade Date']),
    settleDate: isoDate(r['Settle Date']),
    mtType: text(r.Msg),
    direction: text(r.Dir),
    isin: text(r.ISIN),
    instrument: text(r.Instrument),
    qty: num(r.Qty),
    amount: num(r.Amount),
    ccy: text(r.Ccy),
    seme: text(r.Ref),
  }));
  return { acctId, from: SETTLEMENTS_FROM, to: SETTLEMENTS_TO, message: text(await label(page, 'lblMsg')), settlements };
}

async function capturePositionCheck(s, { acctId, date }) {
  const page = await s.goto(`PositionCheck.aspx?acct=${acctId}&stmt=${compactDate(date)}`);
  const msg = text(await label(page, 'lblMsg'));
  const rows = (await readGrid(page, 'Prev Qty')).map((r) => ({
    isin: text(r.ISIN),
    instrument: text(r.Instrument),
    prevQty: num(r['Prev Qty']),
    netSettled: num(r['Net Settled']),
    expected: num(r.Expected),
    stmtQty: num(r['Stmt Qty']),
    diff: num(r.Diff),
    status: text(r.Status),
    note: text(r.Note),
    updatedBy: text(r['Updated By']),
    updatedAt: isoDate(r.Updated),
  }));
  if (msg !== null && msg !== 'No differences.' && msg !== 'No previous statement on file.')
    throw new Error(`unexpected position check message for ${acctId} ${date}: ${msg}`);
  return { acctId, statementDate: date, message: msg === 'No differences.' ? null : msg, rows };
}

async function captureCheckAll(s, date) {
  const page = await s.goto('PositionCheck.aspx');
  await page.selectOption('select[id$="MainContent_ddlAllDate"]', compactDate(date));
  await s.postback('input[type=submit][value="Check All"]');
  const accounts = (await readGrid(s.page, 'Differences')).map((r) => {
    const d = text(r.Differences);
    return {
      acctId: Number(/acct=(\d+)/.exec(r['col3@href'])[1]),
      acctNo: text(r['Acct No']),
      clientName: text(r.Client),
      breaks: d === '-' ? null : Number(d),
      hasPreviousStatement: d !== '-',
    };
  });
  return { statementDate: date, message: text(await label(s.page, 'lblMsg')), accounts };
}

async function captureArchiveStatus(s) {
  const page = await s.goto('Admin.aspx');
  return {
    mt535Count: num(await label(page, 'lbl535')),
    mt54xCount: num(await label(page, 'lbl54x')),
    statements: num(await label(page, 'lblStmts')),
    confirmations: num(await label(page, 'lblConfs')),
    parseErrors: num(await label(page, 'lblErrs')),
  };
}

export function goldenStats(g) {
  return {
    clientSearches: g.clientSearch.length,
    clients: g.clientSummaries.length,
    accounts: g.accounts.length,
    statements: g.holdings.length,
    holdingLines: g.holdings.reduce((n, h) => n + h.lines.length, 0),
    settlementAccounts: g.settlements.length,
    settlements: g.settlements.reduce((n, x) => n + x.settlements.length, 0),
    positionChecks: g.positionChecks.length,
    positionCheckNoPrevious: g.positionChecks.filter((p) => p.message).length,
    positionCheckBreaks: g.positionChecks.reduce((n, p) => n + p.rows.length, 0),
    checkAllDates: g.checkAll.length,
    checkAllRows: g.checkAll.reduce((n, c) => n + c.accounts.length, 0),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const browser = await chromium.launch(process.env.PV_CHROME ? { executablePath: process.env.PV_CHROME } : {});
  const sessions = await Promise.all(Array.from({ length: opts.concurrency }, () => new PvSession(browser, opts).open()));
  const s0 = sessions[0];
  try {
    console.log(`Capturing Portfolio Viewer at ${opts.pv} as ${opts.user}`);
    const archive = await captureArchiveStatus(s0);

    // account list as offered by Position Check (every account, ordered by acct no)
    await s0.goto('PositionCheck.aspx');
    let accounts = (await options(s0.page, 'ddlAcct')).map((o) => {
      const [acctNo, ...rest] = o.text.split(' - ');
      return { acctId: Number(o.value), acctNo: text(acctNo), clientName: text(rest.join(' - ')) };
    });
    const statementDates = (await options(s0.page, 'ddlAllDate')).map((o) => isoDate(o.value));
    if (opts.accounts) accounts = accounts.filter((a) => opts.accounts.includes(a.acctId));
    console.log(`  ${accounts.length} accounts, ${statementDates.length} statement dates`);

    accounts = await pool(accounts, sessions, captureAccountHeader, progress('accounts'));

    const all = await captureClientSearch(s0, '');
    const queries = opts.queries ?? [...new Set(['', 'trust', 'family', 'mr ', 'PV2', 'C20', 'zzz-no-match',
      ...all.clients.slice(0, 5).map((c) => c.clientRef)])];
    const clientSearch = await pool(queries, sessions, captureClientSearch, progress('client search'));
    const clientIds = all.clients.map((c) => c.clientId).sort((a, b) => a - b);
    const clientSummaries = await pool(clientIds, sessions, captureClientSummary, progress('client summaries'));

    const acctDates = accounts.flatMap((a) => a.statementDates.map((date) => ({ acctId: a.acctId, date })));
    const holdings = await pool(acctDates, sessions, captureHoldings, progress('holdings'));
    const settlements = await pool(accounts.map((a) => a.acctId), sessions, captureSettlements, progress('settlements'));
    const positionChecks = await pool(acctDates, sessions, capturePositionCheck, progress('position checks'));
    const checkAll = await pool(statementDates, sessions, captureCheckAll, progress('check all'));

    const golden = {
      format: 'pv-golden/1',
      source: { system: 'Portfolio Viewer v3.2.1 (build 2018.11)', user: opts.user },
      settlementsWindow: { from: SETTLEMENTS_FROM, to: SETTLEMENTS_TO },
      archive, accounts, statementDates, clientSearch, clientSummaries,
      holdings, settlements, positionChecks, checkAll,
    };
    const json = `${JSON.stringify(golden, null, 1)}\n`;
    await mkdir(opts.out, { recursive: true });
    await writeFile(path.join(opts.out, 'pv-golden.json.gz'), gzipSync(json, { level: 9 }));
    const manifest = { format: golden.format, sha256: createHash('sha256').update(json).digest('hex'),
      stats: goldenStats(golden), archive };
    await writeFile(path.join(opts.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify(manifest.stats, null, 2));
    console.log(`Golden written to ${opts.out} in ${Math.round((Date.now() - started) / 1000)} s`);
  } finally {
    await Promise.all(sessions.map((s) => s.close()));
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
