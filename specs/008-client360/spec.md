# Feature Specification: ClientSearch + ClientSummary → Client 360 (Portfolio Viewer migration 008)

**Feature Branch**: `devin/*-spec-008-client360` (PR into `devin/1794237508-legacy-pv-migration`)
**Created**: 2026-11-09
**Status**: Implemented
**Input**: "ClientSearch.aspx + ClientSummary.aspx → Client360. Search by client name or reference; summary shows client details, adviser, accounts with latest statement date and total GBP market value, and links to holdings/settlements (and position check for OPS/ADMIN). The existing Whitfield Client360 stays the default view. Custody client search/summary appears in the PV context."

Legacy sources: `src/PV.Web/ClientSearch.aspx(.cs)`, `ClientSummary.aspx(.cs)`, `PV.Data/ClientData.cs`, `AccountData.cs`, `db/schema/02_procs.sql` (`usp_ClientSearch`), `App_Code/WebUtil.cs`, `DateUtil.cs`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search custody clients (Priority: P1)

A signed-in Portfolio Viewer user (any role) opens **Client search** from the Portfolio Viewer nav group, types part of a client name or the start of a client reference and presses Search. Matching clients are listed by client name, 25 per page, with Client ref, Client name (link), Adviser, Status and No. accts.

**Independent Test**: `?screen=clients&q=smith` signed in → results; `?screen=clients&state=Populated` → preview fixture; visual-diff `clients-*`, `flow-clients-search`, `flow-clients-page2`, `flow-clients-no-results`.

**Acceptance Scenarios**:
1. **Given** a signed-in user, **When** they search `penhal`, **Then** "The Penhaligon Family Trust" is listed (name contains, case-insensitive).
2. **Given** a signed-in user, **When** they search `C2017`, **Then** every client whose reference starts with `C2017` is listed; a reference that only *contains* the text is not.
3. **Given** a search with no matches, **Then** the search box stays and "No clients found." shows under it (legacy `lblMsg`).
4. **Given** more than 25 matches, **Then** a numeric pager (plus Previous/Next) pages the grid without re-querying.
5. **Given** a blank search, **Then** every client is listed (legacy `LIKE '%%'`).

### User Story 2 - Custody Client 360 summary (Priority: P1)

From the results the user clicks a client name and sees the custody **Client 360**: client ref, name, adviser, status and client-since; every account (ordered by account number, open and closed) with type, base currency, safe code, status, opened/closed dates, latest statement date and GBP market value; the grand total GBP; and per-account links to Holdings and Settlements, plus Position check for OPS/ADMIN.

**Independent Test**: `?screen=c360&cid=1001` signed in; `?screen=c360&cid=1001&state=<State>`; visual-diff `c360pv-*`, `flow-clients-open-summary`, `flow-c360pv-*`; backend golden test over every client.

**Acceptance Scenarios**:
1. **Given** client 1001, **Then** accounts 01001-01 (09-OCT-2026, 283,880.39) and 01001-02 (09-OCT-2026, 76,295.23) and Grand Total (GBP) 360,175.62 are shown — equal to the legacy golden MT535 lines.
2. **Given** an account with no MT535 statement, **Then** Stmt date and Mkt value show `-`, there is no Holdings link, and the account is left out of the grand total.
3. **Given** an ADVISER, **Then** no Position check link is shown; OPS and ADMIN see it.
4. **Given** an unknown `cid`, **Then** the Empty state "Client not found" is shown.
5. **Given** the user clicks "Back to search", **Then** the last search (`?q=`) is shown again.

### User Story 3 - Whitfield Client 360 stays the default (Priority: P1)

`?screen=c360` (no `cid`) and every mockup state remain the Whitfield household mockup, pixel-identical.

**Independent Test**: mockup visual-diff `c360-*` unchanged; unit test `pvSliceFor('c360', {})` is null.

### Edge Cases
- `cid` malformed (`abc`, `0`) → ignored by `parsePvContext` → Whitfield Client 360 (spec 010 rule: malformed context is ignored).
- Search text is passed untrimmed (legacy `txtSearch.Text`); `?q=%20smith` searches " smith".
- Signed out on `?screen=c360&cid=…` → sign-in panel; the deep link survives sign-in (D-010-1).
- Link targets whose screen spec has not landed (`PV_PAGES.screen === null`) are shown disabled, then become live with no change here once 005/006/007 set their rows.

## Requirements *(mandatory)*

- **FR-001** New screen id `clients` (Client search), registered in `SCREENS`, `PV_SLICES` (`needs: 'none'`) and `PV_PAGES['ClientSearch.aspx'].screen`.
- **FR-002** `c360` registers a PV slice active only when `?cid=` is present (`PvSliceDef.active`, additive); `PV_PAGES['ClientSummary.aspx'].screen = 'c360'`.
- **FR-003** `PvContext` gains `cid` (positive int) and `q` (raw string, null when absent); both in `PV_CONTEXT_KEYS`, so mockup navigation drops them and PV navigation keeps them.
- **FR-004** Search uses the existing `GET /api/pv/clients/search?q=` (spec 004: name contains / ref prefix, case-insensitive, ordered by name, all accounts counted).
- **FR-005** New `GET /api/pv/clients/:clientId/summary` returns the client, its accounts (`ORDER BY acct_no`) each with `stmtDate` (latest statement, Q8 highest file sequence) and `mktValGbp` (Σ line `MktValGbp`, exact decimal), and `totalMktValGbp` (Σ of accounts with a statement, null if none). Any role; 404 unknown; 400 malformed id.
- **FR-006** View models in `src/model/clients.ts` built through `buildScreens` (`clientSearch`, `client360`); screens render only from the model.
- **FR-007** Formats: dates `dd-MMM-yyyy` uppercase (Q14, `DateUtil.FormatDate`); money `#,##0.00` (Q14, `WebUtil.FmtMoney`); status via `WebUtil.StatusText` (A/D/C, otherwise raw code); account status `O` → Open, else Closed.
- **FR-008** All four DataStates reachable for both screens via `?state=`. Search: Empty = blank search with no clients on file; Summary: Empty = client not found (404).
- **FR-009** Visual-diff app-only cases: `clients-<State>`, `c360pv-<State>` and flows (search, paging, no results, open summary, adviser/closed account, back to search, not found, sign-in).

## Quirk decisions
- Q14 preserved (dd-MMM-yyyy, #,##0.00). Q8 preserved (latest statement = highest file sequence). Q17 preserved (any signed-in role for both pages; Position check link only for OPS/ADMIN, matching `PositionCheck.aspx` RequiredRoles).
- Legacy `usp_ClientSearch` semantics preserved via spec 004's route.

## Divergences (explicit)
- **D-008-1** The last search lives in the URL (`?q=`) and is re-queried, where legacy cached the DataTable in `Session["LastClientSearch"]`.
- **D-008-2** Unknown client is an in-place Empty state ("Client not found"), where legacy redirected to `ClientSearch.aspx`. A malformed `cid` falls back to the Whitfield Client 360 (spec 010 context rule).
- **D-008-3** Account rows also link to Position check for OPS/ADMIN (legacy ClientSummary had only Holdings/Settlements; requested by the migration brief). Holdings and Position check links carry the latest statement date; legacy Holdings defaulted to the latest statement, so the result is the same.
- **D-008-4** A numeric pager with Previous/Next replaces the postback GridView pager (same 25 rows per page).
- **D-008-5** Client 360 adds a KPI strip (grand total, account count, latest statement, adviser) above the legacy fields; all figures come from the same summary data.

## Key Entities
- `PvClientSearchRow` (spec 004), `PvClientSummary` / `PvClientSummaryAccount` (new wire types), `ClientSearchData`, `ClientSummaryData` (slice data).

## Success Criteria *(mandatory)*
- **SC-001** Backend test: for every golden client, summary account order, latest statement date and GBP value equal the legacy golden; total equals Σ.
- **SC-002** Mockup visual-diff for all existing screens unchanged; app-only cases for 008 pass with assertions.
- **SC-003** lint, typecheck, build, test:unit, test:domain, test:backend, test:db, qa:test pass.

## Assumptions
- `clients` is a new screen id because legacy search has no mockup counterpart; the custody summary reuses `c360` so "Client 360" means the same thing in both contexts.
- Links to Holdings/Settlements/Position check resolve through `PV_PAGES`, so the parallel specs 005–007 light them up by setting their rows.
