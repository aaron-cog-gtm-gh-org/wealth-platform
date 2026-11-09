# Data model: 006 Position check

API types (spec 004, unchanged): `PvPositionCheck`, `PvPositionCheckRow`, `PvCheckAll`, `PvSaveNote`, `PvReconNote`.

`PvPositionCheckData` (slice data, `src/model/pv/position-check.ts`):
| Field | Source |
| --- | --- |
| `accounts[] {acctId, acctNo, clientName}` | `GET /accounts` |
| `acctId` | `?acct=` if it is an account, else first account |
| `dates[]` | `GET /accounts/:acctId/statement-dates` (newest first) |
| `allDates[]` | `GET /position-check/dates` (newest first) |
| `check` | `GET /accounts/:acctId/position-check?date=stmt` when `stmt ∈ dates` and no `all` |
| `all` | `GET /position-check/all?date=all` when `?all=` |

Empty ⇔ `accounts` or `allDates` is empty.

`PvContext` additions: `pc: boolean` (`pc=1`), `all: IsoDate | null`.

UI state (`src/types.ts`): `pcDate`, `pcAllDate` (picker selections before Run/Check all), `pcEdit` (ISIN in edit mode), `pcEditStatus`, `pcEditNote`, `pcBusy`, `pcNotice` (e.g. "Notes saved."), `pcError`.

`PvOp` addition: `{kind: 'saveReconNote', acctId, note: PvSaveNote}` → PUT then re-read the check; other fields of the slice data kept.
