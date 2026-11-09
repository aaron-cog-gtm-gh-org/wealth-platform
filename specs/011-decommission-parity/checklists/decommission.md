# Decommission Checklist: legacy Portfolio Viewer (PV.*)

**Purpose**: Sign-off gate for switching off `legacy-wealth-platform`.
**Created**: 2026-11-09
**Feature**: [spec.md](../spec.md)
**Evidence command**: `npm run db:up && npm run db:wait && npm run db:setup && npm run parity` → `parity/report/parity-report.md`

## Parity on identical fixtures

- [x] CHK001 Archive inputs identical: 6,044 files match `parity/legacy-oracle/archive-manifest.sha256` (check `archive-manifest`).
- [x] CHK002 Archive index counts match legacy `ArchiveIndex.Build` (check `archive-index`).
- [x] CHK003 Statement chosen for each account/date matches legacy, highest file seq wins (Q8) (check `statement-selection`, 3,065).
- [x] CHK004 Holdings lines match `Holdings.aspx` for all 3,065 account/date statements, with instrument names from PostgreSQL (check `holdings`).
- [x] CHK005 Position Check matches legacy for all 3,065 account/date runs, recon status/note/updater/date enriched from PostgreSQL `pv.recon_note` (check `position-check`). 7 break rows: NEW 4, OPEN 1, RESOLVED 1, CHASED 1.
- [x] CHK006 Check All matches legacy for all 26 statement dates (check `check-all`).
- [x] CHK007 Settlements match legacy for every account, 90-day default and full range, including `ToAmount` amounts (check `settlements`, 240 lists: 1,572 + 2,950 items).
- [x] CHK008 The runner detects a real difference: changing one `pv.recon_note` status (acct 2038, GB00ZZ003373, 2026-06-26) gave FAIL with the account and date; reseeding gave PASS.
- [x] CHK009 Golden Vitest suites pass in CI (`server/pv/archive.golden.test.ts`, `server/pv/positions.golden.test.ts`) and the PostgreSQL API replay (`server/pv/api.int.test.ts`).

## Legacy component → replacement

| Legacy | Replacement | Spec | Status |
| --- | --- | --- | --- |
| PV.Core SwiftParser / SwiftMessage / Models / DateUtil | `src/domain/swift`, `src/domain/date.ts`, `src/domain/decimal.ts` | 001 | [x] |
| PV.Core ArchiveIndex / SettlementReader | `src/domain/archive`, `server/pv/archive-fs.ts` | 002 | [x] |
| PV.Core PositionBuilder / PositionCheck | `src/domain/positions` | 003 | [x] |
| PV.Data SqlHelper + Account/Client/Instrument/ReconNote/UserData | PostgreSQL `pv` schema + `/api/pv/*` (`server/pv`) | 004 | [x] |
| PV.Tests (SwiftParserTests, PositionCheckTests, ArchiveFileTests) | Vitest (`npm run test:domain`); 2 legacy `[Ignore]` cases kept skipped with reasons | 001–003 | [x] |
| Login.aspx / Admin.aspx / Site.Master / BasePage | shell auth + Admin screen | 010 | [x] |
| Holdings.aspx | PortfolioDetail (custody context) | 005 | [ ] |
| PositionCheck.aspx | SettlementExceptions (custody context) | 006 | [ ] |
| Settlements.aspx | new Settlements screen | 007 | [x] |
| ClientSearch.aspx / ClientSummary.aspx | Client360 (custody context) | 008 | [ ] |
| MessageBrowser.aspx | new Message Browser screen | 009 | [ ] |
| Error.aspx | shell error state (`Error` DataState) | 010 | [x] |
| db/ schema + seed | kept as reference in legacy repo; ported to `server/db/pv-schema.sql`, `pv-seed.sql` | 004 | [x] |

## Quirks (docs/legacy-pv-migration.md)

- [x] CHK010 Q1–Q9, Q11–Q13 preserved; covered by the parity checks above.
- [x] CHK011 Q10 (`ToAmount` single fraction digit read as hundredths, 283 settlements) preserved; **business decision open** — fix or keep.
- [x] CHK012 Q18 (8-digit `97A::SAFE` never matches, 2 NEW breaks on 2026-09-18) preserved; **business decision open** — fix or keep.
- [ ] CHK013 Q14 display formats, Q15 Settlements window, Q16 Message Browser filters: verified per screen spec (005–009).
- [x] CHK014 Q17 roles preserved; SHA1 passwords deliberately not carried forward (constitution VI).

## Deliberate divergences

- [x] CHK015 Recon/parity divergences declared in `parity/divergences.json`: none.
- [ ] CHK016 Screen-level UX divergences recorded in each screen spec (010: deep link after sign-in, in-place 403, archive path hidden, inline reload confirm, explicit expiry message; 009: ISO date input with legacy `dd/MM/yyyy` deep links).

## Sign-off

- [ ] CHK017 All screen specs 005–009 merged and `npm run parity` re-run on the final integration branch: PASS.
- [ ] CHK018 Business owner decision recorded for Q10 and Q18.
- [ ] CHK019 Legacy app switched to read-only, then retired.
