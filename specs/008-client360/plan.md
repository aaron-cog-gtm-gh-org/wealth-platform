# Implementation Plan: 008 ClientSearch + ClientSummary → Client 360

**Spec**: `spec.md` · **Contract**: `contracts/client360.md`

## Technical context
React 18 / Vite 5 / TS 5.6; Express + PostgreSQL 16; pure domain in `src/domain/` (server-side only for statements). Builds on spec 010 (`PV_SLICES`, `PV_PAGES`, `parsePvContext`, `usePv`, app-only visual diff) and spec 004 (`/api/pv/*`).

## Constitution check
- I Parity: legacy semantics kept; divergences D-008-1…5 named. ✔
- II Pure domain: statement selection/sums run server-side via `getLatest` + `sumDecimals`; the browser only formats with the pure `WebUtil` ports (`fmtMoney`, `statusText`, `formatDate`). ✔
- III Test-first with legacy fixtures: backend test against `parity/legacy-golden` for every client. ✔
- IV One view-model per screen: `buildClientSearch`, `buildClientSummary` via `buildScreens`. ✔
- V No regression: `c360` PV slice only with `?cid=`; mockup visual-diff unchanged. ✔
- VI Secure: bearer auth via spec 010; parameterised SQL; no fs access. ✔

## Design
| Layer | Change |
|---|---|
| `server/pv/routes.ts` | `CLIENT_SQL` shared; `GET /clients/:clientId/summary` |
| `src/api/pv(-types).ts` | `clientSummary()`, `PvClientSummary` |
| `src/model/pv/context.ts` | `cid`, `q` keys (optional fields, additive) |
| `src/model/pv/slice.ts` | optional `active(ctx)`; register `clients`, `c360`; `goPv` on `PvModelInput` |
| `src/model/pv/access.ts` | `ClientSearch.aspx → clients`, `ClientSummary.aspx → c360` |
| `src/model/clients.ts` | slices, view models, custody shell copy |
| `src/model/shell.ts` / `screens.ts` | `clients` META/EMPTY/ERR; c360 PV copy override; `clientSearch`/`client360` models |
| `src/App.tsx` | `goPv(screen, patch)`; render `ClientSearch`, `CustodyClient360` |
| `src/types.ts` | `clients` screen; `UiState.clientPage` |
| `scripts/visual-diff.mjs` | app-only cases + flows, baselines |

## Risks
- Shared files edited by 005–009 in parallel: all edits are appends or single-line additions.
- `PV_PAGES` nav now lists Client search/summary, so existing Admin app-only screenshots differ by the nav rows (~0.06%, under the 0.5% baseline threshold); Admin baselines left untouched to avoid binary conflicts.
