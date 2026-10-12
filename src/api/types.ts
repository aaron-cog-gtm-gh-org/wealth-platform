// Wire format of the Wealth Platform API (server/). Dates are ISO `YYYY-MM-DD` strings.

export type AssetClass = 'Cash' | 'Equities' | 'Bonds' | 'Funds' | 'Alternatives';
export type AccountKey = 'NR' | 'RR' | 'CO';
export type Currency = 'CAD' | 'USD';

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
}

export interface AccountDto {
  key: AccountKey; accountNo: string; name: string; shortName: string; ownership: string; management: string;
  currencies: string; driftPts: number; driftStatus: 'OK' | 'WARN' | 'ALERT'; dayChangePct: number;
}

export interface HoldingDto {
  accountKey: AccountKey; assetClass: AssetClass; name: string; identifier: string; quantity: number; price: number;
  marketValue: number; costBasis: number; dayChangePct: number; currency: Currency;
}

export interface PortfolioDto {
  accounts: AccountDto[];
  assetClasses: { name: AssetClass; targetWeightPct: number; priceSource: string }[];
  holdings: HoldingDto[];
  fxRates: { base: Currency; quote: Currency; rate: number; source: string }[];
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
