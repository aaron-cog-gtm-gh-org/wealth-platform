# Oracle setup

The Wealth Platform reads all client, portfolio, operations and portal data from Oracle Database.
The frontend never holds domain data: it calls the API in `server/`, which queries Oracle through
[`node-oracledb`](https://node-oracledb.readthedocs.io/) in **thin mode** (pure JavaScript, no Oracle
Instant Client to install).

```
Browser (Vite, :5173) ──/api──▶ Express API (:3001) ──node-oracledb thin──▶ Oracle (:1521/FREEPDB1)
```

| Path | What it is |
| --- | --- |
| `server/db/schema.sql` | DDL for platform and custody tables (re-runnable: drops the app tables first) |
| `server/db/seed.sql` | Deterministic test data: the Whitfield household, 25 holdings, 40 settlement exceptions, etc. |
| `server/db/setup.ts` | Runs the schema, seed data, legacy custody migration, and full archive ingest |
| `server/db/pool.ts` | Connection pool; configured from environment variables |
| `server/repositories/` | All SQL used by the API, grouped by domain (advisor, operations, portal) |
| `server/repositories/custody.ts` | SQL queries for custody clients, portfolios, statements, breaks, messages, and ingestion |
| `server/custody/` | SWIFT parsers, parity rules, archive ingest, legacy migration, and custody API router |
| `data/legacy-pv/` | Bundled legacy seed data and MT535/MT54x archive |
| `fixtures/custody/` | Custody parity fixtures |
| `server/app.ts` | REST routes (`/api/households/:id/...`, `/api/ops/...`, `/api/portal/...`) |
| `src/api/` | Typed API client and wire types used by the frontend |
| [`docs/custody.md`](./custody.md) | Custody data loading, archive ingest runbook, access model, and parity modes |

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `ORACLE_USER` | `wealth` | Schema owner the app connects as |
| `ORACLE_PASSWORD` | `wealth` | |
| `ORACLE_CONNECT_STRING` | `localhost:1521/FREEPDB1` | Easy Connect string, or a TNS alias |
| `API_PORT` | `3001` | Port the API listens on; Vite proxies `/api` here |

The defaults only match the throwaway test database below. Point these at a real Oracle instance
(Autonomous Database, Exadata, on-prem 19c+) for any shared environment; the schema uses only
standard Oracle types and no 23ai-specific syntax.

## Ephemeral Oracle for testing

Oracle has no embedded in-memory mode like H2 or SQLite. The equivalent for tests is a disposable
**Oracle Database Free** container: it starts in about a minute, needs no license, and with `--rm`
everything is deleted the moment it stops, so each run starts from a clean seed.

Requirements: Docker (Docker Desktop on macOS/Windows), ~3 GB of free memory, Node 20+.

```sh
npm install

# 1. Start a throwaway Oracle (gvenzl/oracle-free creates the `wealth` user in FREEPDB1)
npm run db:up          # docker run -d --rm --name wealth-oracle -p 1521:1521 ... gvenzl/oracle-free:23-slim-faststart
npm run db:wait        # blocks until the database accepts connections

# 2. Create the schema, load seed/reference data, and ingest the custody archive (about 3–5 min)
npm run db:setup

# 3. Run the API and the web app together
npm run dev:full       # API on :3001, app on http://localhost:5173

# 4. Throw the database away
npm run db:down
```

### Fast test loop (recommended)

Booting Oracle is the slow part, so do it once. Leave `wealth-oracle` running for the whole working
session and reset only the data between test runs:

```sh
docker ps --filter name=wealth-oracle   # already running? skip db:up / db:wait
npm run db:setup                        # drops, recreates, reseeds, and ingests the archive (~3–5 min)
```

`db:setup` gives the same clean, deterministic state as a fresh container, including the full custody
archive ingest, so there is no need to run `db:down` / `db:up` between tests. Stop the container only
when you are finished for the day.

On Apple Silicon Macs the image runs natively (it is multi-arch); no Rosetta flags are needed.

### Keeping the data files in RAM

To keep the datafiles in memory instead of the container's writable layer, mount a tmpfs over
the data directory. Nothing touches disk, and the database disappears when the container stops:

```sh
docker run -d --rm --name wealth-oracle -p 1521:1521 \
  --tmpfs /opt/oracle/oradata:rw,size=4g \
  -e ORACLE_PASSWORD=oracle -e APP_USER=wealth -e APP_USER_PASSWORD=wealth \
  gvenzl/oracle-free:23-slim
```

Use the plain `23-slim` tag here. The `-faststart` tags ship with a prebuilt database inside
`/opt/oracle/oradata`, and an empty tmpfs mounted on top would hide it, so the container builds a
new database on first boot (a few minutes) instead.

For custody archive commands, paths, and expected ingest results, see
[`docs/custody.md`](./custody.md).

### Automated tests with Testcontainers

`npm run test:db` (`server/db/container-check.ts`) starts its own Oracle container with
[Testcontainers](https://node.testcontainers.org/), loads the schema and seed, boots the API on a
random port, asserts on the seeded data, and removes the container. It needs only Docker, not a
database that is already running, so it suits CI. Because it boots a new database each time (2–3 min),
run it in CI or before merging, not after every change; use the fast loop above while iterating.

## Data states in the UI

- While the API request is in flight the app shows its **Loading** state; if Oracle or the API is
  unreachable it shows **Error**, and **Retry** re-issues the request.
- `?state=Loading|Empty|Error` still forces a state for design review.

## Changing the seed data

`seed.sql` is plain SQL: edit it and run `npm run db:setup` again. Keep values in step with
`design/mockups/`; `npm run visual-diff` compares the running app with the mockup pixel for pixel.
