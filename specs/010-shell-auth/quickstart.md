# Quickstart: 010 shell auth

1. `npm run db:up && npm run db:wait && npm run db:setup`
2. Set a synthetic local password on the active seeded users (PVADMIN, LBRENNAN, JSMITH). Choose your own value and do not commit it:
   `PV_DEMO_PASSWORD=<at least 8 chars> npm run pv:demo-passwords` (or name users: `-- PVADMIN`). For one user, use `PV_PASSWORD=… npm run pv:set-password -- JSMITH`.
3. `ENABLE_TEST_RESET=1 npm run dev:full`, then open `http://localhost:5173/?screen=admin`.

| Scenario | Expected |
| --- | --- |
| Signed out, `?screen=admin` | "Sign in to Portfolio Viewer" panel; no `/api/pv` request |
| Sign in PVADMIN | Admin with live archive counts and users; "Portfolio Viewer › Admin" nav; header `PVADMIN · ADMIN` + Sign out |
| Reload archive → Reload | figures refresh; "Archive reloaded." |
| Sign in LBRENNAN or JSMITH | "Not authorised for this page" (Admin requires the ADMIN role); no Admin nav entry. `curl` with that token to `/api/pv/admin/stats` → 403 |
| Wrong password / inactive user (e.g. TGARNER after setting one) | "Invalid user ID or password." / "Your account has been disabled. Please contact Support (ext. 4417)." |
| Restart the API without `PV_SESSION_SECRET`, then reload | "Your session has expired. Sign in again." (401 path) |
| `?screen=admin&state=Populated\|Loading\|Empty\|Error` signed out | design preview of each state |
| `?screen=c360` etc. signed out | identical to before (no PV nav, demo identity) |

Visual coverage: `node scripts/visual-diff.mjs app` (Admin + auth flows only) or run it with no arguments for everything. `UPDATE_BASELINES=1` rewrites `scripts/visual-baselines/`.
