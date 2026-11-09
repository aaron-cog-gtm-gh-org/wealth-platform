# Implementation Plan: Custody area (Portfolio Viewer integration)

**Branch**: `feature/legacy-pv-integration` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary
Rebuild Portfolio Viewer (ASP.NET Web Forms 4.8 + SQL Server + SWIFT file archive) as a Custody
area of the workspace. The PV C# domain logic (SwiftParser, ArchiveIndex, PositionBuilder,
SettlementReader, PositionCheck) is ported to pure TypeScript. Reference data and the archive move
into PostgreSQL. A `/api/custody` router serves React views. Parity is proven by a Playwright
harness that captures PV's own screens and compares them with the new API.

## Technical Context
**Language/Version**: TypeScript 5.6, Node 22 (server via tsx), React 18 + Vite 5
**Primary Dependencies**: express 4, pg 8 (no new runtime deps); Playwright (existing dev dep) for parity
**Storage**: PostgreSQL 16 (`custody_*` tables; schema/seed SQL loaded by `npm run db:setup`)
**Testing**: node:test (unit), testcontainers integration tests, Playwright (browser + parity)
**Target Platform**: Linux/macOS dev; local stack API :3001, Vite :5173; legacy PV :8080 for parity
**Performance Goals**: any Custody view < 2 s; ingest of 6,044 files at db:setup < 60 s
**Constraints**: deterministic seed; no edits to `qa/` or legacy repo; GBP book
**Scale/Scope**: 120 accounts, 3,073 statements, 2,971 confirmations, 6 views

## Constitution Check
| Principle | How this plan complies |
| --- | --- |
| I Synthetic/disposable | Archive + seed are PV's synthetic data; reset restores recon notes |
| II Persisted, audited | Recon-note PUT persists + writes `wf_audit`; all else read-only |
| III Validated boundaries | Query/body validation in `server/custody/validation.ts`; domain is pure TS in `server/custody/swift` + `domain` |
| IV Proven parity | `scripts/legacy-parity` captures PV live and diffs; divergences allow-listed in `expected-divergences.json` with root cause |
| V Accessible, realistic | Reuses `src/workspace/ui.tsx`; captioned tables, labelled filters, deep links |
| VI Evidence | Full CI command set + recorded browser walkthrough (Wave 3) |
Gate: PASS (no violations).

## Project Structure

### Documentation (this feature)
```text
specs/001-custody-portfolio-viewer/
├── spec.md  plan.md  research.md  data-model.md  quickstart.md  tasks.md
├── contracts/custody-api.md
└── checklists/requirements.md, migration-parity.md
```

### Source Code (repository root)
```text
server/custody/
├── archive/                 # copied PV archive: mt535/*.txt, mt54x/<yyyyMMdd>/*.txt   (C3)
├── swift/                   # parse.ts, decimal.ts, statement.ts, confirm.ts + *.test.ts  (C2)
├── domain/                  # holdings.ts, settlements.ts, position-check.ts + *.test.ts (C2)
├── load-archive.ts          # raw file -> custody_messages (C3)
├── parse-archive.ts         # custody_messages -> statements/lines/confirmations (C4)
├── repository.ts  routes.ts  validation.ts  api.int.test.ts   (C4)
server/db/custody-schema.sql, custody-seed.sql (C3); server/db/setup.ts (C3 load, C4 parse hook)
server/app.ts                # mount /api/custody (C4)
src/workspace/custody/       # api.ts, CustodyArea.tsx, views/*.tsx, custody.css      (C5)
src/workspace/model.ts, Workspace.tsx  # add 'custody' area                       (C5)
scripts/legacy-parity/       # capture.mjs, compare.mjs, expected-divergences.json, golden/ (C1)
.agents/skills/legacy-portfolio-viewer/SKILL.md                                   (C1)
e2e/custody/*.spec.ts, playwright.custody.config.ts                              (C6)
```
**Structure Decision**: Web application inside the existing repo; Custody code is isolated under
`server/custody` and `src/workspace/custody` so the workstreams don't edit the same files.

## Workstreams (child sessions)
| Wave | Child | Owns | Depends on |
| --- | --- | --- | --- |
| 1 | C1 Legacy runtime + parity harness | `scripts/legacy-parity/**`, `.agents/skills/legacy-portfolio-viewer/**` | contract only |
| 1 | C2 SWIFT core + domain | `server/custody/swift/**`, `server/custody/domain/**` | data-model types |
| 1 | C3 Persistence + archive load | `server/db/custody-*.sql`, `server/custody/archive/**`, `load-archive.ts`, `setup.ts`, reset | data-model |
| 2 | C4 Custody API | `parse-archive.ts`, `repository.ts`, `routes.ts`, `validation.ts`, `app.ts` mount, int tests | C2, C3 |
| 2 | C5 Custody UI | `src/workspace/custody/**`, area registration | contract (wires to C4 on merge) |
| 3 | C6 E2E + parity run | `e2e/**`, parity report, recordings | all |
Shared files (`package.json` scripts, `server/db/setup.ts`) are edited by one child per wave; the
parent resolves any trivial conflicts at merge.

## Complexity Tracking
None.
