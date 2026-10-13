import type { AccountKey, AssetClass, Currency, WealthData } from './api/types';

export type { AccountKey, AssetClass };

export const CLASS_COLORS: Record<AssetClass, string> = {
  Cash: '#8a94a3',
  Equities: '#005daa',
  Bonds: '#00a558',
  Funds: '#2fa0c8',
  Alternatives: '#7a4fb5',
};

const DRIFT_COLORS = { OK: 'rgba(25,25,25,.65)', WARN: '#b86a00', ALERT: '#d6302f' } as const;

export interface Holding {
  n: string;
  id: string;
  cls: AssetClass;
  acct: AccountKey;
  qty: number;
  px: number;
  mv: number;
  cost: number;
  day: number;
  ccy: Currency;
  qtyDec?: string;
  pxDec?: string;
}

export interface SettlementException {
  id: string;
  age: number;
  val: number;
  inst: string;
  side: 'Deliver' | 'Receive';
  acct: string;
  cpty: string;
  cause: string;
  action: string;
  actionShort: string;
  why: string;
  owner: string;
}

/** Shapes the API payload into the values the screen models work with. */
export function deriveData(raw: WealthData) {
  const { portfolio, exceptions } = raw;
  const FX = portfolio.fxRates.find(r => r.base === 'USD' && r.quote === 'CAD')?.rate ?? 1;
  const ASSET_CLASSES = portfolio.assetClasses.map(c => c.name);
  const PRICE_SOURCE = Object.fromEntries(portfolio.assetClasses.map(c => [c.name, c.priceSource])) as Record<AssetClass, string>;

  const holdings: Holding[] = portfolio.holdings.map(h => ({
    n: h.name, id: h.identifier, cls: h.assetClass, acct: h.accountKey, qty: h.quantity, px: h.price,
    mv: h.marketValue, cost: h.costBasis, day: h.dayChangePct, ccy: h.currency, qtyDec: h.quantityDec, pxDec: h.priceDec,
  }));
  const totalValue = holdings.reduce((s, h) => s + h.mv, 0);
  const cashIn = (key: AccountKey) => holdings.filter(h => h.acct === key && h.cls === 'Cash').reduce((s, h) => s + h.mv, 0);

  const accounts = portfolio.accounts.map(a => {
    const own = holdings.filter(h => h.acct === a.key);
    const n = own.length;
    return {
      key: a.key,
      name: a.name,
      shortName: a.shortName,
      no: a.accountNo,
      meta: `${a.accountNo} · ${a.ownership} · ${a.management} · ${a.currencies}`,
      drift: (a.driftPts >= 0 ? '+' : '−') + Math.abs(a.driftPts).toFixed(1) + ' pts',
      driftColor: DRIFT_COLORS[a.driftStatus],
      mv: own.reduce((s, h) => s + h.mv, 0),
      short: `${a.accountNo} · ${n} holdings`,
      src: `Sum of ${n} positions in ${a.accountNo} · see Portfolio detail`,
      day: '+' + a.dayChangePct.toFixed(2) + '% today',
      dayColor: '#00804a',
    };
  });
  const accountByKey = (key: AccountKey) => accounts.find(a => a.key === key)!;

  const allocation = portfolio.assetClasses.map(c => {
    const mv = holdings.filter(h => h.cls === c.name).reduce((s, h) => s + h.mv, 0);
    return { cls: c.name, mv, a: totalValue ? (mv / totalValue) * 100 : 0, t: c.targetWeightPct, color: CLASS_COLORS[c.name] };
  });

  const causes = new Map(exceptions.causes.map(c => [c.name, c]));
  const settlementExceptions = {
    rows: exceptions.exceptions.map((e): SettlementException => {
      const c = causes.get(e.cause)!;
      return {
        id: e.id, age: e.ageDays, val: e.value, inst: e.instrument, side: e.side, acct: e.accountNo, cpty: e.counterparty,
        cause: e.cause, action: c.suggestedAction, actionShort: c.actionShort, why: c.explanation, owner: e.owner ?? 'Unassigned',
      };
    }),
    causes: exceptions.causes.map(c => c.name),
    queue: exceptions.queue,
  };

  return { raw, FX, ASSET_CLASSES, PRICE_SOURCE, holdings, totalValue, cashIn, accounts, accountByKey, allocation, settlementExceptions };
}

export type Data = ReturnType<typeof deriveData>;
