import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, journeyStep, openArea } from '../tooling/fixtures';

const panel = (page: Page) => page.getByRole('tabpanel');
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}(\\s|$)`) });
const transferForm = (page: Page) => page.getByRole('region', { name: 'New transfer' });
const reviewPanel = (page: Page) => page.getByRole('region', { name: 'Review transfer' });
const transfersPanel = (page: Page) => page.getByRole('region', { name: 'Transfers' });
const transferRows = (page: Page) => transfersPanel(page).getByRole('row').filter({ hasText: /T\d{4}/ });
const fromSelect = (page: Page) => page.getByLabel('From account');
const toSelect = (page: Page) => page.getByLabel('To account');
const amountInput = (page: Page) => page.getByLabel('Amount (CAD)');
const referenceInput = (page: Page) => page.getByLabel('Reference (optional)');
const detail = (scope: Locator, term: string) =>
  scope.locator('dt').filter({ hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
const fromOption = (page: Page, accountId: string) => fromSelect(page).locator(`option[value="${accountId}"]`);

async function gotoMoneyTab(page: Page) {
  await tab(page, 'Move money').click();
  await expect(tab(page, 'Move money')).toHaveAttribute('aria-selected', 'true');
  await expect(transferForm(page)).toBeVisible();
}

async function chooseFrom(page: Page, accountId: string) {
  await fromSelect(page).click();
  await fromSelect(page).selectOption(accountId);
  await expect(fromSelect(page)).toHaveValue(accountId);
}

async function chooseTo(page: Page, accountId: string) {
  await toSelect(page).click();
  await toSelect(page).selectOption(accountId);
  await expect(toSelect(page)).toHaveValue(accountId);
}

async function enterAmount(page: Page, amount: string) {
  await amountInput(page).click();
  await amountInput(page).fill(amount);
  await expect(amountInput(page)).toHaveValue(amount);
}

async function reviewTransfer(page: Page) {
  await page.getByRole('button', { name: 'Review transfer' }).click();
}

async function confirmTransfer(page: Page) {
  await reviewPanel(page).getByRole('button', { name: 'Confirm transfer' }).click();
}

async function expectAvailableOptions(page: Page, balances: Record<string, string>) {
  for (const [id, value] of Object.entries(balances)) {
    await expect(fromOption(page, id)).toHaveText(new RegExp(`\\(${id}\\) · ${value.replace(/[$.]/g, '\\$&')} available$`));
  }
}

/** Opens the client's details in Clients and asserts cash balances per account. */
async function expectClientCash(page: Page, clientName: string, balances: Record<string, string>) {
  await tab(page, 'Clients').click();
  await expect(tab(page, 'Clients')).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('region', { name: 'Client book' }).getByRole('button', { name: clientName }).click();
  const details = page.getByRole('region', { name: clientName });
  await expect(details).toBeVisible();
  for (const [id, cash] of Object.entries(balances)) {
    await expect(details.getByRole('row').filter({ hasText: id }).getByRole('cell').nth(1)).toHaveText(cash);
  }
}

async function expectNoTransferAudit(page: Page) {
  const audit = page.getByRole('complementary', { name: 'Audit trail' });
  await audit.getByLabel('Show all areas').click();
  await expect(audit.getByLabel('Show all areas')).toBeChecked();
  await expect(audit.getByText(/transfer\.completed/)).toHaveCount(0);
}

async function completedReference(page: Page): Promise<string> {
  const status = panel(page).getByRole('status').filter({ hasText: /^Transfer T\d{4}/ });
  await expect(status).toContainText('Status: Completed.');
  const text = (await status.textContent()) ?? '';
  const ref = /Reference: ([^.\s]+)\./.exec(text)?.[1];
  expect(ref, 'confirmation shows a transfer reference').toBeTruthy();
  return ref!;
}

caseTest('WM-TC-031', async ({ page }) => {
  await openArea(page, 'money');
  await expect(transferForm(page)).toBeVisible();

  await chooseFrom(page, 'A1001');
  await chooseTo(page, 'A1002');
  await enterAmount(page, '1000.00');
  await reviewTransfer(page);
  const review = reviewPanel(page);
  await expect(review).toBeVisible();
  await expect(detail(review, 'From')).toHaveText('Whitfield Investment (A1001)');
  await expect(detail(review, 'To')).toHaveText('Whitfield Savings (A1002)');
  await expect(detail(review, 'Amount')).toHaveText('$1,000.00');
  await expect(review.getByRole('button', { name: 'Confirm transfer' })).toBeVisible();

  await expect(detail(review, 'Available before')).toHaveText('$25,000.00');
  await expect(transfersPanel(page)).toContainText('0 of 0 transfers');
  await review.getByRole('button', { name: 'Edit transfer' }).click();
  await expectAvailableOptions(page, { A1001: '$25,000.00', A1002: '$10,000.00' });
  await expectNoTransferAudit(page);

  await page.reload();
  await expect(tab(page, 'Move money')).toHaveAttribute('aria-selected', 'true');
  await expectAvailableOptions(page, { A1001: '$25,000.00', A1002: '$10,000.00' });
  await expect(transferRows(page)).toHaveCount(0);
  await expect(transfersPanel(page)).toContainText('No transfers yet.');
  await expectClientCash(page, 'Eleanor Whitfield', { A1001: '$25,000.00', A1002: '$10,000.00' });
});

caseTest('WM-TC-032', async ({ page }) => {
  await openArea(page, 'money');
  await chooseFrom(page, 'A1001');
  await chooseTo(page, 'A1002');
  await enterAmount(page, '1000.00');
  await reviewTransfer(page);
  await expect(detail(reviewPanel(page), 'Amount')).toHaveText('$1,000.00');
  await confirmTransfer(page);
  const ref = await completedReference(page);

  await expectClientCash(page, 'Eleanor Whitfield', { A1001: '$24,000.00', A1002: '$11,000.00' });

  await page.reload();
  await gotoMoneyTab(page);
  await expect(transferRows(page)).toHaveCount(1);
  const row = transferRows(page).first();
  await expect(row).toContainText(ref);
  await expect(row).toContainText('$1,000.00');
  await expect(row).toContainText('Completed');
  const audit = page.getByRole('complementary', { name: 'Audit trail' });
  await audit.getByLabel('Show all areas').click();
  const entries = audit.getByRole('listitem').filter({ hasText: 'transfer.completed' });
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('CAD 1,000.00 A1001 → A1002');
  await expect(entries.first()).toContainText(ref);
  await expectClientCash(page, 'Eleanor Whitfield', { A1001: '$24,000.00', A1002: '$11,000.00' });
});

caseTest('WM-TC-033', async ({ page }) => {
  await openArea(page, 'money');
  await chooseFrom(page, 'A1001');
  await chooseTo(page, 'A1002');
  await enterAmount(page, '1000.00');
  await reviewTransfer(page);
  await expect(detail(reviewPanel(page), 'Amount')).toHaveText('$1,000.00');
  await expect(detail(reviewPanel(page), 'Available before')).toHaveText('$25,000.00');
  await expect(transfersPanel(page)).toContainText('0 of 0 transfers');

  await reviewPanel(page).getByRole('button', { name: 'Edit transfer' }).click();
  await expect(transferForm(page)).toBeVisible();
  await expect(amountInput(page)).toHaveValue('1000.00');
  await expectAvailableOptions(page, { A1001: '$25,000.00', A1002: '$10,000.00' });
  await enterAmount(page, '2500.50');
  await reviewTransfer(page);
  await expect(detail(reviewPanel(page), 'Amount')).toHaveText('$2,500.50');
  await expect(detail(reviewPanel(page), 'From')).toHaveText('Whitfield Investment (A1001)');
  await expect(detail(reviewPanel(page), 'To')).toHaveText('Whitfield Savings (A1002)');
  await expect(detail(reviewPanel(page), 'Available before')).toHaveText('$25,000.00');
  await expect(transfersPanel(page)).toContainText('0 of 0 transfers');

  await confirmTransfer(page);
  await completedReference(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$2,500.50');
  await expectClientCash(page, 'Eleanor Whitfield', { A1001: '$22,499.50', A1002: '$12,500.50' });

  await page.reload();
  await gotoMoneyTab(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$2,500.50');
  await expect(transferRows(page).filter({ hasText: '$1,000.00' })).toHaveCount(0);
});

caseTest('WM-TC-034', async ({ page }) => {
  await openArea(page, 'money');
  await chooseFrom(page, 'A1001');
  await chooseTo(page, 'A1002');
  const invalid: Array<[string, string]> = [
    ['0', 'Amount must be greater than 0.'],
    ['-100', 'Amount must be greater than 0.'],
    ['100.123', 'Amount can have at most 2 decimal places.'],
    ['', 'Enter an amount. The amount must be greater than 0.'],
    ['abc', 'Amount must be a number greater than 0, for example 1000.00.'],
  ];
  for (const [value, message] of invalid) {
    await enterAmount(page, value);
    await reviewTransfer(page);
    await expect(transferForm(page).getByRole('alert')).toHaveText(message);
    await expect(reviewPanel(page)).toHaveCount(0);
  }
  await expect(transfersPanel(page)).toContainText('0 of 0 transfers');

  await enterAmount(page, '0.01');
  await reviewTransfer(page);
  await expect(detail(reviewPanel(page), 'Amount')).toHaveText('$0.01');
  await confirmTransfer(page);
  await completedReference(page);
  await expectClientCash(page, 'Eleanor Whitfield', { A1001: '$24,999.99', A1002: '$10,000.01' });

  await page.reload();
  await gotoMoneyTab(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$0.01');
});

caseTest('WM-TC-035', async ({ page }) => {
  await openArea(page, 'money');
  await chooseFrom(page, 'A1001');
  await toSelect(page).click();
  await expect(toSelect(page).locator('option[value="A1001"]')).toHaveCount(0);
  await expect(toSelect(page).locator('option:not([value=""])')).toHaveText(['Whitfield Savings (A1002)']);
  await toSelect(page).press('Escape');
  await reviewTransfer(page);
  await expect(transferForm(page).getByRole('alert')).toHaveText('Choose the account to move money to.');
  await expect(reviewPanel(page)).toHaveCount(0);

  await page.reload();
  await expect(tab(page, 'Move money')).toHaveAttribute('aria-selected', 'true');
  await expect(transferRows(page)).toHaveCount(0);
  await expect(transfersPanel(page)).toContainText('No transfers yet.');
  await expectClientCash(page, 'Eleanor Whitfield', { A1001: '$25,000.00' });
});

caseTest('WM-TC-036', async ({ page }) => {
  await openArea(page, 'money');
  await chooseFrom(page, 'A1001');
  await toSelect(page).click();
  await expect(toSelect(page).locator('option[value="A1003"]')).toHaveCount(0);
  await expect(toSelect(page).locator('option:not([value=""])')).toHaveText(['Whitfield Savings (A1002)']);
  await toSelect(page).press('Escape');

  await fromSelect(page).click();
  await expect(fromOption(page, 'A1003')).toHaveCount(0);
  await expect(fromSelect(page).locator('option:not([value=""])')).toHaveCount(2);
  await fromSelect(page).press('Escape');
  await expect(transferForm(page)).toContainText('USD accounts aren’t eligible.');
  await expect(transferRows(page)).toHaveCount(0);

  await expectClientCash(page, 'Eleanor Whitfield', { A1001: '$25,000.00', A1002: '$10,000.00' });
  await page.getByRole('region', { name: 'Client book' }).getByRole('button', { name: 'James Chen' }).click();
  const chen = page.getByRole('region', { name: 'James Chen' });
  await expect(chen.getByRole('row').filter({ hasText: 'A1003' }).getByRole('cell').nth(1)).toHaveText('US$15,000.00');
});

caseTest('WM-TC-037', async ({ page }) => {
  await openArea(page, 'money');
  await tab(page, 'Orders').click();
  await expect(tab(page, 'Orders')).toHaveAttribute('aria-selected', 'true');
  const ticket = page.getByRole('region', { name: 'New order' });
  await ticket.getByLabel('Account').click();
  await ticket.getByLabel('Account').selectOption('A1001');
  await ticket.getByLabel('Buy', { exact: true }).click();
  await expect(ticket.getByLabel('Buy', { exact: true })).toBeChecked();
  await ticket.getByLabel('Instrument').click();
  await ticket.getByLabel('Instrument').selectOption('RY');
  await ticket.getByLabel('Quantity').click();
  await ticket.getByLabel('Quantity').fill('100');
  await ticket.getByRole('button', { name: 'Place order' }).click();
  await expect(ticket.getByRole('status')).toContainText('Buy order');
  await expect(ticket.getByRole('status')).toContainText('Status: Open.');
  const order = page.getByRole('region', { name: 'Orders' }).getByRole('row').filter({ hasText: 'RY' }).filter({ hasText: 'Open' });
  await expect(order).toHaveCount(1);

  await gotoMoneyTab(page);
  await chooseFrom(page, 'A1001');
  await expect(transferForm(page)).toContainText('Available $11,000.00 after open buy orders.');
  await chooseTo(page, 'A1002');
  await enterAmount(page, '11000.01');
  await reviewTransfer(page);
  await expect(detail(reviewPanel(page), 'Available before')).toHaveText('$11,000.00');
  await confirmTransfer(page);
  await expect(reviewPanel(page).getByRole('alert')).toContainText('Insufficient available cash');
  await expect(transferRows(page)).toHaveCount(0);

  await reviewPanel(page).getByRole('button', { name: 'Edit transfer' }).click();
  await expectAvailableOptions(page, { A1001: '$11,000.00', A1002: '$10,000.00' });
  await enterAmount(page, '11000.00');
  await reviewTransfer(page);
  await expect(detail(reviewPanel(page), 'Amount')).toHaveText('$11,000.00');
  await confirmTransfer(page);
  await completedReference(page);
  await expectClientCash(page, 'Eleanor Whitfield', { A1001: '$14,000.00', A1002: '$21,000.00' });

  await page.reload();
  await tab(page, 'Orders').click();
  await expect(page.getByRole('region', { name: 'Orders' }).getByRole('row').filter({ hasText: 'RY' }).filter({ hasText: 'Open' })).toHaveCount(1);
  await gotoMoneyTab(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$11,000.00');
  await expect(transferRows(page).first()).toContainText('Completed');
});

caseTest('WM-TC-038', async ({ page }) => {
  await openArea(page, 'money');
  await chooseFrom(page, 'A1002');
  await chooseTo(page, 'A1001');
  await enterAmount(page, '10000.00');
  await reviewTransfer(page);
  await expect(detail(reviewPanel(page), 'Amount')).toHaveText('$10,000.00');
  await confirmTransfer(page);
  await completedReference(page);
  await expectClientCash(page, 'Eleanor Whitfield', { A1002: '$0.00', A1001: '$35,000.00' });

  await gotoMoneyTab(page);
  await chooseFrom(page, 'A1002');
  await chooseTo(page, 'A1001');
  await enterAmount(page, '0.01');
  await reviewTransfer(page);
  await confirmTransfer(page);
  await expect(reviewPanel(page).getByRole('alert')).toContainText('Insufficient available cash');
  await expectClientCash(page, 'Eleanor Whitfield', { A1002: '$0.00', A1001: '$35,000.00' });

  await page.reload();
  await gotoMoneyTab(page);
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page).first()).toContainText('$10,000.00');
});

caseTest('WM-TC-053', async ({ page }) => {
  const reference = 'Quarterly cash allocation';
  const cashCell = (scope: Locator, id: string) => scope.getByRole('row').filter({ hasText: id }).getByRole('cell').nth(1);
  const details = page.getByRole('region', { name: 'Eleanor Whitfield' });

  await openArea(page, 'clients');
  await expect(tab(page, 'Clients')).toHaveAttribute('aria-selected', 'true');

  await journeyStep(page, 'Search for C1001 and open Eleanor Whitfield', async () => {
    await page.getByLabel('Search clients').click();
    await page.getByLabel('Search clients').fill('C1001');
    await page.getByRole('button', { name: 'Eleanor Whitfield' }).click();
    await expect(details).toBeVisible();
    await expect(cashCell(details, 'A1001')).toHaveText('$25,000.00');
    await expect(cashCell(details, 'A1002')).toHaveText('$10,000.00');
  });

  await journeyStep(page, 'Open the client portfolio', async () => {
    await details.getByRole('button', { name: 'View portfolio' }).click();
    await expect(tab(page, 'Portfolio')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page).getByLabel('Client')).toHaveValue('C1001');
  });

  await journeyStep(page, 'Filter the portfolio to A1001', async () => {
    const account = panel(page).getByLabel('Account', { exact: true });
    await account.click();
    await account.selectOption('A1001');
    await expect(account).toHaveValue('A1001');
    await expect(page.getByRole('region', { name: 'Holdings' })).toContainText('RY');
    const cash = page.getByRole('region', { name: 'Cash by account' }).getByRole('row').filter({ hasText: 'A1001' });
    await expect(cash.getByRole('cell').nth(2)).toHaveText('$25,000.00');
  });

  await journeyStep(page, 'Open Move money', async () => {
    await gotoMoneyTab(page);
    await expect(fromSelect(page)).toHaveValue('');
    await expect(amountInput(page)).toHaveValue('');
    await expect(transfersPanel(page)).toContainText('No transfers yet.');
  });

  await journeyStep(page, 'Choose from account A1001', async () => {
    await chooseFrom(page, 'A1001');
    await expect(toSelect(page).locator('option:not([value=""])')).toHaveText(['Whitfield Savings (A1002)']);
  });

  await journeyStep(page, 'Choose to account A1002', async () => {
    await chooseTo(page, 'A1002');
    await expect(toSelect(page).locator('option[value="A1001"], option[value="A1003"]')).toHaveCount(0);
  });

  await journeyStep(page, 'Enter amount 1,000.00', async () => {
    await enterAmount(page, '1000.00');
    await expect(transfersPanel(page)).toContainText('0 of 0 transfers');
  });

  await journeyStep(page, 'Enter the reference', async () => {
    await referenceInput(page).click();
    await referenceInput(page).fill(reference);
    await expect(referenceInput(page)).toHaveValue(reference);
  });

  await journeyStep(page, 'Review the transfer', async () => {
    await reviewTransfer(page);
    const review = reviewPanel(page);
    await expect(detail(review, 'Client')).toHaveText('Eleanor Whitfield');
    await expect(detail(review, 'From')).toHaveText('Whitfield Investment (A1001)');
    await expect(detail(review, 'To')).toHaveText('Whitfield Savings (A1002)');
    await expect(detail(review, 'Amount')).toHaveText('$1,000.00');
    await expect(detail(review, 'Reference')).toHaveText(reference);
    await expect(transfersPanel(page)).toContainText('0 of 0 transfers');
  });

  await journeyStep(page, 'Edit the reviewed transfer', async () => {
    await reviewPanel(page).getByRole('button', { name: 'Edit transfer' }).click();
    await expect(fromSelect(page)).toHaveValue('A1001');
    await expect(toSelect(page)).toHaveValue('A1002');
    await expect(amountInput(page)).toHaveValue('1000.00');
    await expect(referenceInput(page)).toHaveValue(reference);
  });

  await journeyStep(page, 'Amend the amount to 1,250.00', async () => {
    await enterAmount(page, '1250.00');
    await expect(transfersPanel(page)).toContainText('0 of 0 transfers');
  });

  await journeyStep(page, 'Review the amended transfer', async () => {
    await reviewTransfer(page);
    const review = reviewPanel(page);
    await expect(detail(review, 'Amount')).toHaveText('$1,250.00');
    await expect(detail(review, 'From')).toHaveText('Whitfield Investment (A1001)');
    await expect(detail(review, 'To')).toHaveText('Whitfield Savings (A1002)');
    await expect(detail(review, 'Reference')).toHaveText(reference);
  });

  await journeyStep(page, 'Confirm the transfer', async () => {
    await confirmTransfer(page);
    const status = panel(page).getByRole('status').filter({ hasText: /^Transfer T\d{4}/ });
    await expect(status).toContainText('Status: Completed.');
    await expect(transferRows(page)).toHaveCount(1);
    await expect(transferRows(page).first()).toContainText('$1,250.00');
    await expect(transferRows(page).filter({ hasText: '$1,000.00' })).toHaveCount(0);
  });

  await journeyStep(page, 'Search transfers by reference', async () => {
    await page.getByLabel('Search transfers').click();
    await page.getByLabel('Search transfers').fill(reference);
    await expect(transfersPanel(page)).toContainText('1 of 1 transfers');
    await expect(transferRows(page)).toHaveCount(1);
    await expect(transferRows(page).first()).toContainText('A1001');
    await expect(transferRows(page).first()).toContainText('A1002');
    await expect(transferRows(page).first()).toContainText('$1,250.00');
  });

  await journeyStep(page, 'Reconcile balances in Clients', async () => {
    await tab(page, 'Clients').click();
    await page.getByRole('button', { name: 'Eleanor Whitfield' }).click();
    await expect(cashCell(details, 'A1001')).toHaveText('$23,750.00');
    await expect(cashCell(details, 'A1002')).toHaveText('$11,250.00');
    const parse = async (id: string) => Number(((await cashCell(details, id).textContent()) ?? '').replace(/[^0-9.]/g, ''));
    expect((await parse('A1001')) + (await parse('A1002'))).toBe(35000);
  });

  await journeyStep(page, 'Refresh data and verify persistence', async () => {
    await page.getByRole('button', { name: 'Refresh data' }).click();
    await expect(page.getByText(/^Data loaded /)).toBeVisible();
    await expect(cashCell(details, 'A1001')).toHaveText('$23,750.00');
    await expect(cashCell(details, 'A1002')).toHaveText('$11,250.00');
    const audit = page.getByRole('complementary', { name: 'Audit trail' });
    await audit.getByLabel('Show all areas').click();
    await expect(audit.getByRole('listitem').filter({ hasText: 'transfer.completed' })).toHaveCount(1);
  });
});

gapTest(
  'WM-GAP-060',
  {
    title: 'Legacy Move Money wizard blocks invalid amounts and flags dual approval above $25,000',
    area: 'money',
    wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.2.2',
  },
  async ({ page }) => {
    await page.goto('/?screen=money');
    const amount = page.getByLabel('Amount (CAD)');
    const reviewButton = page.getByText('Review payment', { exact: true });
    const approvalNote = page.getByText(/Payments over \$25,000 are checked by a second RBC approver/);
    await expect(amount).toHaveValue('40000');

    const invalid: Array<[string, RegExp]> = [
      ['0', /^Enter an amount greater than \$0\.$/],
      ['', /^Enter an amount greater than \$0\.$/],
      ['999999999', /^That’s more than the available cash of .+\. Lower the amount or sell investments first\.$/],
    ];
    for (const [value, message] of invalid) {
      await amount.click();
      await amount.fill(value);
      await expect(page.getByText(message)).toBeVisible();
      await reviewButton.click();
      await expect(reviewButton).toBeVisible();
      await expect(page.getByText('Confirm and send', { exact: true })).toHaveCount(0);
    }

    await amount.click();
    await amount.fill('25000');
    await expect(page.getByText(/Enter an amount|more than the available cash/)).toHaveCount(0);
    await expect(page.getByText('Not required', { exact: true })).toBeVisible();
    await reviewButton.click();
    await expect(page.getByText('Confirm and send', { exact: true })).toBeVisible();
    await expect(page.getByText('$25,000.00', { exact: true }).first()).toBeVisible();
    await expect(approvalNote).toHaveCount(0);

    await page.getByText('Edit', { exact: true }).click();
    await amount.click();
    await amount.fill('25000.01');
    await expect(page.getByText('Required', { exact: true })).toBeVisible();
    await reviewButton.click();
    await expect(approvalNote).toBeVisible();
    await page.getByText('Confirm and send', { exact: true }).click();
    await expect(page.getByText('Submitted. A second approver is reviewing your payment.')).toBeVisible();
  },
);
