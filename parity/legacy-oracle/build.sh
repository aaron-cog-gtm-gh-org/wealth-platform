#!/usr/bin/env bash
# Builds the unmodified legacy PV.Data / PV.Core / PV.Tests sources with Mono and the oracle harness.
# usage: build.sh <legacy-repo> <packages-dir> <out-dir>
set -euo pipefail
LEGACY=$(cd "$1" && pwd); PKG=$(cd "$2" && pwd); OUT=$3
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
LOG4NET=$PKG/log4net.2.0.8/lib/net45-full/log4net.dll
NUNIT=$PKG/nunit.2.6.4/lib/nunit.framework.dll
cp "$LOG4NET" "$NUNIT" "$OUT/"
src() { find "$LEGACY/src/$1" -name '*.cs' | LC_ALL=C sort; }

# PV.Data.csproj references + System.Xml/System.Xml.Linq (DataTable's IXmlSerializable, CS0012 on Mono)
mcs -sdk:4.5 -target:library -nologo -warn:0 -out:"$OUT/PV.Data.dll" \
  -r:System.dll -r:System.Configuration.dll -r:System.Data.dll -r:System.Web.dll \
  -r:System.Xml.dll -r:System.Xml.Linq.dll $(src PV.Data)
# PV.Core.csproj references (System.Core is implicit for v4.x projects)
mcs -sdk:4.5 -target:library -nologo -warn:0 -out:"$OUT/PV.Core.dll" \
  -r:System.dll -r:System.Core.dll -r:System.Data.dll -r:System.Xml.dll \
  -r:"$LOG4NET" -r:"$OUT/PV.Data.dll" $(src PV.Core)
mcs -sdk:4.5 -target:library -nologo -warn:0 -out:"$OUT/PV.Tests.dll" \
  -r:System.dll -r:System.Data.dll -r:"$NUNIT" -r:"$OUT/PV.Core.dll" -r:"$OUT/PV.Data.dll" $(src PV.Tests)
mcs -sdk:4.5 -target:exe -nologo -out:"$OUT/LegacyOracle.exe" \
  -r:System.dll -r:System.Core.dll -r:System.Data.dll -r:System.Xml.dll \
  -r:"$LOG4NET" -r:"$OUT/PV.Data.dll" -r:"$OUT/PV.Core.dll" "$HERE/LegacyOracle.cs"
echo "built into $OUT"
