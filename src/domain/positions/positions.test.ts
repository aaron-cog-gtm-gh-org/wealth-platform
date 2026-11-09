import { describe, expect, it } from 'vitest';
import { Decimal } from '../decimal';
import { buildArchiveIndex } from '../archive/archive-index';
import { memorySource } from '../archive/source';
import { fin } from '../swift/__fixtures__/legacy';
import { getLatest, getPrevious, getStatement, getStatementDates, holdingLines, instrumentName } from './position-builder';
import { checkAll, NO_PREVIOUS_STATEMENT, runPositionCheck } from './position-check';
import { mapInstrumentNames, memoryNotes, type ReconNote } from './providers';

const stmt = (date: string, lines: [string, string][], fn = 'NEWM') =>
  fin(535, [':16R:GENL', `:23G:${fn}`, `:98A::STAT//${date}`, ':97A::SAFE//0011521', ':16S:GENL',
    ...lines.flatMap(([isin, qty]) => [':16R:FIN', `:35B:ISIN ${isin}`, 'Desc', `:93B::AGGR//UNIT/${qty}`, ':16S:FIN'])]);
const conf = (mt: number, isin: string | null, qty: string, settle: string, acct = '0011521') =>
  fin(mt, [':16R:GENL', `:20C::SEME//S${settle}${mt}${qty}`, ':23G:NEWM', ':16S:GENL', ':98A::TRAD//20260401',
    `:98A::SETT//${settle}`, ...(isin ? [`:35B:ISIN ${isin}`] : []), `:36B::ESTT//UNIT/${qty}`, `:97A::SAFE//${acct}`]);

const idx = buildArchiveIndex(memorySource({
  'mt535/MT535_11521_20260410_001.txt': stmt('20260410', [['GB0000000002', '100,'], ['GB0000000001', '50,']]),
  'mt535/MT535_11521_20260417_001.txt': stmt('20260417', [['GB0000000001', '1,']]),
  'mt535/MT535_11521_20260417_002.txt': stmt('20260417', [['GB0000000002', '130,'], ['GB0000000001', '40,'], ['GB0000000003', '7,5']], 'RPLC'),
  'mt535/MT535_11521_20260424_001.txt': stmt('20260424', [['GB0000000002', '130,'], ['GB0000000001', '40,']]),
  'mt54x/20260413/MT545_11521_20260413_001.txt': conf(545, 'GB0000000002', '50,', '20260413'),
  'mt54x/20260414/MT547_11521_20260414_001.txt': conf(547, 'GB0000000002', '25,', '20260414'),
  'mt54x/20260410/MT545_11521_20260410_001.txt': conf(545, 'GB0000000002', '999,', '20260410'),
  'mt54x/20260415/MT547_11521_20260415_001.txt': conf(547, 'GB0000000001', '10,', '20260415'),
  'mt54x/20260415/MT545_11521_20260415_002.txt': conf(545, 'GB0000000004', '5,', '20260415', '00011521'),
}));
const names = mapInstrumentNames([['GB0000000001', 'Alpha PLC'], ['GB0000000002 ', 'Beta PLC']]);
const note: ReconNote = { acctId: 1, isin: 'gb0000000003 ', stmtDate: '2026-04-17', status: 'O', note: 'chasing',
  updatedBy: 'OPS1', updatedDt: '2026-04-20T10:00:00.000' };
const deps = { index: idx, instruments: names, notes: memoryNotes([note]) };
const acct = { acctId: 1, safeCode: '11521' };
const view = (r: Awaited<ReturnType<typeof runPositionCheck>>) =>
  r.rows.map(x => [x.isin, x.prevQty, x.netSettled, x.expected, x.stmtQty, x.diff].map(String).concat(x.status));

describe('PositionCheckTests (legacy NUnit)', () => {
  it('ExpectedQty_PrevPlusRecMinusDel', () =>
    expect(Decimal.parse('100').add(Decimal.parse('50')).sub(Decimal.parse('25')).toString()).toBe('125'));
});

describe('PositionBuilder', () => {
  it('statement dates newest first; unpadded or padded safe', () => {
    expect(getStatementDates(idx, '0011521')).toEqual(['2026-04-24', '2026-04-17', '2026-04-10']);
    expect(getStatementDates(idx, 'nope')).toEqual([]);
    expect(getStatementDates(null, '11521')).toEqual([]);
  });
  it('highest file seq wins regardless of 23G (Q8)', () => expect(getStatement(idx, '11521', '2026-04-17')?.fileSeq).toBe(2));
  it('latest and previous', () => {
    expect(getLatest(idx, '11521')?.statementDate).toBe('2026-04-24');
    expect(getPrevious(idx, '11521', '2026-04-17')?.statementDate).toBe('2026-04-10');
    expect(getPrevious(idx, '11521', '2026-04-20')?.statementDate).toBe('2026-04-17');
    expect(getPrevious(idx, '11521', '2026-04-10')).toBeNull();
    expect(getStatement(idx, '11521', '2026-04-11')).toBeNull();
  });
  it('instrument name else UNKNOWN INSTRUMENT (Q13)', () => {
    expect(instrumentName(names, 'GB0000000002')).toBe('Beta PLC');
    expect(instrumentName(names, 'XX')).toBe('UNKNOWN INSTRUMENT XX');
  });
  it('holding lines', () =>
    expect(holdingLines(names, getStatement(idx, '11521', '2026-04-17')!).map(h => [h.instrumentName, h.fileSeq, h.function]))
      .toEqual([['Beta PLC', 2, 'RPLC'], ['Alpha PLC', 2, 'RPLC'], ['UNKNOWN INSTRUMENT GB0000000003', 2, 'RPLC']]));
});

describe('runPositionCheck (Q11)', () => {
  it('no previous statement', async () => {
    const r = await runPositionCheck(deps, acct, '2026-04-10');
    expect([r.noPrevMessage, r.prevStmtDate, r.rows, r.statement?.fileName])
      .toEqual([NO_PREVIOUS_STATEMENT, null, [], 'MT535_11521_20260410_001.txt']);
  });
  it('prev + net settled vs stmt; window excludes prev date; mismatches only; ordinal ISIN; notes case-insensitive', async () => {
    const r = await runPositionCheck(deps, acct, '2026-04-17');
    expect(r.prevStmtDate).toBe('2026-04-10');
    expect(view(r)).toEqual([
      ['GB0000000002', '100', '25', '125', '130', '5', 'NEW'],
      ['GB0000000003', '0', '0', '0', '7.5', '7.5', 'O'],
    ]);
    expect(r.rows[1]).toMatchObject({ instrument: 'UNKNOWN INSTRUMENT GB0000000003', note: 'chasing', updatedBy: 'OPS1' });
  });
  it('a missing current statement makes every stmt qty 0; 8-digit SAFE never counted (Q18)', async () => {
    const r = await runPositionCheck(deps, acct, '2026-04-20');
    expect(r.statement).toBeNull();
    expect(view(r)).toEqual([
      ['GB0000000001', '40', '0', '40', '0', '-40', 'NEW'],
      ['GB0000000002', '130', '0', '130', '0', '-130', 'NEW'],
      ['GB0000000003', '7.5', '0', '7.5', '0', '-7.5', 'NEW'],
    ]);
  });
  it('net settlements, no tolerance', async () => {
    const i2 = buildArchiveIndex(memorySource({
      'mt535/a_1.txt': stmt('20260410', [['GB0000000001', '10,']]),
      'mt535/b_1.txt': stmt('20260417', [['GB0000000001', '10,0001'], ['GB0000000002', '5,']]),
      'mt54x/20260412/x.txt': conf(545, 'GB0000000002', '5,', '20260412'),
      'mt54x/20260412/y.txt': conf(546, 'GB0000000005', '2,5', '20260412'),
    }));
    const r = await runPositionCheck({ ...deps, index: i2 }, acct, '2026-04-17');
    expect(view(r)).toEqual([
      ['GB0000000001', '10', '0', '10', '10.0001', '0.0001', 'NEW'],
      ['GB0000000005', '0', '-2.5', '-2.5', '0', '2.5', 'NEW'],
    ]);
  });
  it('null ISIN on a settlement throws like the legacy Dictionary', async () => {
    const i3 = buildArchiveIndex(memorySource({
      'mt535/a_1.txt': stmt('20260410', []), 'mt535/b_1.txt': stmt('20260417', []),
      'mt54x/20260412/x.txt': conf(545, null, '5,', '20260412'),
    }));
    await expect(runPositionCheck({ ...deps, index: i3 }, acct, '2026-04-17')).rejects.toThrow(/null/);
  });
  it('async note provider', async () => {
    const r = await runPositionCheck({ ...deps, notes: { getNotes: async () => [note] } }, acct, '2026-04-17');
    expect(r.rows.find(x => x.isin === 'GB0000000003')?.status).toBe('O');
  });
});

describe('checkAll (btnAll_Click)', () => {
  it('only accounts with a statement on the date; "-" without previous', async () => {
    const accts = [{ ...acct, acctNo: 'A-1', clientName: 'C' }, { acctId: 2, safeCode: '999', acctNo: 'B', clientName: null }];
    expect(await checkAll(deps, accts, '2026-04-17')).toEqual([{ acctId: 1, acctNo: 'A-1', client: 'C', diffs: '2' }]);
    expect(await checkAll(deps, accts, '2026-04-10')).toEqual([{ acctId: 1, acctNo: 'A-1', client: 'C', diffs: '-' }]);
  });
});
