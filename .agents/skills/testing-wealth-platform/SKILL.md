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

# Custody versus legacy Portfolio Viewer
- Reuse running services and loaded custody data when requested; do not run `db:setup` just for comparison, since it resets the database.
- Legacy IIS Express is normally at `http://localhost:8081/Login.aspx`. Authenticate with credentials supplied for the local database; do not assume production or seed passwords.
- Legacy deep links: `Holdings.aspx?acct=<accountId>&stmt=<yyyyMMdd>` and `PositionCheck.aspx?acct=<accountId>&stmt=<yyyyMMdd>`. The latter runs the check on load; do not edit reconciliation notes merely to verify parity.
- In the new app, numeric `?client=<clientId>&screen=portfolio|c360` selects custody; omit `client` for the default HH-WHITFIELD regression check.
- Compare a historical legacy holdings page with `/api/custody/accounts/<id>/statements/<yyyy-MM-dd>`, not with the client Portfolio adapter: `/api/custody/clients/<id>/portfolio` uses each account's latest effective statement.
- `/api/custody/position-checks?accountId=<id>&date=<yyyy-MM-dd>` defaults to corrected rules; append `&mode=legacy` for legacy rules. A sample with identical results does not prove the modes diverge correctly on other inputs.
- Open JSON routes directly in Chrome. Pretty-print and browser Find provide readable evidence without using the developer console to fetch authenticated data.
- Chrome zoom can apply across localhost ports. Restore 100% for the modern frontend after enlarging legacy/JSON text.
- If a selected-client screen goes blank after loading, capture the console exception and the default-client regression independently. Working custody JSON is not proof that its existing UI renders correctly.

# Devin Secrets Needed
None for local mockup/application parity testing. Legacy Portfolio Viewer login uses a password set only in the local `pvsql` container; never store it here.

## Oracle backend

The app loads its data from the API (`server/`), which reads Oracle. Before any visual test:

1. `docker ps` — if `wealth-oracle` is not running: `npm run db:up && npm run db:wait`.
2. `npm run db:setup` to reset the schema and seed (deterministic; needed for zero-pixel diffs).
3. Start the API (`npm run api`, port 3001) **and** Vite (`npm run dev`); Vite proxies `/api`.
   `curl localhost:3001/api/health` should return `{"status":"ok"}`.
4. Without the API, every screen shows the Error state, which is expected.

Reuse one Oracle container: never stop/restart `wealth-oracle` between test runs. `npm run db:setup`
(~3 min: includes legacy migration + the 6,044-file custody archive ingest) restores the deterministic seed, which is all a fresh container would give you.

`npm run test:db` checks the stack end to end in its own Testcontainers Oracle (2–3 min). Run it once
at the end (or in CI), not per iteration. If it hangs:
- After "Pulling image testcontainers/ryuk": the Docker credential helper is stuck; run
  `docker pull testcontainers/ryuk:0.11.0` and retry.
- At "Acquiring lock file": an earlier run is still alive (`kill_shell` does not kill its node
  child). Stop node processes whose command line contains `container-check`, then retry.
On this Windows VM, run npm scripts via `node <npm-cli.js> run <script>` (see above).

## Custody parity walkthrough notes

### Reliable browser evidence

- CDP Playwright connections can reuse the headed Chrome tabs. Discover the live debug port; do not assume a fixed port between sessions.
- Client switching and custody requests have successive async loading states. `waitForLoadState('networkidle')` alone may return for an earlier document lifecycle. Wait for the selected client's identity, the requested account/date, and meaningful loaded content (e.g. Holdings `Total (GBP)`, Position Check's loading test ID hidden, or the expected message file). Check that screenshots contain data rather than a skeleton.
- The message-list filename is rendered with a directory prefix such as `mt535/`. Locate the actual rendered text, not just the basename.
- Break-note history closes with accessible name `Close history`. A note-only QA edit should include an author, preserve the original status, and be checked in the history drawer. Record the mutation in the report; do not silently erase audit history afterward.
- Header selection should be verified by data ownership, not just `client=` in the URL. Position Check uses `acct`, Holdings/Settlements use `account`, and Message Browser uses `safe`/`message`; check stale parameters when switching clients. Global Admin counts should not become client-scoped. Switching client clears these scope params and remounts Position Check / Message Browser (`clientSwitchLocation` in `src/model/navigation.ts`).
- Legacy Check All is a POST-backed page: record the selected date as evidence because the URL may not include it.
- Full-page Message Browser screenshots may put raw text below a long list. For comparison images, crop a clearly labelled message-detail excerpt from the original screenshot and retain the full original.

### Raw-message comparison

- Legacy `<pre>.textContent` may retain CRLF while React/browser display text normalizes to LF. Compare visible lines separately from exact strings, report the distinction, and do not claim byte-for-byte preservation without comparing original downloads.
- Keep raw SWIFT and filenames unchanged when evaluating display-date formatting; native date inputs and free-text notes are also not display-date formatter outputs.

### Windows attachments

- If `upload_attachment` rejects a Windows drive-qualified absolute path, a drive-rooted forward-slash path such as `/Users/Administrator/repos/.../image.png` can resolve on the Windows box. Keep full `C:\...` paths in deliverables and reports.
