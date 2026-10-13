// MT535 (statement of holdings) → normalized statement. See data-model.md custody_statements /
// custody_statement_lines and legacy-as-built.md §5.
import type { Dec } from '../decimal.js';
import {
  SwiftParseError, findField, findFields, parseSafeNo, parseSwift, parseSwiftAmount, parseSwiftDate,
  parseSwiftDecimal, sequences, type SwiftField, type SwiftMessage,
} from './parse.js';

export type QtyType = 'UNIT' | 'FAMT';
export type StatementFunction = 'NEWM' | 'RPLC' | 'NEWM/DUPL';

export interface Mt535Line {
  lineNo: number;
  isin: string;
  /** Last line of 35B (custodian description), kept for unknown instruments (D-5). */
  custodianDesc: string | null;
  qty: Dec;
  qtyType: QtyType;
  price: Dec;
  /** 90A/90B price type: `ACTU` (amount per unit) or `PRCT` (percentage of face). */
  priceType: string;
  /** Instrument/valuation currency (first 19A::HOLD). */
  ccy: string;
  marketValue: Dec;
  /** GBP value: the GBP 19A::HOLD, or null when none was sent (flagged per FR-010 / D-8). */
  reportingValue: Dec | null;
  /** SUBSAFE id (its 97A::SAFE, else the 1-based SUBSAFE ordinal) when the line was wrapped. */
  subsafe: string | null;
}

export interface Mt535Statement {
  mtType: 535;
  senderBic: string | null;
  seme: string | null;
  functionCode: StatementFunction;
  statementDate: string;
  /** 97A::SAFE exactly as sent (legacy keys off this string). */
  safeRaw: string;
  safeNo: number;
  /** `17B::ACTI//N`: statement with no holdings. */
  isEmpty: boolean;
  lines: Mt535Line[];
}

const FUNCTIONS: readonly string[] = ['NEWM', 'RPLC', 'NEWM/DUPL'];

function required(fields: SwiftField[], tag: string, qualifier: string, where: string): SwiftField {
  const f = findField(fields, tag, qualifier);
  if (!f) throw new SwiftParseError(`MT535 missing :${tag}::${qualifier} in ${where}`);
  return f;
}

/** `ISIN GB00ZZ000031` / `/GB/4147774` / `Name` → ISIN + description. */
export function parse35B(f: SwiftField): { isin: string; description: string | null } {
  const m = /^ISIN ([A-Z]{2}[A-Z0-9]{9}\d)\s*$/.exec(f.lines[0]);
  if (!m) throw new SwiftParseError(`35B without ISIN: "${f.lines[0]}"`);
  const description = f.lines.length > 1 ? f.lines[f.lines.length - 1].trim() || null : null;
  return { isin: m[1], description };
}

/** 90A/90B `ACTU/GBP22,486` or `PRCT/97,425`. */
export function parsePrice(f: SwiftField): { priceType: string; ccy: string | null; price: Dec } {
  const m = /^([A-Z]{4})\/([A-Z]{3})?(.+)$/.exec(f.value);
  if (!m) throw new SwiftParseError(`Invalid price "${f.value}"`);
  return { priceType: m[1], ccy: m[2] ?? null, price: parseSwiftDecimal(m[3]) };
}

/** 93B/36B `UNIT/1850,` or `FAMT/4000,`. */
export function parseQuantity(f: SwiftField): { qtyType: QtyType; qty: Dec } {
  const m = /^(UNIT|FAMT)\/(.+)$/.exec(f.value);
  if (!m) throw new SwiftParseError(`Invalid quantity "${f.value}"`);
  return { qtyType: m[1] as QtyType, qty: parseSwiftDecimal(m[2]) };
}

export function mapMt535(msg: SwiftMessage): Mt535Statement {
  if (msg.mtType !== 535) throw new SwiftParseError(`Expected MT535, got MT${msg.mtType}`);
  const genl = msg.fields.filter(f => f.path[0] === 'GENL');
  const fn = required(genl, '23G', '', 'GENL');
  const functionCode = fn.value.trim();
  if (!FUNCTIONS.includes(functionCode)) throw new SwiftParseError(`Unsupported MT535 function "${functionCode}"`);
  const safeRaw = required(genl, '97A', 'SAFE', 'GENL').value.trim();
  const acti = findField(genl, '17B', 'ACTI');

  const subsafeIds = new Map<number, string>();
  sequences(msg.fields, 'SUBSAFE').forEach((fs, i) => {
    const own = fs.find(f => f.tag === '97A' && f.qualifier === 'SAFE' && f.path[f.path.length - 1] === 'SUBSAFE');
    subsafeIds.set(fs[0].pathIds[fs[0].path.lastIndexOf('SUBSAFE')], own ? own.value.trim() : String(i + 1));
  });

  const lines = sequences(msg.fields, 'FIN').map((fin, i): Mt535Line => {
    const where = `FIN #${i + 1}`;
    const f35 = findField(fin, '35B');
    if (!f35) throw new SwiftParseError(`MT535 missing :35B in ${where}`);
    const { isin, description } = parse35B(f35);
    const priceField = findField(fin, '90A', 'MRKT') ?? findField(fin, '90B', 'MRKT');
    if (!priceField) throw new SwiftParseError(`MT535 missing :90a::MRKT in ${where}`);
    const price = parsePrice(priceField);
    const { qty, qtyType } = parseQuantity(required(fin, '93B', 'AGGR', where));
    const holds = findFields(fin, '19A', 'HOLD').map(f => parseSwiftAmount(f.value));
    if (!holds.length) throw new SwiftParseError(`MT535 missing :19A::HOLD in ${where}`);
    const gbp = holds.find(h => h.ccy === 'GBP');
    const ssIdx = fin[0].path.lastIndexOf('SUBSAFE');
    return {
      lineNo: i + 1, isin, custodianDesc: description, qty, qtyType,
      price: price.price, priceType: price.priceType, ccy: holds[0].ccy,
      marketValue: holds[0].amount, reportingValue: gbp ? gbp.amount : null,
      subsafe: ssIdx >= 0 ? subsafeIds.get(fin[0].pathIds[ssIdx]) ?? null : null,
    };
  });

  const isEmpty = acti?.value.trim() === 'N';
  if (isEmpty && lines.length) throw new SwiftParseError('MT535 flagged ACTI//N but carries holdings');
  return {
    mtType: 535, senderBic: msg.senderBic,
    seme: findField(genl, '20C', 'SEME')?.value.trim() ?? null,
    functionCode: functionCode as StatementFunction,
    statementDate: parseSwiftDate(required(genl, '98A', 'STAT', 'GENL').value),
    safeRaw, safeNo: parseSafeNo(safeRaw), isEmpty, lines,
  };
}

export const parseMt535 = (text: string): Mt535Statement => mapMt535(parseSwift(text));
