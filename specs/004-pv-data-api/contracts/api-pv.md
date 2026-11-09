# Contract: `/api/pv/*` (spec 004)

Client: `createPvClient({ baseUrl?, token?, fetch? })` in `src/api/pv.ts`. Types are in `src/api/pv-types.ts`. Errors are returned as `{ error }` and thrown by the client as `PvApiError(status)`.

- All routes except `/login` require `Authorization: Bearer <token>` and return 401 without it.
- A route available to more roles than the caller has returns 403.
- Invalid ids or dates return 400, and unknown records return 404.

Decimals are strings, and dates are `yyyy-mm-dd`.

| Method | Path | Role | Response |
| --- | --- | --- | --- |
| POST | `/login` `{username,password}` | none | `{ token, user: { userId, username, fullName, role } }` (401 bad credentials, 403 inactive) |
| GET | `/session` | any | `{ userId, username, role, exp }` |
| GET | `/accounts` | any | `{ accounts: PvAccount[] }` ORDER BY acct_no |
| GET | `/accounts/:acctId` | any | `PvAccount` |
| GET | `/clients/search?q=` | any | `{ clients: [{ clientId, clientRef, clientName, statusCd, adviserUsername, adviserName, acctCount }] }` |
| GET | `/clients/:clientId` | any | client + adviser + `accounts` |
| GET | `/accounts/:acctId/statement-dates` | any | `{ acctId, dates }` newest first |
| GET | `/accounts/:acctId/holdings?date=` | any | `{ acctId, stmtDate, statement \| null, lines: HoldingLine[] }`; default is the latest statement |
| GET | `/accounts/:acctId/settlements?from=&to=` | any | `{ acctId, custAcct, from, to, items }`; each item is a `SettlementConfirm` + `fileName`, `instrumentName`, `amount`, `amountError` |
| GET | `/accounts/:acctId/position-check?date=` | OPS, ADMIN | `{ acctId, stmtDate, prevStmtDate, noPrevMessage, statementFile, rows: PositionCheckRow[] }` |
| PUT | `/accounts/:acctId/position-check/notes` `{isin,stmtDate,status,note?}` | OPS, ADMIN | the saved `ReconNote` (`updatedBy` = session user) |
| GET | `/position-check/all?date=` | OPS, ADMIN | `{ stmtDate, rows: [{ acctId, acctNo, client, diffs }] }` |
| GET | `/archive/files?type=MT535\|MT54x&safe=&date=` | OPS, ADMIN | `{ count, files: [{ path, fileName, msgType, date, safeCode, size }] }` |
| GET | `/archive/files/raw?path=` | OPS, ADMIN | `text/plain` raw bytes; 404 unless the path is an indexed archive file |
| GET | `/admin/stats` | ADMIN | `{ archive: { mt535Count, mt54xCount, statements, confirms, parseErrors, parseErrorLog, loadedAt, loadMs, statementAccounts, confirmFolders }, users }` |
| POST | `/admin/archive/reload` | ADMIN | same as stats, after rebuilding the index |

Server-side providers (`server/pv/context.ts`): `getIndex`, `reloadIndex`, `getInstruments`, `pgReconNotes` and `saveNote`. Screen specs should call the HTTP API rather than these.
