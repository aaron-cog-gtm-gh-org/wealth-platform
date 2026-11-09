/** ISIN → reference-data instrument name (PV `INSTRUMENT` table). */
export type InstrumentNames = ReadonlyMap<string, string>;

/** PV `PositionBuilder.InstrumentName`: reference-data name, never the 35B description. */
export function instrumentName(isin: string, names: InstrumentNames | undefined): string {
  return names?.get(isin) ?? `UNKNOWN INSTRUMENT ${isin}`;
}
