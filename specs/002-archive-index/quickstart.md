# Quickstart: Archive indexing & settlements

```sh
sha256sum -c --quiet parity/legacy-oracle/archive-manifest.sha256   # archive copy is byte-identical
npm run test:domain                                                  # unit + golden parity
```

```ts
import { buildArchiveIndex, getSettlements } from './src/domain';
import { fsArchiveSource } from './server/pv/archive-fs';
const idx = buildArchiveIndex(fsArchiveSource(), { clock: () => new Date() });
getSettlements(idx, '0016598', '2026-07-11', '2026-10-09');          // 18 confirmations
```
