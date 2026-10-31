import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';
import type { Locator, Page } from '@playwright/test';

const WIKI = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform';
const BOOTSTRAP = '**/api/workflows/bootstrap';

const WHITFIELD = 'Eleanor Whitfield';
const CHEN = 'James Chen';

const clientTable = (page: Page) => page.getByRole('table', { name: 'Clients', exact: true });
const clientNames = (page: Page) => clientTable(page).getByRole('rowheader');
const clientRow = (page: Page, name: string) =>
  clientTable(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) });
const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search clients' });
const detail = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const detailValue = (region: Locator, term: string) => region.locator(`dt:text-is("${term}") + dd`);
const profileForm = (page: Page) => page.getByRole('form', { name: 'Edit profile' });
const riskSelect = (page: Page) => profileForm(page).getByLabel('Risk profile', { exact: true });
const kycSelect = (page: Page) => profileForm(page).getByLabel('KYC status', { exact: true });
const auditPanel = (page: Page) => page.getByRole('complementary', { name: 'Audit trail' });
const auditEntries = (page: Page) => auditPanel(page).getByRole('listitem');
const accountsTable = (page: Page, name: string) => page.getByRole('table', { name: `Accounts for ${name}` });
const accountRow = (page: Page, name: string, accountId: string) =>
  accountsTable(page, name).getByRole('row').filter({ has: page.getByRole('rowheader', { name: new RegExp(`\\b${accountId}\\b`) }) });

async function expectClientsLoaded(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clients');
  await expect(clientTable(page)).toBeVisible();
}

async function expectListedProfile(page: Page, name: string, id: string, risk: string, kyc: string) {
  const row = clientRow(page, name);
  await expect(row).toHaveCount(1);
  const cells = row.getByRole('cell');
  await expect(cells.nth(0)).toHaveText(id);
  await expect(cells.nth(1)).toHaveText(risk);
  await expect(cells.nth(2)).toHaveText(kyc);
}

async function expectDetailProfile(page: Page, name: string, id: string, risk: string, kyc: string) {
  const region = detail(page, name);
  await expect(region).toBeVisible();
  await expect(detailValue(region, 'Client ID')).toHaveText(id);
  await expect(detailValue(region, 'Risk profile')).toHaveText(risk);
  await expect(detailValue(region, 'KYC status')).toHaveText(kyc);
}

async function expectProfile(page: Page, name: string, id: string, risk: string, kyc: string) {
  await expectDetailProfile(page, name, id, risk, kyc);
  await expectListedProfile(page, name, id, risk, kyc);
}

async function selectClient(page: Page, name: string) {
  const button = clientTable(page).getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(detail(page, name)).toBeVisible();
}

async function openEdit(page: Page, name: string) {
  await detail(page, name).getByRole('button', { name: 'Edit profile' }).click();
  await expect(profileForm(page)).toBeVisible();
}

async function expectFormValues(page: Page, risk: string, kyc: string) {
  await expect(riskSelect(page)).toHaveValue(risk);
  await expect(riskSelect(page).locator('option:checked')).toHaveText(risk);
  await expect(kycSelect(page)).toHaveValue(kyc);
  await expect(kycSelect(page).locator('option:checked')).toHaveText(kyc);
}

async function saveProfile(page: Page, name: string) {
  await profileForm(page).getByRole('button', { name: 'Save profile' }).click();
  await expect(detail(page, name).getByRole('status')).toContainText(/saved/i);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

async function reloadClients(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  await expectClientsLoaded(page);
}

async function auditCount(page: Page) {
  await expect(auditPanel(page)).toBeVisible();
  return auditEntries(page).count();
}

async function openAudit(page: Page) {
  await auditPanel(page).scrollIntoViewIfNeeded();
  await expect(auditPanel(page)).toBeVisible();
}

const tab = (page: Page, label: string) => page.getByRole('tab', { name: new RegExp(`^${label}`) });

async function expectArea(page: Page, slug: string, label: string) {
  await expect.poll(() => new URL(page.url()).searchParams.get('area')).toBe(slug);
  await expect(tab(page, label)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
  await expect(page.getByRole('tabpanel', { name: new RegExp(`^${label}`) })).toBeVisible();
}

caseTest('WM-TC-001', async ({ page }) => {
  await openArea(page, 'clients');
  await expectClientsLoaded(page);
  await expect(clientNames(page)).toHaveCount(2);
  await expect(clientRow(page, WHITFIELD).getByRole('cell').nth(0)).toHaveText('C1001');
  await expect(clientRow(page, CHEN).getByRole('cell').nth(0)).toHaveText('C1002');

  await expectListedProfile(page, WHITFIELD, 'C1001', 'Moderate', 'Current');
  await expectListedProfile(page, CHEN, 'C1002', 'Conservative', 'Review due');

  await reloadClients(page);
  await expect(clientNames(page)).toHaveCount(2);
  await expectListedProfile(page, WHITFIELD, 'C1001', 'Moderate', 'Current');
  await expectListedProfile(page, CHEN, 'C1002', 'Conservative', 'Review due');
});

caseTest('WM-TC-002', async ({ page }) => {
  await openArea(page, 'clients');
  await expectClientsLoaded(page);

  await searchBox(page).fill('Whitfield');
  await expect(clientNames(page)).toHaveCount(1);
  await expect(clientNames(page)).toHaveText([WHITFIELD]);
  await expect(clientRow(page, WHITFIELD).getByRole('cell').nth(0)).toHaveText('C1001');

  await searchBox(page).fill('C1002');
  await expect(clientNames(page)).toHaveCount(1);
  await expect(clientNames(page)).toHaveText([CHEN]);
  await expect(clientRow(page, CHEN).getByRole('cell').nth(0)).toHaveText('C1002');

  await searchBox(page).fill('Zhang');
  await expect(clientNames(page)).toHaveCount(0);
  await expect(clientTable(page)).toContainText(/no clients match/i);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await searchBox(page).fill('');
  await expect(clientNames(page)).toHaveCount(2);
  await expect(clientRow(page, WHITFIELD).getByRole('cell').nth(0)).toHaveText('C1001');
  await expect(clientRow(page, CHEN).getByRole('cell').nth(0)).toHaveText('C1002');
});

caseTest('WM-TC-003', async ({ page }) => {
  await openArea(page, 'clients');
  await expectClientsLoaded(page);

  await selectClient(page, WHITFIELD);
  const whitfieldAccounts = accountsTable(page, WHITFIELD);
  for (const [id, name, cash] of [['A1001', 'Whitfield Investment', '25,000.00'], ['A1002', 'Whitfield Savings', '10,000.00']]) {
    const row = accountRow(page, WHITFIELD, id);
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('rowheader')).toContainText(name);
    await expect(row.getByRole('cell').nth(0)).toHaveText('CAD');
    await expect(row.getByRole('cell').nth(1)).toContainText(cash);
  }

  await expect(whitfieldAccounts.getByRole('rowheader')).toHaveCount(2);
  await expect(whitfieldAccounts).not.toContainText('A1003');
  await expect(whitfieldAccounts).not.toContainText('Chen USD Investment');

  await selectClient(page, CHEN);
  const chenAccounts = accountsTable(page, CHEN);
  await expect(chenAccounts.getByRole('rowheader')).toHaveCount(1);
  const chenRow = accountRow(page, CHEN, 'A1003');
  await expect(chenRow.getByRole('rowheader')).toContainText('Chen USD Investment');
  await expect(chenRow.getByRole('cell').nth(0)).toHaveText('USD');
  await expect(chenRow.getByRole('cell').nth(1)).toContainText('15,000.00');

  await expect(chenAccounts).not.toContainText('A1001');
  await expect(chenAccounts).not.toContainText('A1002');
  await expect(chenAccounts.getByRole('cell', { name: 'CAD', exact: true })).toHaveCount(0);
});

caseTest('WM-TC-004', async ({ page }) => {
  await openArea(page, 'clients');
  await expectClientsLoaded(page);
  const before = await auditCount(page);

  await selectClient(page, WHITFIELD);
  await openEdit(page, WHITFIELD);
  await expectFormValues(page, 'Moderate', 'Current');

  await riskSelect(page).click();
  await expect(riskSelect(page).locator('option')).toHaveText(['Conservative', 'Moderate', 'Growth']);

  await kycSelect(page).click();
  await expect(kycSelect(page).locator('option')).toHaveText(['Current', 'Review due']);

  await riskSelect(page).selectOption('Growth');
  await expect(kycSelect(page)).toHaveValue('Current');
  await saveProfile(page, WHITFIELD);
  await expectProfile(page, WHITFIELD, 'C1001', 'Growth', 'Current');

  await reloadClients(page);
  await selectClient(page, WHITFIELD);
  await expectProfile(page, WHITFIELD, 'C1001', 'Growth', 'Current');

  await openAudit(page);
  await expect(auditEntries(page)).toHaveCount(before + 1);
  await expect(
    auditEntries(page).filter({ hasText: 'C1001' }).filter({ hasText: /risk profile\b.*\bModerate\b.*\bGrowth\b/i })
  ).toHaveCount(1);
});

caseTest('WM-TC-005', async ({ page }) => {
  await openArea(page, 'clients');
  await expectClientsLoaded(page);
  const before = await auditCount(page);

  await selectClient(page, CHEN);
  await openEdit(page, CHEN);
  await expectFormValues(page, 'Conservative', 'Review due');

  await kycSelect(page).selectOption('Current');
  await expect(riskSelect(page)).toHaveValue('Conservative');
  await saveProfile(page, CHEN);
  await expectProfile(page, CHEN, 'C1002', 'Conservative', 'Current');

  await reloadClients(page);
  await selectClient(page, CHEN);
  await expectProfile(page, CHEN, 'C1002', 'Conservative', 'Current');

  await openAudit(page);
  await expect(auditEntries(page)).toHaveCount(before + 1);
  await expect(
    auditEntries(page).filter({ hasText: 'C1002' }).filter({ hasText: /KYC status\b.*\bReview due\b.*\bCurrent\b/i })
  ).toHaveCount(1);
});

caseTest('WM-TC-006', async ({ page }) => {
  await openArea(page, 'clients');
  await expectClientsLoaded(page);

  await selectClient(page, WHITFIELD);
  await openEdit(page, WHITFIELD);
  await expectFormValues(page, 'Moderate', 'Current');

  await riskSelect(page).selectOption('Conservative');
  await kycSelect(page).selectOption('Review due');
  await expectFormValues(page, 'Conservative', 'Review due');
  await profileForm(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(profileForm(page)).toHaveCount(0);
  await expectProfile(page, WHITFIELD, 'C1001', 'Moderate', 'Current');

  await reloadClients(page);
  await selectClient(page, WHITFIELD);
  await expectProfile(page, WHITFIELD, 'C1001', 'Moderate', 'Current');

  await openAudit(page);
  await expect(auditEntries(page).filter({ hasText: 'C1001' })).toHaveCount(0);
});

caseTest('WM-TC-007', async ({ page }) => {
  await openArea(page, 'clients');
  await expectClientsLoaded(page);
  const before = await auditCount(page);

  await selectClient(page, CHEN);
  await openEdit(page, CHEN);
  await riskSelect(page).selectOption('Growth');
  await saveProfile(page, CHEN);
  await expectProfile(page, CHEN, 'C1002', 'Growth', 'Review due');

  await selectClient(page, WHITFIELD);
  await expectProfile(page, WHITFIELD, 'C1001', 'Moderate', 'Current');

  await reloadClients(page);
  await expectListedProfile(page, WHITFIELD, 'C1001', 'Moderate', 'Current');
  await expectListedProfile(page, CHEN, 'C1002', 'Growth', 'Review due');

  await openAudit(page);
  await expect(auditEntries(page)).toHaveCount(before + 1);
  const newest = auditEntries(page).first();
  await expect(newest).toContainText('C1002');
  await expect(newest).not.toContainText('C1001');
  await expect(auditEntries(page).filter({ hasText: 'C1001' })).toHaveCount(0);
});

caseTest('WM-TC-008', async ({ page }) => {
  await openArea(page, 'clients');
  await expectClientsLoaded(page);

  await selectClient(page, CHEN);
  await openEdit(page, CHEN);
  await expectFormValues(page, 'Conservative', 'Review due');

  await riskSelect(page).selectOption('Moderate');
  await kycSelect(page).selectOption('Current');
  await saveProfile(page, CHEN);
  await expectProfile(page, CHEN, 'C1002', 'Moderate', 'Current');

  await reloadClients(page);
  await selectClient(page, CHEN);
  await expectProfile(page, CHEN, 'C1002', 'Moderate', 'Current');

  await openAudit(page);
  const chenEntries = auditEntries(page).filter({ hasText: 'C1002' });
  await expect(chenEntries.filter({ hasText: /risk profile\b.*\bConservative\b.*\bModerate\b/i })).not.toHaveCount(0);
  await expect(chenEntries.filter({ hasText: /KYC status\b.*\bReview due\b.*\bCurrent\b/i })).not.toHaveCount(0);

  await selectClient(page, WHITFIELD);
  await expectProfile(page, WHITFIELD, 'C1001', 'Moderate', 'Current');
});

gapTest(
  'WM-GAP-001',
  {
    title: 'Initial workspace data request fails -> error alert, no stale data; Retry after recovery restores real data + usable controls',
    area: 'clients',
    wikiRef: `${WIKI}/page/1.2`
  },
  async ({ page }) => {
    await page.route(BOOTSTRAP, (route) => route.abort('failed'));
    await openArea(page, 'clients');

    await expect(page.getByRole('alert')).toContainText(/Workspace data couldn.t be loaded/);
    await expect(clientTable(page)).toHaveCount(0);
    await expect(page.getByText(WHITFIELD)).toHaveCount(0);
    await expect(page.getByText(CHEN)).toHaveCount(0);
    await expect(auditPanel(page)).toHaveCount(0);
    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible();

    await page.unroute(BOOTSTRAP);
    await retry.click();

    await expectClientsLoaded(page);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(retry).toHaveCount(0);
    await expect(clientNames(page)).toHaveCount(2);
    await expectListedProfile(page, WHITFIELD, 'C1001', 'Moderate', 'Current');
    await expectListedProfile(page, CHEN, 'C1002', 'Conservative', 'Review due');
    await expect(auditPanel(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh data' })).toBeEnabled();

    await searchBox(page).fill('C1002');
    await expect(clientNames(page)).toHaveText([CHEN]);
    await searchBox(page).fill('');
    await expect(clientNames(page)).toHaveCount(2);

    await selectClient(page, CHEN);
    await expectDetailProfile(page, CHEN, 'C1002', 'Conservative', 'Review due');
    await openEdit(page, CHEN);
    await expectFormValues(page, 'Conservative', 'Review due');
    await profileForm(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(profileForm(page)).toHaveCount(0);
  }
);

gapTest(
  'WM-GAP-002',
  {
    title: 'Browser Back/Forward across workspace areas keeps URL area, selected tab and heading consistent',
    area: 'clients',
    wikiRef: `${WIKI}/page/2.1`
  },
  async ({ page }) => {
    await openArea(page, 'clients');
    await expectArea(page, 'clients', 'Clients');
    await expect(clientTable(page)).toBeVisible();

    await tab(page, 'Portfolio').click();
    await expectArea(page, 'portfolio', 'Portfolio');
    await tab(page, 'Orders').click();
    await expectArea(page, 'orders', 'Orders');

    await page.goBack();
    await expectArea(page, 'portfolio', 'Portfolio');
    await page.goBack();
    await expectArea(page, 'clients', 'Clients');
    await expect(clientTable(page)).toBeVisible();

    await page.goForward();
    await expectArea(page, 'portfolio', 'Portfolio');
    await page.goForward();
    await expectArea(page, 'orders', 'Orders');
  }
);

gapTest(
  'WM-GAP-003',
  {
    title: 'Client -> Portfolio deep link (?client=) then Back returns to Clients with same client; Forward restores filtered portfolio',
    area: 'clients',
    wikiRef: `${WIKI}/page/2.1`
  },
  async ({ page }) => {
    const portfolioClient = page.getByRole('combobox', { name: 'Client', exact: true });
    const holdingSymbols = page.getByRole('table', { name: 'Holdings' }).getByRole('rowheader');
    const expectChenPortfolio = async () => {
      await expectArea(page, 'portfolio', 'Portfolio');
      await expect.poll(() => new URL(page.url()).searchParams.get('client')).toBe('C1002');
      await expect(portfolioClient.locator('option:checked')).toHaveText('James Chen (C1002)');
      await expect(holdingSymbols).toHaveText(['MSFT']);
    };

    await openArea(page, 'clients');
    await expectClientsLoaded(page);
    await selectClient(page, CHEN);
    await detail(page, CHEN).getByRole('button', { name: 'View portfolio' }).click();
    await expectChenPortfolio();

    await page.goBack();
    await expectArea(page, 'clients', 'Clients');
    await expect(clientTable(page).getByRole('button', { name: CHEN, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expectDetailProfile(page, CHEN, 'C1002', 'Conservative', 'Review due');

    await page.goForward();
    await expectChenPortfolio();
  }
);

gapTest(
  'WM-GAP-004',
  {
    title: 'Missing/invalid area param falls back to Clients workspace',
    area: 'clients',
    wikiRef: `${WIKI}/page/1.2`
  },
  async ({ page }) => {
    const expectClientsFallback = async () => {
      await expect(tab(page, 'Clients')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
      await expectClientsLoaded(page);
      await expect(page.getByRole('tabpanel', { name: /^Clients/ })).toBeVisible();
      await expect(clientNames(page)).toHaveCount(2);
      await expect(page.getByRole('alert')).toHaveCount(0);
    };

    await openArea(page, 'clients', { area: 'not-an-area' });
    await expectClientsFallback();

    await openArea(page, 'clients', { area: '' });
    await expectClientsFallback();

    await page.goto('/?screen=workspace');
    await page.waitForLoadState('load');
    await expectClientsFallback();
  }
);
