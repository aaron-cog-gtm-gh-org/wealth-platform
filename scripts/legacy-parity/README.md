# Legacy parity harness (T009 / T010)

Compares the Custody API (`/api/custody`, `specs/001-custody-portfolio-viewer/contracts/custody-api.md`) to a
golden snapshot captured from the **running** legacy Portfolio Viewer.

| File | Purpose |
| --- | --- |
| `capture.mjs` | Playwright: logs into PV and captures every screen into `golden/pv-golden.json.gz` + `golden/manifest.json` |
| `compare.mjs` | Fetches the same keys from the API, diffs, classifies, writes `report/report.json` + `report/report.md` |
| `expected-divergences.json` | Intentional diffs (D1, D2 and their downstream position-check rows; D3 one rule per affected settlement amount) with the archive messages behind them |
| `lib/normalize.mjs`, `lib/diff.mjs` | PV display → contract values; pure diff/classify/render logic |
| `test/compare.test.mjs` | Golden-vs-mutated-golden tests (run by `npm run test:unit` / `npm run test:parity`) |

```bash
# PV running on :8080 (.agents/skills/legacy-portfolio-viewer/SKILL.md)
npm run parity:capture                      # [--pv http://localhost:8080] [--out dir] [--concurrency 6]
# API running on :3001
npm run parity:compare -- --golden scripts/legacy-parity/golden --api http://localhost:3001
```

`parity:compare` exits 0 when every diff matches a rule in `expected-divergences.json`, 1 on any unexplained diff,
2 on errors. Expected rules that never match are listed under "Expected rules not observed" (the API still behaves
like PV for that case) but do not fail the run. `--api-snapshot <file>` compares a saved golden-shaped snapshot
instead of calling the API.

## Golden shape (`pv-golden/1`)

Dates are ISO `YYYY-MM-DD`, quantities/amounts are numbers, field names are the contract's.

| Key | Captured from | Granularity |
| --- | --- | --- |
| `archive` | Admin.aspx | `mt535Count`, `mt54xCount`, `statements`, `confirmations`, `parseErrors` |
| `accounts`, `statementDates` | Position Check + Holdings date list | every account; its statement dates newest first |
| `clientSearch` | Client Search | 12 queries (all, name fragments, ref prefixes, no match) |
| `clientSummaries` | Client Summary | every client + its accounts |
| `holdings` | Holdings | every account × statement date: `lines[]`, `totalGbp` |
| `settlements` | Settlements | every account, 2026-04-01..2026-10-31 |
| `positionChecks` | Position Check | every account × statement date: break `rows[]`, `message` (`No previous statement on file.`) |
| `checkAll` | Position Check → Check All | 26 dates: per account `breaks` (`null` = no previous statement) |

Comparison rules: rows are keyed (holding/position rows by ISIN, settlements by SEME, check-all by acctId, clients
by clientId); numbers match within ±0.005 (`--tolerance`, PV's 2 dp display rounding); safe codes compare with
leading zeros stripped; `mtType` `"MT545"` ≡ `545`; API fields PV does not show (`fileName`, `qtyType`,
`newBreaks`, …) are ignored, but a PV field missing from the API is a `field-missing` diff.
