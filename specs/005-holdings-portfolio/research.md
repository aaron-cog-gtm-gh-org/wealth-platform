# Research: 005 Holdings → PortfolioDetail

## R1 Screen id: reuse `portfolio`
**Decision**: the custody view is the `portfolio` screen with a PV account context, not a new screen id. **Why**: the migration map targets PortfolioDetail, and the spec 010 contract gates slices on context (`needs: 'acct'`), so `?screen=portfolio` stays the Whitfield mockup. **Alternative**: a new `holdings` screen — rejected, it would duplicate the nav entry the map assigns to PortfolioDetail.

## R2 Loading: three calls in parallel
`GET /accounts/:id` (404 → "not found" data, Empty), then `statement-dates` and `holdings?date=` in parallel. The holdings route already defaults to the latest statement (legacy `dates[0]`) and returns `statement: null` for a date not on file. **Alternative**: a new aggregate route — rejected, no server changes are needed.

## R3 Formatting without the domain
The view model formats decimal strings with a small bigint formatter (`#,##0.####`, `#,##0.0000`, `#,##0.00`, half away from zero, no sign on negative zero), matching `src/domain/format.ts` but without importing the domain into the browser (constitution IV: screens never compute domain results). The GBP total is an exact sum of decimal strings.

## R4 Empty vs in-screen messages
Legacy shows "No statement on file for this date." / "No holdings on statement." inside the page while keeping the header and picker. Those stay in-screen (Populated) so the user can pick another date. The Empty DataState is reserved for an account with no statements at all, or an unknown account, where there is nothing to pick.

## R5 Shell copy
`buildShell` used fixed per-screen `META/EMPTY/ERR`. An optional `PvSliceDef.copy(data, ctx)` lets a slice override them only while active; Admin has no `copy`, so it is unchanged.

## R6 Picker navigation
`goPv('portfolio', { stmt })` pushes `?…&stmt=` and keeps `screen`/`acct`, mirroring legacy `Response.Redirect("Holdings.aspx?acct=&stmt=")`. The slice key includes the context, so the new statement is loaded and stale rows are never shown.
