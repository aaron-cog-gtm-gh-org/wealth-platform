import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const API_URL = process.env.QA_API_URL ?? 'http://localhost:3001';

const panel = (page: Page) => page.getByRole('tabpanel', { name: 'Portfolio' });
const filter = (page: Page, name: 'Client' | 'Account' | 'Instrument') =>
  panel(page).getByRole('search', { name: 'Filter portfolio' }).getByRole('combobox', { name, exact: true });
const holdings = (page: Page) => panel(page).getByRole('table', { name: 'Holdings' });
const holdingRows = (page: Page) => holdings(page).locator('tbody tr');
const holdingRow = (page: Page, symbol: string) =>
  holdingRows(page).filter({ has: page.getByRole('rowheader', { name: symbol, exact: true }) });
const cashTable = (page: Page) => panel(page).getByRole('table', { name: 'Cash by account' });
const totals = (page: Page) => panel(page).getByRole('region', { name: 'Totals by currency' });
const currencyTotals = (page: Page, ccy: 'CAD' | 'USD') => totals(page).locator(`dl[aria-label="${ccy} totals"]`);
const marketValueTotal = (page: Page, ccy: 'CAD' | 'USD') =>
  currencyTotals(page, ccy).locator('div', { has: page.getByRole('term').filter({ hasText: `Market value (${ccy})` }) }).getByRole('definition');

async function choose(select: Locator, option: string | { label: string }) {
  await select.click();
  await select.selectOption(option);
}

async function expectListedSymbols(page: Page, symbols: string[]) {
  await expect(holdingRows(page)).toHaveCount(symbols.length);
  await expect
    .poll(async () => (await holdingRows(page).getByRole('rowheader').allTextContents()).map(s => s.trim()).sort())
    .toEqual([...symbols].sort());
}

async function expectHolding(page: Page, symbol: string, cells: string[]) {
  await expect(holdingRow(page, symbol)).toHaveCount(1);
  await expect(holdingRow(page, symbol).getByRole('cell')).toHaveText(cells);
}

const RY = ['Royal Bank of Canada', 'Whitfield Investment (A1001)', 'CAD', '100', '$140.00', '$14,000.00'];
const BMO = ['Bank of Montreal', 'Whitfield Savings (A1002)', 'CAD', '80', '$125.00', '$10,000.00'];
const MSFT = ['Microsoft Corporation', 'Chen USD Investment (A1003)', 'USD', '40', 'US$420.00', 'US$16,800.00'];

async function expectNoMixedTotal(page: Page) {
  await expect(totals(page)).not.toContainText('40,800');
  await expect(panel(page)).not.toContainText('40,800');
}

caseTest('WM-TC-009', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expect(filter(page, 'Client')).toHaveValue('All');
  await expect(filter(page, 'Account')).toHaveValue('All');
  await expect(filter(page, 'Instrument')).toHaveValue('All');
  await expectListedSymbols(page, ['RY', 'BMO', 'MSFT']);
  await expect(holdingRow(page, 'RY')).toContainText('A1001');
  await expect(holdingRow(page, 'BMO')).toContainText('A1002');
  await expect(holdingRow(page, 'MSFT')).toContainText('A1003');

  await holdingRow(page, 'RY').click();
  await expectHolding(page, 'RY', RY);
  await holdingRow(page, 'BMO').click();
  await expectHolding(page, 'BMO', BMO);
  await holdingRow(page, 'MSFT').click();
  await expectHolding(page, 'MSFT', MSFT);
});

caseTest('WM-TC-010', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expectListedSymbols(page, ['RY', 'BMO', 'MSFT']);
  await totals(page).click();
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$24,000.00');
  await expect(marketValueTotal(page, 'USD')).toHaveText('US$16,800.00');

  await expect(totals(page).locator('dl')).toHaveCount(2);
  await expectNoMixedTotal(page);

  await page.reload();
  await page.waitForLoadState('load');
  await expectListedSymbols(page, ['RY', 'BMO', 'MSFT']);
  await totals(page).click();
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$24,000.00');
  await expect(marketValueTotal(page, 'USD')).toHaveText('US$16,800.00');
  await expect(totals(page).locator('dl')).toHaveCount(2);
  await expectNoMixedTotal(page);
});

caseTest('WM-TC-011', async ({ page }) => {
  await openArea(page, 'portfolio');
  await choose(filter(page, 'Client'), { label: 'Eleanor Whitfield (C1001)' });
  await expect(filter(page, 'Client')).toHaveValue('C1001');
  await expectListedSymbols(page, ['RY', 'BMO']);
  await expect(holdingRow(page, 'RY')).toContainText('A1001');
  await expect(holdingRow(page, 'BMO')).toContainText('A1002');

  await totals(page).click();
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$24,000.00');
  if (await currencyTotals(page, 'USD').count()) await expect(marketValueTotal(page, 'USD')).toHaveText('US$0.00');

  await holdings(page).click();
  await expect(holdings(page)).not.toContainText('MSFT');
  await expect(holdings(page)).not.toContainText('A1003');
  await expect(cashTable(page)).not.toContainText('A1003');
});

caseTest('WM-TC-012', async ({ page }) => {
  await openArea(page, 'portfolio');
  await choose(filter(page, 'Client'), { label: 'James Chen (C1002)' });
  await expect(filter(page, 'Client')).toHaveValue('C1002');
  await expectListedSymbols(page, ['MSFT']);
  await expectHolding(page, 'MSFT', MSFT);

  await totals(page).click();
  await expect(marketValueTotal(page, 'USD')).toHaveText('US$16,800.00');
  if (await currencyTotals(page, 'CAD').count()) await expect(marketValueTotal(page, 'CAD')).toHaveText('$0.00');

  await holdings(page).click();
  for (const absent of ['RY', 'BMO', 'A1001', 'A1002']) {
    await expect(holdings(page)).not.toContainText(absent);
    await expect(cashTable(page)).not.toContainText(absent);
  }
});

caseTest('WM-TC-013', async ({ page }) => {
  await openArea(page, 'portfolio');
  await choose(filter(page, 'Client'), { label: 'Eleanor Whitfield (C1001)' });
  await choose(filter(page, 'Account'), { label: 'Whitfield Savings (A1002) · CAD' });
  await expect(filter(page, 'Account')).toHaveValue('A1002');
  await expectListedSymbols(page, ['BMO']);
  await expectHolding(page, 'BMO', BMO);

  await totals(page).click();
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$10,000.00');
  await expect(holdings(page)).not.toContainText('RY');
  await expect(holdings(page)).not.toContainText('A1001');
});

caseTest('WM-TC-014', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expect(page.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  await expect(filter(page, 'Client')).toHaveValue('All');
  await expect(filter(page, 'Account')).toHaveValue('All');
  await choose(filter(page, 'Instrument'), 'MSFT');
  await expect(filter(page, 'Instrument')).toHaveValue('MSFT');
  await expectListedSymbols(page, ['MSFT']);
  await expect(holdingRow(page, 'MSFT')).toContainText('A1003');

  await totals(page).click();
  await expectHolding(page, 'MSFT', MSFT);
  await expect(marketValueTotal(page, 'USD')).toHaveText('US$16,800.00');
  await expect(currencyTotals(page, 'CAD')).toHaveCount(0);
  await expect(totals(page)).not.toContainText('$22,987');

  await choose(filter(page, 'Instrument'), 'RY');
  await expect(filter(page, 'Instrument')).toHaveValue('RY');
  await expectListedSymbols(page, ['RY']);
  await expect(holdingRow(page, 'RY')).toContainText('A1001');
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$14,000.00');
  await expect(currencyTotals(page, 'USD')).toHaveCount(0);
});

caseTest('WM-TC-015', async ({ page }) => {
  await openArea(page, 'portfolio');
  await choose(filter(page, 'Client'), { label: 'Eleanor Whitfield (C1001)' });
  await expectListedSymbols(page, ['RY', 'BMO']);

  await filter(page, 'Instrument').click();
  await expect(filter(page, 'Instrument').locator('option', { hasText: /^MSFT$/ })).toHaveCount(1);
  await filter(page, 'Instrument').selectOption('MSFT');
  await expect(filter(page, 'Instrument')).toHaveValue('MSFT');
  await expect(holdingRows(page).getByRole('rowheader')).toHaveCount(0);
  await expect(holdings(page)).toContainText('No holdings match these filters.');

  await totals(page).click();
  await expect(totals(page)).not.toContainText('16,800.00');
  for (const ccy of ['CAD', 'USD'] as const) {
    if (await currencyTotals(page, ccy).count()) await expect(marketValueTotal(page, ccy)).toHaveText(/^(US)?\$0\.00$/);
  }
  await expect(holdings(page)).not.toContainText('A1003');
  await expect(cashTable(page)).not.toContainText('James Chen');
});

caseTest('WM-TC-016', async ({ page }) => {
  await openArea(page, 'portfolio');
  await choose(filter(page, 'Client'), { label: 'James Chen (C1002)' });
  await filter(page, 'Account').click();
  await expect(filter(page, 'Account').locator('option')).toHaveText(['All accounts', 'Chen USD Investment (A1003) · USD']);

  await filter(page, 'Account').selectOption({ label: 'Chen USD Investment (A1003) · USD' });
  await expect(filter(page, 'Account')).toHaveValue('A1003');
  await expectListedSymbols(page, ['MSFT']);

  await choose(filter(page, 'Client'), { label: 'Eleanor Whitfield (C1001)' });
  await expect(filter(page, 'Account')).not.toHaveValue('A1003');
  await expectListedSymbols(page, ['RY', 'BMO']);
  await expect(holdings(page)).not.toContainText('MSFT');

  await filter(page, 'Account').click();
  await expect(filter(page, 'Account').locator('option')).toHaveText([
    'All accounts',
    'Whitfield Investment (A1001) · CAD',
    'Whitfield Savings (A1002) · CAD',
  ]);
  await expect(filter(page, 'Account').locator('option', { hasText: 'A1003' })).toHaveCount(0);
});

caseTest('WM-TC-017', async ({ page }) => {
  await openArea(page, 'portfolio');
  await choose(filter(page, 'Client'), { label: 'Eleanor Whitfield (C1001)' });
  await choose(filter(page, 'Account'), { label: 'Whitfield Investment (A1001) · CAD' });
  await choose(filter(page, 'Instrument'), 'RY');
  await expect(filter(page, 'Instrument')).toHaveValue('RY');
  await expectListedSymbols(page, ['RY']);
  await expectHolding(page, 'RY', RY);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(filter(page, 'Client')).toHaveValue('All');
  await expect(filter(page, 'Account')).toHaveValue('All');
  await expect(filter(page, 'Instrument')).toHaveValue('All');
  await expectListedSymbols(page, ['RY', 'BMO', 'MSFT']);
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$24,000.00');
  await expect(marketValueTotal(page, 'USD')).toHaveText('US$16,800.00');
  await expectNoMixedTotal(page);
});

caseTest('WM-TC-018', async ({ page }) => {
  await openArea(page, 'portfolio');
  await holdingRow(page, 'RY').click();
  await expectHolding(page, 'RY', RY);

  await page.getByRole('tab', { name: /^Orders(\s|$)/ }).click();
  const ticket = page.getByRole('form', { name: 'New order' });
  await choose(ticket.getByLabel('Account'), { label: 'Whitfield Investment (A1001) · CAD' });
  await choose(ticket.getByLabel('Instrument'), 'RY');
  await ticket.locator('label', { hasText: /^Sell$/ }).click();
  await expect(ticket.getByRole('radio', { name: 'Sell' })).toBeChecked();
  await ticket.getByLabel('Quantity').click();
  await ticket.getByLabel('Quantity').fill('10');
  await ticket.getByRole('button', { name: 'Place order' }).click();
  await expect(ticket.getByRole('status')).toContainText('Sell order');
  await expect(ticket.getByRole('status')).toContainText('10 RY');
  await expect(ticket.getByRole('status')).toContainText('Status: Open');

  await page.getByRole('tab', { name: /^Portfolio(\s|$)/ }).click();
  await holdingRow(page, 'RY').click();
  await expectHolding(page, 'RY', RY);
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$24,000.00');

  await page.reload();
  await page.waitForLoadState('load');
  await expect(page.getByRole('tab', { name: /^Portfolio(\s|$)/ })).toHaveAttribute('aria-selected', 'true');
  await holdingRow(page, 'RY').click();
  await expectHolding(page, 'RY', RY);
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$24,000.00');
});

const PERIODS = [
  { code: '1M', start: '12-Sep-2026', portfolio: '+0.40%', benchmark: '+0.35%' },
  { code: '3M', start: '12-Jul-2026', portfolio: '+2.10%', benchmark: '+1.80%' },
  { code: 'YTD', start: '01-Jan-2026', portfolio: '+7.84%', benchmark: '+7.12%' },
  { code: '1Y', start: '12-Oct-2025', portfolio: '+11.60%', benchmark: '+10.40%' },
  { code: '3Y', start: '12-Oct-2023', portfolio: '+28.90%', benchmark: '+26.20%' },
  { code: 'Since inception', start: '02-Mar-2009', portfolio: '+142.30%', benchmark: '+128.70%' },
];

type PerformancePeriod = { code: string; portfolioReturnPct: number; benchmarkReturnPct: number; portfolio: number[]; benchmark: number[] };

const pathPoints = (d: string | null) =>
  [...(d ?? '').matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);

gapTest('WM-GAP-020', {
  title: 'Legacy Portfolio Detail (/?screen=portfolio) period selector updates the displayed returns and the performance/benchmark chart paths consistently for each period',
  area: 'portfolio',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.1.1',
}, async ({ page }) => {
  const response = await page.request.get(`${API_URL}/api/households/HH-WHITFIELD/performance`);
  expect(response.ok()).toBe(true);
  const series = new Map(((await response.json()) as { periods: PerformancePeriod[] }).periods.map(p => [p.code, p]));

  await openArea(page, 'portfolio');
  await page.getByRole('link', { name: 'Client 360 and household views' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Client 360' })).toBeVisible();
  await page.getByRole('navigation').getByText('Portfolio detail', { exact: true }).click();
  await expect(page).toHaveURL(/[?&]screen=portfolio(&|$)/);
  await expect(page.getByRole('heading', { level: 1, name: 'Portfolio detail' })).toBeVisible();

  const chart = page.locator('div')
    .filter({ hasText: /^Performance vs benchmark/ })
    .filter({ has: page.locator('svg[viewBox="0 0 600 170"]') })
    .last();
  const portfolioReturn = chart.locator('span:has(> strong)').filter({ hasText: /^Portfolio / }).locator('strong');
  const benchmarkReturn = chart.locator('span:has(> strong)').filter({ hasText: /^Benchmark / }).locator('strong');
  const perfPath = chart.locator('svg path[stroke="#005daa"]');
  const benchPath = chart.locator('svg path[stroke-dasharray]');

  let previous: string | null = null;
  for (const period of PERIODS) {
    const seeded = series.get(period.code);
    expect(seeded, `seeded performance for ${period.code}`).toBeTruthy();
    await chart.getByText(period.code, { exact: true }).click();

    await expect(portfolioReturn).toHaveText(period.portfolio);
    await expect(benchmarkReturn).toHaveText(period.benchmark);
    await expect(chart.getByText(period.start, { exact: true })).toBeVisible();

    const perfD = await perfPath.getAttribute('d');
    const benchD = await benchPath.getAttribute('d');
    if (previous !== null) expect(perfD, `${period.code} chart path changes with the period`).not.toBe(previous);
    previous = perfD;

    const p = seeded!.portfolio, b = seeded!.benchmark, n = p.length - 1;
    expect(p.at(-1)).toBeCloseTo(seeded!.portfolioReturnPct, 6);
    expect(b.at(-1)).toBeCloseTo(seeded!.benchmarkReturnPct, 6);
    const all = [...p, ...b];
    const mn = Math.min(...all, 0), mx = Math.max(...all);
    const expected = (values: number[]) => values.map((v, i) => [i / n * 600, 160 - (v - mn) / (mx - mn || 1) * 150]);
    for (const [label, d, values] of [['portfolio', perfD, p], ['benchmark', benchD, b]] as const) {
      const actual = pathPoints(d);
      const want = expected(values);
      expect(actual.length, `${period.code} ${label} path point count`).toBe(want.length);
      const off = actual.filter(([x, y], i) => Math.abs(x - want[i][0]) > 0.2 || Math.abs(y - want[i][1]) > 0.2);
      expect(off, `${period.code} ${label} path points match the period's return series`).toEqual([]);
    }
  }
});

gapTest('WM-GAP-021', {
  title: 'Portfolio workspace shows a clear error state on a real request failure (not stale success), and Retry after recovery restores holdings and filters',
  area: 'portfolio',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2',
}, async ({ page }) => {
  const bootstrap = '**/api/workflows/bootstrap';
  await page.route(bootstrap, route => route.abort('connectionrefused'));
  await openArea(page, 'portfolio');

  const main = panel(page);
  await expect(main.getByRole('alert')).toContainText('Workspace data couldn’t be loaded');
  await expect(main.getByRole('table', { name: 'Holdings' })).toHaveCount(0);
  await expect(main.getByRole('region', { name: 'Totals by currency' })).toHaveCount(0);
  await expect(page.getByText(/Data loaded/)).toHaveCount(0);
  const retry = main.getByRole('button', { name: 'Retry' });
  await expect(retry).toBeVisible();

  await page.unroute(bootstrap);
  await retry.click();
  await expect(main.getByRole('alert')).toHaveCount(0);
  await expect(retry).toHaveCount(0);
  await expectListedSymbols(page, ['RY', 'BMO', 'MSFT']);
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$24,000.00');
  await expect(marketValueTotal(page, 'USD')).toHaveText('US$16,800.00');

  await choose(filter(page, 'Client'), { label: 'Eleanor Whitfield (C1001)' });
  await expect(filter(page, 'Client')).toHaveValue('C1001');
  await expectListedSymbols(page, ['RY', 'BMO']);
  await choose(filter(page, 'Account'), { label: 'Whitfield Savings (A1002) · CAD' });
  await expectListedSymbols(page, ['BMO']);
  await expect(marketValueTotal(page, 'CAD')).toHaveText('$10,000.00');
});
