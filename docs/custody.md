# Custody data

Custody is the legacy Portfolio Viewer’s SWIFT holdings and settlement data, stored separately from
the platform’s simulated demo data in Oracle `custody_*` tables. MT535 statements and MT544–547
confirmations feed the custody views in Client 360 and Portfolio, as well as Custody Holdings,
Custody Settlements, Position Check, Message Browser, and Custody Admin.

## Loading the data

`npm run db:setup` recreates the schema and standard seed, migrates the legacy reference data, then
ingests the full archive. The migration loads users without password hashes, clients, accounts,
instruments, and 13 break notes from `data/legacy-pv/seed`; the archive ingest loads 6,044 files:
3,073 statements and 2,971 confirmations. The expected initial summary is 0 parse errors and 0
unmatched cancellations. The full setup takes about 3–5 minutes because of the archive ingest.

The migration and archive ingest can also be run separately:

```powershell
npm run custody:migrate-legacy -- --seed <dir>
npm run custody:ingest -- --archive <dir>
```

Without explicit directories, the seed and archive default to `data/legacy-pv/seed` and
`data/legacy-pv/archive`. Set `LEGACY_PV_DIR` to a different root to use its `seed` and `archive`
subdirectories. Re-ingesting an unchanged archive is idempotent: unchanged files are skipped and
the next run reports 0 new files.

## Archive ingest runbook

Drop statement files at
`<archive>/mt535/MT535_<safe>_<yyyyMMdd>_<seq>.txt`. Drop confirmation files at
`<archive>/mt54x/<yyyyMMdd>/MT54n_<safe>_<yyyyMMdd>_<seq>.txt` (`n` is 4, 5, 6, or 7). The bundled
archive root is `data/legacy-pv/archive`.

Run `npm run custody:ingest` after a file drop, or use **Run ingest** on Custody Admin
(`POST /api/custody/admin/ingest-runs`). An unchanged file at an already-ingested path is skipped.
The path and bytes are treated as immutable: changed bytes at an ingested path raise
`IngestConflictError` (HTTP 409). Keep the original and submit a corrected message under a new
filename/sequence. Only one ingest can run at a time; a concurrent request also returns HTTP 409.

Custody Admin lists parse errors with the source filename and parser message. Inspect and correct
the source, then ingest the correction as a new file path; editing an already-ingested file in place
will be rejected as a conflict. Ingestion is manual (CLI or Custody Admin); there is no scheduled
archive watcher (R-8).

## Access and legacy parity

The custody UI and API have no login or client-level authorization: anyone who can reach the app can
select any client. `custody_users` and legacy roles are reference data only, not access controls.
Break-note authors are names typed by the user, not authenticated identities. Do not carry forward
the legacy security defects in D-10.

Position Check has a mode toggle and the API accepts
`GET /api/custody/position-checks?date=2026-07-17&accountId=2001&mode=legacy|corrected`. The default
is `corrected`. Corrected rules fix the data-parity defects: D-1 parses one-decimal amounts
correctly; D-2 matches safes numerically, including 8-digit safes; D-3 applies cancellations across
archive day folders; and D-4 prefers effective RPLC/NEWM statements over superseded DUPL files.
D-5 keeps custodian names for unknown ISINs instead of replacing them with `UNKNOWN INSTRUMENT`.
D-6 is a UI correction: editing a note preserves its selected status and only sends fields that
changed. On the reference archive, legacy mode reports 7 breaks and corrected mode reports the 2
genuine breaks: account 2001 / `GB00ZZ011962` and account 2074 / `GB00ZZ000908`.

| Legacy page | New screen |
| --- | --- |
| Client Search | Header client picker |
| Client Summary | Client 360 (`c360`) |
| Holdings | Portfolio (`portfolio`) and Custody Holdings (`custody-holdings`) |
| Settlements | Custody Settlements (`custody-settlements`) |
| Position Check | Position Check (`position-check`) |
| Message Browser | Message Browser (`message-browser`) |
| Admin | Custody Admin (`custody-admin`) |

Custody screens display dates as `dd-MMM-yyyy` (and timestamps as `dd-MMM-yyyy HH:mm`); API date
parameters and values use `YYYY-MM-DD`. Native date inputs retain the browser’s date display.
