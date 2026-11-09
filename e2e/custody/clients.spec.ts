import { expect, openCustody, rowByHeader, tableByCaption, test } from './fixtures';

// US4: Find a client and their accounts.
test.describe('Clients (US4)', () => {
  test('US4-1 partial, case-insensitive name search lists matching clients', async ({ page }) => {
    await openCustody(page, { view: 'clients' });
    await expect(tableByCaption(page, 'All custody clients').locator('tbody tr')).toHaveCount(50);
    await page.getByLabel('Client name or reference').fill('penhal');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/q=penhal/);
    const table = tableByCaption(page, 'Custody clients matching “penhal”');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.locator('tbody tr').first()).toHaveText(/C2017-0124\s*The Penhaligon Family Trust\s*James Smith\s*Active\s*2/);
    await expect(page.getByText('1 clients')).toBeVisible();
  });

  test('US4-1 reference prefix search matches only from the start of the reference', async ({ page }) => {
    await openCustody(page, { view: 'clients', q: 'C2017' });
    const rows = tableByCaption(page, 'Custody clients matching “C2017”').locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    for (const ref of await rows.locator('td:first-child').allTextContents()) expect(ref.startsWith('C2017')).toBe(true);

    await openCustody(page, { view: 'clients', q: '2017-0124' });
    await expect(page.getByText('No custody clients match this search.')).toBeVisible();
  });

  test('US4-2 client summary shows the client and links each account to holdings, settlements and position check', async ({ page }) => {
    await openCustody(page, { view: 'clients', q: 'penhal' });
    await page.getByRole('link', { name: 'The Penhaligon Family Trust' }).click();
    await expect(page).toHaveURL(/view=client&client=1001/);
    await expect(page.getByRole('heading', { name: 'The Penhaligon Family Trust' })).toBeVisible();
    await expect(page.locator('.cu-meta')).toContainText('C2017-0124');
    await expect(page.locator('.cu-meta')).toContainText('James Smith');
    const caption = 'Custody accounts for The Penhaligon Family Trust';
    await expect(tableByCaption(page, caption).locator('tbody tr')).toHaveCount(2);
    await expect(rowByHeader(page, caption, '01001-01')).toContainText('16598');

    await page.getByRole('link', { name: 'Holdings for 01001-01' }).click();
    await expect(page).toHaveURL(/view=holdings&acct=2001/);
    await expect(tableByCaption(page, 'Holdings for 01001-01 at 09 Oct 2026')).toBeVisible();
    await page.goBack();
    await page.getByRole('link', { name: 'Settlements for 01001-02' }).click();
    await expect(page).toHaveURL(/view=settlements&acct=2002/);
    await expect(tableByCaption(page, /^Settlement confirmations for 01001-02/)).toBeVisible();
    await page.goBack();
    await page.getByRole('link', { name: 'Position check for 01001-01' }).click();
    await expect(page).toHaveURL(/view=check&acct=2001/);
    await expect(page.getByLabel('Statement date')).toHaveValue('2026-10-09');
    await page.goBack();
    await page.getByRole('link', { name: 'Back to client search' }).click();
    await expect(page).toHaveURL(/view=clients/);
  });
});
