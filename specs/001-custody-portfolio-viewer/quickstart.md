# Quickstart: verify the Custody area

1. `npm ci && npm run db:up && npm run db:wait && npm run db:setup` (loads + parses the archive;
   expect 3,073 MT535 + 2,971 MT54x messages).
2. `ENABLE_TEST_RESET=1 npm run dev:full`; check `curl localhost:3001/api/custody/archive/status`.
3. Open `http://localhost:5173/?screen=workspace&area=custody&view=clients`, search "Penhaligon",
   open account 01001-01 → Holdings (latest date) → Position check → Settlements.
4. Save a recon note on a break; reload; confirm it persists and shows in the audit feed.
5. Parity: bring PV up (`.agents/skills/legacy-portfolio-viewer`), then
   `node scripts/legacy-parity/capture.mjs --pv http://localhost:8080 --out /tmp/pv-golden` and
   `node scripts/legacy-parity/compare.mjs --golden /tmp/pv-golden --api http://localhost:3001`;
   expect only D1/D2 divergences.
6. Shell gates: `npm run lint && npm run typecheck && npm run build && npm run test:unit &&
   npm run test:backend && npm run test:db && npm run qa:test && npm run qa -- validate-cases`.
