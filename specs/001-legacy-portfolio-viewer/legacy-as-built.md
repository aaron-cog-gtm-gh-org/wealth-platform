# Legacy Portfolio Viewer — As-Built Reference

**Source**: [`aaron-cog-gtm-gh-org/legacy-wealth-platform`](https://github.com/aaron-cog-gtm-gh-org/legacy-wealth-platform)
(`main`, read 2026-10-12) | **Used by**: [spec.md](./spec.md), [research.md](./research.md)

Nobody who built Portfolio Viewer is still on the team. This document records what the system
*actually does*, reconstructed from its source, schema, seed data, tests and the committed SWIFT
archive. Every defect listed in §8 was reproduced against the committed data
(see §9 for method). It is a reference for the migration, not a design for the new system.

## 1. Purpose and users

Portfolio Viewer is an internal, read-mostly web app used by a UK wealth business to look at client
holdings and settlements as reported by its custodian (sender `KSSLGB2LXXX`) via SWIFT, and to
reconcile custodian positions week over week. The custodian is the book of record; the app holds no
positions of its own — only reference data (users, clients, accounts, instruments) and
reconciliation notes.

| Role | Seed users | Can use |
|------|-----------|---------|
| `ADVISER` | JSMITH, LBRENNAN (active); RMCKAY, DHOLT (inactive) | Client Search, Client Summary, Holdings, Settlements |
| `OPS` | OPSUSER | Above + Position Check, Message Browser |
| `ADMIN` | PVADMIN | Everything + Admin |

Advisers are **not** scoped to their own clients: any adviser can open any client.

## 2. Architecture

```text
Browser ──Forms auth──▶ PV.Web (ASP.NET Web Forms, .NET 4.8, IIS Express :52310)
                         ├─ PV.Core  (SWIFT parser, ArchiveIndex, PositionBuilder,
                         │            SettlementReader, PositionCheck)  ──▶ archive\ (flat files)
                         └─ PV.Data  (ADO.NET SqlHelper)               ──▶ SQL Server "PortfolioViewer"
```

- **Archive** (`archive\`, `ArchiveRoot` in `Web.config`): read-only SWIFT FIN text files dropped by
  an external job. Parsed **entirely into memory** at app start (`Global.asax`) into
  `ArchiveIndex.Current`; rebuilt only by app-pool recycle or *Admin → Reload archive*.
- **Database** (`db/schema`, SQL Server 2008 R2 compat level 100): `APP_USER`, `CLIENT`, `ACCOUNT`,
  `INSTRUMENT`, `RECON_NOTE`; procs `usp_GetUserByName`, `usp_SetLastLogin`, `usp_ClientSearch`.
- **Build/test**: `build.bat` (MSBuild + NUnit 2.6.4 console). VS 2013–2017 era tooling.

## 3. Data

### 3.1 Archive layout and volumes (committed data)

| Path pattern | Files | Content |
|---|---|---|
| `archive\mt535\MT535_<safe>_<yyyyMMdd>_<seq>.txt` | 3,073 | Weekly (Friday) statements of holdings, 2026-04-17 → 2026-10-09, 26 statement dates, 120 safekeeping accounts (all match `ACCOUNT.SAFE_CODE`), 30,731 holding lines |
| `archive\mt54x\<yyyyMMdd>\MT54n_<safe>_<yyyyMMdd>_<seq>.txt` | 2,971 | Settlement confirmations: MT545 1,496 · MT547 1,298 · MT544 112 · MT546 65 (10 are cancellations) |

`<safe>` is the custodian safekeeping account; `<seq>` (`_001`, `_002`…) distinguishes re-sends.

### 3.2 Reference schema (SQL Server)

| Table | Key columns | Seed rows | Notes |
|---|---|---|---|
| `APP_USER` | `USER_NAME`, `PWD_HASH` (SHA-1 hex, unsalted), `ROLE`, `IS_ACTIVE`, `LAST_LOGIN` | 6 | 3 users share one hash |
| `CLIENT` | `CLIENT_ID`, `CLIENT_REF`, names, `ADVISER_ID`→`APP_USER`, `STATUS` | 50 | 3 clients have no adviser; 7 belong to inactive advisers |
| `ACCOUNT` | `ACCOUNT_ID`, `CLIENT_ID`, `SAFE_CODE` (unpadded, e.g. `10554`), `ACCOUNT_TYPE`, `CCY`, `OPEN_DATE`, `CLOSE_DATE` | 120 | All GBP; 2 closed; free-text types (`ISA`, `S&S ISA`, `Stocks & Shares ISA`, `GIA`…, `SIPP ` with trailing space) |
| `INSTRUMENT` | `ISIN`, `NAME`, … | 302 | Name lookup only; cached for app lifetime |
| `RECON_NOTE` | (`ACCOUNT_ID`, `ISIN`, `STMT_DATE`) unique, `STATUS`, `NOTE`, `UPDATED_BY`, `UPDATED_AT` | 13 | Older rows use legacy codes `O`/`C` |

## 4. Screens and functional behavior

| Page | Roles | Behavior |
|---|---|---|
| `Login.aspx` | all | Username/password → `usp_GetUserByName`; SHA-1 compare; rejects inactive users; sets Forms auth cookie + `Session["User"]`; updates `LAST_LOGIN`. |
| `ClientSearch.aspx` | all | Search by surname/forename/`CLIENT_REF` (`usp_ClientSearch`, LIKE); 25 rows/page; last search kept in session. `?err=1` shows "not authorised". |
| `ClientSummary.aspx` | all | Client header, adviser, status; accounts grid with latest statement date and **GBP** market value per account; grand total. |
| `Holdings.aspx` | all | Statement-date dropdown (newest first); per line: ISIN, name (from `INSTRUMENT`), quantity, price, ccy, market value, GBP value; totals. Messages: *No statement on file for this date* / *No holdings on statement*. |
| `Settlements.aspx` | all | Confirmations for the account, default window = 90 days ending at latest statement; `dd/MM/yyyy` From/To; columns: MT type, direction (`REC`/`DEL`), trade/settle date, ISIN, qty, amount, ccy, `SEME`. Cancelled confirmations hidden. |
| `PositionCheck.aspx` | OPS, ADMIN | For an account and statement date: every ISIN where *previous statement qty + net settled qty ≠ current statement qty*. "Check All" runs every account. Inline edit of status (`OPEN`/`CHASED`/`RESOLVED`/`WRITEOFF`) and note, saved to `RECON_NOTE` with session user. |
| `MessageBrowser.aspx` | OPS, ADMIN | Filter archive files by type/date/safe; view raw message text (HTML-encoded), looked up by index (no path traversal). |
| `Admin.aspx` | ADMIN | Archive root, file/statement/confirmation counts, parse errors, load time; *Reload archive* (rebuilds index + clears instrument cache); user list. |

Unauthenticated → `Login.aspx`; wrong role → `ClientSearch.aspx?err=1`.

## 5. SWIFT parsing rules (as implemented in `PV.Core`)

- Block 2 gives MT type; block 4 split on lines starting `:`; continuation lines appended.
- Decimals: `,` replaced by `.`, parsed invariant (`SwiftParser.ParseDecimal`).
- **MT535** — `23G` function (`NEWM`, `RPLC`, `NEWM/DUPL`); `98A::STAT` date; `97A::SAFE`
  safekeeping (normalised with `TrimStart('0')`); per `16R:FIN` block: `35B` ISIN + description,
  `90A`/`90B` price, `93B::AGGR` quantity (`UNIT`/`FAMT`), `19A::HOLD` market value(s) incl. a GBP
  value used for totals. `SUBSAFE` sub-blocks are flattened.
- **MT54x** — `20C::SEME` reference, `20C::PREV` (on cancellations), `23G` (`NEWM`/`CANC`),
  `98A::TRAD`, `98A::SETT`, `35B`, `36B::ESTT` qty, `97A::SAFE` (kept zero-padded), `19A::ESTT`
  amount (absent on free-of-payment MT544/546). Direction: 544/545 → `REC`; 546/547 → `DEL`.

## 6. Core business rules

| ID | Rule | Code |
|---|---|---|
| BR-1 | Statement for (account, date): if several files, **highest `<seq>` wins** (function code ignored). | `PositionBuilder.GetStatement` |
| BR-2 | Statement lookup key = `SAFE_CODE` with leading zeros stripped. | `ArchiveIndex` |
| BR-3 | Confirmation lookup key = `SAFE_CODE.PadLeft(7,'0')`, exact string match. | `SettlementReader` |
| BR-4 | A `CANC` removes the active confirmation whose `SEME` = its `PREV`, **within the same day folder only**. | `SettlementReader` |
| BR-5 | Amount = text after 3-char ccy; integer part + (fraction part as integer)/100. | `SettlementReader.ToAmount` |
| BR-6 | Reconciliation window = settle dates in (previous statement date, statement date]. | `PositionCheck` |
| BR-7 | Expected qty = previous qty + Σ REC qty − Σ DEL qty; every non-zero difference is a break (tolerance commented out). | `PositionCheck` |
| BR-8 | Rows without a note default to status `NEW`; result sorted by ISIN. | `PositionCheck` |
| BR-9 | Instrument name from `INSTRUMENT`; if missing → `UNKNOWN INSTRUMENT <isin>` (the SWIFT `35B` description is ignored). | `PositionBuilder` |
| BR-10 | Corporate actions (bonus, splits) arrive only as statement quantity changes with no MT54x; ops record them as manual notes. | `PositionCheck` TODO (2017) |

## 7. Data variations observed in the archive

- **Custodian format change around 2026-07**: `SEME` prefix `STMT…` → `KS535…`; statements wrapped in
  a single `SUBSAFE` block (1,759 files); new `98A::PRIC`, `93B::AVAI`, `94B` fields; block 3 `{108:}`;
  396 August files are LF-only (159 MT535, 237 MT54x) and 80 August MT535 files mix CRLF and LF; MT54x amounts from 2026-07-01 can have **one** decimal
  place (240 files).
- **Re-sends**: 4 `RPLC` and 2 `NEWM/DUPL` statements, plus identical `NEWM` resends
  (13483/2026-08-14, 16839/2026-08-07).
- **Padding**: 4 MT535 files carry an unpadded 5-digit safe; 2 MT54x carry an 8-digit safe
  (`00011397`, `00010554`).
- **Quantities**: 254 MT54x use `FAMT` (bond face amount), rest `UNIT`.
- **Instruments**: 4 ISINs in statements not in `INSTRUMENT`: `GB00ZZ004322` (73 lines),
  `IE00ZZ014078` (52), `US00ZZ008623` (30), `GB00ZZ007929` (4).
- **Empty statements**: 31 statements with `17B::ACTI//N` (no holdings).
- **Cross-day cancellation**: `MT545_16056_20260715_002` (`CANC`) cancels a `SEME` filed in the
  `20260714` folder.

## 8. Defects and risks found

Impact measured against the committed archive (§9). "False break" = Position Check reports a
difference that does not exist.

| ID | Defect | Evidence / impact |
|---|---|---|
| D-1 | `ToAmount` treats the fraction as hundredths: `GBP21637,5` → 21,637.**05** (should be .50). | 240 confirmations since 2026-07-01 show wrong amounts on Settlements. Unit tests only cover 2-dp and 0-dp inputs. |
| D-2 | 8-digit safe on MT54x fails the exact `PadLeft(7)` match (BR-3). | `MT544_11397_20260916_001`, `MT545_10554_20260916_001` invisible on Settlements; false breaks 11397/2026-09-18/`LU00ZZ013430` and 10554/2026-09-18/`LU00ZZ014180`. |
| D-3 | Cancellations only applied within one day folder (BR-4). | `MT545_16056_20260715_002` does not cancel its 2026-07-14 original → settlement double counted; false break 16056/2026-07-17/`GB00ZZ001500`. |
| D-4 | Highest `<seq>` wins regardless of `23G` (BR-1). | 16558/2026-06-26: `_002` is `RPLC`, `_003` is a `NEWM/DUPL` of the superseded original → app shows the wrong statement; false breaks on 2026-06-26 and 2026-07-03 for `GB00ZZ003373` (account 2038 recon note "qty looks short"). |
| D-5 | Unknown ISINs shown as `UNKNOWN INSTRUMENT` although `35B` carries a name; cache never refreshes until Admin reload. | 4 ISINs, 159 holding lines (§7). |
| D-6 | Status dropdown in Position Check edit mode is never pre-selected. | Editing any row defaults to `OPEN`; saving silently overwrites `CHASED`/`RESOLVED`/`WRITEOFF` (and legacy `O`/`C`). Notes are upserts — no history. |
| D-7 | `ParseDecimal` comment claims thousands separators are tolerated; `1.250,50` would throw. | Not present in data today; latent. |
| D-8 | GBP totals rely on every line carrying a GBP `19A::HOLD`; non-GBP lines without one would count as 0. | 0 gaps in current data; implicit rule. |
| D-9 | No tolerance and no corporate-action model (BR-7, BR-10). | Two genuine breaks today, both explained only in free-text notes (see §9). |
| D-10 | Security: unsalted SHA-1 passwords (3 users share a hash); plaintext `pv_app`/`pvapp2013` connection string in `Web.config`; `compilation debug="true"`; SA password in `db/setup_db.bat`; no adviser→client scoping; Holdings/Settlements not role-gated. | Must not be carried forward. |
| D-11 | Inconsistent date formats (`dd-MMM-yyyy` on most pages, `dd/MM/yyyy` on Admin/Message Browser and inputs). | Cosmetic; user confusion. |
| D-12 | Test gaps: `ArchiveFileTests` both `[Ignore]`d (file removed); `ExpectedQty_PrevPlusRecMinusDel` asserts local arithmetic, not product code; no tests for CANC, RPLC/DUPL, padding, 1-dp amounts. | Defects D-1..D-4 are untested. |
| D-13 | Whole archive parsed into memory per app-pool start; slow first request (documented known issue). | ~6k files today; grows weekly. |

## 9. Verification method

`PositionCheck` was re-implemented 1:1 in a scratch script and run over every consecutive
statement pair for all 120 safes (2,945 pairs), then re-run with D-1..D-4 corrected (cancel across folders,
compare safes numerically, prefer `RPLC` and ignore `DUPL`):

| Run | Breaks |
|---|---|
| Legacy rules | 7 |
| Corrected rules | 2 |

The 5 extra legacy breaks are exactly the false breaks in D-2, D-3, D-4. The 2 remaining are
genuine and match `RECON_NOTE` entries: account 2001 / `GB00ZZ011962` (1:1 bonus issue, 16598,
2026-07-17, +800) and account 2074 / `GB00ZZ000908` (receipt with no MT545, 14380, 2026-07-31,
+900). These 7 and 2 results are the parity fixtures for the migration (see
[quickstart.md](./quickstart.md)).
