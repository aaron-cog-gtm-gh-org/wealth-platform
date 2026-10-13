# Sign-off: Legacy Portfolio Viewer → Wealth Platform custody migration

**Feature**: [spec.md](./spec.md) | **Quickstart**: [quickstart.md](./quickstart.md) | **Legacy behaviour/defects**: [legacy-as-built.md](./legacy-as-built.md)
**Run**: 13-Oct-2026, Windows VM, branch `devin/1791863263-legacy-pv-polish-signoff` (PR #10 into `devin/legacy-pv-integration`).
**Setup**: legacy Portfolio Viewer at `http://localhost:8080` (IIS Express + SQL Server 2022 `pvsql`, committed archive + seed,
started with `.agents/skills/running-legacy-portfolio-viewer/SKILL.md`) side by side with the new app at
`http://localhost:5173` (`npm run dev:full`, Oracle Free `wealth-oracle`, loaded by `npm run db:setup`).

## Result

All quickstart steps pass. Every legacy page was compared with its new screen for six clients (1001, 1040, 1028, 1055,
1012, 1079) plus Check All and Admin. All values match legacy, except where a documented fix applies (D-1, D-3, D-4, D-5, D-6, D-11).
The walkthrough found two cross-story integration bugs, both fixed in this PR and retested (see
[Integration findings](#integration-findings)). **No unresolved mismatches remain.** Decommissioning is a
[proposal for operations](#decommission-proposal-for-operations-to-agree) and still needs their agreement.

## Quickstart results

| Step | Command / action | Expected | Observed | Result |
|---|---|---|---|---|
| §1 | `npm run test:unit` | parser + rules cases pass | 54 passed (including this PR's format, navigation and shell tests) | pass |
| §1 | `npm run test:parity` | only D-1..D-5 deviations vs `fixtures/custody/legacy/*.json` | 5 passed, 0 failed | pass |
| §2 | `npm run db:up && npm run db:wait && npm run db:setup` | 6,044 seen / 6,044 new / 0 parse errors / 3,073 statements / 2,971 confirmations / 0 unmatched cancellations | exactly as expected. Timed run: setup 97.2 s wall, ingest 93,000 ms. Restore run: 101.6 s, 96,000 ms | pass |
| §2 | `npm run custody:migrate-legacy -- --seed data/legacy-pv/seed`, `npm run custody:ingest -- --archive data/legacy-pv/archive` | pieces run on their own; re-ingest 0 new (SC-007) | see [Re-run pieces](#re-run-pieces) | pass |
| §3 | Corrected breaks, all statement dates | 2 — 2001 `GB00ZZ011962` 2026-07-17, 2074 `GB00ZZ000908` 2026-07-31 | 2, exactly those | pass |
| §3 | Legacy-mode breaks, all dates | 7 (adds 16056/07-17, 16558/06-26 & 07-03, 10554/09-18, 11397/09-18) | 7, exactly those | pass |
| §3 | Confirmations for safe 16056 around 2026-07-14 | cancelled original not listed | not listed | pass |
| §3 | One-decimal amount `GBP21637,5` (`KS5400060214`, acct 2101) | `"21637.50"` | `"21637.50"` | pass |
| §3 | Statement 16558 / 2026-06-26 | `functionCode: "RPLC"`, `superseded: 2` | as expected | pass |
| §3 | Line for `GB00ZZ004322` (acct 2018, 2026-07-17) | custodian name, `nameVerified: false` | `Copthorne Housing PLC Ord`, `nameVerified: false` | pass |
| §3 | `/api/clients` | HH-WHITFIELD + 50 migrated clients | as expected | pass |
| §3 | `/api/custody/clients/1001/portfolio` | GBP strings, `currency: "GBP"` | GBP strings; 1001 total `360175.62` | pass |
| §3 | `PATCH` break note without `author` | 400 | 400 | pass |
| §4.1 | Header picker → legacy surname → pick (no login) | client selected | six surnames picked, no login prompt | pass |
| §4.2 | Client 360 / Portfolio | GBP totals; latest effective statement; drift/rebalance/performance "not available" | as expected for all six clients | pass |
| §4.3 | Portfolio → Custody Holdings → change date | lines and totals update | 1001: latest → 17-Jul-2026 gives GBP 203,327.79; account 2002 gives 58,920.15 | pass |
| §4.4 | Custody Settlements | default 90-day window; FOP labelled | 11-Jul-2026 → 09-Oct-2026; FOP rows "Free of payment", no cash amount | pass |
| §4.5 | Position Check → Check All 2026-07-17 → name + note-only edit | status unchanged; history shows change + name | RESOLVED kept; history shows before→after, author, `13-Oct-2026 05:23` | pass |
| §4.6 | Break source link → Message Browser | raw MT535 | `MT535_16598_20260717_001.txt` raw text; identical to the legacy file (SHA-256 `46cc644b…b6b9f5`, 3,013 bytes, CRLF kept) | pass |
| §4.7 | Custody Admin | counts match §2; Run ingest → 0 new | 3,073 / 2,971 / 6,044, 0 errors; Run #2: 6,044 seen, 0 new, 6,044 duplicate | pass |
| §4.8 | Pick HH-WHITFIELD again | CAD household screens unchanged | Client 360 / Portfolio CAD 8,555,922, 3 accounts, 25 holdings, CAD exceptions; no custody data | pass |
| §5 | Decommission sign-off | see below | proposal written; awaits operations | proposal |

### Re-run pieces

Both pieces were run on the loaded dev DB:

- `npm run custody:migrate-legacy -- --seed data/legacy-pv/seed`: exit 0, 2.6 s. Migrated 6 users, 50 clients, 120 accounts, 302 instruments, and 13 break notes.
- `npm run custody:ingest -- --archive data/legacy-pv/archive`: exit 0, 2.1 s. 6,044 seen / **0 new** / 6,044 duplicate / 0 parse errors, 3,073 statements / 2,971 confirmations / 0 unmatched cancellations (SC-007). Admin **Run ingest** also gave 0 new in the UI walkthrough.
- Afterwards, `npm run db:setup` restored a clean DB in 101.6 s. The ingest run took 96,000 ms and produced the same §2 summary, and `node scratch/quickstart-api.mjs` passed 13/13 checks.

## Performance (T054, SC-005 / SC-006)

| Measure | Target | Before | After | Notes |
|---|---|---|---|---|
| Full archive ingest (6,044 files, `custody_ingest_runs` duration) | < 2 min | 169 s | **93 s** (96 s on a repeat run) | ID counters and the known-ISIN set are now cached per run. Message + header inserts are one PL/SQL block, and each file commits with its last DML. Still one transaction per file. `recomputeDerived` takes 0.3 s. |
| `npm run db:setup` wall time (schema + seed + migration + ingest) | — | not recorded | 97 s | |
| Custody API endpoints (median of 3) | < 2 s | — | 4–335 ms | slowest: all-dates Position Check, legacy mode |
| Screens, fresh page load until data visible (max of 3, Vite dev server) | < 2 s | — | 457–1,909 ms | slowest: Position Check all accounts; most of the time is dev-mode module loading |

No index tuning was needed. The time went to per-file round trips, not queries. The existing custody indexes cover the screen query paths: `custody_statements (safe_no, statement_date)`, `custody_confirmations (safe_no, settle_date)` / `(safe_no, seme)`, `custody_messages (mt_type, business_date)` / `(content_sha256)`, `custody_accounts (client_id)`, and `custody_break_note_history (account_id, isin, statement_date)`. Re-measure
with `node scripts/custody-perf.mjs` (API + Playwright; exits non-zero when any case reaches 2 s).

## Validation commands

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm run test:unit` | 54 passed |
| `npm run test:parity` | 5 passed |
| `CUSTODY_INT=1 npm run test:int` | 3 passed (files now run serially; before, they reset the shared DB concurrently and failed) |
| `npm run test:db` | 6 checks passed (Testcontainers Oracle) |
| `npm run visual-diff` | exit 0; 80 cases rendered, 67 compared with the mockup. Household cases differ by 0.10–0.25% and flows by 0.11–0.25%; these are font/anti-aliasing noise, and `flow-picker-search` is 0.026%. Custody-client cases differ by 0.22–0.44% (worst `activity-custody`). The diff images show this is only the new **Custodian settlements** sidebar entry shifting the items below it; main content is unchanged. Position Check, Message Browser and Custody Admin have no mockup, so they are captured app-only in Populated/Loading/Empty/Error. |

## Side-by-side parity table

Legacy URLs are on `http://localhost:8080`; new URLs are on `http://localhost:5173`. Verdicts: **match**, **intentional
difference [fix D-n]** (defects from legacy-as-built §8), or **mismatch**. Each holdings and settlements row compares every
rendered ISIN, quantity, price, currency, value, and reference. In total, 71 legacy holdings rows were compared with 72 new
rows; the extra row is the D-4 RPLC restoration. 59 legacy settlement rows were compared with 58 new rows; the missing row is
the D-3 cancelled original.

| Client | Legacy page | New screen | Check | Legacy | New | Verdict |
|---|---|---|---|---|---|---|
| 1001 Penhaligon Family Trust | `ClientSearch.aspx` | header picker | identity | The Penhaligon Family Trust | same | match |
| 1001 | `ClientSummary.aspx?cid=1001` | `?client=1001&screen=c360` / `portfolio` | account totals, latest statement | GBP 283,880.39 + 76,295.23 = 360,175.62; 09-OCT-2026 | same, GBP; 09-Oct-2026 | match |
| 1001 | `Holdings.aspx?acct=2001&stmt=20260717` | `screen=custody-holdings&account=2001&date=2026-07-17` | 12 lines; total; `GB00ZZ011962` | GBP 203,327.79; 1,600 × 13.0020 = 20,803.20 | same | match |
| 1001 | `Holdings.aspx?acct=2002&stmt=20260717` | `…&account=2002&date=2026-07-17` | 4 lines; total | GBP 58,920.15 | same | match |
| 1001 | `Settlements.aspx?acct=2001&from=01/06/2026&to=31/07/2026` | `screen=custody-settlements&account=2001&from=2026-06-01&to=2026-07-31` | 9 rows | `KS5400060377` USD 9,623.03 | USD 9,623.30 | intentional difference [fix D-1] |
| 1001 | `PositionCheck.aspx?acct=2001&stmt=20260717` | `screen=position-check&acct=2001&date=2026-07-17` | genuine break | `GB00ZZ011962` +800, RESOLVED | same | match |
| 1001 | `MessageBrowser.aspx?file=MT535_16598_20260717_001.txt` | `screen=message-browser&message=2313` | raw text | file content | byte-identical (SHA-256, CRLF kept) | match |
| 1040 Mr N Oyelaran | `ClientSearch.aspx` / `ClientSummary.aspx?cid=1040` | picker / `c360` / `portfolio` | identity, totals | GBP 1,265,110.45 | same | match |
| 1040 | `Holdings.aspx?acct=2074&stmt=20260731` | `custody-holdings&account=2074&date=2026-07-31` | 12 lines; total | GBP 327,170.20 | same | match |
| 1040 | `Settlements.aspx?acct=2074&…` (Jun–Jul) | `custody-settlements&account=2074&…` | 6 rows; FOP MT544 `SETT20260626047` | 151 units, 0.00, blank currency | 151 units, "Free of payment", no amount | match (presentation only; quantity and reference same) |
| 1040 | `PositionCheck.aspx?acct=2074&stmt=20260731` | `position-check&acct=2074&date=2026-07-31` | genuine break | `GB00ZZ000908` +900, CHASED | same | match |
| 1040 | `MessageBrowser.aspx?file=MT535_14380_20260731_001.txt` | `message-browser&message=1394` | raw text | file content | same lines | match |
| 1028 Miss M Whitlock | `ClientSearch.aspx` / `ClientSummary.aspx?cid=1028` | picker / `c360` / `portfolio` | identity, totals | GBP 325,091.03 + 371,801.35 = 696,892.38 | same | match |
| 1028 | `Holdings.aspx?acct=2038&stmt=20260626` | `custody-holdings&account=2038&date=2026-06-26` | effective statement | `_003` NEWM/DUPL; 9 lines; GBP 234,569.71; `GB00ZZ003373` missing | `_002` RPLC, 2 superseded; 10 lines; GBP 247,834.71; `GB00ZZ003373` 1,250 × 10.6120 = 13,265.00 | intentional difference [fix D-4] |
| 1028 | `Settlements.aspx?acct=2038&…` (Jun–Jul) | `custody-settlements&account=2038&…` | 10 rows | — | same | match |
| 1028 | `PositionCheck.aspx?acct=2038&stmt=20260626` | `position-check&acct=2038&date=2026-06-26` | false break | `GB00ZZ003373` −1,250, OPEN | 0 breaks (legacy mode reproduces it) | intentional difference [fix D-4] |
| 1028 | `MessageBrowser.aspx?file=MT535_16558_20260626_00{1,3}.txt` | `message-browser&message=2204` / `2205` | raw text; effective source | `_003` used | `_002` RPLC used; raw texts same | intentional difference [fix D-4] |
| 1055 Mr T Underhill | `ClientSearch.aspx` / `ClientSummary.aspx?cid=1055` | picker / `c360` / `portfolio` | identity, totals | GBP 216,417.70 + 271,563.99 + 157,082.67 = 645,064.36 | same | match |
| 1055 | `Holdings.aspx?acct=2101&stmt=20260717` | `custody-holdings&account=2101&date=2026-07-17` | 9 lines; total | GBP 229,156.94 | same | match |
| 1055 | `Settlements.aspx?acct=2101&from=01/06/2026&to=31/07/2026` | `custody-settlements&account=2101&…` | one-decimal amounts | `KS5400060214` GBP 21,637.05; `KS5400061345` GBP 15,606.03 | 21,637.50; 15,606.30 | intentional difference [fix D-1] |
| 1055 | `PositionCheck.aspx?acct=2101&stmt=20260717` | `position-check&acct=2101&date=2026-07-17` | breaks | 0 | 0 | match |
| 1055 | `MessageBrowser.aspx?file=MT535_12203_20260717_001.txt` | `message-browser&message=729` | raw text | file content | same lines | match |
| 1012 Prof J Castellan | `ClientSearch.aspx` / `ClientSummary.aspx?cid=1012` | picker / `c360` / `portfolio` | identity, totals | GBP 295,859.50 + 165,768.10 = 461,627.60 | same | match |
| 1012 | `Holdings.aspx?acct=2018&stmt=20260717` | `custody-holdings&account=2018&date=2026-07-17` | 13 lines; unknown ISIN `GB00ZZ004322` | UNKNOWN INSTRUMENT, 544 × 11.0860 = 6,030.78; total 312,939.16 | "Copthorne Housing PLC Ord", flagged unverified; same numbers and total | intentional difference [fix D-5] |
| 1012 | `Settlements.aspx?acct=2018&…` (Jun–Jul) | `custody-settlements&account=2018&…` | 13 rows | `KS5400060529` GBP 23,254.08; UNKNOWN INSTRUMENT ×2 | 23,254.80; custodian name, unverified | intentional difference [fix D-1, D-5] |
| 1012 | `PositionCheck.aspx?acct=2018&stmt=20260717` | `position-check&acct=2018&date=2026-07-17` | breaks | 0 | 0 | match |
| 1012 | `MessageBrowser.aspx?file=MT535_10367_20260717_001.txt` | `message-browser&message=144` | raw text | file content | same lines | match |
| 1079 Ms R Fitzwarren | `ClientSearch.aspx` / `ClientSummary.aspx?cid=1079` | picker / `c360` / `portfolio` | identity, totals | GBP 417,596.49 + 362,898.63 + 300,525.85 = 1,081,020.97 | same | match |
| 1079 | `Holdings.aspx?acct=2145&stmt=20260717` | `custody-holdings&account=2145&date=2026-07-17` | 12 lines; total | GBP 367,659.85 | same | match |
| 1079 | `Settlements.aspx?acct=2145&…` (Jun–Jul) | `custody-settlements&account=2145&…` | cancelled original `KS5400060882` (210 units, GBP 2,237.55) | listed (12 rows) | excluded as cancelled (11 rows) | intentional difference [fix D-3] |
| 1079 | `PositionCheck.aspx?acct=2145&stmt=20260717` | `position-check&acct=2145&date=2026-07-17` | false break | `GB00ZZ001500` −210, NEW | 0 corrected; −210 in legacy mode | intentional difference [fix D-3] |
| 1079 | `MessageBrowser.aspx?file=MT535_16056_20260717_001.txt` | `message-browser&message=2042` | raw text | file content | same lines | match |
| All | `PositionCheck.aspx`, Check All 17/07/2026 | `position-check&date=2026-07-17` (corrected) | accounts with differences | 118 checked; 2001 +800, 2145 −210 | 118 checked; 2001 +800 only | intentional difference [fix D-3] |
| All | same | `…&mode=legacy` | legacy parity mode | 2001 +800, 2145 −210 | same | match |
| All | `PositionCheck.aspx` note edit (not saved in legacy) | Position Check note-only edit | status after editing the note only | Edit form defaults status to OPEN | RESOLVED preserved; only the note is sent | intentional difference [fix D-6] |
| All | `Admin.aspx` | `screen=custody-admin` | archive counts, parse errors | MT535 3,073; MT54x 2,971; 0 errors | 3,073 / 2,971 / 6,044; 0 errors | match |
| All | all pages | all custody screens | display dates | mix of `dd-MMM-yyyy` (upper case) and `dd/MM/yyyy` | `dd-MMM-yyyy`; timestamps `dd-MMM-yyyy HH:mm` (FR-023) | intentional difference [fix D-11] |

D-2 (8-digit and zero-padded safes) did not occur in the six selected clients. It is covered by the parity suite
(`npm run test:parity`) and the all-dates break counts above.

## Integration findings

| # | Finding | Fix | Retest |
|---|---|---|---|
| I-1 | Switching client on Position Check kept the previous client's `acct` (e.g. Penhaligon 2001 still shown under client 1040). | `clientSwitchLocation` (`src/model/navigation.ts`) drops client-scoped params (`acct`, `safe`, `message`, `messageId`, `page`, `date`, `account`, `from`, `to`) on every client switch. Position Check and Message Browser remount per client. Unit-tested in `src/model/__tests__/navigation.test.ts`. | pass: 1001/2001 → Oyelaran clears `acct`/`date` and shows All accounts. Account 2074 @ 31-Jul-2026 gives `GB00ZZ000908` +900 CHASED, same as legacy. |
| I-2 | Switching client on Message Browser kept the previous client's `safe=16598` and listed that client's files. | same as I-1; filters that are not client-scoped (`type`) are kept | pass: `safe`/`date`/`message` cleared, `type=535` kept (3,073 messages). Safe 14380 @ 31-Jul-2026 opens `MT535_14380_20260731_001.txt`, same lines as legacy. |
| I-3 | No sidebar entry for Custody Settlements (the "Settlement exceptions" entry opens the CAD exceptions queue). The screen was reachable only from Holdings. | "Custodian settlements" entry added next to "Custodian statements" for migrated clients (`src/model/shell.ts`). The household nav is unchanged. | pass: the entry opens Settlement confirmations (2070, 90-day default). 2074 for Jun–Jul gives 6 rows, same as legacy, including the FOP `SETT20260626047`. Switching to Castellan gives accounts 2018/2019. HH-WHITFIELD shows neither entry. |

Position Check (US3, FR-014: one account or all accounts) and Message Browser (US4: type/date/safe filters) are scoped by account or safe, not by client. So after a client switch they reset to their operations-wide view: all accounts, or all messages of the chosen type. They never keep the previous client's account or safe. To scope them to the new client's account, use the links from Holdings, Settlements or a break.

Other cross-story checks passed. The picker drives Client 360, Portfolio, Custody Holdings, and Custody Settlements. Custody
Admin is intentionally global. Holdings → Settlements and break → source message links work. HH-WHITFIELD is unchanged:
Client 360 / Portfolio CAD 8,555,922, 3 accounts, 25 holdings, CAD exceptions, no GBP or custody data. Its latency is
457 ms, and its visual-diff cases match as before.

## Open issues and limitations

- **No open mismatches.**
- The check that raw messages are byte-identical uses the API (`rawText` and `contentSha256` against the legacy archive file),
  because the browser normalises CRLF to LF in the DOM. The six walked files have identical displayed lines. The full
  6,044-file archive was checked by count and parse status, not compared file by file.
- D-2 (8-digit safes) was not among the six walked clients. It is covered by `test:parity` and the 7-break legacy-mode count.
- The HH-WHITFIELD regression proof is a runtime smoke test plus `visual-diff` against the mockup. No separate pre-migration
  pixel baseline was captured.
- The walkthrough wrote one note append on 2001 / `GB00ZZ011962` / 2026-07-17 (status kept RESOLVED) and ran incremental
  ingest run #2 (0 new). Both were then discarded by the clean `npm run db:setup`.
- Screen latencies were measured on the Vite dev server. A production build will be faster.

## Evidence

- Continuous screen recordings are attached to PR #10: the full side-by-side walkthrough, plus a retest of I-1..I-3 after the fixes.
- Paired legacy | new screenshots are embedded in the PR description: holdings 2001, D-1, D-3 (corrected and legacy mode), D-4
  (statement, source messages, false break), D-5, D-6, Check All (both modes), Admin, HH-WHITFIELD, and the I-1..I-3 before/after.
- Re-runnable checks: `node scratch/quickstart-api.mjs` (quickstart §3 API checks; not committed) and `node scripts/custody-perf.mjs`.

## Decommission proposal (for operations to agree)

> **Status: PROPOSAL.** This section has not been agreed with operations. Owners, dates and the retention period below are
> placeholders for operations and compliance to confirm.

1. **Go-live (day 0).** Deploy the Wealth Platform custody screens. Run `npm run db:setup` (or `custody:migrate-legacy` +
   `custody:ingest`) against production Oracle and confirm the §2 counts and the 2 corrected breaks before users switch.
   Publish this sign-off and the D-1..D-6/D-11 corrections to users. Expect fewer breaks (2 instead of 7) and corrected
   amounts on 240 confirmations (D-1).
2. **Legacy read-only for one full statement cycle** (one calendar month of MT535 statement dates, which covers every safe's
   weekly statements):
   - Revoke write access for `pv_app` in SQL Server: deny INSERT/UPDATE/DELETE on `RECON_NOTE` and `INSTRUMENT`. Remove
     the Admin page's reload button, or restrict Admin to read.
   - Keep the drop-folder feed going to **both** systems: the legacy `archive\` share and the new ingest archive (`$LEGACY_PV_DIR/archive`). Pick up new files on the new side with `npm run custody:ingest` or **Run ingest** after each drop.
   - All break notes are now worked in the new Position Check only. Legacy notes stay visible for reference.
   - Each week, operations compares legacy Position Check (legacy rules) with the new Position Check in `mode=legacy` for the
     latest statement date. They must agree. Any difference is raised as a defect before the cycle closes.
3. **Exit criteria (end of cycle).** Every weekly comparison agreed. Corrected-mode breaks have all been explained or
   resolved in the new app. Incremental ingest has 0 parse errors and 0 unmatched cancellations. No open migration defects.
   Operations and the custody desk sign below.
4. **Archive retention.**
   - The raw SWIFT files under `archive\` are the records of origin. Move them to the bank's records archive (read-only, WORM
     where available) for the retention period set by Records Management (placeholder: **7 years from each message date**).
   - The new platform keeps `custody_messages.raw_text` and `content_sha256` for every file. These are retrievable from
     Message Browser and verifiable against the archived originals.
   - Take a final `pvsql` database backup (`RECON_NOTE`, `INSTRUMENT`, `CLIENT`, `ACCOUNT`, `APP_USER`) and retain it with the archive.
     Then delete the plaintext `pv_app` credentials and SA password with the server (D-10).
5. **Switch-off.** Stop the IIS site and remove its DNS/shortcut. Decommission the SQL Server instance after the backup is
   verified restorable. Stop the dual feed to the legacy share.
6. **Rollback (during the read-only cycle only).** Re-grant legacy write access. Legacy keeps receiving the same files, so it
   can resume as the system of record without a data gap.

| Role | Name | Decision | Date |
|---|---|---|---|
| Operations lead | _tbd_ | | |
| Custody desk | _tbd_ | | |
| Records management (retention period) | _tbd_ | | |
