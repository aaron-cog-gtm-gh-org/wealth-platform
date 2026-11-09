import type { IsoDate } from '../../api/pv-types';

/** MessageBrowser.aspx filters, read from the URL (`?type=&date=&safe=&file=`, spec 009). */
export interface MessageQuery {
  /** `type`, `date` or `safe` present (even blank): list files (legacy Page_Load lists on `type`/`date`). */
  list: boolean;
  type: 'MT535' | 'MT54x' | null;
  dateText: string;
  date: IsoDate | null;
  dateError: boolean;
  safe: string;
  file: string | null;
}

export const MESSAGE_KEYS = ['type', 'date', 'safe', 'file'] as const;

const LEGACY_TYPES = { '535': 'MT535', '54x': 'MT54x' } as const;
export const toLegacyType = (t: MessageQuery['type']) => (t === 'MT535' ? '535' : t === 'MT54x' ? '54x' : '');

function isoFrom(y: number, m: number, d: number): IsoDate | null {
  if (y < 1 || m < 1 || m > 12 || d < 1) return null;
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` as IsoDate;
}

/**
 * D-009-1: ISO `yyyy-mm-dd` (native date input) or legacy `dd/MM/yyyy` (WebUtil.TryParseUkDate:
 * exact two-digit day/month, four-digit year, real date, surrounding spaces ignored).
 * Blank → null (no date filter); anything else → 'invalid'.
 */
export function parseMessageDate(text: string): IsoDate | null | 'invalid' {
  const s = text.trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const uk = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const parsed = iso ? isoFrom(+iso[1], +iso[2], +iso[3]) : uk ? isoFrom(+uk[3], +uk[2], +uk[1]) : null;
  return parsed ?? 'invalid';
}

/** Null when none of the Message Browser keys is in the URL. */
export function parseMessageQuery(q: URLSearchParams): MessageQuery | null {
  if (!MESSAGE_KEYS.some(k => q.has(k))) return null;
  const type = q.get('type') ?? '';
  const dateText = (q.get('date') ?? '').trim();
  const date = parseMessageDate(dateText);
  return {
    list: q.has('type') || q.has('date') || q.has('safe'),
    type: type in LEGACY_TYPES ? LEGACY_TYPES[type as keyof typeof LEGACY_TYPES] : null,
    dateText,
    date: date === 'invalid' ? null : date,
    dateError: date === 'invalid',
    safe: (q.get('safe') ?? '').trim(),
    file: q.get('file') || null,
  };
}

export const messageQueryKey = (q: MessageQuery | null) =>
  q ? [q.list ? 'L' : '', q.type ?? '', q.date ?? (q.dateError ? `!${q.dateText}` : ''), q.safe, q.file ?? ''].join('~') : '';
