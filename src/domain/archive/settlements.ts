// legacy: PV.Core/SettlementReader.cs (Q9, Q10).
import { Decimal } from '../decimal';
import { compareDates, type IsoDate } from '../date';
import { parseInt32, substring } from '../dotnet';
import type { SettlementConfirm } from '../swift/models';
import type { ArchiveIndex } from './archive-index';

/**
 * legacy: SettlementReader.GetSettlements - confirmations for one custodian account (callers pass SAFE_CODE
 * padded to 7 digits; compared exactly, Q9) settling in [from, to], CANC removing its PREV only within the same
 * day folder, newest settle date first. Legacy List.Sort is unstable, so ties are put in folder then file-name
 * order (the parity oracle's order).
 */
export function getSettlements(idx: ArchiveIndex | null, custAcct: string, from: IsoDate, to: IsoDate): SettlementConfirm[] {
  const result: SettlementConfirm[] = [];
  if (!idx) return result;
  for (const confs of idx.confirmFolders.values()) {
    let active = confs.filter(c => c.function !== 'CANC');
    for (const canc of confs.filter(c => c.function === 'CANC')) active = active.filter(c => c.seme !== canc.prev);
    for (const c of active) {
      if (c.custAcct !== custAcct) continue;
      if (c.settleDate < from || c.settleDate > to) continue;
      result.push(c);
    }
  }
  return result.sort((a, b) => compareDates(b.settleDate, a.settleDate));
}

/**
 * legacy: SettlementReader.ToAmount - drops the 3-char currency, whole part + fraction digits / 100, so
 * `GBP4303,01` -> 4303.01, `USD192,` -> 192 and `GBP11524,8` -> 11524.08 (Q10). Throws like legacy on bad input.
 */
export function toAmount(raw: string): Decimal {
  const parts = substring(raw, 3).split(',');
  const whole = Decimal.fromInt(parseInt32(parts[0]));
  return parts.length > 1 && parts[1].length > 0 ? whole.add(Decimal.fromInt(parseInt32(parts[1])).shift(2)) : whole;
}
