// Spec 003 parity: PositionBuilder + PositionCheck.Run + Check All over the archive copy vs the legacy oracle.
// Reference data comes from the golden output itself (instrument names on holdings, notes on non-NEW rows);
// spec 004 repeats the check with the PostgreSQL providers.
import { beforeAll, describe, expect, it } from 'vitest';
import { Decimal } from '../../src/domain/decimal';
import { buildArchiveIndex, type ArchiveIndex } from '../../src/domain/archive/archive-index';
import { getStatement, getStatementDates, holdingLines } from '../../src/domain/positions/position-builder';
import { checkAll, runPositionCheck, type PositionCheckDeps } from '../../src/domain/positions/position-check';
import { mapInstrumentNames, memoryNotes, type ReconNote } from '../../src/domain/positions/providers';
import { fsArchiveSource } from './archive-fs';
import { loadGolden, type Golden } from './legacy-golden';

const num = (v: unknown) => (v === null || v === undefined ? v : Decimal.parse(String(v)).toString());
const DEC = new Set(['qty', 'price', 'mktVal', 'mktValGbp', 'prevQty', 'netSettled', 'expected', 'stmtQty', 'diff']);
const norm = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, DEC.has(k) ? num(v) : v]));

let golden: Golden;
let idx: ArchiveIndex;
let deps: PositionCheckDeps;
beforeAll(() => {
  golden = loadGolden();
  idx = buildArchiveIndex(fsArchiveSource());
  const names: [string, string][] = [];
  const notes: ReconNote[] = [];
  for (const a of golden.accounts) {
    for (const pc of a.positionChecks) {
      for (const l of pc.statement?.lines ?? []) if (!l.instrumentName.startsWith('UNKNOWN INSTRUMENT ')) names.push([l.isin, l.instrumentName]);
      for (const r of pc.rows) {
        if (r.status !== 'NEW' || r.note !== null)
          notes.push({ acctId: a.acctId, isin: r.isin, stmtDate: pc.stmtDate, status: r.status, note: r.note, updatedBy: r.updatedBy, updatedDt: r.updatedDt });
      }
    }
  }
  deps = { index: idx, instruments: mapInstrumentNames(names), notes: memoryNotes(notes) };
});

describe('PositionBuilder vs legacy golden', () => {
  it('statement dates (newest first) and selected statement per key/date', () => {
    for (const a of golden.accounts) expect(getStatementDates(idx, a.safeCode), a.acctNo).toEqual(a.statementDates);
    for (const k of golden.archiveIndex.statementKeys)
      for (const d of k.dates) expect(getStatement(idx, k.key, d.date)?.fileName).toBe(d.selectedFile);
  });
  it('holdings for every account x statement date', () => {
    let n = 0;
    for (const a of golden.accounts) {
      for (const pc of a.positionChecks) {
        const st = getStatement(idx, a.safeCode, pc.stmtDate)!;
        const { lines, ...head } = pc.statement;
        expect({ fileName: st.fileName, fileSeq: st.fileSeq, function: st.function, statementDate: st.statementDate,
          safekeepingAcct: st.safekeepingAcct }).toEqual(head);
        expect(holdingLines(deps.instruments, st).map(h => norm({ ...h }))).toEqual(lines.map(norm));
        n += lines.length;
      }
    }
    expect(n).toBe(golden.summary.holdingLines);
  });
});

describe('PositionCheck.Run vs legacy golden', () => {
  it('every account x statement date (3,065 runs)', async () => {
    let runs = 0;
    let diffRows = 0;
    for (const a of golden.accounts) {
      for (const pc of a.positionChecks) {
        const r = await runPositionCheck(deps, { acctId: a.acctId, safeCode: a.safeCode }, pc.stmtDate);
        expect({ prevStmtDate: r.prevStmtDate, noPrevMessage: r.noPrevMessage, statementFile: r.statement?.fileName ?? null,
          rows: r.rows.map(x => norm({ ...x })) }, `${a.acctNo} ${pc.stmtDate}`)
          .toEqual({ prevStmtDate: pc.prevStmtDate, noPrevMessage: pc.noPrevMessage, statementFile: pc.statementFile, rows: pc.rows.map(norm) });
        runs++;
        diffRows += r.rows.length;
      }
    }
    expect([runs, diffRows]).toEqual([golden.summary.accountStatementDatesChecked, golden.summary.totalDiffRows]);
  });
  it('Q18: the two 8-digit SAFE confirmations surface as NEW breaks on 2026-09-18', () => {
    const all = golden.accounts.flatMap((a: Golden) => a.positionChecks.filter((pc: Golden) => pc.stmtDate === '2026-09-18')
      .flatMap((pc: Golden) => pc.rows));
    expect(all.map((r: Golden) => r.status)).toEqual(['NEW', 'NEW']);
    const eight = [...idx.confirmFolders.values()].flat().filter(c => c.custAcct?.length === 8).map(c => c.custAcct).sort();
    expect(eight).toEqual(['00010554', '00011397']);
  });
});

describe('Check All vs legacy golden', () => {
  it('every statement date', async () => {
    // GetAllAccounts() is ORDER BY ACCT_NO, the order of golden accounts[]
    const accounts = golden.accounts.map((a: Golden) => ({ acctId: a.acctId, safeCode: a.safeCode, acctNo: a.acctNo, clientName: a.clientName }));
    for (const day of golden.checkAll) expect(await checkAll(deps, accounts, day.stmtDate), day.stmtDate).toEqual(day.rows);
  });
});
