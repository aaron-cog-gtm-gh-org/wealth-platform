// Adapter: a custody client rendered through the existing Client 360 / Portfolio Detail DTOs
// (research R-11). Pure mapping — never writes custody data into household/client tables.
// Values stay in the custody reporting currency (GBP, FR-024); panels with no legacy source are
// listed in `source.unavailable` so screens show "not available" instead of zeros.
import type {
  AccountDto, AssetClass, CustodyAccountSummary, CustodyClientSummary, CustodyStatement, Currency, HoldingDto, HouseholdDto, PortfolioDto,
} from '../../src/api/types';
import { decToNumber } from './decimal.js';

/** Client 360 panels with no legacy source. */
export const HOUSEHOLD_UNAVAILABLE = [
  'mandate', 'nextReview', 'fees', 'income', 'taxLots', 'alternatives', 'tasks', 'communications', 'documents', 'kyc', 'members',
] as const;
/** Portfolio Detail panels/fields with no legacy source. */
export const PORTFOLIO_UNAVAILABLE = ['drift', 'targets', 'costBasis', 'dayChange', 'fxRates', 'performance', 'rebalance'] as const;

const ASSET_CLASSES: AssetClass[] = ['Cash', 'Equities', 'Bonds', 'Funds', 'Alternatives'];

/** Legacy custody has no asset-class model: FAMT lines are bonds, LU/IE funds, otherwise equities. */
export function assetClassFor(isin: string, qtyType: string): AssetClass {
  if (qtyType === 'FAMT') return 'Bonds';
  if (/^(LU|IE)/.test(isin)) return 'Funds';
  return 'Equities';
}

export const custodyAccountKey = (accountId: number) => `C${accountId}` as const;

const accountLabel = (a: CustodyAccountSummary) => `${a.accountType} ${a.safeNo}`;

export function toCustodyHousehold(client: CustodyClientSummary): HouseholdDto {
  const asOf = client.accounts.map(a => a.latestStatementDate).filter((d): d is string => !!d).sort().at(-1) ?? null;
  const ccy: Currency = client.accounts[0]?.reportingCcy ?? 'GBP';
  return {
    id: String(client.clientId), name: client.name, mandate: '', nextReviewDate: '', advisorName: client.adviser ?? '',
    totalFeeRatePct: 0, income90d: 0, coupons90d: 0, dividends90d: 0, taxLots: 0, altNetIrrPct: 0,
    primaryClient: {
      id: client.clientRef, legalName: client.name, displayName: client.name, dateOfBirth: '', taxResidency: '', occupation: '',
      riskProfile: '', riskScore: 0, timeHorizon: '', kycStatus: '', kycReviewedDate: '', kycNextRefreshDate: '',
      suitabilitySignedDate: '', preferredContact: '', powerOfAttorney: '',
      fundingAccountKey: client.accounts[0] ? custodyAccountKey(client.accounts[0].accountId) : 'C0',
    },
    members: [{ name: client.name, relationship: 'Account holder', accounts: client.accounts.map(accountLabel).join(', ') }],
    tasks: [], communications: [], documents: [], fees: [],
    source: { kind: 'custody', clientId: client.clientId, reportingCurrency: ccy, asOf, unavailable: [...HOUSEHOLD_UNAVAILABLE], missingReportingValues: 0 },
  };
}

/**
 * Holdings = lines of each account's latest effective statement. `marketValue` is the GBP
 * reporting value (19A::HOLD); lines without one carry 0 and are counted in `missingReportingValues`.
 */
export function toCustodyPortfolio(client: CustodyClientSummary, statements: CustodyStatement[]): PortfolioDto {
  const accounts: AccountDto[] = client.accounts.map(a => ({
    key: custodyAccountKey(a.accountId), accountNo: String(a.safeNo), name: accountLabel(a), shortName: a.accountType,
    ownership: client.name, management: a.closed ? 'Custody · closed' : 'Custody', currencies: a.reportingCcy, driftPts: 0, driftStatus: 'OK', dayChangePct: 0,
  }));
  const holdings: HoldingDto[] = statements.flatMap(s => s.lines.map(l => ({
    accountKey: custodyAccountKey(s.accountId), assetClass: assetClassFor(l.isin, l.qtyType), name: l.name, identifier: l.isin,
    quantity: decToNumber(l.qty), price: decToNumber(l.price), marketValue: l.reportingValue === null ? 0 : decToNumber(l.reportingValue),
    costBasis: 0, dayChangePct: 0, currency: l.ccy,
  })));
  const asOf = statements.map(s => s.date).sort().at(-1) ?? null;
  return {
    accounts,
    assetClasses: ASSET_CLASSES.map(name => ({ name, targetWeightPct: 0, priceSource: 'Custodian MT535' })),
    holdings,
    fxRates: [],
    source: {
      kind: 'custody', clientId: client.clientId, reportingCurrency: client.accounts[0]?.reportingCcy ?? 'GBP', asOf,
      unavailable: [...PORTFOLIO_UNAVAILABLE], missingReportingValues: statements.reduce((n, s) => n + s.missingReportingValues, 0),
    },
  };
}
