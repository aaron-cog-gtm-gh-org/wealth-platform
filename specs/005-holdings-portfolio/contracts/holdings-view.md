# Contract: custody holdings on `portfolio` (spec 005)

- URL: `?screen=portfolio&acct=<ACCT_ID>[&stmt=<yyyy-mm-dd>][&state=Populated|Loading|Empty|Error]`. Without a valid `acct` the Whitfield Portfolio detail is shown.
- API (spec 004, unchanged): `GET /api/pv/accounts/:id`, `/accounts/:id/statement-dates`, `/accounts/:id/holdings?date=`.
- Model: `m.portfolio` (`PvHoldingsView`) is non-null only for an ungated, Populated PV slice; App renders `CustodyHoldings` then, else `PortfolioDetail`.
- Roles: any signed-in role (`Holdings.aspx` has no `RequiredRoles`).
- Shared plumbing added additively for later specs:
  - `PvSliceDef.copy?(data, ctx)` → `{ meta?: [crumb, title, subtitle], loading?, empty?: [title, body, cta], error?: [title, body, action] }`, used by `buildShell` only while that slice is active.
  - `PvModelInput.slice.ctx` (the URL context). The picker navigates with spec 006's `goPv('portfolio', { stmt })`.
  - visual-diff: `['select', <selector>, <value>]` step; API route keys may include a query string (`'GET /accounts/2018/holdings?date=2026-10-02'`), which wins over the path-only key.
