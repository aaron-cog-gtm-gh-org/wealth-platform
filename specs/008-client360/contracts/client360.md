# Contract: Client search + custody Client 360 (spec 008)

## API (added to spec 004)
`GET /api/pv/clients/:clientId/summary` — any role.
```
{ clientId, clientRef, clientName, statusCd, createdDt, adviserUsername, adviserName,
  accounts: [{ ...PvAccount, stmtDate: IsoDate|null, mktValGbp: DecimalString|null }],   // ORDER BY acct_no
  totalMktValGbp: DecimalString|null }                                                     // Σ accounts with a statement
```
`stmtDate` = latest MT535 date for the safe code (Q8: highest file sequence for the date); `mktValGbp` = Σ `MktValGbp` of that statement's lines. 404 unknown client, 400 malformed id.

## URLs
| URL | Shows |
|---|---|
| `?screen=clients` | search box, not searched |
| `?screen=clients&q=<text>` | results for raw `<text>` (blank = all) |
| `?screen=c360` | Whitfield mockup Client 360 (unchanged) |
| `?screen=c360&cid=<id>` | custody Client 360 for the PV client |
| `…&state=Populated|Loading|Empty|Error` | forced state (signed-out Populated = preview fixture) |

`cid` and `q` are `PV_CONTEXT_KEYS`: `goPv`/`goPv` keep them, mockup `go` drops them.

## Model
- `m.clientSearch`: `{ query, searched, total, resultLabel, noResults, rangeLabel, rows[{ref,name,href,open,adviser,status,statusTone,accts}], pager[], prev, next, search(text) }`
- `m.client360`: `{ kpis[], fields[], accounts[{no,type,ccy,safe,status,opened,closed,stmt,value,links[{label,enabled,go}]}], totalLabel, total, back }`
- Links resolve via `PV_PAGES` (`Holdings.aspx`, `Settlements.aspx`, `PositionCheck.aspx`); disabled while that row's `screen` is null; Position check hidden unless `canAccess` (OPS/ADMIN).

## Visual diff
`clients-<State>`, `c360pv-<State>` (url `?screen=c360&cid=1001&state=`), flows `flow-clients-*`, `flow-c360pv-*`. Run one with `node scripts/visual-diff.mjs c360pv:Populated`.
