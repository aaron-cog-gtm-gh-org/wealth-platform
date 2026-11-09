# Feature Specification: MessageBrowser.aspx → Message Browser screen (Portfolio Viewer migration 009)

**Feature Branch**: `009-message-browser`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: "MessageBrowser → new screen (preserve dd/MM/yyyy input quirk or spec an ISO replacement explicitly)". Legacy behaviour: OPS/ADMIN only; filter by type (MT535 / MT54x), date and safe account (leading zeros trimmed); file list; raw message viewer served only by index lookup. Quirk Q16. Decision (parent default): replace the `dd/MM/yyyy` text box with a native date input, keep accepting legacy `dd/MM/yyyy` values in `?date=`, and name that as divergence D-009-1.

Legacy files replaced: `src/PV.Web/MessageBrowser.aspx`, `MessageBrowser.aspx.cs`, `MessageBrowser.designer.cs`, and the Message Browser uses of `App_Code/WebUtil.cs` (`TryParseUkDate`, `FmtDt`). Builds on spec 010 (`specs/010-shell-auth/contracts/pv-shell.md`) and the spec 004 API.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List archive files by type, date and safe code (Priority: P1)
An operations user (OPS or ADMIN) opens the Message browser, chooses a message type (All / MT535 / MT54x), a date and a safe code, and selects **List**. The screen lists the matching archive files (file name, message type, date, size), 50 per page.

**Why this priority**: listing is the reason the page exists; the viewer needs a file to open.

**Independent Test**: sign in as LBRENNAN, open `?screen=messages`, choose MT535, 18/09/2026 and safe `0010024`, select List: exactly `MT535_10024_20260918_001.txt` is listed.

**Acceptance Scenarios**:
1. **Given** no filter in the URL, **When** the screen opens, **Then** the filter form is shown with no list and no archive request (legacy `Page_Load` only lists when `type` or `date` is present).
2. **Given** filters, **When** List is selected, **Then** the URL becomes `?screen=messages&type=<535|54x|>&date=<yyyy-mm-dd>&safe=<text>` and the list matches `/api/pv/archive/files` for those filters, in index order (ordinal by archive path).
3. **Given** a safe code with leading zeros or spaces (` 0016598 `), **Then** it matches files whose safe code equals it after trimming spaces and leading zeros (Q16). A safe code of only zeros is no filter (legacy `TrimStart('0')` → empty).
4. **Given** more than 50 matches, **Then** a pager shows 50 rows per page (legacy `PageSize=50`). Selecting List again returns to page 1.
5. **Given** filters that match nothing, **Then** the screen shows the Empty state "No files match" (legacy `lblMsg` text) with a "Clear filters" action.
6. The Date column shows `dd/MM/yyyy` (Q14, `WebUtil.FmtDt`). Size shows the byte count as a plain integer (legacy BoundField, no format).

### User Story 2 - Dates: native ISO input, legacy dd/MM/yyyy still accepted (Priority: P1)
The date filter is a native date input (ISO `yyyy-mm-dd`). Existing bookmarks and links that carry the legacy `dd/MM/yyyy` format keep working.

**Independent Test**: `?screen=messages&type=535&date=18/09/2026` and `?screen=messages&type=535&date=2026-09-18` list the same 118 files; the date input shows 18 September 2026 in both cases.

**Acceptance Scenarios**:
1. **Given** `?date=dd/MM/yyyy` (exactly two-digit day and month, four-digit year, a real calendar date, surrounding spaces ignored, as `TryParseExact("dd/MM/yyyy")`), **Then** it is used as that date.
2. **Given** `?date=yyyy-mm-dd` (a real calendar date), **Then** it is used as that date.
3. **Given** any other non-blank `?date=` (`31/02/2026`, `1/9/2026`, `2026-9-18`, `abc`), **Then** no list is requested and the form shows "Enter date as yyyy-mm-dd or dd/MM/yyyy." (legacy: "Enter date as dd/MM/yyyy.").
4. **Given** a blank `?date=`, **Then** no date filter applies.
5. List always writes the date to the URL as `yyyy-mm-dd`.

### User Story 3 - View a raw message (Priority: P1)
Selecting a file name opens its raw SWIFT text in a viewer. Files are served only by looking the name up in the archive index, never by building a path from the URL.

**Independent Test**: open `?screen=messages&file=MT535_10024_20260918_001.txt`: the viewer shows the archive path `mt535/MT535_10024_20260918_001.txt` and the raw message starting `{1:F01`. `?file=../package.json` shows "File not found.".

**Acceptance Scenarios**:
1. **Given** `?file=<name>` (legacy `MessageBrowser.aspx?file=`), **Then** the first index entry with that file name (index order) is shown with its archive-relative path, via `/api/pv/archive/files/raw?file=`.
2. **Given** a name that is not an indexed file (including any path), **Then** the viewer shows "File not found." and nothing is read from disk.
3. **Given** a file opened from the list, **Then** the list and filters stay on screen beside the viewer; Close removes `file` from the URL.
4. The raw text is shown as text (never as HTML), preserving line breaks.

### User Story 4 - Access, states and navigation (Priority: P2)
**Acceptance Scenarios**:
1. Only OPS and ADMIN may open the screen (Q17, `RequiredRoles = { "OPS", "ADMIN" }`); ADVISER sees the spec 010 not-authorised panel and the API returns 403. Signed out, the sign-in panel is shown and the URL (filters included) survives sign-in.
2. The "Portfolio Viewer" nav group lists "Message browser" for OPS and ADMIN only.
3. `?screen=messages&state=Populated|Loading|Empty|Error` render without a session (design preview); Populated shows a fixed synthetic list (MT535, 18/09/2026, 118 files, 3 pages) with one file open.
4. Error = the list or file request failed for a reason other than 401/403/404, with Retry.
5. Leaving the screen through any nav item drops the Message Browser URL keys (`type`, `date`, `safe`, `file`).

### Edge Cases
- Unknown `?type=` value (e.g. `?type=x` or `?type=`) → type "All", and the list is still requested (legacy `Request["type"] != null`).
- `?file=` together with filters → both the list and the file are shown (D-009-3). `?file=` alone → only the viewer.
- Page number beyond the last page (list shrank) → the last page is shown.
- Duplicate file names do not exist in the archive today (6,044 unique); if they appear, the first in index order wins, as in legacy.

## Requirements *(mandatory)*
- **FR-001**: New screen id `messages` with four DataStates, rendered from `src/model` through `buildScreens`, registered in `PV_SLICES` (`needs: 'none'`) and on the `MessageBrowser.aspx` row of `PV_PAGES`.
- **FR-002**: Filters live in the URL (`type`, `date`, `safe`, `file`), parsed into the PV context additively; the presence of `type`, `date` or `safe` (even blank) requests the list.
- **FR-003**: The browser calls only the HTTP API: `GET /api/pv/archive/files` for the list and `GET /api/pv/archive/files/raw?file=` for the viewer. The raw route gains a `file` (name) lookup next to `path`, both resolved through the archive index only, and reports the archive-relative path in `X-Archive-Path`.
- **FR-004**: Date parsing accepts ISO and legacy `dd/MM/yyyy` (US2) and is unit-tested for both.
- **FR-005**: Client-side paging of 50 rows; page index is UI state, reset by List.
- **FR-006**: `scripts/visual-diff.mjs` gains app-only cases `messages-<State>` × 4 and flows (filter + List, legacy date link, ISO date link, invalid date, open file, file not found, next page, adviser forbidden) with baselines in `scripts/visual-baselines/`. Mockup cases are unchanged.
- **FR-007**: Existing mockup screens stay pixel-identical; unit/backend/db tests, `qa:test` and the workspace keep passing.

## Quirk decisions

| Quirk | Decision |
| --- | --- |
| Q16 date entered as `dd/MM/yyyy` | **Changed** (D-009-1): native ISO date input; `?date=` accepts ISO and legacy `dd/MM/yyyy`. |
| Q16 safe filter trims leading zeros | **Preserved** (server trims zeros, client trims spaces). |
| Q16 files served only by index lookup under the archive root | **Preserved** (name or path lookup in the index; never a user-built path). |
| Q14 Message Browser `dd/MM/yyyy` display | **Preserved** for the Date column. |
| Q17 OPS/ADMIN only | **Preserved** (client gate + server `requireRole`). |

## Divergences (explicit)
- **D-009-1 ISO date input.** Legacy had a free-text box that only accepted `dd/MM/yyyy` ("Enter date as dd/MM/yyyy."). Now the input is a native date picker (ISO), List writes `?date=yyyy-mm-dd`, and `?date=` also accepts the legacy `dd/MM/yyyy` form so old links keep working. Invalid text shows "Enter date as yyyy-mm-dd or dd/MM/yyyy.". The set of files matched for a valid date is unchanged.
- **D-009-2 Archive-relative path.** Legacy `lblPath` showed the server's full filesystem path. The viewer shows the archive-relative path (same reasoning as D-010-3).
- **D-009-3 List stays beside the viewer.** Legacy `?file=` returned before listing. Opening a file from the list keeps the list; a bare `?file=` link still shows only the viewer.
- **D-009-4 Filters are in the URL.** Legacy read the safe code only from the postback form and kept the list in `Session["MsgBrowserList"]` for paging. Now `safe` is a URL key like `type`/`date`, and paging works on the loaded list in the page. Matching is unchanged.
- **D-009-5 "No files match" is the Empty state.** Legacy showed the text under the form. Now the shell Empty panel shows it with a "Clear filters" action.

None changes which files match a filter or the bytes served, so spec 011 needs no parity entries beyond noting D-009-1 (input format only).

## Key Entities
- **Message query**: type (MT535 / MT54x / all), date (ISO, parsed from ISO or `dd/MM/yyyy`), safe code text, file name, whether a list is requested, date error.
- **Archive file**: archive path, file name, message type, date, safe code, size (spec 004 `PvArchiveFile`).
- **Raw message**: file name, archive path, raw text, or not found.

## Success Criteria *(mandatory)*
- **SC-001**: For any valid date, the legacy and ISO forms of `?date=` list identical files.
- **SC-002**: An OPS user finds and opens a given day's statement for a safe code in three actions (choose filters, List, select the file).
- **SC-003**: 100% of the existing mockup visual-diff cases keep their pixel-diff counts; messages × 4 states and all new flows pass.
- **SC-004**: lint, typecheck, build, test:unit, test:domain, test:backend, test:db and qa:test pass.

## Assumptions
- `type` keeps the legacy URL values `535` / `54x`; anything else means All.
- The archive is small enough (6,044 files) that the filtered list is returned whole and paged in the browser; the API has no paging (spec 004 contract).
- The raw viewer shows text as served; MT files are ASCII.
