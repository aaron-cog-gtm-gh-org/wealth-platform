/** Settlement confirmations ported from PV `SettlementReader` and `Settlements.aspx.cs`. Pure. */
import { safeKey } from '../swift/parse';
import type { Confirmation } from '../swift/types';
import { addDays } from './dates';

/** A parsed MT54x with its archive location (`mt54x/<dayFolder>/<fileName>`). */
export type ArchivedConfirmation = Confirmation & { dayFolder: string; fileName?: string };

function byLocation(a: ArchivedConfirmation, b: ArchivedConfirmation): number {
  return cmp(a.dayFolder, b.dayFolder) || cmp(a.fileName ?? '', b.fileName ?? '');
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Drops CANC messages and every confirmation whose SEME equals a CANC's PREV. D2: PV only did
 * this within the CANC's own day folder; here a CANC cancels its target in any folder.
 * Result is in day-folder then file-name order.
 */
export function activeConfirmations<T extends ArchivedConfirmation>(all: readonly T[]): T[] {
  const cancelled = new Set<string | null>();
  for (const c of all) if (c.function === 'CANC') cancelled.add(c.prev);
  return all.filter((c) => c.function !== 'CANC' && !cancelled.has(c.seme)).sort(byLocation);
}

/**
 * Active confirmations for an account with `from <= settleDate <= to`, newest settle date first;
 * equal dates stay in day-folder/file-name order. D1: 97A::SAFE matches ignoring leading zeros.
 * `confs` should already be the output of `activeConfirmations`.
 */
export function settlementsFor<T extends ArchivedConfirmation>(confs: readonly T[], safeCode: string, from: string, to: string): T[] {
  const key = safeKey(safeCode);
  return confs
    .filter((c) => safeKey(c.safekeepingAcct) === key && c.settleDate >= from && c.settleDate <= to)
    .sort((a, b) => cmp(b.settleDate, a.settleDate) || byLocation(a, b));
}

/** PV default window: 90 days back to the latest statement date (today when there is none). */
export function defaultSettlementWindow(latestStatementDate: string | null, today: string): { from: string; to: string } {
  const to = latestStatementDate ?? today;
  return { from: addDays(to, -90), to };
}
