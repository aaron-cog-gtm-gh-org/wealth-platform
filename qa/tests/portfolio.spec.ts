import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const WIKI_LEGACY_PORTFOLIO_DETAIL = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.1.1';

const RY = { symbol: 'RY', name: 'Royal Bank of Canada', account: 'Whitfield Investment (A1001)', currency: 'CAD', quantity: '100', price: '$140.00', value: '$14,000.00' };
const BMO = { symbol: 'BMO', name: 'Bank of Montreal', account: 'Whitfield Savings (A1002)', currency: 'CAD', quantity: '80', price: '$125.00', value: '$10,000.00' };
const MSFT = { symbol: 'MSFT', name: 'Microsoft Corporation', account: 'Chen USD Investment (A1003)', currency: 'USD', quantity: '40', price: 'US$420.00', value: 'US$16,800.00' };
type Holding = typeof RY;

const panel = (page: Page) => page.getByRole('tabpanel', { name: 'Portfolio' });
const filters = (page: Page) => page.getByRole('search', { name: 'Filter portfolio' });
const holdings = (page: Page) => page.getByRole('table', { name: 'Holdings' });
const totals = (page: Page) => page.getByRole('region', { name: 'Totals by currency' });
const currencyTotals = (page: Page, currency: string) => totals(page).getByLabel(`${currency} totals`, { exact: true });
const holdingRow = (page: Page, symbol: string) =>
  holdings(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name: symbol, exact: true }) });

async function choose(page: Page, label: string, option: string) {
  const select = filters(page).getByRole('combobox', { name: label, exact: true });
  await select.click();
  await select.selectOption({ label: option });
}

async function expectListedSymbols(page: Page, symbols: string[]) {
  await expect.poll(async () => (await holdings(page).locator('tbody th[scope="row"]').allTextContents()).sort())
    .toEqual([...symbols].sort());
  await expect(page.getByText(`${symbols.length} of 3 positions`, { exact: true })).toBeVisible();
}

async function expectHolding(page: Page, h: Holding) {
  await expect(holdingRow(page, h.symbol).getByRole('cell')).toHaveText([h.name, h.account, h.currency, h.quantity, h.price, h.value]);
}

async function expectMarketValueTotal(page: Page, currency: string, value: string) {
  const dl = currencyTotals(page, currency);
  await expect(dl).toBeVisible();
  await expect(dl.getByRole('term').first()).toHaveText(`Market value (${currency})`);
  await expect(dl.getByRole('definition').first()).toHaveText(value);
}

async function expectNoTotalOrZero(page: Page, currency: string) {
  const dl = currencyTotals(page, currency);
  if (await dl.count()) await expect(dl.getByRole('definition').first()).toHaveText(currency === 'USD' ? 'US$0.00' : '$0.00');
  else await expect(dl).toHaveCount(0);
}

async function expectOptions(select: Locator, labels: string[]) {
  await expect(select.locator('option')).toHaveText(labels);
}

caseTest('WM-TC-009', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expect(filters(page).getByRole('combobox', { name: 'Client', exact: true })).toHaveValue('All');
  await expect(filters(page).getByRole('combobox', { name: 'Account', exact: true })).toHaveValue('All');
  await expect(filters(page).getByRole('combobox', { name: 'Instrument', exact: true })).toHaveValue('All');

  // Step 1: open with no filters, sorted by symbol for reading.
  await holdings(page).getByRole('button', { name: 'Symbol', exact: true }).click();
  await expectListedSymbols(page, ['RY', 'BMO', 'MSFT']);
  await expect(holdingRow(page, 'RY').getByRole('cell').nth(1)).toHaveText(RY.account);
  await expect(holdingRow(page, 'BMO').getByRole('cell').nth(1)).toHaveText(BMO.account);
  await expect(holdingRow(page, 'MSFT').getByRole('cell').nth(1)).toHaveText(MSFT.account);

  // Steps 2-4: read each row after sorting by market value.
  await holdings(page).getByRole('button', { name: 'Market value', exact: true }).click();
  await holdingRow(page, 'RY').hover();
  await expectHolding(page, RY);
  await holdingRow(page, 'BMO').hover();
  await expectHolding(page, BMO);
  await holdingRow(page, 'MSFT').hover();
  await expectHolding(page, MSFT);
});

caseTest('WM-TC-010', async ({ page }) => {
  await openArea(page, 'portfolio');
  await choose(page, 'Client', 'All clients');
  await choose(page, 'Account', 'All accounts');
  await expectListedSymbols(page, ['RY', 'BMO', 'MSFT']);

  // Step 1: separate totals.
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');

  // Step 2: no combined figure anywhere.
  await totals(page).hover();
  await expect(totals(page).locator('dl')).toHaveCount(2);
  await expect(panel(page)).not.toContainText('40,800');

  // Step 3: reload.
  await page.reload();
  await expect(holdings(page)).toBeVisible();
  await holdings(page).getByRole('button', { name: 'Market value', exact: true }).click();
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
  await expect(totals(page).locator('dl')).toHaveCount(2);
  await expect(panel(page)).not.toContainText('40,800');
});

caseTest('WM-TC-011', async ({ page }) => {
  await openArea(page, 'portfolio');

  // Step 1.
  await choose(page, 'Client', 'Eleanor Whitfield (C1001)');
  await expectListedSymbols(page, ['RY', 'BMO']);
  await expectHolding(page, RY);
  await expectHolding(page, BMO);

  // Step 2.
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  await expectNoTotalOrZero(page, 'USD');

  // Step 3: neither MSFT nor A1003 appears, including in the scoped filter choices.
  const instrument = filters(page).getByRole('combobox', { name: 'Instrument', exact: true });
  await instrument.click();
  await expectOptions(instrument, ['All instruments', 'BMO', 'RY']);
  await expect(holdingRow(page, 'MSFT')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('MSFT');
  await expect(panel(page)).not.toContainText('A1003');
});

caseTest('WM-TC-012', async ({ page }) => {
  await openArea(page, 'portfolio');

  // Step 1.
  await choose(page, 'Client', 'James Chen (C1002)');
  await expectListedSymbols(page, ['MSFT']);
  await expectHolding(page, MSFT);

  // Step 2.
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
  await expectNoTotalOrZero(page, 'CAD');

  // Step 3.
  const account = filters(page).getByRole('combobox', { name: 'Account', exact: true });
  await account.click();
  await expectOptions(account, ['All accounts', 'Chen USD Investment (A1003) · USD']);
  for (const hidden of ['RY', 'BMO']) await expect(holdingRow(page, hidden)).toHaveCount(0);
  for (const hidden of ['A1001', 'A1002', 'Royal Bank of Canada', 'Bank of Montreal']) await expect(panel(page)).not.toContainText(hidden);
});

caseTest('WM-TC-013', async ({ page }) => {
  await openArea(page, 'portfolio');

  // Step 1.
  await choose(page, 'Client', 'Eleanor Whitfield (C1001)');
  await choose(page, 'Account', 'Whitfield Savings (A1002) · CAD');
  await expectListedSymbols(page, ['BMO']);
  await expectHolding(page, BMO);

  // Step 2.
  await expectMarketValueTotal(page, 'CAD', '$10,000.00');
  await expectNoTotalOrZero(page, 'USD');
  await expect(holdingRow(page, 'RY')).toHaveCount(0);
  await expect(totals(page)).not.toContainText('$24,000.00');
});

caseTest('WM-TC-014', async ({ page }) => {
  await openArea(page, 'portfolio');

  // Step 1: no filters are applied, so Clear filters is unavailable; choose MSFT.
  await expect(filters(page).getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  await choose(page, 'Instrument', 'MSFT');
  await expectListedSymbols(page, ['MSFT']);
  await expectHolding(page, MSFT);

  // Step 2: USD valuation, no conversion (16,800 x 1.3683 = 22,987.44).
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
  await expect(currencyTotals(page, 'CAD')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('22,987');

  // Step 3.
  await choose(page, 'Instrument', 'RY');
  await expectListedSymbols(page, ['RY']);
  await expectHolding(page, RY);
  await expectMarketValueTotal(page, 'CAD', '$14,000.00');
  await expect(currencyTotals(page, 'USD')).toHaveCount(0);
});

caseTest('WM-TC-015', async ({ page }) => {
  await openArea(page, 'portfolio');

  // Step 1.
  await choose(page, 'Client', 'Eleanor Whitfield (C1001)');
  await expectListedSymbols(page, ['RY', 'BMO']);

  // Step 2: set the instrument filter to MSFT.
  await choose(page, 'Instrument', 'MSFT');
  await expect(holdings(page).locator('tbody th[scope="row"]')).toHaveCount(0);
  await expect(holdings(page).getByText('No holdings match these filters.')).toBeVisible();

  // Step 3.
  await expect(totals(page)).not.toContainText('16,800.00');
  await expectNoTotalOrZero(page, 'USD');
  await expectNoTotalOrZero(page, 'CAD');
  for (const hidden of ['James Chen', 'A1003', 'MSFT']) await expect(panel(page).getByRole('table')).not.toContainText(hidden);
});

caseTest('WM-TC-016', async ({ page }) => {
  await openArea(page, 'portfolio');
  const account = filters(page).getByRole('combobox', { name: 'Account', exact: true });

  // Step 1.
  await choose(page, 'Client', 'James Chen (C1002)');
  await account.click();
  await expectOptions(account, ['All accounts', 'Chen USD Investment (A1003) · USD']);

  // Step 2.
  await account.selectOption({ label: 'Chen USD Investment (A1003) · USD' });
  await expectListedSymbols(page, ['MSFT']);

  // Step 3.
  await choose(page, 'Client', 'Eleanor Whitfield (C1001)');
  await expect(account).toHaveValue('All');
  await expect(holdingRow(page, 'MSFT')).toHaveCount(0);
  await expectListedSymbols(page, ['RY', 'BMO']);

  // Step 4.
  await account.click();
  await expectOptions(account, ['All accounts', 'Whitfield Investment (A1001) · CAD', 'Whitfield Savings (A1002) · CAD']);
});

caseTest('WM-TC-017', async ({ page }) => {
  await openArea(page, 'portfolio');

  // Step 1.
  await choose(page, 'Client', 'Eleanor Whitfield (C1001)');
  await choose(page, 'Account', 'Whitfield Investment (A1001) · CAD');
  await choose(page, 'Instrument', 'RY');
  await expectListedSymbols(page, ['RY']);
  await expectHolding(page, RY);

  // Step 2.
  await filters(page).getByRole('button', { name: 'Clear filters' }).click();
  await expectListedSymbols(page, ['RY', 'BMO', 'MSFT']);
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
});

caseTest('WM-TC-018', async ({ page }) => {
  await openArea(page, 'portfolio');
  const expectRyUnchanged = async () => {
    await expect(holdingRow(page, 'RY').getByRole('cell').nth(3)).toHaveText('100');
    await expect(holdingRow(page, 'RY').getByRole('cell').nth(5)).toHaveText('$14,000.00');
    await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  };

  // Step 1.
  await choose(page, 'Client', 'Eleanor Whitfield (C1001)');
  await choose(page, 'Account', 'Whitfield Investment (A1001) · CAD');
  await expect(holdingRow(page, 'RY').getByRole('cell').nth(3)).toHaveText('100');
  await expect(holdingRow(page, 'RY').getByRole('cell').nth(5)).toHaveText('$14,000.00');

  // Step 2: place a Sell order for 10 RY in A1001.
  await page.getByRole('tab', { name: /^Orders(\s|$)/ }).click();
  const ticket = page.getByRole('form', { name: 'New order' });
  const orderAccount = ticket.getByRole('combobox', { name: 'Account', exact: true });
  await orderAccount.click();
  await orderAccount.selectOption({ label: 'Whitfield Investment (A1001) · CAD' });
  const orderInstrument = ticket.getByRole('combobox', { name: 'Instrument', exact: true });
  await orderInstrument.click();
  await orderInstrument.selectOption('RY');
  await ticket.getByText('Sell', { exact: true }).click();
  await expect(ticket.getByRole('radio', { name: 'Sell' })).toBeChecked();
  const quantity = ticket.getByRole('textbox', { name: 'Quantity' });
  await quantity.click();
  await quantity.fill('10');
  await ticket.getByRole('button', { name: 'Place order' }).click();
  const orders = page.getByRole('table', { name: 'Orders' });
  const order = orders.getByRole('row').filter({ hasText: 'RY' }).filter({ hasText: 'Sell' });
  await expect(order).toHaveCount(1);
  await expect(order.getByRole('cell').nth(0)).toHaveText('Whitfield Investment (A1001)');
  await expect(order.getByRole('cell').nth(3)).toHaveText('10');
  await expect(order.getByRole('cell').nth(6)).toHaveText('Open');

  // Step 3.
  await page.getByRole('tab', { name: /^Portfolio(\s|$)/ }).click();
  await expect(holdings(page)).toBeVisible();
  await holdings(page).getByRole('button', { name: 'Market value', exact: true }).click();
  await expectRyUnchanged();

  // Step 4.
  await page.reload();
  await expect(page.getByRole('tab', { name: /^Portfolio(\s|$)/ })).toHaveAttribute('aria-selected', 'true');
  await holdings(page).getByRole('button', { name: 'Symbol', exact: true }).click();
  await expectRyUnchanged();
});

const PERIODS = [
  { id: '1M', portfolio: '+0.40%', benchmark: '+0.35%', start: '12-Sep-2026', points: 23 },
  { id: '3M', portfolio: '+2.10%', benchmark: '+1.80%', start: '12-Jul-2026', points: 27 },
  { id: 'YTD', portfolio: '+7.84%', benchmark: '+7.12%', start: '01-Jan-2026', points: 41 },
  { id: '1Y', portfolio: '+11.60%', benchmark: '+10.40%', start: '12-Oct-2025', points: 53 },
  { id: '3Y', portfolio: '+28.90%', benchmark: '+26.20%', start: '12-Oct-2023', points: 37 },
  { id: 'Since inception', portfolio: '+142.30%', benchmark: '+128.70%', start: '02-Mar-2009', points: 61 }
];

const pathPoints = (d: string) => (d.match(/[ML]\s*[-\d.]+\s+[-\d.]+/g) ?? []).map((cmd) => cmd.slice(1).trim().split(/\s+/).map(Number));

gapTest('WM-GAP-020', {
  title: 'Legacy Portfolio Detail period selection keeps performance figures and chart consistent',
  area: 'portfolio',
  wikiRef: WIKI_LEGACY_PORTFOLIO_DETAIL
}, async ({ page }) => {
  await openArea(page, 'portfolio', { screen: 'portfolio' });
  await expect(page.getByRole('heading', { name: 'Portfolio detail', level: 1 })).toBeVisible();
  const perf = page.locator('xpath=//span[starts-with(normalize-space(.), "Performance vs benchmark")]/ancestor::div[.//*[local-name()="svg"]][1]');
  await expect(perf).toHaveCount(1);
  const selector = perf.locator('xpath=.//span[starts-with(normalize-space(.), "Performance vs benchmark")]/following-sibling::div[1]');
  const portfolioFigure = perf.locator('span', { hasText: /^Portfolio/ }).locator('strong');
  const benchmarkFigure = perf.locator('span', { hasText: /^Benchmark/ }).locator('strong');
  const chart = perf.locator('svg');
  const perfLine = chart.locator('path[stroke="#005daa"]');
  const benchLine = chart.locator('path[stroke="#8a94a3"]');
  const axis = chart.locator('xpath=following-sibling::div[1]/span');
  const ytdKpi = page.locator('xpath=//span[normalize-space(.)="YTD return (TWR)"]/parent::div');

  await expect(ytdKpi.locator('span').nth(1)).toHaveText('+7.84%');
  await expect(ytdKpi.locator('span').nth(2)).toHaveText('Benchmark +7.12% · +0.72 pts');

  const seenPaths = new Set<string>();
  const order = ['1Y', '1M', '3M', 'YTD', '3Y', 'Since inception'];
  for (const id of order) {
    const period = PERIODS.find((p) => p.id === id)!;
    const button = selector.getByText(period.id, { exact: true });
    await button.click();
    await page.mouse.move(0, 0);

    await expect(button).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    for (const other of PERIODS.filter((p) => p.id !== id)) {
      await expect(selector.getByText(other.id, { exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
    await expect(portfolioFigure).toHaveText(period.portfolio);
    await expect(benchmarkFigure).toHaveText(period.benchmark);
    await expect(axis).toHaveText([period.start, '12-Oct-2026']);

    const perfD = (await perfLine.getAttribute('d')) ?? '';
    const benchD = (await benchLine.getAttribute('d')) ?? '';
    const perfPts = pathPoints(perfD);
    const benchPts = pathPoints(benchD);
    expect(perfPts, `${id} portfolio series length`).toHaveLength(period.points);
    expect(benchPts, `${id} benchmark series length`).toHaveLength(period.points);
    expect(perfPts.at(-1)![0], `${id} chart spans the period`).toBeCloseTo(600, 0);
    expect(perfPts.at(-1)![1], `${id} portfolio ends above benchmark`).toBeLessThan(benchPts.at(-1)![1]);
    expect(seenPaths.has(perfD), `${id} chart redrawn for the period`).toBe(false);
    seenPaths.add(perfD);

    if (id === 'YTD') {
      await expect(ytdKpi.locator('span').nth(1)).toHaveText(period.portfolio);
      await expect(ytdKpi.locator('span').nth(2)).toContainText(`Benchmark ${period.benchmark}`);
    }
  }
});
