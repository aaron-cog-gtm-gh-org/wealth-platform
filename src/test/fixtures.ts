import { vi } from 'vitest';
import type { WealthData } from '../api/types';
import { HOUSEHOLD_ID, CLIENT_ID, OPS_QUEUE } from '../api/client';
import json from './fixtures/wealth-data.json';

/** Snapshot of the API responses for the deterministic Oracle seed (`npm run db:setup`). */
export const wealthData = () => structuredClone(json) as WealthData;

/** Stubs `fetch` with the `/api` routes `loadWealthData` calls, served from the seed snapshot. */
export function stubApi(data: WealthData = wealthData()) {
  const hh = '/api/households/' + encodeURIComponent(HOUSEHOLD_ID);
  const client = '/api/portal/clients/' + encodeURIComponent(CLIENT_ID);
  const routes: Record<string, unknown> = {
    [hh]: data.household,
    [hh + '/portfolio']: data.portfolio,
    [hh + '/performance']: data.performance,
    [hh + '/rebalance']: data.rebalance,
    [hh + '/alternatives']: data.alternatives,
    ['/api/ops/queues/' + encodeURIComponent(OPS_QUEUE) + '/settlement-exceptions']: data.exceptions,
    [client + '/activity']: data.activity,
    [client + '/payments']: data.payments,
  };
  const fetchMock = vi.fn(async (url: string) => {
    const body = routes[url];
    return { ok: body !== undefined, status: body === undefined ? 404 : 200, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Stubs `fetch` so every API call fails, as when the API or Oracle is down. */
export function stubApiDown() {
  const fetchMock = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: 'Service unavailable' }) }) as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
