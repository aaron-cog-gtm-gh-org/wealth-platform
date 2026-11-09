import { test as base, expect, type Page } from '@playwright/test';

export { expect };

const API = process.env.CUSTODY_API_URL ?? 'http://127.0.0.1:3001';

/** Restores seed data (workflow + custody reference data and the 13 recon notes, audit trail cleared). */
export async function resetData() {
  const res = await fetch(`${API}/api/test/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  if (!res.ok) throw new Error(`POST /api/test/reset returned ${res.status}; start the API with ENABLE_TEST_RESET=1 on loopback.`);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/custody${path}`);
  if (!res.ok) throw new Error(`GET /api/custody${path} returned ${res.status}`);
  return (await res.json()) as T;
}

/** Opens a Custody deep link, e.g. `{ view: 'holdings', acct: 2001 }`. */
export async function openCustody(page: Page, params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams({ screen: 'workspace', area: 'custody', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  await page.goto(`/?${qs}`);
  await expect(page.getByRole('tab', { name: /Custody/ })).toHaveAttribute('aria-selected', 'true');
}

/** The table whose caption starts with `caption`. */
export const tableByCaption = (page: Page, caption: string | RegExp) =>
  page.locator('table').filter({ has: page.locator('caption', { hasText: caption }) });

/** Body rows of a table, keyed by their row header. */
export const rowByHeader = (page: Page, caption: string | RegExp, header: string) =>
  tableByCaption(page, caption).locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: header, exact: true }) });

export const test = base.extend<{ fresh: void }>({
  // Playwright requires a destructuring pattern for the fixtures argument.
  // eslint-disable-next-line no-empty-pattern
  fresh: [async ({}, use) => { await resetData(); await use(); }, { auto: true }],
});
