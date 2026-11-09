# Feature Specification: Settlements.aspx → new Settlements screen (Portfolio Viewer migration 007)

**Feature Branch**: `007-settlements-screen`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: "Settlements → ActivityStatus or new Settlements screen" (migration step 5). Legacy behaviour: `?acct=`; default 90-day window ending at the latest statement date; from/to date inputs; columns MT type, direction, ISIN + instrument name, qty, amount, ccy, SEME; newest first; CANC handling. Quirks Q9, Q10, Q15, Q18.

Legacy files replaced: `src/PV.Web/Settlements.aspx`, `Settlements.aspx.cs`, `Settlements.designer.cs`. The domain (`SettlementReader`, spec 002) and the API route (`GET /api/pv/accounts/:acctId/settlements`, spec 004) already exist and are reused unchanged.

## Decision: a new screen, not ActivityStatus

`ActivityStatus` (`?screen=activity`) is the **retail client portal** view ("what Eleanor Whitfield sees": deposits, payments and statuses in plain language, client-portal banner, mockup-pinned). `Settlements.aspx` is an **operations / adviser custody view**: raw MT544–MT547 confirmations for one custody safekeeping account, with SWIFT message types, SEME references and ISINs. Merging them would put SWIFT detail in front of clients and would change a mockup screen that must stay pixel-identical (constitution V). The custody list therefore gets its own screen id `settlements`, listed in the "Portfolio Viewer" nav group (`PV_PAGES` row `Settlements.aspx`, any signed-in role).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See an account's settlement confirmations (Priority: P1)
A signed-in Portfolio Viewer user (ADVISER, OPS or ADMIN) opens `?screen=settlements&acct=2001` (legacy `Settlements.aspx?acct=2001`). They see the account header (account number, client, safe code, account type, base currency) and the MT54x confirmations that settle in the last 90 days up to the account's latest statement date, newest first.

**Why this priority**: it is the whole legacy page.

**Independent Test**: sign in as JSMITH, open `?screen=settlements&acct=2001`; the window shows `11-JUL-2026` to `09-OCT-2026` and the 18 rows match `GET /api/pv/accounts/2001/settlements` in order.

**Acceptance Scenarios**:
1. **Given** an account with statements, **When** no dates are given, **Then** the window is (latest statement date − 90 days) to the latest statement date, inclusive (Q15). Without statements it ends today.
2. Columns are, in legacy order: Trade date, Settle date, Msg (`MT545` …), Dir (`REC`/`DEL`), ISIN, Instrument, Qty, Amount, Ccy, Ref (SEME). Dates are `dd-MMM-yyyy` upper case; qty `#,##0.####`; amount `#,##0.00` (Q14).
3. Rows are in API order: settle date newest first (ties as the legacy stable sort, Q9).
4. A cancelled confirmation and its CANC are not shown when both are in the same day folder; a CANC in a later folder does not remove the original (Q9).
5. Amounts use the legacy `ToAmount` arithmetic, so `GBP11524,8` shows `11,524.08` (Q10). A confirmation without `19A` shows `0.00`.
6. Summary figures: confirmations, receipts (REC), deliveries (DEL) and the window length.

### User Story 2 - Change the date window (Priority: P1)
The user edits From / To and chooses Show. The list reloads for the new window and the URL carries `from`/`to` so the view can be shared and survives sign-in.

**Independent Test**: on account 2001 set From `2026-09-01`, To `2026-09-30`, Show; the URL has `from=2026-09-01&to=2026-09-30` and only September settlements are listed.

**Acceptance Scenarios**:
1. Inputs take ISO `yyyy-mm-dd`; legacy `dd/MM/yyyy` typed values are also accepted.
2. **Given** either input is not a valid date, **When** Show is chosen, **Then** "Enter dates as yyyy-mm-dd." is shown and the list is not reloaded.
3. **Given** a window with no settlements, **Then** the account header and date form stay visible above the empty panel "No settlements in period", so the user can widen the window.
4. From later than To is not an error: the list is empty (legacy behaviour).
5. Deep links `?from=` / `?to=` accept ISO and the legacy `dd/MM/yyyy`; an invalid value is ignored and that end falls back to the default (legacy `Page_Load`).

### User Story 3 - Choose an account (Priority: P2)
Opening `?screen=settlements` without `acct` (or with an unknown account) shows a list of custody accounts to choose from.

**Acceptance Scenarios**:
1. Accounts are listed by account number with client, account type, safe code and status; choosing one opens its settlements.
2. An unknown `acct` shows "Account <id> was not found." above the list.

### User Story 4 - Design states (Priority: P1)
`?screen=settlements&state=Populated|Loading|Empty|Error` render without signing in (Populated uses a fixed synthetic preview of account 01001-01).

### Edge Cases
- Account with no safe code → custody account `0000000`, nothing matches, empty list.
- 8-digit `97A::SAFE` messages (`00011397`, `00010554`) never match the 7-digit padded safe code, so they are not shown for accounts 11397 / 10554 (Q18).
- `amountError` from the API (an amount the legacy `int.Parse` would reject) shows `0.00` with a warning marker instead of failing the page.
- 401 → session expired panel; other API failures → Error state with Retry.

## Requirements *(mandatory)*

- **FR-001**: New screen id `settlements` in `SCREENS`, nav via the `PV_PAGES` `Settlements.aspx` row (roles: any signed-in user).
- **FR-002**: PV slice `settlements` (`needs: 'none'`) loads `account(acct)` + `settlements(acct, {from, to})`, or `accounts()` when no account is selected / the account is unknown. HTTP client only.
- **FR-003**: `PvContext` gains optional `from` / `to` (ISO), parsed from ISO or legacy `dd/MM/yyyy`; added to `PV_CONTEXT_KEYS` so mockup nav drops them.
- **FR-004**: View model `buildSettlements` in `src/model/settlements.ts`; the screen renders only from it. Formatting works on the API's decimal strings (no floating point).
- **FR-005**: All four DataStates reachable via `?state=`; live empty windows keep the account header and date form.
- **FR-006**: `scripts/visual-diff.mjs` app-only cases `settlements-<State>` × 4 plus flows: change window, invalid date, legacy `dd/MM/yyyy` deep link, live empty window, account picker.
- **FR-007**: Mockup screens, Admin and existing tests unchanged in behaviour.

## Quirk decisions

| Quirk | Decision |
| --- | --- |
| Q9 CANC same-folder only, exact `PadLeft(7,'0')` compare, inclusive range, newest first | **Preserved** (server, spec 002/004; screen keeps API order). |
| Q10 `ToAmount` fraction as hundredths | **Preserved** (`GBP11524,8` → `11,524.08`). |
| Q14 `dd-MMM-yyyy`, `#,##0.####`, `#,##0.00` | **Preserved**. |
| Q15 default 90-day window ending at the latest statement date, else today | **Preserved** (server default). Date entry format **changed**, see D-007-1. |
| Q18 8-digit safes never match | **Preserved**. |

## Divergences (explicit)

- **D-007-1 ISO date inputs.** Legacy inputs were `dd/MM/yyyy` only ("Enter dates as dd/MM/yyyy."). The inputs now show and take `yyyy-mm-dd`, still accept typed `dd/MM/yyyy`, and the message reads "Enter dates as yyyy-mm-dd.". Legacy `?from=dd/MM/yyyy` deep-link params are still accepted. No settlement result changes.
- **D-007-2 Window in the URL.** Legacy Show was a postback that kept the URL; now `from`/`to` are written to the URL (shareable, survives sign-in, D-010-1).
- **D-007-3 No-account / unknown-account picker.** Legacy redirected to `ClientSearch.aspx`; the screen shows an account list instead (ClientSearch is spec 008).
- **D-007-4 Empty window panel.** Legacy showed "No settlements in period." under the grid; the shell's Empty panel uses that title and keeps the form above it.
- **D-007-5 Amount parse failure.** Legacy `int.Parse` would throw to `Error.aspx`; the row shows `0.00` with a warning (the API already reports `amountError`). The archive has no such message, so parity output is unaffected.
- **D-007-6 Summary figures.** Confirmation / REC / DEL counts and window length are added above the grid (derived from the same rows).

None of these changes a value the legacy `SettlementReader` returns, so spec 011 needs no parity entries for them.

## Key Entities
- **Settlement row**: one MT54x confirmation (API `PvSettlement`) with instrument name and amount.
- **Settlement window**: from / to (inclusive settle dates) and custody account (`SAFE_CODE.PadLeft(7,'0')`).

## Success Criteria *(mandatory)*
- **SC-001**: For every seeded account the screen lists exactly the rows the API returns for the default window (the API itself matches legacy golden output, spec 004).
- **SC-002**: A user can change the window and see the new list in one action (Show).
- **SC-003**: Settlements × 4 states and all settlements flows pass their visual-diff assertions; existing mockup comparisons are unchanged.
- **SC-004**: lint, typecheck, build, test:unit, test:domain, test:backend, test:db and qa:test pass.

## Assumptions
- `acct` is the PV `ACCT_ID`, as for Holdings. `stmt` is ignored by this screen.
- Instrument names come from the API (`instrumentName`, Q13 fallback already applied server-side).
