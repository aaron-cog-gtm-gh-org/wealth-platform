# Research: Custody area

## R1 Where PV logic runs
- **Decision**: Parse once into PostgreSQL tables (at `db:setup` and on reload) and query from there.
- **Rationale**: PV parses the whole archive in memory at startup, which is slow on the first page
  and leaves stale names (README known issues). Tables give deterministic, queryable data and
  survive restarts. **Alternative**: an in-memory index like PV. Rejected: it cannot join to
  reference data in SQL and repeats the restart issues.

## R2 Archive location
- **Decision**: Copy `archive/` from legacy-wealth-platform into `server/custody/archive/` (25 MB,
  6,044 files) unchanged. **Alternative**: env var pointing at a legacy checkout. Rejected: PV must
  be retirable and the platform must run standalone.

## R3 Legacy defects found in the data (decision: fix + document)
| ID | PV behavior | New behavior | Archive impact |
| --- | --- | --- | --- |
| D1 | `SettlementReader` compares `custAcct` to the padded-to-7 safe code exactly; confirmations sent unpadded are dropped | Compare with leading zeros stripped | 2 confirmations |
| D2 | CANC removes PREV only within the same day folder | CANC removes PREV across the whole archive | 1 cancellation |
| D3 | `ToAmount` uses `int.Parse` (overflow > 2^31) and assumes 2 dp | Shared decimal parser | none today |
Other PV quirks are preserved as-is (they are correct, just unusual): highest file seq wins;
function text (`NEWM/DUPL`, `RPLC`) is kept and displayed but not used for selection; zero-diff rows
hidden with no tolerance; previous statement = latest strictly earlier date; settlements window
(prev date + 1, stmt date] inclusive; instrument name from reference data, otherwise
"UNKNOWN INSTRUMENT <ISIN>"; MT54x missing `{5:}` trailer parses (body ends at `-}`).

## R4 Parity method
- **Decision**: Playwright captures PV's rendered tables (log in as PVADMIN) for Holdings
  (120 accounts × each date), Settlements (each account, full range 2026-04-01..2026-10-31),
  Position Check (each account × date) and Check All (26 dates), and saves normalized JSON goldens.
  `compare.mjs` requests the same data from `/api/custody` and reports diffs, classifying each one
  against `expected-divergences.json` (D1, D2 and their downstream rows).
- **Rationale**: This tests the running system rather than our reading of its code (Constitution IV),
  and it is language-agnostic.

## R5 Running PV on Linux
- Mono build + `pvsql` (mcr.microsoft.com/mssql/server:2022-latest) with db/schema + db/seed; serve
  on :8080. Debian's xsp4 crashes (Mono.Security); use xsp built from source or a small
  HttpListener host. Login PVADMIN / portfolio1. Captured as a repo skill for repeat runs.

## R6 Auth/roles and operator
- No login (the workspace has none). Recon-note edits pick an operator from PV's active OPS/ADMIN
  users (`LBRENNAN`, `PVADMIN`); `updated_by` stores the username.

## R7 Dates
- API uses ISO `YYYY-MM-DD`; UI shows dates with the workspace's existing formatter everywhere
  (resolves PV's mixed dd/MM/yyyy vs archive-date inputs).
