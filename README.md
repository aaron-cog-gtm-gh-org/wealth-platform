# RBC Wealth Platform

React + TypeScript + Vite implementation of the RBC Wealth Platform mockups in `design/mockups`.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

Screens are addressed with query parameters: `?screen=c360|portfolio|orders|alts|exceptions|home|activity|money` and `&state=Populated|Loading|Empty|Error`.
The workflow workspace uses `?screen=workspace&area=clients|portfolio|orders|money|rebalance|settlements`.

## Layout

- `src/data.ts` — holdings, accounts, allocation targets and settlement exceptions
- `src/model/` — view models for the shell (`shell.ts`) and each screen (`screens.ts`)
- `src/screens/` — one component per screen; `src/App.tsx` renders the header, navigation and page chrome

## Visual regression

`npm run visual-diff` screenshots every screen × data state plus scripted interaction flows in both the app and the mockup and pixel-diffs them into `visual-diff-output/`. It expects the dev server on `:5173` and the mockup folder served over HTTP (e.g. `python -m http.server 8090 -d design/mockups`). Override with `APP_URL`, `MOCK_URL`, `CHROME`, `WIDTH`, `HEIGHT`.

## Data (PostgreSQL)

All domain data is served by the API in `server/`, backed by PostgreSQL.

```sh
npm run db:up && npm run db:wait
npm run db:setup
npm run dev:full
```

`npm run db:down` stops the local database container. `npm run db:reset` reloads the schema and all
seed data. `npm run api:test` enables the loopback-only reset endpoint for local QA and should not
be used as a production command.

The workflow API is mounted at `/api/workflows`: `GET /bootstrap`, `PATCH /clients/:id`,
`POST /orders`, `POST /orders/:id/cancel`, `POST /transfers`, `PUT /allocations`,
`POST /rebalance/preview`, and `PATCH /exceptions/:id`.

See [docs/postgres-setup.md](docs/postgres-setup.md) for database configuration, Docker and local
PostgreSQL setup, database isolation, and backend tests.
