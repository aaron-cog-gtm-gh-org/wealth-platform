import type { IsoDate } from '../../api/pv-types';

/** Custody account / statement selected through the URL (legacy `Holdings.aspx?acct=` deep links). */
export interface PvContext {
  acct: number | null;
  stmt: IsoDate | null;
  /** `?pc=1`: open PositionCheck.aspx on `exceptions` (spec 006); `acct` or `all` imply it. */
  pc: boolean;
  /** `?all=<yyyy-mm-dd>`: PositionCheck "Check All" date (spec 006). */
  all: IsoDate | null;
}

export const PV_CONTEXT_KEYS = ['acct', 'stmt', 'pc', 'all'] as const;
export type PvContextKey = (typeof PV_CONTEXT_KEYS)[number];
/** Context changes applied by `goPv`: a string sets the key, null removes it, omitted keys are kept. */
export type PvContextPatch = Partial<Record<PvContextKey, string | null>>;

const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** `?acct=<positive integer>&stmt=<yyyy-mm-dd>`; anything malformed is ignored (null). */
export function parsePvContext(search: string | URLSearchParams): PvContext {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const a = q.get('acct')?.trim() ?? '', s = q.get('stmt')?.trim() ?? '', all = q.get('all')?.trim() ?? '';
  return {
    acct: /^\d{1,9}$/.test(a) && Number(a) > 0 ? Number(a) : null,
    stmt: isIsoDate(s) ? (s as IsoDate) : null,
    pc: q.get('pc') === '1',
    all: isIsoDate(all) ? (all as IsoDate) : null,
  };
}

export const pvContextKey = (c: PvContext) => `${c.acct ?? ''}|${c.stmt ?? ''}|${c.pc ? 1 : ''}|${c.all ?? ''}`;
