import { caseTest, gapTest, expect, openArea } from '../tooling/fixtures';
import type { Locator, Page } from '@playwright/test';

const clientTable = (page: Page) => page.getByRole('table', { name: 'Clients', exact: true });
const clientRows = (page: Page) => clientTable(page).locator('tbody tr').filter({ has: page.getByRole('rowheader') });
const clientRow = (page: Page, id: string) => clientRows(page).filter({ has: page.getByRole('cell', { name: id, exact: true }) });
const detail = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const accountRows = (page: Page, name: string) =>
  detail(page, name).getByRole('table', { name: `Accounts for ${name}` }).locator('tbody tr');
const profileForm = (page: Page) => page.getByRole('form', { name: 'Edit profile' });
const auditEntries = (page: Page) =>
  page.getByRole('complementary', { name: 'Audit trail' }).getByRole('list', { name: 'Audit entries' }).getByRole('listitem');
const clientAuditEntries = (page: Page) => auditEntries(page).filter({ hasText: 'client.updated' });

const CLIENTS = { C1001: 'Eleanor Whitfield', C1002: 'James Chen' } as const;
type ClientId = keyof typeof CLIENTS;

async function expectClientRow(page: Page, id: ClientId, risk: string, kyc: string) {
  const row = clientRow(page, id);
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('rowheader')).toHaveText(CLIENTS[id]);
  await expect(row.getByRole('cell').nth(1)).toHaveText(risk);
  await expect(row.getByRole('cell').nth(2)).toHaveText(kyc);
}

async function expectListedIds(page: Page, ids: ClientId[]) {
  await expect(clientRows(page)).toHaveCount(ids.length);
  for (const id of ids) await expect(clientRow(page, id)).toHaveCount(1);
}

async function openClients(page: Page) {
  await openArea(page, 'clients');
  await expect(clientTable(page)).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Audit trail' })).toBeVisible();
}

async function selectClient(page: Page, id: ClientId) {
  const name = CLIENTS[id];
  await clientRow(page, id).getByRole('button', { name, exact: true }).click();
  await expect(clientRow(page, id).getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(detail(page, name)).toBeVisible();
}

async function expectDetailProfile(page: Page, id: ClientId, risk: string, kyc: string) {
  const panel = detail(page, CLIENTS[id]);
  await expect(panel.locator('dt:text-is("Client ID") + dd')).toHaveText(id);
  await expect(panel.locator('dt:text-is("Risk profile") + dd')).toHaveText(risk);
  await expect(panel.locator('dt:text-is("KYC status") + dd')).toHaveText(kyc);
}

async function openEdit(page: Page, id: ClientId) {
  await detail(page, CLIENTS[id]).getByRole('button', { name: 'Edit profile' }).click();
  await expect(profileForm(page)).toBeVisible();
}

const riskSelect = (page: Page) => profileForm(page).getByLabel('Risk profile', { exact: true });
const kycSelect = (page: Page) => profileForm(page).getByLabel('KYC status', { exact: true });

async function expectFormValues(page: Page, risk: string, kyc: string) {
  await expect(riskSelect(page)).toHaveValue(risk);
  await expect(kycSelect(page)).toHaveValue(kyc);
}

async function expectOptions(select: Locator, options: string[]) {
  await expect(select.getByRole('option')).toHaveText(options);
}

async function save(page: Page, id: ClientId) {
  await profileForm(page).getByRole('button', { name: 'Save profile' }).click();
  await expect(detail(page, CLIENTS[id]).getByRole('status')).toContainText(`Profile saved for ${CLIENTS[id]}`);
  await expect(profileForm(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

async function reload(page: Page) {
  await page.reload();
  await expect(clientTable(page)).toBeVisible();
}

caseTest('WM-TC-001', async ({ page }) => {
  await openClients(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
  await expectListedIds(page, ['C1001', 'C1002']);
  await expect(clientRow(page, 'C1001').getByRole('rowheader')).toHaveText('Eleanor Whitfield');
  await expect(clientRow(page, 'C1002').getByRole('rowheader')).toHaveText('James Chen');

  await expectClientRow(page, 'C1001', 'Moderate', 'Current');
  await expectClientRow(page, 'C1002', 'Conservative', 'Review due');

  await reload(page);
  await expectListedIds(page, ['C1001', 'C1002']);
  await expectClientRow(page, 'C1001', 'Moderate', 'Current');
  await expectClientRow(page, 'C1002', 'Conservative', 'Review due');
});

caseTest('WM-TC-002', async ({ page }) => {
  await openClients(page);
  const search = page.getByRole('searchbox', { name: 'Search clients' });
  const emptyMessage = clientTable(page).getByText('No clients match these filters');

  await search.fill('Whitfield');
  await expectListedIds(page, ['C1001']);
  await expect(clientRow(page, 'C1001').getByRole('rowheader')).toHaveText('Eleanor Whitfield');

  await search.fill('C1002');
  await expectListedIds(page, ['C1002']);
  await expect(clientRow(page, 'C1002').getByRole('rowheader')).toHaveText('James Chen');

  await search.fill('Zhang');
  await expect(clientRows(page)).toHaveCount(0);
  await expect(emptyMessage).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await search.fill('');
  await expectListedIds(page, ['C1001', 'C1002']);
  await expect(emptyMessage).toHaveCount(0);
});

caseTest('WM-TC-003', async ({ page }) => {
  await openClients(page);

  await selectClient(page, 'C1001');
  const whitfield = accountRows(page, 'Eleanor Whitfield');
  await expect(whitfield).toHaveCount(2);
  const a1001 = whitfield.filter({ hasText: 'A1001' });
  await expect(a1001.getByRole('rowheader')).toHaveText('Whitfield Investment A1001');
  await expect(a1001.getByRole('cell').nth(0)).toHaveText('CAD');
  await expect(a1001.getByRole('cell').nth(1)).toHaveText('$25,000.00');
  const a1002 = whitfield.filter({ hasText: 'A1002' });
  await expect(a1002.getByRole('rowheader')).toHaveText('Whitfield Savings A1002');
  await expect(a1002.getByRole('cell').nth(0)).toHaveText('CAD');
  await expect(a1002.getByRole('cell').nth(1)).toHaveText('$10,000.00');

  await expect(whitfield.filter({ hasText: 'A1003' })).toHaveCount(0);
  await expect(detail(page, 'Eleanor Whitfield').getByText('Chen USD Investment')).toHaveCount(0);

  await selectClient(page, 'C1002');
  const chen = accountRows(page, 'James Chen');
  await expect(chen).toHaveCount(1);
  await expect(chen.getByRole('rowheader')).toHaveText('Chen USD Investment A1003');
  await expect(chen.getByRole('cell').nth(0)).toHaveText('USD');
  await expect(chen.getByRole('cell').nth(1)).toHaveText('US$15,000.00');

  await expect(chen.filter({ hasText: 'A1001' })).toHaveCount(0);
  await expect(chen.filter({ hasText: 'A1002' })).toHaveCount(0);
  await expect(chen.getByRole('cell', { name: 'CAD', exact: true })).toHaveCount(0);
});

caseTest('WM-TC-004', async ({ page }) => {
  await openClients(page);
  const before = await clientAuditEntries(page).count();

  await selectClient(page, 'C1001');
  await openEdit(page, 'C1001');
  await expectFormValues(page, 'Moderate', 'Current');

  await expectOptions(riskSelect(page), ['Conservative', 'Moderate', 'Growth']);
  await expectOptions(kycSelect(page), ['Current', 'Review due']);

  await riskSelect(page).selectOption('Growth');
  await expect(kycSelect(page)).toHaveValue('Current');
  await save(page, 'C1001');
  await expectDetailProfile(page, 'C1001', 'Growth', 'Current');
  await expectClientRow(page, 'C1001', 'Growth', 'Current');

  await reload(page);
  await selectClient(page, 'C1001');
  await expectDetailProfile(page, 'C1001', 'Growth', 'Current');

  const entries = clientAuditEntries(page);
  await expect(entries).toHaveCount(before + 1);
  const entry = entries.filter({ hasText: 'C1001' }).filter({ hasText: 'Risk profile Moderate → Growth' });
  await expect(entry).toHaveCount(1);
});

caseTest('WM-TC-005', async ({ page }) => {
  await openClients(page);
  const before = await clientAuditEntries(page).count();

  await selectClient(page, 'C1002');
  await openEdit(page, 'C1002');
  await expectFormValues(page, 'Conservative', 'Review due');

  await kycSelect(page).selectOption('Current');
  await expect(riskSelect(page)).toHaveValue('Conservative');
  await save(page, 'C1002');
  await expectDetailProfile(page, 'C1002', 'Conservative', 'Current');
  await expectClientRow(page, 'C1002', 'Conservative', 'Current');

  await reload(page);
  await selectClient(page, 'C1002');
  await expectDetailProfile(page, 'C1002', 'Conservative', 'Current');

  const entries = clientAuditEntries(page);
  await expect(entries).toHaveCount(before + 1);
  const entry = entries.filter({ hasText: 'C1002' }).filter({ hasText: 'KYC status Review due → Current' });
  await expect(entry).toHaveCount(1);
});

caseTest('WM-TC-006', async ({ page }) => {
  await openClients(page);
  const before = await clientAuditEntries(page).filter({ hasText: 'C1001' }).count();

  await selectClient(page, 'C1001');
  await openEdit(page, 'C1001');
  await expectFormValues(page, 'Moderate', 'Current');

  await riskSelect(page).selectOption('Conservative');
  await kycSelect(page).selectOption('Review due');
  await expectFormValues(page, 'Conservative', 'Review due');
  await profileForm(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(profileForm(page)).toHaveCount(0);
  await expectDetailProfile(page, 'C1001', 'Moderate', 'Current');
  await expectClientRow(page, 'C1001', 'Moderate', 'Current');

  await reload(page);
  await selectClient(page, 'C1001');
  await expectDetailProfile(page, 'C1001', 'Moderate', 'Current');

  await expect(clientAuditEntries(page).filter({ hasText: 'C1001' })).toHaveCount(before);
  await expect(clientAuditEntries(page).filter({ hasText: 'C1001' })).toHaveCount(0);
});

caseTest('WM-TC-007', async ({ page }) => {
  await openClients(page);
  const before = await clientAuditEntries(page).count();

  await selectClient(page, 'C1002');
  await openEdit(page, 'C1002');
  await riskSelect(page).selectOption('Growth');
  await save(page, 'C1002');
  await expectDetailProfile(page, 'C1002', 'Growth', 'Review due');

  await selectClient(page, 'C1001');
  await expectDetailProfile(page, 'C1001', 'Moderate', 'Current');

  await reload(page);
  await expectListedIds(page, ['C1001', 'C1002']);
  await expectClientRow(page, 'C1001', 'Moderate', 'Current');
  await expectClientRow(page, 'C1002', 'Growth', 'Review due');

  const entries = clientAuditEntries(page);
  await expect(entries).toHaveCount(before + 1);
  const newEntry = entries.first();
  await expect(newEntry).toContainText('C1002');
  await expect(newEntry).toContainText('Risk profile Conservative → Growth');
  await expect(newEntry).not.toContainText('C1001');
  await expect(entries.filter({ hasText: 'C1001' })).toHaveCount(0);
});

caseTest('WM-TC-008', async ({ page }) => {
  await openClients(page);
  const before = await clientAuditEntries(page).count();

  await selectClient(page, 'C1002');
  await openEdit(page, 'C1002');
  await expectFormValues(page, 'Conservative', 'Review due');

  await riskSelect(page).selectOption('Moderate');
  await kycSelect(page).selectOption('Current');
  await save(page, 'C1002');
  await expectDetailProfile(page, 'C1002', 'Moderate', 'Current');

  await reload(page);
  await selectClient(page, 'C1002');
  await expectDetailProfile(page, 'C1002', 'Moderate', 'Current');
  await expectClientRow(page, 'C1002', 'Moderate', 'Current');

  const entries = clientAuditEntries(page);
  await expect(entries).toHaveCount(before + 1);
  const entry = entries.filter({ hasText: 'C1002' });
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('Risk profile Conservative → Moderate');
  await expect(entry).toContainText('KYC status Review due → Current');

  await selectClient(page, 'C1001');
  await expectDetailProfile(page, 'C1001', 'Moderate', 'Current');
  await expectClientRow(page, 'C1001', 'Moderate', 'Current');
});

const AREA_CHECKS = {
  clients: { label: 'Clients', region: 'Client book' },
  portfolio: { label: 'Portfolio', region: 'Holdings' },
  orders: { label: 'Orders', region: 'New order' },
} as const;
type CheckedArea = keyof typeof AREA_CHECKS;

async function expectArea(page: Page, area: CheckedArea) {
  const { label, region } = AREA_CHECKS[area];
  await expect(page).toHaveURL(new RegExp(`[?&]area=${area}(&|$)`));
  expect(new URL(page.url()).searchParams.get('screen')).toBe('workspace');
  const tabs = page.getByRole('tablist', { name: 'Workspace areas' }).getByRole('tab');
  await expect(tabs.and(page.locator('[aria-selected="true"]'))).toHaveCount(1);
  await expect(page.getByRole('tab', { name: new RegExp(`^${label}`) })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
  await expect(page.getByRole('tabpanel', { name: new RegExp(`^${label}`) })).toBeVisible();
  await expect(page.getByRole('region', { name: region, exact: true })).toBeVisible();
  for (const [other, check] of Object.entries(AREA_CHECKS)) {
    if (other !== area) await expect(page.getByRole('region', { name: check.region, exact: true })).toHaveCount(0);
  }
}

gapTest(
  'WM-GAP-001',
  {
    title: 'Browser Back/Forward between workspace areas restores the matching area, URL and content',
    area: 'clients',
    wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/2.1'
  },
  async ({ page }) => {
    await openClients(page);
    await expectArea(page, 'clients');
    await expectListedIds(page, ['C1001', 'C1002']);

    await page.getByRole('tab', { name: /^Portfolio/ }).click();
    await expectArea(page, 'portfolio');

    await page.getByRole('tab', { name: /^Orders/ }).click();
    await expectArea(page, 'orders');

    await page.goBack();
    await expectArea(page, 'portfolio');

    await page.goBack();
    await expectArea(page, 'clients');
    await expectListedIds(page, ['C1001', 'C1002']);

    await page.goForward();
    await expectArea(page, 'portfolio');

    await page.goForward();
    await expectArea(page, 'orders');
  }
);
