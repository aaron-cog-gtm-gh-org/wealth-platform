# Portfolio Viewer → Wealth Platform migration

Source: [`aaron-cog-gtm-gh-org/legacy-wealth-platform`](https://github.com/aaron-cog-gtm-gh-org/legacy-wealth-platform)
(ASP.NET Web Forms 4.8 "Portfolio Viewer" v3.2.1). Governed by `.specify/memory/constitution.md`.

## Feature map

| Spec | Legacy | Target |
| --- | --- | --- |
| 001 | PV.Core `SwiftParser`, `SwiftMessage`, `Models`, `DateUtil`; PV.Tests | `src/domain/swift/` + Vitest |
| 002 | PV.Core `ArchiveIndex`, `SettlementReader`; `archive/` layout | `src/domain/archive/` + archive source abstraction |
| 003 | PV.Core `PositionBuilder`, `PositionCheck`; PV.Data `ReconNoteData` (read) | `src/domain/positions/`, `src/domain/recon/` |
| 004 | PV.Data `SqlHelper` + table classes; `db/` | API/service layer feeding `src/model` |
| 005 | `Holdings.aspx` | PortfolioDetail |
| 006 | `PositionCheck.aspx` (+ RECON_NOTE save) | SettlementExceptions |
| 007 | `Settlements.aspx` | new Settlements screen |
| 008 | `ClientSearch.aspx`, `ClientSummary.aspx` | Client360 |
| 009 | `MessageBrowser.aspx` | new Message browser screen |
| 010 | `Login.aspx`, `Admin.aspx`, `Site.Master`, `BasePage` | shell auth / roles / admin |
| 011 | — | parity checklist vs golden legacy output |

## Archive facts (legacy repo, 2026-11)

- `archive/mt535/MT535_<safe>_<yyyyMMdd>_<seq>.txt` — 3,073 files; `archive/mt54x/<yyyyMMdd>/MT54n_<safe>_<yyyyMMdd>_<seq>.txt` — 2,971 files.
- File names use the unpadded safe code; message `97A::SAFE` is zero-padded to 7 digits.
- MT535 `23G`: NEWM (3,067), RPLC (4), NEWM/DUPL (2). MT54x `23G`: NEWM, CANC (10).
- Resends: some statements have `_002` / `_003` sequences for the same account and date.
- `93B::AGGR` uses UNIT and FAMT; some statements are `17B::ACTI//N` with no FIN blocks; 35B may carry a `/GB/<sedol>` line.

## Legacy quirks catalogue (preserve unless a spec declares a divergence)

| ID | Where | Behaviour |
| --- | --- | --- |
| Q1 | `SwiftParser.ParseDecimal` | Replaces every `,` with `.` then parses; `1250,` → 1250, `0,5` → 0.5. Thousands separators are not supported. |
| Q2 | `ParseStatement` 90A/90B | Price = text after last `/`; a 3-letter ccy prefix is stripped (`ACTU/GBP34,553` → 34.553). |
| Q3 | `ParseStatement` 93B | Only `AGGR` qualifier; qty rounded to 4 dp; FAMT treated as a plain number (QtyType kept). |
| Q4 | `ParseStatement` 19A::HOLD | First HOLD sets ccy + MktVal (and MktValGbp if GBP); a later GBP HOLD sets MktValGbp. Non-GBP line with no GBP HOLD → MktValGbp 0. |
| Q5 | `ParseStatement` 35B | `MsgDescription` is the last line; a FIN block without `ISIN ` line is dropped. SUBSAFE blocks flattened. |
| Q6 | `ParseConfirm` | `Seme` = first 20C content (even if PREV); `Function` raw 23G; Direction REC for 544/545, DEL for 546/547; `Folder` = parent dir name. |
| Q7 | `ArchiveIndex` | Statements keyed by safe acct with leading zeros trimmed, then statement date; parse errors counted and skipped. |
| Q8 | `PositionBuilder.GetStatement` | Highest file seq wins for a date, regardless of `23G` (RPLC and NEWM/DUPL are not interpreted). |
| Q9 | `SettlementReader.GetSettlements` | CANC removes `Seme == canc.Prev` only within the same day folder; account compare is exact string vs `SAFE_CODE.PadLeft(7,'0')`; settle date inclusive range; newest first. |
| Q10 | `SettlementReader.ToAmount` | `int` parse of whole and fraction parts; fraction treated as hundredths (`,5` → 0.05). |
| Q11 | `PositionCheck.Run` | Window = previous statement date + 1 → stmt date; rows only where expected ≠ stmt qty (no tolerance); missing current statement → stmt qty 0 for all; status from RECON_NOTE (case-insensitive ISIN) else `NEW`; rows sorted ordinal by ISIN; no previous statement → "No previous statement on file." |
| Q12 | `RECON_NOTE` seed | Mixed status codes (`O`, `C`, `RESOLVED`, …); some notes have empty text and NULL `UPDATED_BY`. |
| Q13 | `PositionBuilder.InstrumentName` | Name from INSTRUMENT table, else `UNKNOWN INSTRUMENT <isin>`; cached until restart. |
| Q14 | `DateUtil.FormatDate` / `WebUtil` | `dd-MMM-yyyy` upper-case on newer screens; `dd/MM/yyyy` on Admin/Message Browser; qty `#,##0.####`, price `#,##0.0000`, money `#,##0.00`. |
| Q15 | `Settlements.aspx` | Default window = 90 days ending at latest statement date (else today); dates entered as dd/MM/yyyy. |
| Q16 | `MessageBrowser.aspx` | Filter date entered as dd/MM/yyyy; safe filter trims leading zeros; files served only by index lookup under archive root. |
| Q17 | `BasePage` / `Site.Master` | Roles ADVISER / OPS / ADMIN; Position Check + Message Browser need OPS or ADMIN, Admin needs ADMIN; passwords SHA1 upper-hex (must not be carried forward). |
| Q18 | `SettlementReader` / archive data | Two MT54x messages carry an 8-digit `97A::SAFE` (`00011397`, `00010554`); the exact compare to `PadLeft(7,'0')` never matches them, so they surface as NEW breaks on 2026-09-18 in legacy output. |

## Legacy golden output

`parity/legacy-golden/legacy-golden.json.gz` (from unmodified legacy PV.Core/PV.Data under Mono + SQL Server; see `parity/legacy-oracle/README.md`): 120 accounts × 26 statement dates (3,065 `PositionCheck.Run` calls), 7 diff rows, 30,645 holdings lines, settlements default-90d and full-range, Check All per date. Decimals are strings with legacy scale (compare numerically); settlement ties on settle date are ordered `folder, fileName`.

## Spec 010 decisions (shell auth / roles / Admin)

Spec 010 preserves Q17 roles (exact match) and the Q14 Admin `dd/MM/yyyy` format. SHA1 is not carried forward; that decision is from spec 004. Explicit divergences, none of which change a catalogued domain quirk:
- **D-010-1** Deep links survive sign-in, where legacy always went to `ClientSearch.aspx`.
- **D-010-2** Not-authorised is an in-place panel, where legacy redirected to `ClientSearch.aspx?err=1`.
- **D-010-3** The archive root path is not shown on Admin.
- **D-010-4** The reload confirmation is inline and keeps the legacy prompt text.
- **D-010-5** An expired session says so, where legacy silently redirected to Login.

The shared plumbing is described in `specs/010-shell-auth/contracts/pv-shell.md`.

## Spec 006 decisions (Position check)

Spec 006 preserves Q11, Q12, Q14 (`dd-MMM-yyyy` statement dates, `dd/MM/yyyy` Updated, `#,##0.####` quantities), Q17 (OPS/ADMIN) and Q18 by rendering the spec 004 API unchanged. Explicit divergences (details in `specs/006-position-check/spec.md`):
- **D-006-1** Position check is the `exceptions` screen only with PV context (`pc=1`, `acct` or `all`); `?screen=exceptions` stays the mockup ops queue.
- **D-006-2** Run check / Check all / View are URLs (`?acct=&stmt=`, `?all=`) instead of postbacks.
- **D-006-3** Edit preselects the row's current status when it is OPEN/CHASED/RESOLVED/WRITEOFF (legacy always showed OPEN, so a note-only edit reset the status).
- **D-006-4** A failed save keeps the row in edit mode with a message (legacy error page).
- **D-006-5** A derived KPI strip summarises the check.
- **D-006-6** `GET /api/pv/position-check/dates` serves the all-account date list.

## Spec 007 decisions (Settlements screen)

`Settlements.aspx` becomes the new `?screen=settlements` and does not reuse ActivityStatus, which is the retail client portal. Q9, Q10, Q14, Q15 (default window) and Q18 are preserved. The server applies them and the screen keeps the API order.
- **D-007-1** Date inputs take ISO `yyyy-mm-dd` and still accept typed or deep-linked legacy `dd/MM/yyyy`. The message is "Enter dates as yyyy-mm-dd.".
- **D-007-2** The From/To window is written to the URL (`from`/`to`).
- **D-007-3** No account or an unknown account shows an account picker, where legacy redirected to `ClientSearch.aspx`.
- **D-007-4** An empty window shows the Empty panel "No settlements in period" with the date form kept above it.
- **D-007-5** An unreadable amount shows `0.00` with a warning, where legacy went to `Error.aspx`.
- **D-007-6** Confirmation, REC and DEL counts and the window length are shown above the grid.

## Spec 008 decisions (ClientSearch / ClientSummary → Client 360)

Search keeps `usp_ClientSearch` semantics (spec 004 route); the summary keeps Q8 (latest statement by highest file sequence), Q14 (`dd-MMM-yyyy`, `#,##0.00`) and Q17 (any role; Position check link only for OPS/ADMIN). New screen `clients`; the custody summary is `c360` with `?cid=`, and `?screen=c360` alone stays the Whitfield mockup. Explicit divergences:
- **D-008-1** The last search is kept in the URL (`?q=`) and re-queried, not cached in Session.
- **D-008-2** An unknown client shows an in-place "Client not found" state, where legacy redirected to ClientSearch.
- **D-008-3** Account rows also link to Position check (OPS/ADMIN); Holdings/Position check links carry the latest statement date.
- **D-008-4** A numeric pager with Previous/Next replaces the postback pager (25 rows per page kept).
- **D-008-5** Client 360 adds a KPI strip above the legacy fields.
