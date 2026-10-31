import { query } from '../db/pool';
import type { AlternativesDto, ClientDto, HouseholdDto, PerformanceDto, PortfolioDto, RebalanceDto } from '../../src/api/types';

export const isoDate = (col: string, alias: string) => `TO_CHAR(${col}, 'YYYY-MM-DD') AS "${alias}"`;

type HouseholdRow = Omit<HouseholdDto, 'primaryClient' | 'members' | 'tasks' | 'communications' | 'documents' | 'fees'>;

export async function getHousehold(id: string): Promise<HouseholdDto | null> {
  const [h] = await query<HouseholdRow>(
    `SELECT household_id AS "id", household_name AS "name", mandate AS "mandate", ${isoDate('next_review_date', 'nextReviewDate')},
            advisor_name AS "advisorName", total_fee_rate_pct AS "totalFeeRatePct", income_90d AS "income90d",
            coupons_90d AS "coupons90d", dividends_90d AS "dividends90d", tax_lots AS "taxLots", alt_net_irr_pct AS "altNetIrrPct"
       FROM households WHERE household_id = $1`, [id]);
  if (!h) return null;
  const [clients, members, tasks, communications, documents, fees] = await Promise.all([
    query<ClientDto>(
      `SELECT client_id AS "id", legal_name AS "legalName", display_name AS "displayName", ${isoDate('date_of_birth', 'dateOfBirth')},
              tax_residency AS "taxResidency", occupation AS "occupation", risk_profile AS "riskProfile", risk_score AS "riskScore",
              time_horizon AS "timeHorizon", kyc_status AS "kycStatus", ${isoDate('kyc_reviewed_date', 'kycReviewedDate')},
              ${isoDate('kyc_next_refresh_date', 'kycNextRefreshDate')}, ${isoDate('suitability_signed_date', 'suitabilitySignedDate')},
              preferred_contact AS "preferredContact", power_of_attorney AS "powerOfAttorney", funding_account_key AS "fundingAccountKey"
         FROM clients WHERE household_id = $1 AND is_primary = 1`, [id]),
    query<HouseholdDto['members'][number]>(
      `SELECT member_name AS "name", relationship AS "relationship", accounts_desc AS "accounts"
         FROM household_members WHERE household_id = $1 ORDER BY display_order`, [id]),
    query<HouseholdDto['tasks'][number]>(
      `SELECT title AS "title", next_step AS "nextStep", due_label AS "due", priority AS "priority"
         FROM advisor_tasks WHERE household_id = $1 ORDER BY display_order`, [id]),
    query<HouseholdDto['communications'][number]>(
      `SELECT channel AS "channel", ${isoDate('comm_date', 'date')}, summary AS "summary"
         FROM client_communications WHERE household_id = $1 ORDER BY display_order`, [id]),
    query<HouseholdDto['documents'][number]>(
      `SELECT title AS "title", ${isoDate('doc_date', 'date')} FROM client_documents WHERE household_id = $1 ORDER BY display_order`, [id]),
    query<HouseholdDto['fees'][number]>(
      `SELECT fee_label AS "label", rate_label AS "rate", amount AS "amount" FROM fee_summary WHERE household_id = $1 ORDER BY display_order`, [id]),
  ]);
  return { ...h, primaryClient: clients[0], members, tasks, communications, documents, fees };
}

export async function getPortfolio(id: string): Promise<PortfolioDto> {
  const [accounts, assetClasses, holdings, fxRates] = await Promise.all([
    query<PortfolioDto['accounts'][number]>(
      `SELECT account_key AS "key", account_no AS "accountNo", account_name AS "name", short_name AS "shortName", ownership AS "ownership",
              management AS "management", currencies AS "currencies", drift_pts AS "driftPts", drift_status AS "driftStatus",
              day_change_pct AS "dayChangePct"
         FROM accounts WHERE household_id = $1 ORDER BY account_no`, [id]),
    query<PortfolioDto['assetClasses'][number]>(
      `SELECT class_name AS "name", target_weight_pct AS "targetWeightPct", price_source AS "priceSource" FROM asset_classes ORDER BY display_order`),
    query<PortfolioDto['holdings'][number]>(
      `SELECT h.account_key AS "accountKey", h.class_name AS "assetClass", h.instrument_name AS "name", h.identifier AS "identifier",
              h.quantity AS "quantity", h.price AS "price", h.market_value AS "marketValue", h.cost_basis AS "costBasis",
              h.day_change_pct AS "dayChangePct", h.currency AS "currency"
         FROM holdings h JOIN accounts a ON a.account_key = h.account_key
        WHERE a.household_id = $1 ORDER BY h.display_order`, [id]),
    query<PortfolioDto['fxRates'][number]>(`SELECT base_ccy AS "base", quote_ccy AS "quote", rate AS "rate", rate_source AS "source" FROM fx_rates`),
  ]);
  return { accounts, assetClasses, holdings, fxRates };
}

export async function getPerformance(id: string): Promise<PerformanceDto> {
  const [periods, points] = await Promise.all([
    query<Omit<PerformanceDto['periods'][number], 'portfolio' | 'benchmark'>>(
      `SELECT period_code AS "code", ${isoDate('start_date', 'startDate')}, portfolio_return_pct AS "portfolioReturnPct",
              benchmark_return_pct AS "benchmarkReturnPct"
         FROM performance_periods WHERE household_id = $1 ORDER BY display_order`, [id]),
    query<{ code: string; p: number; b: number }>(
      `SELECT period_code AS "code", portfolio_pct AS "p", benchmark_pct AS "b"
         FROM performance_points WHERE household_id = $1 ORDER BY period_code, point_index`, [id]),
  ]);
  return {
    periods: periods.map(p => {
      const own = points.filter(x => x.code === p.code);
      return { ...p, portfolio: own.map(x => x.p), benchmark: own.map(x => x.b) };
    }),
  };
}

export async function getRebalance(id: string): Promise<RebalanceDto | null> {
  const [proposal] = await query<RebalanceDto['proposal']>(
    `SELECT proposal_id AS "id", status AS "status", tracking_error_before_pct AS "trackingErrorBeforePct",
            tracking_error_after_pct AS "trackingErrorAfterPct"
       FROM rebalance_proposals WHERE household_id = $1 AND status = 'Draft' ORDER BY proposal_id DESC FETCH FIRST 1 ROWS ONLY`, [id]);
  if (!proposal) return null;
  const pid = proposal.id;
  const [trades, checks, drift] = await Promise.all([
    query<RebalanceDto['trades'][number]>(
      `SELECT side AS "side", instrument_name AS "instrument", account_key AS "accountKey", quantity_label AS "quantity",
              trade_value AS "value", est_cost AS "estCost", realized_gain AS "realizedGain", route AS "route", note AS "note"
         FROM proposal_trades WHERE proposal_id = $1 ORDER BY line_no`, [pid]),
    query<RebalanceDto['checks'][number]>(
      `SELECT check_code AS "code", check_name AS "name", status AS "status", detail AS "detail"
         FROM pretrade_checks WHERE proposal_id = $1 ORDER BY display_order`, [pid]),
    query<RebalanceDto['drift'][number]>(
      `SELECT d.class_name AS "assetClass", d.drift_before_pts AS "beforePts", d.drift_after_pts AS "afterPts"
         FROM proposal_drift d JOIN asset_classes c ON c.class_name = d.class_name
        WHERE d.proposal_id = $1 ORDER BY c.display_order`, [pid]),
  ]);
  return { proposal, trades, checks, drift };
}

export async function getAlternatives(id: string): Promise<AlternativesDto> {
  const [commitments, capitalCalls, distributions] = await Promise.all([
    query<AlternativesDto['commitments'][number]>(
      `SELECT fund_name AS "fundName", account_key AS "accountKey", currency AS "currency", vintage AS "vintage",
              commitment_amt AS "commitment", called_amt AS "called", distributions_amt AS "distributions", nav_amt AS "nav",
              ${isoDate('nav_date', 'navDate')}, nav_status AS "navStatus", administrator AS "administrator",
              entered_by AS "enteredBy", approved_by AS "approvedBy", ${isoDate('approved_date', 'approvedDate')}
         FROM alt_commitments WHERE household_id = $1 ORDER BY display_order`, [id]),
    query<AlternativesDto['capitalCalls'][number]>(
      `SELECT due_label AS "due", description AS "description", amount AS "amount", status AS "status"
         FROM capital_calls WHERE household_id = $1 ORDER BY display_order`, [id]),
    query<AlternativesDto['distributions'][number]>(
      `SELECT ${isoDate('paid_date', 'date')}, fund_short_name AS "fund", distribution_type AS "type", amount AS "amount"
         FROM alt_distributions WHERE household_id = $1 ORDER BY display_order`, [id]),
  ]);
  return { commitments, capitalCalls, distributions };
}
