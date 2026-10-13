import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SwiftParseError, findField, parseSafeNo, parseSwift, parseSwiftAmount, parseSwiftDate, parseSwiftDecimal, sequences } from '../swift/parse.js';

const fixture = (p: string) => readFileSync(new URL(`../../../fixtures/custody/archive-sample/${p}`, import.meta.url), 'utf8');

test('decimals are fixed-point strings with at least two places', () => {
  assert.equal(parseSwiftDecimal('21637,5'), '21637.50');
  assert.equal(parseSwiftDecimal('1250,'), '1250.00');
  assert.equal(parseSwiftDecimal('0,5'), '0.50');
  assert.equal(parseSwiftDecimal('4,5686'), '4.5686');
  assert.equal(parseSwiftDecimal('0016,25'), '16.25');
  assert.equal(parseSwiftDecimal('N12,3'), '-12.30');
});

test('thousands separators and dot decimals are rejected (D-7)', () => {
  for (const bad of ['1.250,50', '1250.50', '1,250,50', '1250', '', 'abc', '12,5x']) {
    assert.throws(() => parseSwiftDecimal(bad), SwiftParseError, bad);
  }
});

test('amounts, dates and safekeeping numbers', () => {
  assert.deepEqual(parseSwiftAmount('GBP21637,5'), { ccy: 'GBP', amount: '21637.50' });
  assert.equal(parseSwiftDate('20260717'), '2026-07-17');
  assert.throws(() => parseSwiftDate('20260231'), SwiftParseError);
  assert.equal(parseSafeNo('0016056'), 16056);
  assert.equal(parseSafeNo('00011397'), 11397);
  assert.equal(parseSafeNo('16056'), 16056);
  assert.throws(() => parseSafeNo('16 056'), SwiftParseError);
});

test('tokenizes headers, qualified fields and continuation lines (CRLF)', () => {
  const text = fixture('mt54x/20260715/MT545_16056_20260715_002.txt');
  assert.ok(text.includes('\r\n'));
  const msg = parseSwift(text);
  assert.equal(msg.mtType, 545);
  assert.equal(msg.senderBic, 'KSTLGB2LXXX');
  assert.equal(msg.userHeader['108'], '2435667773763388');
  const prev = findField(msg.fields, '20C', 'PREV')!;
  assert.equal(prev.value, 'KS5400060882');
  assert.deepEqual(prev.path, ['GENL', 'LINK']);
  const b35 = findField(msg.fields, '35B')!;
  assert.deepEqual(b35.lines, ['ISIN GB00ZZ001500', 'Ashby Networks PLC Ord']);
  assert.equal(findField(msg.fields, '23G')!.value, 'CANC');
});

test('LF-only files tokenize identically to CRLF', () => {
  const lf = fixture('mt535/MT535_10024_20260807_001.txt');
  assert.ok(!lf.includes('\r'));
  const a = parseSwift(lf);
  const b = parseSwift(lf.replace(/\n/g, '\r\n'));
  assert.deepEqual(a, b);
  assert.equal(a.mtType, 535);
  assert.equal(findField(a.fields, '17B', 'ACTI')!.value, 'N');
});

test('repeated FIN sequences are split, SUBSAFE nesting is kept', () => {
  const msg = parseSwift(fixture('mt535/MT535_10049_20260703_001.txt'));
  const fins = sequences(msg.fields, 'FIN');
  assert.ok(fins.length > 1);
  for (const fin of fins) {
    assert.equal(fin.filter(f => f.tag === '35B').length, 1);
    assert.deepEqual(fin[0].path, ['SUBSAFE', 'FIN']);
  }
});

test('malformed messages raise SwiftParseError', () => {
  assert.throws(() => parseSwift('{1:F01X}{2:O5351200}'), SwiftParseError);
  assert.throws(() => parseSwift('{4:\r\n:16R:GENL\r\n:20C::SEME//X\r\n-}'), SwiftParseError);
  assert.throws(() => parseSwift('{4:\r\n:16R:GENL\r\n:16S:FIN\r\n-}'), SwiftParseError);
});
