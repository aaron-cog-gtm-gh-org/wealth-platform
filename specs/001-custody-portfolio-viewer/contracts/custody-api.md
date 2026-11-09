# Contract: `/api/custody` (JSON; dates ISO `YYYY-MM-DD`; errors `{ "error": string }` 400/404)

| Method & path | Query/body | Response |
| --- | --- | --- |
| GET `/clients` | `q` (optional, ≤100 chars; name contains OR ref prefix, case-insensitive) | `{ clients: [{ clientId, clientRef, name, status, adviserUsername, adviserName, accountCount }] }` sorted by name |
| GET `/clients/:clientId` | – | `{ client: {...}, accounts: [{ acctId, acctNo, acctType, baseCcy, safeCode, openDate, closeDate, status }] }` |
| GET `/accounts` | – | `{ accounts: [{ acctId, acctNo, clientId, clientName, safeCode, status }] }` sorted by acctNo |
| GET `/accounts/:acctId/statements` | – | `{ dates: string[] }` newest first |
| GET `/accounts/:acctId/statements/:date` | – | `{ account, statement: { statementDate, function, fileSeq, fileName }, lines: [{ isin, instrument, qty, qtyType, price, ccy, mktVal, mktValGbp }], totalGbp }`, 404 "No statement on file for this date." |
| GET `/accounts/:acctId/settlements` | `from`, `to` (default: latest stmt date − 90 d .. latest stmt date; from ≤ to) | `{ from, to, settlements: [{ tradeDate, settleDate, mtType, direction, isin, instrument, qty, amount, ccy, seme, fileName }] }` newest first |
| GET `/accounts/:acctId/position-check/:date` | – | `{ statementDate, previousStatementDate \| null, message \| null, rows: [{ isin, instrument, prevQty, netSettled, expected, stmtQty, diff, status, note, updatedBy, updatedAt }] }` sorted by ISIN |
| GET `/position-check/:date` | – | `{ statementDate, accounts: [{ acctId, acctNo, clientName, breaks, newBreaks, previousStatementDate }] }` (accounts with a statement on the date) |
| GET `/statement-dates` | – | `{ dates: string[] }` all distinct, newest first |
| PUT `/recon-notes` | `{ acctId:int, isin:12 chars, stmtDate, status: OPEN\|CHASED\|RESOLVED\|WRITEOFF, note: ≤500, operator: active OPS/ADMIN username }`; unknown fields rejected | `{ note: {...} }`; writes `wf_audit` action `Recon note updated` |
| GET `/operators` | – | `{ operators: [{ username, fullName, role }] }` |
| GET `/messages` | `family` (MT535\|MT54x), `date`, `safe` (leading zeros ignored), `page` (50/page) | `{ total, page, files: [{ fileName, family, mtType, msgDate, safeCode, sizeBytes, parseStatus }] }` sorted by rel_path |
| GET `/messages/:fileName` | – | `{ fileName, relPath, family, raw }` (only ingested files; never builds paths from input) |
| GET `/archive/status` | – | `{ root, mt535Count, mt54xCount, statements, confirmations, parseErrors, loadedAt, loadMs }` |
| POST `/archive/reload` | – | same as status, after a reload |

Refinements (implemented in `server/custody/{routes,repository,validation}.ts`):
- Unknown or repeated query parameters → 400. IDs are positive integers (400 otherwise); unknown account/client → 404
  `Account not found.` / `Client not found.`; invalid dates (`2026-02-30`) → 400.
- `status` is a display word: clients `Active|Dormant|Closed`, accounts `Open|Closed`. `acctType` is right-trimmed (`SIPP `).
- `/clients?q=` treats `%`/`_` literally. `/position-check/:date` with no statements on that date → 200 with `accounts: []`.
- Settlements: either bound may be given; the other defaults from the 90-day window (`to` defaults to the latest statement
  date, `from` to `to` − 90 d). `amount` is `null` when the MT54x has no `19A::SETT` (PV displayed 0; D3).
- `updatedAt` (position-check rows, recon note) is an ISO-8601 UTC timestamp or `null`; recon status is returned verbatim
  (historic `O`/`C`/`NEW` included).
- `PUT /recon-notes`: `operator` is case-insensitive and stored upper-case; `note` is trimmed (may be empty); the account must
  have a statement on `stmtDate` (404 otherwise). Response `{ note: { acctId, isin, stmtDate, status, note, updatedBy, updatedAt } }`.
  `wf_audit`: action `Recon note updated`, entity = account number, detail `<acctNo> <isin> statement <date> by <user>: Status <old|NEW> → <new>[; Note: <text>]`.
- `/messages`: `safe` is digits only (≤10); `page` 1–99999; `parseStatus` is `ok|error|pending`.
- `/messages/:fileName`: `[A-Za-z0-9_.-]{1,64}` (400 otherwise), looked up by `file_name` only; 404 `Message not found.`
- `POST /archive/reload`: body must be empty or `{}`. Re-syncs `server/custody/archive`, parses only new/changed files and appends
  a `custody_archive_loads` row in one transaction (advisory-locked); writes `wf_audit` action `Custody archive reloaded`.
- `/archive/status`: `loadedAt` ISO timestamp, `loadMs` covers archive load + parse; both `null` before any load.

UI deep links: `/?screen=workspace&area=custody&view=clients|client|holdings|settlements|check|checkall|messages|archive`
with `&client=<id>`, `&acct=<id>`, `&date=YYYY-MM-DD`, `&from=&to=`, `&file=<name>`.
