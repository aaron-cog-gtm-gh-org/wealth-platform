# Quickstart: 006 Position check

```bash
npm run db:up && npm run db:wait && npm run db:setup
PV_DEMO_PASSWORD=<synthetic> npm run pv:demo-passwords
ENABLE_TEST_RESET=1 npm run dev:full
```
- Preview (no sign-in): `http://localhost:5173/?screen=exceptions&pc=1&state=Populated` (and Loading/Empty/Error).
- Live: sign in as LBRENNAN (OPS) or PVADMIN, then `?screen=exceptions&acct=2038&stmt=2026-06-26` (seeded OPEN note) or Check all for 18-SEP-2026 (Q18 breaks on 01068-02 and 01072-01).
- ADVISER (e.g. JSMITH) gets "Not authorised for this page".
- Default ops queue: `?screen=exceptions`.

Tests: `npm run test:unit` (model), `npm run test:backend` (API incl. `/position-check/dates`), `node scripts/visual-diff.mjs app` (app-only `poscheck-*`, `flow-poscheck-*`), `node scripts/visual-diff.mjs` (everything, mockup `exceptions:*` unchanged).
