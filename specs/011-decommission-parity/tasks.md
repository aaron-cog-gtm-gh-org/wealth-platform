# Tasks: Portfolio Viewer decommission parity

## Phase 1: Setup
- [x] T001 Add `parity` script to `package.json`.
- [x] T002 Create `parity/divergences.json` with an empty list.

## Phase 2: User Story 1 & 2 - parity runner (P1) 🎯 MVP
- [x] T003 [US2] Compare every archive file against `parity/legacy-oracle/archive-manifest.sha256` in `server/pv/parity.ts`.
- [x] T004 [US1] Compare archive index counts, statement selection and statement dates.
- [x] T005 [US1] Compare holdings and Position Check runs with the PostgreSQL providers.
- [x] T006 [US1] Compare Check All and settlements (90-day and full range, with amounts).
- [x] T007 [US1] Write JSON and Markdown reports; exit 1 on undeclared mismatches; apply `parity/divergences.json`.
- [x] T008 [US1] Negative check: change one `pv.recon_note` status, confirm FAIL with the account and date, reseed, confirm PASS.

## Phase 3: User Story 3 - decommission checklist (P2)
- [x] T009 [US3] Write `checklists/decommission.md` covering PV.Core, PV.Data, PV.Web, PV.Tests and Q1–Q18.
- [ ] T010 [US3] Tick the screen rows (005–009) once their PRs are merged and re-run `npm run parity` on the final integration branch.

## Dependencies & Execution Order
T001–T002 → T003–T007 → T008. T009 can run in parallel. T010 runs after the screen specs merge.
