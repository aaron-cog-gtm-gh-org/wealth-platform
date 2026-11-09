# Implementation Plan: SWIFT domain & parsing

**Branch**: `001-swift-domain` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

## Summary

Port `PV.Core` `SwiftMessage`, `SwiftParser`, `Models` and `DateUtil` (plus the pure `WebUtil` display helpers the
screens need) into framework-free TypeScript under `src/domain/`, with an exact decimal type, and port
`PV.Tests/SwiftParserTests` to Vitest behind `npm run test:domain`.

## Technical Context

**Language/Version**: TypeScript 5.6, Node 22 (ES2020 target, `bigint`)

**Primary Dependencies**: none at runtime; Vitest 2.1.9 (dev, Vite 5 compatible)

**Storage**: N/A (pure functions over text)

**Testing**: Vitest (`npm run test:domain`, `vitest.config.ts` includes only `src/domain/**/*.test.ts`)

**Target Platform**: browser bundle and Express API (shared module)

**Project Type**: web application (React front end + Express API)

**Performance Goals**: parse the 6,044-file archive at startup in seconds (string splitting, no regex grammar)

**Constraints**: exact decimal values; no I/O, clock or framework in `src/domain`

**Scale/Scope**: ~5 modules, ~500 lines

## Constitution Check

| Principle | Status |
| --- | --- |
| I Behavioural parity | PASS - every Q1–Q6/Q14 behaviour preserved and tested; no divergences |
| II Pure domain core | PASS - `src/domain` imports nothing outside itself; text in, values out |
| III Test-first with legacy fixtures | PASS - NUnit cases ported 1:1 (`parser.legacy.test.ts`) plus quirk edge cases |
| IV View-model contract | N/A - no screen in this feature |
| V No regression | PASS - no screen/workspace/QA file touched; existing suites unchanged |
| VI Secure by default | N/A - no I/O |
| VII Simplicity & traceability | PASS - every export carries a `legacy:` origin comment |

Re-check after design: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-swift-domain/
├── plan.md  research.md  data-model.md  quickstart.md  tasks.md
├── contracts/domain-swift.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/domain/
├── index.ts          # barrel for later specs/screens
├── decimal.ts        # exact .NET-style decimal
├── date.ts           # IsoDate, parseYmd, formatDate (DateUtil)
├── dotnet.ts         # Path.*, Trim, int.Parse equivalents
├── format.ts         # WebUtil FmtQty/FmtPx/FmtMoney/FmtDt/TryParseUkDate/StatusText
└── swift/
    ├── index.ts  message.ts  models.ts  parser.ts
    ├── __fixtures__/legacy.ts      # strings from SwiftParserTests.cs
    ├── parser.legacy.test.ts       # NUnit port
    └── parser.test.ts              # quirk edge cases
vitest.config.ts
```

**Structure Decision**: one shared `src/domain` tree compiled by both the app (`tsc -b`) and, from spec 002 on, the
server; the barrel `src/domain/index.ts` is the public surface.

## Complexity Tracking

None.
