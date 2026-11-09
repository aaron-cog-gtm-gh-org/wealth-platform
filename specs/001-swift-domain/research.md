# Research: SWIFT domain & parsing

## R1 Decimal representation
- **Decision**: own `Decimal` class over `bigint` units + scale (0–28) implementing exactly the .NET operations
  PV.Core uses: `Parse(NumberStyles.Number)`, `+`, `-`, compare, `Math.Round(d, n)` (midpoint to even) and
  away-from-zero rounding for display formats.
- **Rationale**: constitution I requires exact decimals; the operation set is tiny; no runtime dependency.
- **Alternatives**: `decimal.js`/`big.js` (extra dependency, different default rounding/toString semantics); `number`
  (rejected: binary drift, e.g. 0.1+0.2).

## R2 Dates
- **Decision**: ISO `YYYY-MM-DD` strings (`IsoDate`), `MIN_DATE = '0001-01-01'` for `DateTime.MinValue`.
- **Rationale**: PV.Core only uses dates at midnight; strings sort correctly, serialise unchanged over JSON and avoid
  time-zone shifts of JS `Date`.

## R3 String/Path semantics
- **Decision**: `dotnet.ts` reproduces `String.Trim()` (.NET 4 whitespace set), `Trim(chars)`, `Substring` bounds
  exceptions, `Path.GetFileName/GetDirectoryName/GetFileNameWithoutExtension` with both `\` and `/`, and
  `int.Parse/TryParse`.
- **Rationale**: the legacy NUnit test passes Windows paths; failures (e.g. unterminated block 4) must still throw so
  spec 002 counts parse errors identically.
- Culture-sensitive `IndexOf`/`StartsWith` are treated as ordinal (FIN is ASCII).

## R4 Field-name casing
- **Decision**: camelCase of the legacy names (`msgDescription`, `mktValGbp`, `custAcct` kept as is).
- **Rationale**: traceability (constitution VII) with TS conventions.

## R5 Legacy SenderLT offset
- Legacy reads `b2.Substring(11, 12)`; the LT actually starts at 14. Preserved (no screen uses it) and recorded in the spec.

## R6 Test runner
- **Decision**: Vitest 2.1.9 (last 2.x, supports Vite 5) with its own `vitest.config.ts` restricted to
  `src/domain/**/*.test.ts` so the `node --test` suites are never collected.
