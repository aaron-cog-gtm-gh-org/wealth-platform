# Quickstart: 008

```sh
npm run db:up && npm run db:wait && npm run db:setup
PV_DEMO_PASSWORD=<synthetic> npm run pv:demo-passwords
ENABLE_TEST_RESET=1 npm run dev:full
```
Open `/?screen=clients`, sign in (e.g. `lbrennan`), search `penhal`, open the client. Previews without sign-in: `/?screen=clients&state=Populated`, `/?screen=c360&cid=1001&state=Populated`.

Checks: `npm run test:unit` (model), `npm run test:backend` (golden summary for every client), `node scripts/visual-diff.mjs app` (app-only cases; don't run alongside test:backend/test:db).
