# Data model: 007 Settlements

- **PvContext (additive)**: `from?: IsoDate`, `to?: IsoDate`. Each is present only when the URL value parses as ISO or `dd/MM/yyyy`.
- **SettlementsData (slice)**: `{ kind: 'list', account: PvAccount, settlements: PvSettlements }` or `{ kind: 'pick', accounts: PvAccount[], notFound: number | null }`. Empty when the list has no items, or the picker has no accounts.
- **SettlementsModel (view model)**:
  - `kind: 'list'`: `header` (acctNo, client, safeCode, acctType, baseCcy, custAcct); `range` (from/to ISO + display, draft inputs, message); `kpis` (count, receipts, deliveries, days); `rows[]`: `{ key, trade, settle, msg: 'MT545', dir, isin, instrument, qty, amount, amountWarn, ccy, seme }` in API order.
  - `kind: 'pick'`: `notice`, `accounts[]`: `{ acctId, acctNo, client, type, safeCode, status }`.
- **UiState (additive)**: `stlFrom`, `stlTo` (draft input text or null = use window), `stlMsg` (validation message).
- **Transitions**: Show (valid) → `setPvContext({from,to})` → slice key change → Loading → Populated | Empty. Show (invalid) → `stlMsg`, no fetch. Pick account → `setPvContext({acct, from:null, to:null})`.
