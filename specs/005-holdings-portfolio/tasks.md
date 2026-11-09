# Tasks: 005 Holdings → PortfolioDetail

## Phase 1: Foundational (additive shared plumbing)
- [x] T001 Optional `copy` on `PvSliceDef`, `ctx` on the resolved slice in src/model/pv/slice.ts; pass `ctx` from src/pv/usePv.ts
- [x] T002 Use slice `copy` overrides for crumb/title/subtitle, loading, empty and error in src/model/shell.ts
- [x] T003 Picker navigation through `goPv(screen, { stmt })` (spec 006 context patch) in src/App.tsx

## Phase 2: User Story 1 – latest statement (P1)
- [x] T004 [US1] Decimal formatters (Q14) and exact GBP sum in src/model/holdings.ts; tests first in src/model/holdings.test.ts
- [x] T005 [US1] `holdingsSlice` (load via API, 404 → not found, isEmpty, preview, copy) and register `PV_SLICES.portfolio`
- [x] T006 [US1] Preview fixture src/model/pv/preview-holdings.ts (account 2018, 09-OCT-2026)
- [x] T007 [US1] `buildPvHoldings` view model; `buildPvScreens.portfolio` in src/model/screens.ts
- [x] T008 [US1] src/screens/CustodyHoldings.tsx; App renders it when `m.portfolio`
- [x] T009 [US1] `PV_PAGES` Holdings.aspx → `portfolio`

## Phase 3: User Story 2 – statement picker (P1)
- [x] T010 [US2] Picker options, not-on-file option (D-005-3), legacy messages, function/file display; onChange → `goPv('portfolio', { stmt })`

## Phase 4: User Story 3 – DataStates and regression (P1)
- [x] T011 [US3] Update src/model/pv/pv.test.ts for the new nav entry and registered slice; add holdings tests to `test:unit`
- [x] T012 [US3] visual-diff: `portfolio-pv-*` × 4, flows (select date, empty statement, not on file, unknown account, sign-in from deep link); `select` step and query-aware routes; admin baselines kept (the extra "Holdings" nav row stays within `BASELINE_MAX`, ≤0.04%)
- [x] T013 docs/legacy-pv-migration.md spec 005 decisions; contracts/holdings-view.md
- [x] T014 lint, typecheck, build, test:unit, test:domain, test:backend, test:db, qa:test; full visual-diff with mockup counts unchanged
