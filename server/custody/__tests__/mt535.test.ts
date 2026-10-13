import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseMt535 } from '../swift/mt535.js';
import { SwiftParseError } from '../swift/parse.js';

const fixture = (p: string) => readFileSync(new URL(`../../../fixtures/custody/archive-sample/mt535/${p}`, import.meta.url), 'utf8');

test('maps GENL: function, statement date, numeric safe', () => {
  const s = parseMt535(fixture('MT535_16558_20260626_002.txt'));
  assert.equal(s.functionCode, 'RPLC');
  assert.equal(s.statementDate, '2026-06-26');
  assert.equal(s.safeRaw, '0016558');
  assert.equal(s.safeNo, 16558);
  assert.equal(s.isEmpty, false);
  assert.equal(s.lines.length, 10);
  assert.equal(parseMt535(fixture('MT535_16558_20260626_003.txt')).functionCode, 'NEWM/DUPL');
});

test('unpadded 5-digit safe maps to the same number (D-2)', () => {
  const s = parseMt535(fixture('MT535_10226_20260828_001.txt'));
  assert.equal(s.safeRaw, '10226');
  assert.equal(s.safeNo, 10226);
});

test('ACTI//N is an empty statement', () => {
  const s = parseMt535(fixture('MT535_10024_20260417_001.txt'));
  assert.equal(s.isEmpty, true);
  assert.deepEqual(s.lines, []);
  assert.equal(s.statementDate, '2026-04-17');
});

test('SUBSAFE-wrapped FIN blocks are flattened into lines', () => {
  const s = parseMt535(fixture('MT535_10049_20260703_001.txt'));
  assert.equal(s.lines.length, 9);
  assert.deepEqual(s.lines[0], {
    lineNo: 1, isin: 'GB00ZZ000031', custodianDesc: 'Oakhanger Property PLC Ord', qty: '1850.00', qtyType: 'UNIT',
    price: '22.486', priceType: 'ACTU', ccy: 'GBP', marketValue: '41599.10', reportingValue: '41599.10', subsafe: '1',
  });
  assert.ok(s.lines.every(l => l.subsafe === '1'));
  assert.equal(s.seme, 'KS535260703003519');
});

test('35B description is kept for instruments missing from reference data (D-5)', () => {
  const s = parseMt535(fixture('MT535_10367_20260605_001.txt'));
  const l = s.lines.find(x => x.isin === 'GB00ZZ004322')!;
  assert.equal(l.custodianDesc, 'Copthorne Housing PLC Ord');
  assert.equal(l.qty, '1260.00');
  assert.equal(l.marketValue, '13887.72');
  assert.equal(l.subsafe, null);
});

test('LF-only statement maps like CRLF', () => {
  const lf = fixture('MT535_10024_20260807_001.txt');
  assert.deepEqual(parseMt535(lf), parseMt535(lf.replace(/\n/g, '\r\n')));
});

test('non-GBP line without a GBP 19A::HOLD has no reporting value (FR-010)', () => {
  const text = fixture('MT535_10367_20260605_001.txt').replace(':19A::HOLD//GBP13887,72', ':19A::HOLD//EUR16000,');
  const l = parseMt535(text).lines.find(x => x.isin === 'GB00ZZ004322')!;
  assert.equal(l.ccy, 'EUR');
  assert.equal(l.marketValue, '16000.00');
  assert.equal(l.reportingValue, null);
});

test('rejects wrong message type and thousands separators', () => {
  assert.throws(() => parseMt535(fixture('MT535_10367_20260605_001.txt').replace('{2:O535', '{2:O545')), SwiftParseError);
  assert.throws(() => parseMt535(fixture('MT535_10367_20260605_001.txt').replace('GBP13887,72', 'GBP13.887,72')), SwiftParseError);
});
