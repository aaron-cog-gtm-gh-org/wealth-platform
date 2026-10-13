import assert from 'node:assert/strict';
import test from 'node:test';
import type { CustodyConfirmation } from '../../api/types';
import { defaultSettlementRange, fmtDec, toSettlementRows } from '../custody-settlements';

const confirmation = (overrides: Partial<CustodyConfirmation> = {}): CustodyConfirmation => ({
  confirmationId: 1,
  mtType: 544,
  direction: 'Receive',
  freeOfPayment: true,
  tradeDate: '2026-09-15',
  settleDate: '2026-09-16',
  isin: 'GB0000000001',
  name: 'Example security',
  qty: '1252.7051',
  qtyType: 'UNIT',
  amount: null,
  amountCcy: null,
  reference: 'KS5400060214',
  messageId: 10,
  ...overrides,
});

test('fmtDec formats fixed-point amounts and quantities without floating point', () => {
  assert.equal(fmtDec('21637.50', 2, 2), '21,637.50');
  assert.equal(fmtDec('21637.5', 2, 2), '21,637.50');
  assert.equal(fmtDec('1252.7051', 0, 4), '1,252.7051');
  assert.equal(fmtDec('2924.90', 0, 4), '2,924.9');
  assert.equal(fmtDec('5000', 0, 4), '5,000');
  assert.equal(fmtDec('0.12345', 0, 4), '0.1235');
});

test('defaultSettlementRange uses the latest statement or today and subtracts 90 UTC days', () => {
  assert.deepEqual(defaultSettlementRange('2026-07-31', '2026-10-13'), {
    from: '2026-05-02',
    to: '2026-07-31',
  });
  assert.equal(defaultSettlementRange(null, '2026-10-13').to, '2026-10-13');
});

test('toSettlementRows maps FOP, direction, face quantities, and null amounts', () => {
  const [fop] = toSettlementRows([confirmation()]);
  assert.equal(fop.msg, 'MT544');
  assert.equal(fop.fop, true);
  assert.equal(fop.fopLabel, 'Free of payment');
  assert.equal(fop.amountFmt, '—');
  assert.equal(fop.direction, 'Receive');

  const [deliver] = toSettlementRows([confirmation({
    mtType: 547,
    direction: 'Deliver',
    freeOfPayment: false,
    qtyType: 'FAMT',
  })]);
  assert.equal(deliver.msg, 'MT547');
  assert.equal(deliver.direction, 'Deliver');
  assert.equal(deliver.fop, false);
  assert.equal(deliver.qtyType, 'FAMT face');
});
