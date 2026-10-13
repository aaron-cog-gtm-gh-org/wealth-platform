// MT544–547 (settlement confirmations) → normalized confirmation. See data-model.md
// custody_confirmations and legacy-as-built.md §5.
import type { Dec } from '../decimal.js';
import { parse35B, parseQuantity, type QtyType } from './mt535.js';
import {
  SwiftParseError, findField, parseSafeNo, parseSwift, parseSwiftAmount, parseSwiftDate, type SwiftMessage,
} from './parse.js';

export type ConfirmationMt = 544 | 545 | 546 | 547;
export type Direction = 'RECEIVE' | 'DELIVER';

export interface Mt54xConfirmation {
  mtType: ConfirmationMt;
  senderBic: string | null;
  seme: string;
  /** `20C::PREV` (the SEME a CANC cancels), else null. */
  prevRef: string | null;
  functionCode: 'NEWM' | 'CANC';
  tradeDate: string | null;
  settleDate: string;
  isin: string;
  custodianDesc: string | null;
  qty: Dec;
  qtyType: QtyType;
  /** 97A::SAFE exactly as sent (legacy keys off this padded string). */
  safeRaw: string;
  safeNo: number;
  /** 19A::ESTT settled amount; null on free-of-payment confirmations. */
  amount: Dec | null;
  amountCcy: string | null;
  /** 19A::ESTT value as sent, e.g. `GBP21637,5` (legacy BR-5 recomputes from this). */
  amountRaw: string | null;
  direction: Direction;
  /** MT544/MT546 (receive/deliver free). */
  freeOfPayment: boolean;
}

export function mapMt54x(msg: SwiftMessage): Mt54xConfirmation {
  const mt = msg.mtType;
  if (mt !== 544 && mt !== 545 && mt !== 546 && mt !== 547) throw new SwiftParseError(`Expected MT544-547, got MT${mt}`);
  const f = msg.fields;
  const need = (tag: string, q?: string) => {
    const x = findField(f, tag, q);
    if (!x) throw new SwiftParseError(`MT${mt} missing :${tag}${q ? `::${q}` : ''}`);
    return x;
  };
  const functionCode = need('23G').value.trim();
  if (functionCode !== 'NEWM' && functionCode !== 'CANC') throw new SwiftParseError(`Unsupported MT${mt} function "${functionCode}"`);
  const prevRef = findField(f, '20C', 'PREV')?.value.trim() ?? null;
  if (functionCode === 'CANC' && !prevRef) throw new SwiftParseError(`MT${mt} CANC without :20C::PREV`);
  const { isin, description } = parse35B(need('35B'));
  const { qty, qtyType } = parseQuantity(need('36B', 'ESTT'));
  const safeRaw = need('97A', 'SAFE').value.trim();
  const est = findField(f, '19A', 'ESTT');
  const amount = est ? parseSwiftAmount(est.value) : null;
  const trad = findField(f, '98A', 'TRAD');
  return {
    mtType: mt, senderBic: msg.senderBic,
    seme: need('20C', 'SEME').value.trim(), prevRef, functionCode,
    tradeDate: trad ? parseSwiftDate(trad.value) : null,
    settleDate: parseSwiftDate(need('98A', 'SETT').value),
    isin, custodianDesc: description, qty, qtyType, safeRaw, safeNo: parseSafeNo(safeRaw),
    amount: amount?.amount ?? null, amountCcy: amount?.ccy ?? null, amountRaw: est ? est.value.trim() : null,
    direction: mt === 544 || mt === 545 ? 'RECEIVE' : 'DELIVER',
    freeOfPayment: mt === 544 || mt === 546,
  };
}

export const parseMt54x = (text: string): Mt54xConfirmation => mapMt54x(parseSwift(text));
