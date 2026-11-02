import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, journeyStep, openArea } from '../tooling/fixtures';

const tab = (page: Page, name: RegExp) => page.getByRole('tab', { name });
const TABS = {
  clients: /^Clients(\s|$)/,
  portfolio: /^Portfolio(\s|$)/,
  orders: /^Orders(\s|$)/,
  money: /^Move money(\s|$)/,
};

const fromSelect = (page: Page) => page.getByLabel('From account', { exact: true });
const toSelect = (page: Page) => page.getByLabel('To account', { exact: true });
const amountInput = (page: Page) => page.getByLabel('Amount (CAD)', { exact: true });
const referenceInput = (page: Page) => page.getByLabel('Reference (optional)', { exact: true });
const reviewHeading = (page: Page) => page.getByRole('heading', { name: 'Review transfer', exact: true });
const newTransferHeading = (page: Page) => page.getByRole('heading', { name: 'New transfer', exact: true });
const transferDetails = (page: Page) => page.locator('dl[aria-label="Transfer details"]');
const detail = (page: Page, term: string) =>
  transferDetails(page).locator('dt', { hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
const transfersTable = (page: Page) => page.getByRole('table', { name: 'Transfers', exact: true });
const transferRows = (page: Page) => transfersTable(page).locator('tbody tr').filter({ has: page.getByRole('rowheader') });
const transferCount = (page: Page) => page.locator('.ws-count', { hasText: /transfers$/ });
const fieldAlert = (page: Page) => page.getByRole('tabpanel').getByRole('alert');
const successNotice = (page: Page) => page.getByRole('tabpanel').getByRole('status').filter({ hasText: /^Transfer / });

async function choose(select: Locator, value: string) {
  await select.click();
  await select.selectOption(value);
}

async function fillField(input: Locator, value: string) {
  await input.click();
  await input.fill(value);
}

async function draftTransfer(page: Page, from: string, to: string, amount: string) {
  await choose(fromSelect(page), from);
  await choose(toSelect(page), to);
  await fillField(amountInput(page), amount);
}

async function clickReview(page: Page) {
  await page.getByRole('button', { name: 'Review transfer', exact: true }).click();
}

async function confirmTransfer(page: Page) {
  await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  const notice = successNotice(page);
  await expect(notice).toContainText('Status: Completed.');
  const text = (await notice.textContent()) ?? '';
  const reference = /Reference: ([^.]+)\./.exec(text)?.[1];
  expect(reference, 'transfer reference in confirmation').toBeTruthy();
  return reference!;
}

async function expectNotInReview(page: Page) {
  await expect(reviewHeading(page)).toHaveCount(0);
  await expect(newTransferHeading(page)).toBeVisible();
}

async function expectRejected(page: Page, message: string | RegExp) {
  await expect(fieldAlert(page)).toContainText(message);
  await expectNotInReview(page);
}

const cashRow = (page: Page, accountId: string) =>
  page.getByRole('table', { name: 'Cash by account', exact: true }).getByRole('row').filter({ hasText: accountId });

async function expectCashBalances(page: Page, balances: Record<string, string>) {
  await tab(page, TABS.portfolio).click();
  for (const [accountId, cash] of Object.entries(balances)) {
    await expect(cashRow(page, accountId).getByRole('cell').nth(2)).toHaveText(cash);
  }
}

async function returnToMoney(page: Page) {
  await tab(page, TABS.money).click();
  await expect(tab(page, TABS.money)).toHaveAttribute('aria-selected', 'true');
  await expect(newTransferHeading(page)).toBeVisible();
}

async function reloadMoney(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  await expect(tab(page, TABS.money)).toHaveAttribute('aria-selected', 'true');
  await expect(newTransferHeading(page)).toBeVisible();
}

const auditEntries = (page: Page) =>
  page.getByRole('complementary', { name: 'Audit trail' }).getByRole('listitem').filter({ hasText: 'transfer.completed' });

async function openAudit(page: Page) {
  const audit = page.getByRole('complementary', { name: 'Audit trail' });
  await audit.scrollIntoViewIfNeeded();
  await audit.getByRole('heading', { name: 'Audit trail' }).hover();
  return audit;
}

caseTest('WM-TC-031', async ({ page }) => {
  await openArea(page, 'money');

  await draftTransfer(page, 'A1001', 'A1002', '1000.00');
  await clickReview(page);
  await expect(reviewHeading(page)).toBeVisible();
  await expect(detail(page, 'From')).toHaveText('Whitfield Investment (A1001)');
  await expect(detail(page, 'To')).toHaveText('Whitfield Savings (A1002)');
  await expect(detail(page, 'Amount')).toHaveText('$1,000.00');
  await expect(page.getByRole('button', { name: 'Confirm transfer', exact: true })).toBeVisible();

  await expectCashBalances(page, { A1001: '$25,000.00', A1002: '$10,000.00' });
  await returnToMoney(page);

  await reloadMoney(page);
  await expect(transferRows(page)).toHaveCount(0);
  await expect(transfersTable(page)).toContainText('No transfers yet');
  await expectCashBalances(page, { A1001: '$25,000.00', A1002: '$10,000.00' });
  await returnToMoney(page);

  const audit = await openAudit(page);
  await expect(auditEntries(page)).toHaveCount(0);
  await expect(audit).toContainText('No changes recorded yet');
});

caseTest('WM-TC-032', async ({ page }) => {
  await openArea(page, 'money');

  await draftTransfer(page, 'A1001', 'A1002', '1000.00');
  await clickReview(page);
  await expect(detail(page, 'Amount')).toHaveText('$1,000.00');
  await expect(detail(page, 'From')).toHaveText('Whitfield Investment (A1001)');
  await expect(detail(page, 'To')).toHaveText('Whitfield Savings (A1002)');

  const reference = await confirmTransfer(page);
  const row = transferRows(page).filter({ hasText: reference });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Completed');

  await expectCashBalances(page, { A1001: '$24,000.00', A1002: '$11,000.00' });
  await returnToMoney(page);

  await reloadMoney(page);
  await expect(transferRows(page)).toHaveCount(1);
  const persisted = transferRows(page).filter({ hasText: reference });
  await expect(persisted).toContainText('$1,000.00');
  await expect(persisted).toContainText('Completed');
  await expectCashBalances(page, { A1001: '$24,000.00', A1002: '$11,000.00' });
  await returnToMoney(page);

  await openAudit(page);
  await expect(auditEntries(page)).toHaveCount(1);
  await expect(auditEntries(page)).toContainText('1,000.00');
  await expect(auditEntries(page)).toContainText('A1001 → A1002');
  await expect(auditEntries(page)).toContainText(reference);
});

caseTest('WM-TC-033', async ({ page }) => {
  await openArea(page, 'money');

  await draftTransfer(page, 'A1001', 'A1002', '1000.00');
  await clickReview(page);
  await expect(detail(page, 'Amount')).toHaveText('$1,000.00');
  await expect(detail(page, 'Available before')).toHaveText('$25,000.00');
  await expect(transferCount(page)).toHaveText('0 of 0 transfers');

  await page.getByRole('button', { name: 'Edit transfer', exact: true }).click();
  await fillField(amountInput(page), '2500.50');
  await clickReview(page);
  await expect(detail(page, 'Amount')).toHaveText('$2,500.50');
  await expect(detail(page, 'Available before')).toHaveText('$25,000.00');
  await expect(transferCount(page)).toHaveText('0 of 0 transfers');

  const reference = await confirmTransfer(page);
  await expect(transferRows(page).filter({ hasText: reference })).toContainText('Completed');
  await expectCashBalances(page, { A1001: '$22,499.50', A1002: '$12,500.50' });
  await returnToMoney(page);

  await reloadMoney(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$2,500.50');
  await expect(transferRows(page).first()).toContainText('Completed');
  await expect(transferRows(page).filter({ hasText: '$1,000.00' })).toHaveCount(0);
});

caseTest('WM-TC-034', async ({ page }) => {
  await openArea(page, 'money');

  await draftTransfer(page, 'A1001', 'A1002', '0');
  await clickReview(page);
  await expectRejected(page, 'greater than 0');

  await fillField(amountInput(page), '-100');
  await clickReview(page);
  await expectRejected(page, /greater than 0/);

  await fillField(amountInput(page), '100.123');
  await clickReview(page);
  await expectRejected(page, /at most 2 decimal places/);

  await fillField(amountInput(page), '');
  await clickReview(page);
  await expectRejected(page, /Enter an amount/);

  await fillField(amountInput(page), 'abc');
  await clickReview(page);
  await expectRejected(page, /must be a number/);
  await expect(transferCount(page)).toHaveText('0 of 0 transfers');

  await fillField(amountInput(page), '0.01');
  await clickReview(page);
  await expect(detail(page, 'Amount')).toHaveText('$0.01');
  const reference = await confirmTransfer(page);
  await expect(transferRows(page).filter({ hasText: reference })).toContainText('$0.01');
  await expectCashBalances(page, { A1001: '$24,999.99', A1002: '$10,000.01' });
  await returnToMoney(page);

  await reloadMoney(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$0.01');
  await expect(transferRows(page).first()).toContainText('Completed');
});

caseTest('WM-TC-035', async ({ page }) => {
  await openArea(page, 'money');

  await choose(fromSelect(page), 'A1001');
  await toSelect(page).click();
  await expect(toSelect(page).locator('option[value="A1001"]')).toHaveCount(0);
  await expect(toSelect(page).locator('option[value="A1002"]')).toHaveCount(1);

  await fillField(amountInput(page), '500.00');
  await clickReview(page);
  await expectRejected(page, /Choose the account to move money to/);
  await expect(transferCount(page)).toHaveText('0 of 0 transfers');

  await reloadMoney(page);
  await expect(transferRows(page)).toHaveCount(0);
  await expectCashBalances(page, { A1001: '$25,000.00' });
});

caseTest('WM-TC-036', async ({ page }) => {
  await openArea(page, 'money');

  await choose(fromSelect(page), 'A1001');
  await toSelect(page).click();
  const destinations = toSelect(page).locator('option:not([value=""])');
  await expect(destinations).toHaveText(['Whitfield Savings (A1002)']);
  await expect(toSelect(page).locator('option[value="A1003"]')).toHaveCount(0);

  await fillField(amountInput(page), '100.00');
  await clickReview(page);
  await expectRejected(page, /Choose the account to move money to/);

  await fromSelect(page).click();
  await expect(fromSelect(page).locator('option[value="A1003"]')).toHaveCount(0);
  await expect(transferCount(page)).toHaveText('0 of 0 transfers');

  await expectCashBalances(page, { A1001: '$25,000.00', A1002: '$10,000.00', A1003: 'US$15,000.00' });
  await returnToMoney(page);

  await reloadMoney(page);
  await expect(transferRows(page)).toHaveCount(0);
  await expect(transfersTable(page)).toContainText('No transfers yet');
});

caseTest('WM-TC-037', async ({ page }) => {
  await openArea(page, 'money');

  await tab(page, TABS.orders).click();
  await choose(page.getByLabel('Account', { exact: true }), 'A1001');
  await page.getByRole('radio', { name: 'Buy' }).click();
  await choose(page.getByLabel('Instrument', { exact: true }), 'RY');
  await fillField(page.getByLabel('Quantity', { exact: true }), '100');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  const orderRow = page.getByRole('table', { name: 'Orders', exact: true }).getByRole('row')
    .filter({ hasText: 'RY' }).filter({ hasText: 'Buy' }).filter({ hasText: 'Open' });
  await expect(orderRow).toHaveCount(1);
  await expect(orderRow).toContainText('Whitfield Investment (A1001)');

  await returnToMoney(page);
  await draftTransfer(page, 'A1001', 'A1002', '11000.01');
  await clickReview(page);
  if (await reviewHeading(page).isVisible()) {
    await expect(detail(page, 'Available before')).toHaveText('$11,000.00');
    await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  }
  await expect(fieldAlert(page)).toContainText(/insufficient available cash/i);
  await expect(successNotice(page)).toHaveCount(0);
  await expect(transferCount(page)).toHaveText('0 of 0 transfers');

  if (await reviewHeading(page).isVisible()) {
    await page.getByRole('button', { name: 'Edit transfer', exact: true }).click();
  }
  await fillField(amountInput(page), '11000.00');
  await clickReview(page);
  await expect(detail(page, 'Amount')).toHaveText('$11,000.00');
  const reference = await confirmTransfer(page);
  await expect(transferRows(page).filter({ hasText: reference })).toContainText('Completed');
  await expectCashBalances(page, { A1001: '$14,000.00', A1002: '$21,000.00' });

  await page.reload();
  await page.waitForLoadState('load');
  await tab(page, TABS.orders).click();
  await expect(orderRow).toHaveCount(1);
  await returnToMoney(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$11,000.00');
  await expect(transferRows(page).first()).toContainText('Completed');
});

caseTest('WM-TC-038', async ({ page }) => {
  await openArea(page, 'money');

  await draftTransfer(page, 'A1002', 'A1001', '10000.00');
  await clickReview(page);
  await expect(detail(page, 'Amount')).toHaveText('$10,000.00');
  const reference = await confirmTransfer(page);
  await expect(transferRows(page).filter({ hasText: reference })).toContainText('Completed');
  await expectCashBalances(page, { A1002: '$0.00', A1001: '$35,000.00' });
  await returnToMoney(page);

  await draftTransfer(page, 'A1002', 'A1001', '0.01');
  await clickReview(page);
  if (await reviewHeading(page).isVisible()) {
    await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  }
  await expect(fieldAlert(page)).toContainText(/insufficient available cash/i);
  await expect(successNotice(page)).toHaveCount(0);
  await expect(transferRows(page)).toHaveCount(1);
  await expectCashBalances(page, { A1002: '$0.00', A1001: '$35,000.00' });
  await returnToMoney(page);

  await reloadMoney(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$10,000.00');
  await expectCashBalances(page, { A1002: '$0.00', A1001: '$35,000.00' });
});

const parseCad = (text: string | null) => Number((text ?? '').replace(/[^0-9.]/g, ''));

caseTest('WM-TC-053', async ({ page }) => {
  await openArea(page, 'clients');
  const detailPanel = page.getByRole('region', { name: 'Eleanor Whitfield' });
  const accountCash = (id: string) => detailPanel.getByRole('row').filter({ hasText: id }).getByRole('cell').nth(1);

  await journeyStep(page, 'Search the client book for C1001 and open Eleanor Whitfield', async () => {
    await fillField(page.getByLabel('Search clients', { exact: true }), 'C1001');
    await page.getByRole('button', { name: 'Eleanor Whitfield', exact: true }).click();
    await expect(accountCash('A1001')).toHaveText('$25,000.00');
    await expect(accountCash('A1002')).toHaveText('$10,000.00');
  });

  await journeyStep(page, 'Open the client portfolio', async () => {
    await detailPanel.getByRole('button', { name: 'View portfolio', exact: true }).click();
    await expect(tab(page, TABS.portfolio)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Client', { exact: true })).toHaveValue('C1001');
  });

  await journeyStep(page, 'Scope the portfolio to investment account A1001', async () => {
    await choose(page.getByLabel('Account', { exact: true }), 'A1001');
    await expect(cashRow(page, 'A1001').getByRole('cell').nth(2)).toHaveText('$25,000.00');
    const ry = page.getByRole('table', { name: 'Holdings', exact: true }).getByRole('row').filter({ hasText: 'RY' });
    await expect(ry).toHaveCount(1);
    await expect(ry.getByRole('cell').nth(3)).toHaveText('100');
  });

  await journeyStep(page, 'Open the Move money workspace', async () => {
    await tab(page, TABS.money).click();
    await expect(newTransferHeading(page)).toBeVisible();
    await expect(fromSelect(page)).toHaveValue('');
    await expect(amountInput(page)).toHaveValue('');
    await expect(referenceInput(page)).toHaveValue('');
    await expect(transferRows(page)).toHaveCount(0);
    await expect(transfersTable(page)).toContainText('No transfers yet');
  });

  await journeyStep(page, 'Choose A1001 as the source account', async () => {
    await choose(fromSelect(page), 'A1001');
    await expect(toSelect(page).locator('option:not([value=""])')).toHaveText(['Whitfield Savings (A1002)']);
  });

  await journeyStep(page, 'Choose A1002 as the destination account', async () => {
    await choose(toSelect(page), 'A1002');
    await expect(toSelect(page)).toHaveValue('A1002');
    await expect(toSelect(page).locator('option:checked')).toHaveText('Whitfield Savings (A1002)');
    await expect(toSelect(page).locator('option[value="A1001"]')).toHaveCount(0);
    await expect(toSelect(page).locator('option[value="A1003"]')).toHaveCount(0);
  });

  await journeyStep(page, 'Enter the initial amount of 1000.00', async () => {
    await fillField(amountInput(page), '1000.00');
    await expect(amountInput(page)).toHaveValue('1000.00');
    await expect(transferCount(page)).toHaveText('0 of 0 transfers');
    await expect(page.getByText('Available $25,000.00 after open buy orders.')).toBeVisible();
  });

  await journeyStep(page, 'Enter the reference Quarterly cash allocation', async () => {
    await fillField(referenceInput(page), 'Quarterly cash allocation');
    await expect(referenceInput(page)).toHaveValue('Quarterly cash allocation');
  });

  await journeyStep(page, 'Review the CAD 1,000.00 draft', async () => {
    await clickReview(page);
    await expect(detail(page, 'Client')).toHaveText('Eleanor Whitfield');
    await expect(detail(page, 'From')).toHaveText('Whitfield Investment (A1001)');
    await expect(detail(page, 'To')).toHaveText('Whitfield Savings (A1002)');
    await expect(detail(page, 'Amount')).toHaveText('$1,000.00');
    await expect(detail(page, 'Reference')).toHaveText('Quarterly cash allocation');
    await expect(transferCount(page)).toHaveText('0 of 0 transfers');
  });

  await journeyStep(page, 'Return to edit the transfer', async () => {
    await page.getByRole('button', { name: 'Edit transfer', exact: true }).click();
    await expect(fromSelect(page)).toHaveValue('A1001');
    await expect(toSelect(page)).toHaveValue('A1002');
    await expect(amountInput(page)).toHaveValue('1000.00');
    await expect(referenceInput(page)).toHaveValue('Quarterly cash allocation');
  });

  await journeyStep(page, 'Amend the amount to 1250.00', async () => {
    await fillField(amountInput(page), '1250.00');
    await expect(amountInput(page)).toHaveValue('1250.00');
    await expect(transferCount(page)).toHaveText('0 of 0 transfers');
  });

  await journeyStep(page, 'Review the amended CAD 1,250.00 transfer', async () => {
    await clickReview(page);
    await expect(detail(page, 'Amount')).toHaveText('$1,250.00');
    await expect(detail(page, 'From')).toHaveText('Whitfield Investment (A1001)');
    await expect(detail(page, 'To')).toHaveText('Whitfield Savings (A1002)');
    await expect(detail(page, 'Reference')).toHaveText('Quarterly cash allocation');
  });

  await journeyStep(page, 'Confirm the transfer', async () => {
    await confirmTransfer(page);
    await expect(transferRows(page)).toHaveCount(1);
    await expect(transferRows(page).first()).toContainText('$1,250.00');
    await expect(transferRows(page).first()).toContainText('Completed');
    await expect(transferRows(page).filter({ hasText: '$1,000.00' })).toHaveCount(0);
  });

  await journeyStep(page, 'Search transfers for the reference', async () => {
    await fillField(page.getByLabel('Search transfers', { exact: true }), 'Quarterly cash allocation');
    await expect(transferCount(page)).toHaveText('1 of 1 transfers');
    const cells = transferRows(page).first().getByRole('cell');
    await expect(cells.nth(0)).toHaveText('Whitfield Investment (A1001)');
    await expect(cells.nth(1)).toHaveText('Whitfield Savings (A1002)');
    await expect(cells.nth(2)).toHaveText('$1,250.00');
    await expect(cells.nth(3)).toHaveText('Quarterly cash allocation');
    await expect(cells.nth(4)).toHaveText('Completed');
  });

  await journeyStep(page, 'Reconcile balances on the client record', async () => {
    await tab(page, TABS.clients).click();
    await page.getByRole('button', { name: 'Eleanor Whitfield', exact: true }).click();
    await expect(accountCash('A1001')).toHaveText('$23,750.00');
    await expect(accountCash('A1002')).toHaveText('$11,250.00');
    const total = parseCad(await accountCash('A1001').textContent()) + parseCad(await accountCash('A1002').textContent());
    expect(total).toBe(35000);
  });

  await journeyStep(page, 'Refresh data and confirm the balances persist without a duplicate transfer', async () => {
    await page.getByRole('button', { name: 'Refresh data', exact: true }).click();
    await expect(page.getByText(/^Data loaded /)).toBeVisible();
    await expect(accountCash('A1001')).toHaveText('$23,750.00');
    await expect(accountCash('A1002')).toHaveText('$11,250.00');
    const total = parseCad(await accountCash('A1001').textContent()) + parseCad(await accountCash('A1002').textContent());
    expect(total).toBe(35000);
    const audit = await openAudit(page);
    await audit.getByLabel('Show all areas').click();
    await expect(auditEntries(page)).toHaveCount(1);
    await expect(auditEntries(page)).toContainText('1,250.00');
  });
});

gapTest('WM-GAP-060', {
  title: 'Legacy Move Money wizard (/?screen=money) blocks progression to review with an inline error for an invalid amount',
  area: 'money',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.2.2'
}, async ({ page }) => {
  await page.goto('/?screen=money');
  await page.waitForLoadState('load');
  const amount = page.getByLabel('Amount (CAD)');
  const reviewPayment = page.getByText('Review payment', { exact: true });
  const confirmAndSend = page.getByText('Confirm and send', { exact: true });

  await fillField(amount, '0');
  await reviewPayment.click();
  await expect(page.getByText('Enter an amount greater than $0.', { exact: true })).toBeVisible();
  await expect(confirmAndSend).toHaveCount(0);
  await expect(amount).toBeVisible();

  await fillField(amount, '99999999');
  await reviewPayment.click();
  await expect(page.getByText(/^That’s more than the available cash of /)).toBeVisible();
  await expect(confirmAndSend).toHaveCount(0);
  await expect(amount).toHaveValue('99999999');
});

gapTest('WM-GAP-061', {
  title: 'Move Money workspace shows a clear error state on a real request failure, and Retry after recovery restores real balances and usable transfer controls',
  area: 'money',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2'
}, async ({ page }) => {
  const bootstrap = '**/api/workflows/bootstrap';
  await page.route(bootstrap, route => route.abort('connectionrefused'));
  await openArea(page, 'money');

  const main = page.getByRole('tabpanel');
  await expect(main.getByRole('alert')).toContainText('Workspace data couldn’t be loaded');
  await expect(newTransferHeading(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh data', exact: true })).toBeDisabled();
  await expect(page.getByText(/^Data loaded /)).toHaveCount(0);

  await page.unroute(bootstrap);
  await main.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(newTransferHeading(page)).toBeVisible();
  await expect(main.getByRole('alert')).toHaveCount(0);
  await expect(fromSelect(page).locator('option[value="A1001"]')).toHaveText('Whitfield Investment (A1001) · $25,000.00 available');
  await expect(fromSelect(page).locator('option[value="A1002"]')).toHaveText('Whitfield Savings (A1002) · $10,000.00 available');

  await draftTransfer(page, 'A1001', 'A1002', '10.00');
  await clickReview(page);
  await expect(detail(page, 'Amount')).toHaveText('$10.00');
  await expect(detail(page, 'Available before')).toHaveText('$25,000.00');
  await expect(page.getByRole('button', { name: 'Confirm transfer', exact: true })).toBeEnabled();
});
