<!--
Sync Impact Report
- Version: (template) → 1.0.0
- Added principles: I–VII (initial ratification for the Portfolio Viewer migration)
- Added sections: Technology & Architecture Constraints; Migration Workflow & Quality Gates
- Templates: plan/spec/tasks templates read this file at runtime; no template edits required
- Deferred TODOs: none
-->
# RBC Wealth Platform Constitution

## Core Principles

### I. Behavioural Parity Before Improvement (NON-NEGOTIABLE)
Ported Portfolio Viewer logic (`legacy-wealth-platform`: PV.Core, PV.Data, PV.Web) MUST
reproduce the legacy results on identical inputs: same parsed values, same index keys, same
reconciliation rows, statuses and ordering. Every known legacy quirk is catalogued in
`docs/legacy-pv-migration.md` and each spec MUST state, per quirk it touches, whether it is
**preserved** (default) or **changed**. A change is only allowed when the spec names it as an
explicit divergence, describes the new behaviour, and the parity checklist (spec 011) lists the
expected difference. Silent "fixes" are defects.

### II. Pure Domain Core
SWIFT parsing, archive indexing, position building and reconciliation live in `src/domain/` as
pure, framework-free TypeScript: no React, no Express, no `fs`, no `Date.now()` and no ambient
singletons (the legacy `ArchiveIndex.Current` becomes an explicit value passed to callers).
I/O is injected through small interfaces (e.g. an archive source, a reference-data/notes
provider), so the same code runs in the API, in tests and in parity tooling. Decimal values
MUST NOT suffer binary floating-point drift where legacy used `decimal` (quantities to 4 dp,
amounts to 2 dp): use scaled integers or an equivalent exact representation and document it.

### III. Test-First With Legacy Fixtures
Every ported module ships Vitest tests written before or with the code. The NUnit cases in
`PV.Tests` are ported first (including the inline MT535/MT545 fixture strings) and must pass
unchanged in meaning; ignored NUnit tests are re-enabled against real files from the in-repo
archive copy. Edge cases found in the archive (RPLC, NEWM/DUPL, CANC, resend sequences `_002`/
`_003`, FAMT quantities, empty `ACTI//N` statements, SEDOL lines in 35B) each get a test.

### IV. One View-Model Contract For Every Screen
Screens render only from view models produced in `src/model/` (`buildModel` → `buildShell` +
`buildScreens`). Every new or changed screen MUST support all four `DataState` variants
(Populated, Loading, Empty, Error) reachable via `?screen=<id>&state=<state>`, and MUST be added
to `scripts/visual-diff.mjs` (static states plus at least one interaction flow). Screens never
fetch or compute domain results themselves.

### V. Existing Experience Must Not Regress
The current reference screens stay pixel-identical to the mockup in their default view: the
existing `visual-diff` baseline, `npm run test:unit`, `npm run test:backend`, `qa:test` and the
connected workspace (`?screen=workspace`) MUST keep passing. Migrated Portfolio Viewer data is
introduced through explicit context (custody account / statement parameters, new screens and
role-gated nav), never by replacing the seeded Whitfield data the mockup and QA workbook depend on.
UI follows the existing RBC visual language (blue `#005daa` / yellow `#ffd200`, existing
typography and table styles); no legacy Web Forms styling is carried over.

### VI. Secure By Default
No weaker security than legacy, and no legacy weakness carried forward: SHA1 unsalted password
hashes MUST NOT be used for new storage or verification, role checks (ADVISER / OPS / ADMIN)
are enforced on the server as well as in navigation, raw archive files are served only by index
lookup (never by building a path from user input), and SQL is parameterised. Secrets are never
committed. All data is synthetic.

### VII. Simplicity And Traceability
Prefer the smallest design that satisfies parity. Every exported domain function names its legacy
origin (`// legacy: PV.Core.PositionCheck.Run`). Each spec lists the legacy files it replaces so
the decommission checklist can prove full coverage.

## Technology & Architecture Constraints

- Stack: React 18 + Vite 5 + TypeScript 5.6 front end; Express + PostgreSQL 16 API in `server/`;
  Node 22. New unit tests use **Vitest**; existing `node --test` suites stay as they are.
- Data layer (spec 004 owns the final decision and may amend this): the API builds the archive
  index at startup from the in-repo archive copy and serves domain results over `/api/pv/*`; the
  legacy reference tables (APP_USER, CLIENT, ACCOUNT, INSTRUMENT, RECON_NOTE) are ported to a
  dedicated PostgreSQL schema with their seed data. `db/` from the legacy repo is kept as
  reference only and is not executed.
- Routing stays query-param based (`?screen=&state=`) in `src/App.tsx`; new screens are added to
  `SCREENS` in `src/types.ts`.
- Lint (`npm run lint`), typecheck (`npm run typecheck`) and build (`npm run build`) must pass on
  every PR.

## Migration Workflow & Quality Gates

- One Spec Kit feature per migration item, numbered in order:
  001 domain & parsing · 002 archive indexing & settlements · 003 positions & reconciliation ·
  004 data layer · 005 Holdings → PortfolioDetail · 006 PositionCheck → SettlementExceptions ·
  007 Settlements screen · 008 ClientSearch/ClientSummary → Client360 · 009 MessageBrowser screen ·
  010 Login/Admin → shell auth · 011 decommission parity checklist.
- Each feature runs specify → plan → tasks → implement, commits its `specs/NNN-*` artifacts with
  the code, and opens a PR into the migration integration branch (not `main`).
- Screen features (005–010) include their `buildScreens` wiring, four DataStates and visual-diff
  coverage (migration step 6) inside the same feature.
- Parity (011) compares the TypeScript results with golden output captured by running the legacy
  PV.Core on the same archive files and seed data; any difference not listed as an explicit
  divergence blocks decommissioning.

## Governance

This constitution supersedes ad-hoc practice for the migration. Amendments are made by PR that
updates this file with a Sync Impact Report and a semantic version bump (MAJOR: principle removed
or redefined; MINOR: principle or section added; PATCH: wording). Every plan's Constitution Check
gate must list each principle as pass or a justified exception in its Complexity Tracking table.
Reviewers reject PRs that change legacy behaviour without a named divergence.

**Version**: 1.0.0 | **Ratified**: 2026-11-09 | **Last Amended**: 2026-11-09
