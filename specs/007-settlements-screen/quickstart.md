# Quickstart: 007 Settlements

1. `npm run db:up && npm run db:wait && npm run db:setup`, `PV_DEMO_PASSWORD=<synthetic> npm run pv:demo-passwords`, then `ENABLE_TEST_RESET=1 npm run dev:full`.
2. Sign in as `JSMITH` and open `/?screen=settlements&acct=2001`. Expect the window `11-JUL-2026` – `09-OCT-2026` with 18 rows, newest first. The first row is MT547 DEL `XS00ZZ014941`, amount `11,524.08` (raw `GBP11524,8`, Q10).
3. Set From `2026-09-01`, To `2026-09-30`, then Show. The URL gains `from`/`to` and only September rows are listed.
4. `/?screen=settlements&acct=2001&from=01/09/2026&to=30/09/2026` gives the same result (legacy deep link).
5. Type `31/02/2026` and Show: "Enter dates as yyyy-mm-dd.".
6. `/?screen=settlements`: the account picker. `&acct=9999`: "Account 9999 was not found."
7. `?screen=settlements&state=Populated|Loading|Empty|Error` without signing in.
8. Run `npm run test:unit` and `npm run visual-diff` (cases `settlements-*`, `flow-settlements-*`).
