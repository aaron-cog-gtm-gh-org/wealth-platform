# Tasks: Custody area (Portfolio Viewer integration)

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/custody-api.md, quickstart.md
Labels: `[P]` parallel-safe; `[USn]` user story; `{Cn}` owning child session (see plan.md Workstreams).
Each child opens one PR into `feature/legacy-pv-integration` and runs the full gate set from quickstart.md §6.

## Phase 1: Setup (Wave 1)
- [x] T001 {C3} Copy legacy `archive/mt535` and `archive/mt54x/<yyyyMMdd>` unchanged to `server/custody/archive/` (expect 3,073 + 2,971 files)
- [ ] T002 [P] {C1} Bring PV up on Linux (Mono + SQL Server 2022 container, db/schema + db/seed, port 8080, login PVADMIN/portfolio1) without editing the legacy repo; document it in `.agents/skills/legacy-portfolio-viewer/SKILL.md`

## Phase 2: Foundational (Wave 1, blocks all stories)
- [ ] T003 [P] {C2} `server/custody/swift/types.ts` + `parse.ts`: block-4 field reader; MT535 (23G, 98A::STAT, 97A::SAFE, 35B, 90A/90B, 93B, 19A::HOLD), MT54x (20C::SEME/PREV, 23G, 98A::TRAD/SETT, 35B, 36B::ESTT, 97A::SAFE, 19A::ESTT); continental decimals; missing `{5:}` trailer tolerated; direction 544/545=REC, 546/547=DEL
- [ ] T004 [P] {C2} `server/custody/swift/parse.test.ts`: fixtures from real archive files incl. `_002` resend, RPLC, NEWM/DUPL, no-trailer, fractional qty, unpadded safe, D3 amount > 2^31
- [x] T005 [P] {C3} `server/db/custody-schema.sql` per data-model.md (all `custody_*` tables, checks, indexes; quote constraints exactly: note VARCHAR(500); status IN ('NEW','O','C','OPEN','CHASED','RESOLVED','WRITEOFF'))
- [x] T006 [P] {C3} `server/db/custody-seed.sql`: T-SQL → PostgreSQL conversion of PV seed (6 users, 50 clients, 120 accounts, 302 instruments, 13 recon notes), IDs preserved
- [x] T007 {C3} `server/custody/load-archive.ts`: insert every archive file into `custody_messages` (metadata from file name, raw_text, parse_status='pending'); wire schema + seed + load into `server/db/setup.ts`; test in `server/custody/load-archive.int.test.ts`
- [x] T008 {C3} Extend `resetWorkflowData` (or a sibling called from `/api/test/reset`) to restore the 13 seed recon notes
- [ ] T009 [P] {C1} `scripts/legacy-parity/capture.mjs`: Playwright capture of PV Holdings / Settlements / Position Check / Check All / Client Search for all accounts and dates → normalized JSON; commit a gzipped golden snapshot under `scripts/legacy-parity/golden/`
- [ ] T010 [P] {C1} `scripts/legacy-parity/compare.mjs` + `expected-divergences.json` (D1, D2): diff golden vs `/api/custody` per contracts/custody-api.md; write `report.json` + `report.md`; non-zero exit on unexplained diffs

## Phase 3: US1 Holdings (P1)
- [ ] T011 [P] [US1] {C2} `server/custody/domain/holdings.ts` + test: highest file_seq per date, dates newest first, UNKNOWN INSTRUMENT fallback, GBP total
- [ ] T012 [US1] {C4} `server/custody/parse-archive.ts`: parse pending messages with T003 into statements/lines/confirmations; record `custody_archive_loads`; called from `setup.ts`
- [ ] T013 [US1] {C4} `repository.ts` + `routes.ts`: `/accounts`, `/accounts/:id/statements`, `/accounts/:id/statements/:date`, `/statement-dates`; mount in `server/app.ts`
- [x] T014 [US1] {C5} `src/workspace/custody/` area shell (view tabs, deep links `view/acct/date`), register `custody` in `src/workspace/model.ts` + `Workspace.tsx`; Holdings view with account picker, date picker, captioned table and total

## Phase 4: US2 Position check (P1)
- [ ] T015 [P] [US2] {C2} `server/custody/domain/position-check.ts` + test: previous = latest strictly earlier; window (prev+1, stmt]; expected = prev + net; omit zero diff; NEW when no note; sorted by ISIN; ports `PositionCheckTests.cs` cases
- [ ] T016 [US2] {C4} `/accounts/:id/position-check/:date`, `/position-check/:date`, `/operators`, `PUT /recon-notes` with validation (`validation.ts`) and `wf_audit` event
- [x] T017 [US2] {C5} Position check view (breaks table, status + note editor with operator select, save → reload persists) and Check-all view

## Phase 5: US3 Settlements (P2)
- [ ] T018 [P] [US3] {C2} `server/custody/domain/settlements.ts` + test: cancellations applied across all day folders (D2), safe match ignoring leading zeros (D1), inclusive dates, newest first
- [ ] T019 [US3] {C4} `/accounts/:id/settlements` with default 90-day window and from ≤ to validation
- [x] T020 [US3] {C5} Settlements view with date range filter, empty state "No settlements in period."

## Phase 6: US4 Client search (P2)
- [ ] T021 [US4] {C4} `/clients`, `/clients/:id`
- [x] T022 [US4] {C5} Client search + client summary views with links into Holdings / Settlements / Position check

## Phase 7: US5 Messages + Archive (P3)
- [ ] T023 [US5] {C4} `/messages`, `/messages/:fileName`, `/archive/status`, `POST /archive/reload` (transactional re-load)
- [x] T024 [US5] {C5} Messages view (filters, raw viewer) + Archive view (counts, parse errors, reload)
- [ ] T025 [P] {C4} `server/custody/api.int.test.ts` covering every contract route incl. 400/404 cases; add to `test:int`

## Phase 8: Polish & Verification (Wave 3)
- [ ] T026 {C6} `e2e/custody/*.spec.ts` + `playwright.custody.config.ts` (outside `qa/tests`) for every acceptance scenario; `npm run test:e2e:custody`
- [ ] T027 {C6} Live parity run (PV :8080 vs new :3001) → `specs/001-custody-portfolio-viewer/parity-report.md`; 0 unexplained diffs (SC-002)
- [ ] T028 {C6} Recorded side-by-side walkthrough PV vs Custody area
- [ ] T029 {parent} Full gate set, `/speckit:converge`, final recorded E2E, PR to `main`

## Dependencies
Wave 1 (C1, C2, C3) run in parallel. Wave 2: C4 needs C2 + C3 merged; C5 builds against the contract and needs C4 for live data (C5 may stub fetches in tests only). Wave 3 needs all.
