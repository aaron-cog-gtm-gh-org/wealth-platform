# Contract: `src/domain` (spec 001)

Import from `src/domain` (barrel). All functions are pure and synchronous.

## Decimal (`decimal.ts`)
```ts
class Decimal {
  static ZERO: Decimal
  static parse(text: string): Decimal        // decimal.Parse NumberStyles.Number, invariant; throws FormatError
  static tryParse(text: string): Decimal | null
  static of(units: bigint, scale?: number): Decimal
  static fromInt(n: number): Decimal
  add(o) sub(o) neg() compare(o): -1|0|1  equals(o)  isZero()  isNegative()
  shift(n): Decimal                          // ÷ 10^n
  round(decimals, mode = 'even' | 'awayFromZero'): Decimal   // Math.Round default ToEven
  toString(): string                         // canonical, e.g. "941.8671", "1250", "-0.5"
  toJSON(): string                           // same as toString - API DTOs carry decimals as strings
}
sumDecimals(values: Iterable<Decimal>): Decimal
```

## Dates (`date.ts`)
```ts
type IsoDate = string                         // 'YYYY-MM-DD'
MIN_DATE = '0001-01-01'
parseYmd(s): IsoDate        // strict yyyyMMdd after trim, throws
tryParseYmd(s): IsoDate | null
toYmd(d): string            // 'yyyyMMdd'
addDays(d, n): IsoDate
compareDates(a, b): -1|0|1
isIsoDate(s): boolean
makeDate(y, m, d): IsoDate | null
formatDate(d): string       // DateUtil.FormatDate 'dd-MMM-yyyy' upper case: '15-NOV-2018'
```

## Display formats (`format.ts`, from `PV.Web/App_Code/WebUtil.cs`)
| Function | Legacy | Example |
| --- | --- | --- |
| `fmtQty(d)` | `FmtQty` `#,##0.####` | `1,660`, `941.8671` |
| `fmtPx(d)` | `FmtPx` `#,##0.0000` | `34.5530` |
| `fmtMoney(d)` | `FmtMoney` `#,##0.00` | `57,357.98` |
| `fmtUkDate(d \| null)` | `FmtDt` `dd/MM/yyyy` | `20/04/2026`, `''` |
| `parseUkDate(s)` | `TryParseUkDate` | `'20/04/2026'` → `'2026-04-20'`, else `null` |
| `statusText(cd)` | `StatusText` | `A` Active, `D` Dormant, `C` Closed, other unchanged |

Rounding in formats is half away from zero (.NET custom formats).

## SWIFT (`swift/`)
```ts
parseDecimal(s): Decimal                                  // SwiftParser.ParseDecimal (Q1)
parseMessage(text, path?: string | null): SwiftMessage    // SwiftParser.Parse
parseStatement(text, path?): Mt535Statement               // SwiftParser.ParseStatement (Q2-Q5)
parseConfirm(text, path?): SettlementConfirm              // SwiftParser.ParseConfirm (Q6)
fileSeq(path | null): number                              // SwiftParser.FileSeq
class SwiftField { tag; raw; content; qualifier }
class SwiftMessage { mtType; senderLT; fields; fileName; find(tag); findAll(tag); blocks(id) }
```
`ParseFile` is not ported here: file reading belongs to the archive reader (spec 002), which calls
`parseStatement(text, path)` / `parseConfirm(text, path)` with the file text and its archive-relative path.

Errors: parsers throw (`Error`/`RangeError`/`FormatError`) wherever legacy throws; callers that index the archive
count these as parse errors (spec 002).

Types: see [data-model.md](../data-model.md).
