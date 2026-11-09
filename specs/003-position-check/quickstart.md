# Quickstart: Position building & reconciliation

```sh
npm run test:domain   # unit + golden parity (holdings, 3,065 Run calls, Check All)
```

```ts
const deps = { index: buildArchiveIndex(fsArchiveSource()), instruments, notes };
const r = await runPositionCheck(deps, { acctId: 2001, safeCode: '16598' }, '2026-07-17'); // 1 RESOLVED row
```
