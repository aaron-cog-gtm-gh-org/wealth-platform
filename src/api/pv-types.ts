// Wire types for /api/pv/* (spec 004). Decimals are strings in legacy scale; dates are yyyy-mm-dd.
export type IsoDate = string;
export type DecimalString = string;
export type PvRole = 'ADVISER' | 'OPS' | 'ADMIN';

export interface PvUser { userId: number; username: string; fullName: string | null; role: string }
export interface PvLoginResponse { token: string; user: PvUser }
export interface PvSession { userId: number; username: string; role: string; exp: number }

export interface PvAccount {
  acctId: number; acctNo: string; clientId: number; clientName: string; acctType: string | null; baseCcy: string;
  safeCode: string | null; openDt: IsoDate | null; closeDt: IsoDate | null; statusCd: string;
}
export interface PvClientSearchRow {
  clientId: number; clientRef: string; clientName: string; statusCd: string;
  adviserUsername: string | null; adviserName: string | null; acctCount: number;
}
export interface PvClient extends Omit<PvClientSearchRow, 'acctCount'> { createdDt: IsoDate | null; accounts: PvAccount[] }

export interface PvHoldingLine {
  isin: string | null; instrumentName: string; msgDescription: string | null; qty: DecimalString; qtyType: string | null;
  price: DecimalString; ccy: string | null; mktVal: DecimalString; mktValGbp: DecimalString;
  fileName: string | null; fileSeq: number; function: string | null;
}
export interface PvHoldings {
  acctId: number; stmtDate: IsoDate | null;
  statement: { function: string | null; statementDate: IsoDate; safekeepingAcct: string | null; fileName: string | null; fileSeq: number; lineCount: number } | null;
  lines: PvHoldingLine[];
}

export interface PvSettlement {
  mtType: number; seme: string | null; prev: string | null; function: string | null; tradeDate: IsoDate; settleDate: IsoDate;
  isin: string | null; instrumentName: string; qty: DecimalString; custAcct: string | null; amountRaw: string | null;
  amount: DecimalString; amountError: string | null; ccy: string | null; direction: 'REC' | 'DEL';
  filePath: string | null; fileName: string | null; folder: string | null;
}
export interface PvSettlements { acctId: number; custAcct: string; from: IsoDate; to: IsoDate; items: PvSettlement[] }

export interface PvPositionCheckRow {
  isin: string; instrument: string; prevQty: DecimalString; netSettled: DecimalString; expected: DecimalString;
  stmtQty: DecimalString; diff: DecimalString; status: string; note: string | null; updatedBy: string | null; updatedDt: string | null;
}
export interface PvPositionCheck {
  acctId: number; stmtDate: IsoDate; prevStmtDate: IsoDate | null; noPrevMessage: string | null; statementFile: string | null; rows: PvPositionCheckRow[];
}
export interface PvCheckAll { stmtDate: IsoDate; rows: { acctId: number; acctNo: string; client: string; diffs: string }[] }
export interface PvSaveNote { isin: string; stmtDate: IsoDate; status: string; note?: string | null }
export interface PvReconNote { acctId: number; isin: string; stmtDate: IsoDate; status: string; note: string | null; updatedBy: string | null; updatedDt: string | null }

export interface PvArchiveFile { path: string; fileName: string; msgType: 'MT535' | 'MT54x'; date: IsoDate; safeCode: string | null; size: number }
export interface PvArchiveFiles { count: number; files: PvArchiveFile[] }
export interface PvAdminStats {
  archive: {
    mt535Count: number; mt54xCount: number; statements: number; confirms: number; parseErrors: number;
    parseErrorLog: { path: string; message: string }[]; loadedAt: string | null; loadMs: number; statementAccounts: number; confirmFolders: number;
  };
  users: { userId: number; username: string; fullName: string | null; role: string; activeFlg: string; lastLoginDt: string | null }[];
}
