# Contract: Position check screen (spec 006)

## URL
| URL | Shows |
| --- | --- |
| `?screen=exceptions` | Mockup Settlement exceptions ops queue (unchanged) |
| `?screen=exceptions&pc=1` | Position check, first account, nothing run |
| `?screen=exceptions&acct=<id>[&stmt=<yyyy-mm-dd>]` | That account; runs the check when `stmt` is one of its dates |
| `?screen=exceptions&pc=1&all=<yyyy-mm-dd>` | Check all accounts for that date |
| `…&state=Populated\|Loading\|Empty\|Error` | Forced state (preview without session) |

## API (all OPS/ADMIN; 401 without session, 403 for ADVISER)
- `GET /api/pv/position-check/dates` → `{ dates: IsoDate[] }` newest first. **New in 006.**
- `GET /api/pv/accounts`, `GET /api/pv/accounts/:id/statement-dates`, `GET /api/pv/accounts/:id/position-check?date=`, `GET /api/pv/position-check/all?date=`, `PUT /api/pv/accounts/:id/position-check/notes` — spec 004, unchanged.

## View model `m.posCheck` (`buildPositionCheck`)
`title, kpis[], accountOptions[], acctValue, dateOptions[], dateValue, allDateOptions[], allDateValue, onAccount, onDate, onRun, onAllDate, onCheckAll, message, messageKind, error, showRows, rows[] {isin, instrument, prevQty, netSettled, expected, stmtQty, diff, status, note, updatedBy, updated, editing, onEdit, onCancel, onSave, …}, statusOptions, editStatus, editNote, onEditStatus, onEditNote, busy, showAll, allRows[] {acctNo, client, diffs, onView}`.

## Shell contract deltas (additive to specs/010-shell-auth/contracts/pv-shell.md)
- `PvContext` gains `pc` and `all`; `PvContextPatch` lets `goPv(screen, patch)` set/clear keys.
- `PvSliceDef.active?(ctx)`: when present and false, `pvSliceFor` returns null (existing mockup behaviour).
- `PV_PAGES` rows may carry `params` passed to `goPv` by the PV nav.
- `PvOp` gains `saveReconNote`.
