import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const WIKI = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform';

const holdings = (page: Page) => page.getByRole('table', { name: 'Holdings', exact: true });
const holdingRows = (page: Page) => holdings(page).locator('tbody tr');
const holdingRow = (page: Page, symbol: string) =>
  holdingRows(page).filter({ has: page.getByRole('rowheader', { name: symbol, exact: true }) });
const filters = (page: Page) => page.getByRole('search', { name: 'Filter portfolio' });
const clientFilter = (page: Page) => filters(page).getByLabel('Client', { exact: true });
const accountFilter = (page: Page) => filters(page).getByLabel('Account', { exact: true });
const instrumentFilter = (page: Page) => filters(page).getByLabel('Instrument', { exact: true });
const totals = (page: Page, ccy: 'CAD' | 'USD') => page.getByLabel(`${ccy} totals`, { exact: true });

async function expectHolding(page: Page, h: { symbol: string; name?: string; account: string; ccy: string; qty: string; price: string; value: string }) {
  const row = holdingRow(page, h.symbol);
  await expect(row).toHaveCount(1);
  const cells = row.locator('th, td');
  await expect(cells.nth(0)).toHaveText(h.symbol);
  if (h.name) await expect(cells.nth(1)).toHaveText(h.name);
  await expect(cells.nth(2)).toContainText(`(${h.account})`);
  await expect(cells.nth(3)).toHaveText(h.ccy);
  await expect(cells.nth(4)).toHaveText(h.qty);
  await expect(cells.nth(5)).toContainText(h.price);
  await expect(cells.nth(6)).toContainText(h.value);
  if (h.ccy === 'USD') {
    await expect(cells.nth(5)).toContainText('US$');
    await expect(cells.nth(6)).toContainText('US$');
  }
}

const RY = { symbol: 'RY', name: 'Royal Bank of Canada', account: 'A1001', ccy: 'CAD', qty: '100', price: '140.00', value: '14,000.00' };
const BMO = { symbol: 'BMO', account: 'A1002', ccy: 'CAD', qty: '80', price: '125.00', value: '10,000.00' };
const MSFT = { symbol: 'MSFT', account: 'A1003', ccy: 'USD', qty: '40', price: '420.00', value: '16,800.00' };

async function expectListedSymbols(page: Page, symbols: string[]) {
  await expect(holdingRows(page).locator('th')).toHaveText(symbols.slice().sort());
}

async function expectMarketTotal(page: Page, ccy: 'CAD' | 'USD', amount: string) {
  const t = totals(page, ccy);
  await expect(t).toBeVisible();
  await expect(t.getByText(`Market value (${ccy})`, { exact: true })).toBeVisible();
  await expect(t.locator('dd').first()).toContainText(amount);
  if (ccy === 'USD') await expect(t.locator('dd').first()).toContainText('US$');
}

async function expectNoTotalOrZero(page: Page, ccy: 'CAD' | 'USD') {
  const t = totals(page, ccy);
  if (await t.count()) await expect(t.locator('dd').first()).toContainText('0.00');
  if (await t.count()) await expect(t.locator('dd').first()).not.toContainText(/[1-9]/);
}

async function expectNoMixedTotals(page: Page) {
  const main = page.getByRole('tabpanel');
  for (const mixed of ['40,800', '50,000', '90,800']) await expect(main.getByText(mixed)).toHaveCount(0);
}

async function expectAllHoldings(page: Page) {
  await expectListedSymbols(page, ['BMO', 'MSFT', 'RY']);
  await expectHolding(page, RY);
  await expectHolding(page, BMO);
  await expectHolding(page, MSFT);
  await expectMarketTotal(page, 'CAD', '24,000.00');
  await expectMarketTotal(page, 'USD', '16,800.00');
}

caseTest('WM-TC-009', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expect(clientFilter(page)).toHaveValue('All');
  await expect(accountFilter(page)).toHaveValue('All');
  await expect(instrumentFilter(page)).toHaveValue('All');
  await expectListedSymbols(page, ['BMO', 'MSFT', 'RY']);
  await expect(holdingRow(page, 'RY').locator('td').nth(1)).toContainText('(A1001)');
  await expect(holdingRow(page, 'BMO').locator('td').nth(1)).toContainText('(A1002)');
  await expect(holdingRow(page, 'MSFT').locator('td').nth(1)).toContainText('(A1003)');
  await expectHolding(page, RY);
  await expectHolding(page, BMO);
  await expectHolding(page, MSFT);
});

caseTest('WM-TC-010', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expectMarketTotal(page, 'CAD', '24,000.00');
  await expectMarketTotal(page, 'USD', '16,800.00');
  await expectNoMixedTotals(page);
  await page.reload();
  await expectMarketTotal(page, 'CAD', '24,000.00');
  await expectMarketTotal(page, 'USD', '16,800.00');
  await expectNoMixedTotals(page);
});

caseTest('WM-TC-011', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1001');
  await expectListedSymbols(page, ['BMO', 'RY']);
  await expectHolding(page, RY);
  await expectHolding(page, BMO);
  await expectMarketTotal(page, 'CAD', '24,000.00');
  await expectNoTotalOrZero(page, 'USD');
  await expect(holdingRow(page, 'MSFT')).toHaveCount(0);
  await expect(holdingRows(page).getByText('A1003')).toHaveCount(0);
});

caseTest('WM-TC-012', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1002');
  await expectListedSymbols(page, ['MSFT']);
  await expectHolding(page, MSFT);
  await expectMarketTotal(page, 'USD', '16,800.00');
  await expectNoTotalOrZero(page, 'CAD');
  for (const sym of ['RY', 'BMO']) await expect(holdingRow(page, sym)).toHaveCount(0);
  for (const acct of ['A1001', 'A1002']) await expect(holdingRows(page).getByText(acct)).toHaveCount(0);
});

caseTest('WM-TC-013', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1001');
  await accountFilter(page).selectOption('A1002');
  await expectListedSymbols(page, ['BMO']);
  await expectHolding(page, BMO);
  await expectMarketTotal(page, 'CAD', '10,000.00');
  await expect(holdingRows(page).getByText('A1001')).toHaveCount(0);
  await expect(holdingRow(page, 'RY')).toHaveCount(0);
});

caseTest('WM-TC-014', async ({ page }) => {
  await openArea(page, 'portfolio');
  const clear = filters(page).getByRole('button', { name: 'Clear filters' });
  if (await clear.isEnabled()) await clear.click();
  await expect(clientFilter(page)).toHaveValue('All');
  await expect(accountFilter(page)).toHaveValue('All');
  await instrumentFilter(page).selectOption('MSFT');
  await expectListedSymbols(page, ['MSFT']);
  await expectHolding(page, MSFT);
  await expectMarketTotal(page, 'USD', '16,800.00');
  await expectNoTotalOrZero(page, 'CAD');
  await expect(holdingRows(page).getByText('CAD', { exact: true })).toHaveCount(0);
  await instrumentFilter(page).selectOption('RY');
  await expectListedSymbols(page, ['RY']);
  await expectHolding(page, RY);
  await expectMarketTotal(page, 'CAD', '14,000.00');
  await expect(totals(page, 'USD')).toHaveCount(0);
});

caseTest('WM-TC-015', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1001');
  await expectListedSymbols(page, ['BMO', 'RY']);
  await expect(instrumentFilter(page).locator('option', { hasText: 'MSFT' })).toHaveCount(1);
  await instrumentFilter(page).selectOption('MSFT');
  await expect(holdingRows(page).locator('th')).toHaveCount(0);
  await expect(holdings(page).getByText('No holdings match these filters.')).toBeVisible();
  await expect(page.getByRole('tabpanel').getByText('16,800.00')).toHaveCount(0);
  await expectNoTotalOrZero(page, 'USD');
  await expectNoTotalOrZero(page, 'CAD');
  for (const hidden of ['A1003', 'James Chen', 'Chen USD Investment']) await expect(holdingRows(page).getByText(hidden)).toHaveCount(0);
});

caseTest('WM-TC-016', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1002');
  await expect(accountFilter(page).locator('option')).toHaveText(['All accounts', /Chen USD Investment \(A1003\)/]);
  await accountFilter(page).selectOption('A1003');
  await expectListedSymbols(page, ['MSFT']);
  await clientFilter(page).selectOption('C1001');
  await expect(accountFilter(page)).not.toHaveValue('A1003');
  await expect(holdingRow(page, 'MSFT')).toHaveCount(0);
  await expectListedSymbols(page, ['BMO', 'RY']);
  await expect(accountFilter(page).locator('option')).toHaveText(['All accounts', /\(A1001\)/, /\(A1002\)/]);
  await expect(accountFilter(page).locator('option', { hasText: 'A1003' })).toHaveCount(0);
});

caseTest('WM-TC-017', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1001');
  await accountFilter(page).selectOption('A1001');
  await instrumentFilter(page).selectOption('RY');
  await expectListedSymbols(page, ['RY']);
  await expectHolding(page, RY);
  await expectMarketTotal(page, 'CAD', '14,000.00');
  await filters(page).getByRole('button', { name: 'Clear filters' }).click();
  await expect(clientFilter(page)).toHaveValue('All');
  await expect(accountFilter(page)).toHaveValue('All');
  await expect(instrumentFilter(page)).toHaveValue('All');
  await expectAllHoldings(page);
  await expectNoMixedTotals(page);
});

caseTest('WM-TC-018', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expectHolding(page, RY);
  await expectMarketTotal(page, 'CAD', '24,000.00');

  await page.getByRole('tab', { name: /^Orders/ }).click();
  const ticket = page.getByRole('form', { name: 'New order' });
  await ticket.getByLabel('Account', { exact: true }).selectOption('A1001');
  await ticket.getByLabel('Instrument', { exact: true }).selectOption('RY');
  await ticket.getByRole('radio', { name: 'Sell', exact: true }).check();
  await ticket.getByLabel('Quantity', { exact: true }).fill('10');
  await ticket.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Sell order .*10 RY.*\(A1001\)\. Status: Open\./ })).toBeVisible();
  const order = page.getByRole('table', { name: 'Orders', exact: true }).locator('tbody tr')
    .filter({ hasText: 'RY' }).filter({ hasText: 'Sell' }).filter({ hasText: 'Open' });
  await expect(order.first()).toBeVisible();

  await page.getByRole('tab', { name: /^Portfolio/ }).click();
  await expectHolding(page, RY);
  await expectMarketTotal(page, 'CAD', '24,000.00');

  await page.reload();
  await expect(page.getByRole('tab', { name: /^Portfolio/ })).toHaveAttribute('aria-selected', 'true');
  await expectHolding(page, RY);
  await expectMarketTotal(page, 'CAD', '24,000.00');
});

const num = (s: string) => Number(s.replace(/\u2212/g, '-').replace(/[^0-9.-]/g, ''));
const text = async (l: Locator) => (await l.innerText()).trim();

function pathPoints(d: string) {
  return [...d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }));
}

gapTest('WM-GAP-020', {
  title: 'Legacy Portfolio Detail period selector updates portfolio/benchmark return figures and both chart paths consistently',
  area: 'portfolio',
  wikiRef: `${WIKI}/page/3.1.1`,
}, async ({ page }) => {
  await openArea(page, 'portfolio');
  await page.goto('/?screen=portfolio');
  const title = page.locator('span', { hasText: /^Performance vs benchmark/ }).first();
  await expect(title).toBeVisible();
  const card = page.locator('div').filter({ has: title }).filter({ has: page.locator('svg path') }).last();
  const perfFig = card.locator('span', { hasText: /^Portfolio\s/ }).locator('strong');
  const benchFig = card.locator('span', { hasText: /^Benchmark/ }).locator('strong');
  const benchPath = card.locator('svg path').nth(0);
  const perfPath = card.locator('svg path').nth(1);
  await expect(card.locator('svg path')).toHaveCount(2);

  const periods: [string, number, number][] = [
    ['1M', 0.4, 0.35], ['3M', 2.1, 1.8], ['YTD', 7.84, 7.12], ['1Y', 11.6, 10.4], ['3Y', 28.9, 26.2], ['Since inception', 142.3, 128.7],
  ];
  const seen = new Set<string>();
  let prev = { p: await perfPath.getAttribute('d'), b: await benchPath.getAttribute('d') };
  for (const [code, pr, br] of periods) {
    await card.getByText(code, { exact: true }).click();
    await expect(perfFig).toHaveText(`+${pr.toFixed(2)}%`);
    await expect(benchFig).toHaveText(`+${br.toFixed(2)}%`);
    const p = (await perfPath.getAttribute('d')) ?? '';
    const b = (await benchPath.getAttribute('d')) ?? '';
    expect(p, `${code}: portfolio path must change`).not.toBe(prev.p);
    expect(b, `${code}: benchmark path must change`).not.toBe(prev.b);
    expect(seen.has(p), `${code}: portfolio path must be unique to its period`).toBe(false);
    seen.add(p);
    const pp = pathPoints(p), bp = pathPoints(b);
    expect(pp.length).toBeGreaterThan(1);
    expect(bp.length).toBe(pp.length);
    expect(pp[0]).toEqual(bp[0]);
    const y0 = pp[0].y, py = pp[pp.length - 1].y, by = bp[bp.length - 1].y;
    expect(py, `${code}: portfolio line ends above benchmark line`).toBeLessThan(by);
    expect((y0 - py) / (y0 - by)).toBeCloseTo(num(await text(perfFig)) / num(await text(benchFig)), 1);
    if (code === 'YTD') {
      const ytdKpi = page.getByText('YTD return (TWR)', { exact: true }).locator('xpath=following-sibling::span[1]');
      await expect(ytdKpi).toHaveText(await text(perfFig));
    }
    prev = { p, b };
  }
});

gapTest('WM-GAP-021', {
  title: 'Legacy Alternatives KPIs (committed, called, unfunded=committed-called, current value, DPI, TVPI) consistent with commitments grid rows',
  area: 'portfolio',
  wikiRef: `${WIKI}/page/3.1.3`,
}, async ({ page }) => {
  await openArea(page, 'portfolio');
  await page.goto('/?screen=alts');
  const kpi = (label: string) => page.getByText(label, { exact: true }).first().locator('xpath=following-sibling::span[1]');
  const kpiSub = (label: string) => page.getByText(label, { exact: true }).first().locator('xpath=following-sibling::span[2]');
  await expect(kpi('Committed')).toBeVisible();

  const header = page.getByText('Fund · account', { exact: true }).locator('xpath=..');
  const rows = header.locator('xpath=following-sibling::div');
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  await expect(kpiSub('Committed')).toContainText(`${n} funds`);

  let committed = 0, called = 0, dist = 0, nav = 0;
  for (let i = 0; i < n; i++) {
    const cells = rows.nth(i).locator(':scope > *');
    const c = num(await text(cells.nth(2)));
    const calledText = await text(cells.nth(3).locator('span').first());
    const [calledAmt, calledPct] = calledText.split('·').map(s => s.trim());
    const k = num(calledAmt);
    const u = num(await text(cells.nth(4)));
    const d = num(await text(cells.nth(5)));
    const v = num(await text(cells.nth(6).locator('span').first()));
    expect(u, `row ${i}: unfunded = committed - called`).toBe(c - k);
    expect(num(calledPct)).toBe(Math.round(k / c * 100));
    await expect(cells.nth(7)).toHaveText(`${(d / k).toFixed(2)}x`);
    await expect(cells.nth(8)).toHaveText(`${((d + v) / k).toFixed(2)}x`);
    committed += c; called += k; dist += d; nav += v;
  }
  const money = (x: number) => '$' + Math.round(x).toLocaleString('en-US');
  await expect(kpi('Committed')).toHaveText(money(committed));
  await expect(kpi('Called to date')).toHaveText(money(called));
  await expect(kpiSub('Called to date')).toHaveText(`${(called / committed * 100).toFixed(1)}% of committed`);
  await expect(kpi('Unfunded')).toHaveText(money(committed - called));
  await expect(kpi('Current value')).toHaveText(money(nav));
  await expect(kpi('Distributions received')).toHaveText(money(dist));
  await expect(kpiSub('Distributions received')).toHaveText(`DPI ${(dist / called).toFixed(2)}x`);
  await expect(kpi('Net TVPI')).toHaveText(`${((dist + nav) / called).toFixed(2)}x`);

  await page.goto('/?screen=portfolio');
  await expect(kpi('Unfunded commitments')).toHaveText(money(committed - called));
});

gapTest('WM-GAP-022', {
  title: '"Refresh data" request failure shows refresh error (not stale success); later refresh clears it and shows real data',
  area: 'portfolio',
  wikiRef: `${WIKI}/page/1.2`,
}, async ({ page }) => {
  await openArea(page, 'portfolio');
  await expectAllHoldings(page);
  const refreshBtn = page.getByRole('button', { name: 'Refresh data', exact: true });
  const loadedLabel = page.getByText(/^Data loaded /);
  await expect(loadedLabel).toBeVisible();
  const loadedBefore = await text(loadedLabel);

  await page.route('**/api/workflows/bootstrap**', route => route.abort('failed'));
  const failed = page.waitForEvent('requestfailed', r => r.url().includes('/api/workflows/bootstrap'));
  await refreshBtn.click();
  await failed;
  const alert = page.getByRole('alert').filter({ hasText: 'Could not refresh workspace data' });
  await expect(alert).toBeVisible();
  await expect(loadedLabel).toHaveText(loadedBefore);
  await expect(page.getByRole('status').filter({ hasText: /refreshed|up to date|success/i })).toHaveCount(0);
  await expect(refreshBtn).toBeEnabled();

  await page.unroute('**/api/workflows/bootstrap**');
  const ok = page.waitForResponse(r => r.url().includes('/api/workflows/bootstrap') && r.request().method() === 'GET');
  await refreshBtn.click();
  expect((await ok).status()).toBe(200);
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(loadedLabel).toBeVisible();
  await expectAllHoldings(page);
  await clientFilter(page).selectOption('C1002');
  await expectListedSymbols(page, ['MSFT']);
});
