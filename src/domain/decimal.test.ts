import { describe, expect, it } from 'vitest';
import { Decimal } from './decimal';
import { addDays, formatDate, isIsoDate, parseYmd, tryParseYmd } from './date';
import { fmtMoney, fmtPx, fmtQty, fmtUkDate, parseUkDate, statusText } from './format';

const d = Decimal.parse;

describe('Decimal', () => {
  it('is exact where floats drift', () => expect(d('0.1').add(d('0.2')).toString()).toBe('0.3'));
  it('canonical string strips trailing zeros', () => {
    expect(d('1250.00').toString()).toBe('1250');
    expect(d('-0.50').toString()).toBe('-0.5');
    expect(d('.5').toString()).toBe('0.5');
    expect(JSON.stringify({ q: d('941.8671') })).toBe('{"q":"941.8671"}');
  });
  it('compares by value', () => {
    expect(d('1.10').equals(d('1.1'))).toBe(true);
    expect(d('2').compare(d('10'))).toBe(-1);
    expect(d('-1').sub(d('-1')).isZero()).toBe(true);
  });
  it('Math.Round is half-to-even by default', () => {
    expect(d('2.345').round(2).toString()).toBe('2.34');
    expect(d('2.355').round(2).toString()).toBe('2.36');
    expect(d('-2.345').round(2).toString()).toBe('-2.34');
    expect(d('2.345').round(2, 'awayFromZero').toString()).toBe('2.35');
    expect(d('2.3').round(4).toString()).toBe('2.3');
  });
  it('parse follows NumberStyles.Number', () => {
    expect(d('1,250.5').toString()).toBe('1250.5');
    expect(d('5-').toString()).toBe('-5');
    expect(() => d('1e5')).toThrow();
    expect(() => d('-5-')).toThrow();
    expect(() => d('.')).toThrow();
    expect(Decimal.tryParse('x')).toBeNull();
  });
  it('shift divides by powers of ten', () => expect(Decimal.fromInt(1).shift(2).toString()).toBe('0.01'));
});

describe('dates', () => {
  it('parseYmd is strict', () => {
    expect(parseYmd(' 20240229 ')).toBe('2024-02-29');
    expect(() => parseYmd('20230229')).toThrow();
    expect(tryParseYmd('2024-02-01')).toBeNull();
  });
  it('formatDate upper-case (Q14)', () => expect(formatDate('2026-01-05')).toBe('05-JAN-2026'));
  it('addDays crosses months and years', () => expect(addDays('2025-12-31', 1)).toBe('2026-01-01'));
  it('isIsoDate', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
  });
});

describe('WebUtil formats (Q14)', () => {
  it('fmtQty #,##0.####', () => {
    expect(fmtQty(d('1234567.89'))).toBe('1,234,567.89');
    expect(fmtQty(d('1660.0000'))).toBe('1,660');
    expect(fmtQty(d('0.00005'))).toBe('0.0001');
    expect(fmtQty(d('-941.8671'))).toBe('-941.8671');
    expect(fmtQty(d('-0.00001'))).toBe('0');
  });
  it('fmtPx #,##0.0000', () => expect(fmtPx(d('34.553'))).toBe('34.5530'));
  it('fmtMoney #,##0.00 rounds half away from zero', () => {
    expect(fmtMoney(d('2.345'))).toBe('2.35');
    expect(fmtMoney(d('1000000'))).toBe('1,000,000.00');
    expect(fmtMoney(d('-0.5'))).toBe('-0.50');
  });
  it('dd/MM/yyyy', () => {
    expect(fmtUkDate('2026-04-20')).toBe('20/04/2026');
    expect(fmtUkDate(null)).toBe('');
    expect(parseUkDate(' 20/04/2026 ')).toBe('2026-04-20');
    expect(parseUkDate('2/4/2026')).toBeNull();
    expect(parseUkDate('31/02/2026')).toBeNull();
  });
  it('statusText', () => expect([statusText('A'), statusText('D'), statusText('C'), statusText('X')]).toEqual(
    ['Active', 'Dormant', 'Closed', 'X']));
});
