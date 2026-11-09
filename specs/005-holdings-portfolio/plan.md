# Implementation Plan: Holdings.aspx → PortfolioDetail custody holdings

**Branch**: `005-holdings-portfolio` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

## Summary
Register a `portfolio` PV slice (`needs: 'acct'`) that loads the account, statement dates and the selected statement through `src/api/pv.ts`. A new view-model builder, `buildPvHoldings` in `src/model/holdings.ts`, formats the statement with Q14 rules using exact decimal-string arithmetic. `buildScreens` exposes it as `portfolio`, and `App.tsx` renders `src/screens/CustodyHoldings.tsx` in place of the Whitfield `PortfolioDetail` only when that model is present. The date picker navigates by URL via `goPv('portfolio', { stmt })` (context patch from spec 006). PV-specific shell copy (crumb, subtitle, loading/empty/error) comes from an optional `copy` hook on the slice definition.

## Technical Context
**Stack**: React 18 + TS, existing `/api/pv` routes (no server changes). **Testing**: `node --test` model tests in `src/model/holdings.test.ts` (added to `test:unit`), updated `src/model/pv/pv.test.ts`, visual-diff app-only cases + baselines. **Constraints**: Whitfield default view pixel-identical; shared files changed additively only.

## Constitution Check
| Principle | Status |
| --- | --- |
| I Parity | PASS: Q2–Q5, Q8, Q13 come from the unchanged server/domain; Q14 formats are ported with .NET half-away-from-zero rounding. Divergences D-005-1..6 are named and change no domain result. |
| II Pure core | PASS: no domain changes; the browser only calls the HTTP client. |
| III Test-first | PASS: formatter and view-model tests (including FAMT, unknown instrument, zero GBP, half-away rounding, negative zero) written with the code. |
| IV View models | PASS: `buildPvHoldings` via `buildScreens`; four DataStates via the shared slice; visual-diff static states + flows. |
| V No regression | PASS: `pvSliceFor('portfolio')` is null without `acct`, so the shell and screen are the mockup's. Mockup diff counts compared before/after. Admin baselines are not regenerated: the extra "Holdings" PV nav row differs by ≤0.04%, within `BASELINE_MAX`. |
| VI Security | PASS: server `requireSession` is unchanged; `acct` is a positive integer and `stmt` an ISO date before any request. |
| VII Simplicity | PASS: one slice, one builder, one screen component; legacy files listed in the spec. |

## Project Structure
```text
src/model/holdings.ts          # holdingsSlice (load/isEmpty/preview/copy), buildPvHoldings, decimal formatters
src/model/holdings.test.ts     # node --test
src/model/pv/preview-holdings.ts  # synthetic preview statement (account 2018, 09-OCT-2026)
src/model/pv/slice.ts          # additive: PV_SLICES.portfolio, optional PvSliceDef.copy, slice.ctx
src/model/pv/access.ts         # Holdings.aspx row → screen 'portfolio'
src/model/shell.ts             # additive: slice copy overrides META/EMPTY/ERR/loading while the slice is active
src/model/screens.ts           # additive: buildPvScreens.portfolio
src/pv/usePv.ts                # additive: slice.ctx
src/screens/CustodyHoldings.tsx
src/App.tsx                    # additive: render CustodyHoldings when m.portfolio
scripts/visual-diff.mjs        # additive: portfolio-pv-* cases, 'select' step, query-aware API routes
```

## Complexity Tracking
None.
