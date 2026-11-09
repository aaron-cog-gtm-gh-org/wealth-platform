# Tasks: 008 ClientSearch + ClientSummary → Client 360

## Phase 1 — Setup
- [x] T001 Branch from `devin/1794237508-legacy-pv-migration`; read constitution, migration doc, spec 004/010 contracts, legacy ClientSearch/ClientSummary.

## Phase 2 — Foundational (blocking)
- [x] T002 [P] `PvContext` `cid`/`q` + `PV_CONTEXT_KEYS` + `pvContextKey` (`src/model/pv/context.ts`)
- [x] T003 [P] `PvSliceDef.active`, `PvModelInput.openPv` (`src/model/pv/slice.ts`); `openPv` in `src/App.tsx`
- [x] T004 [P] `clients` screen id, `UiState.clientPage` (`src/types.ts`)

## Phase 3 — US1 Client search (P1)
- [x] T005 [US1] Tests: context, slice gating, search model, paging, Empty rule (`src/model/clients.test.ts`)
- [x] T006 [US1] `clientSearchSlice`, `buildClientSearch`, preview fixture; `PV_PAGES` ClientSearch → `clients`
- [x] T007 [US1] `src/screens/ClientSearch.tsx`; shell META/EMPTY/ERR `clients`

## Phase 4 — US2 Custody Client 360 (P1)
- [x] T008 [US2] Backend golden test for every client (`server/pv/api.int.test.ts`)
- [x] T009 [US2] `GET /clients/:clientId/summary` (`server/pv/routes.ts`); `clientSummary()` + wire types
- [x] T010 [US2] Tests: summary formats, links by role/PV_PAGES, 404 → Empty, shell copy
- [x] T011 [US2] `clientSummarySlice`, `buildClientSummary`, `clientSummaryCopy`; `PV_PAGES` ClientSummary → `c360`
- [x] T012 [US2] `src/screens/CustodyClient360.tsx`; App renders it only when `m.client360`

## Phase 5 — US3 Whitfield default
- [x] T013 [US3] Unit test: `c360` without `cid` has no slice and Whitfield copy; mockup visual-diff unchanged

## Phase 6 — Polish
- [x] T014 Visual-diff app-only cases + flows, baselines (`scripts/visual-diff.mjs`, `scripts/visual-baselines/`)
- [x] T015 Docs: api-pv contract row, pv-shell context keys, migration doc D-008-*
- [x] T016 lint, typecheck, build, test:unit/domain/backend/db, qa:test, visual-diff; merge latest integration branch; PR
