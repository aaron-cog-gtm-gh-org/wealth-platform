# Tasks: 007 Settlements screen

## Phase 1: Setup
- [x] T001 Add `settlements` to `SCREENS` and `stlFrom`/`stlTo`/`stlMsg` to `UiState` in src/types.ts

## Phase 2: Foundational
- [x] T002 Optional `from`/`to` in `PvContext` (ISO or dd/MM/yyyy) + `parseDateInput` in src/model/pv/context.ts; add keys to `PV_CONTEXT_KEYS`
- [x] T003 Point the `Settlements.aspx` row in src/model/pv/access.ts at `settlements`

## Phase 3: User stories
- [x] T004 [US1] Slice def + `buildSettlements` + formatters in src/model/settlements.ts; register in `PV_SLICES` (src/model/pv/slice.ts)
- [x] T005 [US4] Synthetic preview src/model/pv/preview-settlements.ts (account 01001-01, archive window)
- [x] T006 [US1] Shell META/EMPTY/ERR + `buildPvScreens` entry + `settlementsRange` (src/model/shell.ts, screens.ts, index.ts)
- [x] T007 [US1][US2][US3] src/screens/Settlements.tsx (header, KPIs, range form, grid, picker)
- [x] T008 [US2] `setPvContext` in src/App.tsx; render the screen, and the range form above the Empty panel

## Phase 4: Verification
- [x] T009 src/model/settlements.test.ts (formats, Q10 value, order kept, counts, picker, input validation) + context tests in pv.test.ts; add to test:unit
- [x] T010 visual-diff: settlements × 4, flows (change window, invalid date, dd/MM deep link, live empty, picker, not found); query-aware routing; baselines
- [x] T011 docs/legacy-pv-migration.md D-007 entries; quickstart check
- [x] T012 lint, typecheck, build, test:unit, test:domain, test:backend, test:db, qa:test; full visual-diff with mockup counts unchanged
