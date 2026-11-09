# Implementation Plan: 006 PositionCheck.aspx → SettlementExceptions

**Branch**: `006-position-check` | **Spec**: [spec.md](spec.md)

## Summary
Add the Position check screen as a PV slice on the existing `exceptions` screen id, active only with PV context. Reuse the spec 004 position-check API and the spec 010 shell (session, roles, slice states, `goPv`, app-only visual diff). Add one read endpoint for the all-account date list.

## Technical Context
- React 18 + Vite + TypeScript, Express API, PostgreSQL 16 (RECON_NOTE), node:test for models, Vitest for domain/golden, Playwright visual-diff.
- Browser → `src/api/pv.ts` only. Domain code stays server-side.
- Constraints: mockup `exceptions` default view pixel-identical; shared files changed additively (other screen specs land in parallel).

## Constitution Check
| Principle | How |
| --- | --- |
| I Behavioural parity | Q11/Q12/Q18 come from the ported domain via the API unchanged; messages and formats copied from PositionCheck.aspx.cs / WebUtil / DateUtil; divergences D-006-1…6 named in the spec. |
| II Pure domain | No domain change. The view model is pure (inputs → props). |
| III Test-first | `src/model/pv/position-check.test.ts`; API integration test for `/position-check/dates`. |
| IV View-model contract | `buildPositionCheck` in `src/model/pv/`, exposed as `posCheck` via `buildScreens`. |
| V No regressions | Slice inactive without PV context; full visual-diff shows mockup cases unchanged. |
| VI Secure by default | OPS/ADMIN gate client and server; server stamps `UPDATED_BY`; synthetic data only. |
| VII Traceability | Spec, tasks, docs/legacy-pv-migration.md decisions, contract delta. |

## Design
- `src/model/pv/context.ts`: add `pc` (boolean, only `pc=1`) and `all` (ISO date) to `PvContext` / `PV_CONTEXT_KEYS`.
- `src/model/pv/slice.ts`: optional `active(ctx)` on `PvSliceDef` (checked by `pvSliceFor` after `needs`); register `exceptions`; add `PvOp` `{kind: 'saveReconNote', acctId, note}`.
- `src/model/pv/position-check.ts`: `loadPositionCheck`, `positionCheckSlice`, `saveReconNote`, `fmtQty`, `buildPositionCheck`.
- `src/model/pv/access.ts`: `PositionCheck.aspx` → `screen: 'exceptions'`, `params: {pc: '1'}` (nav passes params to `goPv`).
- `src/model/shell.ts`: PV-specific META/EMPTY/ERR text for `exceptions` when the slice is active; the mockup "Settlement exceptions" nav item is not marked active then.
- `src/pv/usePv.ts`: `run` handles `saveReconNote`.
- `src/App.tsx`: `goPv(screen, patch)` writes context keys; render `<PositionCheck>` instead of `<SettlementExceptions>` when `m.posCheck`.
- `src/screens/PositionCheck.tsx`: presentational, existing RBC tokens.
- `server/pv/routes.ts` + `src/api/pv.ts`: `GET /position-check/dates`.
- `scripts/visual-diff.mjs`: `poscheck-*` app-only cases (screen key `poscheck` so mockup `exceptions:*` keys are untouched), `select` step, sequential API responses.

## Project Structure
```
specs/006-position-check/{spec,plan,tasks,research,data-model,quickstart}.md, contracts/position-check-ui.md, checklists/requirements.md
src/model/pv/position-check.ts (+ .test.ts)   src/screens/PositionCheck.tsx
scripts/visual-baselines/poscheck-*.png, flow-poscheck-*.png
```
