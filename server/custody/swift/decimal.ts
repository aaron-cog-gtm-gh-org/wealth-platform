/**
 * Exact decimal helpers for SWIFT amounts and quantities. Values are carried as
 * scaled bigints so sums and differences never pick up binary floating-point error.
 */

export class SwiftParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SwiftParseError';
  }
}

export interface Fixed {
  units: bigint;
  scale: number;
}

const DECIMAL = /^\s*([+-])?(\d*)(?:\.(\d*))?\s*$/;

function fixedFromText(text: string, source: string): Fixed {
  const match = DECIMAL.exec(text);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new SwiftParseError(`Invalid decimal "${source}"`);
  }
  const fraction = match[3] ?? '';
  const units = BigInt(`${match[2] || '0'}${fraction}`);
  return { units: match[1] === '-' ? -units : units, scale: fraction.length };
}

/**
 * Parses a SWIFT/continental decimal (`1250,`, `2,7316`, `0,5`) the way PV's
 * `SwiftParser.ParseDecimal` does: the comma is the decimal mark, no thousands separators.
 */
export function parseSwiftFixed(raw: string): Fixed {
  return fixedFromText(raw.replace(/,/g, '.'), raw);
}

/** Rounds half-to-even, matching .NET `Math.Round(decimal, dp)`. */
export function roundFixed(value: Fixed, dp: number): Fixed {
  if (value.scale <= dp) return value;
  const divisor = 10n ** BigInt(value.scale - dp);
  const negative = value.units < 0n;
  const abs = negative ? -value.units : value.units;
  let quotient = abs / divisor;
  const twice = (abs % divisor) * 2n;
  if (twice > divisor || (twice === divisor && quotient % 2n === 1n)) quotient += 1n;
  return { units: negative ? -quotient : quotient, scale: dp };
}

export function rescale(value: Fixed, scale: number): bigint {
  if (scale < value.scale) throw new RangeError(`Cannot rescale ${value.scale} dp to ${scale} dp without rounding`);
  return value.units * 10n ** BigInt(scale - value.scale);
}

/** Canonical decimal text without trailing zeros, e.g. `4303.01`, `1250`, `-0.5`. */
export function fixedToText(value: Fixed): string {
  const negative = value.units < 0n;
  let digits = (negative ? -value.units : value.units).toString();
  if (value.scale > 0) {
    digits = digits.padStart(value.scale + 1, '0');
    const whole = digits.slice(0, -value.scale);
    const fraction = digits.slice(-value.scale).replace(/0+$/, '');
    digits = fraction ? `${whole}.${fraction}` : whole;
  }
  return negative && digits !== '0' ? `-${digits}` : digits;
}

export function fixedToNumber(value: Fixed): number {
  return Number(fixedToText(value));
}

/** Exact decimal value of a JS number as written by `String(n)` (handles exponent form). */
export function fixedFromNumber(value: number): Fixed {
  if (!Number.isFinite(value)) throw new RangeError(`Not a finite number: ${value}`);
  const [mantissa, exponentText] = String(value).split('e');
  const base = fixedFromText(mantissa, String(value));
  const exponent = exponentText ? Number(exponentText) : 0;
  if (exponent >= 0) return { units: base.units * 10n ** BigInt(Math.max(0, exponent - base.scale)), scale: Math.max(0, base.scale - exponent) };
  return { units: base.units, scale: base.scale - exponent };
}
