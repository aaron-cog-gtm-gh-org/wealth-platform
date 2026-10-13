// SWIFT FIN tokenizer for the custodian archive (MT535, MT544–547). Handles CRLF and LF-only
// files, continuation lines (35B), and 16R/16S sequence nesting (GENL, SUBSAFE, FIN, ...).
import { normalizeDec, type Dec } from '../decimal.js';

export class SwiftParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SwiftParseError';
  }
}

export interface SwiftField {
  /** Tag incl. option letter, e.g. `20C`, `98A`, `35B`. */
  tag: string;
  /** Qualifier of generic fields (`:SEME//...` → `SEME`), else null. */
  qualifier: string | null;
  /** Text after `//` for qualified fields, else the whole first line; continuation lines excluded. */
  value: string;
  /** Every line of the field after `:TAG:`, continuation lines included. */
  lines: string[];
  /** Enclosing 16R sequences, outermost first, e.g. `['SUBSAFE', 'FIN']`. */
  path: string[];
  /** Occurrence id of each enclosing sequence (parallel to `path`); distinguishes repeated FIN blocks. */
  pathIds: number[];
}

export interface SwiftMessage {
  /** From block 2, e.g. 535; null when block 2 is missing. */
  mtType: number | null;
  /** 11-char BIC of the sender (block 2 output LT address without the LT code). */
  senderBic: string | null;
  /** Block 3 tags, e.g. `{ '108': '...' }`. */
  userHeader: Record<string, string>;
  fields: SwiftField[];
}

const FIELD_RE = /^:(\d{2}[A-Z]?):(.*)$/;
const QUALIFIED_RE = /^:([A-Z0-9]{4})\/([A-Z0-9]*)\/(.*)$/;

export function parseSwift(text: string): SwiftMessage {
  const b2 = /\{2:([^}]*)\}/.exec(text);
  let mtType: number | null = null;
  let senderBic: string | null = null;
  if (b2) {
    const h = b2[1];
    if (h[0] === 'O' && h.length >= 26) {
      mtType = Number(h.slice(1, 4));
      const lt = h.slice(14, 26);
      senderBic = lt.slice(0, 8) + lt.slice(9);
    } else if (h[0] === 'I' && h.length >= 4) {
      mtType = Number(h.slice(1, 4));
    }
    if (mtType !== null && !Number.isInteger(mtType)) throw new SwiftParseError(`Bad block 2 "${h}"`);
  }

  const userHeader: Record<string, string> = {};
  const b3 = /\{3:((?:\{[^}]*\})*)\}/.exec(text);
  if (b3) for (const m of b3[1].matchAll(/\{(\w+):([^}]*)\}/g)) userHeader[m[1]] = m[2];

  const b4s = text.indexOf('{4:');
  if (b4s < 0) throw new SwiftParseError('Missing block 4');
  const end = /\r?\n-\}/.exec(text.slice(b4s));
  if (!end) throw new SwiftParseError('Unterminated block 4');
  const body = text.slice(b4s + 3, b4s + end.index);

  const fields: SwiftField[] = [];
  const stack: string[] = [];
  const ids: number[] = [];
  let nextId = 1;
  let cur: SwiftField | null = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') continue;
    const m = FIELD_RE.exec(line);
    if (!m) {
      if (!cur) throw new SwiftParseError(`Unexpected line "${line}"`);
      cur.lines.push(line);
      continue;
    }
    const [, tag, rest] = m;
    if (tag === '16R') { stack.push(rest.trim()); ids.push(nextId++); cur = null; continue; }
    if (tag === '16S') {
      const top = stack.pop();
      ids.pop();
      if (top !== rest.trim()) throw new SwiftParseError(`16S:${rest} does not close 16R:${top ?? '(none)'}`);
      cur = null;
      continue;
    }
    const q = QUALIFIED_RE.exec(rest);
    cur = { tag, qualifier: q ? q[1] : null, value: q ? q[3] : rest, lines: [rest], path: [...stack], pathIds: [...ids] };
    fields.push(cur);
  }
  if (stack.length) throw new SwiftParseError(`Unclosed sequence 16R:${stack[stack.length - 1]}`);
  return { mtType, senderBic, userHeader, fields };
}

/** First field with `tag` (and `qualifier`, if given; `''` = unqualified). */
export function findField(fields: SwiftField[], tag: string, qualifier?: string): SwiftField | undefined {
  return fields.find(f => f.tag === tag && matchQ(f, qualifier));
}

export function findFields(fields: SwiftField[], tag: string, qualifier?: string): SwiftField[] {
  return fields.filter(f => f.tag === tag && matchQ(f, qualifier));
}

const matchQ = (f: SwiftField, q?: string) => q === undefined || (q === '' ? f.qualifier === null : f.qualifier === q);

/** Fields of each occurrence of sequence `name` (e.g. every FIN block, wherever it is nested). */
export function sequences(fields: SwiftField[], name: string): SwiftField[][] {
  const byId = new Map<number, SwiftField[]>();
  for (const f of fields) {
    const i = f.path.lastIndexOf(name);
    if (i < 0) continue;
    const id = f.pathIds[i];
    let list = byId.get(id);
    if (!list) byId.set(id, (list = []));
    list.push(f);
  }
  return [...byId.values()];
}

const SWIFT_DEC_RE = /^(N?)(\d+),(\d*)$/;

/**
 * SWIFT decimal (`,` is the decimal mark, mandatory; optional leading `N` = negative) → fixed-point
 * string with at least 2 places: `21637,5` → `21637.50`, `1250,` → `1250.00`, `0,5` → `0.50`.
 * Thousands separators and `.` are rejected (fixes D-7): `1.250,50` throws.
 */
export function parseSwiftDecimal(s: string): Dec {
  const m = SWIFT_DEC_RE.exec(s.trim());
  if (!m) throw new SwiftParseError(`Invalid SWIFT decimal "${s}"`);
  return normalizeDec(`${m[1] ? '-' : ''}${m[2]}.${m[3]}`);
}

/** `CCYamount` (e.g. `GBP21637,5`) → currency + decimal. */
export function parseSwiftAmount(s: string): { ccy: string; amount: Dec } {
  const m = /^([A-Z]{3})(.+)$/.exec(s.trim());
  if (!m) throw new SwiftParseError(`Invalid SWIFT amount "${s}"`);
  return { ccy: m[1], amount: parseSwiftDecimal(m[2]) };
}

/** `yyyyMMdd` → `YYYY-MM-DD`, validating the calendar date. */
export function parseSwiftDate(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.trim());
  if (!m) throw new SwiftParseError(`Invalid SWIFT date "${s}"`);
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw new SwiftParseError(`Invalid SWIFT date "${s}"`);
  return iso;
}

/** `97A::SAFE` value → number (fixes D-2: `0016056`, `16056`, `00016056` are the same safe). */
export function parseSafeNo(s: string): number {
  if (!/^\d{1,10}$/.test(s.trim())) throw new SwiftParseError(`Invalid safekeeping account "${s}"`);
  return Number(s.trim());
}
