# Data model: 010 shell auth (client side; server data is spec 004)

| Entity | Fields | Notes |
| --- | --- | --- |
| StoredPvSession | `token`, `user {userId, username, fullName, role}` | `sessionStorage['pv.session']`; invalid JSON or shape → signed out |
| PvContext | `acct: number\|null`, `stmt: IsoDate\|null` | from `?acct=&stmt=`; malformed → null |
| PvPage | `page`, `label`, `roles: PvRole[]\|null`, `screen: Screen\|null` | `PV_PAGES`; null roles = any signed-in user |
| PvSliceDef<T> | `needs`, `load(api, ctx)`, `isEmpty(T)`, `preview()` | registered in `PV_SLICES[screen]` |
| PvSliceStatus | `idle \| loading \| ready(data) \| error(status, message)` | keyed by screen + ctx + token + retry nonce |
| PvResolved | `gate: signin\|forbidden\|null`, `dataState`, `data`, `preview`, `fetch` | output of `resolvePvSlice` |
| UiState (+) | `adminConfirm`, `adminBusy`, `adminNotice` | Admin reload confirmation and notice |

State transitions (session): signed-out → (login 200) signed-in → (Sign out) signed-out. Signed-in → (401 or `exp` reached) signed-out with the `expired` notice. A 403 at login → the disabled message, and the user stays signed out.
