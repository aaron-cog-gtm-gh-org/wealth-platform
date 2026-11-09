const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Adds whole days to an ISO `YYYY-MM-DD` date (UTC calendar arithmetic). */
export function addDays(date: string, days: number): string {
  const m = ISO.exec(date);
  if (!m) throw new RangeError(`Invalid ISO date "${date}"`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  return `${y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
