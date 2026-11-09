# Requirements checklist: 006 Position check

- [x] OPS/ADMIN only, ADVISER forbidden (client gate + API 403)
- [x] Account + statement date pickers, newest-first dates, `ACCT_NO - CLIENT_NAME`
- [x] Break row columns: prev qty, net settled, expected, stmt qty, diff, status, note, updated by, updated
- [x] Check All per date with `-` for no previous statement, View link
- [x] Inline RECON_NOTE status/note save through `PUT /api/pv/accounts/:acctId/position-check/notes`; empty note → null
- [x] Legacy messages verbatim (no previous statement, no differences, no statements, pick, notes saved)
- [x] Q11, Q12, Q14, Q17, Q18 preserved; divergences D-006-1…6 named
- [x] Four DataStates via `?screen=exceptions&pc=1&state=`
- [x] Default `?screen=exceptions` is the mockup ops queue
- [x] Visual-diff app-only static + flow cases with baselines
- [x] Synthetic data only; no direct domain/fs calls from the browser
