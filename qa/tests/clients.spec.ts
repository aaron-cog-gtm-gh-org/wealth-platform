import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, journeyStep, openArea } from '../tooling/fixtures';

const WIKI_ROUTING = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/2.1';

const ELEANOR = { id: 'C1001', name: 'Eleanor Whitfield' };
const JAMES = { id: 'C1002', name: 'James Chen' };

const clientsTab = (page: Page) => page.getByRole('tab', { name: /^Clients(\s|$)/ });
const portfolioTab = (page: Page) => page.getByRole('tab', { name: /^Portfolio(\s|$)/ });
const clientBook = (page: Page) => page.getByRole('region', { name: 'Client book' });
const clientTable = (page: Page) => clientBook(page).getByRole('table', { name: 'Clients' });
const clientRows = (page: Page) => clientTable(page).getByRole('row').filter({ has: page.getByRole('rowheader') });
const clientRow = (page: Page, id: string) => clientRows(page).filter({ hasText: id });
const searchBox = (page: Page) => clientBook(page).getByRole('searchbox', { name: 'Search clients' });
const kycFilter = (page: Page) => clientBook(page).getByRole('combobox', { name: 'Filter by KYC status' });
const detail = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const profileForm = (page: Page) => page.getByRole('form', { name: 'Edit profile' });
const formRisk = (page: Page) => profileForm(page).getByRole('combobox', { name: 'Risk profile' });
const formKyc = (page: Page) => profileForm(page).getByRole('combobox', { name: 'KYC status' });
const auditTrail = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });
const auditEntries = (page: Page) => auditTrail(page).getByRole('listitem');

const detailValue = (panel: Locator, label: string) =>
  panel.locator('dl dt').filter({ hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]');

const accountRows = (page: Page, name: string) =>
  detail(page, name).getByRole('table', { name: `Accounts for ${name}` }).getByRole('row').filter({ has: page.getByRole('rowheader') });

async function selectClient(page: Page, client: { name: string }) {
  await clientBook(page).getByRole('button', { name: client.name, exact: true }).click();
  await expect(detail(page, client.name)).toBeVisible();
}

async function expectListedProfile(page: Page, id: string, risk: string, kyc: string) {
  const cells = clientRow(page, id).getByRole('cell');
  await expect(cells.nth(0)).toHaveText(id);
  await expect(cells.nth(1)).toHaveText(risk);
  await expect(cells.nth(2)).toHaveText(kyc);
}

async function expectSavedProfile(page: Page, client: { id: string; name: string }, risk: string, kyc: string) {
  const panel = detail(page, client.name);
  await expect(detailValue(panel, 'Client ID')).toHaveText(client.id);
  await expect(detailValue(panel, 'Risk profile')).toHaveText(risk);
  await expect(detailValue(panel, 'KYC status')).toHaveText(kyc);
}

async function openEditor(page: Page, client: { name: string }) {
  await detail(page, client.name).getByRole('button', { name: 'Edit profile' }).click();
  await expect(profileForm(page)).toBeVisible();
}

async function choose(select: Locator, value: string) {
  await select.click();
  await select.selectOption(value);
  await expect(select).toHaveValue(value);
}

async function saveProfile(page: Page, client: { name: string }, risk: string, kyc: string) {
  await profileForm(page).getByRole('button', { name: 'Save profile' }).click();
  await expect(profileForm(page)).toBeHidden();
  await expect(detail(page, client.name).getByRole('status'))
    .toHaveText(`Profile saved for ${client.name}: risk profile ${risk}, KYC status ${kyc}.`);
}

async function reloadAndReselect(page: Page, client: { name: string }) {
  await page.reload();
  await expect(clientRows(page)).toHaveCount(2);
  await selectClient(page, client);
}

async function viewAudit(page: Page) {
  await auditTrail(page).getByRole('heading', { name: 'Audit trail' }).hover();
  await expect(auditTrail(page)).toBeVisible();
}

caseTest('WM-TC-001', async ({ page }) => {
  await openArea(page, 'clients');

  await clientsTab(page).click();
  await expect(clientsTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(clientRows(page)).toHaveCount(2);
  await expect(clientRow(page, ELEANOR.id).getByRole('rowheader')).toHaveText(ELEANOR.name);
  await expect(clientRow(page, JAMES.id).getByRole('rowheader')).toHaveText(JAMES.name);

  await selectClient(page, ELEANOR);
  await expectListedProfile(page, ELEANOR.id, 'Moderate', 'Current');
  await expectSavedProfile(page, ELEANOR, 'Moderate', 'Current');

  await selectClient(page, JAMES);
  await expectListedProfile(page, JAMES.id, 'Conservative', 'Review due');
  await expectSavedProfile(page, JAMES, 'Conservative', 'Review due');

  await page.reload();
  await expect(clientRows(page)).toHaveCount(2);
  await expect(clientRow(page, ELEANOR.id).getByRole('rowheader')).toHaveText(ELEANOR.name);
  await expect(clientRow(page, JAMES.id).getByRole('rowheader')).toHaveText(JAMES.name);
  await expectListedProfile(page, ELEANOR.id, 'Moderate', 'Current');
  await expectListedProfile(page, JAMES.id, 'Conservative', 'Review due');
});

caseTest('WM-TC-002', async ({ page }) => {
  await openArea(page, 'clients');
  const search = searchBox(page);

  await search.click();
  await search.fill('Whitfield');
  await expect(clientRows(page)).toHaveCount(1);
  await expect(clientRow(page, ELEANOR.id).getByRole('rowheader')).toHaveText(ELEANOR.name);

  await search.click();
  await search.fill('C1002');
  await expect(clientRows(page)).toHaveCount(1);
  await expect(clientRow(page, JAMES.id).getByRole('rowheader')).toHaveText(JAMES.name);

  await search.click();
  await search.fill('Zhang');
  await expect(clientRows(page)).toHaveCount(0);
  await expect(clientTable(page)).toContainText('No clients match these filters.');
  await expect(page.getByRole('alert')).toHaveCount(0);

  await search.click();
  await search.fill('');
  await expect(clientRows(page)).toHaveCount(2);
  await expect(clientRow(page, ELEANOR.id)).toBeVisible();
  await expect(clientRow(page, JAMES.id)).toBeVisible();
});

caseTest('WM-TC-003', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, ELEANOR);
  const eleanorAccounts = accountRows(page, ELEANOR.name);
  await expect(eleanorAccounts).toHaveCount(2);
  const a1001 = eleanorAccounts.filter({ hasText: 'A1001' });
  await expect(a1001.getByRole('rowheader')).toHaveText('Whitfield Investment A1001');
  await expect(a1001.getByRole('cell').nth(0)).toHaveText('CAD');
  await expect(a1001.getByRole('cell').nth(1)).toHaveText(/^\D*25,000\.00$/);
  const a1002 = eleanorAccounts.filter({ hasText: 'A1002' });
  await expect(a1002.getByRole('rowheader')).toHaveText('Whitfield Savings A1002');
  await expect(a1002.getByRole('cell').nth(0)).toHaveText('CAD');
  await expect(a1002.getByRole('cell').nth(1)).toHaveText(/^\D*10,000\.00$/);

  await expect(eleanorAccounts.filter({ hasText: 'A1003' })).toHaveCount(0);
  await expect(detail(page, ELEANOR.name)).not.toContainText('Chen USD Investment');

  await selectClient(page, JAMES);
  const jamesAccounts = accountRows(page, JAMES.name);
  await expect(jamesAccounts).toHaveCount(1);
  await expect(jamesAccounts.getByRole('rowheader')).toHaveText('Chen USD Investment A1003');
  await expect(jamesAccounts.getByRole('cell').nth(0)).toHaveText('USD');
  await expect(jamesAccounts.getByRole('cell').nth(1)).toHaveText(/^\D*15,000\.00$/);

  await expect(jamesAccounts.filter({ hasText: /A1001|A1002/ })).toHaveCount(0);
  await expect(jamesAccounts.getByRole('cell').filter({ hasText: /^CAD$/ })).toHaveCount(0);
});

caseTest('WM-TC-004', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, ELEANOR);
  await openEditor(page, ELEANOR);
  await expect(formRisk(page)).toHaveValue('Moderate');
  await expect(formKyc(page)).toHaveValue('Current');

  await formRisk(page).click();
  await expect(formRisk(page).locator('option')).toHaveText(['Conservative', 'Moderate', 'Growth']);

  await formKyc(page).click();
  await expect(formKyc(page).locator('option')).toHaveText(['Current', 'Review due']);

  await choose(formRisk(page), 'Growth');
  await expect(formKyc(page)).toHaveValue('Current');
  await saveProfile(page, ELEANOR, 'Growth', 'Current');
  await expectSavedProfile(page, ELEANOR, 'Growth', 'Current');
  await expectListedProfile(page, ELEANOR.id, 'Growth', 'Current');

  await reloadAndReselect(page, ELEANOR);
  await expectSavedProfile(page, ELEANOR, 'Growth', 'Current');
  await expectListedProfile(page, ELEANOR.id, 'Growth', 'Current');

  await viewAudit(page);
  const entries = auditEntries(page).filter({ hasText: ELEANOR.id });
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Risk profile Moderate → Growth');
});

caseTest('WM-TC-005', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, JAMES);
  await openEditor(page, JAMES);
  await expect(formRisk(page)).toHaveValue('Conservative');
  await expect(formKyc(page)).toHaveValue('Review due');

  await choose(formKyc(page), 'Current');
  await expect(formRisk(page)).toHaveValue('Conservative');
  await saveProfile(page, JAMES, 'Conservative', 'Current');
  await expectSavedProfile(page, JAMES, 'Conservative', 'Current');
  await expectListedProfile(page, JAMES.id, 'Conservative', 'Current');

  await reloadAndReselect(page, JAMES);
  await expectSavedProfile(page, JAMES, 'Conservative', 'Current');
  await expectListedProfile(page, JAMES.id, 'Conservative', 'Current');

  await viewAudit(page);
  const entries = auditEntries(page).filter({ hasText: JAMES.id });
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('KYC status Review due → Current');
});

caseTest('WM-TC-006', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, ELEANOR);
  await openEditor(page, ELEANOR);
  await expect(formRisk(page)).toHaveValue('Moderate');
  await expect(formKyc(page)).toHaveValue('Current');

  await choose(formRisk(page), 'Conservative');
  await choose(formKyc(page), 'Review due');
  await profileForm(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(profileForm(page)).toBeHidden();
  await expectSavedProfile(page, ELEANOR, 'Moderate', 'Current');
  await expectListedProfile(page, ELEANOR.id, 'Moderate', 'Current');

  await reloadAndReselect(page, ELEANOR);
  await expectSavedProfile(page, ELEANOR, 'Moderate', 'Current');
  await expectListedProfile(page, ELEANOR.id, 'Moderate', 'Current');

  await viewAudit(page);
  await expect(auditEntries(page).filter({ hasText: ELEANOR.id })).toHaveCount(0);
});

caseTest('WM-TC-007', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, JAMES);
  await openEditor(page, JAMES);
  await choose(formRisk(page), 'Growth');
  await saveProfile(page, JAMES, 'Growth', 'Review due');
  await expectSavedProfile(page, JAMES, 'Growth', 'Review due');

  await selectClient(page, ELEANOR);
  await expectSavedProfile(page, ELEANOR, 'Moderate', 'Current');

  await page.reload();
  await clientsTab(page).click();
  await expect(clientRows(page)).toHaveCount(2);
  await expectListedProfile(page, ELEANOR.id, 'Moderate', 'Current');
  await expectListedProfile(page, JAMES.id, 'Growth', 'Review due');

  await viewAudit(page);
  await expect(auditEntries(page)).toHaveCount(1);
  await expect(auditEntries(page).first()).toContainText(JAMES.id);
  await expect(auditEntries(page).first()).not.toContainText(ELEANOR.id);
});

caseTest('WM-TC-008', async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, JAMES);
  await openEditor(page, JAMES);
  await expect(formRisk(page)).toHaveValue('Conservative');
  await expect(formKyc(page)).toHaveValue('Review due');

  await choose(formRisk(page), 'Moderate');
  await choose(formKyc(page), 'Current');
  await saveProfile(page, JAMES, 'Moderate', 'Current');
  await expectSavedProfile(page, JAMES, 'Moderate', 'Current');

  await reloadAndReselect(page, JAMES);
  await expectSavedProfile(page, JAMES, 'Moderate', 'Current');
  await expectListedProfile(page, JAMES.id, 'Moderate', 'Current');

  await viewAudit(page);
  const entries = auditEntries(page).filter({ hasText: JAMES.id });
  await expect(entries.filter({ hasText: 'Risk profile Conservative → Moderate' })).not.toHaveCount(0);
  await expect(entries.filter({ hasText: 'KYC status Review due → Current' })).not.toHaveCount(0);

  await selectClient(page, ELEANOR);
  await expectSavedProfile(page, ELEANOR, 'Moderate', 'Current');
  await expectListedProfile(page, ELEANOR.id, 'Moderate', 'Current');
});

caseTest('WM-TC-051', async ({ page }) => {
  await openArea(page, 'clients');
  const jamesPanel = detail(page, JAMES.name);
  const holdingsRows = page.getByRole('region', { name: 'Holdings' }).getByRole('table', { name: 'Holdings' })
    .getByRole('row').filter({ has: page.getByRole('rowheader') });

  await journeyStep(page, 'Search the client book for C1002', async () => {
    await searchBox(page).click();
    await searchBox(page).fill('C1002');
    await expect(clientRows(page)).toHaveCount(1);
    await expect(clientRow(page, JAMES.id).getByRole('rowheader')).toHaveText(JAMES.name);
  });

  await journeyStep(page, 'Filter the client book to KYC Review due', async () => {
    await choose(kycFilter(page), 'Review due');
    await expect(clientRows(page)).toHaveCount(1);
    await expectListedProfile(page, JAMES.id, 'Conservative', 'Review due');
  });

  await journeyStep(page, 'Open James Chen from the client book', async () => {
    await selectClient(page, JAMES);
    await expect(detailValue(jamesPanel, 'Client ID')).toHaveText(JAMES.id);
    const accounts = accountRows(page, JAMES.name);
    await expect(accounts).toHaveCount(1);
    await expect(accounts.getByRole('rowheader')).toHaveText('Chen USD Investment A1003');
    await expect(accounts.getByRole('cell').nth(0)).toHaveText('USD');
    await expect(accounts.getByRole('cell').nth(1)).toHaveText(/^\D*15,000\.00$/);
  });

  await journeyStep(page, 'Open the profile editor', async () => {
    await openEditor(page, JAMES);
    await expect(formRisk(page)).toHaveValue('Conservative');
    await expect(formKyc(page)).toHaveValue('Review due');
  });

  await journeyStep(page, 'Draft risk profile Moderate', async () => {
    await choose(formRisk(page), 'Moderate');
    await expect(detailValue(jamesPanel, 'Risk profile')).toHaveText('Conservative');
  });

  await journeyStep(page, 'Draft KYC status Current', async () => {
    await choose(formKyc(page), 'Current');
    await expect(detailValue(jamesPanel, 'KYC status')).toHaveText('Review due');
  });

  await journeyStep(page, 'Save the profile', async () => {
    await saveProfile(page, JAMES, 'Moderate', 'Current');
    await expectSavedProfile(page, JAMES, 'Moderate', 'Current');
  });

  await journeyStep(page, 'Open the portfolio for James Chen', async () => {
    await jamesPanel.getByRole('button', { name: 'View portfolio' }).click();
    await expect(portfolioTab(page)).toHaveAttribute('aria-selected', 'true');
    const clientFilter = page.getByRole('combobox', { name: 'Client', exact: true });
    await expect(clientFilter).toHaveValue(JAMES.id);
    await expect(clientFilter.locator('option:checked')).toHaveText(`${JAMES.name} (${JAMES.id})`);
    const cashRows = page.getByRole('region', { name: 'Cash by account' }).getByRole('row').filter({ has: page.getByRole('rowheader') });
    await expect(cashRows).toHaveCount(1);
    await expect(cashRows.getByRole('cell').nth(0)).toHaveText(JAMES.name);
    await expect(holdingsRows).toHaveCount(1);
    await expect(holdingsRows.getByRole('cell').nth(1)).toContainText('A1003');
  });

  await journeyStep(page, 'Scope the portfolio to account A1003', async () => {
    await choose(page.getByRole('combobox', { name: 'Account', exact: true }), 'A1003');
    await expect(holdingsRows).toHaveCount(1);
    const msft = holdingsRows.filter({ hasText: 'MSFT' });
    await expect(msft.getByRole('rowheader')).toHaveText('MSFT');
    await expect(msft.getByRole('cell').nth(1)).toContainText('A1003');
    await expect(msft.getByRole('cell').nth(3)).toHaveText('40');
    await expect(msft.getByRole('cell').nth(5)).toHaveText(/^\D*16,800\.00$/);
    await expect(msft.getByRole('cell').nth(2)).toHaveText('USD');
  });

  await journeyStep(page, 'Filter holdings to instrument MSFT', async () => {
    await choose(page.getByRole('combobox', { name: 'Instrument', exact: true }), 'MSFT');
    await expect(holdingsRows).toHaveCount(1);
    await expect(holdingsRows.getByRole('rowheader')).toHaveText('MSFT');
    await expect(holdingsRows.getByRole('cell').nth(1)).toContainText('A1003');
    await expect(holdingsRows.getByRole('cell').nth(2)).toHaveText('USD');
    await expect(holdingsRows.getByRole('cell').nth(3)).toHaveText('40');
  });

  await journeyStep(page, 'Return to the Clients workspace tab', async () => {
    await clientsTab(page).click();
    await expect(clientsTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(clientBook(page)).toBeVisible();
  });

  await journeyStep(page, 'Reopen James Chen', async () => {
    await selectClient(page, JAMES);
    await expectSavedProfile(page, JAMES, 'Moderate', 'Current');
    const accounts = accountRows(page, JAMES.name);
    await expect(accounts).toHaveCount(1);
    await expect(accounts.getByRole('rowheader')).toHaveText('Chen USD Investment A1003');
  });

  await journeyStep(page, 'Refresh workspace data', async () => {
    await page.getByRole('button', { name: 'Refresh data' }).click();
    await expect(page.getByText(/^Data loaded /)).toBeVisible();
    await expectSavedProfile(page, JAMES, 'Moderate', 'Current');
    await expectListedProfile(page, JAMES.id, 'Moderate', 'Current');
    await expectListedProfile(page, ELEANOR.id, 'Moderate', 'Current');
  });

  await journeyStep(page, 'Inspect the saved profile fields and cancel', async () => {
    await openEditor(page, JAMES);
    await expect(formRisk(page)).toHaveValue('Moderate');
    await expect(formKyc(page)).toHaveValue('Current');
    await profileForm(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(profileForm(page)).toBeHidden();
    await expectSavedProfile(page, JAMES, 'Moderate', 'Current');
    const accounts = accountRows(page, JAMES.name);
    await expect(accounts).toHaveCount(1);
    await expect(accounts.getByRole('cell').nth(1)).toHaveText(/^\D*15,000\.00$/);
    await expect(auditEntries(page).filter({ hasText: JAMES.id })).toHaveCount(1);
  });
});

gapTest('WM-GAP-001', {
  title: 'Workspace browser Back/Forward restores the area and selected client consistently',
  area: 'clients',
  wikiRef: WIKI_ROUTING
}, async ({ page }) => {
  await openArea(page, 'clients');

  await selectClient(page, JAMES);
  await expect(clientBook(page).getByRole('button', { name: JAMES.name })).toHaveAttribute('aria-pressed', 'true');

  await detail(page, JAMES.name).getByRole('button', { name: 'View portfolio' }).click();
  await expect(portfolioTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('combobox', { name: 'Client', exact: true })).toHaveValue(JAMES.id);

  await page.goBack();
  await expect(clientsTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clients');
  await expect(clientBook(page)).toBeVisible();
  await expect(clientBook(page).getByRole('button', { name: JAMES.name })).toHaveAttribute('aria-pressed', 'true');
  await expect(detail(page, JAMES.name)).toBeVisible();
  await expectSavedProfile(page, JAMES, 'Conservative', 'Review due');

  await page.goForward();
  await expect(portfolioTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Portfolio');
  await expect(page.getByRole('combobox', { name: 'Client', exact: true })).toHaveValue(JAMES.id);
});
