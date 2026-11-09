import { apiGet, expect, openCustody, tableByCaption, test } from './fixtures';

type Settlements = { from: string; to: string; settlements: Array<{ seme: string; settleDate: string }> };

// US3: Review settlement confirmations.
test.describe('Settlements (US3)', () => {
  test('US3-1 default window lists the last 90 days newest first with cancelled confirmations excluded', async ({ page }) => {
    // 01079-03 (acct 2145): KS5400060882 was cancelled by a later-day CANC (D2), so it must not appear.
    const api = await apiGet<Settlements>('/accounts/2145/settlements');
    await openCustody(page, { view: 'settlements', acct: 2145 });
    const table = tableByCaption(page, 'Settlement confirmations for 01079-03, 11 Jul 2026 to 09 Oct 2026');
    await expect(table.locator('tbody tr')).toHaveCount(api.settlements.length);
    await expect(page.getByText(`${api.settlements.length} confirmations, newest first`)).toBeVisible();
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-07-11');
    await expect(page.getByLabel('To', { exact: true })).toHaveValue('2026-10-09');
    const semes = await table.locator('tbody tr td:nth-child(10)').allTextContents();
    expect(semes).toEqual(api.settlements.map(s => s.seme));
    expect(semes).not.toContain('KS5400060882');
    expect(semes).not.toContain('KS5400064555');
  });

  test('US3-1 a confirmation whose safekeeping account has a leading zero is attributed to its account (D1)', async ({ page }) => {
    await openCustody(page, { view: 'settlements', acct: 2129, from: '2026-09-01', to: '2026-09-30' });
    const row = tableByCaption(page, /^Settlement confirmations for /).locator('tbody tr').filter({ hasText: 'KS5400063562' });
    await expect(row).toContainText('MT544');
    await expect(row).toContainText('Bellmere Multi Asset Balanced Fund R Inc');
    await expect(row).toContainText('2,775.949');
  });

  test('US3-2 a period with no confirmations shows "No settlements in period."', async ({ page }) => {
    await openCustody(page, { view: 'settlements', acct: 2001 });
    await page.getByLabel('From', { exact: true }).fill('2026-01-01');
    await page.getByLabel('To', { exact: true }).fill('2026-01-31');
    await page.getByRole('button', { name: 'Show settlements' }).click();
    await expect(page).toHaveURL(/from=2026-01-01&to=2026-01-31/);
    await expect(tableByCaption(page, 'Settlement confirmations for 01001-01, 01 Jan 2026 to 31 Jan 2026').locator('tbody')).toHaveText('No settlements in period.');
    await expect(page.getByText('0 confirmations, newest first')).toBeVisible();
    await page.reload();
    await expect(page.getByText('No settlements in period.')).toBeVisible();
  });

  test('US3-3 a From date after the To date is rejected without querying', async ({ page }) => {
    await openCustody(page, { view: 'settlements', acct: 2001 });
    await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-07-11');
    await page.getByLabel('From', { exact: true }).fill('2026-08-01');
    await page.getByLabel('To', { exact: true }).fill('2026-07-01');
    await page.getByRole('button', { name: 'Show settlements' }).click();
    await expect(page.getByRole('alert')).toHaveText('The From date must be on or before the To date.');
    await expect(page.getByLabel('From', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page).not.toHaveURL(/from=2026-08-01/);
    await expect(tableByCaption(page, 'Settlement confirmations for 01001-01, 11 Jul 2026 to 09 Oct 2026')).toBeVisible();

    await page.getByLabel('From', { exact: true }).fill('2026-06-01');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('US3-3 a rejected range is cleared when another account loads its period', async ({ page }) => {
    await openCustody(page, { view: 'settlements', acct: 2001 });
    await page.getByLabel('From', { exact: true }).fill('2026-08-01');
    await page.getByLabel('To', { exact: true }).fill('2026-07-01');
    await page.getByRole('button', { name: 'Show settlements' }).click();
    await expect(page.getByRole('alert')).toHaveText('The From date must be on or before the To date.');

    await page.getByLabel('Account', { exact: true }).selectOption('2145');
    await expect(tableByCaption(page, 'Settlement confirmations for 01079-03, 11 Jul 2026 to 09 Oct 2026')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel('From', { exact: true })).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('US3 an invalid range in a deep link is reported by the server', async ({ page }) => {
    await openCustody(page, { view: 'settlements', acct: 2001, from: '2026-08-01', to: '2026-07-01' });
    await expect(page.getByRole('alert')).toContainText(/from/i);
  });
});
