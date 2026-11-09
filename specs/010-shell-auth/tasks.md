# Tasks: 010 shell auth, roles, Admin, shared PV plumbing

## Phase 1: Setup
- [x] T001 Add `admin` to `SCREENS` and the Admin `UiState` fields in src/types.ts

## Phase 2: Foundational (shared plumbing for 005–009)
- [x] T002 Port the role table (Site.Master + BasePage) to src/model/pv/access.ts
- [x] T003 URL context `?acct=&stmt=` in src/model/pv/context.ts
- [x] T004 Slice registry + `resolvePvSlice` + `PvModelInput` in src/model/pv/slice.ts; preview fixture in src/model/pv/preview.ts
- [x] T005 Session storage + token expiry in src/pv/session.ts; `usePv` hook (sign-in/out, 401, 403, fetch, run) in src/pv/usePv.ts
- [x] T006 Additive model wiring in src/model/shell.ts, screens.ts and index.ts (PV nav group, identity, gates, `buildScreens(…, data|null, pv)`)

## Phase 3: User stories
- [x] T007 [US1] Sign-in panel and Sign out (src/screens/PvGate.tsx, header link in src/App.tsx)
- [x] T008 [US2] Not-authorised panel; PV nav filtered by role
- [x] T009 [US3] `buildAdmin` (src/model/admin.ts) and src/screens/Admin.tsx; four DataStates via shell META/EMPTY/ERR
- [x] T010 [US4] `?acct`/`stmt` in App `Location`; `goPv` keeps context and `go` drops it
- [x] T011 Dev passwords: server/pv/demo-passwords.ts + `npm run pv:demo-passwords`

## Phase 4: Verification
- [x] T012 src/model/pv/pv.test.ts (role table, context, slice mapping, Admin formats, shell unchanged without PV, session), added to test:unit
- [x] T013 visual-diff APP_ONLY mode + baselines: admin × 4, reload confirm/reload, sign-in / invalid / disabled / forbidden / expired / sign-out
- [x] T014 contracts/pv-shell.md; docs/legacy-pv-migration.md divergences; quickstart.md
- [x] T015 lint, typecheck, build, test:unit, test:domain, test:backend, test:db, qa:test; full visual-diff before/after with the mockup counts unchanged
