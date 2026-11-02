import type { Locator, Page } from '@playwright/test';
import { caseTest, expect, gapTest, openArea } from '../tooling/fixtures';

const queue = (page: Page) => page.getByRole('region', { name: 'Exception queue' });
const statusFilter = (page: Page) => queue(page).getByLabel('Filter by status');
const queueRows = (page: Page) =>
  queue(page).getByRole('row').filter({ has: page.getByRole('button', { name: /^Open exception / }) });
const queueRow = (page: Page, id: string) =>
  queue(page).getByRole('row').filter({ has: page.getByRole('button', { name: `Open exception ${id}` }) });
const detail = (page: Page, id: string) => page.getByRole('region', { name: `Exception ${id}` });
const field = (panel: Locator, label: string) =>
  panel.locator(`xpath=.//dt[normalize-space()="${label}"]/following-sibling::dd[1]`);
const auditEntries = (page: Page) =>
  page.getByRole('complementary', { name: 'Audit trail' }).getByRole('list', { name: 'Audit entries' }).getByRole('listitem');
const settlementsTab = (page: Page) => page.getByRole('tab', { name: /^Settlements(\s|$)/ });

async function openException(page: Page, id: string) {
  await queue(page).getByRole('button', { name: `Open exception ${id}` }).click();
  const panel = detail(page, id);
  await expect(panel).toBeVisible();
  return panel;
}

async function filterBy(page: Page, label: string) {
  await statusFilter(page).click();
  await statusFilter(page).selectOption({ label });
}

async function choose(panel: Locator, label: 'Owner' | 'Status', option: string) {
  const select = panel.getByLabel(label, { exact: true });
  await select.click();
  await select.selectOption({ label: option });
}

async function enterNote(panel: Locator, note: string) {
  const box = panel.getByLabel('Note', { exact: true });
  await box.click();
  await box.fill(note);
}

async function save(panel: Locator) {
  await panel.getByRole('button', { name: 'Save changes' }).click();
}

async function expectRow(page: Page, id: string, owner: string, status: string) {
  const row = queueRow(page, id);
  const cells = row.getByRole('cell');
  await expect(cells.nth(2)).toHaveText(owner);
  await expect(cells.nth(3)).toHaveText(status);
}

async function expectDetail(panel: Locator, status: string, owner: string, note: string) {
  await expect(field(panel, 'Status')).toHaveText(status);
  await expect(field(panel, 'Owner')).toHaveText(owner);
  await expect(field(panel, 'Note')).toHaveText(note);
}

async function reloadSettlements(page: Page) {
  await page.reload();
  await settlementsTab(page).click();
  await expect(settlementsTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(queue(page)).toBeVisible();
}

async function exceptionAudit(page: Page, id: string) {
  const entries = auditEntries(page).filter({ hasText: id });
  await page.getByRole('complementary', { name: 'Audit trail' }).scrollIntoViewIfNeeded();
  return entries;
}

caseTest('WM-TC-045', async ({ page }) => {
  await openArea(page, 'settlements');
  await settlementsTab(page).click();
  await expect(queue(page)).toBeVisible();

  await expect(queueRows(page)).toHaveCount(2);
  const ex1 = queueRow(page, 'EX1001');
  const ex2 = queueRow(page, 'EX1002');
  await expect(ex1.getByRole('cell').nth(0)).toHaveText('Missing settlement instructions');
  await expect(ex1.getByRole('cell').nth(1)).toContainText('A1001');
  await expect(ex2.getByRole('cell').nth(0)).toHaveText('Cash reconciliation');
  await expect(ex2.getByRole('cell').nth(1)).toContainText('A1003');

  const d1 = await openException(page, 'EX1001');
  await expectRow(page, 'EX1001', 'Unassigned', 'Open');
  await expect(field(d1, 'Status')).toHaveText('Open');
  await expect(field(d1, 'Owner')).toHaveText('Unassigned');
  const d2 = await openException(page, 'EX1002');
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');
  await expect(field(d2, 'Status')).toHaveText('Open');
  await expect(field(d2, 'Owner')).toHaveText('Unassigned');

  await filterBy(page, 'Open');
  await expect(queueRows(page)).toHaveCount(2);
  await expect(queueRow(page, 'EX1001')).toBeVisible();
  await expect(queueRow(page, 'EX1002')).toBeVisible();

  for (const status of ['In progress', 'Resolved']) {
    await filterBy(page, status);
    await expect(queueRows(page)).toHaveCount(0);
    await expect(queue(page).getByText('No exceptions match these filters', { exact: false })).toBeVisible();
  }
});

caseTest('WM-TC-046', async ({ page }) => {
  await openArea(page, 'settlements');
  const panel = await openException(page, 'EX1001');

  const owner = panel.getByLabel('Owner', { exact: true });
  await owner.click();
  const offered = (await owner.locator('option').allTextContents()).filter(o => o !== 'Unassigned');
  expect(offered).toEqual(['A. Nguyen', 'S. Patel']);

  await owner.selectOption({ label: 'A. Nguyen' });
  await save(panel);
  await expect(panel.getByRole('status')).toContainText('updated');
  await expect(field(panel, 'Owner')).toHaveText('A. Nguyen');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Open');

  await choose(panel, 'Status', 'In progress');
  await save(panel);
  await expect(field(panel, 'Status')).toHaveText('In progress');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'In progress');

  await filterBy(page, 'In progress');
  await expect(queueRows(page)).toHaveCount(1);
  await expect(queueRow(page, 'EX1001')).toBeVisible();
  await filterBy(page, 'Open');
  await expect(queueRows(page)).toHaveCount(1);
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');

  await reloadSettlements(page);
  const reloaded = await openException(page, 'EX1001');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'In progress');
  await expect(field(reloaded, 'Owner')).toHaveText('A. Nguyen');
  await expect(field(reloaded, 'Status')).toHaveText('In progress');

  const entries = await exceptionAudit(page, 'EX1001');
  await expect(entries.filter({ hasText: 'Owner assigned: A. Nguyen' })).toHaveCount(1);
  await expect(entries.filter({ hasText: 'Status Open → In progress' })).toHaveCount(1);
  await entries.first().hover();
});

caseTest('WM-TC-047', async ({ page }) => {
  const note = 'Cash break cleared with custodian statement';
  await openArea(page, 'settlements');
  let panel = await openException(page, 'EX1002');
  await enterNote(panel, note);
  await choose(panel, 'Status', 'Resolved');
  await save(panel);
  await expect(panel.getByRole('alert')).toContainText(/owner is required/i);
  await expect(field(panel, 'Status')).toHaveText('Open');
  await expect(field(panel, 'Owner')).toHaveText('Unassigned');
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');
  await expect(auditEntries(page).filter({ hasText: 'EX1002' })).toHaveCount(0);

  await reloadSettlements(page);
  panel = await openException(page, 'EX1002');
  await expectDetail(panel, 'Open', 'Unassigned', 'No note yet');
  await expect(auditEntries(page).filter({ hasText: 'EX1002' })).toHaveCount(0);

  await choose(panel, 'Owner', 'S. Patel');
  await enterNote(panel, note);
  await choose(panel, 'Status', 'Resolved');
  await save(panel);
  await expectDetail(panel, 'Resolved', 'S. Patel', note);
  await filterBy(page, 'Resolved');
  await expectRow(page, 'EX1002', 'S. Patel', 'Resolved');

  await reloadSettlements(page);
  await filterBy(page, 'Resolved');
  panel = await openException(page, 'EX1002');
  await expectDetail(panel, 'Resolved', 'S. Patel', note);
});

caseTest('WM-TC-048', async ({ page }) => {
  await openArea(page, 'settlements');
  let panel = await openException(page, 'EX1001');
  await choose(panel, 'Owner', 'A. Nguyen');
  await save(panel);
  await expect(field(panel, 'Owner')).toHaveText('A. Nguyen');

  await enterNote(panel, 'Confirmed');
  await choose(panel, 'Status', 'Resolved');
  await save(panel);
  await expect(panel.getByRole('alert')).toContainText(/at least 10 characters/i);
  await expect(field(panel, 'Status')).toHaveText('Open');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Open');

  await enterNote(panel, ' '.repeat(10));
  await save(panel);
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(field(panel, 'Status')).toHaveText('Open');
  await expect(field(panel, 'Note')).toHaveText('No note yet');
  await expectRow(page, 'EX1001', 'A. Nguyen', 'Open');

  await enterNote(panel, 'Confirmed.');
  await save(panel);
  await expectDetail(panel, 'Resolved', 'A. Nguyen', 'Confirmed.');

  await reloadSettlements(page);
  await filterBy(page, 'Resolved');
  panel = await openException(page, 'EX1001');
  await expectDetail(panel, 'Resolved', 'A. Nguyen', 'Confirmed.');
});

caseTest('WM-TC-049', async ({ page }) => {
  const note = 'SSI received from custodian';
  await openArea(page, 'settlements');
  let panel = await openException(page, 'EX1001');
  await choose(panel, 'Owner', 'A. Nguyen');
  await enterNote(panel, note);
  await choose(panel, 'Status', 'Resolved');
  await save(panel);
  await expect(field(panel, 'Status')).toHaveText('Resolved');

  for (const target of ['Open', 'In progress']) {
    await filterBy(page, 'All statuses');
    panel = await openException(page, 'EX1001');
    const statusChoice = panel.getByLabel('Status', { exact: true });
    await expect(statusChoice, `no way to change a resolved exception to ${target}`).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(panel.getByText('can’t be reopened', { exact: false })).toBeVisible();
    await expect(field(panel, 'Status')).toHaveText('Resolved');
    await expectRow(page, 'EX1001', 'A. Nguyen', 'Resolved');
  }

  await reloadSettlements(page);
  await filterBy(page, 'Resolved');
  panel = await openException(page, 'EX1001');
  await expectDetail(panel, 'Resolved', 'A. Nguyen', note);
});

caseTest('WM-TC-050', async ({ page }) => {
  const note = 'Reconciled to bank statement';
  await openArea(page, 'settlements');
  const panel = await openException(page, 'EX1002');
  await choose(panel, 'Owner', 'S. Patel');
  await save(panel);
  await expect(field(panel, 'Owner')).toHaveText('S. Patel');
  await choose(panel, 'Status', 'In progress');
  await save(panel);
  await expect(field(panel, 'Status')).toHaveText('In progress');
  await expectRow(page, 'EX1002', 'S. Patel', 'In progress');

  await enterNote(panel, 'Done');
  await choose(panel, 'Status', 'Resolved');
  await save(panel);
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(field(panel, 'Status')).toHaveText('In progress');

  await enterNote(panel, note);
  await save(panel);
  await expect(field(panel, 'Status')).toHaveText('Resolved');

  await filterBy(page, 'Resolved');
  await expect(queueRows(page)).toHaveCount(1);
  await expect(queueRow(page, 'EX1002')).toBeVisible();
  await filterBy(page, 'Open');
  await expectRow(page, 'EX1001', 'Unassigned', 'Open');

  const expected = [
    /Owner assigned: S\. Patel/,
    /Status Open → In progress/,
    new RegExp(`Status In progress → Resolved.*Note: ${note}`)
  ];
  const checkAudit = async () => {
    const entries = await exceptionAudit(page, 'EX1002');
    await expect(entries).toHaveCount(3);
    const newestFirst = await entries.allTextContents();
    const chronological = [...newestFirst].reverse();
    expected.forEach((pattern, i) => expect(chronological[i]).toMatch(pattern));
    expect(newestFirst.join('\n')).not.toContain('Done');
    await entries.first().hover();
    return newestFirst;
  };
  const before = await checkAudit();

  await reloadSettlements(page);
  const after = await checkAudit();
  expect(after).toEqual(before);
});

const money = (text: string | null) => Number((text ?? '').replace(/[^0-9.]/g, ''));

gapTest('WM-GAP-090', {
  title: 'Legacy Alternatives screen (/?screen=alts) represents commitments, called capital, unfunded amounts and reported valuations consistently with its seeded data (KPI totals agree with the commitments grid; unfunded = committed - called)',
  area: 'settlements',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/3.1.3'
}, async ({ page }) => {
  await page.goto('/?screen=c360');
  await page.getByText('Alternatives', { exact: true }).first().click();
  await expect(page).toHaveURL(/screen=alts/);
  await expect(page.getByText('Alternatives holdings', { exact: true })).toBeVisible();

  const kpi = async (label: string) => {
    const labelEl = page.getByText(label, { exact: true }).first();
    const value = labelEl.locator('xpath=following-sibling::span[1]');
    await value.hover();
    return money(await value.textContent());
  };
  const committed = await kpi('Committed');
  const called = await kpi('Called to date');
  const unfunded = await kpi('Unfunded');
  const current = await kpi('Current value');
  const distributions = await kpi('Distributions received');

  const panel = page.locator('div').filter({ has: page.getByText('Commitments', { exact: true }) })
    .filter({ hasText: 'Fund · account' }).last();
  await panel.scrollIntoViewIfNeeded();
  const rows = panel.locator('xpath=.//div[span][count(*)=9][position()>0]').filter({ hasNotText: 'Fund · account' });
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  await expect(page.getByText(`${n} commitments`, { exact: false }).first()).toBeVisible();

  const sum = { committed: 0, called: 0, unfunded: 0, dist: 0, current: 0 };
  for (let i = 0; i < n; i++) {
    const cells = rows.nth(i).locator(':scope > *');
    await rows.nth(i).hover();
    const c = money(await cells.nth(2).textContent());
    const calledText = (await cells.nth(3).locator('span').first().textContent()) ?? '';
    const calledAmt = money(calledText.split('·')[0]);
    const calledPct = Number((calledText.split('·')[1] ?? '').replace(/[^0-9.]/g, ''));
    const u = money(await cells.nth(4).textContent());
    const d = money(await cells.nth(5).textContent());
    const v = money(await cells.nth(6).locator('span').first().textContent());
    expect(u, `row ${i} unfunded = committed - called`).toBe(c - calledAmt);
    expect(Math.abs(calledPct - (calledAmt / c) * 100), `row ${i} called %`).toBeLessThan(1);
    sum.committed += c; sum.called += calledAmt; sum.unfunded += u; sum.dist += d; sum.current += v;
  }
  expect(committed).toBe(sum.committed);
  expect(called).toBe(sum.called);
  expect(unfunded).toBe(sum.unfunded);
  expect(unfunded).toBe(committed - called);
  expect(current).toBe(sum.current);
  expect(distributions).toBe(sum.dist);
});

gapTest('WM-GAP-091', {
  title: 'Settlements workspace shows a clear error state on a real request failure, and Retry after recovery restores the real exception queue and usable controls',
  area: 'settlements',
  wikiRef: 'https://test-aaron.devinenterprise.com/org/rbc-test/wiki/aaron-cog-gtm-gh-org/wealth-platform/page/1.2'
}, async ({ page }) => {
  const outage = '**/api/workflows/bootstrap*';
  await page.route(outage, route => route.abort('connectionrefused'));
  await openArea(page, 'settlements');
  const tabpanel = page.getByRole('tabpanel');
  await expect(tabpanel.getByRole('alert')).toContainText('Workspace data couldn’t be loaded');
  await expect(queue(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeDisabled();
  const retry = tabpanel.getByRole('button', { name: 'Retry' });
  await retry.hover();

  await page.unroute(outage);
  await retry.click();
  await expect(tabpanel.getByRole('alert')).toHaveCount(0);
  await expect(queue(page)).toBeVisible();
  await expect(queueRows(page)).toHaveCount(2);
  await expectRow(page, 'EX1001', 'Unassigned', 'Open');
  await expectRow(page, 'EX1002', 'Unassigned', 'Open');
  await expect(page.getByRole('button', { name: 'Refresh data' })).toBeEnabled();

  await filterBy(page, 'Open');
  await expect(queueRows(page)).toHaveCount(2);
  const panel = await openException(page, 'EX1002');
  await expect(field(panel, 'Reason')).toHaveText('Cash reconciliation');
  await choose(panel, 'Owner', 'S. Patel');
  await save(panel);
  await expect(field(panel, 'Owner')).toHaveText('S. Patel');
  await expectRow(page, 'EX1002', 'S. Patel', 'Open');
});
