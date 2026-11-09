import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmationFixture } from '../swift/test-fixtures';
import { activeConfirmations, defaultSettlementWindow, settlementsFor, type ArchivedConfirmation } from './settlements';

function conf(over: Partial<ArchivedConfirmation>): ArchivedConfirmation {
  return {
    mtType: 545, seme: 'S', prev: null, function: 'NEWM', tradeDate: '2026-01-01', settleDate: '2026-01-05',
    isin: 'GB00ZZ000001', qty: 1, safekeepingAcct: '0000042', amountRaw: null, amount: null, ccy: null,
    direction: 'REC', dayFolder: '20260105', fileName: 'MT545_42_20260105_001.txt', ...over,
  };
}

test('D2: a CANC in a later day folder cancels its target', () => {
  const original = confirmationFixture('20260714/MT545_16056_20260714_001.txt');
  const canc = confirmationFixture('20260715/MT545_16056_20260715_002.txt');
  assert.deepEqual(activeConfirmations([canc, original]), []);
  assert.deepEqual(settlementsFor(activeConfirmations([original, canc]), '16056', '2026-07-01', '2026-07-31'), []);
  assert.deepEqual(activeConfirmations([original]), [original]);
});

test('same-folder CANC (PV behaviour) and CANCs never listed', () => {
  const target = confirmationFixture('20260924/MT547_14827_20260924_002.txt');
  const canc = confirmationFixture('20260924/MT547_14827_20260924_003.txt');
  const other = confirmationFixture('20260720/MT547_11848_20260720_001.txt');
  assert.deepEqual(activeConfirmations([target, canc, other]), [other]);
});

test('D1: 8-digit and unpadded 97A::SAFE match the account', () => {
  const c = [confirmationFixture('20260916/MT545_10554_20260916_001.txt'), confirmationFixture('20260916/MT544_11397_20260916_001.txt')];
  assert.deepEqual(settlementsFor(c, '10554', '2026-09-16', '2026-09-16').map((x) => x.seme), ['KS5400063556']);
  assert.deepEqual(settlementsFor(c, '0011397', '2026-09-01', '2026-09-30').map((x) => x.seme), ['KS5400063562']);
  assert.deepEqual(settlementsFor([conf({ safekeepingAcct: '42' })], '0000042', '2026-01-01', '2026-12-31').length, 1);
  assert.deepEqual(settlementsFor(c, '554', '2026-01-01', '2026-12-31'), []);
});

test('date range is inclusive on both ends and uses 98A::SETT', () => {
  const c = ['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07'].map((d, i) => conf({ seme: `S${i}`, settleDate: d }));
  assert.deepEqual(settlementsFor(c, '42', '2026-01-05', '2026-01-06').map((x) => x.settleDate), ['2026-01-06', '2026-01-05']);
  const moved = confirmationFixture('20260714/MT545_16056_20260714_001.txt');
  assert.equal(settlementsFor([moved], '16056', '2026-07-14', '2026-07-14').length, 1);
});

test('newest settle date first; ties in day-folder then file-name order', () => {
  const c = [
    conf({ seme: 'a', settleDate: '2026-01-05', dayFolder: '20260106', fileName: 'MT545_42_20260106_001.txt' }),
    conf({ seme: 'b', settleDate: '2026-01-06', dayFolder: '20260106', fileName: 'MT547_42_20260106_001.txt' }),
    conf({ seme: 'c', settleDate: '2026-01-05', dayFolder: '20260105', fileName: 'MT547_42_20260105_001.txt' }),
    conf({ seme: 'd', settleDate: '2026-01-05', dayFolder: '20260105', fileName: 'MT545_42_20260105_001.txt' }),
  ];
  assert.deepEqual(settlementsFor(activeConfirmations(c), '42', '2026-01-01', '2026-01-31').map((x) => x.seme), ['b', 'd', 'c', 'a']);
});

test('default window: 90 days back to the latest statement, else today', () => {
  assert.deepEqual(defaultSettlementWindow('2026-10-09', '2026-11-09'), { from: '2026-07-11', to: '2026-10-09' });
  assert.deepEqual(defaultSettlementWindow(null, '2026-03-01'), { from: '2025-12-01', to: '2026-03-01' });
});
