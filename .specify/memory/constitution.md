# RBC Wealth Platform Constitution

## Core Principles

### I. Synthetic Data, Disposable Environments
All client, account, holding, statement and confirmation data MUST be synthetic. Database setup
commands (`npm run db:setup`, `POST /api/test/reset`) MUST only target a disposable local
PostgreSQL instance; reset endpoints MUST stay loopback-only and opt-in (`ENABLE_TEST_RESET=1`).
The application MUST NOT connect to trading, payment or custodian networks.

### II. Persisted, Audited Workflows
Every user action in the connected workspace that changes state MUST be persisted through the
Express API to PostgreSQL, MUST survive a page reload, and MUST write an audit event visible in the
workspace audit feed. Client-only state is allowed for filters, sorting and selection only.

### III. Validated Boundaries
The server MUST validate every request body and query parameter (reject unknown fields, enforce
types, ranges and lengths) and return a JSON `{ error }` with a 4xx status for invalid input.
Domain logic (parsing, reconciliation, calculations) MUST live in pure, side-effect-free TypeScript
modules with unit tests; routes and repositories stay thin.

### IV. Proven Migration Parity (NON-NEGOTIABLE)
Capabilities migrated from a legacy system MUST be verified against the running legacy system on
the same input data, not against a re-reading of its code. Every difference in output MUST be
either fixed or listed as an intentional, documented divergence with its root cause. A parity claim
without a reproducible comparison run is not accepted.

### V. Accessible, Realistic UI
Workspace screens MUST use semantic HTML (labelled form controls, captioned tables, `role`/`aria`
where native semantics are insufficient), be fully keyboard operable, and support deep links that
round-trip through browser Back/Forward. UI copy and data MUST read as a real bank operations tool:
no placeholder, lorem-ipsum, "demo", "mock" or "fake" wording.

### VI. Evidence Over Assertion
A feature is done only when shell checks pass (lint, typecheck, build, unit, backend, db tests) and
its user flows have been exercised in a real browser with recorded evidence. API-only checks
supplement but never replace browser verification.

## Technology & Repository Constraints

- Frontend: React 18 + TypeScript + Vite; workspace areas under `src/workspace/areas/`, shared
  controls in `src/workspace/ui.tsx`.
- Backend: Node 22, Express 4, `pg`, PostgreSQL 16 (Docker `postgres:16-alpine`); tests use
  `node:test` and testcontainers.
- No new runtime dependency without a stated need in the plan; prefer the standard library.
- The manual QA workbook and harness (`qa/`, `qa/cases.json`, 53 cases) MUST remain unchanged by
  feature work, and `qa/tests` MUST contain no generated case specs on `main`.

## Development Workflow & Quality Gates

- Work lands through pull requests into a feature integration branch; the integration branch lands
  on `main` only with the owner's explicit approval.
- Each PR MUST pass `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`,
  `npm run test:backend`, `npm run test:db`, `npm run qa:test` and `npm run qa -- validate-cases`.
- PRs stay focused on one workstream; parallel workstreams MUST NOT edit each other's files except
  through agreed shared contracts defined in the feature plan.

## Governance

This constitution supersedes conflicting conventions in the repository. Amendments require a PR
that updates this file, states the version bump rationale, and updates dependent Spec Kit
artifacts. Versioning follows semantic versioning (MAJOR: principle removal or redefinition; MINOR:
new principle or section; PATCH: wording). Every feature plan MUST include a Constitution Check, and
reviewers MUST verify compliance before merging. Runtime guidance lives in `README.md`,
`qa/playbook.md` and `.agents/skills/`.

**Version**: 1.0.0 | **Ratified**: 2026-11-09 | **Last Amended**: 2026-11-09
