---
name: legacy-portfolio-viewer
description: Run the legacy Portfolio Viewer (PV, ASP.NET Web Forms + SQL Server + SWIFT archive) on Linux at :8080, for parity captures, screenshots or checking legacy behaviour.
---

# Legacy Portfolio Viewer on Linux

PV is the system the Custody area replaces; parity is judged against this running instance, not its source.
The legacy checkout (`aaron-cog-gtm-gh-org/legacy-wealth-platform`) is read-only: every build artefact, the
deployed site and the archive copy live in a work dir (default `~/pv-run`).

## Bring up

```bash
.agents/skills/legacy-portfolio-viewer/pv-up.sh ~/repos/legacy-wealth-platform   # [work-dir], PV_PORT=8080
```

Done when the script prints `Portfolio Viewer up: …` and `http://localhost:8080/Login.aspx` logs in as **PVADMIN / portfolio1**
(Admin role; landing page is Client Search). Admin.aspx should show 3073 MT535 + 2971 MT54x files, 0 parse errors.
The first run also installs Mono and builds xsp (several minutes); a re-run takes ~10 s and is safe.

What `pv-up.sh` does, in order:

1. **SQL Server 2022** container `pvsql` (`mcr.microsoft.com/mssql/server:2022-latest`, SA `Pv!Local2018`, port 1433) —
   the same SA password as `db/setup_db.bat`, which `Web.config`'s `pv_app`/`pvapp2013` login is created by.
2. **Database**: drops `PortfolioViewer`, then runs `db/schema/*.sql` then `db/seed/*.sql` (sorted) with `sqlcmd -C -b`.
   Recreating the DB resets recon notes edited through the UI; `PV_KEEP_DB=1` skips this step.
3. **Build** with `mcs -sdk:4.5` (no msbuild/NuGet): PV.Data → PV.Core → PV.Web (code-behind + `*.designer.cs`),
   against log4net 2.0.8 (net45, downloaded from nuget.org, SHA-256 pinned). Mono needs explicit
   `System.Xml.dll`/`System.Xml.Linq.dll` references that VS adds implicitly.
4. **Deploy** `*.aspx`, `*.master`, `Global.asax`, `css/`, `img/`, `bin/` to `<work>/site`; copy `archive/` to
   `<work>/archive`; write `Web.config` with `ArchiveRoot` rewritten to that absolute path.
5. **Serve** with xsp4 built from source (mono/xsp @ `3330ff07`, prefix `/opt/xsp`) on `0.0.0.0:8080`, pid in
   `<work>/xsp.pid`, log in `<work>/xsp.log`. Debian's `mono-xsp4` package crashes at startup in Mono.Security
   (`PrivateKeySelectionCallback`), which is why xsp is built from source.

Stop: `.agents/skills/legacy-portfolio-viewer/pv-down.sh` (leaves `pvsql` running; `docker rm -f pvsql` to drop it).

## Gotchas

- The first request after start compiles the pages and loads the archive index (`Global.asax`); `pv-up.sh` waits
  for it (up to 2 min).
- `/Login.aspx` returning 500 with `Cannot open database` means step 2 failed — rerun without `PV_KEEP_DB`.
- PV caches the archive index at application start; after changing files under `<work>/archive` restart with `pv-down.sh` + `pv-up.sh` (`PV_KEEP_DB=1`) or use Admin → Reload.
- Settlements' query string takes `dd/MM/yyyy` (`from=01/04/2026`); Holdings/Position Check take `stmt=yyyyMMdd`.

## Parity capture

With PV up: `npm run parity:capture` re-captures the golden into `scripts/legacy-parity/golden/`
(see `scripts/legacy-parity/README.md`); diff the new `manifest.json` stats before committing.
