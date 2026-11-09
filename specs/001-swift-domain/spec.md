# Feature Specification: SWIFT domain & parsing (Portfolio Viewer migration 001)

**Feature Branch**: `001-swift-domain`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: User description: "Domain & parsing: port PV.Core SwiftParser/SwiftMessage/Models/DateUtil to TypeScript modules (e.g., src/domain/swift/) preserving MT535/MT54x semantics; port PV.Tests fixtures to Vitest."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a custodian holdings statement (Priority: P1)

Operations and later screens (Holdings, Client summary, Position check) need every MT535 statement read exactly the
way Portfolio Viewer read it: header (function, statement date, safekeeping account, file sequence) and one line per
holding with ISIN, description, price, quantity, quantity type, currency, market value and GBP market value.

**Why this priority**: every other migration item (archive index, holdings, reconciliation) consumes parsed statements.

**Independent Test**: parse the `SwiftParserTests.MT535` fixture and real archive statements; compare against the
legacy NUnit expectations.

**Acceptance Scenarios**:

1. **Given** the legacy `MT535` fixture, **When** it is parsed with file name `MT535_0010042_20181115_001.txt`, **Then** function is `NEWM`, statement date 2018-11-15, safe `0010042`, 2 lines, line 1 `GB00ZZ000486` "Draycott Systems PLC Ord" price 34.553 qty 1660 GBP value 57357.98, line 2 EUR value 25197.88 and GBP value 21433.64.
2. **Given** a statement with `17B::ACTI//N` and no FIN blocks, **When** parsed, **Then** it has zero lines and no error.
3. **Given** a FIN block whose 35B has a `/GB/<sedol>` line, **When** parsed, **Then** the description is the last 35B line.
4. **Given** a FAMT quantity, **When** parsed, **Then** the quantity is the plain number and quantity type is `FAMT`.

### User Story 2 - Read a settlement confirmation (Priority: P1)

Settlement and reconciliation features need MT544–MT547 confirmations read with legacy semantics (reference, previous
reference, function, trade/settle dates, ISIN, quantity, safekeeping account, raw amount, currency, direction, day folder).

**Independent Test**: parse the `SwiftParserTests.MT545` fixture with the legacy Windows-style path.

**Acceptance Scenarios**:

1. **Given** the legacy `MT545` fixture and path `mt54x\20260420\MT545_11521_20260420_001.txt`, **When** parsed, **Then** type 545, reference `SETT20260420211`, `NEWM`, trade 2026-04-15, settle 2026-04-20, `LU00ZZ012622`, qty 941.8671, account `0011521`, amount `GBP4303,01`, direction `REC`, folder `20260420`.
2. **Given** a CANC confirmation, **When** parsed, **Then** reference is the first 20C (SEME) and previous reference is the PREV 20C.

### User Story 3 - Exact numbers and legacy display formats (Priority: P2)

Quantities, prices and amounts must keep exact decimal values (no binary floating point drift) and render with the
legacy display formats used by the screens.

**Acceptance Scenarios**:

1. `12345,67` → 12345.67, `1250,` → 1250, `0,5` → 0.5 (Q1).
2. 2018-11-15 formats as `15-NOV-2018` (Q14).
3. Quantities format `#,##0.####`, prices `#,##0.0000`, money `#,##0.00`, older screens `dd/MM/yyyy`.

### Edge Cases

- `1.250,50` (thousands separator) fails to parse, as in legacy (Q1); callers count it as a parse error.
- Price with currency prefix `ACTU/GBP4,5686` → 4.5686; `PRCT/97,425` → 97.425 (Q2).
- 93B qualifiers other than AGGR are ignored; quantities rounded to 4 dp with banker's rounding (Q3).
- First 19A::HOLD sets currency/value; a later GBP HOLD sets the GBP value; non-GBP with no GBP HOLD → GBP value 0 (Q4).
- FIN block without an `ISIN ` line is dropped; SUBSAFE blocks are flattened (Q5).
- Missing 98A → statement date is the legacy minimum date `0001-01-01`; malformed 98A throws.
- Missing block 4 → message with no fields; block 4 without terminator throws.
- `senderLT` is read from block-2 offset 11 (length 12) as legacy does, so it starts inside the input date (`115KSTLGB2LA`); preserved because no screen reads it.
- File sequence is the trailing `_NNN` of the file name, 0 when absent or not numeric.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST split a FIN message into fields with the legacy rules: block-2 output header gives the message type and sender LT; block 4 runs from `{4:` to the first `\n-}` (else `-}`); a line starting with `:` opens a field `:TAG:raw`; non-empty continuation lines are appended to the previous field with `\n`.
- **FR-002**: Fields MUST expose `content` (text after the first `//`, trimmed, else the whole raw text trimmed) and `qualifier` (text between the optional leading `:` and `//`, else none); messages MUST support find-first, find-all and `16R`/`16S` block extraction exactly as legacy.
- **FR-003**: The system MUST parse MT535 statements and MT54x confirmations reproducing every behaviour in quirks Q1–Q6, including first-20C SEME, last PREV, REC for 544/545 and DEL otherwise, raw 23G function text, unrounded 36B quantity and day-folder from the parent directory name (both `/` and `\` separators).
- **FR-004**: Decimal values MUST be exact (no floating point) and follow .NET `decimal` semantics for parse, add, subtract, compare and `Math.Round` (midpoint to even); display formatting MUST round half away from zero as .NET custom format strings do.
- **FR-005**: Dates MUST be calendar dates without time zone (`YYYY-MM-DD`); `yyyyMMdd` parsing is strict; `formatDate` returns `dd-MMM-yyyy` upper case.
- **FR-006**: All modules MUST be pure (no I/O, clock, framework or singleton) and each export MUST name its legacy origin.
- **FR-007**: The PV.Tests `SwiftParserTests` cases MUST be ported to Vitest with unchanged meaning, runnable by `npm run test:domain`; existing `node --test` suites stay unchanged.

### Key Entities

- **SwiftField / SwiftMessage**: tag + raw text; message type, sender LT, fields, file name.
- **Mt535Statement / Mt535Line**: legacy `Models.cs` statement and holding line.
- **SettlementConfirm**: legacy `Models.cs` MT54x confirmation (`custAcct` keeps legacy casing).
- **Decimal**: exact decimal value with .NET scale semantics; serialises to a canonical string.

## Quirk decisions

| Quirk | Decision |
| --- | --- |
| Q1 ParseDecimal | Preserved (`,`→`.`; thousands separators rejected) |
| Q2 price | Preserved |
| Q3 93B AGGR | Preserved (round 4 dp, midpoint-to-even like `Math.Round`) |
| Q4 19A HOLD | Preserved |
| Q5 35B / SUBSAFE | Preserved |
| Q6 ParseConfirm | Preserved |
| Q14 formats | Preserved (`formatDate` + `fmtQty`/`fmtPx`/`fmtMoney`/`fmtUkDate`/`parseUkDate`) |

No divergences.

## Test port mapping (PV.Tests)

| NUnit case | Spec |
| --- | --- |
| `SwiftParserTests.*` (8 cases) | 001 |
| `PositionCheckTests.ToAmount_*` | 002 (SettlementReader) |
| `PositionCheckTests.ExpectedQty_PrevPlusRecMinusDel` | 003 |
| `ArchiveFileTests.*` (ignored) | 002, re-enabled against the in-repo archive copy |

## Success Criteria *(mandatory)*

- **SC-001**: 100% of the ported `SwiftParserTests` assertions pass.
- **SC-002**: Every edge case listed above has a passing test.
- **SC-003**: Zero floating-point representations of legacy `decimal` values in the domain modules.
- **SC-004**: Lint, typecheck, build and all existing test suites still pass.

## Assumptions

- Server culture of the legacy site is English (`.` decimal, `,` group) since `Web.config` sets no culture.
- Decimal trailing-zero scale is a representation detail: values compare by number and the canonical string strips trailing zeros; no legacy screen prints a raw decimal.
- Legacy culture-sensitive `IndexOf`/`StartsWith` behave as ordinal for the ASCII FIN character set.
- Real-archive file tests arrive with the archive copy in spec 002.
