# Research: 006 Position check

- **Where does the screen live?** Spec map says SettlementExceptions, whose default view is the mockup ops queue. Decision: same id with a PV-context-gated slice (`active`), so the default stays untouched. Alternative (new screen id) rejected: the feature map and the PV_PAGES row name `exceptions`.
- **How is "Position check with nothing chosen yet" addressed?** `?acct` alone would preselect an account; a bare nav click needs a marker. Decision: `pc=1` context key, set by the nav row's `params`.
- **All-account date list.** Legacy Page_Load looped every account's statement dates. `GET /accounts/:id/statement-dates` × 120 is wasteful; added `GET /position-check/dates` reading the same archive index (`getIndex().statements`).
- **Quantity format.** API returns decimal strings with legacy scale. `fmtQty` formats with BigInt (4 dp, half away from zero as .NET `ToString("#,##0.####")` does for decimal) to avoid float drift.
- **Status edit preselection.** Legacy `ddlStatus` is unbound → always OPEN. Recorded as D-006-3 (preselect current listed status).
- **Golden data.** 7 diff rows across 3,065 `PositionCheck.Run` calls; 01028-01 26-JUN-2026 (seeded OPEN note) used for the preview; 01068-02 / 01072-01 on 18-SEP-2026 are the Q18 NEW breaks.
