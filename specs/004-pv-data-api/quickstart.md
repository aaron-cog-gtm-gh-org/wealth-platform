# Quickstart: /api/pv

```sh
npm run db:up && npm run db:setup              # creates schema pv + seed
PV_PASSWORD=... npm run pv:set-password -- LBRENNAN
PV_SESSION_SECRET=... npm run api              # builds the archive index, listens on :3001
curl -s localhost:3001/api/pv/login -H 'content-type: application/json' -d '{"username":"LBRENNAN","password":"..."}'
```

```ts
const pv = createPvClient({ token: () => sessionStorage.getItem('pvToken') });
const { rows } = await pv.positionCheck(2001, '2026-07-17');
```
