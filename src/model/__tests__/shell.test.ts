import assert from 'node:assert/strict';
import test from 'node:test';
import type { Data } from '../../data';
import { buildShell } from '../shell';

const makeData = (custody: boolean): Data => ({
  raw: {
    household: {
      name: 'Oyelaran',
      mandate: 'Balanced',
      nextReviewDate: '2026-10-12',
      advisorName: 'Adviser',
      primaryClient: {
        id: '1040',
        displayName: 'Oyelaran',
        riskProfile: 'Moderate',
        riskScore: 5,
        kycStatus: 'Verified',
        kycReviewedDate: '2026-10-01',
      },
      source: custody ? {
        kind: 'custody',
        clientId: 1040,
        reportingCurrency: 'GBP',
        asOf: '2026-07-17',
        unavailable: [],
        missingReportingValues: 0,
      } : undefined,
    },
  },
  totalValue: 0,
  accounts: [],
  holdings: [],
  settlementExceptions: { rows: [] },
} as unknown as Data);

const firstGroupItems = (custody: boolean) =>
  buildShell('c360', 'Populated', () => {}, makeData(custody)).nav[0].items;

test('custody client navigation includes holdings and settlements in the first group', () => {
  const items = firstGroupItems(true);

  assert.deepEqual(
    items.slice(-2).map(({ id, label }) => [id, label]),
    [
      ['custody-holdings', 'Custodian statements'],
      ['custody-settlements', 'Custodian settlements'],
    ],
  );
});

test('household navigation does not include custody holdings or settlements', () => {
  const items = firstGroupItems(false);

  assert.equal(items.some(item => item.id === 'custody-holdings'), false);
  assert.equal(items.some(item => item.id === 'custody-settlements'), false);
});
