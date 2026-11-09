# Quickstart: 009 Message Browser

1. `npm run db:up && npm run db:wait && npm run db:setup`, `PV_DEMO_PASSWORD=<synthetic> npm run pv:demo-passwords`, `ENABLE_TEST_RESET=1 npm run dev:full`.
2. Design states without a session: `/?screen=messages&state=Populated|Loading|Empty|Error`.
3. Sign in as LBRENNAN (OPS): `/?screen=messages&type=535&date=18/09/2026` and `…&date=2026-09-18` both list 118 files (3 pages). Add `&safe=0010024` → 1 file. Select it → raw `{1:F01…`, path `mt535/MT535_10024_20260918_001.txt`.
4. `/?screen=messages&date=31/02/2026` → date message, no list. `/?screen=messages&file=../package.json` → "File not found.".
5. Sign in as an ADVISER → not-authorised panel; `curl` the API with that token → 403.
6. `npm run test:unit`, `test:domain`, `test:backend`, `node scripts/visual-diff.mjs` (messages cases pass, mockup counts unchanged).
