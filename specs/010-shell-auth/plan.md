# Implementation Plan: Login/Admin → shell auth, role-gated nav, Admin screen

**Branch**: `010-shell-auth` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

## Summary
The shell gains a PV session: sign-in through `/api/pv/login`, `sessionStorage` token, sign-out and 401 expiry. It gets role-gated "Portfolio Viewer" nav from one role table (the `Site.Master` and `BasePage` port), a 403 "not authorised" panel and a new `admin` screen. The shared PV slice pattern (URL context → loader → DataState) feeds `buildScreens`, so specs 005–009 only register a slice and a view-model builder.

## Technical Context
**Stack**: React 18 + TS, with the existing `src/api/pv.ts` client. There are no new dependencies and no server route changes. The only server addition is a dev script, `server/pv/demo-passwords.ts`. **Testing**: `node --test` model and session tests (`src/model/pv/pv.test.ts`, part of `test:unit`), plus visual-diff app-only cases with text assertions and baselines in `scripts/visual-baselines/`.

## Constitution Check
| Principle | Status |
| --- | --- |
| I Parity | PASS: roles, legacy messages and the Admin date format (Q14/Q17) are preserved. Divergences D-010-1..5 are named in the spec. |
| II Pure core | PASS: no domain changes. The browser uses the HTTP client only. |
| III Single source / IV view models | PASS: `PV_PAGES` is the single role table. Admin renders from `buildAdmin` via `buildScreens`. There are four DataStates. |
| IV Security | PASS: server `requireRole` is unchanged, and the client gate is UX only. No passwords are committed. The dev script refuses `NODE_ENV=production`. |
| V No regression | PASS: with no session, the existing screens build the same shell model. The mockup diff counts are identical before and after. |
| VII Simplicity | PASS: one hook (`usePv`) and one registry (`PV_SLICES`). Legacy files are listed in the spec. |

## Project Structure
```text
src/model/pv/access.ts      # PV_PAGES (Site.Master + RequiredRoles), canAccess, pvNavFor
src/model/pv/context.ts     # parsePvContext (?acct=&stmt=)
src/model/pv/slice.ts       # PvSliceDef, PV_SLICES registry, pvSliceFor, resolvePvSlice, PvModelInput
src/model/pv/preview.ts     # preview identity + Admin preview fixture (?state=Populated without session)
src/model/admin.ts          # buildAdmin + dd/MM/yyyy formatters
src/model/{shell,screens,index}.ts   # additive: admin META/EMPTY/ERR, PV nav group, gates; buildScreens(…, data|null, pv)
src/pv/session.ts           # sessionStorage + token expiry
src/pv/usePv.ts             # session, sign-in/out, 401/403, slice fetch, mutations
src/screens/Admin.tsx, src/screens/PvGate.tsx
src/App.tsx                 # ?acct/&stmt in Location, goPv, gate panels, Sign out
server/pv/demo-passwords.ts # npm run pv:demo-passwords (local/dev)
scripts/visual-diff.mjs     # APP_ONLY cases + baselines
```
