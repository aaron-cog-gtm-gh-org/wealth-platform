import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const WIKI_DATA_STATES = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2';
const ORDERS_API = '**/api/workflows/orders';

type Side = 'Buy' | 'Sell';
type Ticket = { account: string; symbol?: string; side?: Side; quantity: string };
type OrderRow = { id: string; account: string; symbol: string; side: string; quantity: string; value: string; status: string };

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A CAD amount (CAD 1.00, CA$1.00 or $1.00), never a US$ amount. */
const cad = (amount: string) => new RegExp(`(?:^|[^A-Z])(?:CAD\\s?|CA\\$|\\$)${escapeRe(amount)}(?!\\d)`);
/** A USD amount (USD 1.00 or US$1.00). */
const usd = (amount: string) => new RegExp(`(?:USD\\s?|US\\$)${escapeRe(amount)}(?!\\d)`);

const ticket = (page: Page) => page.getByRole('region', { name: 'New order', exact: true });
const blotter = (page: Page) => page.getByRole('region', { name: 'Orders', exact: true });
const ordersTable = (page: Page) => blotter(page).getByRole('table', { name: 'Orders', exact: true });
const auditTrail = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });
const auditEntries = (page: Page) => auditTrail(page).getByRole('list', { name: 'Audit entries' }).getByRole('listitem');
const accountSelect = (page: Page) => ticket(page).getByLabel('Account', { exact: true });
const instrumentSelect = (page: Page) => ticket(page).getByLabel('Instrument', { exact: true });

const estimate = (page: Page, term: string): Locator =>
  ticket(page).locator('dl[aria-label="Order estimate"]')
    .locator('dt', { hasText: new RegExp(`^${escapeRe(term)}$`) })
    .locator('xpath=following-sibling::dd[1]');

async function waitForOrdersArea(page: Page) {
  await expect(page.getByRole('tab', { name: /^Orders/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expect(ticket(page)).toBeVisible();
  await expect(ordersTable(page)).toBeVisible();
}

async function startOrders(page: Page) {
  await openArea(page, 'orders');
  await waitForOrdersArea(page);
}

async function reloadOrders(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  if (!new URL(page.url()).searchParams.get('area')?.startsWith('orders')) {
    await page.getByRole('tab', { name: /^Orders/ }).click();
  }
  await waitForOrdersArea(page);
}

async function goToTab(page: Page, name: 'Clients' | 'Portfolio' | 'Orders') {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('tab', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function readOrders(page: Page): Promise<OrderRow[]> {
  return ordersTable(page).locator('tbody tr:has(th[scope="row"])').evaluateAll((rows) =>
    rows.map((row) => {
      const cells = [...(row as HTMLTableRowElement).cells].map((cell) => (cell.textContent ?? '').trim());
      const account = /\(([A-Z]\d+)\)/.exec(cells[1] ?? '')?.[1] ?? cells[1] ?? '';
      return { id: cells[0], account, symbol: cells[2], side: cells[3], quantity: cells[4], value: cells[6], status: cells[7] };
    })
  );
}

const describe = (o: OrderRow) => `${o.account} ${o.side} ${o.symbol} ${o.quantity} ${o.status}`;

/** Asserts the order list holds exactly these orders, e.g. "A1001 Buy RY 10 Open". */
async function expectOrders(page: Page, expected: string[]) {
  await expect
    .poll(async () => (await readOrders(page)).map(describe).sort(), { message: 'order list contents' })
    .toEqual([...expected].sort());
  if (expected.length === 0) {
    await expect(ordersTable(page).locator('tbody')).toContainText(/no orders/i);
  }
}

async function findOrder(page: Page, account: string, side: Side, symbol: string, quantity: string, status?: string) {
  let found: OrderRow | undefined;
  await expect
    .poll(async () => {
      found = (await readOrders(page)).find((o) =>
        o.account === account && o.side === side && o.symbol === symbol && o.quantity === quantity && (!status || o.status === status));
      return found ? describe(found) : null;
    }, { message: `${side} ${quantity} ${symbol} in ${account}` })
    .not.toBeNull();
  return found!;
}

async function fillTicket(page: Page, order: Ticket) {
  await accountSelect(page).selectOption(order.account);
  await expect(accountSelect(page)).toHaveValue(order.account);
  if (order.symbol) {
    await instrumentSelect(page).selectOption(order.symbol);
    await expect(instrumentSelect(page)).toHaveValue(order.symbol);
  }
  if (order.side) {
    const radio = ticket(page).getByRole('radio', { name: order.side, exact: true });
    await radio.check();
    await expect(radio).toBeChecked();
  }
  const quantity = ticket(page).getByLabel('Quantity', { exact: true });
  await quantity.fill(order.quantity);
  await expect(quantity).toHaveValue(order.quantity);
}

async function submitTicket(page: Page) {
  const button = ticket(page).getByRole('button', { name: 'Place order' });
  await expect(button).toBeEnabled();
  await button.click();
}

async function placeOrder(page: Page, order: Ticket) {
  await fillTicket(page, order);
  await submitTicket(page);
}

/** Places an order and asserts it is accepted as a new Open order with the given details. */
async function expectAccepted(page: Page, order: Required<Ticket>) {
  const before = (await readOrders(page)).map((o) => o.id);
  await placeOrder(page, order);
  const status = ticket(page).getByRole('status');
  await expect(status).toBeVisible();
  await expect(status).toContainText(new RegExp(`${order.side}\\b.*\\b${order.quantity} ${order.symbol}\\b`));
  await expect(status).toContainText(/Open/);
  await expect(ticket(page).getByRole('alert')).toHaveCount(0);
  let created: OrderRow | undefined;
  await expect
    .poll(async () => {
      const added = (await readOrders(page)).filter((o) => !before.includes(o.id));
      created = added[0];
      return added.map(describe);
    }, { message: 'exactly one new order row' })
    .toEqual([`${order.account} ${order.side} ${order.symbol} ${order.quantity} Open`]);
  return created!;
}

/** Places an order and asserts it is rejected with a visible error and no order row is created. */
async function expectRejected(page: Page, order: Ticket, ...messages: RegExp[]) {
  const before = (await readOrders(page)).map(describe).sort();
  await placeOrder(page, order);
  const alert = ticket(page).getByRole('alert');
  await expect(alert).toBeVisible();
  for (const message of messages) await expect(alert).toContainText(message);
  await expect(ticket(page).getByRole('status')).toHaveCount(0);
  await expectOrders(page, before);
  return alert;
}

async function cancelOrder(page: Page, order: OrderRow) {
  const row = ordersTable(page).locator('tbody tr').filter({ has: page.locator('th[scope="row"]', { hasText: new RegExp(`^${escapeRe(order.id)}$`) }) });
  await row.getByRole('button', { name: new RegExp(`Cancel order ${escapeRe(order.id)}$`) }).click();
  await expect(blotter(page).getByRole('status')).toContainText(new RegExp(`${escapeRe(order.id)}.*cancelled`, 'i'));
  await expect(row.getByText('Cancelled', { exact: true })).toBeVisible();
  return row;
}

async function expectPortfolioQuantity(page: Page, account: string, symbol: string, quantity: string) {
  await goToTab(page, 'Portfolio');
  const holdings = page.getByRole('table', { name: 'Holdings', exact: true });
  await expect(holdings).toBeVisible();
  const row = holdings.locator('tbody tr').filter({ has: page.locator('th[scope="row"]', { hasText: new RegExp(`^${symbol}$`) }) })
    .filter({ hasText: `(${account})` });
  await expect(row).toHaveCount(1);
  await expect(row.locator('td').nth(3)).toHaveText(quantity);
}

async function expectClientCash(page: Page, client: string, balances: Array<[string, RegExp]>) {
  await goToTab(page, 'Clients');
  await page.getByRole('button', { name: client, exact: true }).click();
  const accounts = page.getByRole('table', { name: `Accounts for ${client}` });
  await expect(accounts).toBeVisible();
  for (const [account, amount] of balances) {
    const row = accounts.locator('tbody tr').filter({ has: page.locator('th[scope="row"]', { hasText: account }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('td').nth(1)).toHaveText(amount);
  }
}

caseTest('WM-TC-019', async ({ page }) => {
  await startOrders(page);
  await expectOrders(page, []);

  const order = await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '10' });

  await reloadOrders(page);
  await findOrder(page, 'A1001', 'Buy', 'RY', '10', 'Open');
  await expectOrders(page, ['A1001 Buy RY 10 Open']);

  await expect(auditTrail(page)).toBeVisible();
  const placement = auditEntries(page).filter({ hasText: /Buy 10 RY\b/ }).filter({ hasText: 'A1001' })
    .filter({ hasText: /creat|plac/i });
  await expect(placement).toHaveCount(1);
  await expect(placement).toContainText(order.id);
});

caseTest('WM-TC-020', async ({ page }) => {
  await startOrders(page);
  await expectAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '40' });

  await expect(accountSelect(page)).toHaveValue('A1001');
  await expect(instrumentSelect(page)).toHaveValue('RY');
  await expect(estimate(page, 'Available to sell')).toHaveText(/^60\b/);

  await expectPortfolioQuantity(page, 'A1001', 'RY', '100');

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Sell RY 40 Open']);
});

caseTest('WM-TC-021', async ({ page }) => {
  await startOrders(page);
  await expectAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '70' });

  await expectRejected(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '50' }, /\b30\b/, /available/i);

  await expectOrders(page, ['A1001 Sell RY 70 Open']);

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Sell RY 70 Open']);

  await expectAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '30' });
  await expect
    .poll(async () => (await readOrders(page))
      .filter((o) => o.account === 'A1001' && o.symbol === 'RY' && o.side === 'Sell' && o.status === 'Open')
      .reduce((total, o) => total + Number(o.quantity.replace(/,/g, '')), 0), { message: 'open RY sells total' })
    .toBe(100);
  await expect(estimate(page, 'Available to sell')).toHaveText(/^0\b/);

  await expectRejected(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '1' }, /\b0\b/, /available/i);
  await expectOrders(page, ['A1001 Sell RY 70 Open', 'A1001 Sell RY 30 Open']);

  await expectPortfolioQuantity(page, 'A1001', 'RY', '100');
});

caseTest('WM-TC-022', async ({ page }) => {
  await startOrders(page);
  const sell70 = await expectAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '70' });

  await expectRejected(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '31' }, /\b30\b/, /available/i);

  await cancelOrder(page, sell70);
  await expectOrders(page, ['A1001 Sell RY 70 Cancelled']);

  await expectAccepted(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '100' });

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Sell RY 70 Cancelled', 'A1001 Sell RY 100 Open']);
});

caseTest('WM-TC-023', async ({ page }) => {
  await startOrders(page);
  await fillTicket(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '179' });
  await expect(estimate(page, 'Estimated value')).toHaveText(cad('25,060.00'));
  await expect(estimate(page, 'Available cash')).toHaveText(cad('25,000.00'));
  await expectRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '179' }, /insufficient/i, /available cash/i);
  await expect(estimate(page, 'Estimated value')).toHaveText(cad('25,060.00'));
  await expect(estimate(page, 'Available cash')).toHaveText(cad('25,000.00'));

  await expectOrders(page, []);
  await expectClientCash(page, 'Eleanor Whitfield', [['A1001', cad('25,000.00')]]);
  await goToTab(page, 'Orders');
  await waitForOrdersArea(page);

  await fillTicket(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '178' });
  await expect(estimate(page, 'Estimated value')).toHaveText(cad('24,920.00'));
  const order = await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '178' });
  expect(order.value).toMatch(cad('24,920.00'));

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Buy RY 178 Open']);
});

caseTest('WM-TC-024', async ({ page }) => {
  await startOrders(page);
  await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '100' });

  await fillTicket(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '80' });
  await expect(estimate(page, 'Available cash')).toHaveText(cad('11,000.00'));

  await expectRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '80' }, /insufficient/i, /available cash/i);
  await expectOrders(page, ['A1001 Buy RY 100 Open']);

  await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '78' });

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Buy RY 100 Open', 'A1001 Buy RY 78 Open']);
});

caseTest('WM-TC-025', async ({ page }) => {
  await startOrders(page);
  const order = { account: 'A1001', side: 'Buy' as const, symbol: 'RY' };

  await expectRejected(page, { ...order, quantity: '0' }, /positive whole number/i, /shares/i);
  await expectRejected(page, { ...order, quantity: '-5' }, /positive whole number/i);
  await expectRejected(page, { ...order, quantity: '2.5' }, /fractional/i);
  await expectRejected(page, { ...order, quantity: '' }, /quantity|whole number/i);
  await expectRejected(page, { ...order, quantity: 'ten' }, /whole number/i);

  await reloadOrders(page);
  await expectOrders(page, []);
  await accountSelect(page).selectOption('A1001');
  await expect(estimate(page, 'Available cash')).toHaveText(cad('25,000.00'));
});

caseTest('WM-TC-026', async ({ page }) => {
  await startOrders(page);
  const offered = () => instrumentSelect(page).locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).filter((value) => value !== ''));

  await accountSelect(page).selectOption('A1002');
  await expect(instrumentSelect(page)).toBeEnabled();
  await expect.poll(offered, { message: 'instruments offered for A1002' }).toEqual(['BMO']);
  await instrumentSelect(page).selectOption('BMO');
  await expect(instrumentSelect(page)).toHaveValue('BMO');

  await accountSelect(page).selectOption('A1003');
  await expect.poll(offered, { message: 'instruments offered for A1003' }).toEqual(['MSFT']);
  await expect(instrumentSelect(page)).toHaveValue('');

  await accountSelect(page).selectOption('A1001');
  await expect.poll(offered, { message: 'instruments offered for A1001' }).toEqual(['RY']);

  await expectOrders(page, []);
});

caseTest('WM-TC-027', async ({ page }) => {
  await startOrders(page);
  const order = await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '5' });

  const row = await cancelOrder(page, order);
  await expectOrders(page, ['A1001 Buy RY 5 Cancelled']);

  const cancelAgain = row.getByRole('button', { name: /cancel/i });
  if (await cancelAgain.count()) {
    await cancelAgain.click();
    await expect(blotter(page).getByRole('alert')).toBeVisible();
  } else {
    await expect(cancelAgain).toHaveCount(0);
  }
  await expectOrders(page, ['A1001 Buy RY 5 Cancelled']);

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Buy RY 5 Cancelled']);

  await expect(auditTrail(page)).toBeVisible();
  await expect(auditEntries(page).filter({ hasText: order.id }).filter({ hasText: /cancel/i })).toHaveCount(1);
});

caseTest('WM-TC-028', async ({ page }) => {
  await startOrders(page);
  const buy150 = await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '150' });

  await expectRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '30' }, /insufficient|available/i);
  await expect(estimate(page, 'Available cash')).toHaveText(cad('4,000.00'));

  await cancelOrder(page, buy150);
  await expectOrders(page, ['A1001 Buy RY 150 Cancelled']);

  await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '178' });

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Buy RY 150 Cancelled', 'A1001 Buy RY 178 Open']);
});

caseTest('WM-TC-029', async ({ page }) => {
  await startOrders(page);
  await fillTicket(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '35' });
  await expect(estimate(page, 'Estimated value')).toHaveText(usd('14,700.00'));
  const order = await expectAccepted(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '35' });
  expect(order.value).toMatch(usd('14,700.00'));

  await fillTicket(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '1' });
  await expect(estimate(page, 'Available cash')).toHaveText(usd('300.00'));
  await expectRejected(page, { account: 'A1003', side: 'Buy', symbol: 'MSFT', quantity: '1' }, /insufficient|available/i);
  await expect(estimate(page, 'Available cash')).toHaveText(usd('300.00'));
  await expectOrders(page, ['A1003 Buy MSFT 35 Open']);

  await expectClientCash(page, 'Eleanor Whitfield', [['A1001', cad('25,000.00')], ['A1002', cad('10,000.00')]]);

  await reloadOrders(page);
  await expectOrders(page, ['A1003 Buy MSFT 35 Open']);
});

caseTest('WM-TC-030', async ({ page }) => {
  await startOrders(page);
  const buy = await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '5' });

  await expectRejected(page, { account: 'A1001', side: 'Sell', symbol: 'RY', quantity: '101' }, /\b100\b/);

  await cancelOrder(page, buy);
  await expectOrders(page, ['A1001 Buy RY 5 Cancelled']);

  const expectTwoEntries = async () => {
    await expect(auditTrail(page)).toBeVisible();
    const entries = auditEntries(page);
    await expect(entries).toHaveCount(2);
    // Newest first: the cancellation, then the placement.
    await expect(entries.nth(0)).toContainText(buy.id);
    await expect(entries.nth(0)).toContainText(/cancel/i);
    await expect(entries.nth(1)).toContainText(buy.id);
    await expect(entries.nth(1)).toContainText(/Buy 5 RY\b/);
    await expect(entries.nth(1)).not.toContainText(/cancel/i);
    const placedAt = await entries.nth(1).locator('time').getAttribute('datetime');
    const cancelledAt = await entries.nth(0).locator('time').getAttribute('datetime');
    expect(Date.parse(placedAt ?? '')).toBeLessThanOrEqual(Date.parse(cancelledAt ?? ''));
    await expect(auditTrail(page)).not.toContainText(/Sell 101|101 RY/);
  };
  await expectTwoEntries();

  await reloadOrders(page);
  await expectTwoEntries();
});

gapTest('WM-GAP-040', {
  title: 'Order placement request failure shows error, creates no order, holdings/cash unchanged; retry after recovery places exactly one order',
  area: 'orders',
  wikiRef: WIKI_DATA_STATES
}, async ({ page }) => {
  await startOrders(page);
  let failedPlacements = 0;
  await page.route(ORDERS_API, async (route) => {
    if (route.request().method() === 'POST') {
      failedPlacements += 1;
      await route.abort('connectionrefused');
    } else {
      await route.continue();
    }
  });

  await expectRejected(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '10' }, /.+/);
  expect(failedPlacements).toBe(1);
  await expect(ticket(page).getByRole('alert')).not.toContainText(/placed/i);
  await expect(estimate(page, 'Available cash')).toHaveText(cad('25,000.00'));
  await expect(auditTrail(page)).toContainText(/no changes recorded/i);

  await page.unroute(ORDERS_API);
  await expect(ticket(page).getByRole('button', { name: 'Place order' })).toBeEnabled();
  const order = await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '10' });
  await expect(estimate(page, 'Available cash')).toHaveText(cad('23,600.00'));

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Buy RY 10 Open']);
  await expect(auditEntries(page)).toHaveCount(1);
  await expect(auditEntries(page).first()).toContainText(order.id);

  await expectPortfolioQuantity(page, 'A1001', 'RY', '100');
  await expectClientCash(page, 'Eleanor Whitfield', [['A1001', cad('25,000.00')]]);
});

gapTest('WM-GAP-041', {
  title: 'Order cancellation request failure shows error and keeps the order Open with its reservation; retry after recovery cancels it exactly once',
  area: 'orders',
  wikiRef: WIKI_DATA_STATES
}, async ({ page }) => {
  await startOrders(page);
  const order = await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '100' });
  await expect(estimate(page, 'Available cash')).toHaveText(cad('11,000.00'));

  const cancelApi = `**/api/workflows/orders/${order.id}/cancel`;
  let failedCancels = 0;
  await page.route(cancelApi, async (route) => {
    failedCancels += 1;
    await route.abort('connectionrefused');
  });

  const row = ordersTable(page).locator('tbody tr').filter({ has: page.locator('th[scope="row"]', { hasText: new RegExp(`^${escapeRe(order.id)}$`) }) });
  await row.getByRole('button', { name: new RegExp(`Cancel order ${escapeRe(order.id)}$`) }).click();
  await expect(blotter(page).getByRole('alert')).toBeVisible();
  await expect(blotter(page).getByRole('status')).toHaveCount(0);
  expect(failedCancels).toBe(1);
  await expectOrders(page, ['A1001 Buy RY 100 Open']);
  await expect(estimate(page, 'Available cash')).toHaveText(cad('11,000.00'));

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Buy RY 100 Open']);
  await expect(auditEntries(page).filter({ hasText: /cancel/i })).toHaveCount(0);

  await page.unroute(cancelApi);
  const reloaded = await findOrder(page, 'A1001', 'Buy', 'RY', '100', 'Open');
  await cancelOrder(page, reloaded);
  await expectOrders(page, ['A1001 Buy RY 100 Cancelled']);
  await accountSelect(page).selectOption('A1001');
  await expect(estimate(page, 'Available cash')).toHaveText(cad('25,000.00'));

  await reloadOrders(page);
  await expectOrders(page, ['A1001 Buy RY 100 Cancelled']);
  await expect(auditEntries(page).filter({ hasText: order.id }).filter({ hasText: /cancel/i })).toHaveCount(1);
});

gapTest('WM-GAP-042', {
  title: 'Orders area data-load failure shows an error state instead of an order list; Retry after recovery restores real orders and a usable ticket',
  area: 'orders',
  wikiRef: WIKI_DATA_STATES
}, async ({ page }) => {
  await startOrders(page);
  await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '10' });

  const bootstrapApi = '**/api/workflows/bootstrap';
  let failedLoads = 0;
  await page.route(bootstrapApi, async (route) => {
    failedLoads += 1;
    await route.abort('connectionrefused');
  });

  await page.reload();
  await page.waitForLoadState('load');
  await expect(page.getByRole('tab', { name: /^Orders/ })).toHaveAttribute('aria-selected', 'true');
  const error = page.getByRole('alert').filter({ hasText: /couldn.t be loaded|could not be (loaded|reached)/i });
  await expect(error).toBeVisible();
  expect(failedLoads).toBeGreaterThanOrEqual(1);
  await expect(ticket(page)).toHaveCount(0);
  await expect(ordersTable(page)).toHaveCount(0);

  await page.unroute(bootstrapApi);
  await page.getByRole('button', { name: 'Retry' }).click();
  await waitForOrdersArea(page);
  await expect(error).toHaveCount(0);
  await expectOrders(page, ['A1001 Buy RY 10 Open']);

  await expectAccepted(page, { account: 'A1001', side: 'Buy', symbol: 'RY', quantity: '5' });
  await reloadOrders(page);
  await expectOrders(page, ['A1001 Buy RY 10 Open', 'A1001 Buy RY 5 Open']);
});
