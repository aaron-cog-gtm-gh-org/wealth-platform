// Wire format of the Wealth Platform API (server/). Dates are ISO `YYYY-MM-DD` strings.

export type AssetClass = 'Cash' | 'Equities' | 'Bonds' | 'Funds' | 'Alternatives';
/** Platform account keys; custody accounts map to `C<accountId>` (e.g. `C2001`). */
export type AccountKey = 'NR' | 'RR' | 'CO' | `C${number}`;
export type Currency = 'CAD' | 'USD' | 'GBP' | 'EUR';

export interface ClientDto {
  id: string; legalName: string; displayName: string; dateOfBirth: string; taxResidency: string; occupation: string;
  riskProfile: string; riskScore: number; timeHorizon: string; kycStatus: string; kycReviewedDate: string;
  kycNextRefreshDate: string; suitabilitySignedDate: string; preferredContact: string; powerOfAttorney: string;
  fundingAccountKey: AccountKey;
}

export interface HouseholdDto {
  id: string; name: string; mandate: string; nextReviewDate: string; advisorName: string; totalFeeRatePct: number;
  income90d: number; coupons90d: number; dividends90d: number; taxLots: number; altNetIrrPct: number;
  primaryClient: ClientDto;
  members: { name: string; relationship: string; accounts: string }[];
  tasks: { title: string; nextStep: string; due: string; priority: 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW' }[];
  communications: { channel: string; date: string; summary: string }[];
  documents: { title: string; date: string }[];
  fees: { label: string; rate: string; amount: number }[];
  /** Set when served for a custody client (GBP, legacy source). */
  source?: CustodySourceDto;
}

export interface AccountDto {
  key: AccountKey; accountNo: string; name: string; shortName: string; ownership: string; management: string;
  currencies: string; driftPts: number; driftStatus: 'OK' | 'WARN' | 'ALERT'; dayChangePct: number;
}

export interface HoldingDto {
  accountKey: AccountKey; assetClass: AssetClass; name: string; identifier: string; quantity: number; price: number;
  marketValue: number; costBasis: number; dayChangePct: number; currency: Currency;
  quantityDec?: string; priceDec?: string;
}

export interface PortfolioDto {
  accounts: AccountDto[];
  assetClasses: { name: AssetClass; targetWeightPct: number; priceSource: string }[];
  holdings: HoldingDto[];
  fxRates: { base: Currency; quote: Currency; rate: number; source: string }[];
  /** Set when served for a custody client (GBP, legacy source). */
  source?: CustodySourceDto;
}

export interface PerformanceDto {
  periods: { code: string; startDate: string; portfolioReturnPct: number; benchmarkReturnPct: number; portfolio: number[]; benchmark: number[] }[];
}

export interface RebalanceDto {
  proposal: { id: string; status: string; trackingErrorBeforePct: number; trackingErrorAfterPct: number };
  trades: { side: 'BUY' | 'SELL'; instrument: string; accountKey: AccountKey; quantity: string; value: number; estCost: number; realizedGain: number; route: string; note: string }[];
  checks: { code: string; name: string; status: 'PASS' | 'WARN' | 'FAIL' | 'LIVE'; detail: string | null }[];
  drift: { assetClass: AssetClass; beforePts: number; afterPts: number }[];
}

export interface AlternativesDto {
  commitments: {
    fundName: string; accountKey: AccountKey; currency: Currency; vintage: number; commitment: number; called: number;
    distributions: number; nav: number; navDate: string; navStatus: string; administrator: string; enteredBy: string;
    approvedBy: string; approvedDate: string;
  }[];
  capitalCalls: { due: string; description: string; amount: number; status: string }[];
  distributions: { date: string; fund: string; type: string; amount: number }[];
}

export interface SettlementExceptionDto {
  id: string; ageDays: number; value: number; instrument: string; side: 'Deliver' | 'Receive'; accountNo: string;
  counterparty: string; cause: string; owner: string | null;
}

export interface SettlementExceptionsDto {
  queue: { name: string; openedToday: number; clearedToday: number; medianResolveMinutes: number; autoAssignTime: string; buyInDay: number };
  causes: { name: string; suggestedAction: string; actionShort: string; explanation: string }[];
  exceptions: SettlementExceptionDto[];
}

export interface ActivityDto {
  feed: { date: string; description: string; account: string; amount: number }[];
  pending: { title: string; amount: number | null; status: string; eta: string; currentStep: number; steps: { name: string; time: string | null }[] }[];
  transactions: { tradeDate: string; settleDate: string; description: string; detail: string; accountKey: AccountKey; amount: number; status: string; nextStep: string | null }[];
}

export interface PaymentsDto {
  payees: { name: string; description: string; history: string; isNew: boolean }[];
  rails: { name: 'Wire' | 'EFT' | 'Interac e-Transfer'; dailyLimit: number; fee: number; speed: string; arrival: string }[];
}

export interface WealthData {
  household: HouseholdDto;
  portfolio: PortfolioDto;
  performance: PerformanceDto;
  rebalance: RebalanceDto;
  alternatives: AlternativesDto;
  exceptions: SettlementExceptionsDto;
  activity: ActivityDto;
  payments: PaymentsDto;
}

// --- Custody (legacy Portfolio Viewer) — specs/001-legacy-portfolio-viewer/contracts/api.md ---
// Decimals are fixed-point strings (`Dec`); dates are `YYYY-MM-DD`.

/** Fixed-point decimal string, e.g. `"21637.50"`. */
export type Dec = string;
export type CustodyRole = 'ADVISER' | 'OPS' | 'ADMIN';
export type CustodyAccountType = 'ISA' | 'SIPP' | 'GIA';
export type QtyType = 'UNIT' | 'FAMT';
export type BreakStatus = 'NEW' | 'OPEN' | 'CHASED' | 'RESOLVED' | 'WRITEOFF';
export type BreakCause = 'CORP_ACTION' | 'MISSING_CONFIRM' | 'OTHER';
export type PositionCheckMode = 'corrected' | 'legacy';

export interface ClientPickerItem { kind: 'household' | 'custody'; id: string; name: string; clientRef: string | null; reportingCurrency: Currency }
export interface ClientPickerPage { items: ClientPickerItem[]; page: number; total: number }

export interface CustodyClientRow { clientId: number; clientRef: string; name: string;
  adviser: string | null; status: string; accountCount: number }
export interface CustodyClientPage { rows: CustodyClientRow[]; page: number; total: number }
export interface CustodyAccountSummary { accountId: number; safeNo: number; accountType: CustodyAccountType;
  reportingCcy: Currency; closed: boolean; latestStatementDate: string | null; latestValue: Dec | null }
export interface CustodyClientSummary extends CustodyClientRow { accounts: CustodyAccountSummary[]; total: Dec }

export interface CustodyStatementDate { date: string; isEmpty: boolean; superseded: number }
export interface CustodyStatementLine { isin: string; name: string; nameVerified: boolean;
  qty: Dec; qtyType: QtyType; price: Dec; ccy: Currency; marketValue: Dec;
  reportingValue: Dec | null; messageId: number }
export interface CustodyStatement { accountId: number; date: string; functionCode: string;
  isEmpty: boolean; lines: CustodyStatementLine[]; total: Dec; missingReportingValues: number;
  messageId: number }

export interface CustodyConfirmation { confirmationId: number; mtType: 544 | 545 | 546 | 547;
  direction: 'Receive' | 'Deliver'; freeOfPayment: boolean; tradeDate: string; settleDate: string;
  isin: string; name: string; qty: Dec; qtyType: QtyType; amount: Dec | null;
  amountCcy: Currency | null; reference: string; messageId: number }

export interface PositionBreak { accountId: number; safeNo: number; isin: string; name: string;
  date: string;
  qtyType: QtyType; previousQty: Dec; settledNet: Dec; expectedQty: Dec; reportedQty: Dec;
  difference: Dec; status: BreakStatus; cause: BreakCause | null; note: string | null;
  updatedBy: string | null; updatedAt: string | null; sourceMessageIds: number[] }
export interface PositionCheckResult { date: string; mode: PositionCheckMode;
  accountsChecked: number; breaks: PositionBreak[] }
export interface BreakNotePatch { author: string; status?: Exclude<BreakStatus, 'NEW'>; cause?: BreakCause | null; note?: string | null }
export interface BreakNote { status: BreakStatus; cause: BreakCause | null; note: string | null;
  updatedBy: string; updatedAt: string }
export interface BreakNoteRow extends BreakNote { accountId: number; isin: string; date: string; name: string }
export interface BreakNoteHistory extends BreakNote { source: 'LEGACY_MIGRATION' | 'USER' }

export interface CustodyMessageRow { messageId: number; mtType: number; functionCode: string;
  safeNo: number | null; businessDate: string; sourceFile: string; parseStatus: 'OK' | 'ERROR';
  /** Length of the stored CLOB; archive files are ASCII, so chars = bytes. */
  sizeBytes: number }
export interface CustodyMessagePage { rows: CustodyMessageRow[]; page: number; total: number }

/** Statement or confirmation row derived from a message, for the detail panel's cross-links. */
export interface CustodyMessageDerived {
  kind: 'statement' | 'confirmation'; accountId: number | null; clientId: number | null;
  date: string; functionCode: string;
  effective?: boolean; lineCount?: number;                                   // statement
  confirmationId?: number; reference?: string; isin?: string;                // confirmation
  cancelsMessageId?: number | null; cancelledByMessageId?: number | null;
}
export interface CustodyMessage extends CustodyMessageRow { rawText: string; parseError: string | null;
  contentSha256: string; derived: CustodyMessageDerived | null }

export interface IngestRun { runId: number; startedAt: string; finishedAt: string | null;
  filesSeen: number; filesNew: number; filesDuplicate: number; parseErrors: number;
  triggeredBy: string; durationMs: number | null }
export interface IngestionStatus { lastRun: IngestRun | null; messagesByType: Record<string, number>;
  statements: number; effectiveStatements: number; confirmations: number; unmatchedCancellations: number;
  errors: { sourceFile: string; error: string }[]; archiveRoot: string; runInProgress: boolean }

/**
 * Provenance of a `HouseholdDto`/`PortfolioDto` served for a custody client
 * (`server/custody/platform-view.ts`). Absent for platform households.
 */
export interface CustodySourceDto {
  kind: 'custody';
  clientId: number;
  reportingCurrency: Currency;
  /** Effective statement date the portfolio was built from (latest across accounts). */
  asOf: string | null;
  /** Panels with no legacy source (tasks, fees, performance, ...) that screens must show as unavailable. */
  unavailable: string[];
  /** Holdings lines whose GBP reporting value is missing (FR-010). */
  missingReportingValues: number;
}
