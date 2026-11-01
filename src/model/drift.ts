import type { AssetClass, RebalanceDto } from '../api/types';

type Drift = RebalanceDto['drift'][number];
type Trade = Pick<RebalanceDto['trades'][number], 'side' | 'instrument' | 'value'>;

/**
 * Post-trade drift by asset class for the trades currently included in the proposal.
 * The proposal's after-drift assumes every trade executes; an excluded buy leaves its
 * value in cash instead of its asset class, and an excluded sell leaves it invested.
 */
export function postTradeDrift(drift: Drift[], trades: Trade[], included: boolean[], classOf: (instrument: string) => AssetClass | undefined, total: number): Drift[] {
  const shift = new Map<AssetClass, number>();
  const move = (cls: AssetClass, pts: number) => shift.set(cls, (shift.get(cls) ?? 0) + pts);
  trades.forEach((t, i) => {
    const cls = classOf(t.instrument);
    if (included[i] || !cls || !total) return;
    const pts = (t.side === 'BUY' ? t.value : -t.value) / total * 100;
    move(cls, -pts);
    move('Cash', pts);
  });
  return drift.map(d => ({ ...d, afterPts: d.afterPts + (shift.get(d.assetClass) ?? 0) }));
}
