# Data Model: SWIFT domain & parsing

| Entity | Fields (TS) | Legacy | Notes |
| --- | --- | --- | --- |
| `Decimal` | `units: bigint`, `scale: number` | `System.Decimal` | value = units/10^scale; `toString()`/`toJSON()` canonical, trailing zeros stripped |
| `IsoDate` | `string` `YYYY-MM-DD` | `DateTime` (date part) | `MIN_DATE` = `0001-01-01` |
| `SwiftField` | `tag`, `raw`, get `content`, get `qualifier` | `SwiftField` | |
| `SwiftMessage` | `mtType` (0 default), `senderLT`, `fields[]`, `fileName`; `find`, `findAll`, `blocks` | `SwiftMessage` | |
| `Mt535Statement` | `function`, `statementDate`, `safekeepingAcct`, `lines[]`, `fileName`, `fileSeq` | `Mt535Statement` | |
| `Mt535Line` | `isin`, `msgDescription`, `price`, `qty`, `qtyType`, `ccy`, `mktVal`, `mktValGbp` | `Mt535Line` | decimals default 0, strings null |
| `SettlementConfirm` | `mtType`, `seme`, `prev`, `function`, `tradeDate`, `settleDate`, `isin`, `qty`, `custAcct`, `amountRaw`, `ccy`, `direction`, `filePath`, `folder` | `SettlementConfirm` | `direction` `'REC' \| 'DEL'` |

Validation: none beyond legacy parsing (malformed input throws exactly where legacy throws).
