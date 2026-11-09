import type { IsoDate } from '../../api/pv-types';
import type { Screen } from '../../types';
import { MESSAGE_KEYS, messageQueryKey, parseMessageQuery } from './message-query';
import type { MessageQuery } from './message-query';

/** Custody account / statement selected through the URL (legacy `Holdings.aspx?acct=` deep links). */
export interface PvContext {
  acct: number | null;
  stmt: IsoDate | null;
  /** Message Browser filters (spec 009); present only when one of its keys is in the URL. */
  messages?: MessageQuery;
}

export const PV_CONTEXT_KEYS = ['acct', 'stmt'] as const;

/** Screen-local URL keys, dropped when navigating to another screen (specs 005–009 add theirs). */
export const PV_SCREEN_KEYS: Partial<Record<Screen, readonly string[]>> = {
  messages: MESSAGE_KEYS,
};

const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** `?acct=<positive integer>&stmt=<yyyy-mm-dd>`; anything malformed is ignored (null). */
export function parsePvContext(search: string | URLSearchParams): PvContext {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const a = q.get('acct')?.trim() ?? '', s = q.get('stmt')?.trim() ?? '';
  const messages = parseMessageQuery(q);
  return {
    acct: /^\d{1,9}$/.test(a) && Number(a) > 0 ? Number(a) : null,
    stmt: isIsoDate(s) ? (s as IsoDate) : null,
    ...(messages ? { messages } : {}),
  };
}

export const pvContextKey = (c: PvContext) => `${c.acct ?? ''}|${c.stmt ?? ''}${c.messages ? `|${messageQueryKey(c.messages)}` : ''}`;
