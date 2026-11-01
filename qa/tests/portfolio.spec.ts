import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const WIKI_PORTFOLIO_DETAIL = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.1.1';
const WIKI_ALTERNATIVES = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.1.3';

const holdingsTable = (page: Page) => page.getByRole('table', { name: 'Holdings' });
const holdingRows = (page: Page) => holdingsTable(page).locator('tbody tr').filter({ has: page.getByRole('rowheader') });
const holdingRow = (page: Page, symbol: string) =>
  holdingsTable(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name: symbol, exact: true }) });
const totalsSection = (page: Page) => page.locator('section[aria-labelledby="ws-totals-title"]');
const totalFor = (page: Page, currency: 'CAD' | 'USD') => totalsSection(page).locator(`dl[aria-label="${currency} totals"]`);
const clientFilter = (page: Page) => page.getByRole('search', { name: 'Filter portfolio' }).getByLabel('Client', { exact: true });
const accountFilter = (page: Page) => page.getByRole('search', { name: 'Filter portfolio' }).getByLabel('Account', { exact: true });
const instrumentFilter = (page: Page) => page.getByRole('search', { name: 'Filter portfolio' }).getByLabel('Instrument', { exact: true });
const searchFilter = (page: Page) => page.getByRole('search', { name: 'Filter portfolio' }).getByLabel('Search holdings');
const clearFilters = (page: Page) => page.getByRole('button', { name: 'Clear filters' });

async function expectHoldingSymbols(page: Page, symbols: string[]) {
  const rows = holdingRows(page);
  await expect(rows).toHaveCount(symbols.length);
  const listed = await rows.getByRole('rowheader').allTextContents();
  expect(listed.map(s => s.trim()).sort()).toEqual([...symbols].sort());
}

async function expectHolding(page: Page, symbol: string, cells: string[]) {
  await expect(holdingRow(page, symbol).getByRole('cell')).toHaveText(cells);
}

async function expectMarketValueTotal(page: Page, currency: 'CAD' | 'USD', value: string) {
  const dl = totalFor(page, currency);
  await expect(dl).toHaveCount(1);
  await expect(dl.locator('div').filter({ has: page.getByText(`Market value (${currency})`, { exact: true }) }).locator('dd')).toHaveText(value);
}

async function expectNoNonZeroTotal(page: Page, currency: 'CAD' | 'USD') {
  const dl = totalFor(page, currency);
  if (await dl.count()) {
    await expect(dl.locator('div').filter({ has: page.getByText(`Market value (${currency})`, { exact: true }) }).locator('dd'))
      .toHaveText(currency === 'CAD' ? '$0.00' : 'US$0.00');
  } else {
    await expect(dl).toHaveCount(0);
  }
}

const RY_CELLS = ['Royal Bank of Canada', 'Whitfield Investment (A1001)', 'CAD', '100', '$140.00', '$14,000.00'];
const BMO_CELLS = ['Bank of Montreal', 'Whitfield Savings (A1002)', 'CAD', '80', '$125.00', '$10,000.00'];
const MSFT_CELLS = ['Microsoft Corporation', 'Chen USD Investment (A1003)', 'USD', '40', 'US$420.00', 'US$16,800.00'];

caseTest('WM-TC-009', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expect(clientFilter(page)).toHaveValue('All');
  await expect(accountFilter(page)).toHaveValue('All');
  await expect(instrumentFilter(page)).toHaveValue('All');
  await expectHoldingSymbols(page, ['RY', 'BMO', 'MSFT']);
  await expect(holdingRow(page, 'RY').getByRole('cell').nth(1)).toHaveText('Whitfield Investment (A1001)');
  await expect(holdingRow(page, 'BMO').getByRole('cell').nth(1)).toHaveText('Whitfield Savings (A1002)');
  await expect(holdingRow(page, 'MSFT').getByRole('cell').nth(1)).toHaveText('Chen USD Investment (A1003)');

  await expectHolding(page, 'RY', RY_CELLS);
  await expectHolding(page, 'BMO', BMO_CELLS);
  await expectHolding(page, 'MSFT', MSFT_CELLS);
});

caseTest('WM-TC-010', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expectHoldingSymbols(page, ['RY', 'BMO', 'MSFT']);
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
  await expect(totalsSection(page).locator('dl')).toHaveCount(2);

  await expect(page.getByRole('tabpanel', { name: 'Portfolio' })).not.toContainText('40,800');
  await expect(page.locator('body')).not.toContainText('40,800');

  await page.reload();
  await page.waitForLoadState('load');
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
  await expect(totalsSection(page).locator('dl')).toHaveCount(2);
  await expect(page.locator('body')).not.toContainText('40,800');
});

caseTest('WM-TC-011', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1001');
  await expect(clientFilter(page)).toHaveValue('C1001');
  await expectHoldingSymbols(page, ['RY', 'BMO']);
  await expectHolding(page, 'RY', RY_CELLS);
  await expectHolding(page, 'BMO', BMO_CELLS);

  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  await expectNoNonZeroTotal(page, 'USD');

  await expect(holdingRow(page, 'MSFT')).toHaveCount(0);
  await expect(holdingsTable(page)).not.toContainText('MSFT');
  await expect(holdingsTable(page)).not.toContainText('A1003');
});

caseTest('WM-TC-012', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1002');
  await expect(clientFilter(page)).toHaveValue('C1002');
  await expectHoldingSymbols(page, ['MSFT']);
  await expectHolding(page, 'MSFT', MSFT_CELLS);

  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
  await expectNoNonZeroTotal(page, 'CAD');

  for (const text of ['RY', 'BMO', 'A1001', 'A1002']) {
    await expect(holdingsTable(page)).not.toContainText(text);
  }
  await expect(holdingRow(page, 'RY')).toHaveCount(0);
  await expect(holdingRow(page, 'BMO')).toHaveCount(0);
});

caseTest('WM-TC-013', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1001');
  await accountFilter(page).selectOption('A1002');
  await expect(accountFilter(page)).toHaveValue('A1002');
  await expectHoldingSymbols(page, ['BMO']);
  await expectHolding(page, 'BMO', BMO_CELLS);

  await expectMarketValueTotal(page, 'CAD', '$10,000.00');
  await expectNoNonZeroTotal(page, 'USD');
  await expect(holdingRow(page, 'RY')).toHaveCount(0);
  await expect(holdingsTable(page)).not.toContainText('A1001');
});

caseTest('WM-TC-014', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expect(clearFilters(page)).toBeDisabled();
  await expect(clientFilter(page)).toHaveValue('All');
  await expect(accountFilter(page)).toHaveValue('All');
  await expect(searchFilter(page)).toHaveValue('');
  await instrumentFilter(page).selectOption('MSFT');
  await expect(instrumentFilter(page)).toHaveValue('MSFT');
  await expectHoldingSymbols(page, ['MSFT']);
  await expect(holdingRow(page, 'MSFT').getByRole('cell').nth(1)).toHaveText('Chen USD Investment (A1003)');

  await expectHolding(page, 'MSFT', MSFT_CELLS);
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
  await expect(totalFor(page, 'CAD')).toHaveCount(0);
  await expect(totalsSection(page)).not.toContainText('Market value (CAD)');
  await expect(holdingRow(page, 'MSFT')).not.toContainText(/(^|[^S])\$/);

  await instrumentFilter(page).selectOption('RY');
  await expect(instrumentFilter(page)).toHaveValue('RY');
  await expectHoldingSymbols(page, ['RY']);
  await expectHolding(page, 'RY', RY_CELLS);
  await expectMarketValueTotal(page, 'CAD', '$14,000.00');
  await expect(totalFor(page, 'USD')).toHaveCount(0);
  await expect(totalsSection(page)).not.toContainText('Market value (USD)');
});

caseTest('WM-TC-015', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1001');
  await expectHoldingSymbols(page, ['RY', 'BMO']);

  await expect(instrumentFilter(page).locator('option', { hasText: 'MSFT' }), 'Instrument filter offers MSFT').toHaveCount(1);
  await instrumentFilter(page).selectOption('MSFT');
  await expect(instrumentFilter(page)).toHaveValue('MSFT');
  await expect(holdingRows(page)).toHaveCount(0);
  await expect(holdingsTable(page).getByRole('cell', { name: 'No holdings match these filters.' })).toBeVisible();

  await expect(totalsSection(page)).not.toContainText('16,800');
  await expectNoNonZeroTotal(page, 'USD');
  await expectNoNonZeroTotal(page, 'CAD');
  await expect(page.getByRole('tabpanel', { name: 'Portfolio' })).not.toContainText('16,800');
  await expect(page.getByRole('tabpanel', { name: 'Portfolio' })).not.toContainText('A1003');
  await expect(page.getByRole('tabpanel', { name: 'Portfolio' })).not.toContainText('Chen USD Investment');
});

caseTest('WM-TC-016', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1002');
  await expect(accountFilter(page).locator('option')).toHaveText(['All accounts', 'Chen USD Investment (A1003) · USD']);

  await accountFilter(page).selectOption('A1003');
  await expect(accountFilter(page)).toHaveValue('A1003');
  await expectHoldingSymbols(page, ['MSFT']);

  await clientFilter(page).selectOption('C1001');
  await expect(accountFilter(page)).not.toHaveValue('A1003');
  await expect(accountFilter(page)).toHaveValue('All');
  await expect(holdingRow(page, 'MSFT')).toHaveCount(0);
  await expectHoldingSymbols(page, ['RY', 'BMO']);

  await expect(accountFilter(page).locator('option')).toHaveText([
    'All accounts',
    'Whitfield Investment (A1001) · CAD',
    'Whitfield Savings (A1002) · CAD'
  ]);
  await expect(accountFilter(page).locator('option[value="A1003"]')).toHaveCount(0);
});

caseTest('WM-TC-017', async ({ page }) => {
  await openArea(page, 'portfolio');
  await clientFilter(page).selectOption('C1001');
  await accountFilter(page).selectOption('A1001');
  await instrumentFilter(page).selectOption('RY');
  await expect(instrumentFilter(page)).toHaveValue('RY');
  await expectHoldingSymbols(page, ['RY']);
  await expectHolding(page, 'RY', RY_CELLS);

  await clearFilters(page).click();
  await expect(clientFilter(page)).toHaveValue('All');
  await expect(accountFilter(page)).toHaveValue('All');
  await expect(instrumentFilter(page)).toHaveValue('All');
  await expectHoldingSymbols(page, ['RY', 'BMO', 'MSFT']);
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
  await expectMarketValueTotal(page, 'USD', 'US$16,800.00');
});

caseTest('WM-TC-018', async ({ page }) => {
  await openArea(page, 'portfolio');
  await expectHolding(page, 'RY', RY_CELLS);

  await page.getByRole('tab', { name: 'Orders' }).click();
  await expect(page.getByRole('tab', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true');
  const ticket = page.getByRole('form', { name: 'New order' });
  await ticket.getByLabel('Account', { exact: true }).selectOption('A1001');
  await ticket.getByLabel('Instrument', { exact: true }).selectOption('RY');
  await ticket.getByRole('radio', { name: 'Sell' }).check();
  await ticket.getByLabel('Quantity', { exact: true }).fill('10');
  await ticket.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sell order' })).toContainText(/for 10 RY placed in Whitfield Investment \(A1001\)\. Status: Open\./);
  const ordersTable = page.getByRole('table').filter({ has: page.getByRole('button', { name: /^Order/ }) });
  const orderRow = ordersTable.locator('tbody tr').filter({ hasText: 'RY' });
  await expect(orderRow).toHaveCount(1);
  await expect(orderRow).toContainText('Sell');
  await expect(orderRow).toContainText('Open');

  await page.getByRole('tab', { name: 'Portfolio' }).click();
  await expect(page.getByRole('tab', { name: 'Portfolio' })).toHaveAttribute('aria-selected', 'true');
  await expectHolding(page, 'RY', RY_CELLS);
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');

  await page.reload();
  await page.waitForLoadState('load');
  await expect(page.getByRole('tab', { name: 'Portfolio' })).toHaveAttribute('aria-selected', 'true');
  await expectHolding(page, 'RY', RY_CELLS);
  await expectMarketValueTotal(page, 'CAD', '$24,000.00');
});

type PathPoint = { x: number; y: number };
const parsePath = (d: string | null): PathPoint[] =>
  [...(d ?? '').matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }));

const PERIODS = [
  { code: '1M', portfolio: '+0.40%', benchmark: '+0.35%', p: 0.4, b: 0.35, start: '12-Sep-2026', points: 23 },
  { code: '3M', portfolio: '+2.10%', benchmark: '+1.80%', p: 2.1, b: 1.8, start: '12-Jul-2026', points: 27 },
  { code: 'YTD', portfolio: '+7.84%', benchmark: '+7.12%', p: 7.84, b: 7.12, start: '01-Jan-2026', points: 41 },
  { code: '1Y', portfolio: '+11.60%', benchmark: '+10.40%', p: 11.6, b: 10.4, start: '12-Oct-2025', points: 53 },
  { code: '3Y', portfolio: '+28.90%', benchmark: '+26.20%', p: 28.9, b: 26.2, start: '12-Oct-2023', points: 37 },
  { code: 'Since inception', portfolio: '+142.30%', benchmark: '+128.70%', p: 142.3, b: 128.7, start: '02-Mar-2009', points: 61 }
];

gapTest('WM-GAP-020', {
  title: 'Portfolio Detail period selector updates displayed returns and the performance chart path consistently',
  area: 'portfolio',
  wikiRef: WIKI_PORTFOLIO_DETAIL
}, async ({ page }) => {
  await page.goto('/?screen=portfolio');
  await page.waitForLoadState('load');
  await expect(page.getByText('Performance vs benchmark', { exact: false })).toBeVisible();

  const chart = page.locator('svg[viewBox="0 0 600 170"]');
  const portfolioPath = chart.locator('path[stroke="#005daa"]');
  const benchmarkPath = chart.locator('path[stroke-dasharray]');
  const portfolioFigure = page.locator('xpath=//span[starts-with(normalize-space(.),"Portfolio +") or starts-with(normalize-space(.),"Portfolio −")]/strong');
  const benchmarkFigure = page.locator('xpath=//span[starts-with(normalize-space(.),"Benchmark (")]/strong');
  const ytdKpi = page.locator('xpath=//div[span[1][normalize-space(.)="YTD return (TWR)"]]/span[2]');
  await expect(portfolioPath).toHaveCount(1);
  await expect(benchmarkPath).toHaveCount(1);
  await expect(ytdKpi).toHaveText('+7.84%');

  // Default period is 1Y.
  await expect(portfolioFigure).toHaveText('+11.60%');
  await expect(benchmarkFigure).toHaveText('+10.40%');
  const initialPortfolioPath = await portfolioPath.getAttribute('d');

  const seen = new Set<string>();
  for (const period of PERIODS) {
    const selector = page.getByText(period.code, { exact: true });
    await selector.click();
    await expect(portfolioFigure).toHaveText(period.portfolio);
    await expect(benchmarkFigure).toHaveText(period.benchmark);
    await expect(page.getByText(period.start, { exact: true })).toBeVisible();
    await expect(page.getByText('12-Oct-2026', { exact: true })).toBeVisible();
    expect(await selector.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    for (const other of PERIODS.filter(o => o.code !== period.code)) {
      expect(await page.getByText(other.code, { exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgb(255, 255, 255)');
    }
    await expect(ytdKpi).toHaveText('+7.84%');

    const pd = await portfolioPath.getAttribute('d');
    const bd = await benchmarkPath.getAttribute('d');
    const p = parsePath(pd), b = parsePath(bd);
    expect(p.length, `${period.code} portfolio points`).toBe(period.points);
    expect(b.length, `${period.code} benchmark points`).toBe(period.points);
    expect(p[0]).toEqual(b[0]);
    expect(p[0].x).toBe(0);
    expect(p.at(-1)!.x).toBe(600);
    expect(b.at(-1)!.x).toBe(600);
    const pRise = p[0].y - p.at(-1)!.y, bRise = b[0].y - b.at(-1)!.y;
    expect(pRise).toBeGreaterThan(0);
    expect(bRise).toBeGreaterThan(0);
    expect(p.at(-1)!.y).toBeLessThan(b.at(-1)!.y);
    expect(Math.abs(pRise / bRise - period.p / period.b), `${period.code} end-point ratio vs returns`).toBeLessThan(0.01);
    expect(seen.has(pd!), `${period.code} path must differ from other periods`).toBe(false);
    seen.add(pd!);
    if (period.code === 'YTD') await expect(ytdKpi).toHaveText(period.portfolio);
  }
  expect(seen.size).toBe(PERIODS.length);

  await page.getByText('1Y', { exact: true }).click();
  await expect(portfolioFigure).toHaveText('+11.60%');
  await expect(portfolioPath).toHaveAttribute('d', initialPortfolioPath!);
});

const kpiTile = (page: Page, label: string): Locator =>
  page.locator(`xpath=//div[count(span)=3 and span[1][normalize-space(.)="${label}"]]`);
const moneyValue = (text: string) => Number(text.replace(/[^\d.-]/g, ''));

const FUNDS = [
  { name: 'Northgate Infrastructure Partners IV', account: 'Whitfield Holdings Ltd. · 4418-1157 · CAD', vintage: '2021', committed: 1_000_000, called: 620_000, distributions: 92_000, nav: 712_400 },
  { name: 'Lakeshore Private Credit Fund II', account: 'Non-registered · 4417-8821 · CAD', vintage: '2023', committed: 750_000, called: 480_000, distributions: 61_200, nav: 468_900 }
];
const usd0 = (n: number) => '$' + n.toLocaleString('en-CA', { maximumFractionDigits: 0 });

gapTest('WM-GAP-021', {
  title: 'Alternatives commitments, called capital, unfunded amounts and reported valuations are consistent with seeded data',
  area: 'portfolio',
  wikiRef: WIKI_ALTERNATIVES
}, async ({ page }) => {
  await page.goto('/?screen=alts');
  await page.waitForLoadState('load');
  await expect(page.getByText('Alternatives holdings', { exact: true })).toBeVisible();
  await expect(page.getByText(/^2 commitments · valuations are manager-reported/)).toBeVisible();

  for (const f of FUNDS) {
    const row = page.locator(`xpath=//div[count(*)=9][div[1]/span[1][normalize-space(.)="${f.name}"]]`);
    await expect(row).toHaveCount(1);
    const cells = row.locator('xpath=./*');
    const calledPct = Math.round(f.called / f.committed * 100) + '%';
    await expect(cells).toHaveText([
      new RegExp(`^${f.name}\\s*${f.account.replace(/[.·]/g, m => '\\' + m)}$`),
      f.vintage,
      usd0(f.committed),
      `${usd0(f.called)} · ${calledPct}`,
      usd0(f.committed - f.called),
      usd0(f.distributions),
      new RegExp(`^\\${usd0(f.nav)}\\s*Manager NAV 30-Jun-2026 · approved$`),
      (f.distributions / f.called).toFixed(2) + 'x',
      ((f.distributions + f.nav) / f.called).toFixed(2) + 'x'
    ]);
  }

  const committed = FUNDS.reduce((s, f) => s + f.committed, 0);
  const called = FUNDS.reduce((s, f) => s + f.called, 0);
  const nav = FUNDS.reduce((s, f) => s + f.nav, 0);
  const dist = FUNDS.reduce((s, f) => s + f.distributions, 0);
  const aua = moneyValue(await page.locator('xpath=//span[normalize-space(.)="AUA"]/following-sibling::*[1]').first().innerText());
  expect(aua).toBeGreaterThan(0);

  await expect(kpiTile(page, 'Committed').locator('span')).toHaveText(['Committed', usd0(committed), '2 funds · CAD']);
  await expect(kpiTile(page, 'Called to date').locator('span')).toHaveText(['Called to date', usd0(called), (called / committed * 100).toFixed(1) + '% of committed']);
  await expect(kpiTile(page, 'Unfunded').locator('span')).toHaveText(['Unfunded', usd0(committed - called), ((committed - called) / aua * 100).toFixed(1) + '% of household AUA']);
  await expect(kpiTile(page, 'Current value').locator('span')).toHaveText(['Current value', usd0(nav), 'as of 30-Jun-2026 NAVs']);
  await expect(kpiTile(page, 'Distributions received').locator('span')).toHaveText(['Distributions received', usd0(dist), `DPI ${(dist / called).toFixed(2)}x`]);
  await expect(kpiTile(page, 'Net TVPI').locator('span').nth(1)).toHaveText(((dist + nav) / called).toFixed(2) + 'x');

  await page.goto('/?screen=portfolio');
  await page.waitForLoadState('load');
  await expect(kpiTile(page, 'Unfunded commitments').locator('span')).toHaveText(['Unfunded commitments', usd0(committed - called), '2 alternative funds']);
  const allocAlternatives = page.locator('xpath=//div[count(span)=5][span[2][normalize-space(.)="Alternatives"]]/span[3]');
  await expect(allocAlternatives).toHaveText(usd0(nav));

  await page.getByText('Alternatives 2', { exact: true }).click();
  const holdings = page.locator('div.hov-row');
  await expect(holdings).toHaveCount(FUNDS.length);
  for (const f of FUNDS) {
    const row = holdings.filter({ has: page.getByText(f.name, { exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('xpath=./*')).toHaveText([
      new RegExp(`^${f.name}\\s*Commitment \\${usd0(f.committed)} · ${Math.round(f.called / f.committed * 100)}% called$`),
      'Alternatives',
      /^[A-Z]{2}$/,
      'paid-in',
      `NAV ${(f.nav / f.called).toFixed(3)}x`,
      usd0(f.nav),
      ((f.nav / aua) * 100).toFixed(2) + '%',
      (f.nav - f.called >= 0 ? '+' : '−') + usd0(Math.abs(f.nav - f.called)),
      '—'
    ]);
  }
});
