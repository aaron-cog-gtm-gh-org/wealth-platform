# Feature Specification: PV data layer & `/api/pv` (Portfolio Viewer migration 004)

**Feature Branch**: `004-pv-data-api`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: "Data layer decision: replace PV.Data/SqlHelper with either a lightweight API/service layer or in-repo data adapters feeding src/model; keep db/ schema as reference." This feature ports the APP_USER/CLIENT/ACCOUNT/INSTRUMENT/RECON_NOTE schema and seed data to a dedicated PostgreSQL schema. It exposes `/api/pv/*` and a client in `src/api/` for the screen specs 005–010.

## Decision

The constitution's default is kept, so **no amendment** is needed. Express serves `/api/pv/*` from:
- an archive index built when the process starts (`server/index.ts`, legacy `Application_Start`), and
- PostgreSQL schema `pv`, loaded by `npm run db:setup` from `server/db/pv-schema.sql` and `server/db/pv-seed.sql`.

The legacy `db/` scripts remain reference only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with legacy roles (P1)
A Portfolio Viewer user signs in and gets the same access as the legacy roles.

**Acceptance Scenarios**:
1. The user name is matched with `upper(trim())`, as in `usp_GetUserByName`, and `last_login_dt` is set.
2. A wrong password returns 401. `ACTIVE_FLG <> 'Y'` returns 403 "Account disabled."
3. ADVISER can use accounts, clients, holdings and settlements. OPS and ADMIN can additionally use the position check (and save notes) and the archive files. Only ADMIN can use admin.
4. Legacy SHA1 hashes are not imported, so seeded users cannot sign in until `npm run pv:set-password` sets a scrypt hash (Q17).

### User Story 2 - Reference and archive reads (P1)
The screens read accounts (ORDER BY ACCT_NO), client search (`usp_ClientSearch`: name contains, or ref starts with, case-insensitive), client detail, statement dates, holdings (default: latest) and settlements (default: latest statement − 90 days to latest, else today, Q15).

**Independent Test**: the API equals the golden output for all 120 accounts: account rows, statement dates, default settlements and holdings.

### User Story 3 - Position check and notes (P1)
The position check and Check All use the PostgreSQL RECON_NOTE and INSTRUMENT providers. Saving a note updates the existing row, otherwise inserts one, and stamps it with the session user and `localtimestamp`.

**Independent Test**: all 7 golden breaks and all 26 Check All days are reproduced via HTTP using only the seed data.

### User Story 4 - Message browser and admin (P2)
- The file list is filtered by type, SAFE (leading zeros trimmed, Q16) and date. A raw file is only served when its path is in the archive index, so `..` or absolute paths return 404.
- Admin stats show the archive counts plus the users, without hashes. Reload rebuilds the index.

## Requirements *(mandatory)*

- **FR-001**: Schema `pv` contains five tables that mirror the legacy columns (snake_case). `password_hash` replaces `PWD_HASH`, and `stmt_dt` is a `date`.
- **FR-002**: The seed holds every legacy seed row with unchanged values: 6 users, 50 clients, 120 accounts, 302 instruments and 13 notes. `PWD_HASH` is dropped. The SQL was converted once and committed. There is no generator script.
- **FR-003**: All SQL is parameterized. Authorization is checked on the server for every route (signed bearer token with HMAC-SHA256, `PV_SESSION_SECRET`, 8 h).
- **FR-004**: Decimals are serialized as strings in the legacy scale.
- **FR-005**: The routes, `src/api/pv.ts` and `src/api/pv-types.ts` are documented in `contracts/api-pv.md`.
- **FR-006**: Existing routes, screens, the workspace and the QA harness are unchanged. `/api/test/reset` does not touch `pv`.

## Decisions

| Topic | Decision |
| --- | --- |
| Auth storage | scrypt (`scrypt$salt$hash`). Users without a hash cannot sign in. There is no SHA1 fallback. |
| Session | Stateless signed token. Without `PV_SESSION_SECRET`, the secret is random per process, so tokens stop working on restart. |
| Search collation | SQL Server CI collation becomes `ILIKE`. LIKE wildcards typed by the user act as wildcards, as they did in the legacy app. |
| Order | Account order uses `COLLATE "C"`, which is ordinal and matches the golden output. |
| Instrument cache | The map is loaded once per process (Q13). |
| Admin reload | `POST /admin/archive/reload` (legacy `btnReload`). |

## Quirk decisions
Q12, Q13, Q15, Q16 and Q17 are preserved. The domain quirks (Q1–Q11, Q18) come unchanged from 001–003. **No divergences.**

## Success Criteria *(mandatory)*
- **SC-001**: `server/pv/api.int.test.ts` passes, including the golden parity and the auth and path-traversal cases.
- **SC-002**: Lint, typecheck, build, test:unit, test:backend and test:domain pass.
