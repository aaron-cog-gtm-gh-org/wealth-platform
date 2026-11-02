import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, journeyStep, openArea } from '../tooling/fixtures';

type Side = 'Buy' | 'Sell';

const tab = (page: Page, label: string) => page.getByRole('tab', { name: new RegExp(`^${label}(\\s|$)`) });
const ticket = (page: Page) => page.getByRole('form', { name: 'New order' });
const blotter = (page: Page) => page.getByRole('region', { name: 'Orders', exact: true });
const ordersTable = (page: Page) => blotter(page).getByRole('table', { name: 'Orders' });
const orderRows = (page: Page) => ordersTable(page).getByRole('row').filter({ has: page.getByRole('rowheader') });
const auditEntries = (page: Page) =>
  page.getByRole('complementary', { name: 'Audit trail' }).getByRole('list', { name: 'Audit entries' }).getByRole('listitem');

const estimate = (page: Page, label: string) =>
  ticket(page).locator(`xpath=.//dl[@aria-label="Order estimate"]/dt[normalize-space()="${label}"]/following-sibling::dd[1]`);

const exact = (text: string | number) => new RegExp(`^${String(text).replace(/[.*+?^${}()|[\]\\$]/g, '\\$&')}$`);

/** Order rows matching side, symbol and quantity (td: account, symbol, side, quantity, price, value, status). */
const orderRow = (page: Page, side: Side, symbol: string, quantity: number) =>
  orderRows(page)
    .filter({ has: page.locator('td:nth-of-type(2)', { hasText: exact(symbol) }) })
    .filter({ has: page.locator('td:nth-of-type(3)', { hasText: exact(side) }) })
    .filter({ has: page.locator('td:nth-of-type(4)', { hasText: exact(quantity) }) });

const cell = (row: Locator, index: number) => row.getByRole('cell').nth(index);

async function expectOrder(row: Locator, o: { account: string; symbol: string; side: Side; quantity: number; status: string; value?: string }) {
  await expect(row).toHaveCount(1);
  await expect(cell(row, 0)).toContainText(o.account);
  await expect(cell(row, 1)).toHaveText(o.symbol);
  await expect(cell(row, 2)).toHaveText(o.side);
  await expect(cell(row, 3)).toHaveText(String(o.quantity));
  if (o.value) await expect(cell(row, 5)).toHaveText(o.value);
  await expect(cell(row, 6)).toHaveText(o.status);
}

async function chooseAccount(page: Page, accountId: string) {
  const select = ticket(page).getByLabel('Account');
  await select.click();
  await select.selectOption(accountId);
}

async function chooseInstrument(page: Page, symbol: string) {
  const select = ticket(page).getByLabel('Instrument');
  await select.click();
  await select.selectOption(symbol);
}

async function chooseSide(page: Page, side: Side) {
  await ticket(page).getByRole('group', { name: 'Side' }).getByText(side, { exact: true }).click();
  await expect(ticket(page).getByRole('radio', { name: side })).toBeChecked();
}

async function enterQuantity(page: Page, quantity: string) {
  const input = ticket(page).getByLabel('Quantity');
  await input.click();
  await input.fill(quantity);
}

async function submit(page: Page) {
  await ticket(page).getByRole('button', { name: 'Place order' }).click();
}

async function fillTicket(page: Page, o: { account: string; side: Side; symbol: string; quantity: string }) {
  await chooseAccount(page, o.account);
  await chooseSide(page, o.side);
  await chooseInstrument(page, o.symbol);
  await enterQuantity(page, o.quantity);
}

async function placeAccepted(page: Page, o: { account: string; side: Side; symbol: string; quantity: number }) {
  await fillTicket(page, { ...o, quantity: String(o.quantity) });
  await submit(page);
  await expect(ticket(page).getByRole('status')).toContainText(`${o.side} order`);
  await expect(ticket(page).getByRole('status')).toContainText(`for ${o.quantity} ${o.symbol} placed`);
  await expect(ticket(page).getByRole('status')).toContainText('Status: Open');
  await expect(ticket(page).getByRole('alert')).toHaveCount(0);
  await expect(orderRow(page, o.side, o.symbol, o.quantity).filter({ hasText: 'Open' })).toHaveCount(1);
}

async function placeRejected(page: Page, o: { account: string; side: Side; symbol: string; quantity: string }, message: RegExp) {
  const before = await orderRows(page).count();
  await fillTicket(page, o);
  await submit(page);
  await expect(ticket(page).getByRole('alert')).toContainText(message);
  await expect(ticket(page).getByRole('status')).toHaveCount(0);
  await expect(orderRows(page)).toHaveCount(before);
}

async function cancelOrder(page: Page, row: Locator) {
  const id = (await row.getByRole('rowheader').textContent())!.trim();
  await row.getByRole('button', { name: `Cancel order ${id}` }).click();
  await expect(blotter(page).getByRole('status')).toHaveText(`Order ${id} cancelled.`);
  return id;
}

async function reloadToOrders(page: Page) {
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await tab(page, 'Orders').click();
  await expect(tab(page, 'Orders')).toHaveAttribute('aria-selected', 'true');
  await expect(ticket(page)).toBeVisible();
}

async function openAudit(page: Page) {
  const audit = page.getByRole('complementary', { name: 'Audit trail' });
  await audit.scrollIntoViewIfNeeded();
  await audit.getByRole('heading', { name: 'Audit trail' }).hover();
  await expect(audit).toContainText('Changes recorded for orders');
}

async function clientAccountRow(page: Page, clientName: string, accountId: string) {
  return page.getByRole('table', { name: `Accounts for ${clientName}` }).getByRole('row').filter({ hasText: accountId });
}

async function openClient(page: Page, clientName: string) {
  await tab(page, 'Clients').click();
  await page.getByRole('region', { name: 'Client book' }).getByRole('button', { name: clientName }).click();
  await expect(page.getByRole('region', { name: clientName })).toBeVisible();
}

async function openPortfolioAccount(page: Page, clientId: string, accountId: string) {
  await tab(page, 'Portfolio').click();
  const filters = page.getByRole('search', { name: 'Filter portfolio' });
  await filters.getByLabel('Client').click();
  await filters.getByLabel('Client').selectOption(clientId);
  await filters.getByLabel('Account').click();
  await filters.getByLabel('Account').selectOption(accountId);
}

const holdingRow = (page: Page, symbol: string) =>
  page.getByRole('table', { name: 'Holdings' }).getByRole('row').filter({ has: page.getByRole('rowheader', { name: symbol, exact: true }) });
const cashRow = (page: Page, accountId: string) =>
  page.getByRole('table', { name: 'Cash by account' }).getByRole('row').filter({ hasText: accountId });

caseTest('WM-TC-019', async ({ page }) => {
  await openArea(page, 'orders');

  await tab(page, 'Orders').click();
  await expect(ordersTable(page)).toContainText('No orders yet');
  await expect(orderRows(page)).toHaveCount(0);

  await placeAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 10 });
  await expect(estimate(page, 'Available cash')).toHaveText('$23,600.00');
  await expect(orderRows(page)).toHaveCount(1);
  await expectOrder(orderRow(page, 'Buy', 'RY', 10), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 10, status: 'Open', value: '$1,400.00' });

  await reloadToOrders(page);
  await expectOrder(orderRow(page, 'Buy', 'RY', 10), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 10, status: 'Open' });

  await openAudit(page);
  const placed = auditEntries(page).filter({ hasText: 'order.created' });
  await expect(placed).toHaveCount(1);
  await expect(placed).toContainText('Buy 10 RY');
  await expect(placed).toContainText('A1001');
});

caseTest('WM-TC-020', async ({ page }) => {
  await openArea(page, 'orders');

  await placeAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 40 });
  await expectOrder(orderRow(page, 'Sell', 'RY', 40), { account: 'A1001', symbol: 'RY', side: 'Sell', quantity: 40, status: 'Open' });

  await ticket(page).getByLabel('Instrument').click();
  await expect(ticket(page).getByLabel('Instrument')).toHaveValue('RY');
  await expect(estimate(page, 'Held in account')).toHaveText('100 RY');
  await expect(estimate(page, 'Available to sell')).toHaveText('60 RY');

  await openPortfolioAccount(page, 'C1001', 'A1001');
  await expect(cell(holdingRow(page, 'RY'), 3)).toHaveText('100');

  await reloadToOrders(page);
  await expectOrder(orderRow(page, 'Sell', 'RY', 40), { account: 'A1001', symbol: 'RY', side: 'Sell', quantity: 40, status: 'Open' });
});

caseTest('WM-TC-021', async ({ page }) => {
  await openArea(page, 'orders');

  await placeAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 70 });

  await placeRejected(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '50' }, /\b30\b/);
  await expect(estimate(page, 'Available to sell')).toHaveText('30 RY');

  await expect(orderRows(page)).toHaveCount(1);
  await expectOrder(orderRow(page, 'Sell', 'RY', 70), { account: 'A1001', symbol: 'RY', side: 'Sell', quantity: 70, status: 'Open' });

  await reloadToOrders(page);
  await expect(orderRows(page)).toHaveCount(1);
  await expectOrder(orderRow(page, 'Sell', 'RY', 70), { account: 'A1001', symbol: 'RY', side: 'Sell', quantity: 70, status: 'Open' });

  await placeAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 30 });
  await expect(estimate(page, 'Available to sell')).toHaveText('0 RY');

  await placeRejected(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '1' }, /\b0\b/);
  await expect(orderRows(page)).toHaveCount(2);
  await expectOrder(orderRow(page, 'Sell', 'RY', 70), { account: 'A1001', symbol: 'RY', side: 'Sell', quantity: 70, status: 'Open' });
  await expectOrder(orderRow(page, 'Sell', 'RY', 30), { account: 'A1001', symbol: 'RY', side: 'Sell', quantity: 30, status: 'Open' });

  await openPortfolioAccount(page, 'C1001', 'A1001');
  await expect(cell(holdingRow(page, 'RY'), 3)).toHaveText('100');
});

caseTest('WM-TC-022', async ({ page }) => {
  await openArea(page, 'orders');

  await placeAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 70 });

  await placeRejected(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '31' }, /.+/);
  await expect(estimate(page, 'Available to sell')).toHaveText('30 RY');

  await cancelOrder(page, orderRow(page, 'Sell', 'RY', 70));
  await expect(cell(orderRow(page, 'Sell', 'RY', 70), 6)).toHaveText('Cancelled');

  await placeAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: 100 });

  await reloadToOrders(page);
  await expectOrder(orderRow(page, 'Sell', 'RY', 70), { account: 'A1001', symbol: 'RY', side: 'Sell', quantity: 70, status: 'Cancelled' });
  await expectOrder(orderRow(page, 'Sell', 'RY', 100), { account: 'A1001', symbol: 'RY', side: 'Sell', quantity: 100, status: 'Open' });
});

caseTest('WM-TC-023', async ({ page }) => {
  await openArea(page, 'orders');

  await fillTicket(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '179' });
  await expect(estimate(page, 'Estimated value')).toHaveText('$25,060.00');
  await expect(estimate(page, 'Available cash')).toHaveText('$25,000.00');
  await submit(page);
  await expect(ticket(page).getByRole('alert')).toContainText(/insufficient available cash/i);
  await expect(ticket(page).getByRole('status')).toHaveCount(0);

  await expect(orderRows(page)).toHaveCount(0);
  await openClient(page, 'Eleanor Whitfield');
  await expect(cell(await clientAccountRow(page, 'Eleanor Whitfield', 'A1001'), 1)).toHaveText('$25,000.00');

  await tab(page, 'Orders').click();
  await fillTicket(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '178' });
  await expect(estimate(page, 'Estimated value')).toHaveText('$24,920.00');
  await submit(page);
  await expect(ticket(page).getByRole('status')).toContainText('Status: Open');
  await expectOrder(orderRow(page, 'Buy', 'RY', 178), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 178, status: 'Open', value: '$24,920.00' });

  await reloadToOrders(page);
  await expect(orderRows(page)).toHaveCount(1);
  await expectOrder(orderRow(page, 'Buy', 'RY', 178), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 178, status: 'Open' });
});

caseTest('WM-TC-024', async ({ page }) => {
  await openArea(page, 'orders');

  await placeAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 100 });

  await chooseAccount(page, 'A1001');
  await chooseSide(page, 'Buy');
  await chooseInstrument(page, 'RY');
  await expect(estimate(page, 'Available cash')).toHaveText('$11,000.00');

  await enterQuantity(page, '80');
  await submit(page);
  await expect(ticket(page).getByRole('alert')).toContainText(/insufficient available cash/i);
  await expect(orderRows(page)).toHaveCount(1);

  await enterQuantity(page, '78');
  await submit(page);
  await expect(ticket(page).getByRole('status')).toContainText('Status: Open');
  await expectOrder(orderRow(page, 'Buy', 'RY', 78), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 78, status: 'Open' });

  await reloadToOrders(page);
  await expect(orderRows(page)).toHaveCount(2);
  await expectOrder(orderRow(page, 'Buy', 'RY', 100), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 100, status: 'Open' });
  await expectOrder(orderRow(page, 'Buy', 'RY', 78), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 78, status: 'Open' });
  await expect(orderRow(page, 'Buy', 'RY', 80)).toHaveCount(0);
});

caseTest('WM-TC-025', async ({ page }) => {
  await openArea(page, 'orders');

  await placeRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '0' }, /positive whole number/i);
  await placeRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '-5' }, /positive whole number/i);
  await placeRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '2.5' }, /fractional shares/i);
  await placeRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '' }, /positive whole number/i);
  await placeRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 'ten' }, /positive whole number/i);
  await expect(orderRows(page)).toHaveCount(0);

  await reloadToOrders(page);
  await expect(orderRows(page)).toHaveCount(0);
  await expect(ordersTable(page)).toContainText('No orders yet');
  await chooseAccount(page, 'A1001');
  await expect(estimate(page, 'Available cash')).toHaveText('$25,000.00');
});

caseTest('WM-TC-026', async ({ page }) => {
  await openArea(page, 'orders');
  const instrument = ticket(page).getByLabel('Instrument');
  const offered = instrument.locator('option:not([value=""])');

  await chooseAccount(page, 'A1002');
  await expect(offered).toHaveText(['BMO · Bank of Montreal']);
  await chooseInstrument(page, 'BMO');
  await expect(instrument).toHaveValue('BMO');

  await chooseAccount(page, 'A1003');
  await expect(offered).toHaveText(['MSFT · Microsoft Corporation']);
  await expect(instrument).toHaveValue('');

  await chooseAccount(page, 'A1001');
  await expect(offered).toHaveText(['RY · Royal Bank of Canada']);

  await blotter(page).getByLabel('Order status').click();
  await expect(orderRows(page)).toHaveCount(0);
  await expect(ordersTable(page)).toContainText('No orders yet');
});

caseTest('WM-TC-027', async ({ page }) => {
  await openArea(page, 'orders');

  await placeAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 5 });
  const row = orderRow(page, 'Buy', 'RY', 5);

  const id = await cancelOrder(page, row);
  await expect(cell(row, 6)).toHaveText('Cancelled');

  await row.getByRole('rowheader').click();
  await expect(row.getByRole('button', { name: /cancel/i })).toHaveCount(0);
  await expect(cell(row, 6)).toHaveText('Cancelled');

  await reloadToOrders(page);
  await expectOrder(orderRow(page, 'Buy', 'RY', 5), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 5, status: 'Cancelled' });

  await openAudit(page);
  await expect(auditEntries(page).filter({ hasText: 'order.cancelled' }).filter({ hasText: id })).toHaveCount(1);
});

caseTest('WM-TC-028', async ({ page }) => {
  await openArea(page, 'orders');

  await placeAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 150 });

  await placeRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '30' }, /insufficient available cash/i);
  await expect(estimate(page, 'Available cash')).toHaveText('$4,000.00');

  await cancelOrder(page, orderRow(page, 'Buy', 'RY', 150));
  await expect(cell(orderRow(page, 'Buy', 'RY', 150), 6)).toHaveText('Cancelled');

  await placeAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 178 });

  await reloadToOrders(page);
  await expectOrder(orderRow(page, 'Buy', 'RY', 150), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 150, status: 'Cancelled' });
  await expectOrder(orderRow(page, 'Buy', 'RY', 178), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 178, status: 'Open' });
  await expect(orderRow(page, 'Buy', 'RY', 30)).toHaveCount(0);
});

caseTest('WM-TC-029', async ({ page }) => {
  await openArea(page, 'orders');

  await fillTicket(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '35' });
  await expect(estimate(page, 'Estimated value')).toHaveText('US$14,700.00');
  await submit(page);
  await expect(ticket(page).getByRole('status')).toContainText('Status: Open');
  await expectOrder(orderRow(page, 'Buy', 'MSFT', 35), { account: 'A1003', symbol: 'MSFT', side: 'Buy', quantity: 35, status: 'Open', value: 'US$14,700.00' });

  await placeRejected(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '1' }, /insufficient available cash/i);
  await expect(estimate(page, 'Available cash')).toHaveText('US$300.00');

  await openClient(page, 'Eleanor Whitfield');
  await expect(cell(await clientAccountRow(page, 'Eleanor Whitfield', 'A1001'), 1)).toHaveText('$25,000.00');
  await expect(cell(await clientAccountRow(page, 'Eleanor Whitfield', 'A1002'), 1)).toHaveText('$10,000.00');

  await reloadToOrders(page);
  await expect(orderRows(page)).toHaveCount(1);
  await expectOrder(orderRow(page, 'Buy', 'MSFT', 35), { account: 'A1003', symbol: 'MSFT', side: 'Buy', quantity: 35, status: 'Open' });
});

caseTest('WM-TC-030', async ({ page }) => {
  await openArea(page, 'orders');

  await placeAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 5 });

  await placeRejected(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '101' }, /.+/);
  await expect(estimate(page, 'Available to sell')).toHaveText('100 RY');

  const id = await cancelOrder(page, orderRow(page, 'Buy', 'RY', 5));
  await expect(cell(orderRow(page, 'Buy', 'RY', 5), 6)).toHaveText('Cancelled');

  const expectAudit = async () => {
    const entries = auditEntries(page);
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText('order.cancelled');
    await expect(entries.nth(0)).toContainText(id);
    await expect(entries.nth(1)).toContainText('order.created');
    await expect(entries.nth(1)).toContainText('Buy 5 RY');
    await expect(entries.filter({ hasText: 'Sell 101' })).toHaveCount(0);
  };
  await openAudit(page);
  await expectAudit();

  await reloadToOrders(page);
  await openAudit(page);
  await expectAudit();
});

caseTest('WM-TC-052', async ({ page }) => {
  await openArea(page, 'clients');
  const clientRows = page.getByRole('table', { name: 'Clients' }).getByRole('row').filter({ has: page.getByRole('rowheader') });
  const portfolioFilters = page.getByRole('search', { name: 'Filter portfolio' });
  let orderId = '';

  await journeyStep(page, 'Search the client book for C1001', async () => {
    const search = page.getByRole('search', { name: 'Filter clients' }).getByLabel('Search clients');
    await search.click();
    await search.fill('C1001');
    await expect(clientRows).toHaveCount(1);
    await expect(clientRows.first()).toContainText('Eleanor Whitfield');
  });

  await journeyStep(page, 'Open Eleanor Whitfield and view her portfolio', async () => {
    await page.getByRole('region', { name: 'Client book' }).getByRole('button', { name: 'Eleanor Whitfield' }).click();
    await page.getByRole('region', { name: 'Eleanor Whitfield' }).getByRole('button', { name: 'View portfolio' }).click();
    await expect(tab(page, 'Portfolio')).toHaveAttribute('aria-selected', 'true');
    await expect(portfolioFilters.getByLabel('Client')).toHaveValue('C1001');
    const cashRows = page.getByRole('table', { name: 'Cash by account' }).getByRole('row').filter({ has: page.getByRole('rowheader') });
    await expect(cashRows).toHaveCount(2);
    await expect(cashRows.filter({ hasText: 'A1001' })).toHaveCount(1);
    await expect(cashRows.filter({ hasText: 'A1002' })).toHaveCount(1);
    for (const row of await cashRows.all()) await expect(cell(row, 1)).toHaveText('CAD');
  });

  await journeyStep(page, 'Scope the portfolio to A1001', async () => {
    await portfolioFilters.getByLabel('Account').click();
    await portfolioFilters.getByLabel('Account').selectOption('A1001');
    await expect(cell(holdingRow(page, 'RY'), 3)).toHaveText('100');
    await expect(cell(cashRow(page, 'A1001'), 2)).toHaveText('$25,000.00');
    await expect(cell(cashRow(page, 'A1001'), 3)).toHaveText('$0.00');
  });

  await journeyStep(page, 'Open the Orders workspace', async () => {
    await tab(page, 'Orders').click();
    await expect(ticket(page)).toBeVisible();
    await expect(orderRows(page)).toHaveCount(0);
    await expect(ordersTable(page)).toContainText('No orders yet');
  });

  await journeyStep(page, 'Choose account A1001 Whitfield Investment', async () => {
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

  await journeyStep(page, 'Place the order', async () => {
    await submit(page);
    await expect(ticket(page).getByRole('status')).toContainText('Status: Open');
    await expect(orderRows(page)).toHaveCount(1);
    await expectOrder(orderRow(page, 'Buy', 'RY', 10), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 10, status: 'Open' });
    await expect(estimate(page, 'Available cash')).toHaveText('$23,600.00');
    await expect(estimate(page, 'Held in account')).toHaveText('100 RY');
    orderId = (await orderRows(page).first().getByRole('rowheader').textContent())!.trim();
  });

  await journeyStep(page, 'Filter the blotter to Open orders', async () => {
    const status = blotter(page).getByLabel('Order status');
    await status.click();
    await status.selectOption('Open');
    await expect(orderRows(page)).toHaveCount(1);
    await expect(orderRows(page).first().getByRole('rowheader')).toHaveText(orderId);
  });

  await journeyStep(page, 'Search orders for RY', async () => {
    const search = blotter(page).getByLabel('Search orders');
    await search.click();
    await search.fill('RY');
    await expectOrder(orderRow(page, 'Buy', 'RY', 10), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 10, status: 'Open', value: '$1,400.00' });
  });

  await journeyStep(page, 'Cancel the order', async () => {
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
    await expectOrder(orderRow(page, 'Buy', 'RY', 10), { account: 'A1001', symbol: 'RY', side: 'Buy', quantity: 10, status: 'Cancelled' });
    await expect(orderRows(page).first().getByRole('rowheader')).toHaveText(orderId);
    await expect(blotter(page)).toContainText('1 of 1 orders');
  });

  await journeyStep(page, 'Open the Portfolio workspace', async () => {
    await tab(page, 'Portfolio').click();
    await expect(tab(page, 'Portfolio')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 1, name: 'Portfolio' })).toBeVisible();
    await expect(portfolioFilters.getByLabel('Client')).toHaveValue('All');
  });

  await journeyStep(page, 'Review C1001 account A1001', async () => {
    await portfolioFilters.getByLabel('Client').click();
    await portfolioFilters.getByLabel('Client').selectOption('C1001');
    await portfolioFilters.getByLabel('Account').click();
    await portfolioFilters.getByLabel('Account').selectOption('A1001');
    await expect(cell(holdingRow(page, 'RY'), 3)).toHaveText('100');
    await expect(cell(cashRow(page, 'A1001'), 2)).toHaveText('$25,000.00');
    await expect(cell(cashRow(page, 'A1001'), 3)).toHaveText('$0.00');
    await expect(cell(cashRow(page, 'A1001'), 4)).toHaveText('$25,000.00');
  });

  await journeyStep(page, 'Refresh workspace data', async () => {
    const refreshed = page.waitForResponse(r => r.url().includes('/api/workflows/bootstrap') && r.ok());
    await page.getByRole('button', { name: 'Refresh data' }).click();
    await refreshed;
    await expect(page.getByText(/^Data loaded /)).toBeVisible();
    await expect(cell(holdingRow(page, 'RY'), 3)).toHaveText('100');
    await expect(cell(cashRow(page, 'A1001'), 2)).toHaveText('$25,000.00');
    await expect(cell(cashRow(page, 'A1001'), 3)).toHaveText('$0.00');
    await expect(cell(cashRow(page, 'A1001'), 4)).toHaveText('$25,000.00');
  });
});

gapTest('WM-GAP-040', {
  title: 'Orders workspace shows a clear error state on a real request failure, and Retry after recovery restores a usable order ticket with real data',
  area: 'orders',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2'
}, async ({ page }) => {
  const bootstrap = '**/api/workflows/bootstrap';
  await page.route(bootstrap, route => route.abort('connectionrefused'));
  await openArea(page, 'orders');

  await tab(page, 'Orders').click();
  const panel = page.getByRole('tabpanel', { name: /^Orders/ });
  await expect(panel.getByRole('alert')).toContainText(/Workspace data couldn.t be loaded/);
  await expect(panel.getByRole('alert')).toContainText('could not be reached');
  await expect(panel.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(ticket(page)).toHaveCount(0);
  await expect(blotter(page)).toHaveCount(0);

  await page.unroute(bootstrap);
  await panel.getByRole('button', { name: 'Retry' }).click();
  await expect(ticket(page)).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(ordersTable(page)).toContainText('No orders yet');

  await chooseAccount(page, 'A1001');
  await expect(estimate(page, 'Available cash')).toHaveText('$25,000.00');
  await chooseInstrument(page, 'RY');
  await expect(estimate(page, 'Indicative price')).toHaveText('$140.00');
  await expect(estimate(page, 'Held in account')).toHaveText('100 RY');
  await placeAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: 1 });
  await expect(estimate(page, 'Available cash')).toHaveText('$24,860.00');
});

gapTest('WM-GAP-041', {
  title: 'Browser Back/Forward between Orders and Portfolio workspace areas keeps the selected area tab and URL consistent',
  area: 'orders',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/2.1'
}, async ({ page }) => {
  const expectArea = async (area: 'orders' | 'portfolio', label: string, other: string) => {
    await expect(page).toHaveURL(new RegExp(`[?&]area=${area}(&|$)`));
    await expect(tab(page, label)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, other)).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    if (area === 'orders') await expect(ticket(page)).toBeVisible();
    else await expect(page.getByRole('table', { name: 'Holdings' })).toBeVisible();
  };

  await openArea(page, 'orders');
  await tab(page, 'Orders').click();
  await expectArea('orders', 'Orders', 'Portfolio');

  await tab(page, 'Portfolio').click();
  await expectArea('portfolio', 'Portfolio', 'Orders');

  await page.goBack();
  await expectArea('orders', 'Orders', 'Portfolio');

  await page.goForward();
  await expectArea('portfolio', 'Portfolio', 'Orders');

  await page.goBack();
  await expectArea('orders', 'Orders', 'Portfolio');
  await chooseAccount(page, 'A1001');
  await expect(estimate(page, 'Available cash')).toHaveText('$25,000.00');
});
