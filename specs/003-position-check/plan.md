# Implementation Plan: Position building & reconciliation

**Branch**: `003-position-check` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

## Summary
This feature ports PositionBuilder and PositionCheck as pure functions over the spec 002 `ArchiveIndex`. Instrument names and RECON_NOTE come from injected providers, and parity is proven against the legacy golden output.

## Technical Context
**Language**: TypeScript 5.6 · **Deps**: none new · **Testing**: Vitest · **Performance**: 3,065 checks in about 1 s

## Constitution Check
| Principle | Status |
| --- | --- |
| I Parity | PASS: golden parity; Q8/Q11/Q12/Q13/Q18 preserved |
| II Pure core | PASS: providers injected; no DB/fs in `src/domain/positions` |
| III Legacy fixtures | PASS: `ExpectedQty_PrevPlusRecMinusDel` ported |
| V No regression | PASS: no screen, workspace or QA change |
| VII Traceability | PASS: `legacy:` comments |

## Project Structure
```text
src/domain/positions/
├── providers.ts         # InstrumentNameProvider, ReconNote(Provider), AccountRef, mapInstrumentNames, memoryNotes
├── position-builder.ts  # getStatementDates/getStatement/getLatest/getPrevious/instrumentName/holdingLines
├── position-check.ts    # runPositionCheck, checkAll, NO_PREVIOUS_STATEMENT, DEFAULT_STATUS
└── positions.test.ts
server/pv/positions.golden.test.ts
```

## Complexity Tracking
None.
