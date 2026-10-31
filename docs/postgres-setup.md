# PostgreSQL setup

The API in `server/` reads legacy wealth data and workspace workflow records from PostgreSQL through
the `pg` connection pool. The Vite development server proxies `/api` to the Express API.

```
Browser (Vite, :5173) ──/api──▶ Express API (:3001) ──pg──▶ PostgreSQL (:5432)
```

| Path | What it is |
| --- | --- |
| `server/db/schema.sql` | Re-runnable DDL for legacy and workflow tables |
| `server/db/seed.sql` | Deterministic legacy wealth data |
| `server/db/workflow-seed.sql` | Deterministic Wealth Workspace data and reset script |
| `server/db/setup.ts` | Creates the configured database when needed, then loads schema and seeds |
| `server/db/pool.ts` | PostgreSQL pool and transaction helpers |
| `server/repositories/` | Legacy API queries |
| `server/workflows/` | Workflow API validation, transactions, and routes |

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://wealth:wealth@127.0.0.1:5432/wealth` | PostgreSQL connection string; setup creates this database if missing |
| `API_HOST` | `127.0.0.1` | API bind address |
| `API_PORT` | `3001` | API port |
| `WEALTH_DB_MODE` | `docker` when Docker works, otherwise `local` if PostgreSQL binaries are found | Select `docker` or `local` explicitly |
| `WEALTH_DB_TMPFS` | unset | Set to `1` to mount the Docker database data directory on tmpfs |
| `PG_BIN` | unset | Optional path to the PostgreSQL binaries directory |
| `ENABLE_TEST_RESET` | unset | Set to `1` only for local QA; enables `POST /api/test/reset` on loopback requests |

## Docker workflow

Requirements: Docker and Node.js 22 or newer.

```sh
npm install
npm run db:up
npm run db:wait
npm run db:setup
npm run dev:full
```

The database uses the `postgres:16-alpine` image. The container is named `wealth-postgres`, binds
only to `127.0.0.1`, and persists only for its running lifetime. Use `WEALTH_DB_TMPFS=1 npm run db:up`
for a RAM-backed data directory. Stop the container with `npm run db:down`; `npm run db:reset`
recreates the schema and restores both seed datasets.

Each local session can use a separate database by changing the URL database component:

```sh
DATABASE_URL=postgres://wealth:wealth@127.0.0.1:5432/wealth_mysession npm run db:setup
DATABASE_URL=postgres://wealth:wealth@127.0.0.1:5432/wealth_mysession npm run api
```

`db:setup` creates the database name from the URL if it is missing. Its name must match
`^[a-z_][a-z0-9_]{0,62}$`.

## Local PostgreSQL binaries

When Docker is unavailable, install PostgreSQL command-line binaries including `initdb` and
`pg_ctl`, then select local mode:

```sh
WEALTH_DB_MODE=local npm run db:up
npm run db:wait
npm run db:setup
npm run dev:full
```

The local data directory is `.pgdata/` and is excluded from version control. Set `PG_BIN` when the
binaries are outside `PATH` and the common install locations. Stop the local server with
`WEALTH_DB_MODE=local npm run db:down`.

## Tests

```sh
npm run typecheck
npm run build
npm run test:unit
npm run test:int
npm run test:backend
npm run test:db
```

The integration suites create and drop an isolated database named `wealth_test_<pid>_<random>` for
each test file. They use `DATABASE_URL` for the PostgreSQL server but never reuse its configured
application database. `test:db` uses Testcontainers to start a fresh PostgreSQL 16 container and
checks both legacy endpoint data and workflow bootstrap data.

For local workflow QA, `npm run api:test` runs the API with the test reset endpoint enabled. That
endpoint responds only to loopback requests and reloads workflow seed data; do not enable it on a
shared or production service.

The workflow endpoints are `GET /api/workflows/bootstrap`, `PATCH /api/workflows/clients/:id`,
`POST /api/workflows/orders`, `POST /api/workflows/orders/:id/cancel`,
`POST /api/workflows/transfers`, `PUT /api/workflows/allocations`,
`POST /api/workflows/rebalance/preview`, and `PATCH /api/workflows/exceptions/:id`.

## Data states in the UI

- While an API request is in flight the app shows its **Loading** state; if the API or database is
  unreachable it shows **Error**, and **Retry** re-issues the request.
- `?state=Loading|Empty|Error` still forces a state for design review.
