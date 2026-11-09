import { expect, openCustody, rowByHeader, tableByCaption, test } from './fixtures';

// US5: Inspect raw custodian messages and the archive.
test.describe('Messages and archive (US5)', () => {
  test('US5-1 filters by type, date and safekeeping account', async ({ page }) => {
    await openCustody(page, { view: 'messages' });
    await expect(page.getByText('6,044 files')).toBeVisible();
    await page.getByLabel('Message type').selectOption('MT535');
    await page.getByLabel('Message date').fill('2026-06-26');
    await page.getByLabel('Safekeeping account').fill('16558');
    await page.getByRole('button', { name: 'List messages' }).click();
    await expect(page.getByText('3 files')).toBeVisible();
    const rows = tableByCaption(page, /^Custodian message files/).locator('tbody tr');
    await expect(rows.locator('th')).toHaveText(['MT535_16558_20260626_001.txt', 'MT535_16558_20260626_002.txt', 'MT535_16558_20260626_003.txt']);

    await page.getByLabel('Safekeeping account').fill('16x58');
    await page.getByRole('button', { name: 'List messages' }).click();
    await expect(page.getByRole('alert')).toHaveText('Safekeeping account must be digits only.');
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('6,044 files')).toBeVisible();
  });

  test('US5-2 opening a file shows its raw SWIFT text, also via deep link', async ({ page }) => {
    await openCustody(page, { view: 'messages' });
    await page.getByLabel('Message type').selectOption('MT535');
    await page.getByLabel('Safekeeping account').fill('16558');
    await page.getByLabel('Message date').fill('2026-06-26');
    await page.getByRole('button', { name: 'List messages' }).click();
    await page.getByRole('button', { name: 'MT535_16558_20260626_003.txt' }).click();
    await expect(page).toHaveURL(/view=messages&file=MT535_16558_20260626_003\.txt/);
    const raw = page.getByLabel('Raw SWIFT text of MT535_16558_20260626_003.txt');
    await expect(raw).toContainText('{2:O535');
    await expect(raw).toContainText(':97A::SAFE//0016558');
    await expect(raw).toContainText(':98A::STAT//20260626');
    await expect(page.getByRole('button', { name: 'MT535_16558_20260626_003.txt' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByLabel('Raw SWIFT text of MT535_16558_20260626_003.txt')).toContainText(':97A::SAFE//0016558');
    await page.getByRole('button', { name: 'Close message' }).click();
    await expect(page.getByLabel(/^Raw SWIFT text of/)).toHaveCount(0);

    await openCustody(page, { view: 'messages', file: 'MT547_16598_20261009_001.txt' });
    await expect(page.getByLabel('Raw SWIFT text of MT547_16598_20261009_001.txt')).toContainText(':20C::SEME//KS5400064539');
  });

  test('US5-3 archive shows counts and parse errors, and reloads keeping recon notes', async ({ page }) => {
    test.setTimeout(120_000);
    await openCustody(page, { view: 'archive' });
    const stats = page.locator('.cu-stats');
    await expect(stats).toContainText('MT535 statements on file3,073');
    await expect(stats).toContainText('MT54x confirmations on file2,971');
    await expect(stats).toContainText('Statements loaded3,073');
    await expect(stats).toContainText('Confirmations loaded2,971');
    await expect(stats).toContainText('Parse errors0');
    const before = await stats.locator('.cu-stat', { hasText: 'Last loaded' }).locator('dd').textContent();

    await page.getByRole('button', { name: 'Reload archive' }).click();
    await expect(page.getByText('Saved recon notes are kept.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Saved recon notes are kept.')).toHaveCount(0);

    await page.getByRole('button', { name: 'Reload archive' }).click();
    await expect(page.getByRole('button', { name: 'Reload now' })).toBeFocused();
    await page.getByRole('button', { name: 'Reload now' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Archive reloaded' }))
      .toHaveText('Archive reloaded: 3,073 statements and 2,971 confirmations, 0 parse errors.', { timeout: 60_000 });
    await expect(stats).toContainText('Parse errors0');
    await expect.poll(async () => stats.locator('.cu-stat', { hasText: 'Last loaded' }).locator('dd').textContent()).not.toBe(before);

    await openCustody(page, { view: 'check', acct: 2038, date: '2026-06-26' });
    await expect(rowByHeader(page, 'Breaks for 01028-01 at 26 Jun 2026', 'GB00ZZ003373')).toContainText('OPEN');
  });
});
