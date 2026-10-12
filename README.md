# RBC Wealth Platform

React + TypeScript + Vite implementation of the RBC Wealth Platform mockups in `design/mockups`.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

Screens are addressed with query parameters: `?screen=c360|portfolio|orders|alts|exceptions|home|activity|money` and `&state=Populated|Loading|Empty|Error`.

## Layout

- `src/data.ts` — holdings, accounts, allocation targets and settlement exceptions
- `src/model/` — view models for the shell (`shell.ts`) and each screen (`screens.ts`)
- `src/screens/` — one component per screen; `src/App.tsx` renders the header, navigation and page chrome

## Visual regression

`npm run visual-diff` screenshots every screen × data state plus scripted interaction flows in both the app and the mockup and pixel-diffs them into `visual-diff-output/`. It expects the dev server on `:5173` and the mockup folder served over HTTP (e.g. `python -m http.server 8090 -d design/mockups`). Override with `APP_URL`, `MOCK_URL`, `CHROME`, `WIDTH`, `HEIGHT`.

## Data (Oracle)

All domain data lives in Oracle and is served by the API in `server/` (`node-oracledb`, thin mode).
For local testing, run a throwaway Oracle Database Free container:

```sh
npm run db:up && npm run db:wait   # disposable Oracle in Docker
npm run db:setup                   # schema + seed (server/db/schema.sql, server/db/seed.sql)
npm run dev:full                   # API :3001 + app :5173
```

See [docs/oracle-setup.md](docs/oracle-setup.md) for configuration, the tmpfs (RAM-only) variant and
the Testcontainers check (`npm run test:db`).
