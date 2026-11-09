import assert from 'node:assert/strict';
import test from 'node:test';
import { statementFixture } from '../swift/test-fixtures';
import type { Statement } from '../swift/types';
import { holdings, latestStatement, previousStatement, statementDates, statementFor, statementsByDate, type StatementFile } from './holdings';
import { instrumentName } from './instruments';

const resends = ['MT535_16558_20260626_001.txt', 'MT535_16558_20260626_003.txt', 'MT535_16558_20260626_002.txt'].map(statementFixture);

function stmt(date: string, safe: string | null, lines: Partial<Statement['lines'][number]>[] = []): Statement {
  return {
    function: 'NEWM',
    statementDate: date,
    safekeepingAcct: safe,
    lines: lines.map((l) => ({ isin: 'X', description: '', qty: 0, qtyType: 'UNIT', price: 0, ccy: 'GBP', mktVal: 0, mktValGbp: 0, ...l })),
  };
}

test('highest file sequence wins per date, even NEWM/DUPL over RPLC', () => {
  const st = statementFor(resends, '16558', '2026-06-26')!;
  assert.equal(st.function, 'NEWM/DUPL');
  assert.equal(st.lines.length, 9);
  assert.equal(statementsByDate(resends, '16558').get('2026-06-26')?.fileSeq, 3);

  const rplc = ['MT535_10925_20260515_002.txt', 'MT535_10925_20260515_001.txt'].map(statementFixture);
  assert.equal(statementFor(rplc, '10925', '2026-05-15')?.function, 'RPLC');
});

test('equal file sequences keep the first in input order', () => {
  const a = { fileSeq: 1, statement: stmt('2026-01-02', '1') };
  const b = { fileSeq: 1, statement: stmt('2026-01-02', '1') };
  assert.equal(statementFor([a, b], '1', '2026-01-02'), a.statement);
});

test('statement dates newest first; latest and strictly-earlier previous', () => {
  const files: StatementFile[] = ['2026-01-09', '2026-01-02', '2026-01-16', '2026-01-09'].map((d, i) => ({ fileSeq: i, statement: stmt(d, '0000042') }));
  files.push({ fileSeq: 1, statement: stmt('2026-01-23', '43') });
  assert.deepEqual(statementDates(files, '42'), ['2026-01-16', '2026-01-09', '2026-01-02']);
  assert.equal(latestStatement(files, '42')?.statementDate, '2026-01-16');
  assert.equal(previousStatement(files, '42', '2026-01-16')?.statementDate, '2026-01-09');
  assert.equal(previousStatement(files, '42', '2026-01-10')?.statementDate, '2026-01-09');
  assert.equal(previousStatement(files, '42', '2026-01-09')?.statementDate, '2026-01-02');
  assert.equal(previousStatement(files, '42', '2026-01-02'), null);
  assert.equal(statementFor(files, '42', '2026-01-03'), null);
  assert.equal(latestStatement(files, '99'), null);
  assert.deepEqual(statementDates([], '42'), []);
});

test('accounts match on 97A::SAFE ignoring leading zeros', () => {
  const unpadded = [statementFixture('MT535_12228_20260807_001.txt')];
  assert.deepEqual(statementDates(unpadded, '12228'), ['2026-08-07']);
  assert.deepEqual(statementDates(unpadded, '0012228'), ['2026-08-07']);
  assert.deepEqual(statementDates(resends, '0016558'), ['2026-06-26']);
  assert.deepEqual(statementDates([{ fileSeq: 1, statement: stmt('2026-01-02', null) }], ''), ['2026-01-02']);
});

test('holdings rows use reference names with UNKNOWN INSTRUMENT fallback and exact GBP total', () => {
  const st = statementFixture('MT535_10314_20260417_001.txt').statement;
  const names = new Map([['FR00ZZ000406', 'Tavistock Shipping SA (ref)']]);
  const h = holdings(st, names);
  assert.equal(h.rows.length, 10);
  assert.equal(h.rows[0].instrument, 'Tavistock Shipping SA (ref)');
  assert.equal(h.rows[1].instrument, `UNKNOWN INSTRUMENT ${st.lines[1].isin}`);
  assert.deepEqual([h.rows[0].mktVal, h.rows[0].mktValGbp, h.rows[0].ccy], [25197.88, 21433.64, 'EUR']);
  const cents = st.lines.reduce((t, l) => t + Math.round(l.mktValGbp * 100), 0);
  assert.equal(h.totalGbp, cents / 100);
  assert.equal(h.statementDate, '2026-04-17');
});

test('GBP total has no floating-point drift and is 0 with no lines', () => {
  const h = holdings(stmt('2026-01-02', '1', [{ isin: 'A', mktValGbp: 0.1 }, { isin: 'B', mktValGbp: 0.2 }]));
  assert.equal(h.totalGbp, 0.3);
  const empty = holdings(statementFixture('MT535_10024_20260508_001.txt').statement);
  assert.deepEqual([empty.rows.length, empty.totalGbp], [0, 0]);
  assert.equal(instrumentName('GB00ZZ999999', undefined), 'UNKNOWN INSTRUMENT GB00ZZ999999');
});
