---
name: testing-wealth-platform
description: Test the Wealth Platform connected workflows and legacy mockup views with synthetic PostgreSQL data.
---

# Local surfaces
- Use Node 22 (`.nvmrc`) and Docker. On Linux, source `~/.nvm/nvm.sh` if Node is not on PATH.
- The connected workspace persists synthetic client, order, transfer, allocation, settlement and audit data through Express and PostgreSQL. It is not a production banking system; there is no live trading or payment connection.
- The original eight mockup screens remain separate, read-only/simulated surfaces. Do not mistake their local button state for persisted workspace behavior.
- Check the existing API and Vite processes before starting duplicates. Restart the API after route or repository changes.
- Serve the reference mockup separately with `python3 -m http.server 8090 -d design/mockups` only for visual parity work.

# Routing and state
- Connected routes use `?screen=workspace&area=clients|portfolio|orders|money|rebalance|settlements`.
- Legacy routes use `?screen=c360|portfolio|orders|alts|exceptions|home|activity|money&state=Populated|Loading|Empty|Error`.
- Mockup initial screen and data state are props, not the app's query parameters. The comparison runner patches their defaults in a browser response.
- Workspace mutations must survive reload and appear in the appropriate history/audit view. Legacy UI-only interactions reset on reload.
- Browser Back/Forward must keep the route and selected feature aligned.

# Runtime visual comparison
- `node scripts/visual-diff.mjs` opens real Chromium pages for all screen/state pairs and interactive cases, then writes paired PNGs and pixel diffs in `visual-diff-output`.
- It requires the app and mockup HTTP servers. `CHROME`, `WIDTH`, `HEIGHT`, `APP_URL`, and `MOCK_URL` override defaults.
- Inspect the numeric diff output: exit 0 alone does not assert equality. Visually inspect representative pairs and every nonzero difference.
- Record the main browser UI flow separately; headless comparisons do not produce useful desktop video.

# High-signal legacy interactions
- Orders: Microsoft Exclude clears the initial RRSP cash failure; route six orders; Include resets approval and restores failure.
- Portfolio: Bonds chip shows six positions; period changes alter both paths and return figures.
- Move money: payee changes update the checks panel; EFT/Interac limits differ from available cash. Validate blocked review, then review/edit/confirm a valid amount.
- Confirmation shows a fixed reference and tracking, not the amount. Activity is seeded demonstration data, not a persisted transaction ledger.

# Devin Secrets Needed
None for local mockup/application parity testing.

## PostgreSQL backend

1. Run `npm ci`, then `npm run db:up && npm run db:wait`.
2. Run `npm run db:setup` to recreate the deterministic synthetic data. This is destructive to the local sandbox, never a production migration command.
3. Start `ENABLE_TEST_RESET=1 npm run dev:full` (API `3001`, Vite `5173`). Confirm `/api/health` and `/api/workflows/bootstrap` respond before testing.
4. Reset between cases through `POST /api/test/reset`. The API must be explicitly started with `ENABLE_TEST_RESET=1`; a disabled reset is a preflight failure, not a reason to remove assertions.
5. Keep one database per child session and run its cases serially. Never share mutable test state across parallel feature-area runs.

Run `npm run typecheck`, `npm run build`, and `npm run test:db` for shell-verifiable checks. Use the approved testing agent for driving the UI; it owns its own server/browser setup.

## Manual-case QA runs

- Start with DeepWiki, then verify current source: Wiki indexing can lag the working revision.
- Use `qa/playbook.md`, `qa/cases.json` and `qa/requirements.md`; preserve the exact original 50 case IDs and Jira links.
- Require actual browser assertions and a separate video for each case/attempt. An HTTP success or a child-session link is not substitute evidence.
- Keep original failures and fixed reruns separate, with the tested revision and remediation PR. Never merge remediation fixes into the demo baseline without explicit instruction.
- Name Wiki-derived additions `WM-GAP-*` and trace them to the corresponding Jira requirement. Do not inflate the original manual-case denominator.
