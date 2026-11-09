import { describe, expect, it } from 'vitest';
import { Decimal } from '../decimal';
import { buildArchiveIndex, findArchiveFile, makeEntry, statementKey } from './archive-index';
import { getSettlements, toAmount } from './settlements';
import { memorySource } from './source';
import { fin } from '../swift/__fixtures__/legacy';

const stmt = (safe: string, date: string) =>
  fin(535, [':16R:GENL', ':23G:NEWM', `:98A::STAT//${date}`, `:97A::SAFE//${safe}`, ':16S:GENL',
    ':16R:FIN', ':35B:ISIN GB0000000001', 'Name', ':93B::AGGR//UNIT/10,', ':16S:FIN']);
const conf = (mt: number, seme: string, acct: string, settle: string, extra: string[] = []) =>
  fin(mt, [':16R:GENL', `:20C::SEME//${seme}`, ...extra, ':16S:GENL', ':98A::TRAD//20260401', `:98A::SETT//${settle}`,
    ':35B:ISIN GB0000000001', 'Name', ':36B::ESTT//UNIT/5,', `:97A::SAFE//${acct}`, ':19A::ESTT//GBP10,5']);
const cancel = (seme: string, prev: string | null, acct: string, settle: string) =>
  conf(547, seme, acct, settle, [':23G:CANC', ...(prev ? [`:20C::PREV//${prev}`] : [])]);

describe('PositionCheckTests (legacy NUnit, ToAmount cases)', () => {
  it('ToAmount_PoundsAndPence', () => expect(toAmount('GBP4303,01').equals(Decimal.parse('4303.01'))).toBe(true));
  it('ToAmount_NoDecimals', () => expect(toAmount('USD192,').equals(Decimal.parse('192'))).toBe(true));
});

describe('toAmount (Q10)', () => {
  it.each([['GBP11524,8', '11524.08'], ['GBP5', '5'], ['GBP1,123', '2.23'], ['EUR1,2,3', '1.02']])('%s -> %s', (raw, v) =>
    expect(toAmount(raw).toString()).toBe(v));
  it('throws like legacy', () => {
    expect(() => toAmount('GB')).toThrow();
    expect(() => toAmount('GBP,5')).toThrow();
    expect(() => toAmount('GBP1.5')).toThrow();
  });
});

describe('buildArchiveIndex (Q7)', () => {
  const src = memorySource({
    'mt535/MT535_0010042_20260417_001.txt': stmt('0010042', '20260417'),
    'mt535/MT535_0010042_20260417_002.txt': stmt('0010042', '20260417'),
    'mt535/MT535_0010042_20260424_001.txt': stmt('0010042', '20260424'),
    'mt535/MT535_bad_xx_001.txt': '{4:\r\n:20C::SEME//X',
    'mt535/readme.md': 'ignored',
    'mt54x/20260421/MT545_11521_20260421_002.txt': conf(545, 'B', '0011521', '20260421'),
    'mt54x/20260421/MT545_11521_20260421_001.txt': conf(545, 'A', '0011521', '20260421'),
    'mt54x/20260420/MT547_11521_20260420_001.txt': conf(547, 'C', '0011521', '20260420'),
  });
  const idx = buildArchiveIndex(src);

  it('counts files and parse errors', () => {
    expect([idx.mt535Count, idx.mt54xCount, idx.parseErrors]).toEqual([4, 3, 1]);
    expect(idx.parseErrorLog[0].fileName).toBe('MT535_bad_xx_001.txt');
    expect(idx.loadedAt).toBeNull();
  });
  it('keys statements on the unpadded safe and date', () => {
    expect([...idx.statements.keys()]).toEqual(['10042']);
    const day = idx.statements.get('10042')!.get('2026-04-17')!;
    expect(day.map(s => s.fileSeq)).toEqual([1, 2]);
  });
  it('confirm folders in ordinal order with name-sorted confirms', () => {
    expect([...idx.confirmFolders.keys()]).toEqual(['20260420', '20260421']);
    expect(idx.confirmFolders.get('20260421')!.map(c => c.seme)).toEqual(['A', 'B']);
  });
  it('flat file list sorted by path; MinValue date for odd names', () => {
    expect(idx.files.map(f => f.path)[0]).toBe('mt535/MT535_0010042_20260417_001.txt');
    expect(idx.files.find(f => f.fileName === 'MT535_bad_xx_001.txt')).toMatchObject({ safeCode: 'bad', date: '0001-01-01' });
    expect(makeEntry('mt535/odd.txt', 1, 'MT535')).toMatchObject({ safeCode: null, date: '0001-01-01' });
    expect(findArchiveFile(idx, 'mt54x/20260420/MT547_11521_20260420_001.txt')?.msgType).toBe('MT54x');
    expect(findArchiveFile(idx, '../package.json')).toBeNull();
  });
  it('uses the injected clock', () => {
    let t = 0;
    const timed = buildArchiveIndex(memorySource({}), { clock: () => new Date(Date.UTC(2026, 0, 1) + (t += 5)) });
    expect(timed.loadMs).toBe(5);
    expect(timed.loadedAt).toBe('2026-01-01T00:00:00.010Z');
    expect(timed.confirmFolders.size).toBe(0);
  });
  it('statementKey', () => expect(statementKey('0011521')).toBe('11521'));
});

describe('getSettlements (Q9)', () => {
  const idx = buildArchiveIndex(memorySource({
    'mt54x/20260420/MT545_1_20260420_001.txt': conf(545, 'S1', '0011521', '20260420'),
    'mt54x/20260420/MT547_1_20260420_002.txt': conf(547, 'S2', '0011521', '20260420'),
    'mt54x/20260420/MT547_1_20260420_003.txt': cancel('S3', 'S2', '0011521', '20260420'),
    'mt54x/20260421/MT547_1_20260421_001.txt': cancel('S4', 'S1', '0011521', '20260421'),
    'mt54x/20260421/MT545_1_20260421_002.txt': conf(545, 'S5', '0011521', '20260422'),
    'mt54x/20260421/MT545_1_20260421_003.txt': conf(545, 'S6', '00011521', '20260421'),
    'mt54x/20260419/MT545_1_20260419_001.txt': conf(545, 'S7', '0011521', '20260420'),
  }));
  const semes = (from = '0001-01-01', to = '9999-12-31', acct = '0011521') =>
    getSettlements(idx, acct, from, to).map(c => c.seme);

  it('cancels only within the same folder; exact account match; newest first, ties by folder', () =>
    expect(semes()).toEqual(['S5', 'S7', 'S1']));
  it('inclusive date range', () => expect(semes('2026-04-20', '2026-04-20')).toEqual(['S7', 'S1']));
  it('8-digit SAFE never matches the 7-padded account (Q18)', () => expect(semes(undefined, undefined, '00011521')).toEqual(['S6']));
  it('no index -> empty', () => expect(getSettlements(null, 'x', '0001-01-01', '9999-12-31')).toEqual([]));
  it('CANC without PREV removes confirmations without SEME (null == null)', () => {
    const i2 = buildArchiveIndex(memorySource({
      'mt54x/d/MT545_1.txt': fin(545, [':97A::SAFE//1', ':98A::SETT//20260420']),
      'mt54x/d/MT547_2.txt': cancel('C', null, '2', '20260420'),
    }));
    expect(getSettlements(i2, '1', '0001-01-01', '9999-12-31')).toEqual([]);
  });
});
