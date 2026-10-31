# RBC Wealth Platform

React + TypeScript + Vite wealth-management application with an Express/PostgreSQL backend, a connected operations workspace, and the original reference views in `design/mockups`.

All client identities, accounts and transactions are synthetic. This sandbox is not a production RBC system and connects to no trading or payment networks.

## Run

```sh
nvm use             # Node 22; use your installed Node 22 if not using nvm
npm ci
npm run db:up && npm run db:wait && npm run db:setup
ENABLE_TEST_RESET=1 npm run dev:full   # API :3001 + browser app :5173
```

Open `http://localhost:5173/?screen=workspace&area=clients`. The connected workspace supports `clients`, `portfolio`, `orders`, `money`, `rebalance` and `settlements`. Profile updates, orders, transfers, target allocations, exception handling and audit events are persisted and survive a page reload.

The original reference screens remain at `?screen=c360|portfolio|orders|alts|exceptions|home|activity|money` with optional `&state=Populated|Loading|Empty|Error`. Their original simulated interactions are distinct from the connected workspace.

`db:setup` resets the disposable local database; do not point it at a shared or production database. Enable the test-reset endpoint only for isolated local QA runs.

## Your teams own testing

The QA workflow turns a manual handoff into reusable browser automation, feature-area child sessions, per-test evidence and Jira-linked remediation PRs.

- [Manual test workbook](qa/Wealth-Platform-Manual-QA.xlsx): 50 cases, formatted like a qTest export, not a certified qTest import.
- [Machine-readable cases](qa/cases.json) and [requirements](qa/requirements.md): stable case IDs, synthetic fixtures and real sandbox Jira links.
- [Parent–child playbook](qa/playbook.md): discovery through DeepWiki, parallel ownership, execution, triage and traceability.
- [QA tooling guide](qa/README.md): independent recordings and immutable execution attempts.
- [Presenter guide](qa/presenter.md): completed-rehearsal review, clean startup and fresh live-run launch.

Every original case must have a real browser flow and individual recording. Keep original failures and fixed reruns separately; API checks supplement visual evidence. Additional Wiki-derived tests use separate `WM-GAP-*` IDs. Remediation PRs remain unmerged so subsequent runs can exercise the original baseline.

## Layout

- `src/workspace/` — connected workflows and accessible browser controls
- `server/` — API routes, validation, database access and synthetic seeds
- `src/data.ts` — derived data for the original reference screens
- `src/model/` — view models for the shell (`shell.ts`) and each screen (`screens.ts`)
- `src/screens/` — one component per screen; `src/App.tsx` renders the header, navigation and page chrome

## Visual regression

`npm run visual-diff` screenshots every screen × data state plus scripted interaction flows in both the app and the mockup and pixel-diffs them into `visual-diff-output/`. It expects the dev server on `:5173` and the mockup folder served over HTTP (e.g. `python -m http.server 8090 -d design/mockups`). Override with `APP_URL`, `MOCK_URL`, `CHROME`, `WIDTH`, `HEIGHT`.

## Validation

Run shell-verifiable checks before merging application changes:

```sh
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:backend
npm run test:db
```

The database check uses its own disposable PostgreSQL environment. Browser QA requires the running app and follows the [QA playbook](qa/playbook.md); passing an API check is not a substitute for a recorded browser test.

## Data (PostgreSQL)

All domain data is served by the API in `server/`, backed by PostgreSQL.

`npm run db:down` stops the local database container. `npm run db:reset` reloads the schema and all
seed data. `npm run api:test` enables the loopback-only reset endpoint for local QA and should not
be used as a production command.

The workflow API is mounted at `/api/workflows`: `GET /bootstrap`, `PATCH /clients/:id`,
`POST /orders`, `POST /orders/:id/cancel`, `POST /transfers`, `PUT /allocations`,
`POST /rebalance/preview`, and `PATCH /exceptions/:id`.

See [docs/postgres-setup.md](docs/postgres-setup.md) for database configuration, Docker and local
PostgreSQL setup, database isolation, and backend tests.
