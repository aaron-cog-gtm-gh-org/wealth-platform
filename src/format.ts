export const fmt = (n: number, d = 0) => Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });
export const money = (n: number, d = 0) => (n < 0 ? '−$' : '$') + fmt(n, d);
export const signedMoney = (n: number, d = 0) => (n > 0 ? '+$' : n < 0 ? '−$' : '$') + fmt(n, d);
export const pct = (n: number, d = 2) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(n, d) + '%';

export const GREEN = '#00804a';
export const RED = '#d6302f';
export const AMBER = '#b86a00';
export const MUTE = 'rgba(25,25,25,.56)';
export const INK = '#191919';

export type PillKind = 'ok' | 'warn' | 'bad' | 'info' | 'mute';
const PILLS: Record<PillKind, [string, string]> = {
  ok: ['#e3f5ec', '#00703f'],
  warn: ['#fdf0dd', '#94520a'],
  bad: ['#fdecec', '#b3201f'],
  info: ['#e6eef8', '#00498a'],
  mute: ['#eef0f3', '#4b5563'],
};
export const pill = (k: PillKind) => PILLS[k];
