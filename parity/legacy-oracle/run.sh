#!/usr/bin/env bash
# End-to-end legacy capture: SQL Server in Docker (db/setup_db.bat recipe) -> Mono build of the
# unmodified PV.Core/PV.Data/PV.Tests -> PV.Tests via NUnit 2.6.4 -> LegacyOracle.exe -> golden JSON.
# usage: run.sh <legacy-repo-checkout> <work-dir> <golden-out-dir>
set -euo pipefail
LEGACY=$(cd "$1" && pwd); WORK=$2; GOLDEN=$3
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$WORK/packages" "$GOLDEN"; WORK=$(cd "$WORK" && pwd); GOLDEN=$(cd "$GOLDEN" && pwd)

IMG=mcr.microsoft.com/mssql/server:2022-latest; NAME=pvsql; SA_PASS='Pv!Local2018'
SQLCMD=/opt/mssql-tools18/bin/sqlcmd
CONN="Data Source=localhost,1433;Initial Catalog=PortfolioViewer;User ID=pv_app;Password=pvapp2013;"

# --- reference DB, same steps as db/setup_db.bat
if ! docker inspect "$NAME" >/dev/null 2>&1; then
  docker run -d --name "$NAME" -e ACCEPT_EULA=Y -e MSSQL_PID=Express -e "MSSQL_SA_PASSWORD=$SA_PASS" -p 1433:1433 "$IMG" >/dev/null
else
  docker start "$NAME" >/dev/null
fi
until docker exec "$NAME" $SQLCMD -S localhost -U sa -P "$SA_PASS" -C -Q "select 1" >/dev/null 2>&1; do sleep 3; done
docker exec "$NAME" $SQLCMD -S localhost -U sa -P "$SA_PASS" -C -b -Q \
  "IF DB_ID('PortfolioViewer') IS NOT NULL BEGIN ALTER DATABASE PortfolioViewer SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE PortfolioViewer; END" >/dev/null
for f in $(cd "$LEGACY/db" && ls schema/*.sql | LC_ALL=C sort) $(cd "$LEGACY/db" && ls seed/*.sql | LC_ALL=C sort); do
  echo "Applying $f"
  docker exec -i "$NAME" $SQLCMD -S localhost -U sa -P "$SA_PASS" -C -b < "$LEGACY/db/$f" >/dev/null
done

# --- NuGet packages (pinned by SHA-256)
fetch() {
  local id=$1 ver=$2 sha=$3 f="$WORK/packages/$1.$2.nupkg"
  [ -f "$f" ] || curl -sSfL -o "$f" "https://api.nuget.org/v3-flatcontainer/$id/$ver/$id.$ver.nupkg"
  echo "$sha  $f" | sha256sum -c --quiet -
  rm -rf "$WORK/packages/$id.$ver" && mkdir -p "$WORK/packages/$id.$ver" && (cd "$WORK/packages/$id.$ver" && unzip -qo "$f")
}
fetch log4net 2.0.8 c4b05496f5eb4e09e62fdeafa7566fc49a6558e08d06e3a752e08cf990eea236
fetch nunit 2.6.4 2a47eddd03bd4f95b0b2fc8f44d193da7baded14bb39602b0e3218c6fc00f2a5
fetch nunit.runners 2.6.4 c975ace74cee180b569ad524c5118d257081510856a0bcd2469cb2e4d9877a9a

"$HERE/build.sh" "$LEGACY" "$WORK/packages" "$WORK/bin"

# --- PV.Tests
(cd "$WORK/bin" && mono "$WORK/packages/nunit.runners.2.6.4/tools/nunit-console.exe" PV.Tests.dll -nologo \
  -xml="$WORK/pv-tests-result.xml") | tee "$WORK/pv-tests-console.txt"

# --- archive manifest + golden output
(cd "$LEGACY" && find archive -type f | LC_ALL=C sort | xargs sha256sum) > "$HERE/archive-manifest.sha256"
MANIFEST_SHA=$(sha256sum "$HERE/archive-manifest.sha256" | cut -d' ' -f1)
COMMIT=$(git -C "$LEGACY" rev-parse HEAD)
mono "$WORK/bin/LegacyOracle.exe" "$LEGACY/archive" "$CONN" "$WORK/legacy-golden.json" "$COMMIT" "$MANIFEST_SHA"
sha256sum "$WORK/legacy-golden.json" | sed "s#  .*#  legacy-golden.json#" > "$GOLDEN/legacy-golden.json.sha256"
gzip -n -9 -c "$WORK/legacy-golden.json" > "$GOLDEN/legacy-golden.json.gz"
cp "$WORK/pv-tests-result.xml" "$GOLDEN/pv-tests-result.xml"
echo "golden written to $GOLDEN (legacy $COMMIT, archive manifest $MANIFEST_SHA)"
