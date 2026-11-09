import { expect, openCustody, rowByHeader, tableByCaption, test } from './fixtures';

// Key controls are operable with the keyboard alone (constitution IV, spec SC-005).
test.describe('Keyboard operation', () => {
  test('workspace tabs and custody navigation', async ({ page }) => {
    await openCustody(page, { view: 'clients' });
    const tab = page.getByRole('tab', { name: /Custody/ });
    await tab.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tab).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(tab).toBeFocused();

    const nav = page.getByRole('navigation', { name: 'Custody views' });
    await nav.getByRole('link', { name: 'Archive' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/view=archive/);
    await expect(nav.getByRole('link', { name: 'Archive' })).toHaveAttribute('aria-current', 'page');
  });

  test('client search to holdings with the keyboard', async ({ page }) => {
    await openCustody(page, { view: 'clients' });
    await page.getByLabel('Client name or reference').focus();
    await page.keyboard.type('Penhaligon');
    await page.keyboard.press('Enter');
    await expect(tableByCaption(page, 'Custody clients matching “Penhaligon”').locator('tbody tr')).toHaveCount(1);
    await page.getByRole('link', { name: 'The Penhaligon Family Trust' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'The Penhaligon Family Trust' })).toBeVisible();
    await page.getByRole('link', { name: 'Holdings for 01001-01' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Statement date')).toHaveValue('2026-10-09');
    await page.getByLabel('Statement date').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByLabel('Statement date')).toHaveValue('2026-10-02');
    await expect(tableByCaption(page, 'Holdings for 01001-01 at 02 Oct 2026')).toBeVisible();
  });

  test('recording a recon note with the keyboard', async ({ page }) => {
    await openCustody(page, { view: 'check', acct: 2038, date: '2026-07-03' });
    await page.getByRole('button', { name: 'Update break GB00ZZ003373' }).focus();
    await page.keyboard.press('Enter');
    const editor = page.getByRole('form', { name: /Update break GB00ZZ003373/ });
    await expect(editor.getByLabel('Status')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(editor.getByLabel('Status')).toHaveValue('CHASED');
    await page.keyboard.press('Tab');
    await expect(editor.getByLabel('Operator')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(editor.getByLabel('Operator')).not.toHaveValue('');
    const operator = await editor.getByLabel('Operator').inputValue();
    await page.keyboard.press('Tab');
    await expect(editor.getByLabel('Note')).toBeFocused();
    await page.keyboard.type('Chased by keyboard.');
    await editor.getByRole('button', { name: 'Save break' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'saved as' })).toHaveText(`Break GB00ZZ003373 saved as CHASED by ${operator}.`);
    await expect(rowByHeader(page, 'Breaks for 01028-01 at 03 Jul 2026', 'GB00ZZ003373')).toContainText('Chased by keyboard.');
  });

  test('messages raw viewer and archive reload confirmation with the keyboard', async ({ page }) => {
    await openCustody(page, { view: 'messages', file: 'MT535_16558_20260626_003.txt' });
    const raw = page.getByLabel('Raw SWIFT text of MT535_16558_20260626_003.txt');
    await raw.focus();
    await expect(raw).toBeFocused();
    await page.getByRole('button', { name: 'Close message' }).focus();
    await page.keyboard.press('Enter');
    await expect(raw).toHaveCount(0);

    await openCustody(page, { view: 'archive' });
    await page.getByRole('button', { name: 'Reload archive' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Reload now' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Reload archive' })).toBeVisible();
  });
});
