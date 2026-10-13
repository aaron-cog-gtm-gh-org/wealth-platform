import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseMt54x } from '../swift/mt54x.js';

const fixture = (p: string) => readFileSync(new URL(`../../../fixtures/custody/archive-sample/mt54x/${p}`, import.meta.url), 'utf8');

test('MT545 receive against payment', () => {
  const c = parseMt54x(fixture('20260714/MT545_16056_20260714_001.txt'));
  assert.deepEqual(c, {
    mtType: 545, senderBic: 'KSTLGB2LXXX', seme: 'KS5400060882', prevRef: null, functionCode: 'NEWM',
    tradeDate: '2026-07-10', settleDate: '2026-07-14', isin: 'GB00ZZ001500', custodianDesc: 'Ashby Networks PLC Ord',
    qty: '210.00', qtyType: 'UNIT', safeRaw: '0016056', safeNo: 16056, amount: '2237.55', amountCcy: 'GBP',
    amountRaw: 'GBP2237,55', direction: 'RECEIVE', freeOfPayment: false,
  });
});

test('cross-day CANC carries PREV reference', () => {
  const c = parseMt54x(fixture('20260715/MT545_16056_20260715_002.txt'));
  assert.equal(c.functionCode, 'CANC');
  assert.equal(c.seme, 'KS5400064555');
  assert.equal(c.prevRef, 'KS5400060882');
});

test('8-digit safes are numeric (D-2) and MT544 is free of payment', () => {
  const a = parseMt54x(fixture('20260916/MT544_11397_20260916_001.txt'));
  assert.equal(a.safeRaw, '00011397');
  assert.equal(a.safeNo, 11397);
  assert.equal(a.freeOfPayment, true);
  assert.equal(a.amount, null);
  assert.equal(a.direction, 'RECEIVE');
  assert.equal(a.isin, 'LU00ZZ013430');
  assert.equal(a.qty, '2775.949');
  assert.equal(parseMt54x(fixture('20260916/MT545_10554_20260916_001.txt')).safeNo, 10554);
});

test('one-decimal amount is tenths, not hundredths (D-1)', () => {
  const c = parseMt54x(fixture('20260701/MT545_12203_20260701_001.txt'));
  assert.equal(c.amountRaw, 'GBP21637,5');
  assert.equal(c.amount, '21637.50');
  assert.equal(c.qty, '5823.42');
});

test('FAMT quantity type', () => {
  const c = parseMt54x(fixture('20260420/MT545_14479_20260420_001.txt'));
  assert.equal(c.qtyType, 'FAMT');
  assert.equal(c.qty, '4000.00');
  assert.equal(c.amount, '3739.48');
});

test('MT546 deliver free of payment', () => {
  const c = parseMt54x(fixture('20260421/MT546_14690_20260421_001.txt'));
  assert.equal(c.direction, 'DELIVER');
  assert.equal(c.freeOfPayment, true);
  assert.equal(c.amount, null);
  assert.equal(c.settleDate, '2026-04-21');
});
