import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, journeyStep, openArea } from '../tooling/fixtures';

const ACCOUNT_LABELS: Record<string, string> = {
  A1001: 'Whitfield Investment (A1001)',
  A1002: 'Whitfield Savings (A1002)',
  A1003: 'Chen USD Investment (A1003)'
};

type OrderInput = { account: string; side: 'Buy' | 'Sell'; symbol: string; quantity: string };

const ticket = (page: Page) => page.getByRole('region', { name: 'New order' });
const blotter = (page: Page) => page.getByRole('region', { name: 'Orders', exact: true });
const ordersTable = (page: Page) => page.getByRole('table', { name: 'Orders', exact: true });
const orderRows = (page: Page) => ordersTable(page).getByRole('row').filter({ has: page.getByRole('rowheader') });
const auditEntries = (page: Page) =>
  page.getByRole('complementary', { name: 'Audit trail' }).getByRole('list', { name: 'Audit entries' }).getByRole('listitem');
const areaTab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}(\\s|$)`) });

const estimate = (page: Page, term: string) =>
  ticket(page).locator('dl[aria-label="Order estimate"]')
    .locator('dt', { hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::dd[1]');

function orderRow(page: Page, o: { account: string; side: string; symbol: string; quantity: number; status?: string }) {
  let row = orderRows(page)
    .filter({ hasText: ACCOUNT_LABELS[o.account] })
    .filter({ has: page.getByRole('cell', { name: o.side, exact: true }) })
    .filter({ has: page.getByRole('cell', { name: o.symbol, exact: true }) })
    .filter({ has: page.getByRole('cell', { name: String(o.quantity), exact: true }) });
  if (o.status) row = row.filter({ has: page.getByRole('cell', { name: o.status, exact: true }) });
  return row;
}

async function expectOrderCells(row: Locator, o: { account: string; side: string; symbol: string; quantity: string; status: string }) {
  const cells = row.getByRole('cell');
  await expect(cells.nth(0)).toHaveText(ACCOUNT_LABELS[o.account]);
  await expect(cells.nth(1)).toHaveText(o.symbol);
  await expect(cells.nth(2)).toHaveText(o.side);
  await expect(cells.nth(3)).toHaveText(o.quantity);
  await expect(cells.nth(6)).toHaveText(o.status);
}

async function chooseAccount(page: Page, account: string) {
  const select = ticket(page).getByLabel('Account');
  await select.click();
  await select.selectOption(account);
  await expect(select).toHaveValue(account);
}

async function chooseInstrument(page: Page, symbol: string) {
  const select = ticket(page).getByLabel('Instrument');
  await select.click();
  await select.selectOption(symbol);
  await expect(select).toHaveValue(symbol);
}

async function chooseSide(page: Page, side: 'Buy' | 'Sell') {
  const radio = ticket(page).getByRole('radio', { name: side });
  await radio.click();
  await expect(radio).toBeChecked();
}

async function enterQuantity(page: Page, quantity: string) {
  const input = ticket(page).getByLabel('Quantity');
  await input.click();
  await input.fill(quantity);
  await expect(input).toHaveValue(quantity);
}

async function submitOrder(page: Page) {
  await ticket(page).getByRole('button', { name: 'Place order' }).click();
}

/** Fills every ticket field the way an advisor would, then submits. */
async function placeOrder(page: Page, o: OrderInput) {
  const accountSelect = ticket(page).getByLabel('Account');
  if ((await accountSelect.inputValue()) !== o.account) await chooseAccount(page, o.account);
  if ((await ticket(page).getByLabel('Instrument').inputValue()) !== o.symbol) await chooseInstrument(page, o.symbol);
  await chooseSide(page, o.side);
  await enterQuantity(page, o.quantity);
  await submitOrder(page);
}

async function expectAccepted(page: Page, o: OrderInput) {
  await expect(ticket(page).getByRole('status')).toContainText(
    new RegExp(`${o.side} order \\S+ for ${o.quantity} ${o.symbol} placed in ${escape(ACCOUNT_LABELS[o.account])}\\. Status: Open\\.`)
  );
  await expect(orderRow(page, { ...o, quantity: Number(o.quantity), status: 'Open' })).toHaveCount(1);
}

async function expectRejected(page: Page, message: RegExp) {
  await expect(ticket(page).getByRole('alert')).toContainText(message);
  await expect(ticket(page).getByRole('status')).toHaveCount(0);
}

async function cancelOrderRow(page: Page, row: Locator) {
  const id = (await row.getByRole('rowheader').innerText()).trim();
  await row.getByRole('button', { name: `Cancel order ${id}` }).click();
  await expect(blotter(page).getByRole('status')).toHaveText(`Order ${id} cancelled.`);
  return id;
}

async function reloadAndReturnToOrders(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  await areaTab(page, 'Orders').click();
  await expect(areaTab(page, 'Orders')).toHaveAttribute('aria-selected', 'true');
  await expect(ticket(page)).toBeVisible();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function openAuditHistory(page: Page) {
  const audit = page.getByRole('complementary', { name: 'Audit trail' });
  await audit.scrollIntoViewIfNeeded();
  await audit.hover();
  await expect(audit).toBeVisible();
}

async function clientAccountRow(page: Page, client: string, accountName: string, accountId: string) {
  return page.getByRole('table', { name: `Accounts for ${client}` }).getByRole('row', { name: new RegExp(`${accountName} ${accountId}`) });
}

caseTest('WM-TC-019', async ({ page }) => {
  await openArea(page, 'orders');
  await expect(ticket(page)).toBeVisible();
  await expect(orderRows(page)).toHaveCount(0);
  await expect(ordersTable(page)).toContainText('No orders yet.');

  const order: OrderInput = { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '10' };
  await placeOrder(page, order);
  await expectAccepted(page, order);
  await expect(orderRows(page)).toHaveCount(1);
  await expectOrderCells(orderRows(page).first(), { ...order, status: 'Open' });

  await reloadAndReturnToOrders(page);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 10, status: 'Open' })).toHaveCount(1);

  await openAuditHistory(page);
  await expect(auditEntries(page).filter({ hasText: 'order.created' }).filter({ hasText: 'Buy 10 RY @ 140.00 in A1001' })).toHaveCount(1);
});

caseTest('WM-TC-020', async ({ page }) => {
  await openArea(page, 'orders');
  const order: OrderInput = { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '40' };
  await placeOrder(page, order);
  await expectAccepted(page, order);

  await expect(estimate(page, 'Held in account')).toHaveText('100 RY');
  await expect(estimate(page, 'Available to sell')).toHaveText('60 RY');

  await areaTab(page, 'Portfolio').click();
  const filters = page.getByRole('region', { name: 'Filters' });
  await filters.getByLabel('Account').click();
  await filters.getByLabel('Account').selectOption('A1001');
  const ry = page.getByRole('table', { name: 'Holdings' }).getByRole('row', { name: /^RY / });
  await expect(ry).toHaveCount(1);
  await expect(ry.getByRole('cell').nth(1)).toHaveText(ACCOUNT_LABELS.A1001);
  await expect(ry.getByRole('cell').nth(3)).toHaveText('100');

  await reloadAndReturnToOrders(page);
  await expect(orderRow(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 40, status: 'Open' })).toHaveCount(1);
});

caseTest('WM-TC-021', async ({ page }) => {
  await openArea(page, 'orders');
  const sell = (quantity: string): OrderInput => ({ account: 'A1001', side: 'Sell', symbol: 'RY', quantity });

  await placeOrder(page, sell('70'));
  await expectAccepted(page, sell('70'));
  await expect(estimate(page, 'Available to sell')).toHaveText('30 RY');

  await placeOrder(page, sell('50'));
  await expectRejected(page, /\b30\b.*shares|shares.*\b30\b/i);
  await expect(orderRows(page)).toHaveCount(1);

  await expect(orderRow(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 70, status: 'Open' })).toHaveCount(1);

  await reloadAndReturnToOrders(page);
  await expect(orderRows(page)).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 70, status: 'Open' })).toHaveCount(1);

  await placeOrder(page, sell('30'));
  await expectAccepted(page, sell('30'));
  await expect(estimate(page, 'Available to sell')).toHaveText('0 RY');

  await placeOrder(page, sell('1'));
  await expectRejected(page, /\b0\b.*shares|shares.*\b0\b/i);
  await expect(orderRows(page)).toHaveCount(2);
  await expect(orderRow(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 70, status: 'Open' })).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 30, status: 'Open' })).toHaveCount(1);

  await areaTab(page, 'Portfolio').click();
  const filters = page.getByRole('region', { name: 'Filters' });
  await filters.getByLabel('Account').click();
  await filters.getByLabel('Account').selectOption('A1001');
  const ry = page.getByRole('table', { name: 'Holdings' }).getByRole('row', { name: /^RY / });
  await expect(ry.getByRole('cell').nth(3)).toHaveText('100');
});

caseTest('WM-TC-022', async ({ page }) => {
  await openArea(page, 'orders');
  const sell = (quantity: string): OrderInput => ({ account: 'A1001', side: 'Sell', symbol: 'RY', quantity });

  await placeOrder(page, sell('70'));
  await expectAccepted(page, sell('70'));

  await placeOrder(page, sell('31'));
  await expectRejected(page, /\b30\b.*shares|shares.*\b30\b/i);
  await expect(orderRows(page)).toHaveCount(1);

  const sell70 = orderRow(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 70 });
  await cancelOrderRow(page, sell70);
  await expect(sell70.getByRole('cell').nth(6)).toHaveText('Cancelled');

  await placeOrder(page, sell('100'));
  await expectAccepted(page, sell('100'));

  await reloadAndReturnToOrders(page);
  await expect(orderRow(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 70, status: 'Cancelled' })).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 100, status: 'Open' })).toHaveCount(1);
});

caseTest('WM-TC-023', async ({ page }) => {
  await openArea(page, 'orders');
  const buy = (quantity: string): OrderInput => ({ account: 'A1001', side: 'Buy', symbol: 'RY', quantity });

  await placeOrder(page, buy('179'));
  await expect(estimate(page, 'Estimated value')).toHaveText('$25,060.00');
  await expect(estimate(page, 'Available cash')).toHaveText('$25,000.00');
  await expectRejected(page, /insufficient available cash/i);
  await expect(orderRows(page)).toHaveCount(0);

  await expect(ordersTable(page)).toContainText('No orders yet.');
  await areaTab(page, 'Clients').click();
  await page.getByRole('button', { name: 'Eleanor Whitfield' }).click();
  const a1001 = await clientAccountRow(page, 'Eleanor Whitfield', 'Whitfield Investment', 'A1001');
  await expect(a1001.getByRole('cell').nth(1)).toHaveText('$25,000.00');

  await areaTab(page, 'Orders').click();
  await placeOrder(page, buy('178'));
  await expectAccepted(page, buy('178'));
  const row = orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 178, status: 'Open' });
  await expect(row.getByRole('cell').nth(5)).toHaveText('$24,920.00');

  await reloadAndReturnToOrders(page);
  await expect(orderRows(page)).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 178, status: 'Open' })).toHaveCount(1);
});

caseTest('WM-TC-024', async ({ page }) => {
  await openArea(page, 'orders');
  const buy = (quantity: string): OrderInput => ({ account: 'A1001', side: 'Buy', symbol: 'RY', quantity });

  await placeOrder(page, buy('100'));
  await expectAccepted(page, buy('100'));

  await expect(ticket(page).getByLabel('Account')).toHaveValue('A1001');
  await expect(ticket(page).getByRole('radio', { name: 'Buy' })).toBeChecked();
  await expect(ticket(page).getByLabel('Instrument')).toHaveValue('RY');
  await expect(estimate(page, 'Available cash')).toHaveText('$11,000.00');

  await enterQuantity(page, '80');
  await submitOrder(page);
  await expectRejected(page, /insufficient available cash/i);
  await expect(orderRows(page)).toHaveCount(1);

  await enterQuantity(page, '78');
  await submitOrder(page);
  await expectAccepted(page, buy('78'));

  await reloadAndReturnToOrders(page);
  await expect(orderRows(page)).toHaveCount(2);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 100, status: 'Open' })).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 78, status: 'Open' })).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 80 })).toHaveCount(0);
});

caseTest('WM-TC-025', async ({ page }) => {
  await openArea(page, 'orders');
  await chooseAccount(page, 'A1001');
  await chooseSide(page, 'Buy');
  await chooseInstrument(page, 'RY');

  const attempt = async (quantity: string, message: RegExp) => {
    await enterQuantity(page, quantity);
    await submitOrder(page);
    await expectRejected(page, message);
    await expect(orderRows(page)).toHaveCount(0);
  };

  await attempt('0', /positive whole number of shares/i);
  await attempt('-5', /positive whole number of shares/i);
  await attempt('2.5', /fractional shares/i);
  await attempt('', /positive whole number of shares/i);
  await attempt('ten', /positive whole number of shares/i);

  await reloadAndReturnToOrders(page);
  await expect(orderRows(page)).toHaveCount(0);
  await expect(ordersTable(page)).toContainText('No orders yet.');
  await chooseAccount(page, 'A1001');
  await expect(estimate(page, 'Available cash')).toHaveText('$25,000.00');
});

caseTest('WM-TC-026', async ({ page }) => {
  await openArea(page, 'orders');
  const instrument = ticket(page).getByLabel('Instrument');
  const options = instrument.locator('option');

  await chooseAccount(page, 'A1002');
  await expect(options).toHaveText(['Select an instrument', 'BMO · Bank of Montreal']);
  await chooseInstrument(page, 'BMO');

  await chooseAccount(page, 'A1003');
  await expect(options).toHaveText(['Select an instrument', 'MSFT · Microsoft Corporation']);
  await expect(instrument).toHaveValue('');

  await chooseAccount(page, 'A1001');
  await expect(options).toHaveText(['Select an instrument', 'RY · Royal Bank of Canada']);

  await expect(orderRows(page)).toHaveCount(0);
  await expect(ordersTable(page)).toContainText('No orders yet.');
});

caseTest('WM-TC-027', async ({ page }) => {
  await openArea(page, 'orders');
  const order: OrderInput = { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '5' };
  await placeOrder(page, order);
  await expectAccepted(page, order);

  const row = orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 5 });
  const id = await cancelOrderRow(page, row);
  await expect(row.getByRole('cell').nth(6)).toHaveText('Cancelled');

  await expect(row.getByRole('button', { name: `Cancel order ${id}` })).toHaveCount(0);
  await expect(row.getByRole('cell').nth(6)).toHaveText('Cancelled');

  await reloadAndReturnToOrders(page);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 5, status: 'Cancelled' })).toHaveCount(1);

  await openAuditHistory(page);
  await expect(auditEntries(page).filter({ hasText: 'order.cancelled' }).filter({ hasText: id })).toHaveCount(1);
});

caseTest('WM-TC-028', async ({ page }) => {
  await openArea(page, 'orders');
  const buy = (quantity: string): OrderInput => ({ account: 'A1001', side: 'Buy', symbol: 'RY', quantity });

  await placeOrder(page, buy('150'));
  await expectAccepted(page, buy('150'));

  await placeOrder(page, buy('30'));
  await expectRejected(page, /insufficient available cash/i);
  await expect(estimate(page, 'Available cash')).toHaveText('$4,000.00');
  await expect(orderRows(page)).toHaveCount(1);

  const buy150 = orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 150 });
  await cancelOrderRow(page, buy150);
  await expect(buy150.getByRole('cell').nth(6)).toHaveText('Cancelled');

  await placeOrder(page, buy('178'));
  await expectAccepted(page, buy('178'));

  await reloadAndReturnToOrders(page);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 150, status: 'Cancelled' })).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 178, status: 'Open' })).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 30 })).toHaveCount(0);
  await expect(orderRows(page)).toHaveCount(2);
});

caseTest('WM-TC-029', async ({ page }) => {
  await openArea(page, 'orders');
  const buy = (quantity: string): OrderInput => ({ account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity });

  await chooseAccount(page, 'A1003');
  await chooseInstrument(page, 'MSFT');
  await chooseSide(page, 'Buy');
  await enterQuantity(page, '35');
  await expect(estimate(page, 'Estimated value')).toHaveText('US$14,700.00');
  await submitOrder(page);
  await expectAccepted(page, buy('35'));
  const row = orderRow(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: 35, status: 'Open' });
  await expect(row.getByRole('cell').nth(5)).toHaveText('US$14,700.00');

  await placeOrder(page, buy('1'));
  await expectRejected(page, /insufficient available cash/i);
  await expect(estimate(page, 'Available cash')).toHaveText('US$300.00');
  await expect(orderRows(page)).toHaveCount(1);

  await areaTab(page, 'Clients').click();
  await page.getByRole('button', { name: 'Eleanor Whitfield' }).click();
  await expect((await clientAccountRow(page, 'Eleanor Whitfield', 'Whitfield Investment', 'A1001')).getByRole('cell').nth(1)).toHaveText('$25,000.00');
  await expect((await clientAccountRow(page, 'Eleanor Whitfield', 'Whitfield Savings', 'A1002')).getByRole('cell').nth(1)).toHaveText('$10,000.00');

  await reloadAndReturnToOrders(page);
  await expect(orderRows(page)).toHaveCount(1);
  await expect(orderRow(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: 35, status: 'Open' })).toHaveCount(1);
});

caseTest('WM-TC-030', async ({ page }) => {
  await openArea(page, 'orders');
  const buy: OrderInput = { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '5' };
  await placeOrder(page, buy);
  await expectAccepted(page, buy);

  await placeOrder(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '101' });
  await expectRejected(page, /\b100\b/);
  await expect(orderRows(page)).toHaveCount(1);

  const row = orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 5 });
  const id = await cancelOrderRow(page, row);
  await expect(row.getByRole('cell').nth(6)).toHaveText('Cancelled');

  const expectTwoEntries = async () => {
    const entries = auditEntries(page);
    await expect(entries).toHaveCount(2);
    // The feed lists newest first: the cancellation follows the placement.
    await expect(entries.nth(0)).toContainText('order.cancelled');
    await expect(entries.nth(0)).toContainText(id);
    await expect(entries.nth(0)).toContainText('Cancelled Buy 5 RY in A1001');
    await expect(entries.nth(1)).toContainText('order.created');
    await expect(entries.nth(1)).toContainText(id);
    await expect(entries.nth(1)).toContainText('Buy 5 RY @ 140.00 in A1001');
    await expect(page.getByRole('complementary', { name: 'Audit trail' })).not.toContainText('Sell 101');
  };

  await openAuditHistory(page);
  await expectTwoEntries();

  await reloadAndReturnToOrders(page);
  await openAuditHistory(page);
  await expectTwoEntries();
});

caseTest('WM-TC-052', async ({ page }) => {
  await openArea(page, 'clients');
  const filters = page.getByRole('region', { name: 'Filters' });
  const holdings = page.getByRole('table', { name: 'Holdings' });
  const cashTable = page.getByRole('table', { name: 'Cash by account' });
  let orderId = '';

  const expectA1001Review = async () => {
    const ry = holdings.getByRole('row', { name: /^RY / });
    await expect(holdings.getByRole('row').filter({ has: page.getByRole('rowheader') })).toHaveCount(1);
    await expect(ry.getByRole('cell').nth(1)).toHaveText(ACCOUNT_LABELS.A1001);
    await expect(ry.getByRole('cell').nth(3)).toHaveText('100');
    const cash = cashTable.getByRole('row', { name: /Whitfield Investment A1001/ }).getByRole('cell');
    await expect(cash.nth(1)).toHaveText('CAD');
    await expect(cash.nth(2)).toHaveText('$25,000.00');
    await expect(cash.nth(3)).toHaveText('$0.00');
    await expect(cash.nth(4)).toHaveText('$25,000.00');
  };

  await journeyStep(page, 'Search the client book for C1001', async () => {
    const search = page.getByLabel('Search clients');
    await search.click();
    await search.fill('C1001');
    const clients = page.getByRole('table', { name: 'Clients', exact: true });
    await expect(clients.getByRole('row').filter({ has: page.getByRole('rowheader') })).toHaveCount(1);
    await expect(clients.getByRole('button', { name: 'Eleanor Whitfield' })).toBeVisible();
    await expect(page.getByText('1 of 2 clients')).toBeVisible();
  });

  await journeyStep(page, 'Open Eleanor Whitfield and view her portfolio', async () => {
    await page.getByRole('button', { name: 'Eleanor Whitfield' }).click();
    await page.getByRole('button', { name: 'View portfolio' }).click();
    await expect(areaTab(page, 'Portfolio')).toHaveAttribute('aria-selected', 'true');
    await expect(filters.getByLabel('Client')).toHaveValue('C1001');
    await expect(filters.getByLabel('Account').locator('option')).toHaveText([
      'All accounts',
      'Whitfield Investment (A1001) · CAD',
      'Whitfield Savings (A1002) · CAD'
    ]);
    const cashRows = cashTable.getByRole('row').filter({ has: page.getByRole('rowheader') });
    await expect(cashRows).toHaveCount(2);
    for (const row of await cashRows.all()) await expect(row.getByRole('cell').nth(1)).toHaveText('CAD');
  });

  await journeyStep(page, 'Choose account A1001 in the portfolio', async () => {
    await filters.getByLabel('Account').click();
    await filters.getByLabel('Account').selectOption('A1001');
    await expectA1001Review();
  });

  await journeyStep(page, 'Switch to the Orders workspace', async () => {
    await areaTab(page, 'Orders').click();
    await expect(areaTab(page, 'Orders')).toHaveAttribute('aria-selected', 'true');
    await expect(ticket(page)).toBeVisible();
    await expect(orderRows(page)).toHaveCount(0);
    await expect(ordersTable(page)).toContainText('No orders yet.');
  });

  await journeyStep(page, 'Choose account A1001 Whitfield Investment on the ticket', async () => {
    await chooseAccount(page, 'A1001');
    await expect(ticket(page).getByLabel('Account').locator('option:checked')).toHaveText('Whitfield Investment (A1001) · CAD');
    await expect(estimate(page, 'Available cash')).toHaveText('$25,000.00');
  });

  await journeyStep(page, 'Choose instrument RY', async () => {
    await chooseInstrument(page, 'RY');
    await expect(estimate(page, 'Indicative price')).toHaveText('$140.00');
    await expect(estimate(page, 'Held in account')).toHaveText('100 RY');
  });

  await journeyStep(page, 'Choose Buy and enter quantity 10', async () => {
    await chooseSide(page, 'Buy');
    await enterQuantity(page, '10');
    await expect(estimate(page, 'Estimated value')).toHaveText('$1,400.00');
    await expect(orderRows(page)).toHaveCount(0);
  });

  await journeyStep(page, 'Place the buy order', async () => {
    await submitOrder(page);
    await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '10' });
    await expect(orderRows(page)).toHaveCount(1);
    orderId = (await orderRows(page).first().getByRole('rowheader').innerText()).trim();
    await expect(estimate(page, 'Available cash')).toHaveText('$23,600.00');
    await expect(estimate(page, 'Held in account')).toHaveText('100 RY');
  });

  await journeyStep(page, 'Filter the blotter to Open orders', async () => {
    const status = blotter(page).getByLabel('Order status');
    await status.click();
    await status.selectOption('Open');
    await expect(orderRows(page)).toHaveCount(1);
    await expect(orderRows(page).first().getByRole('rowheader')).toHaveText(orderId);
    await expect(orderRows(page).first().getByRole('cell').nth(6)).toHaveText('Open');
  });

  await journeyStep(page, 'Search orders for RY', async () => {
    const search = blotter(page).getByLabel('Search orders');
    await search.click();
    await search.fill('RY');
    const row = orderRows(page).first();
    await expect(orderRows(page)).toHaveCount(1);
    await expect(row.getByRole('rowheader')).toHaveText(orderId);
    await expect(row.getByRole('cell').nth(0)).toHaveText(ACCOUNT_LABELS.A1001);
    await expect(row.getByRole('cell').nth(3)).toHaveText('10');
    await expect(row.getByRole('cell').nth(5)).toHaveText('$1,400.00');
  });

  await journeyStep(page, 'Cancel the order from its row', async () => {
    await orderRows(page).first().getByRole('button', { name: `Cancel order ${orderId}` }).click();
    await expect(blotter(page).getByRole('status')).toHaveText(`Order ${orderId} cancelled.`);
    await expect(orderRows(page)).toHaveCount(0);
    await expect(ordersTable(page)).toContainText('No orders match these filters.');
  });

  await journeyStep(page, 'Filter the blotter to Cancelled orders', async () => {
    const status = blotter(page).getByLabel('Order status');
    await status.click();
    await status.selectOption('Cancelled');
    await expect(orderRows(page)).toHaveCount(1);
    const row = orderRows(page).first();
    await expect(row.getByRole('rowheader')).toHaveText(orderId);
    await expect(row.getByRole('cell').nth(3)).toHaveText('10');
    await expect(row.getByRole('cell').nth(6)).toHaveText('Cancelled');
    await expect(blotter(page).getByText('1 of 1 orders')).toBeVisible();
  });

  await journeyStep(page, 'Return to the Portfolio workspace', async () => {
    await areaTab(page, 'Portfolio').click();
    await expect(areaTab(page, 'Portfolio')).toHaveAttribute('aria-selected', 'true');
    await expect(filters).toBeVisible();
    await expect(filters.getByLabel('Client')).toHaveValue('All');
  });

  await journeyStep(page, 'Choose client C1001 and account A1001', async () => {
    await filters.getByLabel('Client').click();
    await filters.getByLabel('Client').selectOption('C1001');
    await filters.getByLabel('Account').click();
    await filters.getByLabel('Account').selectOption('A1001');
    await expectA1001Review();
  });

  await journeyStep(page, 'Refresh data from the server', async () => {
    await page.getByRole('button', { name: 'Refresh data' }).click();
    await expect(page.getByText(/^Data loaded /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh data' })).toBeEnabled();
    await expectA1001Review();
  });
});

gapTest('WM-GAP-040', {
  title: 'Workspace recovers from a real request failure (outage) through visible error and retry',
  area: 'orders',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2'
}, async ({ page }) => {
  const unreachable = 'The workspace service could not be reached. Check your connection and try again.';
  const bootstrap = '**/api/workflows/bootstrap';
  const ordersApi = '**/api/workflows/orders';

  // Outage: the browser's requests to the workspace service fail at the network layer.
  await page.route(bootstrap, route => route.abort('connectionrefused'));
  await openArea(page, 'orders');
  const loadError = page.getByRole('alert').filter({ hasText: 'Workspace data couldn’t be loaded' });
  await expect(loadError).toBeVisible();
  await expect(loadError).toContainText(unreachable);
  await expect(ticket(page)).toHaveCount(0);

  await page.unroute(bootstrap);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(loadError).toHaveCount(0);
  await expect(ticket(page)).toBeVisible();
  await expect(ordersTable(page)).toContainText('No orders yet.');

  const order: OrderInput = { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '10' };
  await page.route(ordersApi, route => route.abort('connectionrefused'));
  await placeOrder(page, order);
  await expectRejected(page, new RegExp(escape(unreachable)));
  await expect(orderRows(page)).toHaveCount(0);
  await expect(estimate(page, 'Available cash')).toHaveText('$25,000.00');

  await page.unroute(ordersApi);
  await submitOrder(page);
  await expectAccepted(page, order);
  await expect(orderRows(page)).toHaveCount(1);
  await expect(estimate(page, 'Available cash')).toHaveText('$23,600.00');

  await page.route(bootstrap, route => route.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Refresh data' }).click();
  const refreshError = page.getByRole('alert').filter({ hasText: 'Could not refresh workspace data' });
  await expect(refreshError).toContainText(unreachable);
  await expect(orderRows(page)).toHaveCount(1);

  await page.unroute(bootstrap);
  await page.getByRole('button', { name: 'Refresh data' }).click();
  await expect(refreshError).toHaveCount(0);
  await expect(orderRow(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 10, status: 'Open' })).toHaveCount(1);
  await openAuditHistory(page);
  await expect(auditEntries(page).filter({ hasText: 'order.created' })).toHaveCount(1);
});
