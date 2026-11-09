# Contract: PV shell plumbing (spec 010). Specs 005–009 build on this.

## 1. Session (src/pv/usePv.ts, src/pv/session.ts)
- **Sign in**: `createPvClient().login(username, password)` → `POST /api/pv/login`. On 200, `{token,user}` is stored in `sessionStorage['pv.session']`.
  - 401 → "Invalid user ID or password."
  - 403 → "Your account has been disabled. Please contact Support (ext. 4417)."
  - Anything else → "Sign-in is unavailable right now. Try again in a few minutes."
  - Login.aspx.cs wording is used. Empty fields are rejected client-side with the invalid message.
- **Every other request** sends `Authorization: Bearer <token>` (the existing `token` option on `createPvClient`).
- **401 from any PV call**, a token past its `exp` at load, or the `exp` timer firing → the token is cleared, and the sign-in panel shows "Your session has expired. Sign in again." The URL (including `acct`/`stmt`) is kept, so the user returns to the same view after signing in (D-010-1).
- **403 from a slice load** → the not-authorised panel (same as the client role gate).
- **Sign out** (header link, or "Sign in as another user") → the token is discarded client-side. Tokens are stateless; spec 004.
- The server remains the authority: `requireSession` + `requireRole` on every `/api/pv` route. The client gate only avoids requests it knows will fail.

## 2. Roles and navigation (src/model/pv/access.ts)
`PV_PAGES` is the only role table, in legacy nav order:

| Page | Roles | Screen |
| --- | --- | --- |
| ClientSearch.aspx | any signed-in | — (spec 008) |
| ClientSummary.aspx | any signed-in | — (spec 008) |
| Holdings.aspx | any signed-in | — (spec 005) |
| Settlements.aspx | any signed-in | — (spec 007) |
| PositionCheck.aspx | OPS, ADMIN | — (spec 006) |
| MessageBrowser.aspx | OPS, ADMIN | — (spec 009) |
| Admin.aspx | ADMIN | `admin` |

- `canAccess(roles, role)` is an exact match (BasePage). `pvNavFor(role)` returns the pages that have a `screen` and that the role may open. They are shown as a "Portfolio Viewer" nav group, only while signed in (or for a preview).
- **A screen spec sets `screen` on its row.** If the screen id is an existing mockup screen (for example `portfolio`), the nav item uses `goPv`, which keeps `acct`/`stmt`. The mockup groups use `go`, which drops them.

## 3. URL context (src/model/pv/context.ts)
- `?acct=<positive int ACCT_ID>&stmt=<yyyy-mm-dd>` → `PvContext {acct, stmt}`. Malformed values become null.
- Legacy `Holdings.aspx?acct=2001&date=…` becomes `?screen=<id>&acct=2001&stmt=2026-09-18`.
- To add keys, extend `PvContext`, `parsePvContext` and `PV_CONTEXT_KEYS` additively.
- Spec 008 added `?cid=<positive int CLIENT_ID>` and `?q=<raw search text>` (optional fields), plus an optional `PvSliceDef.active(ctx)` gate and `PvModelInput.openPv(screen, patch)` for navigation that sets context keys.

## 4. Slices (src/model/pv/slice.ts)
```ts
interface PvSliceDef<T> {
  needs: 'none' | 'acct' | 'acct+stmt';           // unmet → pvSliceFor() returns null → existing (mockup) behaviour
  load(api: PvApi, ctx: PvContext): Promise<T>;    // HTTP client only
  isEmpty(data: T): boolean;                       // ready + empty → 'Empty'
  preview(): T;                                    // fixed synthetic data for ?state=Populated without a session
}
PV_SLICES[screen] = def;                           // register additively
```
`resolvePvSlice(screen, def, forced, user, status)` decides what the shell shows, in this order:

| Condition | Gate | DataState | Fetch |
| --- | --- | --- | --- |
| `?state=Loading\|Empty\|Error` | — | forced | no (preview identity if signed out) |
| `?state=Populated`, signed out | — | Populated (`preview()` data) | no |
| signed out | signin | — | no |
| role not in `PV_PAGES` row | forbidden | — | no |
| idle / loading | — | Loading | yes |
| error 403 | forbidden | — | — |
| error (other) | — | Error (Retry → reload slice) | — |
| ready | — | `isEmpty ? Empty : Populated` | — |

`?state=Populated` while signed in shows live data, as the existing screens do. The slice status is keyed by screen + context + token + retry, so no stale data is shown after navigating.

## 5. Model wiring (src/model/*)
- `buildModel(screen, dataState, ui, setUi, go, data, retry, pv)`. Here `pv: PvModelInput` = `{user, slice, signIn, signOut, run, goPv}` (from `usePv` + `goPv`). `retry` becomes `pv.slice.retry` on PV screens.
- `buildShell(…, pv)` adds:
  - `pvGate`, `pvSignIn`, `pvForbidden`, `pvSignedIn` and `pvSignOut`;
  - the PV nav group;
  - the PV identity in the header.
  With `pv.user === null` and no slice, the shell model equals today's.
- `buildScreens(st, setState, go, data | null, pv)` returns the mockup view models (when `data`), plus `buildPvScreens`: one entry per PV screen, non-null only when that slice is ungated, Populated and has data. To add a screen, add `<screen>: ready?.screen === '<screen>' ? build<Screen>(ready.data as T, …) : null`.
- Mutations go through `pv.run(op)`. It replaces the slice data on success, routes 401/403 like loads, and makes no request in preview. Add new ops to `PvOp` / `run` additively.
- `App.tsx`: render `{show.<screen> && <Screen m={m} />}`. The gate panels are already rendered.

## 6. Visual-diff app-only mode (scripts/visual-diff.mjs)
`APP_ONLY` entries take `{name, screen, state?, url?, steps?, expect: string[], api?: {'METHOD /path': [status, body]}, session?}`. A case fails if any `expect` text is not visible, or if the PNG differs from `scripts/visual-baselines/<name>.png` by more than `BASELINE_MAX` (default 0.5%). A missing baseline is written; `UPDATE_BASELINES=1` rewrites. `/api/pv/**` is routed for app-only cases (unlisted → 401). Mockup cases are unchanged. To add a PV screen, add `<screen>-<State>` × 4 plus at least one flow.

## 7. Local/dev passwords
`PV_DEMO_PASSWORD=<synthetic> npm run pv:demo-passwords [-- USER …]` sets the password on every active seeded user by default. It refuses to run with `NODE_ENV=production`. No password is committed. Set `PV_SESSION_SECRET` so tokens survive an API restart.
