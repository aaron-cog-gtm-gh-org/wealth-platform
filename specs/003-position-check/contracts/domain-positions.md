# Contract: `src/domain/positions` (spec 003)

```ts
interface InstrumentNameProvider { getName(isin: string): string | null }
interface ReconNoteProvider { getNotes(acctId: number, stmtDate: IsoDate): ReconNote[] | Promise<ReconNote[]> }
mapInstrumentNames(pairs): InstrumentNameProvider · memoryNotes(notes): ReconNoteProvider

getStatementDates(index | null, safe): IsoDate[]                 // newest first
getStatement(index | null, safe, date): Mt535Statement | null     // highest fileSeq (Q8)
getLatest(index | null, safe) · getPrevious(index | null, safe, date)
instrumentName(names, isin): string                               // else `UNKNOWN INSTRUMENT <isin>`
holdingLines(names, statement): HoldingLine[]

interface PositionCheckDeps { index: ArchiveIndex | null; instruments: InstrumentNameProvider; notes: ReconNoteProvider }
runPositionCheck(deps, { acctId, safeCode }, stmtDate): Promise<PositionCheckResult>
checkAll(deps, accounts /* ORDER BY acctNo */, stmtDate): Promise<CheckAllRow[]>
NO_PREVIOUS_STATEMENT = 'No previous statement on file.' · DEFAULT_STATUS = 'NEW'
```

Semantics: see spec.md (Q8, Q11, Q12, Q13, Q18). Spec 004 provides the PostgreSQL `ReconNoteProvider` and `InstrumentNameProvider`, and saves notes with `SaveNote` semantics (update, else insert).
