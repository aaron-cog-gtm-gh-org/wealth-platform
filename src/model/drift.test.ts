import assert from 'node:assert/strict';
import test from 'node:test';
import type { AssetClass } from '../api/types';
import { postTradeDrift } from './drift';

const drift = [
  { assetClass: 'Cash' as const, beforePts: 1.2, afterPts: 0.9 },
  { assetClass: 'Equities' as const, beforePts: -1.6, afterPts: -0.4 },
  { assetClass: 'Bonds' as const, beforePts: -1.8, afterPts: -0.3 },
];
const trades = [
  { side: 'SELL' as const, instrument: 'Shopify Inc. Cl A', value: 20_000 },
  { side: 'BUY' as const, instrument: 'Govt of Canada 3.25% 01-Dec-2034', value: 30_000 },
  { side: 'BUY' as const, instrument: 'Microsoft Corp.', value: 50_000 },
];
const classes: Record<string, AssetClass> = {
  'Shopify Inc. Cl A': 'Equities', 'Govt of Canada 3.25% 01-Dec-2034': 'Bonds', 'Microsoft Corp.': 'Equities',
};
const classOf = (instrument: string) => classes[instrument];
const total = 10_000_000;
const after = (rows: { assetClass: string; afterPts: number }[]) =>
  Object.fromEntries(rows.map(r => [r.assetClass, Number(r.afterPts.toFixed(2))]));

test('post-trade drift matches the proposal when every trade is included', () => {
  assert.deepEqual(after(postTradeDrift(drift, trades, [true, true, true], classOf, total)), { Cash: 0.9, Equities: -0.4, Bonds: -0.3 });
});

test('excluding a buy removes its weight from the asset class and keeps it in cash', () => {
  const rows = postTradeDrift(drift, trades, [true, true, false], classOf, total);
  assert.deepEqual(after(rows), { Cash: 1.4, Equities: -0.9, Bonds: -0.3 });
  assert.deepEqual(rows.map(r => r.beforePts), [1.2, -1.6, -1.8]);
});

test('excluding a sell keeps its weight in the asset class instead of cash', () => {
  assert.deepEqual(after(postTradeDrift(drift, trades, [false, true, true], classOf, total)), { Cash: 0.7, Equities: -0.2, Bonds: -0.3 });
});
