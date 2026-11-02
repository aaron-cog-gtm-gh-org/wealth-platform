import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, journeyStep, openArea } from '../tooling/fixtures';

const C1001 = { id: 'C1001', name: 'Eleanor Whitfield' };
const C1002 = { id: 'C1002', name: 'James Chen' };

const panel = (page: Page) => page.getByRole('tabpanel');
const clientBook = (page: Page) => page.getByRole('region', { name: 'Client book' });
const clientTable = (page: Page) => clientBook(page).getByRole('table', { name: 'Clients' });
const clientRows = (page: Page) => clientTable(page).locator('tbody tr');
const clientRow = (page: Page, id: string) => clientRows(page).filter({ hasText: id });
const searchBox = (page: Page) => clientBook(page).getByLabel('Search clients');
const detail = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const accountRows = (page: Page, name: string) =>
  detail(page, name).getByRole('table', { name: `Accounts for ${name}` }).locator('tbody tr');
const profileForm = (page: Page) => page.getByRole('form', { name: 'Edit profile' });
const formRisk = (page: Page) => profileForm(page).getByLabel('Risk profile', { exact: true });
const formKyc = (page: Page) => profileForm(page).getByLabel('KYC status', { exact: true });
const auditTrail = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });
const clientAuditEntries = (page: Page) =>
  auditTrail(page).getByRole('list', { name: 'Audit entries' }).getByRole('listitem').filter({ hasText: 'client.updated' });
const areaTab = (page: Page, label: string) => page.getByRole('tab', { name: new RegExp(`^${label}(\\s|$)`) });

const savedValue = (page: Page, name: string, label: string) =>
  detail(page, name).locator('dl dt', { hasText: label }).locator('xpath=following-sibling::dd[1]');

async function expectSaved(page: Page, client: { name: string; id: string }, risk: string, kyc: string) {
  const region = detail(page, client.name);
  await expect(region).toBeVisible();
  await expect(savedValue(page, client.name, 'Client ID')).toHaveText(client.id);
  await expect(savedValue(page, client.name, 'Risk profile')).toHaveText(risk);
  await expect(savedValue(page, client.name, 'KYC status')).toHaveText(kyc);
}

async function expectBookRow(page: Page, client: { name: string; id: string }, risk: string, kyc: string) {
  const row = clientRow(page, client.id);
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('rowheader')).toHaveText(client.name);
  await expect(row.locator('td').nth(0)).toHaveText(client.id);
  await expect(row.locator('td').nth(1)).toHaveText(risk);
  await expect(row.locator('td').nth(2)).toHaveText(kyc);
}

async function selectClient(page: Page, client: { name: string }) {
  await clientTable(page).getByRole('button', { name: client.name, exact: true }).click();
  await expect(detail(page, client.name)).toBeVisible();
}

async function openEdit(page: Page, client: { name: string }) {
  await detail(page, client.name).getByRole('button', { name: 'Edit profile' }).click();
  await expect(profileForm(page)).toBeVisible();
}

async function choose(select: Locator, value: string) {
  await select.click();
  await select.selectOption(value);
  await expect(select).toHaveValue(value);
}

async function openAudit(page: Page) {
  const trail = auditTrail(page);
  await trail.scrollIntoViewIfNeeded();
  await trail.getByRole('heading', { name: 'Audit trail' }).hover();
  await expect(trail).toBeVisible();
}

async function reloadWorkspace(page: Page) {
  await page.reload();
  await expect(clientTable(page)).toBeVisible();
}

caseTest('WM-TC-001', async ({ page }) => {
  await openArea(page, 'clients');
  await areaTab(page, 'Clients').click();
  await expect(clientTable(page)).toBeVisible();
  await expect(clientRows(page)).toHaveCount(2);
  await expect(clientBook(page)).toContainText('2 of 2 clients');
  await expect(clientRow(page, C1001.id).getByRole('rowheader')).toHaveText(C1001.name);
  await expect(clientRow(page, C1002.id).getByRole('rowheader')).toHaveText(C1002.name);

  await clientRow(page, C1001.id).hover();
  await expectBookRow(page, C1001, 'Moderate', 'Current');

  await clientRow(page, C1002.id).hover();
  await expectBookRow(page, C1002, 'Conservative', 'Review due');

  await reloadWorkspace(page);
  await expect(clientRows(page)).toHaveCount(2);
  await expectBookRow(page, C1001, 'Moderate', 'Current');
  await expectBookRow(page, C1002, 'Conservative', 'Review due');
});

caseTest('WM-TC-002', async ({ page }) => {
  await openArea(page, 'clients');
  const search = searchBox(page);

  await search.click();
  await search.fill('Whitfield');
  await expect(clientRows(page)).toHaveCount(1);
  await expectBookRow(page, C1001, 'Moderate', 'Current');

  await search.click();
  await search.fill('C1002');
  await expect(clientRows(page)).toHaveCount(1);
  await expectBookRow(page, C1002, 'Conservative', 'Review due');

  await search.click();
  await search.fill('Zhang');
  await expect(clientRows(page)).toHaveCount(1);
  await expect(clientRow(page, C1001.id)).toHaveCount(0);
  await expect(clientRow(page, C1002.id)).toHaveCount(0);
  await expect(clientTable(page)).toContainText('No clients match these filters');
  await expect(clientBook(page)).toContainText('0 of 2 clients');
  await expect(panel(page).getByRole('alert')).toHaveCount(0);

  await search.click();
  await search.fill('');
  await expect(clientRows(page)).toHaveCount(2);
  await expectBookRow(page, C1001, 'Moderate', 'Current');
  await expectBookRow(page, C1002, 'Conservative', 'Review due');
});

caseTest('WM-TC-003', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, C1001);
  await expect(savedValue(page, C1001.name, 'Client ID')).toHaveText(C1001.id);
  const whitfield = accountRows(page, C1001.name);
  await expect(whitfield.filter({ hasText: 'A1001' })).toContainText('Whitfield Investment');
  await expect(whitfield.filter({ hasText: 'A1001' }).locator('td').nth(0)).toHaveText('CAD');
  await expect(whitfield.filter({ hasText: 'A1001' }).locator('td').nth(1)).toHaveText('$25,000.00');
  await expect(whitfield.filter({ hasText: 'A1002' })).toContainText('Whitfield Savings');
  await expect(whitfield.filter({ hasText: 'A1002' }).locator('td').nth(0)).toHaveText('CAD');
  await expect(whitfield.filter({ hasText: 'A1002' }).locator('td').nth(1)).toHaveText('$10,000.00');

  await whitfield.first().hover();
  await expect(whitfield).toHaveCount(2);
  await expect(detail(page, C1001.name)).not.toContainText('A1003');
  await expect(detail(page, C1001.name)).not.toContainText('Chen USD Investment');

  await selectClient(page, C1002);
  await expect(savedValue(page, C1002.name, 'Client ID')).toHaveText(C1002.id);
  const chen = accountRows(page, C1002.name);
  await expect(chen).toHaveCount(1);
  await expect(chen.first()).toContainText('Chen USD Investment');
  await expect(chen.first()).toContainText('A1003');
  await expect(chen.first().locator('td').nth(0)).toHaveText('USD');
  await expect(chen.first().locator('td').nth(1)).toHaveText('US$15,000.00');

  await chen.first().hover();
  await expect(detail(page, C1002.name)).not.toContainText('A1001');
  await expect(detail(page, C1002.name)).not.toContainText('A1002');
  for (const row of await chen.all()) await expect(row.locator('td').nth(0)).not.toHaveText('CAD');
});

caseTest('WM-TC-004', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, C1001);
  await openEdit(page, C1001);
  await expect(formRisk(page)).toHaveValue('Moderate');
  await expect(formKyc(page)).toHaveValue('Current');

  await formRisk(page).click();
  await expect(formRisk(page).locator('option')).toHaveText(['Conservative', 'Moderate', 'Growth']);

  await formKyc(page).click();
  await expect(formKyc(page).locator('option')).toHaveText(['Current', 'Review due']);

  await choose(formRisk(page), 'Growth');
  await expect(formKyc(page)).toHaveValue('Current');
  await profileForm(page).getByRole('button', { name: 'Save profile' }).click();
  await expect(detail(page, C1001.name).getByRole('status')).toContainText(`Profile saved for ${C1001.name}`);
  await expect(detail(page, C1001.name).getByRole('status')).toContainText('risk profile Growth, KYC status Current');
  await expectSaved(page, C1001, 'Growth', 'Current');

  await reloadWorkspace(page);
  await selectClient(page, C1001);
  await expectSaved(page, C1001, 'Growth', 'Current');

  await openAudit(page);
  const entries = clientAuditEntries(page);
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText(C1001.id);
  await expect(entries.first()).toContainText('Risk profile Moderate → Growth');
});

caseTest('WM-TC-005', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, C1002);
  await openEdit(page, C1002);
  await expect(formRisk(page)).toHaveValue('Conservative');
  await expect(formKyc(page)).toHaveValue('Review due');

  await choose(formKyc(page), 'Current');
  await expect(formRisk(page)).toHaveValue('Conservative');
  await profileForm(page).getByRole('button', { name: 'Save profile' }).click();
  await expect(detail(page, C1002.name).getByRole('status')).toContainText(`Profile saved for ${C1002.name}`);
  await expect(detail(page, C1002.name).getByRole('status')).toContainText('risk profile Conservative, KYC status Current');
  await expectSaved(page, C1002, 'Conservative', 'Current');

  await reloadWorkspace(page);
  await selectClient(page, C1002);
  await expectSaved(page, C1002, 'Conservative', 'Current');

  await openAudit(page);
  const entries = clientAuditEntries(page);
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText(C1002.id);
  await expect(entries.first()).toContainText('KYC status Review due → Current');
});

caseTest('WM-TC-006', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, C1001);
  await openEdit(page, C1001);
  await expect(formRisk(page)).toHaveValue('Moderate');
  await expect(formKyc(page)).toHaveValue('Current');

  await choose(formRisk(page), 'Conservative');
  await choose(formKyc(page), 'Review due');
  await profileForm(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(profileForm(page)).toHaveCount(0);
  await expectSaved(page, C1001, 'Moderate', 'Current');

  await reloadWorkspace(page);
  await selectClient(page, C1001);
  await expectSaved(page, C1001, 'Moderate', 'Current');

  await openAudit(page);
  await expect(clientAuditEntries(page).filter({ hasText: C1001.id })).toHaveCount(0);
  await expect(clientAuditEntries(page)).toHaveCount(0);
});

caseTest('WM-TC-007', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, C1002);
  await openEdit(page, C1002);
  await choose(formRisk(page), 'Growth');
  await profileForm(page).getByRole('button', { name: 'Save profile' }).click();
  await expect(detail(page, C1002.name).getByRole('status')).toContainText(`Profile saved for ${C1002.name}`);
  await expectSaved(page, C1002, 'Growth', 'Review due');

  await selectClient(page, C1001);
  await expectSaved(page, C1001, 'Moderate', 'Current');

  await reloadWorkspace(page);
  await areaTab(page, 'Clients').click();
  await expect(clientRows(page)).toHaveCount(2);
  await expectBookRow(page, C1001, 'Moderate', 'Current');
  await expectBookRow(page, C1002, 'Growth', 'Review due');

  await openAudit(page);
  const entries = clientAuditEntries(page);
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText(C1002.id);
  await expect(entries.first()).not.toContainText(C1001.id);
});

caseTest('WM-TC-008', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, C1002);
  await openEdit(page, C1002);
  await expect(formRisk(page)).toHaveValue('Conservative');
  await expect(formKyc(page)).toHaveValue('Review due');

  await choose(formRisk(page), 'Moderate');
  await choose(formKyc(page), 'Current');
  await profileForm(page).getByRole('button', { name: 'Save profile' }).click();
  await expect(detail(page, C1002.name).getByRole('status')).toContainText(`Profile saved for ${C1002.name}`);
  await expect(detail(page, C1002.name).getByRole('status')).toContainText('risk profile Moderate, KYC status Current');
  await expectSaved(page, C1002, 'Moderate', 'Current');

  await reloadWorkspace(page);
  await selectClient(page, C1002);
  await expectSaved(page, C1002, 'Moderate', 'Current');

  await openAudit(page);
  const entries = clientAuditEntries(page).filter({ hasText: C1002.id });
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Risk profile Conservative → Moderate');
  await expect(entries.first()).toContainText('KYC status Review due → Current');

  await selectClient(page, C1001);
  await expectSaved(page, C1001, 'Moderate', 'Current');
});

caseTest('WM-TC-051', async ({ page }) => {
  await openArea(page, 'clients');
  const chenDetail = detail(page, C1002.name);

  await journeyStep(page, 'Search the client book for C1002', async () => {
    await searchBox(page).click();
    await searchBox(page).fill('C1002');
    await expect(clientRows(page)).toHaveCount(1);
    await expect(clientRow(page, C1002.id).getByRole('rowheader')).toHaveText(C1002.name);
  });

  await journeyStep(page, 'Filter the client book to KYC Review due', async () => {
    const kycFilter = clientBook(page).getByLabel('Filter by KYC status');
    await choose(kycFilter, 'Review due');
    await expect(clientRows(page)).toHaveCount(1);
    await expectBookRow(page, C1002, 'Conservative', 'Review due');
  });

  await journeyStep(page, 'Open James Chen from the client book', async () => {
    await selectClient(page, C1002);
    await expect(savedValue(page, C1002.name, 'Client ID')).toHaveText(C1002.id);
    const accounts = accountRows(page, C1002.name);
    await expect(accounts).toHaveCount(1);
    await expect(accounts.first()).toContainText('A1003');
    await expect(accounts.first().locator('td').nth(0)).toHaveText('USD');
    await expect(accounts.first().locator('td').nth(1)).toHaveText('US$15,000.00');
  });

  await journeyStep(page, 'Open the profile editor', async () => {
    await openEdit(page, C1002);
    await expect(formRisk(page)).toHaveValue('Conservative');
    await expect(formKyc(page)).toHaveValue('Review due');
  });

  await journeyStep(page, 'Draft the risk profile change to Moderate', async () => {
    await choose(formRisk(page), 'Moderate');
    await expect(savedValue(page, C1002.name, 'Risk profile')).toHaveText('Conservative');
  });

  await journeyStep(page, 'Draft the KYC status change to Current', async () => {
    await choose(formKyc(page), 'Current');
    await expect(savedValue(page, C1002.name, 'KYC status')).toHaveText('Review due');
  });

  await journeyStep(page, 'Save the reviewed profile', async () => {
    await profileForm(page).getByRole('button', { name: 'Save profile' }).click();
    const notice = chenDetail.getByRole('status');
    await expect(notice).toContainText(C1002.name);
    await expect(notice).toContainText('risk profile Moderate');
    await expect(notice).toContainText('KYC status Current');
    await expectSaved(page, C1002, 'Moderate', 'Current');
  });

  await journeyStep(page, 'Open the client portfolio', async () => {
    await chenDetail.getByRole('button', { name: 'View portfolio' }).click();
    await expect(areaTab(page, 'Portfolio')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page).getByLabel('Client', { exact: true })).toHaveValue(C1002.id);
    const cash = page.getByRole('table', { name: 'Cash by account' }).locator('tbody tr');
    await expect(cash).toHaveCount(1);
    await expect(cash.first()).toContainText(C1002.name);
    await expect(cash.first()).not.toContainText(C1001.name);
  });

  const holdings = page.getByRole('table', { name: 'Holdings' }).locator('tbody tr');

  await journeyStep(page, 'Filter the portfolio to account A1003', async () => {
    const account = panel(page).getByLabel('Account', { exact: true });
    await account.click();
    await account.selectOption({ label: 'Chen USD Investment (A1003) · USD' });
    await expect(account).toHaveValue('A1003');
    await expect(holdings).toHaveCount(1);
    const msft = holdings.filter({ hasText: 'MSFT' });
    await expect(msft).toHaveCount(1);
    await expect(msft).toContainText('A1003');
    await expect(msft.locator('td').nth(3)).toHaveText('40');
    await expect(msft.locator('td').nth(5)).toHaveText('US$16,800.00');
  });

  await journeyStep(page, 'Filter the portfolio to MSFT', async () => {
    await choose(panel(page).getByLabel('Instrument', { exact: true }), 'MSFT');
    await expect(holdings).toHaveCount(1);
    await expect(holdings.first().getByRole('rowheader')).toHaveText('MSFT');
    await expect(holdings.first()).toContainText('A1003');
    await expect(holdings.first().locator('td').nth(2)).toHaveText('USD');
    await expect(holdings.first().locator('td').nth(3)).toHaveText('40');
  });

  await journeyStep(page, 'Return to the Clients workspace tab', async () => {
    await areaTab(page, 'Clients').click();
    await expect(areaTab(page, 'Clients')).toHaveAttribute('aria-selected', 'true');
    await expect(clientTable(page)).toBeVisible();
  });

  await journeyStep(page, 'Reopen James Chen', async () => {
    await selectClient(page, C1002);
    await expectSaved(page, C1002, 'Moderate', 'Current');
    const accounts = accountRows(page, C1002.name);
    await expect(accounts).toHaveCount(1);
    await expect(accounts.first()).toContainText('A1003');
  });

  await journeyStep(page, 'Refresh workspace data', async () => {
    await page.getByRole('button', { name: 'Refresh data' }).click();
    await expect(page.getByText(/^Data loaded /)).toBeVisible();
    await expectSaved(page, C1002, 'Moderate', 'Current');
    await expectBookRow(page, C1001, 'Moderate', 'Current');
  });

  await journeyStep(page, 'Inspect the saved profile and cancel', async () => {
    await openEdit(page, C1002);
    await expect(formRisk(page)).toHaveValue('Moderate');
    await expect(formKyc(page)).toHaveValue('Current');
    await profileForm(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(profileForm(page)).toHaveCount(0);
    await expectSaved(page, C1002, 'Moderate', 'Current');
    const accounts = accountRows(page, C1002.name);
    await expect(accounts).toHaveCount(1);
    await expect(accounts.first().locator('td').nth(1)).toHaveText('US$15,000.00');
    await expect(clientAuditEntries(page)).toHaveCount(1);
  });
});

gapTest('WM-GAP-001', {
  title: 'Clients workspace shows a clear error state when the workspace service request fails, and Retry after recovery restores real client data and usable controls',
  area: 'clients',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2'
}, async ({ page }) => {
  const bootstrap = '**/api/workflows/bootstrap';
  await page.route(bootstrap, route => route.abort('failed'));
  await openArea(page, 'clients');

  const alert = panel(page).getByRole('alert');
  await expect(alert).toContainText('Workspace data couldn’t be loaded');
  await expect(alert).toContainText('The workspace service could not be reached');
  await expect(clientBook(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeDisabled();
  await expect(page.getByText(/^Data loaded /)).toHaveCount(0);
  await panel(page).getByRole('button', { name: 'Retry' }).hover();

  await page.unroute(bootstrap);
  await panel(page).getByRole('button', { name: 'Retry' }).click();
  await expect(alert).toHaveCount(0);
  await expect(clientRows(page)).toHaveCount(2);
  await expectBookRow(page, C1001, 'Moderate', 'Current');
  await expectBookRow(page, C1002, 'Conservative', 'Review due');
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeEnabled();

  await searchBox(page).click();
  await searchBox(page).fill('Chen');
  await expect(clientRows(page)).toHaveCount(1);
  await selectClient(page, C1002);
  await expectSaved(page, C1002, 'Conservative', 'Review due');
  await expect(accountRows(page, C1002.name).first().locator('td').nth(1)).toHaveText('US$15,000.00');
});

gapTest('WM-GAP-002', {
  title: 'Browser Back/Forward between workspace areas (Clients -> Portfolio -> Orders) returns to the correct area tab and URL without losing route consistency',
  area: 'clients',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/2.1'
}, async ({ page }) => {
  const expectArea = async (slug: string, label: string) => {
    await expect(page).toHaveURL(new RegExp(`[?&]area=${slug}(&|$)`));
    await expect(page).toHaveURL(/[?&]screen=workspace(&|$)/);
    await expect(areaTab(page, label)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await expect(panel(page)).toHaveAccessibleName(new RegExp(`^${label}(\\s|$)`));
  };

  await openArea(page, 'clients');
  await expectArea('clients', 'Clients');
  await expect(clientTable(page)).toBeVisible();

  await areaTab(page, 'Portfolio').click();
  await expectArea('portfolio', 'Portfolio');
  await expect(page.getByRole('table', { name: 'Holdings' })).toBeVisible();

  await areaTab(page, 'Orders').click();
  await expectArea('orders', 'Orders');
  await expect(clientTable(page)).toHaveCount(0);

  await page.goBack();
  await expectArea('portfolio', 'Portfolio');
  await expect(page.getByRole('table', { name: 'Holdings' })).toBeVisible();

  await page.goBack();
  await expectArea('clients', 'Clients');
  await expect(clientRows(page)).toHaveCount(2);

  await page.goForward();
  await expectArea('portfolio', 'Portfolio');
  await expect(page.getByRole('table', { name: 'Holdings' })).toBeVisible();

  await page.goForward();
  await expectArea('orders', 'Orders');
  await expect(page.getByRole('table', { name: 'Holdings' })).toHaveCount(0);
});
