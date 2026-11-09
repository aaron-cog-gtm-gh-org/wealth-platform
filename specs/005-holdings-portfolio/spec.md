# Feature Specification: Holdings.aspx → PortfolioDetail custody holdings (Portfolio Viewer migration 005)

**Feature Branch**: `005-holdings-portfolio`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: "Holdings→PortfolioDetail". Legacy behaviour: `Holdings.aspx?acct=&stmt=yyyyMMdd` shows the latest or the selected MT535 statement of holdings with qty, qty type, price, ccy, market value and GBP value, plus a statement-date picker. Quirks touched: Q2–Q5, Q8, Q13, Q14. The existing Whitfield Portfolio detail stays the default view; custody holdings appear only when a Portfolio Viewer account context is present. Builds on the spec 010 shell plumbing (`specs/010-shell-auth/contracts/pv-shell.md`).

Legacy files replaced: `src/PV.Web/Holdings.aspx`, `Holdings.aspx.cs`, `Holdings.designer.cs`. The `WebUtil.FmtQty`, `FmtPx`, `FmtMoney` and `DateUtil.FormatDate` usages on this page are ported as view-model formatters.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a custody account's latest statement of holdings (Priority: P1)
A Portfolio Viewer user (any role) opens a custody account deep link, for example `?screen=portfolio&acct=2018`. Portfolio detail shows the account header (Acct No, Client, Safe Code, account type, base currency), the statement-date picker set to the latest statement, and one row per MT535 holding: ISIN, instrument, quantity, quantity type, price, currency, market value and market value in GBP, with the GBP total.

**Why this priority**: this is the whole legacy page; without it, custody holdings cannot be viewed in the new shell.

**Independent Test**: sign in as JSMITH, open `?screen=portfolio&acct=2018`, and compare the rows and total with `GET /api/pv/accounts/2018/holdings` (and with the legacy golden holdings for that account and date).

**Acceptance Scenarios**:
1. **Given** a signed-in user and `acct` with statements on file, **When** no `stmt` is given, **Then** the latest statement is shown and the picker selects it.
2. Rows appear in statement order. Quantity uses `#,##0.####`, price `#,##0.0000`, values `#,##0.00`, and dates `dd-MMM-yyyy` upper case (Q14).
3. The instrument is the INSTRUMENT table name, else `UNKNOWN INSTRUMENT <isin>` (Q13).
4. The total equals the exact sum of the GBP values (no floating-point drift) and is formatted `#,##0.00`.
5. **Given** no session, **Then** the sign-in panel is shown in place of the screen; after sign-in the same account (and statement) is shown (D-010-1).

### User Story 2 - Pick another statement date (Priority: P1)
The picker lists every statement date on file for the account, newest first. Choosing a date changes the URL to `?screen=portfolio&acct=<id>&stmt=<yyyy-mm-dd>` (the legacy page redirected to `Holdings.aspx?acct=&stmt=`), so the view is bookmarkable and Back returns to the previous statement.

**Independent Test**: from `?screen=portfolio&acct=2018`, choose `02-OCT-2026`; the URL gains `stmt=2026-10-02` and the 15 rows of that statement are shown.

**Acceptance Scenarios**:
1. **Given** a resend for the date (`_002`, `_003`), **Then** the highest file sequence is shown, whatever its `23G` function (RPLC, NEWM/DUPL) (Q8). The statement's function and file name are shown next to the picker.
2. **Given** a `stmt` that is a valid date but has no statement on file, **Then** the header and picker are shown with "No statement on file for this date." and no rows (legacy text).
3. **Given** a statement with no holdings (`17B::ACTI//N`), **Then** "No holdings on statement." is shown and no rows (legacy text).
4. **Given** a malformed `stmt`, **Then** it is ignored and the latest statement is shown (legacy `TryParseExact` fallback).

### User Story 3 - Whitfield default view and four DataStates (Priority: P1)
Without a PV account context (`?screen=portfolio`, or `acct` missing or not a positive integer) the screen is today's Whitfield Portfolio detail, pixel-identical. With `acct`, all four DataStates are reachable: `?screen=portfolio&acct=<id>&state=Populated|Loading|Empty|Error`.

**Independent Test**: the existing mockup visual-diff counts for `portfolio-*` and the portfolio flows are unchanged; the new app-only cases `portfolio-pv-{Populated,Loading,Empty,Error}` and flows pass their assertions and baselines.

**Acceptance Scenarios**:
1. `?state=Populated` without a session renders a fixed synthetic preview statement (design preview), as the Admin screen does.
2. Loading = the account, dates and statement are being fetched. Error = the API failed for a reason other than 401/403, with Retry. Empty = the account has no statement on file at all, or the account id is unknown.
3. A 401 clears the session ("Your session has expired. Sign in again."); a 403 shows the not-authorised panel.

### Edge Cases
- Unknown `acct` (API 404) → Empty "Custody account not found" (legacy redirected to `ClientSearch.aspx`; D-005-2).
- A non-GBP line with no GBP `19A::HOLD` shows GBP value `0.00` and adds nothing to the total (Q4).
- FAMT (face amount) quantities are shown as plain numbers with quantity type `FAMT` (Q3).
- Price text with a currency prefix (`ACTU/GBP34,553`) is shown as `34.5530` (Q2; parsing is server-side, spec 001).
- Holdings blocks without an `ISIN ` line never appear; SUBSAFE blocks are flattened (Q5; server-side).
- Choosing the date that is already selected does nothing.
- Navigating to the Whitfield nav drops `acct`/`stmt`; the Portfolio Viewer nav "Holdings" item keeps them (spec 010).

## Requirements *(mandatory)*

- **FR-001**: Register a `portfolio` PV slice (`needs: 'acct'`) that loads the account, its statement dates and the selected (or latest) statement only through `/api/pv` (`GET /accounts/:id`, `/statement-dates`, `/holdings?date=`).
- **FR-002**: Set `screen: 'portfolio'` on the `Holdings.aspx` row of `PV_PAGES`, so signed-in users of every role get a "Holdings" item in the Portfolio Viewer nav group.
- **FR-003**: Build the custody holdings view model in `src/model/` and expose it from `buildScreens` as `portfolio` (null unless the slice is ungated and Populated). The browser does no domain computation; display formatting and the GBP total use exact decimal-string arithmetic.
- **FR-004**: The statement-date picker navigates by URL (`stmt=yyyy-mm-dd`), keeping `acct`.
- **FR-005**: PV-specific breadcrumb, subtitle, loading, empty and error copy are used only while the PV slice is active; the Whitfield copy is unchanged.
- **FR-006**: `scripts/visual-diff.mjs` gains app-only cases `portfolio-pv-{Populated,Loading,Empty,Error}` and flows for date selection, the empty-statement message, the not-on-file message, an unknown account, and sign-in from a deep link. The mockup cases are unchanged.
- **FR-007**: The existing screens' default view, mockup diff, unit/domain/backend/db tests, `qa:test` and the workspace keep passing.

## Quirk decisions

| Quirk | Decision |
| --- | --- |
| Q2 price after last `/`, ccy prefix stripped | **Preserved** (server parser, spec 001); price shown as returned. |
| Q3 AGGR only, 4 dp, FAMT as plain number | **Preserved**; quantity type is displayed (D-005-4). |
| Q4 first HOLD sets ccy + MktVal, GBP HOLD sets MktValGbp, else 0 | **Preserved**; 0 GBP values are shown as `0.00` and summed as 0. |
| Q5 last 35B line, no-ISIN blocks dropped, SUBSAFE flattened | **Preserved** (server). Instrument column shows the Q13 name, as legacy. |
| Q8 highest file seq wins regardless of 23G | **Preserved**; function and file are now displayed (D-005-5). |
| Q13 INSTRUMENT name else `UNKNOWN INSTRUMENT <isin>` | **Preserved** (server `instrumentName`). |
| Q14 `dd-MMM-yyyy` upper; qty `#,##0.####`, px `#,##0.0000`, money `#,##0.00` | **Preserved**, rounding half away from zero like .NET custom formats. |

## Divergences (explicit)

- **D-005-1 `stmt` is ISO.** Legacy took `stmt=yyyyMMdd`; the shared PV context (spec 010) takes `stmt=yyyy-mm-dd`. A legacy compact value is malformed and therefore falls back to the latest statement, which is also what legacy did with a malformed value.
- **D-005-2 Missing or unknown account.** Legacy redirected to `ClientSearch.aspx`. Without `acct` the Whitfield Portfolio detail is shown (constitution V); an unknown `acct` shows the Empty state "Custody account not found".
- **D-005-3 Requested date not on file stays visible in the picker.** Legacy left the drop-down on its first (latest) item while saying "No statement on file for this date.", which misreports the selection. The picker shows the requested date marked "not on file".
- **D-005-4 Quantity type column.** Legacy parsed but did not display `QtyType`; it is shown so FAMT face amounts are not read as units.
- **D-005-5 Statement function and file are displayed.** Legacy showed neither. Display only; Q8 selection is unchanged.
- **D-005-6 Account type and base currency are shown in the header** alongside the legacy Acct No / Client / Safe Code labels.

None of these changes a domain result (rows, values, ordering or statement selection), so spec 011 needs no parity entries for them.

## Key Entities
- **Custody account**: ACCT_ID, account number, client name, safe code, type, base currency.
- **Statement of holdings**: statement date, `23G` function, file name and sequence, holding lines.
- **Holding line**: ISIN, instrument name, quantity and type, price, currency, market value, GBP market value.

## Success Criteria *(mandatory)*
- **SC-001**: For every one of the 120 accounts, the latest statement's rows, count and GBP total shown equal the API (golden) values.
- **SC-002**: A user can move between any two statement dates of an account in one selection, and Back restores the previous statement.
- **SC-003**: 100% of the existing mockup visual-diff cases have the same pixel-diff counts as before this feature.
- **SC-004**: The four PV DataStates and all new flows pass their assertions; lint, typecheck, build, test:unit, test:domain, test:backend, test:db and qa:test pass.

## Assumptions
- `acct` is the PV `ACCT_ID`, as in legacy `Holdings.aspx?acct=`.
- Any signed-in role may open Holdings (legacy page had no `RequiredRoles`).
- The design preview uses the synthetic statement of account 2018 (Prof J Castellan, 09-OCT-2026), which exercises USD lines, FAMT bonds and an unknown instrument.
- No account picker is added: as in legacy, accounts are reached by deep link (Client360/ClientSearch, spec 008, will link here).
