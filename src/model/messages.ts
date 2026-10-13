// Pure helpers for the message browser (US4) and its deep links.

/** Dominant line-ending style of a raw message, for the detail badge. */
export function detectLineEndings(text: string): 'CRLF' | 'LF' | 'CR' | 'Mixed' | 'None' {
  let crlf = 0, lf = 0, cr = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) { crlf++; i++; } else cr++;
    } else if (c === 10) lf++;
  }
  const kinds = (crlf > 0 ? 1 : 0) + (lf > 0 ? 1 : 0) + (cr > 0 ? 1 : 0);
  if (kinds === 0) return 'None';
  if (kinds > 1) return 'Mixed';
  return crlf ? 'CRLF' : lf ? 'LF' : 'CR';
}

const href = (screen: string, params: Record<string, string | number>) => {
  // Reads the current ?client= param when running in the browser; '' under tsx tests.
  const search = (globalThis as { location?: { search: string } }).location?.search ?? '';
  const q = new URLSearchParams(search);
  const client = q.get('client');
  const p = new URLSearchParams({ screen });
  if (client) p.set('client', client);
  for (const [k, v] of Object.entries(params)) p.set(k, String(v));
  return '?' + p.toString();
};

/** Deep link into the message browser detail panel. */
export const messageBrowserHref = (messageId: number) => href('message-browser', { message: messageId });

/** Deep link to custody holdings for a statement's account/date (T025 screen). */
export const holdingsHref = (clientId: number, accountId: number, date: string) =>
  href('custody-holdings', { client: clientId, account: accountId, date });

/** Deep link to custody settlements for a confirmation's account/date (T031 screen). */
export const settlementsHref = (clientId: number, accountId: number, from: string, to: string) =>
  href('custody-settlements', { client: clientId, account: accountId, from, to });
