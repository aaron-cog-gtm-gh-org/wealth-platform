# Feature Specification: Login/Admin → shell auth, role-gated nav, Admin screen (Portfolio Viewer migration 010)

**Feature Branch**: `010-shell-auth`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: "Login/Admin → shell auth concern (legacy Login.aspx, Admin.aspx, Site.Master, App_Code/BasePage.cs)". This spec lands before the other screen specs (005–009). It also provides the shared Portfolio Viewer (PV) plumbing that those specs reuse: session, roles, URL context and slice loading. That plumbing is documented in `contracts/pv-shell.md`.

Legacy files replaced: `src/PV.Web/Login.aspx(.cs)`, `Admin.aspx(.cs)`, `Site.Master(.cs)` (header user panel, log out, role nav) and `App_Code/BasePage.cs` (session gate and `RequiredRoles`). The `WebUtil.FmtDt` usage on Admin is ported as an Admin formatter.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in to the Portfolio Viewer from the shell (Priority: P1)
A Portfolio Viewer user opens a PV screen or deep link (for example `?screen=admin` or a later `?screen=portfolio&acct=2001&stmt=2026-09-18`). If they are not signed in, the shell asks for their user ID and password in place of the screen. After signing in they stay on the URL they asked for.

**Why this priority**: every migrated screen depends on a PV session, and no other PV screen works without it.

**Independent Test**: open `?screen=admin` signed out. Sign in as PVADMIN and the Admin screen loads. Sign out and the sign-in panel returns.

**Acceptance Scenarios**:
1. **Given** no session, **When** a PV screen is opened, **Then** a sign-in panel is shown and no PV data is requested.
2. **Given** a wrong user ID or password, **When** the user signs in, **Then** the panel shows "Invalid user ID or password." (legacy text).
3. **Given** an inactive user (`active_flg <> 'Y'`), **When** the user signs in, **Then** the panel shows "Your account has been disabled. Please contact Support (ext. 4417)." (legacy text and `SupportExt`).
4. **Given** a valid sign-in, **Then** the header shows the PV user's name and role with a "Sign out" link. The user ID is matched case- and space-insensitively.
5. **Given** a signed-in user, **When** they choose Sign out, **Then** the stored token is discarded and PV screens show the sign-in panel again.
6. **Given** a stored token that the API rejects with 401 (expired, or the server secret rotated), **When** any PV request is made, **Then** the session is cleared. The sign-in panel then shows "Your session has expired. Sign in again." and keeps the URL.

### User Story 2 - Role-gated navigation and "not authorised" (Priority: P1)
Navigation and access follow `Site.Master` and `BasePage`:
- ADVISER, OPS and ADMIN all get Client search, Holdings and Settlements.
- OPS and ADMIN also get Position Check and Message Browser.
- ADMIN also gets Admin.

The server enforces the same rules.

**Independent Test**: the role table unit test covers every legacy page × role. Sign in as LBRENNAN (OPS) and open `?screen=admin`, and the "not authorised" panel is shown. Calling the API directly returns 403.

**Acceptance Scenarios**:
1. **Given** a signed-in user, **Then** a "Portfolio Viewer" nav group lists the legacy pages that the role may open and that have a migrated screen. Pages whose screen spec has not landed yet are not listed.
2. **Given** a user whose role is not allowed on the screen, **When** they open it, **Then** a "not authorised" panel names the required roles and no PV data is requested.
3. **Given** the API answers 403 for a slice, **Then** the same panel is shown.
4. Role comparison is exact (`r == CurrentRole`), as in BasePage.

### User Story 3 - Admin screen (Priority: P2)
ADMIN users see:
- the archive status: MT535 files, MT54x files, statements, confirmations, statement accounts, confirmation folders, parse errors, last loaded and load time;
- the parse error log;
- a "Reload archive" action, confirmed first;
- the user list: user ID, name, role, active and last login.

**Independent Test**: `?screen=admin&state=Populated|Loading|Empty|Error` render without signing in (design preview). The visual-diff app-only cases and the reload flow pass.

**Acceptance Scenarios**:
1. Counts equal `/api/pv/admin/stats`. Last loaded shows `dd/MM/yyyy HH:mm:ss` and last login shows `dd/MM/yyyy HH:mm` (Q14 Admin format). Load time shows `N ms`.
2. **When** Reload archive is chosen, **Then** an inline confirmation asks "Reload the archive index?". On confirm it calls `POST /admin/archive/reload`, refreshes the figures and shows "Archive reloaded.".
3. Empty = the index holds no MT535 and no MT54x files. Error = stats could not be loaded (non-auth failure), with Retry.

### User Story 4 - Shared PV loading pattern for screens 005–009 (Priority: P1)
A screen spec registers a PV slice with:
- the roles allowed,
- whether it needs PV context (`acct` / `stmt` from the URL),
- a loader that calls the API client, and
- an "is empty" rule.

The shell maps that slice onto the four DataStates.

**Independent Test**: unit tests over the URL parser, role table and slice→DataState mapping. All existing visual-diff mockup comparisons are unchanged.

**Acceptance Scenarios**:
1. `?acct=<digits>&stmt=<yyyy-mm-dd>` are parsed into the PV context. Invalid values are ignored, so the PV context is null.
2. Screens without a registered PV slice, or that need `acct` when none is present, behave exactly as today. Their default view is pixel-identical, and nothing is shown or requested for PV.
3. `?state=Loading|Empty|Error` forces that state for PV screens. Without a session, `?state=Populated` renders a fixed design-preview slice and preview identity, so the harness never needs to sign in. With a session, `?state=Populated` shows live data, as existing screens do.

### Edge Cases
- Corrupt or unparsable stored session → treated as signed out.
- Session storage unavailable → the session is kept in memory only.
- Whitfield (mockup) data failing to load does not affect a PV screen's state, and vice versa.
- Navigating from a PV screen to the existing Whitfield nav drops `acct` / `stmt`. PV nav items keep them.
- Double-clicking Sign in sends a single request. The button is disabled while the request is pending.

## Requirements *(mandatory)*

- **FR-001**: The shell owns sign-in (`POST /api/pv/login`), session storage (per-tab `sessionStorage`, like the legacy non-persistent auth cookie), sign-out, the expired-token (401) path and the not-authorised (403) path.
- **FR-002**: A role/nav table ports `Site.Master` and `BasePage.RequiredRoles` for the six legacy pages. It is the single source for nav visibility and client-side gating. The server keeps `requireRole` on every route.
- **FR-003**: There is a new screen id `admin` with four DataStates, rendered from `src/model` via `buildScreens`.
- **FR-004**: A PV slice registry and loader hook feed `buildScreens`. This is documented in `contracts/pv-shell.md`.
- **FR-005**: Synthetic demo passwords for seeded active users are set through a documented local/dev path. The password comes from an environment variable, the path refuses to run when `NODE_ENV=production`, and no plaintext password is committed.
- **FR-006**: `scripts/visual-diff.mjs` gains app-only cases with text assertions and optional per-case PNG baselines: admin × 4 states, the sign-in panel, a reload flow, and sign-in / not-authorised / expired flows using routed API responses. The mockup cases are unchanged.
- **FR-007**: The existing screens' default view, the mockup diff, unit/backend/db tests, `qa:test` and the workspace are unchanged.

## Quirk decisions

| Quirk | Decision |
| --- | --- |
| Q14 (Admin `dd/MM/yyyy`) | **Preserved**. Admin shows `dd/MM/yyyy HH:mm:ss` for the last load and `dd/MM/yyyy HH:mm` for last login. |
| Q17 roles | **Preserved**. The roles are ADVISER / OPS / ADMIN, matched exactly. Pages without `RequiredRoles` need any signed-in user. |
| Q17 SHA1 | **Not carried forward**. This was already decided in spec 004 (scrypt). |

## Divergences (explicit)

- **D-010-1 Deep links survive sign-in.** Legacy `BasePage` redirected to `Login.aspx` and then always to `ClientSearch.aspx`. Now the requested URL, including `acct` / `stmt`, is kept.
- **D-010-2 Not authorised is shown in place of the screen.** Legacy redirected to `ClientSearch.aspx?err=1`. Now the panel explains which roles are needed. There is no redirect.
- **D-010-3 Archive root is not displayed.** Legacy Admin showed the server filesystem path. The API does not expose it, to avoid disclosing paths. Statement accounts and confirmation folders are shown instead.
- **D-010-4 Reload confirmation is inline.** Legacy used `confirm()`. The legacy prompt text is kept.
- **D-010-5 Expired session message.** Legacy silently redirected to the login page when the session expired. Now the sign-in panel says the session has expired.

None of these touches a catalogued domain quirk (Q1–Q13, Q15, Q16, Q18), so spec 011 needs no parity entries for them.

## Key Entities
- **PV session**: token, user (id, username, full name, role), expiry.
- **PV context**: `acct` (account id) and `stmt` (statement date) taken from the URL.
- **PV slice**: per-screen loaded data plus its status (idle / loading / ready / error / unauthorised / forbidden).
- **Legacy page entry**: page name, nav label, required roles and target screen.

## Success Criteria *(mandatory)*
- **SC-001**: Each of the three seeded active users (PVADMIN, LBRENNAN, JSMITH) can sign in with the dev password and sees exactly the nav entries their role allows.
- **SC-002**: 100% of the existing mockup visual-diff cases have the same pixel-diff counts as before this feature.
- **SC-003**: Admin × 4 states and all app-only flows pass their assertions.
- **SC-004**: lint, typecheck, build, test:unit, test:domain, test:backend, test:db and qa:test pass.

## Assumptions
- `acct` is the PV `ACCT_ID` (legacy `Holdings.aspx?acct=`), and `stmt` is an ISO date. Specs 005–009 may add more keys through the same parser.
- Tokens are stateless (spec 004), so sign-out discards the token on the client. This is equivalent to legacy `FormsAuthentication.SignOut`, which also only removes the cookie.
