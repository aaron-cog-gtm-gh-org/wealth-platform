import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, openArea } from '../tooling/fixtures';

const ACCOUNTS = {
  A1001: 'Whitfield Investment (A1001)',
  A1002: 'Whitfield Savings (A1002)',
  A1003: 'Chen USD Investment (A1003)'
} as const;
type AccountId = keyof typeof ACCOUNTS;

const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const goMoney = async (page: Page) => {
  await tab(page, 'Move money').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Move money' })).toBeVisible();
};

const fromSelect = (page: Page) => page.getByLabel('From account');
const toSelect = (page: Page) => page.getByLabel('To account');
const amountInput = (page: Page) => page.getByLabel('Amount (CAD)');
const newTransferHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'New transfer' });
const reviewHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'Review transfer' });
const reviewDetails = (page: Page) => page.locator('dl[aria-label="Transfer details"]');
const detail = (page: Page, term: string) =>
  reviewDetails(page).locator(`dt:text-is("${term}")`).locator('xpath=following-sibling::dd[1]');
const transferStatus = (page: Page) => page.getByRole('status').filter({ hasText: /^Transfer/ });
const transfersTable = (page: Page) => page.getByRole('table', { name: 'Transfers' });
const transferRows = (page: Page) => transfersTable(page).locator('tbody tr').filter({ hasNot: page.locator('td.ws-empty') });
const auditPanel = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });
const transferAuditEntries = (page: Page) =>
  auditPanel(page).getByRole('listitem').filter({ hasText: 'transfer.completed' });

const optionValues = async (select: Locator) =>
  (await select.locator('option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value))).filter(v => v !== '');

async function fillTransfer(page: Page, from: AccountId, to: AccountId, amount: string) {
  await expect(newTransferHeading(page)).toBeVisible();
  await fromSelect(page).selectOption(from);
  await toSelect(page).selectOption(to);
  await amountInput(page).fill(amount);
}

async function review(page: Page) {
  await page.getByRole('button', { name: 'Review transfer' }).click();
}

async function expectReview(page: Page, from: AccountId, to: AccountId, amount: string) {
  await expect(reviewHeading(page)).toBeVisible();
  await expect(detail(page, 'From')).toHaveText(ACCOUNTS[from]);
  await expect(detail(page, 'To')).toHaveText(ACCOUNTS[to]);
  await expect(detail(page, 'Amount')).toHaveText(amount);
  await expect(page.getByRole('button', { name: 'Confirm transfer' })).toBeVisible();
}

async function confirmAndReadReference(page: Page, amount: string) {
  await page.getByRole('button', { name: 'Confirm transfer' }).click();
  const status = transferStatus(page);
  await expect(status).toBeVisible();
  await expect(status).toContainText(`of ${amount}`);
  await expect(status).toContainText('Status: Completed.');
  await expect(status).toContainText(/Reference: \S+\./);
  const text = (await status.textContent()) ?? '';
  const reference = /Reference: (\S+)\./.exec(text)?.[1];
  expect(reference, 'transfer reference shown in the confirmation').toBeTruthy();
  return reference as string;
}

async function expectRejectedWithoutReview(page: Page, message?: RegExp) {
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  if (message) await expect(alert).toContainText(message);
  await expect(reviewHeading(page)).toHaveCount(0);
  await expect(newTransferHeading(page)).toBeVisible();
}

/** Opens Portfolio > Cash by account and checks the cash balance shown for each account. */
async function expectCashBalances(page: Page, balances: Partial<Record<AccountId, string>>) {
  await tab(page, 'Portfolio').click();
  const table = page.getByRole('table', { name: 'Cash by account' });
  await expect(table).toBeVisible();
  for (const [id, cash] of Object.entries(balances)) {
    const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: new RegExp(`\\b${id}$`) }) });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('cell').nth(2)).toHaveText(cash as string);
  }
}

async function reloadAndReturnToMoney(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  await goMoney(page);
  await expect(transfersTable(page)).toBeVisible();
}

async function expectNoTransfers(page: Page) {
  await expect(transferRows(page)).toHaveCount(0);
  await expect(transfersTable(page)).toContainText('No transfers yet. Completed transfers appear here.');
  await expect(page.getByText('0 of 0 transfers')).toBeVisible();
}

async function expectSingleCompletedTransfer(page: Page, from: AccountId, to: AccountId, amount: string, reference?: string) {
  const rows = transferRows(page);
  await expect(rows).toHaveCount(1);
  const row = rows.first();
  await expect(row.getByRole('cell').nth(0)).toHaveText(ACCOUNTS[from]);
  await expect(row.getByRole('cell').nth(1)).toHaveText(ACCOUNTS[to]);
  await expect(row.getByRole('cell').nth(2)).toHaveText(amount);
  if (reference) await expect(row.getByRole('cell').nth(3)).toHaveText(reference);
  await expect(row.getByRole('cell').nth(4)).toHaveText('Completed');
}

/** Clicks Review and, if a review screen opens, Confirm; returns once the transfer was rejected. */
async function attemptReviewAndConfirm(page: Page) {
  await review(page);
  const alert = page.getByRole('alert');
  await expect(alert.or(reviewHeading(page)).first()).toBeVisible();
  if (await reviewHeading(page).isVisible()) {
    await page.getByRole('button', { name: 'Confirm transfer' }).click();
  }
  await expect(alert).toBeVisible();
  await expect(transferStatus(page)).toHaveCount(0);
  return alert;
}

async function expectOpenBuyRy(ordersTable: Locator) {
  const rows = ordersTable.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  const cells = rows.first().getByRole('cell');
  await expect(cells.nth(0)).toHaveText(ACCOUNTS.A1001);
  await expect(cells.nth(1)).toHaveText('RY');
  await expect(cells.nth(2)).toHaveText('Buy');
  await expect(cells.nth(3)).toHaveText('100');
  await expect(cells.nth(6)).toHaveText('Open');
}

caseTest('WM-TC-031', async ({ page }) => {
  await openArea(page, 'money');
  await expect(page.getByRole('heading', { level: 1, name: 'Move money' })).toBeVisible();

  await fillTransfer(page, 'A1001', 'A1002', '1000.00');
  await review(page);
  await expectReview(page, 'A1001', 'A1002', '$1,000.00');

  await expectCashBalances(page, { A1001: '$25,000.00', A1002: '$10,000.00' });

  await reloadAndReturnToMoney(page);
  await expectNoTransfers(page);
  await expectCashBalances(page, { A1001: '$25,000.00', A1002: '$10,000.00' });

  await goMoney(page);
  await expect(auditPanel(page)).toBeVisible();
  await expect(transferAuditEntries(page)).toHaveCount(0);
  await expect(auditPanel(page)).toContainText('No changes recorded yet.');
});

caseTest('WM-TC-032', async ({ page }) => {
  await openArea(page, 'money');

  await fillTransfer(page, 'A1001', 'A1002', '1000.00');
  await review(page);
  await expectReview(page, 'A1001', 'A1002', '$1,000.00');

  const reference = await confirmAndReadReference(page, '$1,000.00');

  await expectCashBalances(page, { A1001: '$24,000.00', A1002: '$11,000.00' });

  await reloadAndReturnToMoney(page);
  await expectSingleCompletedTransfer(page, 'A1001', 'A1002', '$1,000.00', reference);
  await expectCashBalances(page, { A1001: '$24,000.00', A1002: '$11,000.00' });

  await goMoney(page);
  const entries = transferAuditEntries(page);
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('CAD 1,000.00');
  await expect(entries.first()).toContainText('A1001 → A1002');
  await expect(entries.first()).toContainText(reference);
});

caseTest('WM-TC-033', async ({ page }) => {
  await openArea(page, 'money');

  await fillTransfer(page, 'A1001', 'A1002', '1000.00');
  await review(page);
  await expectReview(page, 'A1001', 'A1002', '$1,000.00');
  await expect(detail(page, 'Available before')).toHaveText('$25,000.00');

  await page.getByRole('button', { name: 'Edit transfer' }).click();
  await expect(newTransferHeading(page)).toBeVisible();
  await expect(fromSelect(page).locator('option[value="A1001"]')).toHaveText(`${ACCOUNTS.A1001} · $25,000.00 available`);
  await expect(fromSelect(page).locator('option[value="A1002"]')).toHaveText(`${ACCOUNTS.A1002} · $10,000.00 available`);
  await expect(fromSelect(page)).toHaveValue('A1001');
  await expect(toSelect(page)).toHaveValue('A1002');
  await amountInput(page).fill('2500.50');
  await review(page);
  await expectReview(page, 'A1001', 'A1002', '$2,500.50');
  await expect(detail(page, 'Available before')).toHaveText('$25,000.00');

  await confirmAndReadReference(page, '$2,500.50');
  await expectCashBalances(page, { A1001: '$22,499.50', A1002: '$12,500.50' });

  await reloadAndReturnToMoney(page);
  await expectSingleCompletedTransfer(page, 'A1001', 'A1002', '$2,500.50');
  await expect(transfersTable(page)).not.toContainText('$1,000.00');
});

caseTest('WM-TC-034', async ({ page }) => {
  await openArea(page, 'money');

  await fillTransfer(page, 'A1001', 'A1002', '0');
  await review(page);
  await expectRejectedWithoutReview(page, /greater than 0/i);

  await amountInput(page).fill('-100');
  await review(page);
  await expectRejectedWithoutReview(page);

  await amountInput(page).fill('100.123');
  await review(page);
  await expectRejectedWithoutReview(page, /at most 2 decimal places/i);

  await amountInput(page).fill('');
  await review(page);
  await expectRejectedWithoutReview(page);

  await amountInput(page).fill('abc');
  await review(page);
  await expectRejectedWithoutReview(page);

  await amountInput(page).fill('0.01');
  await review(page);
  await expectReview(page, 'A1001', 'A1002', '$0.01');
  await confirmAndReadReference(page, '$0.01');
  await expectCashBalances(page, { A1001: '$24,999.99', A1002: '$10,000.01' });

  await reloadAndReturnToMoney(page);
  await expectSingleCompletedTransfer(page, 'A1001', 'A1002', '$0.01');
});

caseTest('WM-TC-035', async ({ page }) => {
  await openArea(page, 'money');

  await fromSelect(page).selectOption('A1001');
  await expect(toSelect(page)).toBeEnabled();
  const destinations = await optionValues(toSelect(page));
  if (destinations.includes('A1001')) {
    await toSelect(page).selectOption('A1001');
    await amountInput(page).fill('500.00');
    await review(page);
    await expectRejectedWithoutReview(page, /differ|different/i);
  } else {
    expect(destinations).not.toContain('A1001');
  }

  await reloadAndReturnToMoney(page);
  await expectNoTransfers(page);
  await expectCashBalances(page, { A1001: '$25,000.00' });
});

caseTest('WM-TC-036', async ({ page }) => {
  await openArea(page, 'money');

  await fromSelect(page).selectOption('A1001');
  const destinations = await optionValues(toSelect(page));
  if (destinations.includes('A1003')) {
    await toSelect(page).selectOption('A1003');
    await amountInput(page).fill('100.00');
    await review(page);
    await expectRejectedWithoutReview(page);
  } else {
    expect(destinations).toEqual(['A1002']);
  }

  const sources = await optionValues(fromSelect(page));
  if (sources.includes('A1003')) {
    await fromSelect(page).selectOption('A1003');
    const a1003Destinations = await optionValues(toSelect(page));
    for (const target of ['A1001', 'A1002'] as const) {
      if (!a1003Destinations.includes(target)) continue;
      await toSelect(page).selectOption(target);
      await amountInput(page).fill('100.00');
      await review(page);
      await expectRejectedWithoutReview(page);
    }
  }

  await expectCashBalances(page, { A1001: '$25,000.00', A1002: '$10,000.00', A1003: 'US$15,000.00' });

  await reloadAndReturnToMoney(page);
  await expectNoTransfers(page);
});

caseTest('WM-TC-037', async ({ page }) => {
  await openArea(page, 'money');

  await tab(page, 'Orders').click();
  await page.getByLabel('Account', { exact: true }).selectOption('A1001');
  await page.getByLabel('Instrument', { exact: true }).selectOption('RY');
  await page.getByRole('radio', { name: 'Buy' }).check();
  await page.getByLabel('Quantity', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status').filter({ hasText: /order/i })).toContainText('Status: Open.');
  const ordersTable = page.getByRole('table', { name: 'Orders' });
  await expectOpenBuyRy(ordersTable);

  await goMoney(page);
  await fillTransfer(page, 'A1001', 'A1002', '11000.01');
  const rejection = await attemptReviewAndConfirm(page);
  await expect(rejection).toContainText(/insufficient available cash/i);
  await expect(page.locator('#ws-panel-main').getByText(/\$11,000\.00/).first()).toBeVisible();
  await expectCashBalances(page, { A1001: '$25,000.00', A1002: '$10,000.00' });

  await goMoney(page);
  await fillTransfer(page, 'A1001', 'A1002', '11000.00');
  await review(page);
  await expectReview(page, 'A1001', 'A1002', '$11,000.00');
  await confirmAndReadReference(page, '$11,000.00');
  await expectCashBalances(page, { A1001: '$14,000.00', A1002: '$21,000.00' });

  await page.reload();
  await page.waitForLoadState('load');
  await tab(page, 'Orders').click();
  await expectOpenBuyRy(page.getByRole('table', { name: 'Orders' }));
  await goMoney(page);
  await expectSingleCompletedTransfer(page, 'A1001', 'A1002', '$11,000.00');
});

caseTest('WM-TC-038', async ({ page }) => {
  await openArea(page, 'money');

  await fillTransfer(page, 'A1002', 'A1001', '10000.00');
  await review(page);
  await expectReview(page, 'A1002', 'A1001', '$10,000.00');
  await confirmAndReadReference(page, '$10,000.00');
  await expectCashBalances(page, { A1002: '$0.00', A1001: '$35,000.00' });

  await goMoney(page);
  await fillTransfer(page, 'A1002', 'A1001', '0.01');
  const rejection = await attemptReviewAndConfirm(page);
  await expect(rejection).toContainText(/insufficient available cash/i);
  await expectCashBalances(page, { A1002: '$0.00', A1001: '$35,000.00' });

  await reloadAndReturnToMoney(page);
  await expectSingleCompletedTransfer(page, 'A1002', 'A1001', '$10,000.00');
  await expectCashBalances(page, { A1002: '$0.00', A1001: '$35,000.00' });
});
