# Tasks: PV data layer & /api/pv

## Phase 1: Setup
- [x] T001 server/db/pv-schema.sql and pv-seed.sql (converted legacy seed), added to server/db/setup.ts DEFAULT_FILES

## Phase 2: Foundational
- [x] T002 Auth: scrypt, signed token, login, requireSession, requireRole in server/pv/auth.ts; server/pv/set-password.ts + npm script
- [x] T003 Providers: index singleton, pgReconNotes, getInstruments, saveNote in server/pv/context.ts; index warm-up in server/index.ts

## Phase 3: User Stories
- [x] T004 [US1] POST /login, GET /session, and role checks in server/pv/routes.ts
- [x] T005 [US2] accounts, clients, statement dates, holdings, settlements routes
- [x] T006 [US3] position check, save note, Check All routes
- [x] T007 [US4] archive files and raw, admin stats and reload routes
- [x] T008 Mount pvRouter in server/app.ts before the /api 404
- [x] T009 Client src/api/pv.ts + src/api/pv-types.ts

## Phase 4: Verification
- [x] T010 server/pv/api.int.test.ts (golden parity over HTTP, auth, traversal), added to test:int; Vitest excludes *.int.test.ts
- [x] T011 Contracts in specs/004-pv-data-api/contracts/api-pv.md
- [x] T012 Lint, typecheck, build, test:unit, test:backend, test:domain
