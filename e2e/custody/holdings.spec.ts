import { apiGet, expect, openCustody, rowByHeader, tableByCaption, test } from './fixtures';

// US1: View a custodian holdings statement.
test.describe('Holdings (US1)', () => {
  test('US1-1 latest statement date is selected and dates are listed newest first', async ({ page }) => {
    const { dates } = await apiGet<{ dates: string[] }>('/accounts/2001/statements');
    await openCustody(page, { view: 'holdings', acct: 2001 });
    const date = page.getByLabel('Statement date');
    await expect(date).toHaveValue('2026-10-09');
    const values = await date.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value));
    expect(values).toEqual(dates);
    expect(values).toEqual([...values].sort().reverse());
    await expect(page.getByLabel('Account')).toHaveValue('2001');
    await expect(page.locator('.cu-meta')).toContainText('The Penhaligon Family Trust');

    const table = tableByCaption(page, 'Holdings for 01001-01 at 09 Oct 2026');
    await expect(table.locator('tbody tr')).toHaveCount(19);
    await expect(rowByHeader(page, 'Holdings for 01001-01', 'GB00ZZ000775')).toContainText('Larchmont Property PLC Ord');
    await expect(rowByHeader(page, 'Holdings for 01001-01', 'GB00ZZ000775')).toContainText('8,509.76');
    await expect(table.locator('tfoot')).toContainText('£283,880.39');
  });

  test('US1-2 a re-sent statement shows the highest file sequence', async ({ page }) => {
    // Safekeeping 16558 has three MT535 files for 26 Jun 2026 (_001, _002 RPLC-style resend, _003 NEWM/DUPL).
    await openCustody(page, { view: 'holdings', acct: 2038, date: '2026-06-26' });
    const meta = page.locator('.cu-meta');
    await expect(meta).toContainText('MT535_16558_20260626_003.txt');
    await expect(meta).toContainText('NEWM/DUPL');
    const api = await apiGet<{ lines: unknown[]; totalGbp: number }>('/accounts/2038/statements/2026-06-26');
    await expect(tableByCaption(page, 'Holdings for 01028-01 at 26 Jun 2026').locator('tbody tr')).toHaveCount(api.lines.length);
  });

  test('US1-3 an ISIN missing from instrument reference data reads UNKNOWN INSTRUMENT', async ({ page }) => {
    await openCustody(page, { view: 'holdings', acct: 2023, date: '2026-10-09' });
    await expect(rowByHeader(page, 'Holdings for 01016-01', 'GB00ZZ004322')).toContainText('UNKNOWN INSTRUMENT GB00ZZ004322');
  });

  test('US1-4 deep link with account and date round-trips through Back/Forward', async ({ page }) => {
    await openCustody(page, { view: 'holdings', acct: 2001, date: '2026-07-17' });
    await expect(page.getByLabel('Statement date')).toHaveValue('2026-07-17');
    await expect(tableByCaption(page, 'Holdings for 01001-01 at 17 Jul 2026')).toBeVisible();

    await page.getByLabel('Statement date').selectOption('2026-07-10');
    await expect(page).toHaveURL(/date=2026-07-10/);
    await expect(tableByCaption(page, 'Holdings for 01001-01 at 10 Jul 2026')).toBeVisible();

    await page.getByLabel('Account').selectOption('2002');
    await expect(page).toHaveURL(/acct=2002/);
    await expect(tableByCaption(page, /^Holdings for 01001-02 at /)).toBeVisible();

    await page.goBack();
    await expect(page.getByLabel('Account')).toHaveValue('2001');
    await expect(page.getByLabel('Statement date')).toHaveValue('2026-07-10');
    await page.goBack();
    await expect(page.getByLabel('Statement date')).toHaveValue('2026-07-17');
    await expect(tableByCaption(page, 'Holdings for 01001-01 at 17 Jul 2026')).toBeVisible();
    await page.goForward();
    await expect(page.getByLabel('Statement date')).toHaveValue('2026-07-10');

    await page.reload();
    await expect(page.getByLabel('Statement date')).toHaveValue('2026-07-10');
    await expect(tableByCaption(page, 'Holdings for 01001-01 at 10 Jul 2026')).toBeVisible();
  });
});
