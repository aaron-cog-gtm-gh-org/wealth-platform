/**
 * SWIFT MT535 / MT544–547 parsing ported from PV.Core `SwiftParser.cs` and `SwiftMessage.cs`.
 * Pure string processing: no file system or database access.
 */
import { fixedToNumber, parseSwiftFixed, roundFixed, SwiftParseError } from './decimal';
import type { ArchiveFileName, Confirmation, MessageFamily, Statement, StatementLine, SwiftField, SwiftMessage } from './types';

export { SwiftParseError } from './decimal';

/** Continental decimal (`1250,`, `2,7316`) as a number. */
export function parseSwiftDecimal(raw: string): number {
  return fixedToNumber(parseSwiftFixed(raw));
}

/**
 * Amount after a 3-letter currency, e.g. `GBP4303,01` → 4303.01. Fixes PV `ToAmount` (D3): no
 * int overflow and any number of decimals (`GBP11524,8` is 11524.80, not 11524.08). Null when the
 * text has no digits after the currency.
 */
export function parseSwiftAmount(raw: string | null): number | null {
  if (raw == null || raw.length <= 3) return null;
  try {
    return fixedToNumber(roundFixed(parseSwiftFixed(raw.slice(3)), 2));
  } catch {
    return null;
  }
}

/** Safekeeping account with leading zeros removed (PV statement key; D1 for confirmations). */
export function safeKey(code: string | null | undefined): string {
  return code == null ? '' : code.replace(/^0+/, '');
}

function makeField(tag: string, raw: string): SwiftField {
  const field = { tag, raw } as SwiftField;
  Object.defineProperties(field, {
    content: { enumerable: true, get: () => fieldContent(field.raw) },
    qualifier: { enumerable: true, get: () => fieldQualifier(field.raw) },
  });
  return field;
}

function fieldContent(raw: string): string {
  const i = raw.indexOf('//');
  return i < 0 ? raw.trim() : raw.slice(i + 2).trim();
}

function fieldQualifier(raw: string): string | null {
  const s = raw.startsWith(':') ? raw.slice(1) : raw;
  const i = s.indexOf('//');
  return i < 0 ? null : s.slice(0, i);
}

function trimChars(text: string, chars: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start])) start++;
  while (end > start && chars.includes(text[end - 1])) end--;
  return text.slice(start, end);
}

/** Reads block 2 and the block-4 field list. The `{5:}` trailer is not required. */
export function parseMessage(text: string): SwiftMessage {
  const message: SwiftMessage = { mtType: 0, senderLt: null, fields: [] };

  const b2s = text.indexOf('{2:');
  if (b2s >= 0) {
    const b2e = text.indexOf('}', b2s);
    if (b2e < 0) throw new SwiftParseError('Unterminated block 2');
    const b2 = text.slice(b2s + 3, b2e);
    if (b2.startsWith('O')) {
      if (b2.length < 23 || !/^\d{3}$/.test(b2.slice(1, 4))) throw new SwiftParseError(`Invalid block 2 "${b2}"`);
      message.mtType = Number(b2.slice(1, 4));
      message.senderLt = b2.slice(11, 23);
    }
  }

  const b4s = text.indexOf('{4:');
  if (b4s < 0) return message;
  let b4e = text.indexOf('\n-}', b4s);
  if (b4e < 0) b4e = text.indexOf('-}', b4s);
  if (b4e < 0) throw new SwiftParseError('Block 4 has no -} terminator');
  const body = trimChars(text.slice(b4s + 3, b4e), '\r\n');

  let current: SwiftField | null = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/\r+$/, '');
    if (line.startsWith(':')) {
      const p = line.indexOf(':', 1);
      if (p < 0) throw new SwiftParseError(`Malformed field line "${line}"`);
      current = makeField(line.slice(1, p), line.slice(p + 1));
      message.fields.push(current);
    } else if (current && line.length > 0) {
      current.raw += `\n${line}`;
    }
  }
  return message;
}

function find(message: SwiftMessage, tag: string): SwiftField | undefined {
  return message.fields.find((f) => f.tag === tag);
}

/** Fields between `:16R:<id>` and `:16S:<id>`; nested blocks of other ids are flattened in. */
export function blocks(message: SwiftMessage, blockId: string): SwiftField[][] {
  const result: SwiftField[][] = [];
  let current: SwiftField[] | null = null;
  for (const f of message.fields) {
    if (f.tag === '16R' && f.raw.trim() === blockId) {
      current = [];
      result.push(current);
    } else if (f.tag === '16S' && f.raw.trim() === blockId) {
      current = null;
    } else if (current) {
      current.push(f);
    }
  }
  return result;
}

function parseYmd(raw: string, what: string): string {
  const s = raw.trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) throw new SwiftParseError(`Invalid ${what} date "${s}"`);
  const [, y, mo, d] = m;
  const date = new Date(0);
  date.setUTCFullYear(Number(y), Number(mo) - 1, Number(d));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) {
    throw new SwiftParseError(`Invalid ${what} date "${s}"`);
  }
  return `${y}-${mo}-${d}`;
}

function rounded(raw: string, dp: number): number {
  return fixedToNumber(roundFixed(parseSwiftFixed(raw), dp));
}

function isinOf(field: SwiftField): { isin: string | null; parts: string[] } {
  const parts = field.raw.split('\n');
  return { isin: parts[0].startsWith('ISIN ') ? parts[0].slice(5).trim() : null, parts };
}

/** MT535 statement of holdings (PV `ParseStatement`). SUBSAFE blocks are flattened as in PV. */
export function parseStatement(text: string): Statement {
  const message = parseMessage(text);
  const f98 = find(message, '98A');
  if (!f98) throw new SwiftParseError('MT535 has no 98A statement date');
  const statement: Statement = {
    function: find(message, '23G')?.raw.trim() ?? null,
    statementDate: parseYmd(f98.content, '98A'),
    safekeepingAcct: find(message, '97A')?.content ?? null,
    lines: [],
  };

  for (const fin of blocks(message, 'FIN')) {
    let isin: string | null = null;
    let haveHold = false;
    const line: Omit<StatementLine, 'isin'> = { description: '', qty: 0, qtyType: '', price: 0, ccy: '', mktVal: 0, mktValGbp: 0 };
    for (const f of fin) {
      if (f.tag === '35B') {
        const parsed = isinOf(f);
        if (parsed.isin !== null) isin = parsed.isin;
        line.description = parsed.parts[parsed.parts.length - 1].trim();
      } else if (f.tag === '90A' || f.tag === '90B') {
        let v = f.content;
        const slash = v.lastIndexOf('/');
        if (slash >= 0) v = v.slice(slash + 1);
        if (v.length > 3 && /^\p{L}/u.test(v)) v = v.slice(3);
        line.price = parseSwiftDecimal(v);
      } else if (f.tag === '93B' && f.qualifier === 'AGGR') {
        const v = f.content;
        const slash = v.indexOf('/');
        line.qtyType = slash >= 0 ? v.slice(0, slash) : v;
        line.qty = rounded(slash >= 0 ? v.slice(slash + 1) : v, 4);
      } else if (f.tag === '19A' && f.qualifier === 'HOLD') {
        const v = f.content;
        if (v.length < 3) throw new SwiftParseError(`Invalid 19A::HOLD "${v}"`);
        const ccy = v.slice(0, 3);
        const value = rounded(v.slice(3), 2);
        if (!haveHold) {
          haveHold = true;
          line.ccy = ccy;
          line.mktVal = value;
          if (ccy === 'GBP') line.mktValGbp = value;
        } else if (ccy === 'GBP') {
          line.mktValGbp = value;
        }
      }
    }
    if (isin !== null) statement.lines.push({ isin, ...line });
  }
  return statement;
}

/** MT544–547 settlement confirmation (PV `ParseConfirm`). */
export function parseConfirmation(text: string): Confirmation {
  const message = parseMessage(text);
  let prev: string | null = null;
  for (const f of message.fields) if (f.tag === '20C' && f.qualifier === 'PREV') prev = f.content;

  let tradeDate: string | null = null;
  let settleDate: string | null = null;
  for (const f of message.fields) {
    if (f.tag !== '98A') continue;
    if (f.qualifier === 'TRAD') tradeDate = parseYmd(f.content, '98A::TRAD');
    else if (f.qualifier === 'SETT') settleDate = parseYmd(f.content, '98A::SETT');
  }
  if (tradeDate === null) throw new SwiftParseError('MT54x has no 98A::TRAD date');
  if (settleDate === null) throw new SwiftParseError('MT54x has no 98A::SETT date');

  const f35 = find(message, '35B');
  const f36 = find(message, '36B');
  let qty = 0;
  if (f36) {
    const v = f36.content;
    const slash = v.indexOf('/');
    qty = parseSwiftDecimal(slash >= 0 ? v.slice(slash + 1) : v);
  }

  const f19 = find(message, '19A');
  const amountRaw = f19 && f19.qualifier === 'ESTT' ? f19.content : null;

  return {
    mtType: message.mtType,
    seme: find(message, '20C')?.content ?? null,
    prev,
    function: find(message, '23G')?.raw.trim() ?? null,
    tradeDate,
    settleDate,
    isin: f35 ? isinOf(f35).isin : null,
    qty,
    safekeepingAcct: find(message, '97A')?.content ?? null,
    amountRaw,
    amount: parseSwiftAmount(amountRaw),
    ccy: amountRaw !== null && amountRaw.length > 3 ? amountRaw.slice(0, 3) : null,
    direction: message.mtType === 544 || message.mtType === 545 ? 'REC' : 'DEL',
  };
}

const FILE_NAME = /^MT(535|54[4-7])_([^_]+)_(\d{8})(?:_([^_.]*))?\.txt$/i;

/** Archive file-name metadata (PV `ArchiveIndex.MakeEntry` + `SwiftParser.FileSeq`); null when it does not match. */
export function parseArchiveFileName(fileName: string): ArchiveFileName | null {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const m = FILE_NAME.exec(base);
  if (!m) return null;
  let date: string;
  try {
    date = parseYmd(m[3], 'file name');
  } catch {
    return null;
  }
  const mtType = Number(m[1]);
  const family: MessageFamily = mtType === 535 ? 'MT535' : 'MT54x';
  const seq = m[4] ?? '';
  return { fileName: base, family, mtType, safeCode: m[2], date, fileSeq: /^\d+$/.test(seq) ? Number(seq) : 0 };
}
