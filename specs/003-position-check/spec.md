# Feature Specification: Position building & reconciliation (Portfolio Viewer migration 003)

**Feature Branch**: `003-position-check`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: "Position building & reconciliation: port PositionBuilder and PositionCheck, including RECON_NOTE status enrichment formerly from ReconNoteData." RECON_NOTE notes arrive through an injected provider, and spec 004 supplies the real one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Holdings for an account and statement date (Priority: P1)

Holdings, Client Summary and the API read an account's statement dates (newest first) and its holdings for a date. Instrument names come from reference data.

**Independent Test**: for all 120 accounts × 26 dates, the dates and the holdings (30,645 lines) equal the legacy golden output.

**Acceptance Scenarios**:

1. **Given** a SAFE code, with or without leading zeros, **When** dates are requested, **Then** they are returned newest first.
2. **Given** several files for one date, **When** a statement is selected, **Then** the highest file seq wins, whatever the `23G` says (Q8).
3. **Given** an ISIN that is not in the instrument reference data, **Then** its name is `UNKNOWN INSTRUMENT <isin>` (Q13).

### User Story 2 - Position check for an account and date (Priority: P1)

Ops compares the statement with the previous statement plus net settlements, and sees every break with its RECON_NOTE status.

**Independent Test**: all 3,065 `PositionCheck.Run` results equal the golden output (7 diff rows: NEW 4, OPEN 1, RESOLVED 1, CHASED 1).

**Acceptance Scenarios**:

1. **Given** no earlier statement, **Then** the message is "No previous statement on file." and there are no rows.
2. **Given** a previous statement P, **Then** settlements are taken from P+1 day through the statement date, for `SAFE_CODE.padStart(7,'0')`. REC adds, everything else subtracts. Expected = prev qty + net. Only rows where expected differs from the statement qty are returned, with no tolerance and diff = stmt − expected. Rows are sorted ordinally by ISIN (Q11).
3. **Given** no statement on the date, **Then** every statement qty is 0.
4. **Given** a RECON_NOTE for (account, date, ISIN), matched case-insensitively on the trimmed ISIN, **Then** its status, note, updatedBy and updatedDt are copied. Otherwise the status is `NEW`. Raw status codes (`O`, `C`, …) are not mapped (Q12).
5. **Given** the 8-digit SAFE confirmations `00011397` / `00010554`, **Then** they are not counted, so they surface as the two NEW breaks on 2026-09-18 (Q18).

### User Story 3 - Check All (Priority: P2)

For one date, every account (in ACCT_NO order) that has a statement that day, with `-` when there is no previous statement and the row count otherwise.

**Independent Test**: every `checkAll` day equals the golden output.

### Edge Cases

- A settlement with a null ISIN in the window throws, matching the legacy `Dictionary` null-key exception. None exist in the archive.
- If no index is loaded, there are no dates or statements, and the check reports no previous statement.
- Duplicate ISIN lines inside one statement: the last one wins, as in the legacy dictionary assignment.

## Requirements *(mandatory)*

- **FR-001**: Port `PositionBuilder` (`getStatementDates`, `getStatement`, `getLatest`, `getPrevious`, `instrumentName`) over an explicit `ArchiveIndex` value.
- **FR-002**: Port `PositionCheck.Run` as `runPositionCheck(deps, acct, stmtDate)`. `deps` are `{ index, instruments: InstrumentNameProvider, notes: ReconNoteProvider }`.
- **FR-003**: `ReconNoteProvider.getNotes(acctId, stmtDate)` may return synchronously or as a Promise, so the PostgreSQL provider (004) plugs in unchanged. `runPositionCheck` is therefore async.
- **FR-004**: `InstrumentNameProvider.getName(isin)` is synchronous. Spec 004 loads the whole map once (legacy cached until restart, Q13).
- **FR-005**: `holdingLines` (Holdings.aspx row data) and `checkAll` (PositionCheck.aspx `btnAll_Click`) are pure helpers for later screens and APIs.
- **FR-006**: Port the legacy `PositionCheckTests.ExpectedQty_PrevPlusRecMinusDel`. The `ToAmount_*` cases were ported in 002.
- **FR-007**: Golden parity for holdings, Run and Check All, with decimals compared numerically.

## Decisions

| Topic | Decision |
| --- | --- |
| Note/status provider | Interface in `src/domain/positions/providers.ts`. `memoryNotes` and `mapInstrumentNames` are for tests. The golden test builds them from the oracle output, and 004 re-runs the parity with PostgreSQL. |
| Async | Only the note lookup is async-capable. The archive index and instrument map are in-memory, as in legacy. |
| `UpdatedDt` | Carried as the stored local timestamp string `yyyy-MM-ddTHH:mm:ss.fff` (the oracle's format), so there are no timezone conversions. |
| Check All account order | The caller passes accounts. `GetAllAccounts()` is `ORDER BY ACCT_NO`. |

## Quirk decisions

Q8, Q11, Q12, Q13 and Q18 are all preserved. **No divergences.**

## Success Criteria *(mandatory)*

- **SC-001**: 3,065/3,065 Run results, 30,645 holdings lines and 26 Check All days equal the golden output.
- **SC-002**: The complete parity suite runs in under 5 s.
- **SC-003**: Lint, typecheck, build and the existing suites pass.
