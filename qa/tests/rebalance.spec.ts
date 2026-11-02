import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const CLASSES = ['Equity', 'Fixed income', 'Cash'] as const;
type AssetClass = (typeof CLASSES)[number];
type Targets = Record<AssetClass, string>;

const areaTab = (page: Page, label: string) =>
  page.getByRole('tablist', { name: 'Workspace areas' }).getByRole('tab', { name: new RegExp(`^${label}(\\s|$)`) });
const panel = (page: Page) => page.getByRole('tabpanel');
const allocation = (page: Page) => page.getByRole('region', { name: 'Target allocation' });
const preview = (page: Page) => page.getByRole('region', { name: 'Rebalance preview' });
const auditTrail = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });

const rowFor = (scope: Locator, cls: string) =>
  scope.getByRole('row').filter({ has: scope.page().getByRole('rowheader', { name: cls, exact: true }) });

const pct = (n: string) => new RegExp(`^${n}(\\.0+)?%$`);
const drift = (n: number) => {
  if (n === 0) return /^0(\.0+)?\s*(pts|%)$/;
  return new RegExp(`^${n > 0 ? '\\+' : '[−-]'}${Math.abs(n)}(\\.0+)?\\s*(pts|%)$`);
};

async function goToRebalance(page: Page) {
  await areaTab(page, 'Rebalance').click();
  await expect(areaTab(page, 'Rebalance')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/[?&]area=rebalance(&|$)/);
  await expect(allocation(page)).toBeVisible();
}

async function expectSavedTargets(page: Page, targets: Targets) {
  for (const cls of CLASSES) {
    await expect(rowFor(allocation(page), cls).getByRole('cell').nth(1)).toHaveText(pct(targets[cls]));
  }
}

async function enterTargets(page: Page, targets: Targets) {
  if (await allocation(page).getByRole('button', { name: 'Edit targets' }).isVisible()) {
    await allocation(page).getByRole('button', { name: 'Edit targets' }).click();
  }
  for (const cls of CLASSES) {
    const input = page.getByLabel(`Target weight for ${cls} (%)`);
    await input.click();
    await input.fill(targets[cls]);
  }
}

async function saveTargets(page: Page) {
  await allocation(page).getByRole('button', { name: 'Save targets' }).click();
}

async function openPreview(page: Page) {
  await preview(page).getByRole('button', { name: 'Preview rebalance' }).click();
  await expect(preview(page).getByRole('table')).toBeVisible();
}

async function expectPreviewRow(page: Page, cls: AssetClass, current: string, target: string, d: number, assessment: RegExp) {
  const cells = rowFor(preview(page), cls).getByRole('cell');
  await expect(cells.nth(0)).toHaveText(pct(current));
  await expect(cells.nth(1)).toHaveText(pct(target));
  await expect(cells.nth(2)).toHaveText(drift(d));
  await expect(cells.nth(3)).toHaveText(assessment);
}

const WITHIN = /^\s*Within tolerance\s*$/;
const OVER = /Proposed change\s*Overweight/;
const UNDER = /Proposed change\s*Underweight/;
const SEED: Targets = { Equity: '60', 'Fixed income': '30', Cash: '10' };
const RANGE_MSG = /(between 0 and 100|from 0 to 100)/i;
const TOTAL_MSG = /(total|sum)( exactly)? (to )?100/i;

async function reloadAndReturn(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  await goToRebalance(page);
}

caseTest('WM-TC-039', async ({ page }) => {
  await openArea(page, 'rebalance');
  await goToRebalance(page);

  const body = allocation(page).getByRole('table').locator('tbody');
  await expect(body.getByRole('rowheader')).toHaveText([...CLASSES]);
  for (const cls of CLASSES) {
    const cells = rowFor(allocation(page), cls).getByRole('cell');
    await expect(cells.nth(0)).toHaveText(pct(SEED[cls]));
    await expect(cells.nth(1)).toHaveText(pct(SEED[cls]));
  }
  const totals = allocation(page).getByRole('table').locator('tfoot').getByRole('row').getByRole('cell');
  await expect(totals.nth(1)).toHaveText(pct('100'));

  await openPreview(page);
  await expect(preview(page).getByRole('table').locator('tbody').getByRole('rowheader')).toHaveText([...CLASSES]);
  for (const cls of CLASSES) await expectPreviewRow(page, cls, SEED[cls], SEED[cls], 0, WITHIN);
});

caseTest('WM-TC-040', async ({ page }) => {
  await openArea(page, 'rebalance');
  const next: Targets = { Equity: '70', 'Fixed income': '20', Cash: '10' };

  await enterTargets(page, next);
  await saveTargets(page);
  await expect(allocation(page).getByRole('status')).toContainText(/saved/i);
  await expectSavedTargets(page, next);
  const totals = allocation(page).getByRole('table').locator('tfoot').getByRole('row').getByRole('cell');
  await expect(totals.nth(1)).toHaveText(pct('100'));

  await openPreview(page);
  await expectPreviewRow(page, 'Equity', '60', '70', -10, UNDER);
  await expectPreviewRow(page, 'Fixed income', '30', '20', 10, OVER);
  await expectPreviewRow(page, 'Cash', '10', '10', 0, WITHIN);

  await reloadAndReturn(page);
  await expectSavedTargets(page, next);

  const entries = auditTrail(page).getByRole('list', { name: 'Audit entries' }).getByRole('listitem');
  await expect(entries.filter({ hasText: /60\/30\/10\s*→\s*70\/20\/10/ })).toHaveCount(1);
});

caseTest('WM-TC-041', async ({ page }) => {
  await openArea(page, 'rebalance');
  const next: Targets = { Equity: '50', 'Fixed income': '40', Cash: '10' };

  await enterTargets(page, next);
  await saveTargets(page);
  await expect(allocation(page).getByRole('status')).toContainText(/saved/i);
  await openPreview(page);
  await expectPreviewRow(page, 'Equity', '60', '50', 10, OVER);
  await expectPreviewRow(page, 'Fixed income', '30', '40', -10, UNDER);
  await expect(preview(page).getByRole('status')).toContainText('No trades were placed');

  const expectNoOrders = async () => {
    await areaTab(page, 'Orders').click();
    await expect(areaTab(page, 'Orders')).toHaveAttribute('aria-selected', 'true');
    const orders = page.getByRole('region', { name: 'Orders' });
    await expect(orders.getByText(/^0 of 0 orders$/)).toBeVisible();
    await expect(orders.getByRole('table')).toContainText('No orders yet');
  };
  await expectNoOrders();

  await areaTab(page, 'Portfolio').click();
  await expect(areaTab(page, 'Portfolio')).toHaveAttribute('aria-selected', 'true');
  const holdings = page.getByRole('region', { name: 'Holdings' });
  for (const [symbol, quantity] of [['RY', '100'], ['BMO', '80'], ['MSFT', '40']]) {
    await expect(rowFor(holdings, symbol).getByRole('cell').nth(3)).toHaveText(quantity);
  }
  await expect(panel(page).getByLabel('CAD totals')).toContainText('$24,000.00');
  await expect(panel(page).getByLabel('USD totals')).toContainText('US$16,800.00');

  await areaTab(page, 'Clients').click();
  await expect(areaTab(page, 'Clients')).toHaveAttribute('aria-selected', 'true');
  const book = page.getByRole('region', { name: 'Client book' });
  const accountCash = (name: string, id: string) =>
    page.getByRole('table', { name: `Accounts for ${name}` }).getByRole('row').filter({ hasText: id }).getByRole('cell').nth(1);
  await book.getByRole('button', { name: 'Eleanor Whitfield' }).click();
  await expect(accountCash('Eleanor Whitfield', 'A1001')).toHaveText('$25,000.00');
  await expect(accountCash('Eleanor Whitfield', 'A1002')).toHaveText('$10,000.00');
  await book.getByRole('button', { name: 'James Chen' }).click();
  await expect(accountCash('James Chen', 'A1003')).toHaveText('US$15,000.00');

  await page.reload();
  await page.waitForLoadState('load');
  await expectNoOrders();
});

caseTest('WM-TC-042', async ({ page }) => {
  await openArea(page, 'rebalance');

  await enterTargets(page, { Equity: '60', 'Fixed income': '30', Cash: '9' });
  await saveTargets(page);
  await expect(allocation(page).getByRole('alert')).toHaveText(TOTAL_MSG);
  await expectSavedTargets(page, SEED);
  const firstMessage = (await allocation(page).getByRole('alert').textContent())?.trim() ?? '';

  const cash = page.getByLabel('Target weight for Cash (%)');
  await cash.click();
  await cash.fill('11');
  await saveTargets(page);
  await expect(allocation(page).getByRole('alert')).toHaveText(firstMessage);
  await expectSavedTargets(page, SEED);

  await reloadAndReturn(page);
  await expectSavedTargets(page, SEED);

  await auditTrail(page).getByLabel('Show all areas').check();
  await expect(auditTrail(page)).not.toContainText(/allocations?\.updated/);
});

caseTest('WM-TC-043', async ({ page }) => {
  await openArea(page, 'rebalance');

  await enterTargets(page, { Equity: '-10', 'Fixed income': '80', Cash: '30' });
  await saveTargets(page);
  await expect(allocation(page).getByRole('alert')).toHaveText(RANGE_MSG);
  await expectSavedTargets(page, SEED);

  await enterTargets(page, { Equity: '110', 'Fixed income': '-10', Cash: '0' });
  await saveTargets(page);
  await expect(allocation(page).getByRole('alert')).toHaveText(RANGE_MSG);
  await expectSavedTargets(page, SEED);

  await reloadAndReturn(page);
  await expectSavedTargets(page, SEED);

  const all: Targets = { Equity: '100', 'Fixed income': '0', Cash: '0' };
  await enterTargets(page, all);
  await saveTargets(page);
  await expect(allocation(page).getByRole('status')).toContainText(/saved/i);
  await openPreview(page);
  await expectPreviewRow(page, 'Equity', '60', '100', -40, UNDER);
  await expectPreviewRow(page, 'Fixed income', '30', '0', 30, OVER);
  await expectPreviewRow(page, 'Cash', '10', '0', 10, OVER);

  await reloadAndReturn(page);
  await expectSavedTargets(page, all);
});

caseTest('WM-TC-044', async ({ page }) => {
  await openArea(page, 'rebalance');

  await enterTargets(page, { Equity: '60', 'Fixed income': '40', Cash: '' });
  await saveTargets(page);
  await expect(allocation(page).getByRole('alert')).toContainText(/needs a target/i);
  await expectSavedTargets(page, SEED);

  const cash = page.getByLabel('Target weight for Cash (%)');
  await cash.click();
  await cash.fill('ten');
  await saveTargets(page);
  await expect(allocation(page).getByRole('alert')).toContainText(/must be a number/i);
  await expectSavedTargets(page, SEED);

  await enterTargets(page, { Equity: '50', 'Fixed income': '40', Cash: '10' });
  await allocation(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Target weight for Equity (%)')).toHaveCount(0);
  await expect(allocation(page).getByRole('button', { name: 'Edit targets' })).toBeVisible();
  await expectSavedTargets(page, SEED);

  await reloadAndReturn(page);
  await expectSavedTargets(page, SEED);
  for (const cls of CLASSES) {
    await expect(rowFor(allocation(page), cls).getByRole('cell').last()).toHaveText(drift(0));
  }
});

gapTest('WM-GAP-080', {
  title: 'Rebalance workspace shows a clear error state on a real request failure, and Retry after recovery restores real targets and usable controls',
  area: 'rebalance',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2'
}, async ({ page }) => {
  const bootstrap = '**/api/workflows/bootstrap';
  await page.route(bootstrap, route => route.abort('failed'));
  await openArea(page, 'rebalance');

  await expect(panel(page).getByRole('alert')).toContainText('Workspace data couldn’t be loaded');
  await expect(allocation(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeDisabled();
  const retry = panel(page).getByRole('button', { name: 'Retry' });
  await expect(retry).toBeVisible();

  await page.unroute(bootstrap);
  await retry.click();
  await expect(allocation(page)).toBeVisible();
  await expect(panel(page).getByText('Workspace data couldn’t be loaded')).toHaveCount(0);
  await expectSavedTargets(page, SEED);

  const next: Targets = { Equity: '70', 'Fixed income': '20', Cash: '10' };
  await enterTargets(page, next);
  await saveTargets(page);
  await expect(allocation(page).getByRole('status')).toContainText(/saved/i);
  await expectSavedTargets(page, next);
  await openPreview(page);
  await expectPreviewRow(page, 'Equity', '60', '70', -10, UNDER);
});

gapTest('WM-GAP-081', {
  title: 'Browser Back/Forward between Rebalance and Settlements workspace areas keeps the selected area tab and URL consistent',
  area: 'rebalance',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/2.1'
}, async ({ page }) => {
  await openArea(page, 'rebalance');
  await goToRebalance(page);

  const expectSettlements = async () => {
    await expect(page).toHaveURL(/[?&]area=settlements(&|$)/);
    await expect(areaTab(page, 'Settlements')).toHaveAttribute('aria-selected', 'true');
    await expect(areaTab(page, 'Rebalance')).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settlements');
    await expect(page.getByRole('region', { name: 'Exception queue' })).toBeVisible();
    await expect(allocation(page)).toHaveCount(0);
  };
  const expectRebalance = async () => {
    await expect(page).toHaveURL(/[?&]area=rebalance(&|$)/);
    await expect(areaTab(page, 'Rebalance')).toHaveAttribute('aria-selected', 'true');
    await expect(areaTab(page, 'Settlements')).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rebalance');
    await expect(allocation(page)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Exception queue' })).toHaveCount(0);
  };

  await areaTab(page, 'Settlements').click();
  await expectSettlements();

  await page.goBack();
  await expectRebalance();
  await expectSavedTargets(page, SEED);

  await page.goForward();
  await expectSettlements();

  await page.goBack();
  await expectRebalance();
});
