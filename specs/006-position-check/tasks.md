# Tasks: 006 PositionCheck.aspx → SettlementExceptions

## Phase 1: Setup
- [x] T001 Position check `UiState` fields (`pc*`) in src/types.ts
- [x] T002 `pc` / `all` context keys and `PvContextPatch` in src/model/pv/context.ts

## Phase 2: Foundational
- [x] T003 `GET /api/pv/position-check/dates` in server/pv/routes.ts; `positionCheckDates()` in src/api/pv.ts; 403/golden assertions in server/pv/api.int.test.ts
- [x] T004 `PvSliceDef.active`, `exceptions` registration and `saveReconNote` `PvOp` in src/model/pv/slice.ts
- [x] T005 `PositionCheck.aspx` → `screen: 'exceptions'`, `params: {pc: '1'}` in src/model/pv/access.ts; PV nav passes params
- [x] T006 `usePv.run` handles `saveReconNote` (src/pv/usePv.ts); `goPv(screen, patch)` in src/App.tsx

## Phase 3: User stories
- [x] T007 [US1] `loadPositionCheck`, `fmtQty`, `pvDate`, break rows and messages in src/model/pv/position-check.ts; preview fixture in src/model/pv/preview.ts
- [x] T008 [US2] Check all table, View → `?acct=&stmt=`
- [x] T009 [US3] Inline edit / Update / Cancel, "Notes saved.", failure message
- [x] T010 [US4] Shell text for the PV `exceptions` states (src/model/shell.ts); `posCheck` in src/model/screens.ts; src/screens/PositionCheck.tsx; App render switch

## Phase 4: Verification
- [x] T011 src/model/pv/position-check.test.ts (context gating, roles, load sequence, formats, Q11/Q12 messages, edit/save, shell) added to test:unit; pv.test.ts updated for the new context keys and nav
- [x] T012 visual-diff: `poscheck-<State>` × 4; flows nav, edit, save, live-save (Q18 row), check-all, check-all-view, no-prev, forbidden; `select` step and sequential API responses; baselines
- [x] T013 docs/legacy-pv-migration.md decisions; contract delta in contracts/position-check-ui.md
- [x] T014 lint, typecheck, build, test:unit, test:domain, test:backend, test:db, qa:test; full visual-diff with mockup cases unchanged
