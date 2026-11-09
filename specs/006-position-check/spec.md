# Feature Specification: PositionCheck.aspx → SettlementExceptions (Portfolio Viewer migration 006)

**Feature Branch**: `006-position-check`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: "PositionCheck.aspx → SettlementExceptions. Legacy behaviour: OPS/ADMIN only; pick account + statement date → break rows (prev qty, net settled, expected, stmt qty, diff, status/note/updatedBy/updatedDt); "Check All" per date; inline RECON_NOTE status/note save through `PUT /api/pv/accounts/:acctId/position-check/notes`; "No previous statement on file." Quirks: Q11, Q12, Q18. The existing SettlementExceptions ops-queue view stays the default view."

Legacy files replaced: `src/PV.Web/PositionCheck.aspx(.cs)`. The domain (`PV.Core.PositionCheck`, `PositionBuilder`, `ReconNoteData`) was ported in spec 003 and is served by spec 004 (`GET /accounts/:id/position-check`, `PUT …/position-check/notes`, `GET /position-check/all`). This spec adds the screen, one additive read endpoint, and the shell wiring on top of spec 010.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a position check for one account and statement date (Priority: P1)
An OPS or ADMIN user opens Position check from the Portfolio Viewer nav group (`?screen=exceptions&pc=1`), picks an account and a statement date, and chooses **Run check**. The grid lists every ISIN whose expected quantity (previous statement + net settled since) differs from the statement quantity.

**Why this priority**: this is the page's purpose; break investigation starts here.

**Independent Test**: sign in as LBRENNAN, open `?screen=exceptions&acct=2038&stmt=2026-06-26`; one break row for GB00ZZ003373 with diff −1,250 and the seeded OPEN note.

**Acceptance Scenarios**:
1. **Given** the page opens with no account in the URL, **Then** the account list shows every account as `ACCT_NO - CLIENT_NAME` and the first one is selected; its statement dates are listed newest first as `dd-MMM-yyyy` upper case (Q14). No check is run until Run check.
2. **Given** an account is changed, **Then** the date list is refilled for that account and any grid or message is cleared (legacy `ddlAcct_Changed`).
3. **Given** Run check, **Then** the columns are: warning icon, ISIN, Instrument, Prev qty, Net settled, Expected, Stmt qty, Diff, Status, Note, Updated by, Updated. Quantities use `#,##0.####`; Updated uses `dd/MM/yyyy` (legacy `WebUtil.FmtDt`).
4. Rows, statuses and quantities are exactly those of `GET /accounts/:id/position-check` (Q11: no tolerance, missing current statement → stmt qty 0, case-insensitive ISIN status lookup defaulting to `NEW`, ordinal ISIN order). The client does not re-sort or filter.
5. **Given** a statement with no earlier statement, **Then** the message reads exactly "No previous statement on file." and no grid is shown.
6. **Given** no differences, **Then** the message reads "No differences.".
7. **Given** Run check with no account or date available, **Then** the message reads "Pick an account and a statement date.".
8. `?acct=<id>&stmt=<yyyy-mm-dd>` deep links run the check on load when the date is one of that account's statement dates (legacy `Request["acct"]`, `Request["stmt"]` + `FindByValue`). Otherwise the pickers are set and nothing is run.
9. Q18: on 18-SEP-2026 the accounts whose MT54x carry an eight-digit SAFE (`00011397`, `00010554`) show the unmatched settlement as a NEW break, because the API reproduces the seven-digit padding comparison.

### User Story 2 - Check all accounts for a statement date (Priority: P1)
**Check all** lists every account that has a statement on the chosen date with its number of differences, or `-` when it has no previous statement. **View** opens that account's check for the same date.

**Independent Test**: choose 18-SEP-2026 and Check all; the summary table lists the accounts, with 1 difference for 01068-02 and 01072-01 (Q18). View on 01068-02 shows the break.

**Acceptance Scenarios**:
1. The date list holds every distinct statement date in the archive, newest first (legacy `ddlAllDate`), served by the additive `GET /api/pv/position-check/dates`.
2. Rows come from `GET /position-check/all?date=` in API order. `Diffs` is shown verbatim.
3. **Given** no account has a statement on that date, **Then** the message reads "No statements on file for that date.".
4. Running Check all hides the per-account grid, and Run check hides the Check all table (legacy `BindRows` / `btnAll_Click`).

### User Story 3 - Record status and note on a break (Priority: P1)
**Edit** on a break row turns Status into a list (OPEN, CHASED, RESOLVED, WRITEOFF) and Note into a text box; **Update** saves through `PUT /api/pv/accounts/:acctId/position-check/notes` and rebinds the grid; **Cancel** leaves edit mode.

**Independent Test**: on 01068-02 / 18-SEP-2026, edit the NEW break, choose CHASED, type a note and Update; "Notes saved." shows and the row shows CHASED, the note, the signed-in user and today's date.

**Acceptance Scenarios**:
1. One row is in edit mode at a time (GridView `EditIndex`).
2. An empty note is saved as `null` (legacy `txt.Text == "" ? null : txt.Text`). The note is limited to 500 characters (RECON_NOTE.NOTE_TXT width; the API rejects longer).
3. The server stamps `UPDATED_BY` with the signed-in user and the update time; the client never sends them.
4. **Given** the save succeeds, **Then** the grid is re-read from the API and "Notes saved." is shown.
5. **Given** the save fails (non-auth), **Then** the row stays in edit mode with the typed values and the message "The note was not saved. Nothing was changed; try again." 401/403 follow the shell gates.
6. Q12: stored statuses are shown verbatim (`O`, `C`, `RESOLVED`, `WRITEOFF`, `CHASED`, `NEW`), empty notes show blank and a null `UPDATED_BY` shows blank.

### User Story 4 - Access, states and the default ops queue (Priority: P1)
**Acceptance Scenarios**:
1. OPS and ADMIN may open Position check; ADVISER gets the spec 010 "not authorised" panel and no PV data is requested; the API also answers 403 (Q17).
2. `?screen=exceptions&pc=1&state=Populated|Loading|Empty|Error` render without signing in (preview fixture), as for Admin.
3. Empty = no accounts or no statement dates in the archive index. Error = the accounts, dates or check request failed (non-auth), with Retry.
4. `?screen=exceptions` without `pc`, `acct` or `all` is the existing Settlement exceptions ops queue, pixel-identical, in all four states.

### Edge Cases
- `?stmt=` that is not one of the account's dates: no run, first date selected (legacy `FindByValue` miss).
- `?acct=` that is not an account: first account selected.
- `?all=` takes precedence over `?stmt=` (Check all was the last postback).
- Malformed `acct`/`stmt`/`all` are ignored (`parsePvContext`), and `pc` is only honoured as `pc=1`.
- Editing a row then running another check discards the edit.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001** Register a PV slice for `exceptions`, active only when the URL has `pc=1`, `acct` or `all`.
- **FR-002** Set `screen: 'exceptions'` (with `params: {pc: '1'}`) on the `PositionCheck.aspx` row of `PV_PAGES`; roles stay `['OPS', 'ADMIN']`.
- **FR-003** Load only through `src/api/pv.ts`: `accounts`, `positionCheckDates`, `statementDates`, `positionCheck`, `checkAll`, `saveNote`.
- **FR-004** Build the view model in `src/model/pv/position-check.ts` and expose it as `posCheck` from `buildScreens`.
- **FR-005** Formatting: statement dates `dd-MMM-yyyy` upper case; quantities `#,##0.####` from the API's decimal strings without float conversion; Updated `dd/MM/yyyy`.
- **FR-006** Legacy messages verbatim: "No previous statement on file.", "No differences.", "No statements on file for that date.", "Pick an account and a statement date.", "Notes saved.".
- **FR-007** Note saves go through `pv.run({kind: 'saveReconNote', …})`, then re-read the check.
- **FR-008** Add `GET /api/pv/position-check/dates` (OPS/ADMIN) returning `{dates}` newest first.
- **FR-009** Visual-diff app-only cases: `poscheck-<State>` × 4 and flows (nav, edit, save preview, live save, Check all, Check all → View, no previous statement, forbidden).
- **FR-010** No change to the mockup `exceptions` view model or its visual-diff cases.

### Key Entities
- **PvPositionCheckData**: account options, selected account, its dates, all dates, the check run (if any), the Check all result (if any). See `data-model.md`.

## Decisions and divergences
All recorded without stopping for the user (per the task instructions).
- **D-006-1** Same screen id, context-sensitive: Position check lives on `exceptions` only with PV context, so the mockup ops queue stays the default. `pc=1` is a new additive `PvContext` key that marks the page when no account is chosen yet; `all=<yyyy-mm-dd>` carries the Check all date.
- **D-006-2** Postbacks become URLs: Run check → `?acct=&stmt=`, Check all → `?all=`, View → `?acct=&stmt=` (legacy `LinkAcct`/`LinkDate`). Back/forward and deep links work; legacy kept this in ViewState.
- **D-006-3** Edit preselects the row's current status when it is one of the four list values, otherwise OPEN. Legacy never bound `ddlStatus`, so it always showed OPEN and a note-only edit silently reset RESOLVED/CHASED/WRITEOFF to OPEN. The list values and the save semantics are unchanged.
- **D-006-4** A save failure keeps the row in edit mode with an explicit message; legacy showed the ASP.NET error page.
- **D-006-5** A KPI strip above the pickers summarises the current check or Check all result (account, dates, statement file, break count by status). It is derived only from the API response.
- **D-006-6** New read endpoint `GET /api/pv/position-check/dates` replaces the legacy in-page loop over every account's statement dates (one request instead of 120).

No catalogued quirk (Q11, Q12, Q14, Q17, Q18) is changed.

## Success Criteria *(mandatory)*
- **SC-001** For the seeded breaks, the screen shows the same rows, quantities and statuses as `parity/legacy-golden` (7 diff rows across the archive).
- **SC-002** OPS and ADMIN can find, run, annotate and save a break without leaving the screen; ADVISER cannot see or call it.
- **SC-003** All four DataStates are reachable from the URL; the mockup `exceptions` cases are unchanged in visual-diff.
- **SC-004** lint, typecheck, build, test:unit, test:domain, test:backend, test:db, qa:test and visual-diff pass.
