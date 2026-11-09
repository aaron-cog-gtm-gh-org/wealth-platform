# Data Model: Position building & reconciliation

| Entity | Fields | Legacy |
| --- | --- | --- |
| `AccountRef` | `acctId`, `safeCode` | `AccountRow` (fields read by Run) |
| `ReconNote` | `acctId`, `isin`, `stmtDate`, `status`, `note \| null`, `updatedBy \| null`, `updatedDt \| null` | `ReconNoteData.ReconNote` |
| `HoldingLine` | `isin`, `instrumentName`, `msgDescription`, `qty`, `qtyType`, `price`, `ccy`, `mktVal`, `mktValGbp`, `fileName`, `fileSeq`, `function` | Holdings.aspx row |
| `PositionCheckRow` | `isin`, `instrument`, `prevQty`, `netSettled`, `expected`, `stmtQty`, `diff`, `status`, `note`, `updatedBy`, `updatedDt` | `PositionCheckRow` |
| `PositionCheckResult` | `prevStmtDate \| null`, `noPrevMessage \| null`, `rows`, `statement \| null` | `PositionCheckResult` |
| `CheckAllRow` | `acctId`, `acctNo`, `client`, `diffs` (`-` or count) | `btnAll_Click` anonymous row |

All quantities are `Decimal` (JSON: string).
