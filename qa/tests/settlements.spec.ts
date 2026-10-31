import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const WIKI = 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform';
const OWNERS = ['A. Nguyen', 'S. Patel'];

const queue = (page: Page) => page.getByRole('region', { name: 'Exception queue' });
const table = (page: Page) => queue(page).getByRole('table', { name: 'Settlement exceptions' });
const dataRows = (page: Page) => table(page).getByRole('row').filter({ has: page.getByRole('rowheader') });
const row = (page: Page, id: string) => dataRows(page).filter({ has: page.getByRole('rowheader', { name: id }) });
const rowCell = (r: Locator, column: 'reason' | 'account' | 'owner' | 'status') =>
  r.getByRole('cell').nth({ reason: 0, account: 1, owner: 2, status: 3 }[column]);
const detail = (page: Page, id: string) => page.getByRole('region', { name: `Exception ${id}` });
const field = (panel: Locator, name: string) => panel.locator('dt', { hasText: new RegExp(`^${name}$`) }).locator('xpath=following-sibling::dd[1]');
const ownerSelect = (panel: Locator) => panel.getByRole('combobox', { name: 'Owner' });
const statusSelect = (panel: Locator) => panel.getByRole('combobox', { name: 'Status' });
const noteBox = (panel: Locator) => panel.getByRole('textbox', { name: 'Note' });
const saveButton = (panel: Locator) => panel.getByRole('button', { name: 'Save changes' });
const auditEntries = (page: Page, id: string) =>
  page.getByRole('list', { name: 'Audit entries' }).getByRole('listitem').filter({ hasText: id });

async function openSettlements(page: Page) {
  await openArea(page, 'settlements');
  await expectSettlementsLoaded(page);
}

async function expectSettlementsLoaded(page: Page) {
  await expect(page.getByRole('tab', { name: /^Settlements/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Settlements' })).toBeVisible();
  await expect(table(page)).toBeVisible();
}

async function reloadSettlements(page: Page) {
  await page.reload();
  await expectSettlementsLoaded(page);
}

async function filterStatus(page: Page, status: 'Open' | 'In progress' | 'Resolved' | 'All statuses') {
  await queue(page).getByRole('combobox', { name: 'Filter by status' }).selectOption({ label: status });
}

async function openException(page: Page, id: string) {
  await filterStatus(page, 'All statuses');
  await queue(page).getByRole('button', { name: `Open exception ${id}` }).click();
  const panel = detail(page, id);
  await expect(panel).toBeVisible();
  return panel;
}

async function expectRow(page: Page, id: string, owner: string, status: string) {
  const r = row(page, id);
  await expect(r).toHaveCount(1);
  await expect(rowCell(r, 'owner')).toHaveText(owner);
  await expect(rowCell(r, 'status')).toHaveText(status);
}

async function expectDetail(panel: Locator, { status, owner, note }: { status: string; owner: string; note?: string }) {
  await expect(field(panel, 'Status')).toHaveText(status);
  await expect(field(panel, 'Owner')).toHaveText(owner);
  if (note !== undefined) await expect(field(panel, 'Note')).toHaveText(note);
}

async function save(panel: Locator, id: string) {
  await saveButton(panel).click();
  await expect(panel.getByRole('status')).toContainText(`Exception ${id} updated`);
  await expect(panel.getByRole('alert')).toHaveCount(0);
}

async function saveRejected(panel: Locator, message: RegExp) {
  await saveButton(panel).click();
  await expect(panel.getByRole('alert')).toContainText(message);
  await expect(panel.getByRole('status')).toHaveCount(0);
}

/** Either the status control offers no such option, or choosing it is rejected; the exception stays Resolved. */
async function attemptReopen(page: Page, id: string, target: 'Open' | 'In progress', owner: string, note: string) {
  const panel = detail(page, id);
  const select = statusSelect(panel);
  if (await select.count()) {
    const offered = await select.locator('option').allTextContents();
    if (offered.includes(target)) {
      await select.selectOption({ label: target });
      await saveRejected(panel, /resolved|cannot|can.t/i);
    }
  }
  await expectDetail(panel, { status: 'Resolved', owner, note });
  await expectRow(page, id, owner, 'Resolved');
}

caseTest('WM-TC-045', async ({ page }) => {
  await openSettlements(page);
  // Step 1: both seeded exceptions listed with account and reason.
  await expect(dataRows(page)).toHaveCount(2);
  await expect(rowCell(row(page, 'EX1001'), 'reason')).toHaveText('Missing settlement instructions');
  await expect(rowCell(row(page, 'EX1001'), 'account')).toContainText('A1001');
  await expect(rowCell(row(page, 'EX1002'), 'reason')).toHaveText('Cash reconciliation');
  await expect(rowCell(row(page, 'EX1002'), 'account')).toContainText('A1003');
  // Step 2: both Open and unassigned.
  await expectRow(page, 'EX1001', 'Unassigned', 'Open');
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');
  // Step 3: Open filter lists both.
  await filterStatus(page, 'Open');
  await expect(dataRows(page)).toHaveCount(2);
  await expect(row(page, 'EX1001')).toHaveCount(1);
  await expect(row(page, 'EX1002')).toHaveCount(1);
  // Step 4: In progress, then Resolved, show nothing and an empty-result message.
  for (const status of ['In progress', 'Resolved'] as const) {
    await filterStatus(page, status);
    await expect(dataRows(page)).toHaveCount(0);
    await expect(table(page)).toContainText(/No exceptions match/i);
  }
});

caseTest('WM-TC-046', async ({ page }) => {
  await openSettlements(page);
  // Step 1: owner choices.
  const panel = await openException(page, 'EX1001');
  await expect(ownerSelect(panel).locator('option:not([value=""])')).toHaveText(OWNERS);
  // Step 2: assign A. Nguyen.
  await ownerSelect(panel).selectOption({ label: 'A. Nguyen' });
  await save(panel, 'EX1001');
  await expectDetail(panel, { status: 'Open', owner: 'A. Nguyen' });
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Open');
  // Step 3: move to In progress.
  await statusSelect(panel).selectOption({ label: 'In progress' });
  await save(panel, 'EX1001');
  await expectDetail(panel, { status: 'In progress', owner: 'A. Nguyen' });
  // Step 4: In progress filter shows only EX1001; EX1002 untouched.
  await filterStatus(page, 'In progress');
  await expect(dataRows(page)).toHaveCount(1);
  await expectRow(page, 'EX1001', 'A. Nguyen', 'In progress');
  await filterStatus(page, 'All statuses');
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');
  // Step 5: persists after reload.
  await reloadSettlements(page);
  await filterStatus(page, 'All statuses');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'In progress');
  await expectDetail(await openException(page, 'EX1001'), { status: 'In progress', owner: 'A. Nguyen' });
  // Step 6: audit history records assignment and status change.
  const entries = auditEntries(page, 'EX1001');
  await expect(entries.filter({ hasText: /A\. Nguyen/ })).not.toHaveCount(0);
  await expect(entries.filter({ hasText: /In progress/ })).not.toHaveCount(0);
});

caseTest('WM-TC-047', async ({ page }) => {
  const note = 'Cash break cleared with custodian statement';
  await openSettlements(page);
  // Step 1: resolve without owner is rejected.
  let panel = await openException(page, 'EX1002');
  await noteBox(panel).fill(note);
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await saveRejected(panel, /owner is required/i);
  await expectDetail(panel, { status: 'Open', owner: 'Unassigned', note: 'No note yet' });
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');
  // Step 2: nothing recorded after reload.
  await reloadSettlements(page);
  panel = await openException(page, 'EX1002');
  await expectDetail(panel, { status: 'Open', owner: 'Unassigned', note: 'No note yet' });
  await expect(auditEntries(page, 'EX1002')).toHaveCount(0);
  // Step 3: assign S. Patel and resolve.
  await ownerSelect(panel).selectOption({ label: 'S. Patel' });
  await noteBox(panel).fill(note);
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel, 'EX1002');
  await expectDetail(panel, { status: 'Resolved', owner: 'S. Patel', note });
  // Step 4: persists after reload.
  await reloadSettlements(page);
  await expectDetail(await openException(page, 'EX1002'), { status: 'Resolved', owner: 'S. Patel', note });
  await expectRow(page, 'EX1002', 'S. Patel', 'Resolved');
});

caseTest('WM-TC-048', async ({ page }) => {
  await openSettlements(page);
  // Step 1: assign A. Nguyen.
  const panel = await openException(page, 'EX1001');
  await ownerSelect(panel).selectOption({ label: 'A. Nguyen' });
  await save(panel, 'EX1001');
  await expectDetail(panel, { status: 'Open', owner: 'A. Nguyen' });
  // Step 2: 9-character note rejected.
  await noteBox(panel).fill('Confirmed');
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await saveRejected(panel, /at least 10 characters/i);
  await expectDetail(panel, { status: 'Open', owner: 'A. Nguyen', note: 'No note yet' });
  // Step 3: blank (ten spaces) note rejected.
  await noteBox(panel).fill(' '.repeat(10));
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await saveRejected(panel, /at least 10 characters|note/i);
  await expectDetail(panel, { status: 'Open', owner: 'A. Nguyen', note: 'No note yet' });
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Open');
  // Step 4: 10-character note accepted.
  await noteBox(panel).fill('Confirmed.');
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel, 'EX1001');
  await expectDetail(panel, { status: 'Resolved', owner: 'A. Nguyen', note: 'Confirmed.' });
  // Step 5: persists after reload.
  await reloadSettlements(page);
  await expectDetail(await openException(page, 'EX1001'), { status: 'Resolved', owner: 'A. Nguyen', note: 'Confirmed.' });
});

caseTest('WM-TC-049', async ({ page }) => {
  const note = 'SSI received from custodian';
  await openSettlements(page);
  // Step 1: resolve EX1001.
  const panel = await openException(page, 'EX1001');
  await ownerSelect(panel).selectOption({ label: 'A. Nguyen' });
  await noteBox(panel).fill(note);
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel, 'EX1001');
  await expectDetail(panel, { status: 'Resolved', owner: 'A. Nguyen', note });
  // Steps 2-3: cannot move back to Open or In progress.
  await attemptReopen(page, 'EX1001', 'Open', 'A. Nguyen', note);
  await attemptReopen(page, 'EX1001', 'In progress', 'A. Nguyen', note);
  // Step 4: still Resolved after reload with the original note.
  await reloadSettlements(page);
  await expectDetail(await openException(page, 'EX1001'), { status: 'Resolved', owner: 'A. Nguyen', note });
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Resolved');
});

caseTest('WM-TC-050', async ({ page }) => {
  const note = 'Reconciled to bank statement';
  await openSettlements(page);
  // Step 1: assign S. Patel, then In progress.
  const panel = await openException(page, 'EX1002');
  await ownerSelect(panel).selectOption({ label: 'S. Patel' });
  await save(panel, 'EX1002');
  await statusSelect(panel).selectOption({ label: 'In progress' });
  await save(panel, 'EX1002');
  await expectDetail(panel, { status: 'In progress', owner: 'S. Patel' });
  // Step 2: 4-character note rejected.
  await noteBox(panel).fill('Done');
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await saveRejected(panel, /at least 10 characters/i);
  await expectDetail(panel, { status: 'In progress', owner: 'S. Patel', note: 'No note yet' });
  // Step 3: valid note resolves.
  await noteBox(panel).fill(note);
  await statusSelect(panel).selectOption({ label: 'Resolved' });
  await save(panel, 'EX1002');
  await expectDetail(panel, { status: 'Resolved', owner: 'S. Patel', note });
  // Step 4: Resolved filter shows only EX1002; EX1001 untouched.
  await filterStatus(page, 'Resolved');
  await expect(dataRows(page)).toHaveCount(1);
  await expectRow(page, 'EX1002', 'S. Patel', 'Resolved');
  await filterStatus(page, 'All statuses');
  await expectRow(page, 'EX1001', 'Unassigned', 'Open');
  // Steps 5-6: ordered audit entries without the rejected attempt, before and after reload.
  const expectLifecycleAudit = async () => {
    const entries = auditEntries(page, 'EX1002');
    await expect(entries).toHaveCount(3);
    // Audit feed is newest first.
    await expect(entries.nth(2)).toContainText('S. Patel');
    await expect(entries.nth(1)).toContainText('In progress');
    await expect(entries.nth(0)).toContainText('Resolved');
    await expect(entries.nth(0)).toContainText(note);
    await expect(page.getByRole('list', { name: 'Audit entries' })).not.toContainText('Done');
  };
  await expectLifecycleAudit();
  await reloadSettlements(page);
  await expectLifecycleAudit();
});

gapTest('WM-GAP-090', {
  title: 'Legacy Settlement Exceptions cause chips filter queue with matching counts; selecting row updates remediation panel',
  area: 'settlements',
  wikiRef: `${WIKI}/page/3.1.3`,
}, async ({ page }) => {
  await openArea(page, 'settlements', { screen: 'exceptions' });
  const chipBar = page.getByText('Cause', { exact: true }).locator('xpath=..');
  const chips = chipBar.locator(':scope > div');
  const rows = page.locator('.hov-row');
  const cells = (r: Locator) => r.locator(':scope > *');
  const panel = page.locator('div', { has: page.getByText('Suggested next action', { exact: true }) })
    .filter({ has: page.getByText('Timeline', { exact: true }) }).last();
  const chipPattern = /^(.+) (\d+)$/;

  const allChip = chips.filter({ hasText: /^All \d+$/ });
  await expect(allChip).toBeVisible();
  const total = Number(chipPattern.exec((await allChip.innerText()).trim())![2]);
  expect(total).toBeGreaterThan(0);
  await expect(rows).toHaveCount(total);

  const labels = (await chips.allInnerTexts()).map(t => t.trim()).filter(t => !t.startsWith('All '));
  expect(labels.length).toBeGreaterThan(1);
  let sum = 0;
  for (const label of labels) {
    const [, cause, n] = chipPattern.exec(label)!;
    const count = Number(n);
    sum += count;
    await chips.filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`) }).click();
    await expect(rows).toHaveCount(count);
    for (let i = 0; i < count; i++) await expect(cells(rows.nth(i)).nth(5)).toHaveText(cause);
  }
  expect(sum).toBe(total);

  await allChip.click();
  await expect(rows).toHaveCount(total);
  for (const index of [1, total - 1]) {
    const target = rows.nth(index);
    const id = (await cells(target).nth(0).innerText()).trim();
    const counterparty = (await cells(target).nth(4).innerText()).trim();
    const cause = (await cells(target).nth(5).innerText()).trim();
    const action = (await cells(target).nth(6).innerText()).trim();
    const owner = (await cells(target).nth(7).innerText()).trim();
    await target.click();
    await expect(target).toHaveCSS('background-color', 'rgb(234, 241, 250)');
    await expect(rows.first()).not.toHaveCSS('background-color', 'rgb(234, 241, 250)');
    await expect(panel).toContainText(id);
    await expect(panel).toContainText(cause);
    await expect(panel).toContainText(counterparty);
    await expect(panel).toContainText(action);
    await expect(panel).toContainText(owner);
  }
});

gapTest('WM-GAP-091', {
  title: 'Settlement mutation request failure shows error, exception unchanged after reload; retry after recovery succeeds',
  area: 'settlements',
  wikiRef: `${WIKI}/page/1.2`,
}, async ({ page }) => {
  const mutation = '**/api/workflows/exceptions/EX1001';
  await page.route(mutation, route => (route.request().method() === 'PATCH' ? route.abort('failed') : route.continue()));
  await openSettlements(page);

  let panel = await openException(page, 'EX1001');
  await ownerSelect(panel).selectOption({ label: 'A. Nguyen' });
  await saveRejected(panel, /could not be reached|try again/i);
  await expectDetail(panel, { status: 'Open', owner: 'Unassigned' });
  await expectRow(page, 'EX1001', 'Unassigned', 'Open');
  await expect(saveButton(panel)).toBeEnabled();

  await reloadSettlements(page);
  panel = await openException(page, 'EX1001');
  await expectDetail(panel, { status: 'Open', owner: 'Unassigned', note: 'No note yet' });
  await expect(auditEntries(page, 'EX1001')).toHaveCount(0);

  await page.unroute(mutation);
  await ownerSelect(panel).selectOption({ label: 'A. Nguyen' });
  await save(panel, 'EX1001');
  await expectDetail(panel, { status: 'Open', owner: 'A. Nguyen' });
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Open');

  await reloadSettlements(page);
  await expectDetail(await openException(page, 'EX1001'), { status: 'Open', owner: 'A. Nguyen' });
  await expect(auditEntries(page, 'EX1001').filter({ hasText: 'A. Nguyen' })).toHaveCount(1);
});
