// Spec 002 parity: the TS archive index + SettlementReader on the in-repo archive copy vs the legacy oracle output.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Decimal } from '../../src/domain/decimal';
import { MIN_DATE } from '../../src/domain/date';
import { buildArchiveIndex, type ArchiveIndex } from '../../src/domain/archive/archive-index';
import { getSettlements, toAmount } from '../../src/domain/archive/settlements';
import type { SettlementConfirm } from '../../src/domain/swift/models';
import { DEFAULT_ARCHIVE_ROOT, fsArchiveSource } from './archive-fs';
import { loadGolden, MANIFEST_PATH, type Golden } from './legacy-golden';

const num = (v: Decimal | string | null) => (v === null ? null : Decimal.parse(String(v)).toString());
const confirmView = (c: SettlementConfirm) => ({
  folder: c.folder, fileName: c.filePath?.split('/').pop(), mtType: c.mtType, seme: c.seme, prev: c.prev,
  function: c.function, tradeDate: c.tradeDate, settleDate: c.settleDate, isin: c.isin, qty: num(c.qty),
  custAcct: c.custAcct, amountRaw: c.amountRaw, ccy: c.ccy, direction: c.direction,
});
const CONFIRM_KEYS = ['folder', 'fileName', 'mtType', 'seme', 'prev', 'function', 'tradeDate', 'settleDate', 'isin', 'qty',
  'custAcct', 'amountRaw', 'ccy', 'direction'];
const goldenConfirm = (g: Golden) => ({ ...pick(g, CONFIRM_KEYS), qty: num(g.qty) });
function pick(o: Golden, keys: string[]) { return Object.fromEntries(keys.map(k => [k, o[k]])); }

let golden: Golden;
let idx: ArchiveIndex;
beforeAll(() => {
  golden = loadGolden();
  idx = buildArchiveIndex(fsArchiveSource(DEFAULT_ARCHIVE_ROOT), { clock: () => new Date() });
});

describe('archive copy', () => {
  it('matches the legacy archive manifest byte-for-byte', () => {
    const lines = readFileSync(MANIFEST_PATH, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(6044);
    const bad = lines.map(l => l.split(/\s+\*?/)).filter(([sha, path]) =>
      createHash('sha256').update(readFileSync(join(DEFAULT_ARCHIVE_ROOT, '..', path))).digest('hex') !== sha);
    expect(bad).toEqual([]);
    expect(idx.files.map(f => `archive/${f.path}`).sort()).toEqual(lines.map(l => l.split(/\s+\*?/)[1]).sort());
  });
});

describe('ArchiveIndex vs legacy golden', () => {
  it('counts', () => {
    const g = golden.archiveIndex;
    expect([idx.mt535Count, idx.mt54xCount, idx.parseErrors, idx.statements.size, idx.confirmFolders.size])
      .toEqual([g.mt535Count, g.mt54xCount, g.parseErrors, g.statementAccountCount, g.confirmFolderCount]);
    expect(idx.loadMs).toBeGreaterThanOrEqual(0);
  });
  it('flat file list', () => {
    expect(idx.files.map(f => ({ ...f, date: f.date }))).toEqual(golden.archiveIndex.files);
  });
  it('statement keys, dates and statements', () => {
    for (const k of golden.archiveIndex.statementKeys) {
      const byDate = idx.statements.get(k.key)!;
      expect([...byDate.keys()].sort(), k.key).toEqual(k.dates.map((d: Golden) => d.date).sort());
      for (const d of k.dates) {
        const ours = byDate.get(d.date)!.map(s => ({ fileName: s.fileName, fileSeq: s.fileSeq, function: s.function,
          safekeepingAcct: s.safekeepingAcct, lineCount: s.lines.length }));
        const theirs = d.statements.map((s: Golden) => pick(s, ['fileName', 'fileSeq', 'function', 'safekeepingAcct', 'lineCount']));
        expect(ours.sort((a, b) => a.fileName!.localeCompare(b.fileName!))).toEqual(
          theirs.sort((a: Golden, b: Golden) => a.fileName.localeCompare(b.fileName)));
      }
    }
  });
  it('confirmation folders', () => {
    for (const f of golden.archiveIndex.confirmFolders) {
      expect(idx.confirmFolders.get(f.folder)!.map(confirmView), f.folder).toEqual(f.confirms.map(goldenConfirm));
    }
  });
});

describe('SettlementReader vs legacy golden', () => {
  const check = (custAcct: string, from: string, to: string, items: Golden[]) => {
    const ours = getSettlements(idx, custAcct, from, to);
    expect(ours.map(confirmView)).toEqual(items.map(goldenConfirm));
    expect(ours.map(c => (c.amountRaw === null ? '0' : toAmount(c.amountRaw).toString())))
      .toEqual(items.map(i => num(i.amount)));
  };
  it('Settlements.aspx 90-day default and full range for every account', () => {
    let n = 0;
    for (const a of golden.accounts) {
      const d = a.settlementsDefault90d;
      check(d.custAcct, d.from, d.to, d.items);
      const f = a.settlementsFullRange;
      check(f.custAcct, f.from ?? MIN_DATE, f.to, f.items);
      n += d.items.length + f.items.length;
    }
    expect(n).toBe(golden.summary.settlementsDefault90dItems + golden.summary.settlementsFullRangeItems);
  });
});

// legacy PV.Tests/ArchiveFileTests.cs: both cases are [Ignore]d in legacy and their file
// (MT535_0010042_20181115_001.txt) is not in the archive since the refresh; kept skipped with the legacy reasons.
describe('ArchiveFileTests (legacy, ignored)', () => {
  it.skip('ParseStatement_FromArchiveFile - fails since archive refresh', () => {});
  it.skip('StatementCount_MatchesSnapshot - archive path changed - RJM', () => {});
  it('the captured file is indeed absent from the archive copy', () =>
    expect(idx.files.some(f => f.fileName === 'MT535_0010042_20181115_001.txt')).toBe(false));
});
