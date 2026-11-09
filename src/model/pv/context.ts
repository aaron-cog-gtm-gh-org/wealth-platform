import type { IsoDate } from '../../api/pv-types';

/** Custody account / statement selected through the URL (legacy `Holdings.aspx?acct=` deep links). */
export interface PvContext {
  acct: number | null;
  stmt: IsoDate | null;
  /** Custody client (legacy `ClientSummary.aspx?cid=`, spec 008). */
  cid?: number | null;
  /** Last client search text, raw and untrimmed like legacy `txtSearch.Text` (spec 008); null = not searched. */
  q?: string | null;
}

export const PV_CONTEXT_KEYS = ['acct', 'stmt', 'cid', 'q'] as const;
export type PvContextKey = (typeof PV_CONTEXT_KEYS)[number];

const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** `?acct=<positive integer>&stmt=<yyyy-mm-dd>`; anything malformed is ignored (null). */
export function parsePvContext(search: string | URLSearchParams): PvContext {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const a = q.get('acct')?.trim() ?? '', s = q.get('stmt')?.trim() ?? '', c = q.get('cid')?.trim() ?? '';
  return {
    acct: /^\d{1,9}$/.test(a) && Number(a) > 0 ? Number(a) : null,
    stmt: isIsoDate(s) ? (s as IsoDate) : null,
    cid: /^\d{1,9}$/.test(c) && Number(c) > 0 ? Number(c) : null,
    q: q.get('q'),
  };
}

export const pvContextKey = (c: PvContext) => `${c.acct ?? ''}|${c.stmt ?? ''}|${c.cid ?? ''}|${c.q == null ? '' : 'q=' + c.q}`;
