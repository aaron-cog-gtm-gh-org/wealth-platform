import type { IsoDate } from '../../api/pv-types';
import type { Screen } from '../../types';
import { MESSAGE_KEYS, messageQueryKey, parseMessageQuery } from './message-query';
import type { MessageQuery } from './message-query';

/** Custody account / statement selected through the URL (legacy `Holdings.aspx?acct=` deep links). */
export interface PvContext {
  acct: number | null;
  stmt: IsoDate | null;
  /** `?pc=1`: open PositionCheck.aspx on `exceptions` (spec 006); `acct` or `all` imply it. */
  pc: boolean;
  /** `?all=<yyyy-mm-dd>`: PositionCheck "Check All" date (spec 006). */
  all: IsoDate | null;
  /** Settlements window (spec 007): present only when the URL value is a valid ISO or legacy dd/MM/yyyy date. */
  from?: IsoDate;
  to?: IsoDate;
  /** Message Browser filters (spec 009); present only when one of its keys is in the URL. */
  messages?: MessageQuery;
}

export const PV_CONTEXT_KEYS = ['acct', 'stmt', 'pc', 'all', 'from', 'to'] as const;
export type PvContextKey = (typeof PV_CONTEXT_KEYS)[number];
/** Context changes applied by `goPv`: a string sets the key, null removes it, omitted keys are kept. */
export type PvContextPatch = Partial<Record<PvContextKey, string | null>>;

/** Screen-local URL keys, dropped when navigating to another screen (specs 005–009 add theirs). */
export const PV_SCREEN_KEYS: Partial<Record<Screen, readonly string[]>> = {
  messages: MESSAGE_KEYS,
};

const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** `?stmt=`: ISO `yyyy-mm-dd`, or the legacy `Holdings.aspx` `yyyyMMdd` (`TryParseExact`, spec 005 D-005-1), normalised to ISO. */
export function parseStmtParam(raw: string | null | undefined): IsoDate | null {
  const v = raw?.trim() ?? '';
  if (isIsoDate(v)) return v as IsoDate;
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  const iso = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  return isIsoDate(iso) ? (iso as IsoDate) : null;
}

/** `?acct=<positive integer>&stmt=<yyyy-mm-dd | yyyyMMdd>`; anything malformed is ignored (null). */
export function parsePvContext(search: string | URLSearchParams): PvContext {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const a = q.get('acct')?.trim() ?? '', s = q.get('stmt')?.trim() ?? '', all = q.get('all')?.trim() ?? '';
  const messages = parseMessageQuery(q);
  return {
    acct: /^\d{1,9}$/.test(a) && Number(a) > 0 ? Number(a) : null,
    stmt: parseStmtParam(s),
    pc: q.get('pc') === '1',
    all: isIsoDate(all) ? (all as IsoDate) : null,
    ...dateParam(q, 'from'),
    ...dateParam(q, 'to'),
    ...(messages ? { messages } : {}),
  };
}

/**
 * A typed or deep-linked date: ISO `yyyy-mm-dd`, or the legacy `dd/MM/yyyy` (`WebUtil.TryParseUkDate`,
 * exact after trim). Returns the ISO date or null (spec 007 D-007-1).
 */
export function parseDateInput(raw: string | null | undefined): IsoDate | null {
  const v = raw?.trim() ?? '';
  if (isIsoDate(v)) return v as IsoDate;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  return isIsoDate(iso) ? (iso as IsoDate) : null;
}

const dateParam = (q: URLSearchParams, k: 'from' | 'to') => {
  const d = parseDateInput(q.get(k));
  return d ? { [k]: d } : {};
};

export const pvContextKey = (c: PvContext) => `${c.acct ?? ''}|${c.stmt ?? ''}|${c.pc ? 1 : ''}|${c.all ?? ''}${c.from || c.to ? `|${c.from ?? ''}|${c.to ?? ''}` : ''}${c.messages ? `|${messageQueryKey(c.messages)}` : ''}`;
