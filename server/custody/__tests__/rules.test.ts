import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { listArchive, parseArchiveText, factsFrom } from '../archive.js';
import {
  applyCancellations, buildRuleContext, confirmationAmount, confirmationMatchesAccount, legacyToAmount, positionCheck,
  reconcile, selectEffectiveStatement, statementFor, type AccountRef, type ConfirmationFact, type StatementFact,
} from '../rules.js';

const ROOT = new URL('../../../fixtures/custody/archive-sample/', import.meta.url);
const sample = factsFrom(listArchive(ROOT.pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  .map(e => parseArchiveText(e, readFileSync(new URL(e.sourceFile, ROOT), 'utf8'))));

const stmt = (o: Partial<StatementFact>): StatementFact => ({
  ref: 's', safeRaw: '0016598', safeNo: 16598, date: '2026-07-17', functionCode: 'NEWM', fileSeq: 1, isEmpty: false, lines: [], ...o,
});
const conf = (o: Partial<ConfirmationFact>): ConfirmationFact => ({
  ref: 'c', folder: '20260714', safeRaw: '0016598', safeNo: 16598, seme: 'S1', prevRef: null, functionCode: 'NEWM',
  settleDate: '2026-07-14', isin: 'GB00ZZ000001', qty: '100.00', qtyType: 'UNIT', direction: 'RECEIVE', amountRaw: null, ...o,
});

test('sample archive parses without errors', () => {
  assert.deepEqual(sample.errors, []);
  assert.equal(sample.statements.length + sample.confirmations.length, 15);
});

test('D-1: one-decimal amounts — corrected 21637.50, legacy 21637.05 (BR-5)', () => {
  const c = sample.confirmations.find(x => x.ref === 'MT545_12203_20260701_001.txt')!;
  assert.equal(confirmationAmount(c.amountRaw, 'corrected'), '21637.50');
  assert.equal(confirmationAmount(c.amountRaw, 'legacy'), '21637.05');
  assert.equal(legacyToAmount('GBP2237,55'), '2237.55');
  assert.equal(legacyToAmount('GBP1250,'), '1250.00');
  assert.equal(confirmationAmount(null, 'legacy'), null);
});

test('D-2: 8-digit MT54x safes match the account only in corrected mode (BR-3)', () => {
  const acct: AccountRef = { accountId: 1, safeCode: '11397', safeNo: 11397 };
  const c = sample.confirmations.find(x => x.ref === 'MT544_11397_20260916_001.txt')!;
  assert.equal(confirmationMatchesAccount(c, acct, 'corrected'), true);
  assert.equal(confirmationMatchesAccount(c, acct, 'legacy'), false);
  const padded = conf({ safeRaw: '0011397', safeNo: 11397 });
  assert.equal(confirmationMatchesAccount(padded, acct, 'legacy'), true);
});

test('D-3: cross-day CANC cancels its original only in corrected mode (BR-4)', () => {
  const ours = sample.confirmations.filter(c => c.safeNo === 16056);
  const corrected = applyCancellations(ours, 'corrected');
  assert.deepEqual(corrected.active.map(c => c.ref), []);
  assert.equal(corrected.cancelledBy.get('MT545_16056_20260714_001.txt'), 'MT545_16056_20260715_002.txt');
  assert.deepEqual(corrected.unmatched, []);
  const legacy = applyCancellations(ours, 'legacy');
  assert.deepEqual(legacy.active.map(c => c.ref), ['MT545_16056_20260714_001.txt']);
  assert.equal(legacy.unmatched.length, 1);
});

test('same-folder CANC cancels in both modes; corrected requires the same safe', () => {
  const xs = [conf({ ref: 'a' }), conf({ ref: 'b', safeNo: 1, safeRaw: '0000001' }), conf({ ref: 'x', functionCode: 'CANC', seme: 'S2', prevRef: 'S1' })];
  assert.deepEqual(applyCancellations(xs, 'corrected').active.map(c => c.ref), ['b']);
  assert.deepEqual(applyCancellations(xs, 'legacy').active.map(c => c.ref), []);
});

test('D-4: RPLC beats a later NEWM/DUPL in corrected mode; legacy takes highest seq (BR-1)', () => {
  const day = sample.statements.filter(s => s.safeNo === 16558);
  assert.equal(day.length, 3);
  assert.equal(selectEffectiveStatement(day, 'corrected')!.ref, 'MT535_16558_20260626_002.txt');
  assert.equal(selectEffectiveStatement(day, 'legacy')!.ref, 'MT535_16558_20260626_003.txt');
  const newmOnly = [stmt({ ref: '1', fileSeq: 1 }), stmt({ ref: '2', fileSeq: 2 }), stmt({ ref: '3', fileSeq: 3, functionCode: 'NEWM/DUPL' })];
  assert.equal(selectEffectiveStatement(newmOnly, 'corrected')!.ref, '2');
  assert.equal(selectEffectiveStatement([stmt({ ref: 'd', functionCode: 'NEWM/DUPL' })], 'corrected')!.ref, 'd');
});

test('BR-2: statement key strips zeros in legacy, numeric in corrected', () => {
  const s = [stmt({ ref: 'p', safeRaw: '0010226', safeNo: 10226 })];
  const acct: AccountRef = { accountId: 9, safeCode: '10226', safeNo: 10226 };
  for (const mode of ['corrected', 'legacy'] as const) assert.equal(statementFor(buildRuleContext(s, [], mode), acct, '2026-07-17')!.ref, 'p');
});

test('reconcile: expected = previous + receipts − deliveries; zero differences are not breaks', () => {
  const prev = stmt({ lines: [{ isin: 'A', qty: '100.00', qtyType: 'UNIT' }, { isin: 'B', qty: '50.00', qtyType: 'UNIT' }] });
  const cur = stmt({ lines: [{ isin: 'A', qty: '130.00', qtyType: 'UNIT' }, { isin: 'B', qty: '60.00', qtyType: 'UNIT' }] });
  const settles = [conf({ ref: 'r', isin: 'A', qty: '40.00' }), conf({ ref: 'd', isin: 'A', qty: '10.00', direction: 'DELIVER' })];
  for (const mode of ['corrected', 'legacy'] as const) {
    const rows = reconcile(prev, cur, settles, mode);
    assert.deepEqual(rows.map(r => [r.isin, r.previousQty, r.settledNet, r.expectedQty, r.reportedQty, r.difference]), [['B', '50.00', '0.00', '50.00', '60.00', '10.00']]);
  }
});

test('reconcile keys on (ISIN, qty type) in corrected mode only', () => {
  const prev = stmt({ lines: [{ isin: 'A', qty: '100.00', qtyType: 'FAMT' }] });
  const cur = stmt({ lines: [{ isin: 'A', qty: '100.00', qtyType: 'UNIT' }] });
  assert.equal(reconcile(prev, cur, [], 'corrected').length, 2);
  assert.equal(reconcile(prev, cur, [], 'legacy').length, 0);
});

test('position check window is (previous date, date] and legacy double counts the D-3 pair', () => {
  const acct: AccountRef = { accountId: 2026, safeCode: '16056', safeNo: 16056 };
  const prev = stmt({ ref: 'p', safeRaw: '0016056', safeNo: 16056, date: '2026-07-10', lines: [{ isin: 'GB00ZZ001500', qty: '1000.00', qtyType: 'UNIT' }] });
  const cur = stmt({ ref: 'c', safeRaw: '0016056', safeNo: 16056, date: '2026-07-17', lines: [{ isin: 'GB00ZZ001500', qty: '1000.00', qtyType: 'UNIT' }] });
  const confs = sample.confirmations.filter(c => c.safeNo === 16056);
  const corrected = positionCheck(buildRuleContext([prev, cur], confs, 'corrected'), acct, '2026-07-17');
  assert.equal(corrected.previousDate, '2026-07-10');
  assert.deepEqual(corrected.rows, []);
  const legacy = positionCheck(buildRuleContext([prev, cur], confs, 'legacy'), acct, '2026-07-17');
  assert.equal(legacy.rows.length, 1);
  assert.equal(legacy.rows[0].difference, '-210.00');
  assert.equal(positionCheck(buildRuleContext([prev, cur], confs, 'legacy'), acct, '2026-07-10').rows.length, 0);
});
