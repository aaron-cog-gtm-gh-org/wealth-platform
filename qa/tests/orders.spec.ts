import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';
import type { Locator, Page } from '@playwright/test';

type Side = 'Buy' | 'Sell';
type OrderRow = { account: string; side: string; symbol: string; quantity: string; status: string };
type OrderInput = { account: string; side: Side; symbol: string; quantity: string };

const ACCOUNT_LABELS: Record<string, string> = {
  A1001: 'Whitfield Investment (A1001)',
  A1002: 'Whitfield Savings (A1002)',
  A1003: 'Chen USD Investment (A1003)'
};

const ticket = (page: Page) => page.getByRole('region', { name: 'New order', exact: true });
const blotter = (page: Page) => page.getByRole('region', { name: 'Orders', exact: true });
const auditTrail = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });
const accountSelect = (page: Page) => ticket(page).getByLabel('Account', { exact: true });
const instrumentSelect = (page: Page) => ticket(page).getByLabel('Instrument', { exact: true });
const quantityInput = (page: Page) => ticket(page).getByLabel('Quantity', { exact: true });

const estimateValue = (page: Page, term: string): Locator =>
  ticket(page)
    .getByLabel('Order estimate')
    .locator('dt', { hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::dd[1]');

const row = (account: string, side: Side, symbol: string, quantity: number | string, status: string): OrderRow => ({
  account: ACCOUNT_LABELS[account],
  side,
  symbol,
  quantity: String(quantity),
  status
});

const sortRows = (rows: OrderRow[]) =>
  [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

async function readOrders(page: Page): Promise<OrderRow[]> {
  const rows = blotter(page).locator('tbody tr').filter({ has: page.locator('th[scope="row"]') });
  const values = await rows.evaluateAll((trs) =>
    trs.map((tr) => {
      const cells = Array.from(tr.children).map((cell) => (cell.textContent ?? '').trim());
      return { account: cells[1], symbol: cells[2], side: cells[3], quantity: cells[4], status: cells[7] };
    })
  );
  return sortRows(values.map((v) => ({ account: v.account, side: v.side, symbol: v.symbol, quantity: v.quantity, status: v.status })));
}

async function expectOrders(page: Page, expected: OrderRow[]) {
  await expect(blotter(page)).toBeVisible();
  await expect.poll(() => readOrders(page)).toEqual(sortRows(expected));
  await expect(blotter(page).getByText(`${expected.length} of ${expected.length} orders`)).toBeVisible();
  if (expected.length === 0) {
    await expect(blotter(page).getByText('No orders yet. Place one with the order ticket.')).toBeVisible();
  }
}

function orderRow(page: Page, account: string, side: Side, symbol: string, quantity: number) {
  return blotter(page)
    .locator('tbody tr')
    .filter({ has: page.getByRole('cell', { name: ACCOUNT_LABELS[account], exact: true }) })
    .filter({ has: page.getByRole('cell', { name: side, exact: true }) })
    .filter({ has: page.getByRole('cell', { name: symbol, exact: true }) })
    .filter({ has: page.getByRole('cell', { name: String(quantity), exact: true }) });
}

const orderAuditEntries = (page: Page) =>
  auditTrail(page).getByRole('listitem').filter({ hasText: /^order\./ });

async function fillTicket(page: Page, input: OrderInput) {
  await expect(ticket(page)).toBeVisible();
  await accountSelect(page).selectOption(input.account);
  await instrumentSelect(page).selectOption(input.symbol);
  await ticket(page).getByRole('radio', { name: input.side, exact: true }).check();
  await quantityInput(page).fill(input.quantity);
}

async function submitTicket(page: Page) {
  await ticket(page).getByRole('button', { name: 'Place order' }).click();
  await expect(ticket(page).getByRole('button', { name: 'Place order' })).toBeEnabled();
}

async function placeAccepted(page: Page, input: OrderInput, expectedAfter: OrderRow[]) {
  await fillTicket(page, input);
  await submitTicket(page);
  await expect(ticket(page).getByRole('alert')).toHaveCount(0);
  await expect(ticket(page).getByRole('status')).toContainText(
    new RegExp(`${input.side} order O\\d+ for ${input.quantity} ${input.symbol} placed in .*\\(${input.account}\\)\\. Status: Open\\.`)
  );
  await expectOrders(page, expectedAfter);
}

async function placeRejected(page: Page, input: OrderInput, unchanged: OrderRow[], message: RegExp) {
  const auditBefore = await orderAuditEntries(page).count();
  await fillTicket(page, input);
  await submitTicket(page);
  const alert = ticket(page).getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toHaveText(message);
  await expect(ticket(page).getByRole('status')).toHaveCount(0);
  await expectOrders(page, unchanged);
  await expect(orderAuditEntries(page)).toHaveCount(auditBefore);
  return alert;
}

async function cancel(page: Page, account: string, side: Side, symbol: string, quantity: number) {
  const target = orderRow(page, account, side, symbol, quantity).filter({ hasText: 'Open' });
  await expect(target).toHaveCount(1);
  const id = (await target.getByRole('rowheader').textContent())?.trim() ?? '';
  await target.getByRole('button', { name: `Cancel order ${id}` }).click();
  await expect(blotter(page).getByRole('status')).toHaveText(`Order ${id} cancelled.`);
  await expect(blotter(page).locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: id, exact: true }) })
    .getByRole('cell', { name: 'Cancelled', exact: true })).toBeVisible();
  return id;
}

async function goToArea(page: Page, label: string) {
  await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
}

async function reloadAndReturnToOrders(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  await goToArea(page, 'Orders');
  await expect(blotter(page)).toBeVisible();
}

async function expectClientAccountCash(page: Page, clientName: string, expected: Record<string, string>) {
  await goToArea(page, 'Clients');
  await page.getByRole('button', { name: clientName, exact: true }).click();
  const accounts = page.getByRole('table', { name: `Accounts for ${clientName}` });
  for (const [accountId, cash] of Object.entries(expected)) {
    const accountRow = accounts.getByRole('row').filter({ hasText: accountId });
    await expect(accountRow).toHaveCount(1);
    await expect(accountRow.getByRole('cell').nth(1)).toHaveText(cash);
  }
}

async function expectHoldingQuantity(page: Page, symbol: string, account: string, quantity: string) {
  await goToArea(page, 'Portfolio');
  const holding = page
    .getByRole('table', { name: 'Holdings' })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: symbol, exact: true }) })
    .filter({ hasText: `(${account})` });
  await expect(holding).toHaveCount(1);
  await expect(holding.getByRole('cell').nth(3)).toHaveText(quantity);
}

async function instrumentValues(page: Page) {
  return instrumentSelect(page).locator('option').evaluateAll((options) =>
    options.map((o) => (o as HTMLOptionElement).value).filter(Boolean)
  );
}

const A1001 = 'A1001';

caseTest('WM-TC-019', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  const buy10 = row(A1001, 'Buy', 'RY', 10, 'Open');
  await fillTicket(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '10' });
  await expect(estimateValue(page, 'Estimated value')).toHaveText('$1,400.00');
  await expect(estimateValue(page, 'Available cash')).toHaveText('$25,000.00');
  await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '10' }, [buy10]);

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [buy10]);

  await expect(auditTrail(page)).toBeVisible();
  const entries = orderAuditEntries(page);
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('order.created');
  await expect(entries.first()).toContainText('Buy 10 RY @ 140.00 in A1001');
});

caseTest('WM-TC-020', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  const sell40 = row(A1001, 'Sell', 'RY', 40, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '40' }, [sell40]);

  await expect(accountSelect(page)).toHaveValue(A1001);
  await expect(instrumentSelect(page)).toHaveValue('RY');
  await expect(estimateValue(page, 'Held in account')).toHaveText('100 RY');
  await expect(estimateValue(page, 'Available to sell')).toHaveText('60 RY');

  await expectHoldingQuantity(page, 'RY', A1001, '100');

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [sell40]);
});

caseTest('WM-TC-021', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  const sell70 = row(A1001, 'Sell', 'RY', 70, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '70' }, [sell70]);

  const alert = await placeRejected(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '50' }, [sell70], /available/i);
  await expect(alert).toContainText(/\b30\b/);

  await expectOrders(page, [sell70]);

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [sell70]);

  const sell30 = row(A1001, 'Sell', 'RY', 30, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '30' }, [sell70, sell30]);
  await expect(estimateValue(page, 'Available to sell')).toHaveText('0 RY');

  const zeroAlert = await placeRejected(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '1' }, [sell70, sell30], /available/i);
  await expect(zeroAlert).toContainText(/\b0\b/);

  await expectHoldingQuantity(page, 'RY', A1001, '100');
});

caseTest('WM-TC-022', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  const sell70 = row(A1001, 'Sell', 'RY', 70, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '70' }, [sell70]);

  const alert = await placeRejected(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '31' }, [sell70], /available/i);
  await expect(alert).toContainText(/\b30\b/);

  await cancel(page, A1001, 'Sell', 'RY', 70);
  const cancelled70 = row(A1001, 'Sell', 'RY', 70, 'Cancelled');
  await expectOrders(page, [cancelled70]);

  const sell100 = row(A1001, 'Sell', 'RY', 100, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '100' }, [cancelled70, sell100]);

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [cancelled70, sell100]);
});

caseTest('WM-TC-023', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  await fillTicket(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '179' });
  await expect(estimateValue(page, 'Estimated value')).toHaveText('$25,060.00');
  await expect(estimateValue(page, 'Available cash')).toHaveText('$25,000.00');
  await placeRejected(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '179' }, [], /insufficient available cash/i);
  await expect(estimateValue(page, 'Available cash')).toHaveText('$25,000.00');

  await expectOrders(page, []);
  await expectClientAccountCash(page, 'Eleanor Whitfield', { A1001: '$25,000.00' });

  await goToArea(page, 'Orders');
  await fillTicket(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '178' });
  await expect(estimateValue(page, 'Estimated value')).toHaveText('$24,920.00');
  const buy178 = row(A1001, 'Buy', 'RY', 178, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '178' }, [buy178]);
  await expect(orderRow(page, A1001, 'Buy', 'RY', 178).getByRole('cell', { name: '$24,920.00', exact: true })).toBeVisible();

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [buy178]);
});

caseTest('WM-TC-024', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  const buy100 = row(A1001, 'Buy', 'RY', 100, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '100' }, [buy100]);

  await accountSelect(page).selectOption(A1001);
  await ticket(page).getByRole('radio', { name: 'Buy', exact: true }).check();
  await instrumentSelect(page).selectOption('RY');
  await expect(estimateValue(page, 'Available cash')).toHaveText('$11,000.00');

  await placeRejected(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '80' }, [buy100], /insufficient available cash/i);

  const buy78 = row(A1001, 'Buy', 'RY', 78, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '78' }, [buy100, buy78]);

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [buy100, buy78]);
  await expect(orderRow(page, A1001, 'Buy', 'RY', 80)).toHaveCount(0);
});

caseTest('WM-TC-025', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  const attempts: Array<[string, RegExp]> = [
    ['0', /positive whole number/i],
    ['-5', /positive whole number/i],
    ['2.5', /fractional shares/i],
    ['', /positive whole number/i],
    ['ten', /positive whole number/i]
  ];
  for (const [quantity, message] of attempts) {
    await placeRejected(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity }, [], message);
    await expect(quantityInput(page)).toHaveAttribute('aria-invalid', 'true');
  }

  await reloadAndReturnToOrders(page);
  await expectOrders(page, []);
  await expect(orderAuditEntries(page)).toHaveCount(0);
  await accountSelect(page).selectOption(A1001);
  await expect(estimateValue(page, 'Available cash')).toHaveText('$25,000.00');
});

caseTest('WM-TC-026', async ({ page }) => {
  await openArea(page, 'orders');

  await accountSelect(page).selectOption('A1002');
  await expect.poll(() => instrumentValues(page)).toEqual(['BMO']);
  await instrumentSelect(page).selectOption('BMO');
  await expect(instrumentSelect(page)).toHaveValue('BMO');

  await accountSelect(page).selectOption('A1003');
  await expect.poll(() => instrumentValues(page)).toEqual(['MSFT']);
  await expect(instrumentSelect(page)).toHaveValue('');

  await accountSelect(page).selectOption(A1001);
  await expect.poll(() => instrumentValues(page)).toEqual(['RY']);

  await expectOrders(page, []);
});

caseTest('WM-TC-027', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '5' }, [row(A1001, 'Buy', 'RY', 5, 'Open')]);

  const id = await cancel(page, A1001, 'Buy', 'RY', 5);
  const cancelled = row(A1001, 'Buy', 'RY', 5, 'Cancelled');
  await expectOrders(page, [cancelled]);

  const target = blotter(page).locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: id, exact: true }) });
  await expect(target.getByRole('button')).toHaveCount(0);
  await expect(target.getByRole('cell', { name: 'Cancelled', exact: true })).toBeVisible();

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [cancelled]);
  await expect(target.getByRole('button')).toHaveCount(0);

  await expect(auditTrail(page)).toBeVisible();
  const cancellations = orderAuditEntries(page).filter({ hasText: 'order.cancelled' }).filter({ hasText: id });
  await expect(cancellations).toHaveCount(1);
  await expect(cancellations.first()).toContainText('Cancelled Buy 5 RY in A1001');
});

caseTest('WM-TC-028', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  const buy150 = row(A1001, 'Buy', 'RY', 150, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '150' }, [buy150]);

  await placeRejected(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '30' }, [buy150], /insufficient available cash/i);
  await expect(estimateValue(page, 'Estimated value')).toHaveText('$4,200.00');
  await expect(estimateValue(page, 'Available cash')).toHaveText('$4,000.00');

  await cancel(page, A1001, 'Buy', 'RY', 150);
  const cancelled150 = row(A1001, 'Buy', 'RY', 150, 'Cancelled');
  await expectOrders(page, [cancelled150]);

  const buy178 = row(A1001, 'Buy', 'RY', 178, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '178' }, [cancelled150, buy178]);

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [cancelled150, buy178]);
  await expect(orderRow(page, A1001, 'Buy', 'RY', 30)).toHaveCount(0);
});

caseTest('WM-TC-029', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  await fillTicket(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '35' });
  await expect(estimateValue(page, 'Estimated value')).toHaveText('US$14,700.00');
  const buy35 = row('A1003', 'Buy', 'MSFT', 35, 'Open');
  await placeAccepted(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '35' }, [buy35]);
  await expect(orderRow(page, 'A1003', 'Buy', 'MSFT', 35).getByRole('cell', { name: 'US$14,700.00', exact: true })).toBeVisible();

  await placeRejected(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '1' }, [buy35], /insufficient available cash/i);
  await expect(estimateValue(page, 'Available cash')).toHaveText('US$300.00');

  await expectClientAccountCash(page, 'Eleanor Whitfield', { A1001: '$25,000.00', A1002: '$10,000.00' });

  await reloadAndReturnToOrders(page);
  await expectOrders(page, [buy35]);
});

caseTest('WM-TC-030', async ({ page }) => {
  await openArea(page, 'orders');
  await expectOrders(page, []);

  const buy5 = row(A1001, 'Buy', 'RY', 5, 'Open');
  await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '5' }, [buy5]);

  const alert = await placeRejected(page, { account: A1001, side: 'Sell', symbol: 'RY', quantity: '101' }, [buy5], /available|exceeds/i);
  await expect(alert).toContainText(/\b100\b/);

  const id = await cancel(page, A1001, 'Buy', 'RY', 5);
  await expectOrders(page, [row(A1001, 'Buy', 'RY', 5, 'Cancelled')]);

  const expectAuditHistory = async () => {
    await expect(auditTrail(page)).toBeVisible();
    const entries = orderAuditEntries(page);
    await expect(entries).toHaveCount(2);
    // Feed is newest first: the cancellation, then the placement.
    await expect(entries.nth(0)).toContainText('order.cancelled');
    await expect(entries.nth(0)).toContainText(id);
    await expect(entries.nth(0)).toContainText('Cancelled Buy 5 RY in A1001');
    await expect(entries.nth(1)).toContainText('order.created');
    await expect(entries.nth(1)).toContainText(id);
    await expect(entries.nth(1)).toContainText('Buy 5 RY @ 140.00 in A1001');
    const times = await entries.locator('time').evaluateAll((els) => els.map((el) => el.getAttribute('datetime') ?? ''));
    expect(Date.parse(times[1])).toBeLessThanOrEqual(Date.parse(times[0]));
    await expect(auditTrail(page).getByText(/Sell 101/)).toHaveCount(0);
  };
  await expectAuditHistory();

  await page.reload();
  await page.waitForLoadState('load');
  await expect(blotter(page)).toBeVisible();
  await expectAuditHistory();
});

gapTest(
  'WM-GAP-040',
  {
    title: 'A failed workspace data request shows a clear error state, and Retry after recovery restores real data and usable controls',
    area: 'orders',
    wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2'
  },
  async ({ page }) => {
    await openArea(page, 'orders');
    const buy10 = row(A1001, 'Buy', 'RY', 10, 'Open');
    await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '10' }, [buy10]);

    let aborted = 0;
    const failBootstrap = async (route: import('@playwright/test').Route) => {
      aborted += 1;
      await route.abort('connectionrefused');
    };
    await page.route('**/api/workflows/bootstrap', failBootstrap);
    await page.reload();
    await page.waitForLoadState('load');

    const main = page.getByRole('tabpanel');
    await expect(main.getByRole('alert')).toContainText('Workspace data couldn’t be loaded');
    await expect(main.getByRole('alert')).toContainText('The workspace service could not be reached');
    await expect(main.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(ticket(page)).toHaveCount(0);
    await expect(blotter(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Refresh data' })).toBeDisabled();
    expect(aborted).toBeGreaterThan(0);

    await page.unroute('**/api/workflows/bootstrap', failBootstrap);
    await main.getByRole('button', { name: 'Retry' }).click();

    await expect(main.getByRole('alert')).toHaveCount(0);
    await expect(main.getByText('Workspace data couldn’t be loaded')).toHaveCount(0);
    await expectOrders(page, [buy10]);
    await expect(page.getByRole('button', { name: 'Refresh data' })).toBeEnabled();
    await expect(orderAuditEntries(page)).toHaveCount(1);

    const buy5 = row(A1001, 'Buy', 'RY', 5, 'Open');
    await placeAccepted(page, { account: A1001, side: 'Buy', symbol: 'RY', quantity: '5' }, [buy10, buy5]);
    await cancel(page, A1001, 'Buy', 'RY', 5);
    await expectOrders(page, [buy10, row(A1001, 'Buy', 'RY', 5, 'Cancelled')]);
  }
);
