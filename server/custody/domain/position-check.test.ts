import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSwiftAmount } from '../swift/parse';
import { confirmationFixture, statementFixture } from '../swift/test-fixtures';
import type { Confirmation, Statement } from '../swift/types';
import { addDays } from './dates';
import type { StatementFile } from './holdings';
import { NO_PREVIOUS_MESSAGE, positionCheck, positionCheckWindow, runPositionCheck } from './position-check';
import type { ArchivedConfirmation } from './settlements';

function stmt(date: string, holdings: Record<string, number>, safe = '0000042'): Statement {
  return {
    function: 'NEWM',
    statementDate: date,
    safekeepingAcct: safe,
    lines: Object.entries(holdings).map(([isin, qty]) => ({ isin, description: '', qty, qtyType: 'UNIT', price: 0, ccy: 'GBP', mktVal: 0, mktValGbp: 0 })),
  };
}

function settle(isin: string, qty: number, direction: 'REC' | 'DEL', over: Partial<ArchivedConfirmation> = {}): ArchivedConfirmation {
  return {
    mtType: direction === 'REC' ? 545 : 547, seme: `${isin}-${qty}`, prev: null, function: 'NEWM', tradeDate: '2026-01-05',
    settleDate: '2026-01-06', isin, qty, safekeepingAcct: '0000042', amountRaw: null, amount: null, ccy: null, direction,
    dayFolder: '20260106', fileName: 'x.txt', ...over,
  };
}

// Ported from PV.Tests PositionCheckTests.
test('PositionCheckTests: ToAmount pounds and pence / no decimals', () => {
  assert.equal(parseSwiftAmount('GBP4303,01'), 4303.01);
  assert.equal(parseSwiftAmount('USD192,'), 192);
});

test('PositionCheckTests: expected = prev + REC - DEL (100 + 50 - 25 = 125)', () => {
  const r = positionCheck(stmt('2026-01-02', { A: 100 }), stmt('2026-01-09', { A: 120 }), [settle('A', 50, 'REC'), settle('A', 25, 'DEL')]);
  assert.deepEqual(r.rows.map((x) => [x.prevQty, x.netSettled, x.expected, x.stmtQty, x.diff]), [[100, 25, 125, 120, -5]]);
  assert.equal(positionCheck(stmt('2026-01-02', { A: 100 }), stmt('2026-01-09', { A: 125 }), [settle('A', 50, 'REC'), settle('A', 25, 'DEL')]).rows.length, 0);
});

test('zero differences omitted, no tolerance, exact decimals', () => {
  const r = positionCheck(
    stmt('2026-01-02', { A: 0.1, B: 1000, C: 5 }),
    stmt('2026-01-09', { A: 0.3, B: 1000.0001, C: 5 }),
    [settle('A', 0.2, 'REC')],
  );
  assert.deepEqual(r.rows.map((x) => [x.isin, x.diff]), [['B', 0.0001]]);
});

test('ISINs only on one side, or only in settlements, are checked', () => {
  const r = positionCheck(stmt('2026-01-02', { GONE: 10 }), stmt('2026-01-09', { NEW1: 7 }), [settle('MOVED', 3, 'DEL')]);
  assert.deepEqual(
    r.rows.map((x) => [x.isin, x.prevQty, x.netSettled, x.stmtQty, x.diff]),
    [['GONE', 10, 0, 0, -10], ['MOVED', 0, -3, 0, 3], ['NEW1', 0, 0, 7, 7]],
  );
});

test('rows sorted by ISIN ordinal; NEW when no note, note fields otherwise', () => {
  const notes = [{ isin: 'b', status: 'CHASED', note: 'asked custodian', updatedBy: 'LBRENNAN', updatedAt: '2026-01-12T09:00:00' }];
  const names = new Map([['a', 'Alpha']]);
  const r = positionCheck(stmt('2026-01-02', {}), stmt('2026-01-09', { b: 1, a: 1, B: 1 }), [], notes, names);
  assert.deepEqual(r.rows.map((x) => x.isin), ['B', 'a', 'b']);
  assert.deepEqual(r.rows.map((x) => [x.instrument, x.status, x.note, x.updatedBy]), [
    ['UNKNOWN INSTRUMENT B', 'NEW', null, null],
    ['Alpha', 'NEW', null, null],
    ['UNKNOWN INSTRUMENT b', 'CHASED', 'asked custodian', 'LBRENNAN'],
  ]);
});

test('no previous statement: message, no rows', () => {
  const curr = stmt('2026-01-09', { A: 1 });
  const r = positionCheck(null, curr, []);
  assert.deepEqual(r, { prevStmtDate: null, noPrevMessage: NO_PREVIOUS_MESSAGE, rows: [], statement: curr });
});

test('missing current statement: every previous holding breaks', () => {
  const r = positionCheck(stmt('2026-01-02', { A: 4 }), null, []);
  assert.deepEqual([r.prevStmtDate, r.statement, r.rows.map((x) => x.diff)], ['2026-01-02', null, [-4]]);
});

test('settlement without ISIN is an error (PV threw on a null key)', () => {
  assert.throws(() => positionCheck(stmt('2026-01-02', {}), null, [{ ...settle('A', 1, 'REC'), isin: null } as Confirmation]), TypeError);
});

test('window is (previous, statement]', () => {
  assert.deepEqual(positionCheckWindow('2026-01-02', '2026-01-09'), { from: '2026-01-03', to: '2026-01-09' });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
});

test('runPositionCheck: strictly earlier previous, window bounds, highest file seq', () => {
  const files: StatementFile[] = [
    { fileSeq: 1, statement: stmt('2026-01-02', { A: 100 }) },
    { fileSeq: 1, statement: stmt('2026-01-09', { A: 999 }) },
    { fileSeq: 2, statement: stmt('2026-01-09', { A: 140 }) },
  ];
  const confs = [
    settle('A', 1000, 'REC', { seme: 'on-prev', settleDate: '2026-01-02' }),
    settle('A', 30, 'REC', { seme: 'first', settleDate: '2026-01-03' }),
    settle('A', 10, 'REC', { seme: 'last', settleDate: '2026-01-09' }),
    settle('A', 1000, 'REC', { seme: 'after', settleDate: '2026-01-10' }),
    settle('A', 1000, 'REC', { seme: 'other-acct', safekeepingAcct: '0000043' }),
  ];
  const ok = runPositionCheck(files, confs, '42', '2026-01-09');
  assert.deepEqual([ok.prevStmtDate, ok.rows], ['2026-01-02', []]);
  const first = runPositionCheck(files, confs, '42', '2026-01-02');
  assert.equal(first.noPrevMessage, NO_PREVIOUS_MESSAGE);
});

test('runPositionCheck on real files: D2 cancellation and D1 8-digit safe', () => {
  const prev = stmt('2026-07-10', { GB00ZZ001500: 0 }, '0016056');
  const curr = stmt('2026-07-17', {}, '0016056');
  const files = [prev, curr].map((statement) => ({ fileSeq: 1, statement }));
  const original = confirmationFixture('20260714/MT545_16056_20260714_001.txt');
  const canc = confirmationFixture('20260715/MT545_16056_20260715_002.txt');
  assert.deepEqual(runPositionCheck(files, [original, canc], '16056', '2026-07-17').rows, []);
  assert.deepEqual(runPositionCheck(files, [original], '16056', '2026-07-17').rows.map((r) => r.diff), [-210]);

  const rec = confirmationFixture('20260916/MT545_10554_20260916_001.txt');
  const p = stmt('2026-09-11', { LU00ZZ014180: 8462.307 }, '0010554');
  const c = stmt('2026-09-18', { LU00ZZ014180: 12238.377 }, '0010554');
  const check = runPositionCheck([p, c].map((statement) => ({ fileSeq: 1, statement })), [rec], '10554', '2026-09-18');
  assert.deepEqual(check.rows, []);
});

test('real resends: _003 is the statement compared', () => {
  const files = ['MT535_16558_20260626_001.txt', 'MT535_16558_20260626_002.txt', 'MT535_16558_20260626_003.txt'].map(statementFixture);
  const prev = { fileSeq: 1, statement: { ...files[1].statement, statementDate: '2026-06-19', function: 'NEWM' } };
  const r = runPositionCheck([prev, ...files], [], '16558', '2026-06-26');
  assert.equal(r.statement?.function, 'NEWM/DUPL');
  assert.deepEqual(r.rows.map((x) => [x.isin, x.prevQty, x.stmtQty, x.diff]), [['GB00ZZ003373', 1250, 0, -1250]]);
});
