import type { Page } from '@playwright/test';
import { caseTest, gapTest, expect, openArea, test } from '../tooling/fixtures';

const investment = 'Whitfield Investment (A1001)';
const savings = 'Whitfield Savings (A1002)';
const transferRows = (page: Page) => page.getByRole('table', { name: 'Transfers', exact: true }).locator('tbody tr');
const audit = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });

async function selectTransfer(page: Page, from: string, to: string, amount: string) {
  await page.getByLabel('From account', { exact: true }).selectOption(from);
  await page.getByLabel('To account', { exact: true }).selectOption(to);
  await page.getByLabel('Amount (CAD)', { exact: true }).fill(amount);
}

async function reviewTransfer(page: Page, amount: string, from = 'A1001', to = 'A1002') {
  await selectTransfer(page, from, to, amount);
  await page.getByRole('button', { name: 'Review transfer', exact: true }).click();
}

async function expectReview(page: Page, amount: string, from = investment, to = savings) {
  const review = page.getByRole('region', { name: 'Review transfer', exact: true });
  await expect(review).toBeVisible();
  await expect(review.locator('dt').filter({ hasText: /^From$/ }).locator('+ dd')).toHaveText(from);
  await expect(review.locator('dt').filter({ hasText: /^To$/ }).locator('+ dd')).toHaveText(to);
  await expect(review.locator('dt').filter({ hasText: /^Amount$/ }).locator('+ dd')).toHaveText(amount);
  await expect(review.getByRole('button', { name: 'Confirm transfer', exact: true })).toBeEnabled();
}

async function expectNoTransfers(page: Page) {
  await expect(transferRows(page)).toHaveCount(1);
  await expect(transferRows(page)).toHaveText('No transfers yet. Completed transfers appear here.');
  await expect(page.getByText('0 of 0 transfers', { exact: true })).toBeVisible();
}

async function expectAuditCount(page: Page, count: number, allAreas = false) {
  await audit(page).getByRole('checkbox', { name: 'Show all areas' }).setChecked(allAreas);
  const entries = audit(page).getByRole('list', { name: 'Audit entries' }).getByRole('listitem');
  await expect(entries).toHaveCount(count);
  if (count === 0) {
    await expect(audit(page).getByText('No changes recorded yet. Saved actions appear here with their time and reference.', { exact: true })).toBeVisible();
  }
  return entries;
}

async function expectBalances(page: Page, a1001 = '$25,000.00', a1002 = '$10,000.00', preserveReview = false, reserved = '$0.00', available = a1001) {
  // Inspect persisted cash in a second UI tab only when the pending Review must remain intact.
  const view = preserveReview ? await page.context().newPage() : page;
  try {
    if (preserveReview) await view.goto('/?screen=workspace&area=portfolio');
    else await view.getByRole('tab', { name: 'Portfolio', exact: true }).click();
    const cash = view.getByRole('table', { name: 'Cash by account', exact: true });
    await expect(cash).toBeVisible();
    for (const [id, currency, balance, held, usable] of [
      ['A1001', 'CAD', a1001, reserved, available],
      ['A1002', 'CAD', a1002, '$0.00', a1002],
      ['A1003', 'USD', 'US$15,000.00', 'US$0.00', 'US$15,000.00'],
    ]) {
      const cells = cash.getByRole('row').filter({ has: view.getByRole('rowheader', { name: new RegExp(id) }) }).getByRole('cell');
      await expect(cells.nth(1)).toHaveText(currency);
      await expect(cells.nth(2)).toHaveText(balance);
      await expect(cells.nth(3)).toHaveText(held);
      await expect(cells.nth(4)).toHaveText(usable);
    }
    const holdings = view.getByRole('table', { name: 'Holdings', exact: true });
    await expect(holdings.locator('tbody tr')).toHaveCount(3);
    for (const [id, symbol, quantity] of [['A1001', 'RY', '100'], ['A1002', 'BMO', '80'], ['A1003', 'MSFT', '40']]) {
      const row = holdings.getByRole('row').filter({ hasText: id });
      await expect(row.getByRole('rowheader', { name: symbol, exact: true })).toBeVisible();
      await expect(row.getByRole('cell', { name: quantity, exact: true })).toBeVisible();
    }
    await test.info().attach('cash-and-holdings.png', { body: await view.screenshot({ fullPage: true }), contentType: 'image/png' });
  } finally {
    if (preserveReview) await view.close();
    else await view.getByRole('tab', { name: 'Move money', exact: true }).click();
  }
}

async function expectCompleted(page: Page, amount: string, from = investment, to = savings, reference?: string) {
  await expect(transferRows(page)).toHaveCount(1);
  const row = transferRows(page);
  await expect(row.getByRole('rowheader')).toHaveText(/\S+/);
  const cells = row.getByRole('cell');
  await expect(cells.nth(0)).toHaveText(from);
  await expect(cells.nth(1)).toHaveText(to);
  await expect(cells.nth(2)).toHaveText(amount);
  await expect(cells.nth(3)).toHaveText(/\S+/);
  await expect(cells.nth(3)).not.toHaveText('None');
  await expect(cells.nth(4)).toHaveText('Completed');
  await expect(page.getByText('1 of 1 transfers', { exact: true })).toBeVisible();
  if (reference) await expect(cells.nth(3)).toHaveText(reference);
  return (await cells.nth(3).innerText()).trim();
}

async function confirmTransfer(page: Page, amount: string, from = investment, to = savings) {
  await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  const success = page.getByRole('status').filter({ hasText: 'Status: Completed' });
  await expect(success).toBeVisible();
  await expect(success).toContainText(amount);
  await expect(success).toContainText(from);
  await expect(success).toContainText(to);
  const reference = await expectCompleted(page, amount, from, to);
  await expect(success).toContainText(`Reference: ${reference}`);
  return reference;
}

async function expectTransferAudit(page: Page, amount: string, reference: string, from = 'A1001', to = 'A1002') {
  const entries = await expectAuditCount(page, 1);
  await expect(entries).toContainText('transfer.completed');
  await expect(entries).toContainText(`CAD ${amount}`);
  await expect(entries).toContainText(from);
  await expect(entries).toContainText(to);
  await expect(entries).toContainText(reference);
}

async function confirmIfReviewOffered(page: Page) {
  const review = page.getByRole('heading', { name: 'Review transfer', exact: true });
  await expect(review.or(page.getByRole('alert'))).toBeVisible();
  if (await review.isVisible()) await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
}

caseTest('WM-TC-031', async ({ page }) => {
  await openArea(page, 'money');
  await reviewTransfer(page, '1000.00');
  await expectReview(page, '$1,000.00');
  await expectBalances(page, '$25,000.00', '$10,000.00', true);
  await page.reload();
  await expectNoTransfers(page);
  await expectBalances(page);
  await expectAuditCount(page, 0, true);
});

caseTest('WM-TC-032', async ({ page }) => {
  await openArea(page, 'money');
  await reviewTransfer(page, '1000.00');
  await expectReview(page, '$1,000.00');
  const reference = await confirmTransfer(page, '$1,000.00');
  await expectBalances(page, '$24,000.00', '$11,000.00');
  await page.reload();
  await expectCompleted(page, '$1,000.00', investment, savings, reference);
  await expectBalances(page, '$24,000.00', '$11,000.00');
  await expectTransferAudit(page, '1,000.00', reference);
});

caseTest('WM-TC-033', async ({ page }) => {
  await openArea(page, 'money');
  await reviewTransfer(page, '1000.00');
  await expectReview(page, '$1,000.00');
  await expectBalances(page, '$25,000.00', '$10,000.00', true);
  await page.getByRole('button', { name: 'Edit transfer', exact: true }).click();
  await expect(page.getByLabel('From account', { exact: true })).toHaveValue('A1001');
  await expect(page.getByLabel('To account', { exact: true })).toHaveValue('A1002');
  await expect(page.getByLabel('Amount (CAD)', { exact: true })).toHaveValue('1000.00');
  await page.getByLabel('Amount (CAD)', { exact: true }).fill('2500.50');
  await page.getByRole('button', { name: 'Review transfer', exact: true }).click();
  await expectReview(page, '$2,500.50');
  await expectBalances(page, '$25,000.00', '$10,000.00', true);
  const reference = await confirmTransfer(page, '$2,500.50');
  await expectBalances(page, '$22,499.50', '$12,500.50');
  await page.reload();
  await expectCompleted(page, '$2,500.50', investment, savings, reference);
  await expect(page.getByRole('table', { name: 'Transfers', exact: true }).getByRole('cell', { name: '$1,000.00', exact: true })).toHaveCount(0);
  await expectTransferAudit(page, '2,500.50', reference);
});

caseTest('WM-TC-034', async ({ page }) => {
  await openArea(page, 'money');
  for (const [amount, message] of [
    ['0', /greater than (?:zero|0)/i],
    ['-100', /greater than (?:zero|0)/i],
    ['100.123', /at most (?:two|2) decimal places/i],
    ['', /enter an amount|greater than (?:zero|0)/i],
    ['abc', /number greater than (?:zero|0)/i],
  ] as const) {
    await reviewTransfer(page, amount);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByRole('heading', { name: 'Review transfer', exact: true })).toHaveCount(0);
    await expectNoTransfers(page);
    await expectAuditCount(page, 0, true);
    await expectBalances(page);
    await page.reload();
    await expectNoTransfers(page);
    await expectAuditCount(page, 0, true);
    await expectBalances(page);
  }
  await reviewTransfer(page, '0.01');
  await expectReview(page, '$0.01');
  const reference = await confirmTransfer(page, '$0.01');
  await expectBalances(page, '$24,999.99', '$10,000.01');
  await page.reload();
  await expectCompleted(page, '$0.01', investment, savings, reference);
  await expectBalances(page, '$24,999.99', '$10,000.01');
  await expectTransferAudit(page, '0.01', reference);
});

caseTest('WM-TC-035', async ({ page }) => {
  await openArea(page, 'money');
  await page.getByLabel('From account', { exact: true }).selectOption('A1001');
  const destination = page.getByLabel('To account', { exact: true });
  await destination.click();
  await destination.press('Escape');
  const sameAccount = destination.locator('option[value="A1001"]:not([disabled])');
  if (await sameAccount.count()) {
    await destination.selectOption('A1001');
    await page.getByLabel('Amount (CAD)', { exact: true }).fill('500.00');
    await page.getByRole('button', { name: 'Review transfer', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/(?:different|differ|same account)/i);
  } else {
    await expect(sameAccount).toHaveCount(0);
    await expect(destination.locator('option[value="A1002"]:not([disabled])')).toHaveCount(1);
  }
  await expect(page.getByRole('heading', { name: 'Review transfer', exact: true })).toHaveCount(0);
  await expectNoTransfers(page);
  await expectAuditCount(page, 0, true);
  await expectBalances(page);
  await page.reload();
  await expectNoTransfers(page);
  await expectBalances(page);
  await expectAuditCount(page, 0, true);
});

caseTest('WM-TC-036', async ({ page }) => {
  await openArea(page, 'money');
  const source = page.getByLabel('From account', { exact: true });
  const destination = page.getByLabel('To account', { exact: true });
  await source.selectOption('A1001');
  await destination.click();
  await destination.press('Escape');
  await expect(destination.locator('option[value="A1002"]:not([disabled])')).toHaveCount(1);
  const usdDestination = destination.locator('option[value="A1003"]:not([disabled])');
  if (await usdDestination.count()) {
    await destination.selectOption('A1003');
    await page.getByLabel('Amount (CAD)', { exact: true }).fill('100.00');
    await page.getByRole('button', { name: 'Review transfer', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/(?:same client|different client|currency|CAD accounts)/i);
    await expect(page.getByRole('heading', { name: 'Review transfer', exact: true })).toHaveCount(0);
  } else {
    await expect(usdDestination).toHaveCount(0);
    await expect(destination.locator('option[value="A1001"]:not([disabled])')).toHaveCount(0);
    await expect(destination.locator('option:not([value=""]):not([disabled])')).toHaveCount(1);
  }
  const usdSource = source.locator('option[value="A1003"]:not([disabled])');
  if (await usdSource.count()) {
    await source.selectOption('A1003');
    for (const target of ['A1001', 'A1002']) {
      const option = destination.locator(`option[value="${target}"]:not([disabled])`);
      if (await option.count()) {
        await destination.selectOption(target);
        await page.getByLabel('Amount (CAD)', { exact: true }).fill('100.00');
        await page.getByRole('button', { name: 'Review transfer', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText(/(?:same client|different client|currency|CAD accounts)/i);
        await expect(page.getByRole('heading', { name: 'Review transfer', exact: true })).toHaveCount(0);
      } else await expect(option).toHaveCount(0);
    }
  } else await expect(usdSource).toHaveCount(0);
  await expectNoTransfers(page);
  await expectBalances(page);
  await expectAuditCount(page, 0, true);
  await page.reload();
  await expectNoTransfers(page);
  await expectBalances(page);
  await expectAuditCount(page, 0, true);
});

caseTest('WM-TC-037', async ({ page }) => {
  await openArea(page, 'money');
  await page.getByRole('tab', { name: 'Orders', exact: true }).click();
  await page.getByLabel('Account', { exact: true }).selectOption('A1001');
  await page.getByRole('radio', { name: 'Buy', exact: true }).check();
  await page.getByLabel('Instrument', { exact: true }).selectOption('RY');
  await page.getByLabel('Quantity', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Status: Open' })).toBeVisible();
  const orders = page.getByRole('table', { name: 'Orders', exact: true }).locator('tbody tr');
  await expect(orders).toHaveCount(1);
  const orderId = (await orders.getByRole('rowheader').innerText()).trim();
  await expect(orders.getByRole('cell', { name: 'Open', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Move money', exact: true }).click();
  await reviewTransfer(page, '11000.01');
  await confirmIfReviewOffered(page);
  await expect(page.getByRole('alert')).toContainText(/insufficient available cash/i);
  await expectNoTransfers(page);
  await expectAuditCount(page, 0);
  await expectAuditCount(page, 1, true);
  await expectBalances(page, '$25,000.00', '$10,000.00', true, '$14,000.00', '$11,000.00');
  await page.reload();
  await expectNoTransfers(page);
  await expectAuditCount(page, 0);
  await expectBalances(page, '$25,000.00', '$10,000.00', false, '$14,000.00', '$11,000.00');
  await reviewTransfer(page, '11000.00');
  await expectReview(page, '$11,000.00');
  const reference = await confirmTransfer(page, '$11,000.00');
  await expectBalances(page, '$14,000.00', '$21,000.00', false, '$14,000.00', '$0.00');
  await page.reload();
  await page.getByRole('tab', { name: 'Orders', exact: true }).click();
  await expect(orders).toHaveCount(1);
  await expect(orders.getByRole('rowheader')).toHaveText(orderId);
  for (const value of [investment, 'Buy', '100', 'RY', 'Open']) {
    await expect(orders.getByRole('cell', { name: value, exact: true })).toBeVisible();
  }
  await page.getByRole('tab', { name: 'Move money', exact: true }).click();
  await expectCompleted(page, '$11,000.00', investment, savings, reference);
  await expectTransferAudit(page, '11,000.00', reference);
});

caseTest('WM-TC-038', async ({ page }) => {
  await openArea(page, 'money');
  await reviewTransfer(page, '10000.00', 'A1002', 'A1001');
  await expectReview(page, '$10,000.00', savings, investment);
  const reference = await confirmTransfer(page, '$10,000.00', savings, investment);
  await expectBalances(page, '$35,000.00', '$0.00');
  await reviewTransfer(page, '0.01', 'A1002', 'A1001');
  await confirmIfReviewOffered(page);
  await expect(page.getByRole('alert')).toContainText(/insufficient available cash/i);
  await expectCompleted(page, '$10,000.00', savings, investment, reference);
  await expectTransferAudit(page, '10,000.00', reference, 'A1002', 'A1001');
  await expectBalances(page, '$35,000.00', '$0.00', true);
  await page.reload();
  await expectCompleted(page, '$10,000.00', savings, investment, reference);
  await expectBalances(page, '$35,000.00', '$0.00');
  await expectTransferAudit(page, '10,000.00', reference, 'A1002', 'A1001');
});

gapTest('WM-GAP-060', {
  title: 'Legacy Move Money wizard >$25,000 shows dual-approval notice on Review and "second approver" confirmation; <=25,000 shows "Sent"',
  area: 'money',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.2.2',
}, async ({ page }) => {
  await openArea(page, 'money', { screen: 'money' });
  for (const [amount, display, dual] of [['25000.01', '$25,000.01', true], ['25000.00', '$25,000.00', false], ['1000.00', '$1,000.00', false]] as const) {
    await page.getByLabel('Amount (CAD)', { exact: true }).fill(amount);
    await page.getByText('Wire', { exact: true }).click();
    await page.getByText('Review payment', { exact: true }).click();
    await expect(page.getByText(display, { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm and send', { exact: true })).toBeVisible();
    const notice = page.getByText("Payments over $25,000 are checked by a second RBC approver. We'll confirm with you by text before 4:00 PM ET today.", { exact: true });
    if (dual) await expect(notice).toBeVisible();
    else await expect(notice).toHaveCount(0);
    await page.getByText('Confirm and send', { exact: true }).click();
    if (dual) {
      await expect(page.getByText('Submitted. A second approver is reviewing your payment.', { exact: true })).toBeVisible();
      await expect(page.getByText('Over $25,000 · RBC Payments team', { exact: true })).toBeVisible();
      await expect(page.getByText('Sent. Your payment is on its way.', { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText('Sent. Your payment is on its way.', { exact: true })).toBeVisible();
      await expect(page.getByText('Submitted. A second approver is reviewing your payment.', { exact: true })).toHaveCount(0);
    }
    await expect(page.getByText(/Reference PMT-2026-1012-08841/)).toBeVisible();
    await page.getByText('Make another payment', { exact: true }).click();
  }
});

gapTest('WM-GAP-061', {
  title: 'Legacy wizard invalid amount blocks Review with inline error; Edit from Review returns to details with values kept',
  area: 'money',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.2.2',
}, async ({ page }) => {
  await openArea(page, 'money', { screen: 'money' });
  for (const amount of ['0', '', 'abc']) {
    await page.getByLabel('Amount (CAD)', { exact: true }).fill(amount);
    await expect(page.getByText('Enter an amount greater than $0.', { exact: true })).toBeVisible();
    await page.getByText('Review payment', { exact: true }).click();
    await expect(page.getByLabel('Amount (CAD)', { exact: true })).toBeVisible();
    await expect(page.getByText('Enter an amount greater than $0.', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm and send', { exact: true })).toHaveCount(0);
  }
  await page.getByText('Interac e-Transfer', { exact: true }).click();
  await page.getByLabel('Amount (CAD)', { exact: true }).fill('3000.01');
  await page.getByText('Review payment', { exact: true }).click();
  await expect(page.getByText('Interac e-Transfer limit is $3,000 per day. Choose Wire or lower the amount.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Amount (CAD)', { exact: true })).toBeVisible();
  await expect(page.getByText('Confirm and send', { exact: true })).toHaveCount(0);
  await page.getByText('Ontario Land Registry Trust', { exact: true }).click();
  await page.getByText('EFT', { exact: true }).click();
  await page.getByLabel('Amount (CAD)', { exact: true }).fill('1000.50');
  await page.getByText('Review payment', { exact: true }).click();
  const beneficiary = 'Ontario Land Registry Trust · Lawyer trust account · Hughes LLP';
  await expect(page.getByText(beneficiary, { exact: true })).toBeVisible();
  await expect(page.getByText('$1,000.50', { exact: true })).toBeVisible();
  await expect(page.getByText('EFT', { exact: true })).toBeVisible();
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.getByLabel('Amount (CAD)', { exact: true })).toHaveValue('1000.50');
  await expect(page.getByText('Review payment', { exact: true })).toBeVisible();
  await expect(page.getByText('Confirm and send', { exact: true })).toHaveCount(0);
  await page.getByText('Review payment', { exact: true }).click();
  await expect(page.getByText(beneficiary, { exact: true })).toBeVisible();
  await expect(page.getByText('$1,000.50', { exact: true })).toBeVisible();
  await expect(page.getByText('EFT', { exact: true })).toBeVisible();
});

gapTest('WM-GAP-062', {
  title: 'Transfer confirm request failure shows error, no balances move; retry after recovery completes once',
  area: 'money',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2',
}, async ({ page }) => {
  await openArea(page, 'money');
  await reviewTransfer(page, '1000.00');
  await expectReview(page, '$1,000.00');
  let failedRequests = 0;
  await page.route('**/api/workflows/transfers', async route => {
    if (route.request().method() === 'POST') {
      failedRequests += 1;
      await route.abort('failed');
    } else await route.fallback();
  });
  await page.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/service could not be reached.*try again/i);
  expect(failedRequests).toBe(1);
  await expectReview(page, '$1,000.00');
  await expect(page.getByRole('status').filter({ hasText: 'Status: Completed' })).toHaveCount(0);
  await expectNoTransfers(page);
  await expectAuditCount(page, 0, true);
  await expectBalances(page, '$25,000.00', '$10,000.00', true);
  const persisted = await page.context().newPage();
  try {
    await persisted.goto('/?screen=workspace&area=money');
    await expectNoTransfers(persisted);
    await expectAuditCount(persisted, 0, true);
    await test.info().attach('failed-confirm-persisted-state.png', { body: await persisted.screenshot({ fullPage: true }), contentType: 'image/png' });
  } finally {
    await persisted.close();
  }
  await page.unroute('**/api/workflows/transfers');
  const reference = await confirmTransfer(page, '$1,000.00');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expectBalances(page, '$24,000.00', '$11,000.00');
  await expectTransferAudit(page, '1,000.00', reference);
  await page.reload();
  await expectCompleted(page, '$1,000.00', investment, savings, reference);
  await expectBalances(page, '$24,000.00', '$11,000.00');
  await expectTransferAudit(page, '1,000.00', reference);
});
