// Edge cases from the quirks catalogue (docs/legacy-pv-migration.md Q1-Q6) beyond the legacy NUnit suite.
import { describe, expect, it } from 'vitest';
import { Decimal } from '../decimal';
import { MIN_DATE } from '../date';
import { fileSeq, parseConfirm, parseDecimal, parseMessage, parseStatement } from './parser';
import { SwiftField } from './message';
import { fin, MT535, MT545 } from './__fixtures__/legacy';

const s = (v: Decimal) => v.toString();

describe('parseDecimal (Q1)', () => {
  it('rejects thousands separators like legacy', () => expect(() => parseDecimal('1.250,50')).toThrow());
  it('accepts white space and signs', () => {
    expect(s(parseDecimal(' 12,5 '))).toBe('12.5');
    expect(s(parseDecimal('-3,'))).toBe('-3');
  });
  it('rejects empty', () => expect(() => parseDecimal('')).toThrow());
});

describe('parseMessage', () => {
  it('reads block 2 type and sender LT at the legacy offset', () => {
    const m = parseMessage(MT535, 'x/MT535_1_20181115_001.txt');
    expect(m.mtType).toBe(535);
    // legacy reads Substring(11, 12) although the LT starts at 14 - preserved, unused by any screen
    expect(m.senderLT).toBe('115KSTLGB2LA');
    expect(m.fileName).toBe('MT535_1_20181115_001.txt');
  });
  it('returns an empty message without block 4', () => {
    const m = parseMessage('{1:F01X}{2:O5350911181115KSTLGB2LAXXX9950}');
    expect(m.fields).toHaveLength(0);
    expect(m.fileName).toBeNull();
  });
  it('throws when block 4 is not terminated', () => expect(() => parseMessage('{4:\r\n:20C::SEME//X')).toThrow());
  it('appends continuation lines and ignores blank ones', () => {
    const m = parseMessage(fin(535, [':35B:ISIN GB0000000001', '/GB/1234567', '', 'Name Here']));
    expect(m.fields[0].raw).toBe('ISIN GB0000000001\n/GB/1234567\nName Here');
  });
  it('accepts LF-only files', () => {
    const m = parseMessage(MT545.replace(/\r\n/g, '\n'));
    expect(m.find('20C')?.content).toBe('SETT20260420211');
  });
  it('field content and qualifier', () => {
    const f = new SwiftField('20C', ':SEME//STMT1 ');
    expect(f.content).toBe('STMT1');
    expect(f.qualifier).toBe('SEME');
    const g = new SwiftField('23G', 'NEWM');
    expect(g.content).toBe('NEWM');
    expect(g.qualifier).toBeNull();
  });
  it('flattens nested blocks (Q5)', () => {
    const m = parseMessage(fin(535, [':16R:SUBSAFE', ':16R:FIN', ':35B:ISIN A', ':16S:FIN', ':16S:SUBSAFE']));
    expect(m.blocks('FIN')).toHaveLength(1);
    expect(m.blocks('SUBSAFE')[0].map(f => f.tag)).toEqual(['16R', '35B', '16S']);
  });
});

describe('parseStatement', () => {
  const st = (fields: string[], path = 'MT535_0010042_20181115_002.txt') => parseStatement(fin(535, fields), path);
  const hdr = [':16R:GENL', ':23G:NEWM/DUPL', ':98A::STAT//20181115', ':97A::SAFE//0010042', ':16S:GENL'];

  it('keeps the whole 23G text and file sequence', () => {
    const r = st([...hdr]);
    expect(r.function).toBe('NEWM/DUPL');
    expect(r.fileSeq).toBe(2);
    expect(r.lines).toHaveLength(0);
  });
  it('ACTI//N statement has no lines', () => {
    expect(st([':16R:GENL', ':98A::STAT//20181115', ':17B::ACTI//N', ':16S:GENL']).lines).toEqual([]);
  });
  it('defaults statement date to MinValue', () => expect(st([':23G:NEWM']).statementDate).toBe(MIN_DATE));
  it('throws on malformed 98A', () => expect(() => st([':98A::STAT//2018111'])).toThrow());
  it('price forms (Q2)', () => {
    const r = st([...hdr, ':16R:FIN', ':35B:ISIN A1', 'N', ':90A::MRKT//PRCT/97,425', ':16S:FIN',
      ':16R:FIN', ':35B:ISIN A2', 'N', ':90B::MRKT//ACTU/GBP4,5686', ':16S:FIN']);
    expect(r.lines.map(l => s(l.price))).toEqual(['97.425', '4.5686']);
  });
  it('quantities: AGGR only, FAMT kept as type, rounded to 4 dp half-even (Q3)', () => {
    const r = st([...hdr, ':16R:FIN', ':35B:ISIN A1', 'N', ':93B::AVAI//UNIT/5,', ':93B::AGGR//FAMT/10000,', ':16S:FIN',
      ':16R:FIN', ':35B:ISIN A2', 'N', ':93B::AGGR//UNIT/1,00005', ':16S:FIN',
      ':16R:FIN', ':35B:ISIN A3', 'N', ':93B::AGGR//UNIT/1,00015', ':16S:FIN']);
    expect(r.lines.map(l => [l.qtyType, s(l.qty)])).toEqual([['FAMT', '10000'], ['UNIT', '1'], ['UNIT', '1.0002']]);
  });
  it('19A HOLD (Q4)', () => {
    const r = st([...hdr, ':16R:FIN', ':35B:ISIN A1', 'N', ':19A::HOLD//USD10,', ':16S:FIN',
      ':16R:FIN', ':35B:ISIN A2', 'N', ':19A::HOLD//GBP5,125', ':19A::HOLD//GBP7,', ':16S:FIN']);
    expect(r.lines.map(l => [l.ccy, s(l.mktVal), s(l.mktValGbp)])).toEqual([['USD', '10', '0'], ['GBP', '5.12', '7']]);
  });
  it('35B: description is last line, blocks without ISIN dropped (Q5)', () => {
    const r = st([...hdr, ':16R:FIN', ':35B:ISIN GB00AA', '/GB/1234567', 'Long Name', ':16S:FIN',
      ':16R:FIN', ':35B:/GB/7654321', 'No Isin', ':16S:FIN']);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].msgDescription).toBe('Long Name');
  });
  it('ignores fields outside FIN', () => {
    const r = parseStatement(MT535, null);
    expect(r.fileName).toBeNull();
    expect(r.fileSeq).toBe(0);
    expect(r.lines).toHaveLength(2);
  });
});

describe('parseConfirm (Q6)', () => {
  const canc = fin(547, [':16R:GENL', ':20C::SEME//CANC1', ':23G:CANC', ':16R:LINK', ':20C::PREV//ORIG1', ':16S:LINK',
    ':16S:GENL', ':16R:FIAC', ':36B::ESTT//FAMT/1000,', ':97A::SAFE//0011521', ':16S:FIAC',
    ':16R:AMT', ':19A::SETT//USD1,', ':16S:AMT']);
  it('SEME is the first 20C, PREV separate; DEL for 546/547', () => {
    const c = parseConfirm(canc, 'archive/mt54x/20260421/MT547_11521_20260421_002.txt');
    expect([c.seme, c.prev, c.function, c.direction, c.folder]).toEqual(['CANC1', 'ORIG1', 'CANC', 'DEL', '20260421']);
    expect(s(c.qty)).toBe('1000');
    expect(c.amountRaw).toBeNull();
    expect(c.tradeDate).toBe(MIN_DATE);
  });
  it('MT544 is REC; unknown type is DEL', () => {
    expect(parseConfirm(fin(544, [':20C::SEME//X'])).direction).toBe('REC');
    expect(parseConfirm('{4:\r\n:20C::SEME//X\r\n-}').direction).toBe('DEL');
  });
  it('quantity is not rounded', () => {
    expect(s(parseConfirm(fin(545, [':36B::ESTT//UNIT/1,123456'])).qty)).toBe('1.123456');
  });
  it('folder from the parent directory; null without path', () => {
    expect(parseConfirm(MT545, 'MT545_1_20260420_001.txt').folder).toBe('');
    expect(parseConfirm(MT545).folder).toBeNull();
    expect(parseConfirm(MT545).filePath).toBeNull();
  });
});

describe('fileSeq', () => {
  it.each([
    ['MT535_0010042_20181115_003.txt', 3], ['a/b/MT535_x_20181115_10.txt', 10], ['nounderscore.txt', 0],
    ['MT535_x_20181115_abc.txt', 0], [null, 0],
  ])('%s -> %s', (p, n) => expect(fileSeq(p)).toBe(n));
});
