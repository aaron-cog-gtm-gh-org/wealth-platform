/** Parsed SWIFT custody messages (ported from PV.Core `Models.cs`). Dates are ISO `YYYY-MM-DD`. */

export interface SwiftField {
  /** Field tag, e.g. `20C`, `98A`, `35B`. */
  tag: string;
  /** Everything after the tag colon, including `:QUAL//` and `\n`-joined continuation lines. */
  raw: string;
  /** Text after the first `//`, trimmed; the trimmed raw text when there is no `//`. */
  content: string;
  /** Qualifier between `::` and `//` (`STAT`, `SAFE`, `HOLD`, ...), or null. */
  qualifier: string | null;
}

export interface SwiftMessage {
  /** From block 2 (`{2:O535...}`); 0 when block 2 is missing or not an output message. */
  mtType: number;
  senderLt: string | null;
  fields: SwiftField[];
}

export interface StatementLine {
  isin: string;
  /** Last line of 35B as sent; screens show the reference-data name instead. */
  description: string;
  /** 93B::AGGR, rounded to 4 dp. 0 when absent. */
  qty: number;
  /** `UNIT` or `FAMT`; empty when 93B::AGGR is absent (never in the PV archive). */
  qtyType: string;
  /** 90A/90B market price as sent. 0 when absent. */
  price: number;
  /** Currency of the first 19A::HOLD; empty when absent (never in the PV archive). */
  ccy: string;
  /** First 19A::HOLD, rounded to 2 dp. */
  mktVal: number;
  /** The GBP 19A::HOLD, rounded to 2 dp; 0 when the line has no GBP value. */
  mktValGbp: number;
}

export interface Statement {
  /** Whole 23G text: `NEWM`, `RPLC`, `NEWM/DUPL`. Display only, never used for selection. */
  function: string | null;
  /** 98A::STAT. */
  statementDate: string;
  /** 97A::SAFE as sent (usually zero-padded to 7). */
  safekeepingAcct: string | null;
  lines: StatementLine[];
}

export type Direction = 'REC' | 'DEL';

export interface Confirmation {
  /** 544–547 from block 2. */
  mtType: number;
  /** First 20C (SEME). */
  seme: string | null;
  /** 20C::PREV (cancellations). */
  prev: string | null;
  /** 23G: `NEWM` or `CANC`. */
  function: string | null;
  tradeDate: string;
  settleDate: string;
  isin: string | null;
  /** 36B::ESTT as sent (not rounded). 0 when absent. */
  qty: number;
  /** 97A::SAFE as sent (may be padded to 7 or 8 digits). */
  safekeepingAcct: string | null;
  /** 19A::ESTT as sent, e.g. `GBP4303,01`; null when the first 19A is missing or not ESTT. */
  amountRaw: string | null;
  /** Amount from `amountRaw`, any number of decimals, rounded half-even to 2 dp (D3); null when not parseable. */
  amount: number | null;
  ccy: string | null;
  /** REC for MT544/545, DEL otherwise. */
  direction: Direction;
}

export type MessageFamily = 'MT535' | 'MT54x';

/** Metadata in an archive file name: `MT535_<safe>_<yyyyMMdd>_<seq>.txt`, `MT54n_<safe>_<yyyyMMdd>_<seq>.txt`. */
export interface ArchiveFileName {
  fileName: string;
  family: MessageFamily;
  mtType: number;
  safeCode: string;
  date: string;
  /** Trailing `_NNN`; 0 when absent or not numeric (PV `FileSeq`). */
  fileSeq: number;
}
