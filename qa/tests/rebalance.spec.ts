import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const CLASSES = ['Equity', 'Fixed income', 'Cash'] as const;
type AssetClass = (typeof CLASSES)[number];
type Targets = Record<AssetClass, string>;

const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}(\\s|$)`) });
const allocation = (page: Page) => page.getByRole('region', { name: 'Target allocation' });
const targetTable = (page: Page) => page.getByRole('table', { name: 'Current and target weights by asset class' });
const previewTable = (page: Page) => page.getByRole('table', { name: 'Rebalance preview by asset class' });
const auditTrail = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });

const classRow = (table: Locator, cls: string) =>
  table.getByRole('row').filter({ has: table.page().getByRole('rowheader', { name: cls, exact: true }) });

const pct = (n: string) => `${Number(n).toFixed(1)}%`;

async function goToRebalance(page: Page) {
  await tab(page, 'Rebalance').click();
  await expect(tab(page, 'Rebalance')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Rebalance', exact: true })).toBeVisible();
}

async function reloadAndReturn(page: Page) {
  await page.reload();
  await goToRebalance(page);
}

async function expectSavedTargets(page: Page, current: Targets, target: Targets) {
  const table = targetTable(page);
  await expect(table.locator('tbody').getByRole('rowheader')).toHaveText([...CLASSES]);
  for (const cls of CLASSES) {
    const cells = classRow(table, cls).getByRole('cell');
    await expect(cells.nth(0)).toHaveText(pct(current[cls]));
    await expect(cells.nth(1)).toHaveText(pct(target[cls]));
  }
  const total = CLASSES.reduce((s, c) => s + Number(target[c]), 0);
  await expect(classRow(table, 'Total').getByRole('cell').nth(1)).toHaveText(pct(String(total)));
}

async function enterTargets(page: Page, targets: Partial<Targets>) {
  if (await page.getByRole('button', { name: 'Edit targets' }).isVisible()) {
    await page.getByRole('button', { name: 'Edit targets' }).click();
  }
  for (const cls of CLASSES) {
    const value = targets[cls];
    if (value === undefined) continue;
    const field = page.getByLabel(`Target weight for ${cls} (%)`);
    await field.click();
    await field.fill(value);
  }
}

async function saveTargets(page: Page) {
  await page.getByRole('button', { name: 'Save targets' }).click();
}

async function openPreview(page: Page) {
  await page.getByRole('button', { name: 'Preview rebalance' }).click();
  await expect(previewTable(page)).toBeVisible();
}

async function expectPreviewRow(page: Page, cls: AssetClass, current: string, target: string, drift: string, assessment: RegExp) {
  const cells = classRow(previewTable(page), cls).getByRole('cell');
  await expect(cells.nth(0)).toHaveText(current);
  await expect(cells.nth(1)).toHaveText(target);
  await expect(cells.nth(2)).toHaveText(drift);
  await expect(cells.nth(3)).toHaveText(assessment);
}

async function expectNoTargetChangeSaved(page: Page) {
  await expect(allocation(page).getByRole('status').filter({ hasText: /Target weights saved/ })).toHaveCount(0);
  await expectSavedTargets(page, SEED, SEED);
}

const SEED: Targets = { Equity: '60', 'Fixed income': '30', Cash: '10' };

caseTest('WM-TC-039', async ({ page }) => {
  await openArea(page, 'rebalance');

  await goToRebalance(page);
  const table = targetTable(page);
  await expect(table.locator('tbody').getByRole('rowheader')).toHaveText(['Equity', 'Fixed income', 'Cash']);
  for (const cls of CLASSES) await expect(classRow(table, cls)).toHaveCount(1);

  await expectSavedTargets(page, SEED, SEED);
  await expect(classRow(table, 'Total').getByRole('cell').nth(0)).toHaveText('100.0%');

  for (const cls of CLASSES) {
    await expect(classRow(table, cls).getByRole('cell').last()).toHaveText('0.0 pts');
  }
  await openPreview(page);
  for (const cls of CLASSES) {
    await expectPreviewRow(page, cls, pct(SEED[cls]), pct(SEED[cls]), '0.0 pts', /^Within tolerance$/);
  }
  await expect(page.getByRole('status').filter({ hasText: 'Preview status:' })).toContainText('Within tolerance');
});

caseTest('WM-TC-040', async ({ page }) => {
  await openArea(page, 'rebalance');
  const next: Targets = { Equity: '70', 'Fixed income': '20', Cash: '10' };

  await enterTargets(page, next);
  await expect(page.getByLabel('New target total')).toHaveText('100.0%');
  await saveTargets(page);
  await expect(allocation(page).getByRole('status').filter({ hasText: /Target weights saved/ }))
    .toHaveText('Target weights saved: Equity 70.0%, Fixed income 20.0%, Cash 10.0%.');
  await expectSavedTargets(page, SEED, next);

  await openPreview(page);
  await expectPreviewRow(page, 'Equity', '60.0%', '70.0%', '−10.0 pts', /Proposed change\s*Underweight/);
  await expectPreviewRow(page, 'Fixed income', '30.0%', '20.0%', '+10.0 pts', /Proposed change\s*Overweight/);
  await expectPreviewRow(page, 'Cash', '10.0%', '10.0%', '0.0 pts', /^Within tolerance$/);

  const assessment = (cls: AssetClass) => classRow(previewTable(page), cls).getByRole('cell').nth(3);
  await expect(assessment('Equity')).toContainText('Proposed change');
  await expect(assessment('Fixed income')).toContainText('Proposed change');
  await expect(assessment('Cash')).not.toContainText('Proposed change');
  await expect(assessment('Cash')).toHaveText('Within tolerance');

  await reloadAndReturn(page);
  await expectSavedTargets(page, SEED, next);

  const entries = auditTrail(page).getByRole('list', { name: 'Audit entries' }).getByRole('listitem');
  await auditTrail(page).scrollIntoViewIfNeeded();
  await expect(entries.filter({ hasText: /Targets 60\/30\/10 → 70\/20\/10/ })).toHaveCount(1);
});

caseTest('WM-TC-041', async ({ page }) => {
  await openArea(page, 'rebalance');

  await enterTargets(page, { Equity: '50', 'Fixed income': '40', Cash: '10' });
  await saveTargets(page);
  await expect(allocation(page).getByRole('status').filter({ hasText: /Target weights saved/ })).toBeVisible();
  await openPreview(page);
  await expectPreviewRow(page, 'Equity', '60.0%', '50.0%', '+10.0 pts', /Proposed change\s*Overweight/);
  await expectPreviewRow(page, 'Fixed income', '30.0%', '40.0%', '−10.0 pts', /Proposed change\s*Underweight/);
  await expect(page.getByRole('status').filter({ hasText: 'Preview status:' })).toContainText('No trades were placed.');

  const expectNoOrders = async () => {
    await tab(page, 'Orders').click();
    const orders = page.getByRole('table', { name: 'Orders' });
    await expect(page.getByText(/^0 of 0 orders$/)).toBeVisible();
    await expect(orders.locator('tbody tr')).toHaveCount(1);
    await expect(orders.locator('tbody')).toHaveText('No orders yet. Place one with the order ticket.');
  };
  await expectNoOrders();

  await tab(page, 'Portfolio').click();
  const holdings = page.getByRole('table', { name: 'Holdings' });
  await expect(holdings.locator('tbody tr')).toHaveCount(3);
  for (const [symbol, quantity] of [['RY', '100'], ['BMO', '80'], ['MSFT', '40']]) {
    await expect(classRow(holdings, symbol).getByRole('cell').nth(3)).toHaveText(quantity);
  }
  await expect(page.locator('[aria-label="CAD totals"]')).toContainText(/Market value \(CAD\)\s*\$24,000\.00/);
  await expect(page.locator('[aria-label="USD totals"]')).toContainText(/Market value \(USD\)\s*US\$16,800\.00/);

  await tab(page, 'Clients').click();
  const accountCash = (client: string, account: string) =>
    page.getByRole('table', { name: `Accounts for ${client}` }).getByRole('row').filter({ hasText: account }).getByRole('cell').nth(1);
  await page.getByRole('button', { name: 'Eleanor Whitfield', exact: true }).click();
  await expect(accountCash('Eleanor Whitfield', 'A1001')).toHaveText('$25,000.00');
  await expect(accountCash('Eleanor Whitfield', 'A1002')).toHaveText('$10,000.00');
  await page.getByRole('button', { name: 'James Chen', exact: true }).click();
  await expect(accountCash('James Chen', 'A1003')).toHaveText('US$15,000.00');

  await page.reload();
  await expectNoOrders();
});

caseTest('WM-TC-042', async ({ page }) => {
  await openArea(page, 'rebalance');
  const rejection = allocation(page).getByRole('alert');

  await enterTargets(page, { Equity: '60', 'Fixed income': '30', Cash: '9' });
  await expect(page.getByLabel('New target total')).toHaveText('99.0% (must total exactly 100%)');
  await saveTargets(page);
  await expect(rejection).toBeVisible();
  await expect(rejection).toContainText(/(sum|total)( exactly)? to 100/i);
  await expectNoTargetChangeSaved(page);
  const firstMessage = (await rejection.innerText()).trim();

  await enterTargets(page, { Cash: '11' });
  await expect(page.getByLabel('New target total')).toHaveText('101.0% (must total exactly 100%)');
  await saveTargets(page);
  await expect(rejection).toHaveText(firstMessage);
  await expectNoTargetChangeSaved(page);

  await reloadAndReturn(page);
  await expectSavedTargets(page, SEED, SEED);

  await auditTrail(page).scrollIntoViewIfNeeded();
  await expect(auditTrail(page).getByRole('listitem').filter({ hasText: /Targets/ })).toHaveCount(0);
  await expect(auditTrail(page)).toContainText('No changes recorded yet.');
});

caseTest('WM-TC-043', async ({ page }) => {
  await openArea(page, 'rebalance');
  const rejection = allocation(page).getByRole('alert');

  await enterTargets(page, { Equity: '-10', 'Fixed income': '80', Cash: '30' });
  await saveTargets(page);
  await expect(rejection).toContainText(/0 (to|and) 100/);
  await expectNoTargetChangeSaved(page);

  await enterTargets(page, { Equity: '110', 'Fixed income': '-10', Cash: '0' });
  await saveTargets(page);
  await expect(rejection).toContainText(/0 (to|and) 100/);
  await expectNoTargetChangeSaved(page);

  await reloadAndReturn(page);
  await expectSavedTargets(page, SEED, SEED);

  const all: Targets = { Equity: '100', 'Fixed income': '0', Cash: '0' };
  await enterTargets(page, all);
  await saveTargets(page);
  await expect(allocation(page).getByRole('status').filter({ hasText: /Target weights saved/ }))
    .toHaveText('Target weights saved: Equity 100.0%, Fixed income 0.0%, Cash 0.0%.');
  await openPreview(page);
  await expectPreviewRow(page, 'Equity', '60.0%', '100.0%', '−40.0 pts', /Proposed change\s*Underweight/);
  await expectPreviewRow(page, 'Fixed income', '30.0%', '0.0%', '+30.0 pts', /Proposed change\s*Overweight/);
  await expectPreviewRow(page, 'Cash', '10.0%', '0.0%', '+10.0 pts', /Proposed change\s*Overweight/);

  await reloadAndReturn(page);
  await expectSavedTargets(page, SEED, all);
});

caseTest('WM-TC-044', async ({ page }) => {
  await openArea(page, 'rebalance');
  const rejection = allocation(page).getByRole('alert');

  await enterTargets(page, { Equity: '60', 'Fixed income': '40', Cash: '' });
  await saveTargets(page);
  await expect(rejection).toContainText(/Cash.*Every asset class needs a target/);
  await expectNoTargetChangeSaved(page);

  await enterTargets(page, { Cash: 'ten' });
  await saveTargets(page);
  await expect(rejection).toContainText(/Cash must be a number/);
  await expectNoTargetChangeSaved(page);

  await enterTargets(page, { Equity: '50', 'Fixed income': '40', Cash: '10' });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Target weight for Equity (%)')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit targets' })).toBeVisible();
  await expectSavedTargets(page, SEED, SEED);

  await reloadAndReturn(page);
  await expectSavedTargets(page, SEED, SEED);
  for (const cls of CLASSES) {
    await expect(classRow(targetTable(page), cls).getByRole('cell').last()).toHaveText('0.0 pts');
  }
});

gapTest(
  'WM-GAP-080',
  {
    title: 'Legacy Rebalance & Orders trade selection updates impact summary and post-trade drift',
    area: 'rebalance',
    wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.1.2'
  },
  async ({ page }) => {
    await page.goto('/?screen=c360');
    await page.getByText('Rebalance & orders', { exact: true }).click();
    await expect(page.getByText('Order ticket & rebalance', { exact: true })).toBeVisible();

    const metric = (label: string) => page.getByText(label, { exact: true }).locator('xpath=..');
    const msftRow = page.locator('tr, div')
      .filter({ hasText: 'Microsoft Corp.' })
      .filter({ has: page.getByText(/^(Exclude|Include)$/) })
      .last();
    const equitiesDrift = metric('Equities');

    await expect(page.getByText('7 of 7 included', { exact: true })).toBeVisible();
    await expect(metric('Buys')).toContainText('$251,555');
    await expect(metric('Net cash')).toContainText('+$38,363');
    await expect(equitiesDrift).toContainText('→ −0.4 pts');
    const driftBefore = (await equitiesDrift.textContent()) ?? '';

    await msftRow.getByText('Exclude', { exact: true }).click();
    await expect(page.getByText('6 of 7 included', { exact: true })).toBeVisible();
    await expect(msftRow.getByText('Include', { exact: true })).toBeVisible();
    await expect(metric('Buys')).toContainText('$195,455');
    await expect(metric('Net cash')).toContainText('+$94,463');
    await expect(metric('Est. trading costs')).toContainText('$269.85');
    await expect(equitiesDrift).not.toHaveText(driftBefore);

    await msftRow.getByText('Include', { exact: true }).click();
    await expect(page.getByText('7 of 7 included', { exact: true })).toBeVisible();
    await expect(metric('Buys')).toContainText('$251,555');
    await expect(metric('Net cash')).toContainText('+$38,363');
    await expect(equitiesDrift).toContainText('→ −0.4 pts');
  }
);
