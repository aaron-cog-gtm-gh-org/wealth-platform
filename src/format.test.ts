import { describe, expect, it } from 'vitest';
import { dayMonth, dayMonthYear, fmt, money, pct, pill, signedMoney, signedPts, weekdayDate, yearsBetween } from './format';

const MINUS = '\u2212';

describe('number formatting', () => {
  it('fmt groups thousands in en-CA, drops the sign and rounds to the requested decimals', () => {
    expect(fmt(1234567)).toBe('1,234,567');
    expect(fmt(-1234.567, 2)).toBe('1,234.57');
    expect(fmt(0.5)).toBe('1');
    expect(fmt(12, 2)).toBe('12.00');
  });

  it('money prefixes $ and uses a typographic minus for negatives', () => {
    expect(money(2_412_380)).toBe('$2,412,380');
    expect(money(-5)).toBe(`${MINUS}$5`);
    expect(money(25, 2)).toBe('$25.00');
    expect(money(0)).toBe('$0');
  });

  it('signedMoney marks gains with + and losses with −, zero unsigned', () => {
    expect(signedMoney(1500)).toBe('+$1,500');
    expect(signedMoney(-1500.256, 2)).toBe(`${MINUS}$1,500.26`);
    expect(signedMoney(0)).toBe('$0');
  });

  it('pct signs non-zero values and defaults to two decimals', () => {
    expect(pct(1.234)).toBe('+1.23%');
    expect(pct(-0.5, 1)).toBe(`${MINUS}0.5%`);
    expect(pct(0)).toBe('0.00%');
  });

  it('signedPts always signs and keeps one decimal', () => {
    expect(signedPts(0)).toBe('+0.0');
    expect(signedPts(3.24)).toBe('+3.2');
    expect(signedPts(-2.04)).toBe(`${MINUS}2.0`);
  });
});

describe('pill', () => {
  it('returns [background, foreground] for each kind', () => {
    expect(pill('ok')).toEqual(['#e3f5ec', '#00703f']);
    expect(pill('bad')).toEqual(['#fdecec', '#b3201f']);
    for (const k of ['ok', 'warn', 'bad', 'info', 'mute'] as const) expect(pill(k)).toHaveLength(2);
  });
});

describe('date formatting', () => {
  it('dayMonth / dayMonthYear render ISO dates as DD-Mon(-YYYY)', () => {
    expect(dayMonth('2026-10-09')).toBe('09-Oct');
    expect(dayMonth('2026-01-31')).toBe('31-Jan');
    expect(dayMonthYear('2026-12-01')).toBe('01-Dec-2026');
  });

  it('weekdayDate prefixes the weekday independent of local time zone', () => {
    expect(weekdayDate('2026-11-04')).toBe('Wed 04-Nov-2026');
    expect(weekdayDate('2026-10-12')).toBe('Mon 12-Oct-2026');
  });

  it('yearsBetween counts whole years, only after the anniversary', () => {
    expect(yearsBetween('1960-10-12', '2026-10-12')).toBe(66);
    expect(yearsBetween('1960-10-13', '2026-10-12')).toBe(65);
    expect(yearsBetween('1960-11-01', '2026-10-12')).toBe(65);
    expect(yearsBetween('1960-02-29', '2026-03-01')).toBe(66);
  });
});
