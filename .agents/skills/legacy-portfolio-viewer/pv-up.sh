#!/usr/bin/env bash
# Brings up the legacy Portfolio Viewer (ASP.NET Web Forms 4.8) on Linux:
# SQL Server 2022 container "pvsql" (db/schema + db/seed, recreated fresh), Mono build of
# PV.Data/PV.Core/PV.Web, site deployed to <work>/site with the archive copied to <work>/archive,
# served by xsp4 (built from source) on :$PV_PORT. The legacy checkout is only read.
# usage: pv-up.sh <legacy-wealth-platform checkout> [work-dir]
set -euo pipefail
LEGACY=$(cd "${1:?usage: pv-up.sh <legacy checkout> [work-dir]}" && pwd)
WORK=${2:-$HOME/pv-run}
PORT=${PV_PORT:-8080}
IMG=mcr.microsoft.com/mssql/server:2022-latest; NAME=pvsql; SA_PASS='Pv!Local2018'
SQLCMD=/opt/mssql-tools18/bin/sqlcmd
XSP_PREFIX=/opt/xsp; XSP_COMMIT=3330ff0790eaa48b0b54174edc0736b9b6006841
LOG4NET_SHA=c4b05496f5eb4e09e62fdeafa7566fc49a6558e08d06e3a752e08cf990eea236
mkdir -p "$WORK"; WORK=$(cd "$WORK" && pwd)

need() { command -v "$1" >/dev/null 2>&1; }
if ! need mcs || ! need mono; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mono-complete libtool-bin automake autoconf >/dev/null
fi

# --- 1. reference DB (db/setup_db.bat recipe); DB dropped and recreated so recon notes are the seed's
if ! docker inspect "$NAME" >/dev/null 2>&1; then
  docker run -d --name "$NAME" -e ACCEPT_EULA=Y -e MSSQL_PID=Express -e "MSSQL_SA_PASSWORD=$SA_PASS" \
    -p 1433:1433 "$IMG" >/dev/null
else
  docker start "$NAME" >/dev/null
fi
echo "Waiting for SQL Server..."
until docker exec "$NAME" $SQLCMD -S localhost -U sa -P "$SA_PASS" -C -Q "select 1" >/dev/null 2>&1; do sleep 3; done
if [ "${PV_KEEP_DB:-0}" != 1 ]; then
  docker exec "$NAME" $SQLCMD -S localhost -U sa -P "$SA_PASS" -C -b -Q \
    "IF DB_ID('PortfolioViewer') IS NOT NULL BEGIN ALTER DATABASE PortfolioViewer SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE PortfolioViewer; END" >/dev/null
  for f in $(cd "$LEGACY/db" && ls schema/*.sql | LC_ALL=C sort) $(cd "$LEGACY/db" && ls seed/*.sql | LC_ALL=C sort); do
    echo "Applying db/$f"
    docker exec -i "$NAME" $SQLCMD -S localhost -U sa -P "$SA_PASS" -C -b < "$LEGACY/db/$f" >/dev/null
  done
fi

# --- 2. log4net 2.0.8 (PV.Core/PV.Web packages.config), pinned by SHA-256
PKG=$WORK/packages; mkdir -p "$PKG"
NUPKG=$PKG/log4net.2.0.8.nupkg
[ -f "$NUPKG" ] || curl -sSfL -o "$NUPKG" https://api.nuget.org/v3-flatcontainer/log4net/2.0.8/log4net.2.0.8.nupkg
echo "$LOG4NET_SHA  $NUPKG" | sha256sum -c --quiet -
rm -rf "$PKG/log4net.2.0.8" && mkdir -p "$PKG/log4net.2.0.8" && (cd "$PKG/log4net.2.0.8" && unzip -qo "$NUPKG")
LOG4NET=$PKG/log4net.2.0.8/lib/net45-full/log4net.dll

# --- 3. Mono build of the unmodified sources (csproj references + System.Xml for DataTable, CS0012)
SITE=$WORK/site; BIN=$SITE/bin
rm -rf "$SITE"; mkdir -p "$BIN"
cp "$LOG4NET" "$BIN/"
src() { find "$LEGACY/src/$1" -name '*.cs' | LC_ALL=C sort; }
mcs -sdk:4.5 -target:library -nologo -warn:0 -out:"$BIN/PV.Data.dll" \
  -r:System.dll -r:System.Configuration.dll -r:System.Data.dll -r:System.Web.dll \
  -r:System.Xml.dll -r:System.Xml.Linq.dll $(src PV.Data)
mcs -sdk:4.5 -target:library -nologo -warn:0 -out:"$BIN/PV.Core.dll" \
  -r:System.dll -r:System.Core.dll -r:System.Data.dll -r:System.Xml.dll \
  -r:"$LOG4NET" -r:"$BIN/PV.Data.dll" $(src PV.Core)
mcs -sdk:4.5 -target:library -nologo -warn:0 -out:"$BIN/PV.Web.dll" \
  -r:System.dll -r:System.Core.dll -r:System.Data.dll -r:System.Xml.dll -r:System.Configuration.dll \
  -r:System.Web.dll -r:System.Web.ApplicationServices.dll -r:System.Drawing.dll \
  -r:"$LOG4NET" -r:"$BIN/PV.Data.dll" -r:"$BIN/PV.Core.dll" $(src PV.Web)

# --- 4. deploy site content + archive copy; Web.config with an absolute ArchiveRoot
(cd "$LEGACY/src/PV.Web" && cp -r *.aspx Site.Master Global.asax Styles Images "$SITE/")
rm -rf "$WORK/archive" && cp -r "$LEGACY/archive" "$WORK/archive"
sed "s#<add key=\"ArchiveRoot\" value=\"[^\"]*\" />#<add key=\"ArchiveRoot\" value=\"$WORK/archive\" />#" \
  "$LEGACY/src/PV.Web/Web.config" > "$SITE/Web.config"
grep -q "value=\"$WORK/archive\"" "$SITE/Web.config"

# --- 5. xsp4 from source (Debian's mono-xsp4 crashes: Mono.Security PrivateKeySelectionCallback)
if [ ! -x "$XSP_PREFIX/bin/xsp4" ]; then
  [ -d "$WORK/xsp-src/.git" ] || git clone -q https://github.com/mono/xsp.git "$WORK/xsp-src"
  (cd "$WORK/xsp-src" && git checkout -q "$XSP_COMMIT" && ./autogen.sh --prefix="$XSP_PREFIX" >/dev/null \
    && make >/dev/null && sudo make install >/dev/null)
fi

# --- 6. serve
"$(dirname "$0")/pv-down.sh" >/dev/null 2>&1 || true
cd "$SITE"
MONO_GAC_PREFIX=$XSP_PREFIX:/usr nohup "$XSP_PREFIX/bin/xsp4" --port "$PORT" --address 0.0.0.0 \
  --root "$SITE" --nonstop > "$WORK/xsp.log" 2>&1 &
echo $! > "$WORK/xsp.pid"
echo "Waiting for PV on :$PORT..."
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "http://localhost:$PORT/Login.aspx"; then
    echo "Portfolio Viewer up: http://localhost:$PORT/Login.aspx (PVADMIN / portfolio1)"; exit 0
  fi
  sleep 2
done
echo "PV did not come up; see $WORK/xsp.log" >&2; tail -40 "$WORK/xsp.log" >&2; exit 1
