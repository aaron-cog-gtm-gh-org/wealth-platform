# Quickstart: SWIFT domain & parsing

```sh
npm install
npm run test:domain          # Vitest: src/domain/**/*.test.ts
```

```ts
import { parseStatement, formatDate, fmtQty } from './src/domain';
const st = parseStatement(text, 'archive/mt535/MT535_0010042_20181115_001.txt');
formatDate(st.statementDate);          // '15-NOV-2018'
fmtQty(st.lines[0].qty);               // '1,660'
```

Validation: `npm run lint && npm run typecheck && npm run build && npm run test:unit && npm run test:backend && npm run test:domain`.
