# Data model: 005 Holdings → PortfolioDetail

## Slice data (`PvHoldingsSlice`, src/model/holdings.ts)
| Field | Source | Notes |
| --- | --- | --- |
| `acct` | URL `acct` | ACCT_ID requested |
| `requested` | URL `stmt` | null → latest |
| `account` | `GET /accounts/:id` | `PvAccount`; null when 404 |
| `dates` | `GET /accounts/:id/statement-dates` | newest first |
| `holdings` | `GET /accounts/:id/holdings?date=` | `PvHoldings`; `statement: null` when not on file |

`isEmpty` = `account === null || dates.length === 0`.

## View model (`buildPvHoldings` → `m.portfolio`)
- `fields`: Acct No, Client, Safe Code, Account type, Base ccy.
- `picker`: `{ value, options: [{ value: yyyy-mm-dd, label: DD-MMM-YYYY }], onChange }`; a requested date not on file is prepended as "DD-MMM-YYYY (not on file)" (D-005-3).
- `statement`: `{ date, fn, file, seq }` or null.
- `message`: "No statement on file for this date." | "No holdings on statement." | null.
- `kpis`: Total mkt val (GBP), Holdings (lines), Non-GBP lines, Statement.
- `rows`: `{ isin, instrument, unknown, qty, qtyType, px, ccy, mv, mvGbp, gbpSrc }`.
- `total`, `totalSrc`.
