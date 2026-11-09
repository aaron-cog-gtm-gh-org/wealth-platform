# Quickstart: 005 custody holdings

```bash
npm run db:up && npm run db:wait && npm run db:setup
PV_DEMO_PASSWORD=<synthetic> npm run pv:demo-passwords
ENABLE_TEST_RESET=1 npm run dev:full
```
- Design preview (no sign-in): `http://localhost:5173/?screen=portfolio&acct=2018&state=Populated` (also `Loading`, `Empty`, `Error`).
- Live: open `?screen=portfolio&acct=2018`, sign in as JSMITH, pick `02-OCT-2026`.
- Legacy edge cases: `acct=2051` (empty `ACTI//N` statements), `acct=2028&stmt=2026-07-17` (RPLC resend `_002`), `acct=2018&stmt=2026-01-02` (not on file), `acct=2018&stmt=20261002` (legacy `yyyyMMdd` deep link), `acct=9999` (unknown).
- Whitfield default: `?screen=portfolio` is unchanged.
- Checks: `npm run lint && npm run typecheck && npm run build && npm run test:unit && npm run test:domain && npm run test:backend && npm run test:db && npm run qa:test`, then `node scripts/visual-diff.mjs app` and the full `node scripts/visual-diff.mjs`.
