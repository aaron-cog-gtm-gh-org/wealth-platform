# Contract: `?screen=settlements`

| URL param | Meaning |
| --- | --- |
| `acct` | PV `ACCT_ID` (via `parsePvContext`). Missing or unknown → account picker. |
| `from`, `to` | Inclusive settle-date window. `yyyy-mm-dd` or legacy `dd/MM/yyyy`; invalid → ignored (server default, Q15). |
| `state` | `Populated` / `Loading` / `Empty` / `Error` design states (no session needed). |

API calls (spec 004 contract, unchanged): `GET /api/pv/accounts/:acct`, `GET /api/pv/accounts/:acct/settlements?from&to` (ISO), and `GET /api/pv/accounts` for the picker. Any signed-in role.

Rendered elements used by tests: `.stl-header`, `.stl-range input[name=from|to]`, `.stl-show`, `.stl-msg`, `.stl-table tbody tr`, `.stl-pick tbody tr`.

Shell texts: Loading "Loading settlements…"; Empty "No settlements in period"; Error "Couldn't load settlements".
