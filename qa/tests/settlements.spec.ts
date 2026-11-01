import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const settlementsPanel = (page: Page) => page.getByRole('tabpanel', { name: /^Settlements(\s|$)/ });
const queue = (page: Page) => settlementsPanel(page).getByRole('region', { name: 'Exception queue' });
const queueRows = (page: Page) => queue(page).getByRole('row').filter({ has: page.getByRole('rowheader') });
const queueRow = (page: Page, id: string) => queueRows(page).filter({ has: page.getByRole('rowheader', { name: `Open exception ${id}` }) });
const detail = (page: Page, id: string) => settlementsPanel(page).getByRole('region', { name: `Exception ${id}` });
const detailValue = (panel: Locator, term: string) =>
  panel.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
const auditEntries = (page: Page) =>
  settlementsPanel(page).getByRole('complementary', { name: 'Audit trail' }).getByRole('listitem');

async function filterByStatus(page: Page, label: string) {
  const filter = queue(page).getByRole('combobox', { name: 'Filter by status' });
  await filter.click();
  await filter.selectOption({ label });
  await expect(filter).toHaveValue(label === 'Open and in progress' ? 'Active' : label === 'All statuses' ? 'All' : label);
}

async function openException(page: Page, id: string) {
  await queue(page).getByRole('button', { name: `Open exception ${id}` }).click();
  await expect(detail(page, id)).toBeVisible();
  return detail(page, id);
}

async function chooseOwner(panel: Locator, owner: string) {
  const select = panel.getByRole('combobox', { name: 'Owner', exact: true });
  await select.click();
  await select.selectOption({ label: owner });
  await expect(select).toHaveValue(owner);
}

async function chooseStatus(panel: Locator, status: string) {
  const select = panel.getByRole('combobox', { name: 'Status', exact: true });
  await select.click();
  await select.selectOption({ label: status });
  await expect(select).toHaveValue(status);
}

async function enterNote(panel: Locator, note: string) {
  const field = panel.getByRole('textbox', { name: 'Note' });
  await field.click();
  await field.fill(note);
  await expect(field).toHaveValue(note);
}

async function save(panel: Locator) {
  await panel.getByRole('button', { name: 'Save changes' }).click();
}

async function expectRow(page: Page, id: string, values: { reason?: string; account?: string; owner: string; status: string }) {
  const row = queueRow(page, id);
  await expect(row).toHaveCount(1);
  const cells = row.getByRole('cell');
  if (values.reason) await expect(cells.nth(0)).toHaveText(values.reason);
  if (values.account) await expect(cells.nth(1)).toContainText(values.account);
  await expect(cells.nth(2)).toHaveText(values.owner);
  await expect(cells.nth(3)).toHaveText(values.status);
}

async function expectDetail(panel: Locator, values: { status: string; owner: string; note: string }) {
  await expect(detailValue(panel, 'Status')).toHaveText(values.status);
  await expect(detailValue(panel, 'Owner')).toHaveText(values.owner);
  await expect(detailValue(panel, 'Note')).toHaveText(values.note);
}

async function reloadSettlements(page: Page) {
  await page.reload();
  await page.waitForLoadState('load');
  const tab = page.getByRole('tab', { name: /^Settlements(\s|$)/ });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(queue(page)).toBeVisible();
}

const emptyMessage = /No exceptions match these filters/;

caseTest('WM-TC-045', async ({ page }) => {
  await openArea(page, 'settlements');

  // Step 1: the seeded queue lists both exceptions.
  await expect(queueRows(page)).toHaveCount(2);
  await expectRow(page, 'EX1001', { reason: 'Missing settlement instructions', account: 'A1001', owner: 'Unassigned', status: 'Open' });
  await expectRow(page, 'EX1002', { reason: 'Cash reconciliation', account: 'A1003', owner: 'Unassigned', status: 'Open' });

  // Step 2: read status and owner for each exception.
  const ex1001 = await openException(page, 'EX1001');
  await expectDetail(ex1001, { status: 'Open', owner: 'Unassigned', note: 'No note yet' });
  const ex1002 = await openException(page, 'EX1002');
  await expectDetail(ex1002, { status: 'Open', owner: 'Unassigned', note: 'No note yet' });

  // Step 3: filter by Open.
  await filterByStatus(page, 'Open');
  await expect(queueRows(page)).toHaveCount(2);
  await expectRow(page, 'EX1001', { owner: 'Unassigned', status: 'Open' });
  await expectRow(page, 'EX1002', { owner: 'Unassigned', status: 'Open' });

  // Step 4: In progress, then Resolved, are both empty.
  await filterByStatus(page, 'In progress');
  await expect(queueRows(page)).toHaveCount(0);
  await expect(queue(page).getByText(emptyMessage)).toBeVisible();
  await filterByStatus(page, 'Resolved');
  await expect(queueRows(page)).toHaveCount(0);
  await expect(queue(page).getByText(emptyMessage)).toBeVisible();
});

caseTest('WM-TC-046', async ({ page }) => {
  await openArea(page, 'settlements');

  // Step 1: open EX1001 and the owner choice.
  const ex = await openException(page, 'EX1001');
  const ownerSelect = ex.getByRole('combobox', { name: 'Owner', exact: true });
  await ownerSelect.click();
  await expect(ownerSelect.locator('option:not([value=""])')).toHaveText(['A. Nguyen', 'S. Patel']);

  // Step 2: assign A. Nguyen and save.
  await chooseOwner(ex, 'A. Nguyen');
  await save(ex);
  await expect(ex.getByRole('status')).toContainText('EX1001');
  await expect(detailValue(ex, 'Owner')).toHaveText('A. Nguyen');
  await expectRow(page, 'EX1001', { owner: 'A. Nguyen', status: 'Open' });

  // Step 3: set status In progress and save.
  await chooseStatus(ex, 'In progress');
  await save(ex);
  await expect(detailValue(ex, 'Status')).toHaveText('In progress');
  await expectRow(page, 'EX1001', { owner: 'A. Nguyen', status: 'In progress' });

  // Step 4: filter In progress lists only EX1001; EX1002 is still Open and unassigned.
  await filterByStatus(page, 'In progress');
  await expect(queueRows(page)).toHaveCount(1);
  await expectRow(page, 'EX1001', { owner: 'A. Nguyen', status: 'In progress' });
  await filterByStatus(page, 'Open');
  await expect(queueRows(page)).toHaveCount(1);
  await expectRow(page, 'EX1002', { owner: 'Unassigned', status: 'Open' });

  // Step 5: reload and return to Settlements.
  await reloadSettlements(page);
  const reloaded = await openException(page, 'EX1001');
  await expect(detailValue(reloaded, 'Owner')).toHaveText('A. Nguyen');
  await expect(detailValue(reloaded, 'Status')).toHaveText('In progress');
  await expectRow(page, 'EX1001', { owner: 'A. Nguyen', status: 'In progress' });

  // Step 6: audit history records the owner assignment and status change.
  const audit = auditEntries(page).filter({ hasText: 'EX1001' });
  await audit.first().scrollIntoViewIfNeeded();
  await expect(audit.filter({ hasText: 'Owner assigned: A. Nguyen' })).toHaveCount(1);
  await expect(audit.filter({ hasText: /Status Open → In progress/ })).toHaveCount(1);
});

caseTest('WM-TC-047', async ({ page }) => {
  const note = 'Cash break cleared with custodian statement';
  await openArea(page, 'settlements');

  // Step 1: resolving without an owner is rejected.
  const ex = await openException(page, 'EX1002');
  await enterNote(ex, note);
  await chooseStatus(ex, 'Resolved');
  await save(ex);
  await expect(ex.getByRole('alert')).toContainText(/owner is required/i);
  await expect(detailValue(ex, 'Status')).toHaveText('Open');
  await expect(detailValue(ex, 'Owner')).toHaveText('Unassigned');
  await expectRow(page, 'EX1002', { owner: 'Unassigned', status: 'Open' });

  // Step 2: after reload nothing was recorded.
  await reloadSettlements(page);
  const reloaded = await openException(page, 'EX1002');
  await expectDetail(reloaded, { status: 'Open', owner: 'Unassigned', note: 'No note yet' });
  await expect(auditEntries(page).filter({ hasText: 'EX1002' })).toHaveCount(0);

  // Step 3: assign S. Patel, enter the note and resolve.
  await chooseOwner(reloaded, 'S. Patel');
  await enterNote(reloaded, note);
  await chooseStatus(reloaded, 'Resolved');
  await save(reloaded);
  await expectDetail(reloaded, { status: 'Resolved', owner: 'S. Patel', note });

  // Step 4: after reload EX1002 is still resolved with owner and note.
  await reloadSettlements(page);
  await filterByStatus(page, 'Resolved');
  await expectRow(page, 'EX1002', { owner: 'S. Patel', status: 'Resolved' });
  const resolved = await openException(page, 'EX1002');
  await expectDetail(resolved, { status: 'Resolved', owner: 'S. Patel', note });
});

caseTest('WM-TC-048', async ({ page }) => {
  await openArea(page, 'settlements');

  // Step 1: assign A. Nguyen and save.
  const ex = await openException(page, 'EX1001');
  await chooseOwner(ex, 'A. Nguyen');
  await save(ex);
  await expect(detailValue(ex, 'Owner')).toHaveText('A. Nguyen');

  // Step 2: a 9-character note is rejected.
  await enterNote(ex, 'Confirmed');
  await chooseStatus(ex, 'Resolved');
  await save(ex);
  await expect(ex.getByRole('alert')).toContainText(/at least 10 characters/i);
  await expect(detailValue(ex, 'Status')).toHaveText('Open');

  // Step 3: ten spaces are rejected.
  await enterNote(ex, ' '.repeat(10));
  await expect(ex.getByRole('alert')).toHaveCount(0);
  await save(ex);
  await expect(ex.getByRole('alert')).toBeVisible();
  await expect(detailValue(ex, 'Status')).toHaveText('Open');
  await expect(detailValue(ex, 'Note')).toHaveText('No note yet');

  // Step 4: 'Confirmed.' resolves.
  await enterNote(ex, 'Confirmed.');
  await save(ex);
  await expectDetail(ex, { status: 'Resolved', owner: 'A. Nguyen', note: 'Confirmed.' });

  // Step 5: persisted after reload.
  await reloadSettlements(page);
  await filterByStatus(page, 'Resolved');
  const reloaded = await openException(page, 'EX1001');
  await expectDetail(reloaded, { status: 'Resolved', owner: 'A. Nguyen', note: 'Confirmed.' });
});

caseTest('WM-TC-049', async ({ page }) => {
  const note = 'SSI received from custodian';
  await openArea(page, 'settlements');

  // Step 1: resolve EX1001.
  const ex = await openException(page, 'EX1001');
  await chooseOwner(ex, 'A. Nguyen');
  await enterNote(ex, note);
  await chooseStatus(ex, 'Resolved');
  await save(ex);
  await expect(detailValue(ex, 'Status')).toHaveText('Resolved');

  const expectLocked = async (panel: Locator) => {
    await expect(panel.getByRole('combobox', { name: 'Status', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(panel.getByText(/can’t be reopened/)).toBeVisible();
    await expect(detailValue(panel, 'Status')).toHaveText('Resolved');
  };

  // Step 2: no way to move it back to Open.
  await filterByStatus(page, 'All statuses');
  await expectRow(page, 'EX1001', { owner: 'A. Nguyen', status: 'Resolved' });
  await expectLocked(await openException(page, 'EX1001'));

  // Step 3: no way to move it to In progress.
  await filterByStatus(page, 'In progress');
  await expect(queueRows(page)).toHaveCount(0);
  await filterByStatus(page, 'Resolved');
  await expectLocked(await openException(page, 'EX1001'));

  // Step 4: still resolved after reload.
  await reloadSettlements(page);
  await filterByStatus(page, 'Resolved');
  const reloaded = await openException(page, 'EX1001');
  await expectDetail(reloaded, { status: 'Resolved', owner: 'A. Nguyen', note });
});

caseTest('WM-TC-050', async ({ page }) => {
  const note = 'Reconciled to bank statement';
  await openArea(page, 'settlements');

  // Step 1: assign S. Patel, then set In progress.
  const ex = await openException(page, 'EX1002');
  await chooseOwner(ex, 'S. Patel');
  await save(ex);
  await expect(detailValue(ex, 'Owner')).toHaveText('S. Patel');
  await chooseStatus(ex, 'In progress');
  await save(ex);
  await expect(detailValue(ex, 'Status')).toHaveText('In progress');
  await expect(detailValue(ex, 'Owner')).toHaveText('S. Patel');

  // Step 2: 'Done' is rejected.
  await enterNote(ex, 'Done');
  await chooseStatus(ex, 'Resolved');
  await save(ex);
  await expect(ex.getByRole('alert')).toBeVisible();
  await expect(detailValue(ex, 'Status')).toHaveText('In progress');

  // Step 3: resolve with a valid note.
  await enterNote(ex, note);
  await save(ex);
  await expect(detailValue(ex, 'Status')).toHaveText('Resolved');

  // Step 4: Resolved filter lists only EX1002; EX1001 remains Open and unassigned.
  await filterByStatus(page, 'Resolved');
  await expect(queueRows(page)).toHaveCount(1);
  await expectRow(page, 'EX1002', { owner: 'S. Patel', status: 'Resolved' });
  await filterByStatus(page, 'Open');
  await expectRow(page, 'EX1001', { owner: 'Unassigned', status: 'Open' });

  // Step 5: EX1002 audit history, newest first, without the rejected attempt.
  const expectHistory = async () => {
    const entries = auditEntries(page).filter({ hasText: 'EX1002' });
    await entries.first().scrollIntoViewIfNeeded();
    await expect(entries).toHaveCount(3);
    await expect(entries.nth(2)).toContainText('Owner assigned: S. Patel');
    await expect(entries.nth(1)).toContainText('Status Open → In progress');
    await expect(entries.nth(0)).toContainText('Status In progress → Resolved');
    await expect(entries.nth(0)).toContainText(`Note: ${note}`);
    await expect(entries.filter({ hasText: 'Note: Done' })).toHaveCount(0);
  };
  await filterByStatus(page, 'All statuses');
  await openException(page, 'EX1002');
  await expectHistory();

  // Step 6: same entries after reload.
  await reloadSettlements(page);
  await filterByStatus(page, 'Resolved');
  await openException(page, 'EX1002');
  await expectHistory();
});

const money = (text: string) => Number(text.replace(/[^0-9.-]/g, ''));

gapTest(
  'WM-GAP-090',
  {
    title: 'Legacy Alternatives commitments show committed, called and unfunded values consistently',
    area: 'settlements',
    wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.1.3'
  },
  async ({ page }) => {
    await page.goto('/?screen=c360');
    await page.waitForLoadState('load');
    const nav = page.locator('nav').first();
    const kpiValue = (label: string) =>
      page.getByText(label, { exact: true }).first().locator('xpath=following-sibling::span[1]');
    const kpiSub = (label: string) =>
      page.getByText(label, { exact: true }).first().locator('xpath=following-sibling::span[2]');

    // Portfolio overview card for unfunded commitments.
    await nav.getByText('Portfolio detail', { exact: true }).click();
    await expect(page).toHaveURL(/screen=portfolio/);
    await expect(kpiValue('Unfunded commitments')).toHaveText('$650,000');
    await expect(kpiSub('Unfunded commitments')).toHaveText('2 alternative funds');
    const overviewUnfunded = money(await kpiValue('Unfunded commitments').innerText());

    // Alternatives KPIs and commitments table.
    await nav.getByText('Alternatives', { exact: true }).click();
    await expect(page).toHaveURL(/screen=alts/);
    await expect(kpiValue('Committed')).toHaveText('$1,750,000');
    await expect(kpiValue('Called to date')).toHaveText('$1,100,000');
    await expect(kpiValue('Unfunded')).toHaveText('$650,000');

    const funds = [
      { name: 'Northgate Infrastructure Partners IV', committed: '$1,000,000', called: '$620,000', pct: '62%', unfunded: '$380,000' },
      { name: 'Lakeshore Private Credit Fund II', committed: '$750,000', called: '$480,000', pct: '64%', unfunded: '$270,000' }
    ];
    let committedSum = 0, calledSum = 0, unfundedSum = 0;
    for (const fund of funds) {
      const row = page.getByText(fund.name, { exact: true }).locator('xpath=../..');
      const committed = row.locator(':scope > :nth-child(3)');
      const called = row.locator(':scope > :nth-child(4)');
      const unfunded = row.locator(':scope > :nth-child(5)');
      await expect(committed).toHaveText(fund.committed);
      await expect(called).toHaveText(`${fund.called} · ${fund.pct}`);
      await expect(unfunded).toHaveText(fund.unfunded);
      const c = money(await committed.innerText());
      const k = money((await called.innerText()).split('·')[0]);
      const u = money(await unfunded.innerText());
      expect(u).toBe(c - k);
      expect(`${Math.round((k / c) * 100)}%`).toBe(fund.pct);
      committedSum += c; calledSum += k; unfundedSum += u;
    }

    const kpiCommitted = money(await kpiValue('Committed').innerText());
    const kpiCalled = money(await kpiValue('Called to date').innerText());
    const kpiUnfunded = money(await kpiValue('Unfunded').innerText());
    expect(kpiCommitted).toBe(committedSum);
    expect(kpiCalled).toBe(calledSum);
    expect(kpiUnfunded).toBe(unfundedSum);
    expect(kpiUnfunded).toBe(kpiCommitted - kpiCalled);
    expect(kpiUnfunded).toBe(overviewUnfunded);
    await expect(kpiSub('Committed')).toHaveText(`${funds.length} funds · CAD`);
    await expect(kpiSub('Called to date')).toHaveText(`${((kpiCalled / kpiCommitted) * 100).toFixed(1)}% of committed`);

    // Returning to Portfolio detail shows the same unfunded figure.
    await nav.getByText('Portfolio detail', { exact: true }).click();
    await expect(kpiValue('Unfunded commitments')).toHaveText('$650,000');
  }
);
