import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, openArea } from '../tooling/fixtures';

const CLASSES = ['Equity', 'Fixed income', 'Cash'] as const;
type AssetClass = (typeof CLASSES)[number];
type Targets = Record<AssetClass, string>;

const ZERO_DRIFT = /^0(\.0+)?\s*(pts|%)$/;
const pct = (n: number) => new RegExp(`^${n}(\\.0+)?%$`);
const drift = (n: number) => {
  if (n === 0) return ZERO_DRIFT;
  const sign = n > 0 ? '\\+' : '[−-]';
  return new RegExp(`^${sign}${Math.abs(n)}(\\.0+)?\\s*(pts|%)$`);
};

const targetsTable = (page: Page) => page.getByRole('table', { name: 'Current and target weights by asset class' });
const previewTable = (page: Page) => page.getByRole('table', { name: 'Rebalance preview by asset class' });
const rowFor = (table: Locator, cls: string) =>
  table.getByRole('row').filter({ has: table.page().getByRole('rowheader', { name: cls, exact: true }) });
const targetInput = (page: Page, cls: AssetClass) => page.getByLabel(`Target weight for ${cls} (%)`, { exact: true });
const targetAuditEntries = (page: Page) =>
  page.getByRole('complementary').filter({ has: page.getByRole('heading', { name: 'Audit trail' }) })
    .getByRole('listitem').filter({ hasText: /Targets \d/ });

async function expectClassesExactlyOnce(page: Page) {
  const table = targetsTable(page);
  await expect(table.getByRole('rowheader')).toHaveText(['Equity', 'Fixed income', 'Cash', 'Total']);
  for (const cls of CLASSES) await expect(table.getByRole('rowheader', { name: cls, exact: true })).toHaveCount(1);
}

async function expectSavedTargets(page: Page, expected: [number, number, number]) {
  const table = targetsTable(page);
  for (const [i, cls] of CLASSES.entries()) {
    await expect(rowFor(table, cls).getByRole('cell').nth(1)).toHaveText(pct(expected[i]));
  }
  const total = expected.reduce((s, n) => s + n, 0);
  await expect(rowFor(table, 'Total').getByRole('cell').nth(1)).toHaveText(pct(total));
}

async function startEdit(page: Page) {
  await page.getByRole('button', { name: 'Edit targets' }).click();
  await expect(targetInput(page, 'Equity')).toBeVisible();
}

async function fillTargets(page: Page, targets: Partial<Targets>) {
  for (const cls of CLASSES) {
    const v = targets[cls];
    if (v !== undefined) await targetInput(page, cls).fill(v);
  }
}

async function saveTargets(page: Page) {
  await page.getByRole('button', { name: 'Save targets' }).click();
}

async function reloadRebalance(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  await expect(page.getByRole('tab', { name: 'Rebalance' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Rebalance' })).toBeVisible();
  await expect(targetsTable(page)).toBeVisible();
}

async function runPreview(page: Page) {
  await page.getByRole('button', { name: 'Preview rebalance' }).click();
  await expect(previewTable(page)).toBeVisible();
}

async function expectPreviewRow(
  page: Page,
  cls: AssetClass,
  current: number,
  target: number,
  d: number,
  assessment: RegExp
) {
  const cells = rowFor(previewTable(page), cls).getByRole('cell');
  await expect(cells.nth(0)).toHaveText(pct(current));
  await expect(cells.nth(1)).toHaveText(pct(target));
  await expect(cells.nth(2)).toHaveText(drift(d));
  await expect(cells.nth(3)).toHaveText(assessment);
}

const UNDERWEIGHT = /Proposed change\s*Underweight/;
const OVERWEIGHT = /Proposed change\s*Overweight/;
const WITHIN = /^Within tolerance$/;

async function goTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${name}(\\s|$)`) });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function expectNoOrders(page: Page) {
  const orders = page.getByRole('table', { name: 'Orders' });
  await expect(orders).toBeVisible();
  await expect(page.getByText('0 of 0 orders')).toBeVisible();
  await expect(orders.getByRole('rowheader')).toHaveCount(0);
  await expect(orders.getByText('No orders yet.')).toBeVisible();
}

caseTest('WM-TC-039', async ({ page }) => {
  await openArea(page, 'rebalance');

  // Step 1: exactly three asset classes, each once.
  await expectClassesExactlyOnce(page);

  // Step 2: current and target weights, target total 100%.
  const table = targetsTable(page);
  for (const [cls, w] of [['Equity', 60], ['Fixed income', 30], ['Cash', 10]] as const) {
    const cells = rowFor(table, cls).getByRole('cell');
    await expect(cells.nth(0)).toHaveText(pct(w));
    await expect(cells.nth(1)).toHaveText(pct(w));
  }
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 3: drift is zero for every class and each is within tolerance.
  for (const cls of CLASSES) await expect(rowFor(table, cls).getByRole('cell').last()).toHaveText(ZERO_DRIFT);
  await runPreview(page);
  await expectPreviewRow(page, 'Equity', 60, 60, 0, WITHIN);
  await expectPreviewRow(page, 'Fixed income', 30, 30, 0, WITHIN);
  await expectPreviewRow(page, 'Cash', 10, 10, 0, WITHIN);
});

caseTest('WM-TC-040', async ({ page }) => {
  await openArea(page, 'rebalance');

  // Step 1: save 70/20/10 with confirmation; total shows 100%.
  await startEdit(page);
  await fillTargets(page, { Equity: '70', 'Fixed income': '20', Cash: '10' });
  await expect(page.getByRole('status', { name: 'New target total' })).toHaveText(pct(100));
  await saveTargets(page);
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' }))
    .toHaveText(/Target weights saved: Equity 70(\.0+)?%, Fixed income 20(\.0+)?%, Cash 10(\.0+)?%\./);
  await expect(targetInput(page, 'Equity')).toHaveCount(0);
  await expectSavedTargets(page, [70, 20, 10]);

  // Step 2: drift preview per class.
  await runPreview(page);
  await expectPreviewRow(page, 'Equity', 60, 70, -10, UNDERWEIGHT);
  await expectPreviewRow(page, 'Fixed income', 30, 20, 10, OVERWEIGHT);
  await expectPreviewRow(page, 'Cash', 10, 10, 0, WITHIN);

  // Step 3: Equity and Fixed income flagged as proposed changes; Cash within tolerance.
  const preview = previewTable(page);
  await expect(rowFor(preview, 'Equity').getByText('Proposed change', { exact: true })).toBeVisible();
  await expect(rowFor(preview, 'Fixed income').getByText('Proposed change', { exact: true })).toBeVisible();
  await expect(rowFor(preview, 'Cash').getByText('Within tolerance', { exact: true })).toBeVisible();
  await expect(rowFor(preview, 'Cash').getByText('Proposed change')).toHaveCount(0);

  // Step 4: targets persist after reload.
  await reloadRebalance(page);
  await expectSavedTargets(page, [70, 20, 10]);

  // Step 5: audit history records 60/30/10 -> 70/20/10.
  await expect(targetAuditEntries(page)).toHaveCount(1);
  await expect(targetAuditEntries(page).first()).toContainText(/Targets 60\/30\/10 → 70\/20\/10/);
});

caseTest('WM-TC-041', async ({ page }) => {
  await openArea(page, 'rebalance');

  // Step 1: save 50/40/10 and preview; no trades executed.
  await startEdit(page);
  await fillTargets(page, { Equity: '50', 'Fixed income': '40', Cash: '10' });
  await saveTargets(page);
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' })).toBeVisible();
  await expectSavedTargets(page, [50, 40, 10]);
  await runPreview(page);
  await expectPreviewRow(page, 'Equity', 60, 50, 10, OVERWEIGHT);
  await expectPreviewRow(page, 'Fixed income', 30, 40, -10, UNDERWEIGHT);
  await expect(page.getByRole('status').filter({ hasText: 'Preview status' })).toContainText('No trades were placed.');

  // Step 2: no orders exist.
  await goTab(page, 'Orders');
  await expectNoOrders(page);

  // Step 3: holdings and totals unchanged.
  await goTab(page, 'Portfolio');
  const holdings = page.getByRole('table', { name: 'Holdings' });
  await expect(holdings.getByRole('rowheader')).toHaveCount(3);
  for (const [symbol, quantity] of [['RY', '100'], ['BMO', '80'], ['MSFT', '40']] as const) {
    await expect(rowFor(holdings, symbol).getByRole('cell').nth(3)).toHaveText(quantity);
  }
  await expect(page.locator('dl[aria-label="CAD totals"] .ws-total__value')).toHaveText(/^\$24,000\.00$/);
  await expect(page.locator('dl[aria-label="USD totals"] .ws-total__value')).toHaveText(/^US\$16,800\.00$/);

  // Step 4: client account cash unchanged.
  await goTab(page, 'Clients');
  await page.getByRole('button', { name: 'Eleanor Whitfield' }).click();
  const c1001 = page.getByRole('table', { name: 'Accounts for Eleanor Whitfield' });
  await expect(rowFor(c1001, 'Whitfield Investment A1001').getByRole('cell').nth(1)).toHaveText('$25,000.00');
  await expect(rowFor(c1001, 'Whitfield Savings A1002').getByRole('cell').nth(1)).toHaveText('$10,000.00');
  await page.getByRole('button', { name: 'James Chen' }).click();
  const c1002 = page.getByRole('table', { name: 'Accounts for James Chen' });
  await expect(rowFor(c1002, 'Chen USD Investment A1003').getByRole('cell').nth(1)).toHaveText('US$15,000.00');

  // Step 5: reload and re-check Orders.
  await page.reload();
  await page.waitForLoadState('load');
  await goTab(page, 'Orders');
  await expectNoOrders(page);
});

caseTest('WM-TC-042', async ({ page }) => {
  await openArea(page, 'rebalance');

  // Step 1: total 99 rejected, nothing saved.
  await startEdit(page);
  await fillTargets(page, { Equity: '60', 'Fixed income': '30', Cash: '9' });
  await saveTargets(page);
  const alert = page.getByRole('alert');
  await expect(alert).toHaveText(/(total|sum to) (exactly )?100/i);
  const firstMessage = (await alert.textContent())?.trim();
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' })).toHaveCount(0);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 2: total 101 rejected with the same message.
  await fillTargets(page, { Cash: '11' });
  await saveTargets(page);
  await expect(alert).toHaveText(firstMessage ?? '');
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' })).toHaveCount(0);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 3: still 60/30/10 after reload.
  await reloadRebalance(page);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 4: no target change audit entry.
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  await expect(targetAuditEntries(page)).toHaveCount(0);
});

caseTest('WM-TC-043', async ({ page }) => {
  await openArea(page, 'rebalance');

  // Step 1: -10/80/30 rejected (range), nothing saved.
  await startEdit(page);
  await fillTargets(page, { Equity: '-10', 'Fixed income': '80', Cash: '30' });
  await saveTargets(page);
  await expect(page.getByRole('alert')).toHaveText(/(between 0 and 100|from 0 to 100)/i);
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' })).toHaveCount(0);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 2: 110/-10/0 rejected, previous targets kept.
  await fillTargets(page, { Equity: '110', 'Fixed income': '-10', Cash: '0' });
  await saveTargets(page);
  await expect(page.getByRole('alert')).toHaveText(/(between 0 and 100|from 0 to 100)/i);
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' })).toHaveCount(0);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 3: still 60/30/10 after reload.
  await reloadRebalance(page);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 4: 100/0/0 accepted; preview drift -40/+30/+10.
  await startEdit(page);
  await fillTargets(page, { Equity: '100', 'Fixed income': '0', Cash: '0' });
  await saveTargets(page);
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expectSavedTargets(page, [100, 0, 0]);
  await runPreview(page);
  await expectPreviewRow(page, 'Equity', 60, 100, -40, UNDERWEIGHT);
  await expectPreviewRow(page, 'Fixed income', 30, 0, 30, OVERWEIGHT);
  await expectPreviewRow(page, 'Cash', 10, 0, 10, OVERWEIGHT);

  // Step 5: 100/0/0 persists after reload.
  await reloadRebalance(page);
  await expectSavedTargets(page, [100, 0, 0]);
});

caseTest('WM-TC-044', async ({ page }) => {
  await openArea(page, 'rebalance');

  // Step 1: blank Cash rejected, nothing saved.
  await startEdit(page);
  await fillTargets(page, { Equity: '60', 'Fixed income': '40', Cash: '' });
  await saveTargets(page);
  await expect(page.getByRole('alert')).toHaveText(/Cash.*(needs a target|enter a target)|(needs a target|enter a target).*Cash/i);
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' })).toHaveCount(0);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 2: 'ten' rejected with a validation message, nothing saved.
  await fillTargets(page, { Cash: 'ten' });
  await saveTargets(page);
  await expect(page.getByRole('alert')).toHaveText(/Cash.*must be a number|must be a number.*Cash/i);
  await expect(page.getByRole('status').filter({ hasText: 'Target weights saved' })).toHaveCount(0);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 3: abandon 50/40/10 via Cancel; edit closes, targets 60/30/10.
  await fillTargets(page, { Equity: '50', 'Fixed income': '40', Cash: '10' });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(targetInput(page, 'Equity')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save targets' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit targets' })).toBeVisible();
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 4: after reload, 60/30/10 and zero drift for all classes.
  await reloadRebalance(page);
  await expectSavedTargets(page, [60, 30, 10]);
  for (const cls of CLASSES) {
    await expect(rowFor(targetsTable(page), cls).getByRole('cell').last()).toHaveText(ZERO_DRIFT);
  }
  await expect(targetAuditEntries(page)).toHaveCount(0);
});
