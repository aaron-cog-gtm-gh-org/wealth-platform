// Exact decimal with .NET System.Decimal semantics for the operations PV.Core uses.
// Value = units / 10^scale. Scale is kept like .NET (parse keeps trailing zeros,
// add/sub use the larger scale) but equality and the canonical string ignore it.

const TEN = 10n;
const pow10 = (n: number) => TEN ** BigInt(n);
const MAX_UNITS = 79228162514264337593543950335n;

export class Decimal {
  private constructor(readonly units: bigint, readonly scale: number) {}

  static readonly ZERO = new Decimal(0n, 0);

  static of(units: bigint, scale = 0): Decimal {
    if (!Number.isInteger(scale) || scale < 0 || scale > 28) throw new RangeError('Decimal scale must be 0..28');
    return new Decimal(units, scale);
  }

  static fromInt(n: number): Decimal {
    if (!Number.isSafeInteger(n)) throw new RangeError('Not a safe integer');
    return new Decimal(BigInt(n), 0);
  }

  // legacy: decimal.Parse(s, NumberStyles.Number, CultureInfo.InvariantCulture)
  // (leading/trailing white, leading or trailing sign, one '.', thousands ',' after the first digit)
  static parse(text: string): Decimal {
    const m = /^[\t\n\v\f\r ]*([+-]?)(\d[\d,]*)?(?:\.(\d*))?([+-]?)[\t\n\v\f\r ]*$/.exec(text);
    if (!m || (m[1] && m[4]) || (!m[2] && !m[3])) throw new FormatError(text);
    const frac = m[3] ?? '';
    let units = BigInt((m[2] ?? '0').replace(/,/g, '') + frac);
    let scale = frac.length;
    if (scale > 28) { units = roundUnits(units, scale - 28, 'even'); scale = 28; }
    if (units > MAX_UNITS * pow10(scale)) throw new RangeError('Value was either too large or too small for a Decimal.');
    return new Decimal((m[1] || m[4]) === '-' ? -units : units, scale);
  }

  static tryParse(text: string): Decimal | null {
    try { return Decimal.parse(text); } catch { return null; }
  }

  private align(other: Decimal): [bigint, bigint, number] {
    const scale = Math.max(this.scale, other.scale);
    return [this.units * pow10(scale - this.scale), other.units * pow10(scale - other.scale), scale];
  }

  add(other: Decimal): Decimal { const [a, b, s] = this.align(other); return new Decimal(a + b, s); }
  sub(other: Decimal): Decimal { const [a, b, s] = this.align(other); return new Decimal(a - b, s); }
  neg(): Decimal { return new Decimal(-this.units, this.scale); }
  compare(other: Decimal): -1 | 0 | 1 { const [a, b] = this.align(other); return a < b ? -1 : a > b ? 1 : 0; }
  equals(other: Decimal): boolean { return this.compare(other) === 0; }
  isZero(): boolean { return this.units === 0n; }
  isNegative(): boolean { return this.units < 0n; }

  /** Divide by 10^n exactly (used for hundredths in SettlementReader.ToAmount). */
  shift(n: number): Decimal { return new Decimal(this.units, this.scale + n); }

  // legacy: Math.Round(decimal, decimals) - MidpointRounding.ToEven, scale only ever reduced
  round(decimals: number, mode: 'even' | 'awayFromZero' = 'even'): Decimal {
    if (this.scale <= decimals) return this;
    return new Decimal(roundUnits(this.units, this.scale - decimals, mode), decimals);
  }

  /** Canonical string: no exponent, trailing fractional zeros removed. */
  toString(): string {
    const neg = this.units < 0n;
    let abs = (neg ? -this.units : this.units).toString();
    if (this.scale > 0) {
      abs = abs.padStart(this.scale + 1, '0');
      const int = abs.slice(0, abs.length - this.scale);
      const frac = abs.slice(abs.length - this.scale).replace(/0+$/, '');
      abs = frac ? `${int}.${frac}` : int;
    }
    return neg && abs !== '0' ? '-' + abs : abs;
  }

  toJSON(): string { return this.toString(); }
}

export class FormatError extends Error {
  constructor(input: string) {
    super(`Input string was not in a correct format: '${input}'`);
    this.name = 'FormatError';
  }
}

function roundUnits(units: bigint, drop: number, mode: 'even' | 'awayFromZero'): bigint {
  const div = pow10(drop);
  const neg = units < 0n;
  const abs = neg ? -units : units;
  let q = abs / div;
  const r = abs % div;
  const twice = r * 2n;
  if (twice > div || (twice === div && (mode === 'awayFromZero' || q % 2n === 1n))) q += 1n;
  return neg ? -q : q;
}

/** Sum of decimals (legacy `decimal` += loops). */
export const sumDecimals = (values: Iterable<Decimal>) => {
  let total = Decimal.ZERO;
  for (const v of values) total = total.add(v);
  return total;
};
