import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, openCustody, rowByHeader, tableByCaption, test } from './fixtures';

// T027 browser spot-check: the Custody UI shows the numbers the live legacy PV produced (golden snapshot captured
// from PV on :8080), and the documented divergences D1/D2/D3 (specs/001-custody-portfolio-viewer/parity-report.md).
type Line = { isin: string; qty: number; mktValGbp: number };
type Golden = {
  accounts: Array<{ acctId: number; acctNo: string }>;
  holdings: Array<{ acctId: number; statementDate: string; lines: Line[]; totalGbp: number }>;
  settlements: Array<{ acctId: number; settlements: Array<{ seme: string; amount: number }> }>;
  positionChecks: Array<{ acctId: number; statementDate: string; rows: Array<{ isin: string; diff: number }> }>;
  checkAll: Array<{ statementDate: string; accounts: Array<{ acctId: number; acctNo: string; breaks: number | null }> }>;
};
const golden = JSON.parse(gunzipSync(readFileSync(new URL('../../scripts/legacy-parity/golden/pv-golden.json.gz', import.meta.url))).toString()) as Golden;
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const acctNo = (id: number) => golden.accounts.find(a => a.acctId === id)!.acctNo;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (iso: string) => `${iso.slice(8)} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

const SAMPLE: Array<[number, string]> = [
  [2001, '2026-10-09'], [2038, '2026-06-26'], [2074, '2026-07-31'],
  [2125, '2026-09-18'], [2129, '2026-09-18'], [2145, '2026-07-17'],
];

test.describe('Parity spot-check against PV', () => {
  for (const [acctId, date] of SAMPLE) {
    test(`holdings ${acctId} ${date} match PV`, async ({ page }) => {
      const pv = golden.holdings.find(h => h.acctId === acctId && h.statementDate === date)!;
      await openCustody(page, { view: 'holdings', acct: acctId, date });
      const caption = `Holdings for ${acctNo(acctId)} at ${longDate(date)}`;
      const table = tableByCaption(page, caption);
      await expect(table.locator('tbody tr')).toHaveCount(pv.lines.length);
      await expect(table.locator('tfoot')).toContainText(gbp(pv.totalGbp));
      for (const l of pv.lines.slice(0, 5)) {
        await expect(rowByHeader(page, caption, l.isin)).toContainText(l.qty.toLocaleString('en-GB', { maximumFractionDigits: 6 }));
      }
    });
  }

  test('position check break 2074 2026-07-31 matches PV', async ({ page }) => {
    const pv = golden.positionChecks.find(p => p.acctId === 2074 && p.statementDate === '2026-07-31')!;
    expect(pv.rows.length).toBeGreaterThan(0);
    await openCustody(page, { view: 'check', acct: 2074, date: '2026-07-31' });
    const caption = `Breaks for ${acctNo(2074)} at 31 Jul 2026`;
    await expect(tableByCaption(page, caption).locator('tbody tr')).toHaveCount(pv.rows.length);
    for (const r of pv.rows) await expect(rowByHeader(page, caption, r.isin)).toBeVisible();
  });

  test('D1: unpadded safekeeping confirmations clear PV\'s 2026-09-18 breaks for 10554 and 11397', async ({ page }) => {
    for (const [acctId, isin] of [[2125, 'LU00ZZ014180'], [2129, 'LU00ZZ013430']] as const) {
      const pv = golden.positionChecks.find(p => p.acctId === acctId && p.statementDate === '2026-09-18')!;
      expect(pv.rows.map(r => r.isin)).toEqual([isin]);
      await openCustody(page, { view: 'check', acct: acctId, date: '2026-09-18' });
      await expect(page.locator('.cu-meta')).toContainText('Breaks0');
    }
    const pvAll = golden.checkAll.find(c => c.statementDate === '2026-09-18')!;
    await openCustody(page, { view: 'checkall', date: '2026-09-18' });
    const caption = 'Position check for all accounts at 18 Sep 2026';
    await expect(tableByCaption(page, caption).locator('tbody tr')).toHaveCount(pvAll.accounts.length);
    for (const a of pvAll.accounts.filter(x => [2001, 2038, 2125, 2129].includes(x.acctId))) {
      const expected = [2125, 2129].includes(a.acctId) ? (a.breaks ?? 0) - 1 : a.breaks ?? 0;
      await expect(rowByHeader(page, caption, a.acctNo).locator('td').nth(2)).toHaveText(String(expected));
    }
  });

  test('D2: the cross-day CANC removes KS5400060882 and PV\'s 2026-07-17 break for 01079-03', async ({ page }) => {
    const pvSett = golden.settlements.find(s => s.acctId === 2145)!;
    expect(pvSett.settlements.map(s => s.seme)).toContain('KS5400060882');
    const pvCheck = golden.positionChecks.find(p => p.acctId === 2145 && p.statementDate === '2026-07-17')!;
    expect(pvCheck.rows).toMatchObject([{ isin: 'GB00ZZ001500', diff: -210 }]);

    await openCustody(page, { view: 'settlements', acct: 2145, from: '2026-07-01', to: '2026-07-31' });
    const table = tableByCaption(page, /^Settlement confirmations for 01079-03/);
    await expect(table).toBeVisible();
    await expect(table).not.toContainText('KS5400060882');
    await openCustody(page, { view: 'check', acct: 2145, date: '2026-07-17' });
    await expect(page.locator('.cu-meta')).toContainText('Breaks0');
  });

  test('D3: a one-digit 19A fraction is read as tenths (PV 11524.08, API 11524.80)', async ({ page }) => {
    const pv = golden.settlements.find(s => s.acctId === 2001)!.settlements.find(s => s.seme === 'KS5400064539')!;
    expect(pv.amount).toBe(11524.08);
    await openCustody(page, { view: 'settlements', acct: 2001 });
    await expect(tableByCaption(page, /^Settlement confirmations for 01001-01/).locator('tbody tr').filter({ hasText: 'KS5400064539' })).toContainText('11,524.80');
  });
});
