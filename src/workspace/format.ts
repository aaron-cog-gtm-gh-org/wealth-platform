const formatters = new Map<string, Intl.NumberFormat>();

/** `$25,000.00` for CAD, `US$15,000.00` for USD — never mixes currencies. */
export function money(amount: number, currency: string) {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-CA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formatters.set(currency, f);
  }
  return f.format(amount);
}

export const qty = (n: number) => n.toLocaleString('en-CA', { maximumFractionDigits: 4 });
export const weight = (n: number) => n.toLocaleString('en-CA', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
export const signedWeight = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' pts';

export function timestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-CA', { timeZone: 'America/Toronto', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' ET';
}

export const clockTime = (d: Date) =>
  d.toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' ET';
