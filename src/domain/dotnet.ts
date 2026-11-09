// Small .NET Framework BCL equivalents used by the PV.Core port (Path.*, String.Trim, int.Parse).

// char.IsWhiteSpace for the characters String.Trim() removes (.NET 4: excludes U+FEFF)
const WS = '\\t\\n\\v\\f\\r \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const TRIM = new RegExp(`^[${WS}]+|[${WS}]+$`, 'g');

/** String.Trim() */
export const csTrim = (s: string) => s.replace(TRIM, '');

/** String.Trim(chars) / TrimEnd(chars) / TrimStart(chars) */
export function trimChars(s: string, chars: string, side: 'both' | 'start' | 'end' = 'both'): string {
  let a = 0;
  let b = s.length;
  if (side !== 'end') while (a < b && chars.includes(s[a])) a++;
  if (side !== 'start') while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

const lastSep = (p: string) => Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));

/** Path.GetFileName (Windows separators: `\` and `/`) */
export const fileName = (p: string) => p.slice(lastSep(p) + 1);

/** Path.GetDirectoryName - '' when the path has no directory part */
export const directoryName = (p: string) => { const i = lastSep(p); return i < 0 ? '' : p.slice(0, i); };

/** Path.GetFileNameWithoutExtension */
export const fileNameWithoutExtension = (p: string) => {
  const n = fileName(p);
  const dot = n.lastIndexOf('.');
  return dot < 0 ? n : n.slice(0, dot);
};

/** int.TryParse (NumberStyles.Integer, Int32 range) */
export function tryParseInt(s: string): number | null {
  const m = /^[\t\n\v\f\r ]*([+-]?\d+)[\t\n\v\f\r ]*$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= -2147483648 && n <= 2147483647 ? n : null;
}

/** int.Parse - throws FormatException equivalent */
export function parseInt32(s: string): number {
  const n = tryParseInt(s);
  if (n === null) throw new Error(`Input string was not in a correct format: '${s}'`);
  return n;
}

/** String.Substring(start, length) with .NET bounds checking */
export function substring(s: string, start: number, length = s.length - start): string {
  if (start < 0 || length < 0 || start + length > s.length) {
    throw new RangeError(`Index and length must refer to a location within the string (${start}, ${length}).`);
  }
  return s.slice(start, start + length);
}

/** String.CompareOrdinal sign, for List.Sort / OrderBy with StringComparer.Ordinal */
export const compareOrdinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
