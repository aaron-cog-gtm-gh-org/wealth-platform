---
name: running-legacy-portfolio-viewer
description: Start the legacy Portfolio Viewer (ASP.NET Web Forms + SQL Server) next to the new Wealth Platform on the Windows VM, log in as each role, and run the reference side-by-side comparisons for the custody migration.
---

# What runs where

| App | URL | Backing store | Port(s) |
|---|---|---|---|
| Legacy Portfolio Viewer (`legacy-wealth-platform`) | http://localhost:8080/Login.aspx | SQL Server 2022 in Docker container `pvsql` + `archive\` on disk | 8080 (IIS Express), 1433 (SQL) |
| Wealth Platform (this repo) | http://localhost:5173 | Oracle Free container `wealth-oracle` | 5173 (Vite), 3001 (API), 1521 (Oracle) |

No port overlaps; both stacks can run at once. The legacy repo is expected at `..\legacy-wealth-platform`
(sibling of this repo; clone `aaron-cog-gtm-gh-org/legacy-wealth-platform` there if missing). Never commit to
the legacy repo — the scripts only write gitignored build output there (`packages\`, `src\*\bin|obj`, `logs\`).

# Start / stop

Run from this repo in PowerShell (or `powershell -NoProfile -ExecutionPolicy Bypass -File ...` from Git Bash):

```powershell
scripts\legacy\start-legacy.ps1                 # DB (if needed) + dev passwords + build + IIS Express :8080, waits for Login.aspx
scripts\legacy\start-legacy.ps1 -SkipBuild      # reuse the last build
scripts\legacy\start-legacy.ps1 -ResetDb        # drop the pvsql container and re-seed from db\schema + db\seed
scripts\legacy\start-legacy.ps1 -LegacyDir C:\path\to\legacy-wealth-platform -Port 8080
scripts\legacy\stop-legacy.ps1                  # stop IIS Express only (pvsql keeps running)
scripts\legacy\stop-legacy.ps1 -StopDb          # also docker stop pvsql;  -RemoveDb = docker rm -f pvsql
```

The script is idempotent: if :8080 is already served by the IIS Express it started, it just prints the URL.
State (PID + IIS Express log) lives in `.legacy-run\` (gitignored).

New Wealth Platform (PowerShell; Git Bash's `npm` shim is broken on this VM):

```powershell
npm run db:up; npm run db:wait; npm run db:setup   # skip db:up if `docker ps` shows wealth-oracle
npm run dev:full                                   # API :3001 + Vite :5173
```

# Legacy logins (local container only)

The seed (`db\seed\01_APP_USER.sql`) only has SHA-1 hashes. `start-legacy.ps1` overwrites the hashes of the
three **active** users in the local `pvsql` DB (`UPDATE APP_USER SET PWD_HASH = SHA1('Passw0rd!')`):

| User | Role | Password | Sees |
|---|---|---|---|
| `JSMITH` | ADVISER | `Passw0rd!` | Client Search, Client Summary, Holdings, Settlements |
| `LBRENNAN` | OPS | `Passw0rd!` | + Position Check, Message Browser |
| `PVADMIN` | ADMIN | `Passw0rd!` | + Admin |

The other seeded users (RMCKAY, DHOLT, TGARNER) are inactive (`ACTIVE_FLG='N'`) and get "account disabled".
Usernames are upper-cased by `usp_GetUserByName`. Wrong role → redirected to `ClientSearch.aspx?err=1`
("You do not have access to that page."). Use `-NoDevPasswords` to keep the seeded hashes.

# Screen map (legacy → new)

`acct` is the legacy `ACCT_ID` (e.g. 2001), not the `ACCT_NO` (`01001-01`). Legacy URLs need a logged-in session;
deep links work once logged in.

| Legacy page | URL / params | New Wealth Platform screen |
|---|---|---|
| ClientSearch | `ClientSearch.aspx` (search box; name or client ref, LIKE) | header client picker |
| ClientSummary | `ClientSummary.aspx?cid=<CLIENT_ID>` | Client 360 (`?screen=c360` after picking the client) |
| Holdings | `Holdings.aspx?acct=<ACCT_ID>&stmt=<yyyyMMdd>` | Portfolio (`?screen=portfolio`) + Custody Holdings (`?screen=custody-holdings`) |
| Settlements | `Settlements.aspx?acct=<ACCT_ID>&from=<dd/MM/yyyy>&to=<dd/MM/yyyy>` (default 90 days to latest stmt) | Custody Settlements (`?screen=custody-settlements`) |
| PositionCheck | `PositionCheck.aspx?acct=<ACCT_ID>&stmt=<yyyyMMdd>` (runs immediately); "Check All Accounts for" dropdown + **Check All** button | Position Check (`?screen=position-check`) |
| MessageBrowser | `MessageBrowser.aspx?type=535\|54x&date=<dd/MM/yyyy>` (lists), `?file=<FileName>` (raw text); Safe Code box is postback-only | Message Browser (`?screen=message-browser`) |
| Admin | `Admin.aspx` (archive root, counts, parse errors, Reload archive, users) | Custody Admin (`?screen=custody-admin`) |

New-screen ids are from `specs/001-legacy-portfolio-viewer/tasks.md` (T025/T031/T036/T042/T046); confirm against
`src/types.ts` `SCREENS` on your branch. Date formats differ in legacy: Holdings/PositionCheck query strings use
`yyyyMMdd`, Settlements/MessageBrowser text boxes use `dd/MM/yyyy`.

# Reference data

| Ref | Legacy ids | Notes |
|---|---|---|
| Account 2001 | `ACCT_NO 01001-01`, SIPP, safe `16598`, client 1001 *The Penhaligon Family Trust* (ref `C2017-0124`) | genuine break `GB00ZZ011962` on 2026-07-17 (1:1 bonus, +800) |
| Account 2074 | `01040-05`, safe `14380`, client 1040 *Mr N Oyelaran* (`PV2863`) | genuine break `GB00ZZ000908` on 2026-07-31 (receipt with no MT545) |
| Account 2038 | `01028-01`, safe `16558`, client 1028 *Miss M Whitlock* (`PV2027`) | statement 2026-06-26 has `_001` NEWM, `_002` RPLC, `_003` NEWM/DUPL |
| Account 2101 | `01055-01`, safe `12203` | `MT545_12203_20260701_001.txt` has `:19A::ESTT//GBP21637,5` (one-decimal amount) |
| Account 2018 | `01012-01`, safe `10367` | statements 2026-07-10/17 contain unknown ISIN `GB00ZZ004322` (not in `INSTRUMENT`) |

# Side-by-side checklist (every workstream)

Open legacy and new in two browser windows side by side. Values must match legacy except where a documented
**[fix D-n]** in `legacy-as-built.md` §8 applies — then show the corrected value and cite the defect.

1. **Account 2001 / safe 16598, statement 2026-07-17** — `Holdings.aspx?acct=2001&stmt=20260717` vs Custody Holdings
   for that client/date: every ISIN, quantity, price, market value and GBP total (legacy `Total Mkt Val (GBP)`).
   Client Summary `?cid=1001` totals vs Client 360 (GBP, never converted to CAD).
2. **Account 2074, 2026-07-31** — Holdings + `PositionCheck.aspx?acct=2074&stmt=20260731`: break on `GB00ZZ000908`
   in both apps.
3. **RPLC statement 16558 / 2026-06-26** — legacy shows the highest seq (`_003`, the DUPL of the superseded
   original; defect D-4) and reports false breaks for `GB00ZZ003373` on 06-26 and 07-03; new app must show the RPLC
   (`_002`) with `superseded: 2` and no break. `PositionCheck.aspx?acct=2038&stmt=20260626`.
4. **One-decimal amount** — `Settlements.aspx?acct=2101&from=01/06/2026&to=31/07/2026`: the `GBP21637,5` confirmation;
   legacy shows **21,637.05** (defect D-1, fraction read as hundredths); new app must show `21,637.50` **[fix D-1]**.
5. **Unknown ISIN `GB00ZZ004322`** — `Holdings.aspx?acct=2018&stmt=20260717`: legacy shows `UNKNOWN INSTRUMENT` (defect D-5) although `35B` carries a name;
   new app shows the custodian name flagged unverified **[fix D-5]**.
6. **Position Check, Check All 2026-07-17** — legacy shows 2 accounts with differences (2001, 2145) vs new app legacy mode and
   corrected mode. Across all dates: legacy rules 7 breaks, corrected 2 (account 2001 `GB00ZZ011962` 07-17,
   account 2074 `GB00ZZ000908` 07-31).
7. **Message Browser** — open a source file from a break (e.g. `?file=MT535_16598_20260717_001.txt`) in both; raw
   text identical.
8. **Admin** — legacy file counts (MT535 3,073 / MT54x 2,971 = 6,044) vs Custody Admin.

# Verified results

Observed in the legacy UI on the committed archive + seed (2026-10-13). Use these as the legacy-side baseline.

| Check | Legacy shows |
|---|---|
| Client Summary `?cid=1001` (latest stmt 09-OCT-2026) | 2001/`01001-01` GBP 283,880.39; 2002/`01001-02` GBP 76,295.23; total GBP 360,175.62 |
| Holdings `?acct=2001&stmt=20260717` | Total Mkt Val (GBP) 203,327.79; `GB00ZZ011962` qty 1,600 @ 13.0020 = 20,803.20 |
| Check All 2026-07-17 | 118 accounts listed, **2 with differences** (1 each): 2001/`01001-01` Penhaligon (`GB00ZZ011962`, genuine) and 2145/`01079-03` Ms R Fitzwarren (safe 16056, `GB00ZZ001500`, false break D-3) — corrected rules should leave only 2001 |
| PositionCheck `?acct=2001&stmt=20260717` | `GB00ZZ011962` expected 800, stmt 1,600, diff +800, status RESOLVED |
| PositionCheck `?acct=2038&stmt=20260626` | `GB00ZZ003373` expected 1,250, stmt 0, diff −1,250, OPEN (false break D-4) |
| Settlements `?acct=2101&from=01/06/2026&to=31/07/2026` | MT545 ref `KS5400060214` shows GBP **21,637.05** (source `GBP21637,5`, D-1) |
| Holdings `?acct=2018&stmt=20260717` | `UNKNOWN INSTRUMENT` for `GB00ZZ004322`, qty 544, GBP 6,030.78 (D-5) |
| Admin | root `<LegacyDir>\archive`; MT535 3,073; MT54x 2,971; parse errors 0 |
| Roles | JSMITH has no Position Check/Message Browser/Admin nav; deep link → `ClientSearch.aspx?err=1` |

The all-dates totals (legacy 7 / corrected 2) come from `legacy-as-built.md` §9, not from this UI run.

# Gotchas

- **Tooling (one-time, ~10 min):** `choco install -y --no-progress netfx-4.8-devpack nuget.commandline iisexpress` (fast) and
  `choco install -y --no-progress visualstudio2022buildtools visualstudio2022-workload-webbuildtools --execution-timeout=3600`
  (~8 min). Installing Build Tools in one combined choco command with the others failed once with bootstrapper error
  `0x1390`; a separate retry with `--execution-timeout=3600` succeeded. MSBuild is found via `vswhere`
  (`...\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe`). `docker pull mcr.microsoft.com/mssql/server:2022-latest` ~2 min.
- **Timings (warm tooling):** clean start (new `pvsql`, NuGet restore, build) ~36 s; re-run when already up ~5 s (no-op);
  `-SkipBuild` restart ~6 s. Archive load on first request ~0.7 s.
- **NuGet:** pass `-Source https://api.nuget.org/v3/index.json` (default feed config is empty on this VM). Restore reports
  `NU1904`/`NU1902` advisories for legacy `log4net` 2.0.8 — expected, leave legacy dependencies alone.
- **`setup_db.bat` is not re-runnable** (seed INSERTs violate PKs); the script skips it when `APP_USER` already has rows and
  uses `-ResetDb` to recreate. Its `timeout /t` prints `ERROR: Input redirection is not supported` when run hidden — harmless,
  the wait loop just spins faster.
- **sqlcmd** inside the container is `/opt/mssql-tools18/bin/sqlcmd` and needs `-C` (self-signed cert) and `-d PortfolioViewer`
  (default DB is `master`). SA password `Pv!Local2018` (local dev only, from `setup_db.bat`).
- **Port ownership:** `Get-NetTCPConnection` shows PID 4 (`System`/HTTP.sys) for IIS Express ports; the script confirms ownership
  via `netsh http show servicestate`. IIS Express can't redirect stdout+stderr to one file here, so logs are
  `.legacy-run\iisexpress.log` and `.legacy-run\iisexpress.stderr.log`.
- **PowerShell 5.1** with `$ErrorActionPreference='Stop'` turns docker stderr into terminating errors; wrap native calls.
- **Git Bash:** run the scripts via `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/legacy/start-legacy.ps1`; run
  `npm` from PowerShell (Git Bash shim is broken). If `tsx` is "not recognized", run `npm install` first.
- **ArchiveRoot** is not overridden: Web.config's `..\..\archive` resolves from `src\PV.Web` to `<LegacyDir>\archive`
  (Admin page shows the full path). Keep the legacy checkout layout intact.
- Legacy pages are fixed-width and "Best viewed at 1024x768"; deep links need a logged-in session (else redirect to
  Login.aspx, which then lands on ClientSearch, not the deep link).
