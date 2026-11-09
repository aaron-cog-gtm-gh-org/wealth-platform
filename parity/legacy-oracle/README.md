# Legacy parity oracle (Portfolio Viewer PV.Core / PV.Data)

Golden output for spec 011 (decommission parity): the **unmodified** legacy C# code from
[`aaron-cog-gtm-gh-org/legacy-wealth-platform`](https://github.com/aaron-cog-gtm-gh-org/legacy-wealth-platform)
run under Mono against that repo's `archive/` and its `db/` seed in SQL Server. Nothing here
re-implements legacy logic; `LegacyOracle.cs` only calls PV.Core / PV.Data and serialises results.

| File | What |
| --- | --- |
| `LegacyOracle.cs` | Console harness: sets `SqlHelper.ConnectionString`, calls `ArchiveIndex.Reload`, writes JSON |
| `build.sh` | `mcs -sdk:4.5` build of legacy `src/PV.Data`, `src/PV.Core`, `src/PV.Tests` sources + the harness |
| `run.sh` | End-to-end capture (DB, packages, build, PV.Tests, manifest, golden) |
| `archive-manifest.sha256` | SHA-256 of every archive file used (`sha256sum` format, paths relative to the legacy repo) |
| `../legacy-golden/legacy-golden.json.gz` | Golden output (`gzip -n -9`; 25.8 MB uncompressed) |
| `../legacy-golden/legacy-golden.json.sha256` | SHA-256 of the uncompressed JSON |
| `../legacy-golden/pv-tests-result.xml` | NUnit 2.6.4 result for legacy PV.Tests |

## Captured from

- Legacy commit `91261288d02323e0526cb9fe71a7d6606e2f9c0a` (`main`), archive manifest SHA-256
  `7a6eef155d12894ced3ea25c73bb5d30076a669a9fc30b68519ad1278b167fb2` (6,044 files).
- Ubuntu 22.04, Mono 6.8.0.105 (`apt install mono-complete`), `mcr.microsoft.com/mssql/server:2022-latest`.
- log4net 2.0.8, NUnit 2.6.4, NUnit.Runners 2.6.4 from `api.nuget.org/v3-flatcontainer` (SHA-256 pinned in `run.sh`).
- Golden JSON SHA-256 `a4d4e888d0d7fb01aa354c8c304faf42e35f03ec92067eb8eb0088cc58ce3452`; two consecutive runs were byte-identical.

## Reproduce

Prerequisites: Docker, `mono-complete`, `curl`, `unzip`, `git`. Port 1433 free (or an existing `pvsql` container).

```bash
git clone https://github.com/aaron-cog-gtm-gh-org/legacy-wealth-platform ~/legacy-wealth-platform
git -C ~/legacy-wealth-platform checkout 91261288d02323e0526cb9fe71a7d6606e2f9c0a
sudo apt-get update && sudo apt-get install -y mono-complete unzip
parity/legacy-oracle/run.sh ~/legacy-wealth-platform /tmp/pv-oracle parity/legacy-golden
gzip -dc parity/legacy-golden/legacy-golden.json.gz | sha256sum   # expect a4d4e888…
```

`run.sh` does, in order:

1. `db/setup_db.bat` on Linux: creates/starts container `pvsql` (SA `Pv!Local2018`, Express), waits for
   `select 1`, drops `PortfolioViewer` if present, applies `db/schema/*.sql` then `db/seed/*.sql` in name order
   with `sqlcmd -C -b`.
2. Downloads and verifies the three nupkgs into `<work>/packages/`.
3. `build.sh`: compiles the legacy sources as-is. The only deviation from the csproj files is extra
   `System.Xml` / `System.Xml.Linq` references for PV.Data (Mono reports CS0012 for `IXmlSerializable`
   via `DataTable` otherwise) and an explicit `System.Core` for PV.Core (implicit in VS for v4.x). The legacy
   repo is not modified.
4. Runs PV.Tests with `nunit-console.exe`.
5. Writes `archive-manifest.sha256`, runs
   `mono LegacyOracle.exe <archive> <conn> <out.json> <legacyCommit> <manifestSha>` with connection string
   `Data Source=localhost,1433;Initial Catalog=PortfolioViewer;User ID=pv_app;Password=pvapp2013;`
   (the `PVRef` string from `PV.Web/Web.config`), then gzips the result.

## JSON shape (`format: pv-legacy-golden/1`)

Decimals are strings from `decimal.ToString(InvariantCulture)` with the scale legacy computed
(`"3776.070"`, `"800"`), so compare numerically; dates are `yyyy-MM-dd`, `RECON_NOTE.UPDATED_DT` is
`yyyy-MM-ddTHH:mm:ss.fff`. Thread culture is `en-GB` as on the PV.Web server.

- `archiveIndex`: `mt535Count`, `mt54xCount`, `parseErrors` + captured log4net warnings, `statementAccountCount`,
  `confirmFolderCount`, `distinctStatementDates`, `statementKeys[]` (key → dates → every statement file with
  `fileSeq`/`function`/`safekeepingAcct`/`lineCount`, plus the `selectedFile` from `PositionBuilder.GetStatement`),
  `confirmFolders[]` (every parsed MT54x in legacy file-name order), `files[]` (legacy `Files` list, paths relative
  to the archive root).
- `accounts[]` (ordinal `ACCT_NO`): account row, `statementDates` (legacy newest-first), and for every statement
  date ascending a `positionChecks[]` entry with the `PositionBuilder.GetStatement` holdings
  (`isin, instrumentName, msgDescription, qty, qtyType, price, ccy, mktVal, mktValGbp, fileName, fileSeq, function`)
  and the `PositionCheck.Run` result (`prevStmtDate`, `noPrevMessage`, `statementFile`, `rows[]` with every
  `PositionCheckRow` field). `settlementsDefault90d` = `GetSettlements(SAFE_CODE.PadLeft(7,'0'), latest-90d, latest)`
  as `Settlements.aspx` defaults it; `settlementsFullRange` = `DateTime.MinValue`..`DateTime.MaxValue.Date`. Each
  settlement carries `amount` = `SettlementReader.ToAmount(amountRaw)` (or `0` when `amountRaw` is null, as the page
  does) and `amountError` / `pageError` if `ToAmount` throws.
- `checkAll[]`: per distinct statement date (ascending), the `btnAll_Click` grid: accounts in
  `GetAllAccounts()` order whose dates contain that date, `diffs` = `"-"` (no previous statement) or the row
  count; `pageError` if `Run` throws (the page has no try/catch).
- `summary`: totals plus `runtimeErrors`, `settlementPageErrors`, `checkAllPageErrors`, `fileSeqTies`.

Ordering notes: `GetSettlements` sorts newest-first with the unstable `List.Sort` over `Directory.GetDirectories`
order, so ties within one settle date are platform-dependent; the oracle emits them by
`settleDate desc, folder, fileName`. `GetStatement` resend selection would be order-dependent only on equal
`fileSeq`; `summary.fileSeqTies` is empty for this archive.

## Results at the captured commit

- 120 accounts, all with statements; 26 statement dates; 3,065 account × date checks
  (120 "No previous statement on file.").
- 7 diff rows on 7 account-dates (`NEW` 4, `OPEN` 1, `RESOLVED` 1, `CHASED` 1); Check All totals: 1 on 2026-06-26,
  1 on 2026-07-03, 2 on 2026-07-17, 1 on 2026-07-31, 2 on 2026-09-18, 0 elsewhere.
- 30,645 holdings lines; 1,572 settlements in the 90-day defaults, 2,950 over the full range.
- No archive parse errors, no exceptions from `PositionCheck.Run`, `GetSettlements`, `ToAmount` or Check All.
- Legacy behaviour visible in the data (silent, not errors): 283 settlement amounts with a one-digit or empty
  fraction are scaled as hundredths (`GBP11524,8` → `11524.08`, Q10); two MT54x with an 8-digit `97A::SAFE`
  (`00011397`, `00010554`, 2026-09-16) never match the 7-padded account and surface as the two `NEW` breaks on
  2026-09-18 (Q9); the highest file seq wins regardless of `RPLC` / `NEWM/DUPL` (Q8, e.g. 16558 on 2026-06-26
  takes `_003`, giving the `OPEN` break).
- PV.Tests: 10 run, 0 failures, 0 errors, 2 ignored (`ArchiveFileTests`, `[Ignore]` in source).
