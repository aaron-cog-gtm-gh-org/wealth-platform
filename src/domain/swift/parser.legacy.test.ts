// Port of legacy PV.Tests/SwiftParserTests.cs (NUnit) - one `it` per [Test], same assertions.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../decimal';
import { formatDate } from '../date';
import { trimChars } from '../dotnet';
import { parseConfirm, parseDecimal, parseStatement } from './parser';
import { MT535, MT545 } from './__fixtures__/legacy';

const d = (s: string) => Decimal.parse(s);
const eq = (actual: Decimal, expected: string) => expect(actual.equals(d(expected)), `${actual} == ${expected}`).toBe(true);

describe('SwiftParserTests', () => {
  it('ParseDecimal_CommaDecimal', () => eq(parseDecimal('12345,67'), '12345.67'));
  it('ParseDecimal_TrailingComma', () => eq(parseDecimal('1250,'), '1250'));
  it('ParseDecimal_FractionOnly', () => eq(parseDecimal('0,5'), '0.5'));
  it('FormatDate_UsesStatementFormat', () => expect(formatDate('2018-11-15')).toBe('15-NOV-2018'));

  it('ParseStatement_ReadsHeaderAndLines', () => {
    const st = parseStatement(MT535, 'MT535_0010042_20181115_001.txt');
    expect(st.function).toBe('NEWM');
    expect(st.statementDate).toBe('2018-11-15');
    expect(st.safekeepingAcct).toBe('0010042');
    expect(st.lines).toHaveLength(2);
    expect(st.lines[0].isin).toBe('GB00ZZ000486');
    expect(st.lines[0].msgDescription).toBe('Draycott Systems PLC Ord');
    eq(st.lines[0].price, '34.553');
    eq(st.lines[0].qty, '1660');
    eq(st.lines[0].mktValGbp, '57357.98');
    // non-GBP line carries both values
    expect(st.lines[1].ccy).toBe('EUR');
    eq(st.lines[1].mktVal, '25197.88');
    eq(st.lines[1].mktValGbp, '21433.64');
  });

  it('ParseConfirm_ReadsSettlement', () => {
    const c = parseConfirm(MT545, 'mt54x\\20260420\\MT545_11521_20260420_001.txt');
    expect(c.mtType).toBe(545);
    expect(c.seme).toBe('SETT20260420211');
    expect(c.function).toBe('NEWM');
    expect(c.tradeDate).toBe('2026-04-15');
    expect(c.settleDate).toBe('2026-04-20');
    expect(c.isin).toBe('LU00ZZ012622');
    eq(c.qty, '941.8671');
    expect(c.custAcct).toBe('0011521');
    expect(c.amountRaw).toBe('GBP4303,01');
    expect(c.direction).toBe('REC');
  });

  it('StatementKey_UsesUnpaddedSafe', () => {
    // statements are keyed on the custodian acct with leading zeros off
    expect(trimChars('0011521', '0', 'start')).toBe('11521');
  });
});
