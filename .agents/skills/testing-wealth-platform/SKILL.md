---
name: testing-wealth-platform
description: Test the RBC Wealth Platform React implementation against its interactive mockup on Windows.
---

# Local surfaces
- The app is a simulated client with no login or real payment/order backend.
- Check http://localhost:5173 before starting another Vite server. From the repo, use `node node_modules/vite/bin/vite.js --port 5173 --strictPort` if needed.
- Serve the mockup with `python -m http.server 8090 -d design/mockups`; open `http://localhost:8090/RBC%20Wealth%20Platform.dc.html`.
- If the Windows Git Bash npm shim fails, invoke npm's installed `npm-cli.js` using node instead. Locate the current toolcache version rather than assuming it.
- Use `python -X utf8` when printing source containing currency, arrows, and Unicode punctuation on Windows.

# Routing and state
- App URLs accept `?screen=c360|portfolio|orders|alts|exceptions|home|activity|money&state=Populated|Loading|Empty|Error`.
- Mockup initial screen and data state are props, not the app's query parameters. The comparison runner patches their defaults in a browser response.
- UI navigation preserves app state; reloading restores seeded defaults. Browser Back/Forward changes screens, not payment wizard steps.

# Runtime visual comparison
- `node scripts/visual-diff.mjs` opens real Chromium pages for all screen/state pairs and interactive cases, then writes paired PNGs and pixel diffs in `visual-diff-output`.
- It requires the app and mockup HTTP servers. `CHROME`, `WIDTH`, `HEIGHT`, `APP_URL`, and `MOCK_URL` override defaults.
- Inspect the numeric diff output: exit 0 alone does not assert equality. Visually inspect representative pairs and every nonzero difference.
- Record the main browser UI flow separately; headless comparisons do not produce useful desktop video.

# High-signal interactions
- Orders: Microsoft Exclude clears the initial RRSP cash failure; route six orders; Include resets approval and restores failure.
- Portfolio: Bonds chip shows six positions; period changes alter both paths and return figures.
- Move money: payee changes update the checks panel; EFT/Interac limits differ from available cash. Validate blocked review, then review/edit/confirm a valid amount.
- Confirmation shows a fixed reference and tracking, not the amount. Activity is seeded demonstration data, not a persisted transaction ledger.

# Devin Secrets Needed
None for local mockup/application parity testing.

## Oracle backend

The app loads its data from the API (`server/`), which reads Oracle. Before any visual test:

1. `docker ps` — if `wealth-oracle` is not running: `npm run db:up && npm run db:wait`.
2. `npm run db:setup` to reset the schema and seed (deterministic; needed for zero-pixel diffs).
3. Start the API (`npm run api`, port 3001) **and** Vite (`npm run dev`); Vite proxies `/api`.
   `curl localhost:3001/api/health` should return `{"status":"ok"}`.
4. Without the API, every screen shows the Error state, which is expected.

`npm run test:db` checks the stack end to end in its own Testcontainers Oracle (2–3 min).
On this Windows VM, run npm scripts via `node <npm-cli.js> run <script>` (see above).
