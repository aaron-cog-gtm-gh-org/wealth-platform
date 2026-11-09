// legacy: PV.Core/Models.cs - MT535 statement and MT54x confirmation models.
import { Decimal } from '../decimal';
import { MIN_DATE, type IsoDate } from '../date';

/** legacy: Mt535Statement */
export interface Mt535Statement {
  /** whole 23G text, e.g. NEWM, RPLC, NEWM/DUPL; null without 23G */
  function: string | null;
  /** 98A::STAT (first 98A); MIN_DATE when absent */
  statementDate: IsoDate;
  /** 97A::SAFE raw, usually 7-digit padded */
  safekeepingAcct: string | null;
  lines: Mt535Line[];
  fileName: string | null;
  /** _NNN suffix of the archive file name, 0 when absent */
  fileSeq: number;
}

/** legacy: Mt535Line */
export interface Mt535Line {
  isin: string | null;
  /** last line of the 35B block */
  msgDescription: string | null;
  /** 90A/90B market price */
  price: Decimal;
  /** 93B::AGGR amount rounded to 4 dp */
  qty: Decimal;
  /** UNIT or FAMT - kept for reference */
  qtyType: string | null;
  /** instrument ccy from the first 19A::HOLD */
  ccy: string | null;
  mktVal: Decimal;
  mktValGbp: Decimal;
}

/** legacy: SettlementConfirm */
export interface SettlementConfirm {
  mtType: number;
  seme: string | null;
  prev: string | null;
  /** NEWM / CANC (raw 23G text) */
  function: string | null;
  tradeDate: IsoDate;
  settleDate: IsoDate;
  isin: string | null;
  qty: Decimal;
  /** 97A::SAFE raw from the confirmation (legacy field name `custAcct`) */
  custAcct: string | null;
  /** 19A::ESTT as sent, e.g. GBP4303,01 */
  amountRaw: string | null;
  ccy: string | null;
  /** REC for 544/545, DEL otherwise */
  direction: 'REC' | 'DEL';
  filePath: string | null;
  /** mt54x day folder the file was found in */
  folder: string | null;
}

export const newStatement = (): Mt535Statement => ({
  function: null, statementDate: MIN_DATE, safekeepingAcct: null, lines: [], fileName: null, fileSeq: 0,
});

export const newLine = (): Mt535Line => ({
  isin: null, msgDescription: null, price: Decimal.ZERO, qty: Decimal.ZERO, qtyType: null, ccy: null,
  mktVal: Decimal.ZERO, mktValGbp: Decimal.ZERO,
});
