import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, openArea } from '../tooling/fixtures';

const OWNERS = ['A. Nguyen', 'S. Patel'];

const queueTable = (page: Page) => page.getByRole('table', { name: 'Settlement exceptions' });
const queueRows = (page: Page) => queueTable(page).locator('tbody tr').filter({ has: page.getByRole('rowheader') });
const queueRow = (page: Page, id: string) =>
  queueTable(page).locator('tbody tr').filter({ has: page.getByRole('button', { name: `Open exception ${id}`, exact: true }) });
const emptyQueueMessage = (page: Page) => queueTable(page).getByText('No exceptions match these filters');
const statusFilter = (page: Page) => page.getByLabel('Filter by status', { exact: true });
const detailPanel = (page: Page, id: string) => page.getByRole('region', { name: `Exception ${id}`, exact: true });
const detailValue = (panel: Locator, term: string) =>
  panel.locator(`xpath=.//dl/dt[normalize-space()="${term}"]/following-sibling::dd[1]`);
const auditEntries = (page: Page, id: string) =>
  page.getByRole('list', { name: 'Audit entries' }).getByRole('listitem').filter({ hasText: id });

const openSettlements = async (page: Page) => {
  await openArea(page, 'settlements');
  await expectSettlementsLoaded(page);
};

const expectSettlementsLoaded = async (page: Page) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Settlements' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Settlements/ })).toHaveAttribute('aria-selected', 'true');
  await expect(queueTable(page)).toBeVisible();
};

const reloadSettlements = async (page: Page) => {
  await page.reload();
  await page.waitForLoadState('load');
  await expectSettlementsLoaded(page);
};

const filterStatus = async (page: Page, label: string) => {
  await statusFilter(page).selectOption({ label });
  await expect(statusFilter(page)).toHaveValue(label === 'All statuses' ? 'All' : label);
};

const openException = async (page: Page, id: string) => {
  await page.getByRole('button', { name: `Open exception ${id}`, exact: true }).click();
  const panel = detailPanel(page, id);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: `Exception ${id}`, exact: true })).toBeVisible();
  return panel;
};

const listedIds = async (page: Page) =>
  (await queueRows(page).getByRole('rowheader').allTextContents()).map(text => text.trim()).sort();

const expectRow = async (page: Page, id: string, owner: string, status: string) => {
  const cells = queueRow(page, id).getByRole('cell');
  await expect(cells.nth(2)).toHaveText(owner);
  await expect(cells.nth(3)).toHaveText(status);
};

const expectDetail = async (panel: Locator, values: { status: string; owner: string; note: string }) => {
  await expect(detailValue(panel, 'Status')).toHaveText(values.status);
  await expect(detailValue(panel, 'Owner')).toHaveText(values.owner);
  await expect(detailValue(panel, 'Note')).toHaveText(values.note);
};

const ownerSelect = (panel: Locator) => panel.getByLabel('Owner', { exact: true });
const statusSelect = (panel: Locator) => panel.getByLabel('Status', { exact: true });
const noteBox = (panel: Locator) => panel.getByLabel('Note', { exact: true });
const saveButton = (panel: Locator) => panel.getByRole('button', { name: 'Save changes' });

const save = async (panel: Locator) => {
  await saveButton(panel).click();
  await expect(saveButton(panel).or(panel.getByText('Resolved exceptions are closed'))).toBeVisible();
};

const expectSaved = async (panel: Locator, id: string) => {
  await expect(panel.getByRole('status')).toContainText(`Exception ${id} updated`);
  await expect(panel.getByRole('alert')).toHaveCount(0);
};

const expectRejected = async (panel: Locator, message: RegExp) => {
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveText(message);
  await expect(panel.getByRole('status')).toHaveCount(0);
};

caseTest('WM-TC-045', async ({ page }) => {
  await openSettlements(page);

  // Step 1: two seeded exceptions are listed.
  await expect(queueRows(page)).toHaveCount(2);
  expect(await listedIds(page)).toEqual(['EX1001', 'EX1002']);
  const ex1 = queueRow(page, 'EX1001').getByRole('cell');
  const ex2 = queueRow(page, 'EX1002').getByRole('cell');
  await expect(ex1.nth(0)).toHaveText('Missing settlement instructions');
  await expect(ex1.nth(1)).toContainText('(A1001)');
  await expect(ex2.nth(0)).toHaveText('Cash reconciliation');
  await expect(ex2.nth(1)).toContainText('(A1003)');

  // Step 2: both Open and unassigned.
  await expectRow(page, 'EX1001', 'Unassigned', 'Open');
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');

  // Step 3: filter Open lists both.
  await filterStatus(page, 'Open');
  await expect(queueRows(page)).toHaveCount(2);
  expect(await listedIds(page)).toEqual(['EX1001', 'EX1002']);
  await expect(emptyQueueMessage(page)).toHaveCount(0);

  // Step 4: In progress and Resolved show no exceptions with an empty-result message.
  await filterStatus(page, 'In progress');
  await expect(queueRows(page)).toHaveCount(0);
  await expect(emptyQueueMessage(page)).toBeVisible();
  await filterStatus(page, 'Resolved');
  await expect(queueRows(page)).toHaveCount(0);
  await expect(emptyQueueMessage(page)).toBeVisible();
});

caseTest('WM-TC-046', async ({ page }) => {
  await openSettlements(page);

  // Step 1: owner choice offers A. Nguyen and S. Patel.
  let panel = await openException(page, 'EX1001');
  const offered = await ownerSelect(panel).locator('option').evaluateAll(options =>
    options.filter(o => (o as HTMLOptionElement).value !== '').map(o => (o.textContent ?? '').trim()));
  expect(offered.sort()).toEqual(OWNERS);

  // Step 2: assign A. Nguyen and save.
  await ownerSelect(panel).selectOption({ label: 'A. Nguyen' });
  await save(panel);
  await expectSaved(panel, 'EX1001');
  await expect(detailValue(panel, 'Owner')).toHaveText('A. Nguyen');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Open');

  // Step 3: set In progress and save.
  await statusSelect(panel).selectOption({ label: 'In progress' });
  await save(panel);
  await expectSaved(panel, 'EX1001');
  await expect(detailValue(panel, 'Status')).toHaveText('In progress');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'In progress');

  // Step 4: filter In progress lists only EX1001; EX1002 is still Open and unassigned.
  await filterStatus(page, 'In progress');
  await expect(queueRows(page)).toHaveCount(1);
  expect(await listedIds(page)).toEqual(['EX1001']);
  await filterStatus(page, 'All statuses');
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');

  // Step 5: reload and return to Settlements; EX1001 persists.
  await reloadSettlements(page);
  await expectRow(page, 'EX1001', 'A. Nguyen', 'In progress');
  panel = await openException(page, 'EX1001');
  await expect(detailValue(panel, 'Owner')).toHaveText('A. Nguyen');
  await expect(detailValue(panel, 'Status')).toHaveText('In progress');

  // Step 6: audit history records the owner assignment and the status change.
  const entries = auditEntries(page, 'EX1001');
  await expect(entries.filter({ hasText: 'Owner assigned: A. Nguyen' })).toHaveCount(1);
  await expect(entries.filter({ hasText: 'Status Open → In progress' })).toHaveCount(1);
});

caseTest('WM-TC-047', async ({ page }) => {
  const note = 'Cash break cleared with custodian statement';
  await openSettlements(page);

  // Step 1: resolving without an owner is rejected.
  let panel = await openException(page, 'EX1002');
  await expect(ownerSelect(panel)).toHaveValue('');
  await noteBox(panel).fill(note);
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel);
  await expectRejected(panel, /owner is required/i);
  await expectDetail(panel, { status: 'Open', owner: 'Unassigned', note: 'No note yet' });
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');
  await expect(auditEntries(page, 'EX1002')).toHaveCount(0);

  // Step 2: after reload nothing was recorded.
  await reloadSettlements(page);
  panel = await openException(page, 'EX1002');
  await expectDetail(panel, { status: 'Open', owner: 'Unassigned', note: 'No note yet' });
  await expect(auditEntries(page, 'EX1002')).toHaveCount(0);

  // Step 3: assign S. Patel, enter the note and resolve.
  await ownerSelect(panel).selectOption({ label: 'S. Patel' });
  await noteBox(panel).fill(note);
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel);
  await expectSaved(panel, 'EX1002');
  await expectDetail(panel, { status: 'Resolved', owner: 'S. Patel', note });

  // Step 4: persists after reload.
  await reloadSettlements(page);
  await filterStatus(page, 'All statuses');
  panel = await openException(page, 'EX1002');
  await expectDetail(panel, { status: 'Resolved', owner: 'S. Patel', note });
});

caseTest('WM-TC-048', async ({ page }) => {
  await openSettlements(page);

  // Step 1: assign A. Nguyen and save.
  let panel = await openException(page, 'EX1001');
  await ownerSelect(panel).selectOption({ label: 'A. Nguyen' });
  await save(panel);
  await expectSaved(panel, 'EX1001');
  await expect(detailValue(panel, 'Owner')).toHaveText('A. Nguyen');
  await expect(auditEntries(page, 'EX1001')).toHaveCount(1);

  // Step 2: a 9-character note is rejected.
  await noteBox(panel).fill('Confirmed');
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel);
  await expectRejected(panel, /at least 10 characters/i);
  await expectDetail(panel, { status: 'Open', owner: 'A. Nguyen', note: 'No note yet' });
  await expect(auditEntries(page, 'EX1001')).toHaveCount(1);

  // Step 3: a note of ten spaces is rejected.
  await noteBox(panel).fill(' '.repeat(10));
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(statusSelect(panel)).toHaveValue('Resolved');
  await save(panel);
  await expectRejected(panel, /note/i);
  await expectDetail(panel, { status: 'Open', owner: 'A. Nguyen', note: 'No note yet' });
  await expect(auditEntries(page, 'EX1001')).toHaveCount(1);

  // Step 4: a 10-character note resolves.
  await noteBox(panel).fill('Confirmed.');
  await expect(statusSelect(panel)).toHaveValue('Resolved');
  await save(panel);
  await expectSaved(panel, 'EX1001');
  await expectDetail(panel, { status: 'Resolved', owner: 'A. Nguyen', note: 'Confirmed.' });

  // Step 5: persists after reload.
  await reloadSettlements(page);
  await filterStatus(page, 'All statuses');
  panel = await openException(page, 'EX1001');
  await expectDetail(panel, { status: 'Resolved', owner: 'A. Nguyen', note: 'Confirmed.' });
});

caseTest('WM-TC-049', async ({ page }) => {
  const note = 'SSI received from custodian';
  await openSettlements(page);

  // Step 1: resolve EX1001.
  let panel = await openException(page, 'EX1001');
  await ownerSelect(panel).selectOption({ label: 'A. Nguyen' });
  await noteBox(panel).fill(note);
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel);
  await expectSaved(panel, 'EX1001');
  await expect(detailValue(panel, 'Status')).toHaveText('Resolved');
  const auditCount = await auditEntries(page, 'EX1001').count();

  // Steps 2 and 3: no Open or In progress option is available; status stays Resolved.
  for (const target of ['Open', 'In progress']) {
    await expect(panel.getByRole('combobox')).toHaveCount(0);
    await expect(panel.getByRole('option', { name: target, exact: true })).toHaveCount(0);
    await expect(statusSelect(panel)).toHaveCount(0);
    await expect(saveButton(panel)).toHaveCount(0);
    await expect(panel.getByText('Resolved exceptions are closed and can’t be reopened or edited.')).toBeVisible();
    await expect(detailValue(panel, 'Status')).toHaveText('Resolved');
  }
  await filterStatus(page, 'All statuses');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Resolved');
  await expect(auditEntries(page, 'EX1001')).toHaveCount(auditCount);

  // Step 4: still Resolved with the original owner and note after reload.
  await reloadSettlements(page);
  await filterStatus(page, 'All statuses');
  panel = await openException(page, 'EX1001');
  await expectDetail(panel, { status: 'Resolved', owner: 'A. Nguyen', note });
  await expect(statusSelect(panel)).toHaveCount(0);
});

caseTest('WM-TC-050', async ({ page }) => {
  const note = 'Reconciled to bank statement';
  await openSettlements(page);

  // Step 1: assign S. Patel and set In progress.
  let panel = await openException(page, 'EX1002');
  await ownerSelect(panel).selectOption({ label: 'S. Patel' });
  await save(panel);
  await expectSaved(panel, 'EX1002');
  await statusSelect(panel).selectOption({ label: 'In progress' });
  await save(panel);
  await expectSaved(panel, 'EX1002');
  await expect(detailValue(panel, 'Owner')).toHaveText('S. Patel');
  await expect(detailValue(panel, 'Status')).toHaveText('In progress');

  // Step 2: resolving with 'Done' is rejected.
  await noteBox(panel).fill('Done');
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel);
  await expectRejected(panel, /at least 10 characters/i);
  await expectDetail(panel, { status: 'In progress', owner: 'S. Patel', note: 'No note yet' });
  await expect(auditEntries(page, 'EX1002')).toHaveCount(2);

  // Step 3: resolve with a meaningful note.
  await noteBox(panel).fill(note);
  await expect(statusSelect(panel)).toHaveValue('Resolved');
  await save(panel);
  await expectSaved(panel, 'EX1002');
  await expect(detailValue(panel, 'Status')).toHaveText('Resolved');

  // Step 4: filter Resolved lists only EX1002; EX1001 remains Open and unassigned.
  await filterStatus(page, 'Resolved');
  await expect(queueRows(page)).toHaveCount(1);
  expect(await listedIds(page)).toEqual(['EX1002']);
  await filterStatus(page, 'All statuses');
  await expectRow(page, 'EX1001', 'Unassigned', 'Open');

  // Step 5: audit history (newest first) shows owner, In progress, resolved; no rejected attempt.
  const expectLifecycleAudit = async () => {
    const entries = auditEntries(page, 'EX1002');
    await expect(entries).toHaveCount(3);
    await expect(entries.nth(2)).toContainText('Owner assigned: S. Patel');
    await expect(entries.nth(1)).toContainText('Status Open → In progress');
    await expect(entries.nth(0)).toContainText('Status In progress → Resolved');
    await expect(entries.nth(0)).toContainText(`Note: ${note}`);
    await expect(entries.filter({ hasText: 'Done' })).toHaveCount(0);
  };
  await expectLifecycleAudit();

  // Step 6: same entries after reload.
  await reloadSettlements(page);
  await expectLifecycleAudit();
});
