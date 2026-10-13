---
description: "Task list for integrating Legacy Portfolio Viewer capabilities into Wealth Platform"
---

# Tasks: Legacy Portfolio Viewer Capabilities in Wealth Platform

**Input**: Design documents from `/specs/001-legacy-portfolio-viewer/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution III (parity fixtures) and V (DB-free parser/calculation tests)
make parser, rules and parity tests mandatory for this feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- `$LEGACY` = local checkout of `aaron-cog-gtm-gh-org/legacy-wealth-platform`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scripts, fixtures and the legacy harness

- [x] T001 Add `test:unit` (`tsx --test server/custody/__tests__/*.test.ts`), `custody:ingest` and `custody:migrate-legacy` scripts to package.json, and vendor the legacy `db/seed/` and `archive/` into data/legacy-pv/ (read by db:setup; `LEGACY_PV_DIR` override)
- [x] T002 [P] Copy one archive file per edge case in spec.md "Edge Cases" (RPLC + NEWM/DUPL for 16558/2026-06-26, cross-day CANC for 16056, 8-digit safes 11397/10554, 1-dp amount, FAMT, ACTI//N, SUBSAFE, LF-only, unknown ISIN GB00ZZ004322) from `$LEGACY/archive` into fixtures/custody/archive-sample/ with a provenance README.md
- [x] T003 [P] Create .NET 4.8 console harness tools/legacy-parity/ (csproj referencing `$LEGACY/src/PV.Core`, Program.cs emitting JSON for every statement, confirmation list and position check) with README.md build/run instructions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, parser, rules, ingestion, Oracle load, client selection and parity fixtures shared by all stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add all `custody_*` tables, constraints and indexes from data-model.md to server/db/schema.sql (including drops so the script stays re-runnable)
- [x] T005 [P] Add a small deterministic custody seed (one user per role, 3 clients, 4 accounts, instruments, one break note) to server/db/seed.sql
- [x] T006 [P] Widen `Currency` to add `GBP`/`EUR` and add all custody DTOs from contracts/api.md to src/api/types.ts; add GBP (£) and EUR formatting and GBP totals in src/format.ts (FR-024)
- [x] T007 [P] Implement SWIFT block/field tokenizer, decimal (string fixed-point, reject thousands separators) and date parsing in server/custody/swift/parse.ts, handling CRLF and LF-only files and continuation lines
- [x] T008 [P] Unit tests for T007 in server/custody/__tests__/parse.test.ts (`21637,5`→`21637.50`, `1250,`, `0,5`, `1.250,50` rejected, LF-only)
- [x] T009 Implement MT535 mapping (23G, 98A::STAT, 97A::SAFE→number, SUBSAFE flattening, ACTI//N empty flag, 35B description, 90A/90B, 93B::AGGR UNIT/FAMT, 19A::HOLD value + reporting value) in server/custody/swift/mt535.ts
- [x] T010 Implement MT544–547 mapping (SEME/PREV, 23G, TRAD/SETT, 35B, 36B, 97A→number, optional 19A::ESTT, direction, free-of-payment) in server/custody/swift/mt54x.ts
- [x] T011 [P] Unit tests for T009/T010 against fixtures/custody/archive-sample/ in server/custody/__tests__/mt535.test.ts and server/custody/__tests__/mt54x.test.ts
- [x] T012 Implement pure rules in server/custody/rules.ts: effective statement (R-5), global cancellation matching, reconcile() per (ISIN, qty type), plus `legacy` variants reproducing BR-1..BR-5 exactly
- [x] T013 [P] Unit tests for T012 in server/custody/__tests__/rules.test.ts covering D-1..D-4 in both `corrected` and `legacy` modes
- [x] T014 Implement idempotent ingester in server/custody/ingest.ts (walk archive layout, SHA-256, per-file transaction into custody_messages + derived tables, recompute effective statements and cancellations, add unknown ISINs to custody_instruments with source `CUSTODIAN`, write custody_ingest_runs) with CLI entry `--archive <dir>`
- [x] T015 [P] Implement legacy reference migration in server/custody/migrate-legacy.ts reading `$LEGACY/db/seed/01..05_*.sql` into custody_users (no hashes), custody_clients, custody_accounts (type normalization), custody_instruments, custody_break_notes + LEGACY_MIGRATION history (`O`→OPEN, `C`→RESOLVED)
- [x] T016 Implement server/custody/platform-view.ts mapping a custody client to `HouseholdDto`/`PortfolioDto` (GBP, latest effective statement, no-source panels flagged unavailable) and wire `npm run db:setup` (server/db/setup.ts) to run migrate-legacy and ingest the committed archive (FR-025)
- [x] T017 Create server/repositories/custody.ts skeleton and mount `/api/custody` routes with 400/404 handling in server/app.ts
- [x] T018 [P] Replace the fixed `HOUSEHOLD_ID` with the selected client from `?client=` and add custody fetch helpers in src/api/client.ts
- [x] T019 Run tools/legacy-parity over `$LEGACY/archive` + seed and commit outputs to fixtures/custody/legacy/ (statements.json, confirmations.json, position-checks.json); confirm 7 legacy breaks
- [x] T020 Parity test in server/custody/__tests__/parity.test.ts: run parser + rules over `$LEGACY_ARCHIVE` (skip if unset) and diff against fixtures/custody/legacy/, allowing only the D-1..D-5 deviations enumerated in legacy-as-built.md §8
- [x] T021 Oracle integration test in server/custody/__tests__/ingest.int.test.ts: full archive → SC-001 counts; second run → 0 new (SC-007)

**Checkpoint**: Foundation ready — `npm run db:setup` loads all legacy data into Oracle, parity proven

---

## Phase 3: User Story 1 - Adviser reviews custodian holdings history (Priority: P1) 🎯 MVP (with US6)

**Goal**: Effective weekly statements with lines and totals for any migrated account

**Independent Test**: quickstart.md §3 statement rows + §4 steps 1–2

- [x] T022 [US1] Implement `listStatementDates` and `getStatement` (custodian-name fallback, `nameVerified`, `missingReportingValues`) in server/repositories/custody.ts
- [x] T023 [US1] Add `GET /api/custody/accounts/:accountId/statements[/:date]` in server/app.ts
- [x] T024 [P] [US1] Build src/screens/CustodyHoldings.tsx (statement-date picker, holdings table, totals, "no statement" vs "empty statement" states, unverified-instrument marker)
- [x] T025 [US1] Register `custody-holdings` in src/types.ts SCREENS, src/model/screens.ts, src/model/shell.ts and src/App.tsx with Loading/Error states
- [x] T026 [US1] Render a picked custody client in src/screens/Client360.tsx and src/screens/PortfolioDetail.tsx via `/api/custody/clients/:clientId/household|portfolio` (GBP, "not available" panels) with a "Custodian statements" link to custody-holdings
- [x] T027 [US1] Add custody-holdings states to scripts/visual-diff.mjs and capture baselines

**Checkpoint**: Advisers can stop using Holdings.aspx

---

## Phase 4: User Story 2 - Adviser reviews settlement confirmations (Priority: P2)

**Goal**: Non-cancelled confirmations by settle-date range with correct amounts

**Independent Test**: quickstart.md §3 confirmation rows + §4 step 3

- [x] T028 [US2] Implement `listConfirmations(accountId, from, to)` (default 90 days to latest statement, excludes cancelled and cancellations) in server/repositories/custody.ts
- [x] T029 [US2] Add `GET /api/custody/accounts/:accountId/confirmations` in server/app.ts
- [x] T030 [P] [US2] Build src/screens/CustodySettlements.tsx (date range, direction, FOP label, qty type, amount + ccy, reference)
- [x] T031 [US2] Register `custody-settlements`; expose settlementsHref link contract (CustodyHoldings link deferred until US1)
- [x] T032 [US2] Add custody-settlements states to scripts/visual-diff.mjs

**Checkpoint**: Settlements.aspx replaced; D-1..D-3 visible as fixed

---

## Phase 5: User Story 3 - Operations reconciles custodian positions (Priority: P3)

**Goal**: Position check with audited notes, corrected and legacy modes

**Independent Test**: quickstart.md §3 break counts (2 / 7) + §4 step 4

- [x] T033 [US3] Implement `positionCheck(date, accountId?, mode)` using rules.ts over Oracle data, joined to custody_break_notes, in server/repositories/custody.ts
- [x] T034 [US3] Implement `patchBreakNote` (partial update + history row in one transaction) and `getBreakHistory` in server/repositories/custody.ts
- [x] T035 [US3] Add `GET /api/custody/position-checks`, `PATCH /api/custody/breaks/...`, `GET .../history` (OPS, ADMIN) in server/app.ts
- [x] T036 [P] [US3] Build src/screens/PositionCheck.tsx (account or Check All, inline status/cause/note edit pre-filled with current values, author name field remembered in localStorage, history drawer, legacy-mode toggle)
- [x] T037 [US3] Register `position-check` in the operations nav next to Settlement Exceptions in src/model/shell.ts
- [x] T038 [US3] Integration test in server/custody/__tests__/position-check.int.test.ts: 2 corrected / 7 legacy breaks over full archive, author stored, note-only PATCH keeps status, 13 migrated notes
- [x] T039 [US3] Add position-check states to scripts/visual-diff.mjs

**Checkpoint**: PositionCheck.aspx replaced with audit history

---

## Phase 6: User Story 4 - Operations inspects raw custodian messages (Priority: P4)

**Goal**: Filter and view stored raw messages; trace derived records to source

**Independent Test**: quickstart.md §4 step 5; 20 random files byte-identical

- [x] T040 [US4] Implement `listMessages(type, date, safe, page)` and `getMessage(id)` in server/repositories/custody.ts
- [x] T041 [US4] Add `GET /api/custody/messages[/:messageId]` (OPS, ADMIN) in server/app.ts
- [x] T042 [P] [US4] Build src/screens/MessageBrowser.tsx (filters, paging, escaped `<pre>` raw text preserving line endings) and add its states to scripts/visual-diff.mjs
- [ ] T043 [US4] Add source-message links (by `messageId`) from CustodyHoldings, CustodySettlements and PositionCheck screens

**Checkpoint**: MessageBrowser.aspx replaced

---

## Phase 7: User Story 5 - Administrator monitors and re-runs ingestion (Priority: P5)

**Goal**: Ingestion statistics and on-demand incremental ingest

**Independent Test**: quickstart.md §4 step 6

- [x] T044 [US5] Implement `getIngestionStatus` (counts by type, statements, confirmations, unmatched cancellations, errors) in server/repositories/custody.ts
- [x] T045 [US5] Add `GET /api/custody/admin/ingestion` and `POST /api/custody/admin/ingest-runs` (ADMIN; one run at a time) calling server/custody/ingest.ts from server/app.ts
- [x] T046 [P] [US5] Build src/screens/CustodyAdmin.tsx, register `custody-admin` under an admin nav entry and add its states to scripts/visual-diff.mjs

**Checkpoint**: Admin.aspx replaced

---

## Phase 8: User Story 6 - User picks any client (Priority: P1, ship with US1)

**Goal**: A shell client picker lists every household and migrated client; picking one drives all screens (no login)

**Independent Test**: quickstart.md §4 step 1; 50 clients findable by reference

- [x] T047 [US6] Implement `searchClients(q, page)` (households + custody clients by name or client_ref; 25/page) and `getClientSummary` in server/repositories/custody.ts
- [x] T048 [US6] Add `GET /api/clients`, `GET /api/custody/clients/:clientId[/household|/portfolio]` in server/app.ts
- [x] T049 [P] [US6] Build src/ClientPicker.tsx (header search, results showing reporting currency) in the app shell
- [x] T050 [US6] Wire the picker into src/App.tsx/src/model/shell.ts setting `?client=`; add picker and GBP Client 360 states to scripts/visual-diff.mjs

**Checkpoint**: ClientSearch.aspx and ClientSummary.aspx replaced — all legacy screens covered

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T051 [P] Write docs/custody.md (db:setup load, ingest runbook, file-drop location, no-login note, legacy-parity mode)
- [ ] T052 [P] Add custody paths to the table in docs/oracle-setup.md and screens to README.md
- [ ] T053 Apply one date format from src/format.ts across all custody screens (FR-023)
- [ ] T054 Measure full ingest (< 2 min) and screen latency (< 2 s) with the full archive; tune indexes in server/db/schema.sql if needed
- [ ] T055 Run quickstart.md end-to-end and record sign-off results in specs/001-legacy-portfolio-viewer/signoff.md
- [ ] T056 Agree decommission steps with operations (Portfolio Viewer read-only for one statement cycle, archive retention) in specs/001-legacy-portfolio-viewer/signoff.md

---

## Dependencies & Execution Order

- **Setup (T001–T003)** → **Foundational (T004–T021)** → user stories.
- Within Foundational: T007 → T009/T010 → T012 → T014; T004 → T014/T015/T017; T003 → T019 → T020.
- **US1** needs Foundational; its T026 needs US6 T049–T050 (picker). **US2** needs Foundational (links to US1 screen in T031).
  **US3** needs Foundational; most useful after US1/US2 exist. **US4** T043 links into US1–US3
  screens. **US5** and **US6** need Foundational only; build US6 first.
- Polish after the stories being shipped.

## Parallel Opportunities

```text
Setup:        T002 ‖ T003
Foundational: T005 ‖ T006 ‖ T007 ‖ T018, then T008 ‖ T011 ‖ T013 ‖ T015
US1:          T024 (screen) while T022–T023 (API) are built
US3:          T036 (screen) while T033–T035 (API) are built
Stories:      after Foundational, US6 then US1, alongside US5, by different people
```

## Implementation Strategy

1. **MVP** = Setup + Foundational + US6 + US1: legacy data in Oracle with parity proven, any client
   pickable and shown in Client 360/Portfolio in GBP. Stop and validate with quickstart.md §1–§3.
2. Add US2 then US3 — together they retire the operational use of Portfolio Viewer.
3. Add US4–US5, then Polish and decommission (T055–T056).
