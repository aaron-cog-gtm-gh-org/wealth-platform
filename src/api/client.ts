import type {
  ActivityDto, AlternativesDto, HouseholdDto, PaymentsDto, PerformanceDto, PortfolioDto, RebalanceDto, SettlementExceptionsDto, WealthData,
} from './types';

export const HOUSEHOLD_ID = 'HH-WHITFIELD';
export const CLIENT_ID = 'C-00418823';
export const OPS_QUEUE = 'Wealth Ops – Toronto';

async function get<T>(path: string): Promise<T> {
  const res = await fetch('/api' + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadWealthData(): Promise<WealthData> {
  const hh = '/households/' + encodeURIComponent(HOUSEHOLD_ID);
  const client = '/portal/clients/' + encodeURIComponent(CLIENT_ID);
  const [household, portfolio, performance, rebalance, alternatives, exceptions, activity, payments] = await Promise.all([
    get<HouseholdDto>(hh),
    get<PortfolioDto>(hh + '/portfolio'),
    get<PerformanceDto>(hh + '/performance'),
    get<RebalanceDto>(hh + '/rebalance'),
    get<AlternativesDto>(hh + '/alternatives'),
    get<SettlementExceptionsDto>('/ops/queues/' + encodeURIComponent(OPS_QUEUE) + '/settlement-exceptions'),
    get<ActivityDto>(client + '/activity'),
    get<PaymentsDto>(client + '/payments'),
  ]);
  return { household, portfolio, performance, rebalance, alternatives, exceptions, activity, payments };
}
