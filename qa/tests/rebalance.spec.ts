import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const CLASSES = ['Equity', 'Fixed income', 'Cash'] as const;
type Targets = [number, number, number];
type Flag = 'Overweight' | 'Underweight' | 'Within tolerance';

const WIKI = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/';

const pct = (n: number) => new RegExp(`^\\s*${n}(\\.0+)?\\s*%\\s*$`);
const drift = (n: number) =>
  n === 0
    ? /^\s*[+−-]?0(\.0+)?\s*(%|pts)?\s*$/
    : new RegExp(`^\\s*${n > 0 ? '\\+' : '[−-]'}${Math.abs(n)}(\\.0+)?\\s*(%|pts)?\\s*$`);

const allocRegion = (page: Page) => page.getByRole('region', { name: 'Target allocation' });
const allocTable = (page: Page) => allocRegion(page).getByRole('table');
const previewRegion = (page: Page) => page.getByRole('region', { name: 'Rebalance preview' });
const previewTable = (page: Page) => previewRegion(page).getByRole('table');
const auditPanel = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });
const rowFor = (table: Locator, header: string | RegExp) =>
  table.getByRole('row').filter({ has: table.page().getByRole('rowheader', { name: header, exact: typeof header === 'string' }) });
const targetInput = (page: Page, cls: string) => page.getByLabel(`Target weight for ${cls} (%)`, { exact: true });
const savedNotice = (page: Page) => allocRegion(page).getByRole('status').filter({ hasText: /saved/i });

async function expectRebalanceLoaded(page: Page) {
  await expect(page.getByRole('tab', { name: /^Rebalance/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Rebalance' })).toBeVisible();
  await expect(allocTable(page)).toBeVisible();
}

async function openRebalance(page: Page) {
  await openArea(page, 'rebalance');
  await expectRebalanceLoaded(page);
}

async function reloadAndReturn(page: Page) {
  await page.reload();
  await expect(allocTable(page)).toBeVisible();
  await page.getByRole('tab', { name: /^Rebalance/ }).click();
  await expectRebalanceLoaded(page);
}

async function expectSavedTargets(page: Page, targets: Targets) {
  for (const [i, cls] of CLASSES.entries()) {
    await expect(rowFor(allocTable(page), cls).getByRole('cell').nth(1)).toHaveText(pct(targets[i]));
  }
}

async function expectCurrentWeights(page: Page, current: Targets) {
  for (const [i, cls] of CLASSES.entries()) {
    await expect(rowFor(allocTable(page), cls).getByRole('cell').first()).toHaveText(pct(current[i]));
  }
}

async function expectTableDrift(page: Page, drifts: Targets) {
  for (const [i, cls] of CLASSES.entries()) {
    await expect(rowFor(allocTable(page), cls).getByRole('cell').last()).toHaveText(drift(drifts[i]));
  }
}

async function startEdit(page: Page) {
  await allocRegion(page).getByRole('button', { name: 'Edit targets' }).click();
  await expect(targetInput(page, 'Equity')).toBeVisible();
}

async function fillTargets(page: Page, values: [string, string, string]) {
  for (const [i, cls] of CLASSES.entries()) await targetInput(page, cls).fill(values[i]);
}

async function saveTargets(page: Page) {
  await allocRegion(page).getByRole('button', { name: 'Save targets' }).click();
}

async function editAndSave(page: Page, values: [string, string, string]) {
  await startEdit(page);
  await fillTargets(page, values);
  await saveTargets(page);
}

async function expectRejected(page: Page, message?: RegExp) {
  const alert = allocRegion(page).getByRole('alert');
  await expect(alert).toBeVisible();
  if (message) await expect(alert).toHaveText(message);
  await expect(savedNotice(page)).toHaveCount(0);
  return (await alert.innerText()).trim();
}

async function expectNoTargetAudit(page: Page) {
  await expect(auditPanel(page)).toBeVisible();
  await expect(auditPanel(page).getByRole('listitem').filter({ hasText: /target|allocation/i })).toHaveCount(0);
}

async function runPreview(page: Page) {
  await previewRegion(page).getByRole('button', { name: 'Preview rebalance' }).click();
  await expect(previewTable(page)).toBeVisible();
}

async function expectPreviewRows(
  page: Page,
  rows: Array<{ cls: string; current: number; target: number; drift: number; flag?: Flag }>
) {
  await expect(previewTable(page).locator('tbody').getByRole('row')).toHaveCount(rows.length);
  for (const r of rows) {
    const cells = rowFor(previewTable(page), r.cls).getByRole('cell');
    await expect(cells.nth(0)).toHaveText(pct(r.current));
    await expect(cells.nth(1)).toHaveText(pct(r.target));
    await expect(cells.nth(2)).toHaveText(drift(r.drift));
    if (r.flag === 'Within tolerance') {
      await expect(cells.nth(3)).toContainText('Within tolerance');
      await expect(cells.nth(3)).not.toContainText('Proposed change');
    } else if (r.flag) {
      await expect(cells.nth(3)).toContainText('Proposed change');
      await expect(cells.nth(3)).toContainText(r.flag);
      await expect(cells.nth(3)).not.toContainText('Within tolerance');
    }
  }
}

const TOTAL_MESSAGE = /(total|sum)[^.]*100/i;
const RANGE_MESSAGE = /\b0\b[^.]*\b(to|and|-|–)\b[^.]*100/i;

caseTest('WM-TC-039', async ({ page }) => {
  await openRebalance(page);

  // Step 1: exactly three asset classes, each once.
  await expect(allocTable(page).locator('tbody').getByRole('row')).toHaveCount(3);
  for (const cls of CLASSES) {
    await expect(allocTable(page).locator('tbody').getByRole('rowheader', { name: cls, exact: true })).toHaveCount(1);
  }

  // Step 2: current and target weights; target total 100%.
  await expectCurrentWeights(page, [60, 30, 10]);
  await expectSavedTargets(page, [60, 30, 10]);
  await expect(rowFor(allocTable(page), 'Total').getByRole('cell').nth(1)).toHaveText(pct(100));

  // Step 3: drift 0 for every class, each marked within tolerance in the drift preview.
  await expectTableDrift(page, [0, 0, 0]);
  await runPreview(page);
  await expectPreviewRows(page, [
    { cls: 'Equity', current: 60, target: 60, drift: 0, flag: 'Within tolerance' },
    { cls: 'Fixed income', current: 30, target: 30, drift: 0, flag: 'Within tolerance' },
    { cls: 'Cash', current: 10, target: 10, drift: 0, flag: 'Within tolerance' }
  ]);
});

caseTest('WM-TC-040', async ({ page }) => {
  await openRebalance(page);

  // Step 1: save 70/20/10 with a confirmation; total 100%.
  await editAndSave(page, ['70', '20', '10']);
  await expect(savedNotice(page)).toBeVisible();
  await expect(allocRegion(page).getByRole('alert')).toHaveCount(0);
  await expectSavedTargets(page, [70, 20, 10]);
  await expect(rowFor(allocTable(page), 'Total').getByRole('cell').nth(1)).toHaveText(pct(100));

  // Steps 2-3: drift preview per class and flags.
  await runPreview(page);
  await expectPreviewRows(page, [
    { cls: 'Equity', current: 60, target: 70, drift: -10, flag: 'Underweight' },
    { cls: 'Fixed income', current: 30, target: 20, drift: 10, flag: 'Overweight' },
    { cls: 'Cash', current: 10, target: 10, drift: 0, flag: 'Within tolerance' }
  ]);

  // Step 4: persisted after reload.
  await reloadAndReturn(page);
  await expectSavedTargets(page, [70, 20, 10]);

  // Step 5: audit entry records 60/30/10 -> 70/20/10.
  await expect(auditPanel(page)).toBeVisible();
  await expect(
    auditPanel(page).getByRole('listitem').filter({ hasText: /60\s*\/\s*30\s*\/\s*10\D[\s\S]*70\s*\/\s*20\s*\/\s*10/ })
  ).toHaveCount(1);
});

caseTest('WM-TC-041', async ({ page }) => {
  await openRebalance(page);

  // Step 1: save 50/40/10 and preview; no trades executed.
  await editAndSave(page, ['50', '40', '10']);
  await expect(savedNotice(page)).toBeVisible();
  await expectSavedTargets(page, [50, 40, 10]);
  await runPreview(page);
  await expectPreviewRows(page, [
    { cls: 'Equity', current: 60, target: 50, drift: 10, flag: 'Overweight' },
    { cls: 'Fixed income', current: 30, target: 40, drift: -10, flag: 'Underweight' },
    { cls: 'Cash', current: 10, target: 10, drift: 0 }
  ]);
  await expect(previewRegion(page)).toContainText(/no trades/i);

  const expectNoOrders = async () => {
    const orders = page.getByRole('table', { name: 'Orders', exact: true });
    await expect(orders).toBeVisible();
    await expect(orders.locator('tbody').getByRole('rowheader')).toHaveCount(0);
    await expect(orders).toContainText(/no orders/i);
  };

  // Step 2: Orders area has no orders.
  await page.getByRole('tab', { name: /^Orders/ }).click();
  await expect(page.getByRole('tab', { name: /^Orders/ })).toHaveAttribute('aria-selected', 'true');
  await expectNoOrders();

  // Step 3: Portfolio holdings and per-currency totals unchanged.
  await page.getByRole('tab', { name: /^Portfolio/ }).click();
  await expect(page.getByRole('tab', { name: /^Portfolio/ })).toHaveAttribute('aria-selected', 'true');
  const holdings = page.getByRole('table', { name: 'Holdings', exact: true });
  await expect(holdings.locator('tbody').getByRole('rowheader')).toHaveCount(3);
  for (const [symbol, quantity] of [['RY', '100'], ['BMO', '80'], ['MSFT', '40']] as const) {
    await expect(rowFor(holdings, symbol).getByRole('cell').nth(3)).toHaveText(quantity);
  }
  await expect(page.getByLabel('CAD totals', { exact: true })).toContainText('24,000.00');
  await expect(page.getByLabel('USD totals', { exact: true })).toContainText('16,800.00');

  // Step 4: client account cash unchanged.
  await page.getByRole('tab', { name: /^Clients/ }).click();
  await expect(page.getByRole('tab', { name: /^Clients/ })).toHaveAttribute('aria-selected', 'true');
  const expectAccount = async (client: string, account: string, currency: string, cash: string) => {
    await page.getByRole('button', { name: client, exact: true }).click();
    const accounts = page.getByRole('table', { name: `Accounts for ${client}` });
    await expect(accounts).toBeVisible();
    const cells = rowFor(accounts, new RegExp(account)).getByRole('cell');
    await expect(cells.nth(0)).toHaveText(currency);
    await expect(cells.nth(1)).toContainText(cash);
  };
  await expectAccount('Eleanor Whitfield', 'A1001', 'CAD', '25,000.00');
  await expectAccount('Eleanor Whitfield', 'A1002', 'CAD', '10,000.00');
  await expectAccount('James Chen', 'A1003', 'USD', '15,000.00');

  // Step 5: after reload, still no orders.
  await page.reload();
  await page.getByRole('tab', { name: /^Orders/ }).click();
  await expect(page.getByRole('tab', { name: /^Orders/ })).toHaveAttribute('aria-selected', 'true');
  await expectNoOrders();
});

caseTest('WM-TC-042', async ({ page }) => {
  await openRebalance(page);

  // Step 1: 60/30/9 (99) rejected; nothing saved.
  await editAndSave(page, ['60', '30', '9']);
  const message = await expectRejected(page, TOTAL_MESSAGE);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 2: Cash 11 (101) rejected with the same message.
  await targetInput(page, 'Cash').fill('11');
  await saveTargets(page);
  await expectRejected(page);
  await expect(allocRegion(page).getByRole('alert')).toHaveText(message);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 3: reload keeps 60/30/10.
  await reloadAndReturn(page);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 4: no target change audit entry.
  await expectNoTargetAudit(page);
});

caseTest('WM-TC-043', async ({ page }) => {
  await openRebalance(page);

  // Step 1: -10/80/30 rejected for range; nothing saved.
  await editAndSave(page, ['-10', '80', '30']);
  await expectRejected(page, RANGE_MESSAGE);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 2: 110/-10/0 rejected; previous targets kept.
  await fillTargets(page, ['110', '-10', '0']);
  await saveTargets(page);
  await expectRejected(page);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 3: reload shows 60/30/10 and no target change was recorded.
  await reloadAndReturn(page);
  await expectSavedTargets(page, [60, 30, 10]);
  await expectNoTargetAudit(page);

  // Step 4: 100/0/0 accepted; preview drift -40/+30/+10.
  await editAndSave(page, ['100', '0', '0']);
  await expect(savedNotice(page)).toBeVisible();
  await expectSavedTargets(page, [100, 0, 0]);
  await runPreview(page);
  await expectPreviewRows(page, [
    { cls: 'Equity', current: 60, target: 100, drift: -40 },
    { cls: 'Fixed income', current: 30, target: 0, drift: 30 },
    { cls: 'Cash', current: 10, target: 0, drift: 10 }
  ]);

  // Step 5: reload keeps 100/0/0.
  await reloadAndReturn(page);
  await expectSavedTargets(page, [100, 0, 0]);
});

caseTest('WM-TC-044', async ({ page }) => {
  await openRebalance(page);

  // Step 1: Cash blank rejected; nothing saved.
  await editAndSave(page, ['60', '40', '']);
  await expectRejected(page, /target/i);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 2: Cash 'ten' rejected with a validation message.
  await targetInput(page, 'Cash').fill('ten');
  await saveTargets(page);
  await expectRejected(page);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 3: abandon 50/40/10; edit closes and targets show 60/30/10.
  await fillTargets(page, ['50', '40', '10']);
  await allocRegion(page).getByRole('button', { name: 'Cancel' }).click();
  for (const cls of CLASSES) await expect(targetInput(page, cls)).toHaveCount(0);
  await expect(allocRegion(page).getByRole('button', { name: 'Save targets' })).toHaveCount(0);
  await expectSavedTargets(page, [60, 30, 10]);

  // Step 4: reload shows 60/30/10, drift 0 everywhere, and nothing was recorded.
  await reloadAndReturn(page);
  await expectSavedTargets(page, [60, 30, 10]);
  await expectTableDrift(page, [0, 0, 0]);
  await expectNoTargetAudit(page);
});

gapTest(
  'WM-GAP-080',
  {
    title: 'Legacy Rebalance & Orders exclude/include proposed trade updates pre-trade cash check and approval state consistently',
    area: 'rebalance',
    wikiRef: `${WIKI}3.1.2`
  },
  async ({ page }) => {
    await page.goto('/?screen=orders');
    await expect(page.getByText('Proposed trades', { exact: false }).first()).toBeVisible();

    const msftRow = page.getByText('Microsoft Corp.', { exact: true }).locator('xpath=ancestor::div[.//a][1]');
    const cashCheck = page.getByText('Cash availability', { exact: true }).locator('xpath=..');
    const buys = page.getByText('Buys', { exact: true }).locator('xpath=..');
    const blocked = page.getByText('Resolve 1 failed check to approve', { exact: true });

    // Initial proposal: RRSP cash check fails on the Microsoft buy and approval is blocked.
    await expect(page.getByText('7 of 7 included', { exact: true })).toBeVisible();
    await expect(msftRow).toContainText('Fails cash availability in RRSP');
    await expect(cashCheck).toContainText('FAIL');
    await expect(cashCheck).toContainText(/short/i);
    await expect(page.getByText('1 failed · 2 warnings', { exact: true })).toBeVisible();
    await expect(buys).toContainText('$251,555');
    await expect(blocked).toBeVisible();
    await blocked.click();
    await expect(blocked).toBeVisible();
    await expect(page.getByText(/orders sent to routing/)).toHaveCount(0);

    // Exclude the Microsoft buy: cash check passes and six orders can be approved.
    await msftRow.getByRole('link', { name: 'Exclude', exact: true }).click();
    await expect(page.getByText('6 of 7 included', { exact: true })).toBeVisible();
    await expect(msftRow).not.toContainText('Fails cash availability');
    await expect(msftRow.getByRole('link', { name: 'Include', exact: true })).toBeVisible();
    await expect(cashCheck).toContainText('PASS');
    await expect(cashCheck).toContainText(/covered/i);
    await expect(page.getByText('All passed · 2 warnings', { exact: true })).toBeVisible();
    await expect(buys).toContainText('$195,455');
    await expect(blocked).toHaveCount(0);
    const approve = page.getByText('Approve and route 6 orders', { exact: true });
    await expect(approve).toBeVisible();

    // Approve: six orders routed.
    await approve.click();
    await expect(page.getByText(/^6 orders sent to routing/)).toBeVisible();

    // Include it again: approval resets and the cash failure returns.
    await msftRow.getByRole('link', { name: 'Include', exact: true }).click();
    await expect(page.getByText('7 of 7 included', { exact: true })).toBeVisible();
    await expect(page.getByText(/orders sent to routing/)).toHaveCount(0);
    await expect(msftRow).toContainText('Fails cash availability in RRSP');
    await expect(cashCheck).toContainText('FAIL');
    await expect(page.getByText('1 failed · 2 warnings', { exact: true })).toBeVisible();
    await expect(buys).toContainText('$251,555');
    await expect(blocked).toBeVisible();
  }
);

gapTest(
  'WM-GAP-081',
  {
    title: 'Drift preview request failure shows preview error, no stale preview, targets unchanged; retry restores preview',
    area: 'rebalance',
    wikiRef: `${WIKI}1.2`
  },
  async ({ page }) => {
    await openRebalance(page);
    const seedPreview = [
      { cls: 'Equity', current: 60, target: 60, drift: 0, flag: 'Within tolerance' as const },
      { cls: 'Fixed income', current: 30, target: 30, drift: 0, flag: 'Within tolerance' as const },
      { cls: 'Cash', current: 10, target: 10, drift: 0, flag: 'Within tolerance' as const }
    ];

    // A successful preview first, so a stale result could be left behind.
    await runPreview(page);
    await expectPreviewRows(page, seedPreview);

    // Fail the real preview request.
    const previewUrl = '**/api/workflows/rebalance/preview';
    await page.route(previewUrl, (route) => route.abort('failed'));
    await previewRegion(page).getByRole('button', { name: 'Preview rebalance' }).click();
    await expect(previewRegion(page).getByRole('alert')).toBeVisible();
    await expect(previewTable(page)).toHaveCount(0);
    await expect(previewRegion(page).getByText(/Preview status/)).toHaveCount(0);
    await expectSavedTargets(page, [60, 30, 10]);
    await expectCurrentWeights(page, [60, 30, 10]);

    // Service recovers: retry restores the preview and clears the error.
    await page.unroute(previewUrl);
    await runPreview(page);
    await expect(previewRegion(page).getByRole('alert')).toHaveCount(0);
    await expectPreviewRows(page, seedPreview);
    await expectSavedTargets(page, [60, 30, 10]);
  }
);

gapTest(
  'WM-GAP-082',
  {
    title: 'Target save request failure shows an error, saves nothing and audits nothing; retry after recovery persists the targets',
    area: 'rebalance',
    wikiRef: `${WIKI}1.2`
  },
  async ({ page }) => {
    await openRebalance(page);

    // Fail the real save request.
    const saveUrl = '**/api/workflows/allocations';
    await page.route(saveUrl, (route) => route.abort('failed'));
    await editAndSave(page, ['70', '20', '10']);
    await expectRejected(page);
    await expectSavedTargets(page, [60, 30, 10]);
    await expectNoTargetAudit(page);

    // Service recovers: saving again persists and audits the change.
    await page.unroute(saveUrl);
    await expect(targetInput(page, 'Equity')).toHaveValue('70');
    await saveTargets(page);
    await expect(savedNotice(page)).toBeVisible();
    await expect(allocRegion(page).getByRole('alert')).toHaveCount(0);
    await expectSavedTargets(page, [70, 20, 10]);

    await reloadAndReturn(page);
    await expectSavedTargets(page, [70, 20, 10]);
    await expect(
      auditPanel(page).getByRole('listitem').filter({ hasText: /60\s*\/\s*30\s*\/\s*10\D[\s\S]*70\s*\/\s*20\s*\/\s*10/ })
    ).toHaveCount(1);
  }
);
