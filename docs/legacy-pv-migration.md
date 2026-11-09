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
