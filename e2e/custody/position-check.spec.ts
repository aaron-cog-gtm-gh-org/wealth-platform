import { apiGet, expect, openCustody, rowByHeader, tableByCaption, test } from './fixtures';

// US2: Reconcile a statement against settlements.
test.describe('Position check (US2)', () => {
  test('US2-1 an account\'s first statement shows "No previous statement on file." and no rows', async ({ page }) => {
    await openCustody(page, { view: 'check', acct: 2001, date: '2026-04-17' });
    await expect(page.getByRole('status').filter({ hasText: 'No previous statement on file.' })).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
  });

  test('US2-2 a break with no saved note is NEW; differences follow expected = previous + net settled', async ({ page }) => {
    await openCustody(page, { view: 'check', acct: 2038, date: '2026-07-03' });
    const caption = 'Breaks for 01028-01 at 03 Jul 2026';
    await expect(tableByCaption(page, caption).locator('tbody tr')).toHaveCount(1);
    const row = rowByHeader(page, caption, 'GB00ZZ003373');
    await expect(row.locator('td')).toHaveText(['Foxley Telecom PLC Ord', '0', '0', '0', '1,250', '+1,250', 'NEW', '—', '—', '—', 'Update']);
    await expect(page.locator('.cu-meta')).toContainText('26 Jun 2026');
  });

  test('US2-3 saving CHASED with a note persists across reload and writes an audit event', async ({ page }) => {
    await openCustody(page, { view: 'check', acct: 2038, date: '2026-07-03' });
    const caption = 'Breaks for 01028-01 at 03 Jul 2026';
    await page.getByRole('button', { name: 'Update break GB00ZZ003373' }).click();
    const editor = page.getByRole('form', { name: /Update break GB00ZZ003373/ });
    await expect(editor.getByLabel('Status')).toBeFocused();

    // Operator is required.
    await editor.getByRole('button', { name: 'Save break' }).click();
    await expect(editor.getByRole('alert')).toHaveText('Choose the operator recording this update.');

    const note = 'Receipt of 1,250 not yet confirmed by Kestrel; chased settlements desk 06/07.';
    await editor.getByLabel('Status').selectOption('CHASED');
    await editor.getByLabel('Operator').selectOption('LBRENNAN');
    await editor.getByLabel('Note').fill(note);
    await expect(editor).toContainText(`${note.length} / 500 characters`);
    await editor.getByRole('button', { name: 'Save break' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'saved as' })).toHaveText('Break GB00ZZ003373 saved as CHASED by LBRENNAN.');

    const row = rowByHeader(page, caption, 'GB00ZZ003373');
    await expect(row).toContainText('CHASED');
    await expect(row).toContainText(note);
    await expect(row).toContainText('LBRENNAN');

    const audit = page.getByRole('list', { name: 'Audit entries' });
    await expect(audit.locator('li').first()).toContainText('Recon note updated');
    await expect(audit.locator('li').first()).toContainText('01028-01 GB00ZZ003373 statement 2026-07-03 by LBRENNAN: Status NEW → CHASED');

    await page.reload();
    const after = rowByHeader(page, caption, 'GB00ZZ003373');
    await expect(after).toContainText('CHASED');
    await expect(after).toContainText(note);
    await expect(after).toContainText('LBRENNAN');
    await expect(after.locator('td').nth(9)).toHaveText(/^\d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}$/);
    await expect(page.getByRole('list', { name: 'Audit entries' }).locator('li').first()).toContainText('Recon note updated');
  });

  test('US2-3 an existing note is pre-filled and an over-long note cannot be entered', async ({ page }) => {
    await openCustody(page, { view: 'check', acct: 2038, date: '2026-06-26' });
    await page.getByRole('button', { name: 'Update break GB00ZZ003373' }).click();
    const editor = page.getByRole('form', { name: /Update break GB00ZZ003373/ });
    await expect(editor.getByLabel('Status')).toHaveValue('OPEN');
    await expect(editor.getByLabel('Operator')).toHaveValue('LBRENNAN');
    await expect(editor.getByLabel('Note')).toHaveValue(/custodian resent statement/);
    await editor.getByLabel('Note').fill('x'.repeat(520));
    await expect(editor.getByLabel('Note')).toHaveValue('x'.repeat(500));
    await editor.getByRole('button', { name: 'Close' }).click();
    await expect(editor).toHaveCount(0);
  });

  test('US2-4 check all accounts lists every account with a statement and links to its check', async ({ page }) => {
    const api = await apiGet<{ accounts: unknown[] }>('/position-check/2026-07-03');
    await openCustody(page, { view: 'checkall', date: '2026-07-03' });
    const caption = 'Position check for all accounts at 03 Jul 2026';
    await expect(tableByCaption(page, caption).locator('tbody tr')).toHaveCount(api.accounts.length);
    await expect(page.locator('.cu-stats')).toContainText(`Accounts with a statement${api.accounts.length}`);
    await expect(page.locator('.cu-stats')).toContainText('Accounts with breaks1');
    const row = rowByHeader(page, caption, '01028-01');
    await expect(row.locator('td').nth(2)).toHaveText('1');

    await page.getByLabel('Only accounts with breaks').check();
    await expect(tableByCaption(page, caption).locator('tbody tr')).toHaveCount(1);

    await page.getByRole('link', { name: 'View position check for 01028-01' }).click();
    await expect(page).toHaveURL(/view=check&acct=2038&date=2026-07-03/);
    await expect(rowByHeader(page, 'Breaks for 01028-01 at 03 Jul 2026', 'GB00ZZ003373')).toContainText('NEW');
    await page.goBack();
    await expect(tableByCaption(page, caption)).toBeVisible();
  });
});
