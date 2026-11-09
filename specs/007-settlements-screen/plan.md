# Implementation Plan: Settlements.aspx → new Settlements screen

**Branch**: `007-settlements-screen` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

## Summary
A new `settlements` screen lists one custody account's MT54x settlement confirmations for a date window, as `Settlements.aspx` did. It is built on spec 010's plumbing: a `settlements` slice in `PV_SLICES`, the `Settlements.aspx` row in `PV_PAGES` pointing at it, and `buildSettlements` in `buildScreens`. It reads `?acct=` and the new optional `?from=&to=` through `parsePvContext`. Data comes only from `GET /api/pv/accounts/:id`, `/accounts/:id/settlements` and `/accounts` (spec 004). The server already applies Q9, Q10, Q15 and Q18, so the screen keeps the API's order and values and only formats them.

## Technical Context
**Stack**: React 18 + TS, `src/api/pv.ts`. No new dependencies, no server or domain changes. **Testing**: `node --test` model tests in `src/model/settlements.test.ts` (added to `test:unit`) and context tests in `src/model/pv/pv.test.ts`. Visual-diff app-only cases with routed `/api/pv/**` fixtures and baselines in `scripts/visual-baselines/`.

## Constitution Check
| Principle | Status |
| --- | --- |
| I Parity | PASS: Q9/Q10/Q14/Q15/Q18 are preserved (server unchanged, screen keeps API order). Divergences D-007-1..6 are named. |
| II Pure core | PASS: no domain changes. The browser uses the HTTP client only. Formatting works on decimal strings without floats. |
| III/IV View models | PASS: `buildSettlements` → `buildScreens`. There are four DataStates, and a live empty window keeps the form. |
| IV Security | PASS: the server's `requireRole` and session are unchanged. `acct`/`from`/`to` are validated client-side and again server-side (spec 004). |
| V No regression | PASS: additive `SCREENS` entry. Mockup screens never see `from`/`to` (`PV_CONTEXT_KEYS` are dropped by `go`). The PV nav group gains "Settlements", but only for signed-in sessions. |
| VII Simplicity | PASS: one slice, one builder, one screen component. |

## Project Structure
```text
src/types.ts                     # + 'settlements' screen, stl* UiState fields
src/model/pv/context.ts          # + optional from/to (ISO or dd/MM/yyyy), parseDateInput
src/model/pv/access.ts           # Settlements.aspx → screen 'settlements'
src/model/pv/slice.ts            # + settlements slice registration
src/model/settlements.ts         # slice def, buildSettlements, formatters
src/model/pv/preview-settlements.ts  # synthetic preview (account 01001-01)
src/model/{shell,screens,index}.ts   # META/EMPTY/ERR, buildPvScreens entry, settlementsRange
src/screens/Settlements.tsx      # screen + range form + account picker
src/App.tsx                      # render + setPvContext
scripts/visual-diff.mjs          # settlements × 4 + flows; query-aware API routing
```
