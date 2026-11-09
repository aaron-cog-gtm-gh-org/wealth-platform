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
| PUT `/recon-notes` | `{ acctId:int, isin:12 chars, stmtDate, status: NEW\|O\|CHASED\|C\|RESOLVED\|WRITEOFF, note: ≤500, operator: active OPS/ADMIN username }`; unknown fields rejected | `{ note: {...} }`; writes `wf_audit` action `Recon note updated` |
| GET `/operators` | – | `{ operators: [{ username, fullName, role }] }` |
| GET `/messages` | `family` (MT535\|MT54x), `date`, `safe` (leading zeros ignored), `page` (50/page) | `{ total, page, files: [{ fileName, family, mtType, msgDate, safeCode, sizeBytes, parseStatus }] }` sorted by rel_path |
| GET `/messages/:fileName` | – | `{ fileName, relPath, family, raw }` (only ingested files; never builds paths from input) |
| GET `/archive/status` | – | `{ root, mt535Count, mt54xCount, statements, confirmations, parseErrors, loadedAt, loadMs }` |
| POST `/archive/reload` | – | same as status, after a reload |

UI deep links: `/?screen=workspace&area=custody&view=clients|client|holdings|settlements|check|checkall|messages|archive`
with `&client=<id>`, `&acct=<id>`, `&date=YYYY-MM-DD`, `&from=&to=`, `&file=<name>`.
