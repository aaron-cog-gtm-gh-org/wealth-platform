// Fixed-point decimal strings (contracts/api.md `Dec`, research R-6). Values are carried as
// strings end to end; arithmetic uses BigInt scaled by 10^SCALE so no binary floating point
// ever touches a quantity, price or amount.

export type Dec = string;

const SCALE = 8;
const FACTOR = 10n ** BigInt(SCALE);
const DEC_RE = /^(-)?(\d+)(?:\.(\d*))?$/;

export function isDec(s: string): boolean {
  const m = DEC_RE.exec(s);
  return !!m && (m[3] ?? '').length <= SCALE;
}

/** Parse a canonical decimal string (`-123.45`) into scaled units. */
export function toUnits(d: Dec): bigint {
  const m = DEC_RE.exec(d);
  if (!m) throw new Error(`Invalid decimal "${d}"`);
  const frac = m[3] ?? '';
  if (frac.length > SCALE) throw new Error(`Decimal "${d}" exceeds ${SCALE} places`);
  const units = BigInt(m[2]) * FACTOR + BigInt((frac + '0'.repeat(SCALE)).slice(0, SCALE));
  return m[1] ? -units : units;
}

/** Format scaled units, trimming trailing zeros but keeping at least `minDp` places. */
export function fromUnits(u: bigint, minDp = 2): Dec {
  const neg = u < 0n;
  const abs = neg ? -u : u;
  const int = abs / FACTOR;
  let frac = (abs % FACTOR).toString().padStart(SCALE, '0').replace(/0+$/, '');
  if (frac.length < minDp) frac = frac.padEnd(minDp, '0');
  const s = frac ? `${int}.${frac}` : `${int}`;
  return neg && abs !== 0n ? `-${s}` : s;
}

/** Canonical form: no leading zeros, at least `minDp` places, `-0` → `0`. */
export const normalizeDec = (d: Dec, minDp = 2): Dec => fromUnits(toUnits(d), minDp);

export const decAdd = (a: Dec, b: Dec): Dec => fromUnits(toUnits(a) + toUnits(b));
export const decSub = (a: Dec, b: Dec): Dec => fromUnits(toUnits(a) - toUnits(b));
export const decNeg = (a: Dec): Dec => fromUnits(-toUnits(a));
export const decCmp = (a: Dec, b: Dec): -1 | 0 | 1 => {
  const d = toUnits(a) - toUnits(b);
  return d < 0n ? -1 : d > 0n ? 1 : 0;
};
export const decEq = (a: Dec, b: Dec): boolean => toUnits(a) === toUnits(b);
export const decIsZero = (a: Dec): boolean => toUnits(a) === 0n;
export const decSum = (values: Iterable<Dec>): Dec => {
  let t = 0n;
  for (const v of values) t += toUnits(v);
  return fromUnits(t);
};

/** Round to `dp` places; `half-even` matches .NET `Math.Round(decimal, int)`. */
export function decRound(d: Dec, dp: number, mode: 'half-even' | 'half-up' = 'half-even'): Dec {
  const u = toUnits(d);
  const step = 10n ** BigInt(SCALE - dp);
  const neg = u < 0n;
  const abs = neg ? -u : u;
  let q = abs / step;
  const r = abs % step;
  const half = step / 2n;
  if (r > half || (r === half && (mode === 'half-up' || q % 2n === 1n))) q += 1n;
  return fromUnits((neg ? -q : q) * step, Math.min(2, dp));
}

/** Lossy conversion for display-only DTOs that use `number` (existing Portfolio screens). */
export const decToNumber = (d: Dec): number => Number(d);
