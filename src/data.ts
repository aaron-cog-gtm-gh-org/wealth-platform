export const FX = 1.3683;

export type AssetClass = 'Cash' | 'Equities' | 'Bonds' | 'Funds' | 'Alternatives';
export type AccountKey = 'NR' | 'RR' | 'CO';

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
  ccy: 'CAD' | 'USD';
}

type HoldingRow = [string, string, AssetClass, AccountKey, number, number, number, number, number, 'CAD' | 'USD'];

const HOLDING_ROWS: HoldingRow[] = [
  ['CAD cash', 'Ledger balance', 'Cash', 'NR', 184220, 1, 184220, 184220, 0, 'CAD'],
  ['USD cash', 'USD sub-account', 'Cash', 'CO', 96397, FX, 131900, 131900, 0, 'USD'],
  ['CAD cash', 'Ledger balance', 'Cash', 'RR', 42150, 1, 42150, 42150, 0, 'CAD'],
  ['Royal Bank of Canada', 'RY · TSX', 'Equities', 'NR', 2400, 192.40, 461760, 298400, 0.84, 'CAD'],
  ['Enbridge Inc.', 'ENB · TSX', 'Equities', 'NR', 5200, 61.85, 321620, 268000, -0.41, 'CAD'],
  ['Canadian National Railway', 'CNR · TSX', 'Equities', 'RR', 1800, 158.20, 284760, 301500, 0.22, 'CAD'],
  ['Shopify Inc. Cl A', 'SHOP · TSX', 'Equities', 'CO', 1500, 152.30, 228450, 141000, 2.13, 'CAD'],
  ['Brookfield Corp.', 'BN · TSX', 'Equities', 'NR', 3600, 84.10, 302760, 211000, 0.65, 'CAD'],
  ['Microsoft Corp.', 'MSFT · NASDAQ · USD', 'Equities', 'CO', 520, 512.40, 364580, 248000, -0.18, 'USD'],
  ['Alimentation Couche-Tard', 'ATD · TSX', 'Equities', 'RR', 3100, 79.45, 246295, 230100, -0.32, 'CAD'],
  ['Johnson & Johnson', 'JNJ · NYSE · USD', 'Equities', 'CO', 900, 178.20, 219450, 196000, 0.11, 'USD'],
  ['Govt of Canada 3.25% 01-Dec-2034', 'CA135087R895 · AA+ · accrued $2,180', 'Bonds', 'RR', 600000, 98.42, 590520, 584000, 0.06, 'CAD'],
  ['Province of Ontario 3.65% 02-Jun-2033', 'CA68333ZAV98 · AA- · accrued $5,120', 'Bonds', 'NR', 400000, 99.15, 396600, 401200, 0.04, 'CAD'],
  ['Province of Quebec 4.40% 01-Dec-2055', 'CA74814ZFK24 · AA- · accrued $1,240', 'Bonds', 'RR', 250000, 96.80, 242000, 255000, -0.12, 'CAD'],
  ['Bell Canada 5.15% 14-Nov-2031', 'CA07813ZCN18 · BBB · accrued $6,980', 'Bonds', 'CO', 300000, 103.10, 309300, 300900, 0.02, 'CAD'],
  ['RBC Deposit Note 4.63% 01-May-2028', 'CA780086XC51 · AA · accrued $1,560', 'Bonds', 'NR', 250000, 101.45, 253625, 250000, 0.01, 'CAD'],
  ['US Treasury 4.25% 15-Nov-2030', 'US91282CJL64 · AA+ · USD', 'Bonds', 'CO', 200000, 100.62, 275360, 271000, 0.03, 'USD'],
  ['RBC Canadian Dividend Fund Sr F', 'RBF6270 · Fundserv', 'Funds', 'NR', 8420.112, 98.14, 826350, 640000, 0.38, 'CAD'],
  ['PH&N Bond Fund Sr F', 'RBF1330 · Fundserv', 'Funds', 'RR', 41230.5, 10.12, 417252, 430000, 0.05, 'CAD'],
  ['RBC Global Equity Focus Fund Sr F', 'RBF6670 · Fundserv', 'Funds', 'RR', 12880.4, 31.66, 407794, 322000, 0.47, 'CAD'],
  ['BlueBay Global Inv. Grade Corp Bond Sr F', 'RBF1910 · Fundserv', 'Funds', 'CO', 28450, 10.84, 308398, 300000, 0.03, 'CAD'],
  ['RBC Short Term Canadian Bond ETF', 'RBO · TSX', 'Funds', 'NR', 12000, 19.62, 235440, 236000, 0.02, 'CAD'],
  ['RBC U.S. Dividend Fund Sr F', 'RBF6280 · Fundserv', 'Funds', 'CO', 6210, 52.18, 324038, 270000, 0.21, 'CAD'],
  ['Northgate Infrastructure Partners IV', 'Commitment $1,000,000 · 62% called', 'Alternatives', 'CO', 620000, 1.149, 712400, 620000, 0, 'CAD'],
  ['Lakeshore Private Credit Fund II', 'Commitment $750,000 · 64% called', 'Alternatives', 'NR', 480000, 0.977, 468900, 480000, 0, 'CAD'],
];

export const PRICE_SOURCE: Record<AssetClass, string> = {
  Cash: 'Ledger balance · sum of 214 ledger entries since account open',
  Equities: 'Last trade 14:45 ET (15-min delayed) · custodian: RBC Investor Services',
  Bonds: 'Evaluated price 14:30 ET · ICE · clean price + accrued per Act/365',
  Funds: 'NAV 09-Oct-2026 from Fundserv · forward-priced',
  Alternatives: 'Manager NAV 30-Jun-2026 + calls/distributions since · approved by R. Osei 14-Aug-2026',
};

export const CLASS_COLORS: Record<AssetClass, string> = {
  Cash: '#8a94a3',
  Equities: '#005daa',
  Bonds: '#00a558',
  Funds: '#2fa0c8',
  Alternatives: '#7a4fb5',
};

const ACCOUNT_INFO: Record<AccountKey, { name: string; no: string; meta: string; drift: string; driftColor: string; day: number }> = {
  NR: { name: 'Non-registered investment', no: '4417-8821', meta: '4417-8821 · Joint (Eleanor & David) · Discretionary · CAD', drift: '+1.8 pts', driftColor: '#b86a00', day: 0.31 },
  RR: { name: 'RRSP', no: '4417-9034', meta: '4417-9034 · Eleanor · Advisory · CAD', drift: '−2.6 pts', driftColor: '#d6302f', day: 0.12 },
  CO: { name: 'Whitfield Holdings Ltd.', no: '4418-1157', meta: '4418-1157 · Corporate · Advisory · CAD + USD', drift: '+1.1 pts', driftColor: 'rgba(25,25,25,.65)', day: 0.42 },
};

const TARGET_WEIGHTS: Record<AssetClass, number> = { Cash: 3, Equities: 30, Bonds: 26, Funds: 28, Alternatives: 13 };

export const ASSET_CLASSES = Object.keys(TARGET_WEIGHTS) as AssetClass[];

export const holdings: Holding[] = HOLDING_ROWS.map(h => ({ n: h[0], id: h[1], cls: h[2], acct: h[3], qty: h[4], px: h[5], mv: h[6], cost: h[7], day: h[8], ccy: h[9] }));

export const totalValue = holdings.reduce((s, h) => s + h.mv, 0);

export const accounts = (Object.keys(ACCOUNT_INFO) as AccountKey[]).map(k => {
  const own = holdings.filter(h => h.acct === k);
  const mv = own.reduce((s, h) => s + h.mv, 0);
  const n = own.length;
  const info = ACCOUNT_INFO[k];
  return {
    ...info,
    key: k,
    mv,
    short: `${info.no} · ${n} holdings`,
    src: `Sum of ${n} positions in ${info.no} · see Portfolio detail`,
    day: '+' + info.day.toFixed(2) + '% today',
    dayColor: '#00804a',
  };
});

export const allocation = ASSET_CLASSES.map(c => {
  const mv = holdings.filter(h => h.cls === c).reduce((s, h) => s + h.mv, 0);
  return { cls: c, mv, a: (mv / totalValue) * 100, t: TARGET_WEIGHTS[c], color: CLASS_COLORS[c] };
});

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

const EXCEPTION_CAUSES: [string, string, string, string][] = [
  ['Insufficient securities', 'Borrow or recall from stock-loan desk', 'Recall loan', 'Counterparty did not have the shares available on settlement date. RBC has 1,200 shares on loan that can be recalled to cover delivery.'],
  ['SSI mismatch', 'Re-send instruction with corrected SSI', 'Re-send SSI', 'Counterparty BIC on our instruction does not match their standing settlement instructions on file. Their updated SSI was received 08-Oct.'],
  ['Late affirmation', 'Chase broker to affirm in CTM', 'Chase broker', 'Trade was not affirmed by the broker before the cut-off. Affirmation usually lands within one business day once chased.'],
  ['Cash shortfall', 'Fund from sweep account or approve overdraft', 'Fund from sweep', 'Cash in the settling account is below the amount due. The linked sweep account has sufficient balance to cover it.'],
  ['Unmatched instruction', 'Contact counterparty to match trade details', 'Contact counterparty', 'No matching instruction from the counterparty at the depository. Usually caused by a booking delay on their side.'],
  ['Quantity / price mismatch', 'Verify fill against broker confirm', 'Verify confirm', 'Our booked quantity or price differs from the counterparty confirmation. Compare against the broker fill before amending.'],
  ['Corporate action pending', 'Hold until event processed', 'Place on hold', 'A corporate action on this instrument affects entitlements. Settlement should wait until the event is processed.'],
];

function buildExceptions() {
  let s = 11;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const cpty = ['CDS Clearing', 'DTC / Pershing', 'Euroclear', 'RBC Investor Services', 'Fidelity Clearing Canada', 'Fundserv · PH&N', 'BNY Mellon', 'Goldman Sachs & Co.'];
  const inst = ['Royal Bank of Canada', 'Enbridge Inc.', 'Shopify Inc. Cl A', 'Microsoft Corp.', 'Brookfield Corp.', 'Govt of Canada 3.25% 2034', 'Province of Ontario 3.65% 2033', 'Bell Canada 5.15% 2031', 'US Treasury 4.25% 2030', 'PH&N Bond Fund Sr F', 'RBC Canadian Dividend Fund Sr F', 'Canadian National Railway', 'Apple Inc.', 'Telus Corp.', 'Manulife Financial'];
  const owners = ['A. Nguyen', 'M. Tremblay', 'S. Okafor', 'L. Chen', 'Unassigned', 'Unassigned', 'R. Singh'];
  const rows: SettlementException[] = [];
  for (let i = 0; i < 40; i++) {
    const c = pick(EXCEPTION_CAUSES);
    const age = Math.floor(Math.pow(r(), 1.8) * 12);
    rows.push({
      id: 'SF-' + (48120 + i * 7),
      age,
      val: Math.round((5000 + Math.pow(r(), 2) * 2400000) / 10) * 10,
      inst: pick(inst),
      side: r() > 0.5 ? 'Deliver' : 'Receive',
      acct: 4400 + Math.floor(r() * 99) + '-' + (1000 + Math.floor(r() * 8999)),
      cpty: pick(cpty),
      cause: c[0],
      action: c[1],
      actionShort: c[2],
      why: c[3],
      owner: pick(owners),
    });
  }
  rows.sort((a, b) => b.age - a.age || b.val - a.val);
  return { rows, causes: EXCEPTION_CAUSES.map(c => c[0]) };
}

export const settlementExceptions = buildExceptions();
