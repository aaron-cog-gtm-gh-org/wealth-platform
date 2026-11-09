import type { Data } from '../data';
import { GREEN, INK, dayMonthYear, money, weekdayDate } from '../format';
import { SCREENS } from '../types';
import type { DataState, Screen } from '../types';
import { pvNavFor, pvPageForScreen, rolesLabel } from './pv/access';
import { PREVIEW_USER } from './pv/preview';
import { PV_SLICES } from './pv/slice';
import type { PvModelInput } from './pv/slice';
import { PV_SCREEN_KEYS } from './pv/context';

const NAV_GROUPS: { label: string; items: [Screen, string, string?][] }[] = [
  { label: 'Adviser', items: [['c360', 'Client 360'], ['portfolio', 'Portfolio detail'], ['orders', 'Rebalance & orders', '6'], ['alts', 'Alternatives']] },
  { label: 'Operations', items: [['exceptions', 'Settlement exceptions', '']] },
  { label: 'Client portal preview', items: [['home', 'Client home'], ['activity', 'Activity & status'], ['money', 'Move money']] },
];

const META: Record<Screen, [string, string, string]> = {
  c360: ['Advisers / Book of business / Whitfield household', 'Client 360', 'Last viewed by you 09-Oct · 3 accounts · 25 holdings'],
  portfolio: ['Advisers / Whitfield household / All accounts', 'Portfolio detail', 'Consolidated · base currency CAD · USD at 1.3683 (WM/Reuters 14:00 ET)'],
  orders: ['Advisers / Whitfield household / Rebalance', 'Order ticket & rebalance', 'Proposal RB-2026-0412 · Draft · created 14:41 ET by A. Diamond'],
  alts: ['Advisers / Whitfield household / Alternatives', 'Alternatives holdings', '2 commitments · valuations are manager-reported and lag by one quarter'],
  exceptions: ['Operations / Settlement', 'Settlement exceptions', 'Wealth Ops – Toronto · queue refreshed 14:46 ET'],
  home: ['Client portal / Home', 'Good afternoon, Eleanor', 'Last sign-in 08-Oct-2026 from iPhone'],
  activity: ['Client portal / Activity', 'Activity and status', 'Times shown in Eastern Time'],
  money: ['Client portal / Move money', 'Move money', 'Payments are screened before they are sent'],
  admin: ['Portfolio Viewer / Administration', 'Admin', 'Custody message archive and Portfolio Viewer user accounts'],
  settlements: ['Portfolio Viewer / Custody', 'Settlements', 'MT544–MT547 settlement confirmations from the custody archive · newest settle date first'],
  messages: ['Portfolio Viewer / Operations', 'Message browser', 'Raw SWIFT MT535 statements and MT54x confirmations from the custody archive'],
};

const EMPTY: Record<Screen, [string, string, string]> = {
  c360: ['No accounts open yet', 'Eleanor Whitfield is onboarded but has no funded accounts. Open an account to see holdings, drift and tasks here.', 'Open an account'],
  portfolio: ['No holdings to show', 'These accounts are open but have no positions or cash yet. Holdings appear once the first deposit or transfer settles.', 'Start a transfer in'],
  orders: ['Portfolio is within tolerance', 'Every asset class is within ±2.0 pts of the Balanced Growth model, so no trades are proposed. You can still place a single order.', 'New order ticket'],
  alts: ['No private investments', 'This household has no commitments to alternative funds. Subscriptions are captured by Operations once the manager accepts them.', 'Request a subscription'],
  exceptions: ['Queue clear', 'There are no open settlement exceptions for Wealth Ops – Toronto. New fails appear here as custodians report them.', 'View settled today'],
  home: ['Welcome to RBC Wealth', 'Your accounts will appear here once your first deposit arrives. Most transfers take 3–5 business days.', 'Make a deposit'],
  activity: ['No activity in the last 30 days', 'Try a longer date range, or check another account.', 'Change date range'],
  money: ['No payees yet', 'Add a payee to send money from your investment accounts.', 'Add a payee'],
  admin: ['Archive is empty', 'The archive index holds no MT535 statements or MT54x confirmations. Check that the custody archive share is mounted, then reload the archive.', 'Reload archive'],
  settlements: ['No settlements in period', 'No MT54x confirmations for this custody account settle in the selected window. Widen the From / To dates and choose Show.', 'Change dates'],
  messages: ['No files match', 'No archive files match the message type, date and safe code you entered. Clear the filters, or try another date or safe code.', 'Clear filters'],
};

const ERR: Record<Screen, [string, string, string]> = {
  c360: ['Couldn’t load client profile', 'The Clients and accounts service did not respond within 5 seconds. Balances shown elsewhere may still be current. Retry, or open the client in read-only mode from the last snapshot (12-Oct 06:00 ET).', 'Open last snapshot'],
  portfolio: ['Prices are unavailable', 'Market data from the pricing service stopped at 13:58 ET. Holdings and quantities are correct but values would be stale, so they are hidden. Retry, or show values at the 13:58 ET prices with a stale flag.', 'Show stale prices'],
  orders: ['Pre-trade checks could not run', 'The mandate limits service is unreachable, so this proposal cannot be approved. Your draft is saved. Retry in a minute, or contact Wealth Tech support (ext. 4-2200) if it persists.', 'Save and exit'],
  alts: ['Valuation feed failed', 'The quarterly NAV file from Northgate’s administrator failed validation (2 rows missing commitment IDs). Values shown use the prior quarter. Operations has been notified (ticket DQ-11842).', 'View ticket'],
  exceptions: ['Custodian feed delayed', 'The 14:30 ET status file from CDS Clearing has not arrived. Exceptions from CDS may be up to 2 hours old. Other custodians are current.', 'Show CDS as stale'],
  home: ['We can’t show your balances right now', 'Something went wrong on our side. Your money is safe and no transactions are affected. Try again in a few minutes, or call 1-800-555-0199.', 'Call us'],
  activity: ['Activity didn’t load', 'We couldn’t reach the transactions service. Try again, or download your latest statement from Documents.', 'Go to Documents'],
  money: ['Payments are temporarily unavailable', 'We’re unable to send payments right now. Nothing has been sent or withdrawn. Try again in 15 minutes.', 'View pending payments'],
  admin: ['Couldn’t load archive status', 'The Portfolio Viewer service did not return the archive index or user list. Nothing has been reloaded or changed. Retry, or check the service health page.', 'Open health check'],
  settlements: ['Couldn’t load settlements', 'The Portfolio Viewer service did not return the settlement confirmations for this account. Nothing has changed. Retry, or check the service health page.', 'Open health check'],
  messages: ['Couldn’t load the message archive', 'The Portfolio Viewer service did not return the archive file list or the requested message. Nothing has changed. Retry, or check the archive status on Admin.', 'Open health check'],
};

/** Shell text for screens while a PV slice drives them (spec 006: `exceptions` with PV context is PositionCheck.aspx). */
const PV_TEXT: Partial<Record<Screen, { meta: [string, string, string]; empty: [string, string, string]; err: [string, string, string] }>> = {
  exceptions: {
    meta: ['Portfolio Viewer / Operations / Position check', 'Position check', 'Expected positions (previous MT535 + settled MT54x) against the custodian statement'],
    empty: ['No statements to check', 'There are no custody accounts or no MT535 statements in the archive index, so there is nothing to reconcile. Ask an administrator to reload the archive.', 'Open settlement exceptions'],
    err: ['Couldn’t run the position check', 'The Portfolio Viewer service did not return accounts, statement dates or check results. No notes were changed. Retry, or check the service health page.', 'Open health check'],
  },
};

export const CLIENT_PORTAL_SCREENS: Screen[] = ['home', 'activity', 'money'];

/** Business date the seeded book is valued at. */
export const AS_OF = '2026-10-12';

export const totalSource = (d: Data) =>
  `Sum of ${d.holdings.length} positions across ${d.accounts.length} accounts · listed prices 14:45 ET · fund NAVs 09-Oct · private NAVs 30-Jun`;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

export function buildShell(screen: Screen, dataState: DataState, go: (s: Screen) => void, data: Data | null, pv: PvModelInput | null = null) {
  const isOps = screen === 'exceptions';
  const slice = pv?.slice ?? null;
  const gate = slice?.gate ?? null;
  const pvUser = pv?.user ?? (slice?.preview ? PREVIEW_USER : null);
  const isClientView = CLIENT_PORTAL_SCREENS.includes(screen);
  const copy = slice ? PV_SLICES[screen]?.copy?.(slice.data, slice.ctx ?? null) ?? null : null;
  const pvText = slice ? (copy ? { meta: copy.meta ?? META[screen], empty: copy.empty ?? EMPTY[screen], err: copy.error ?? ERR[screen] } : PV_TEXT[screen]) : undefined;
  const [crumb, title, subtitle] = pvText?.meta ?? META[screen];
  const emptyText = pvText?.empty ?? EMPTY[screen], errText = pvText?.err ?? ERR[screen];

  const nav = NAV_GROUPS.map(g => ({
    label: g.label,
    items: g.items.map(([id, label, badge]) => {
      const active = id === screen && !pvText;
      return {
        id,
        label,
        badge: id === 'exceptions' ? (data ? String(data.settlementExceptions.rows.length) : null) : badge || null,
        onClick: () => go(id),
        bar: active ? '#005daa' : 'transparent',
        bg: active ? '#eaf1fa' : 'transparent',
        fg: active ? '#00427a' : INK,
        weight: active ? 600 : 500,
        badgeBg: id === 'exceptions' ? '#fdecec' : '#e6eef8',
        badgeFg: id === 'exceptions' ? '#b3201f' : '#00498a',
      };
    }),
  }));
  const pvItems = pvNavFor(pvUser?.role);
  if (pv && pvUser && pvItems.length) nav.push({
    label: 'Portfolio Viewer',
    items: pvItems.map(p => {
      const active = p.screen === screen && !!slice;
      return { id: p.screen, label: p.label, badge: null, onClick: () => pv.goPv(p.screen, p.params), bar: active ? '#005daa' : 'transparent', bg: active ? '#eaf1fa' : 'transparent', fg: active ? '#00427a' : INK, weight: active ? 600 : 500, badgeBg: '#e6eef8', badgeFg: '#00498a' };
    }),
  });

  const hh = data?.raw.household, c = hh?.primaryClient;
  const ctx = ((data && hh && c ? [
    ['Household', hh.name], ['Primary', c.displayName], ['AUA', money(data.totalValue)], ['Risk profile', `${c.riskProfile} (${c.riskScore}/10)`],
    ['KYC', `${c.kycStatus} · reviewed ${dayMonthYear(c.kycReviewedDate)}`, GREEN], ['Mandate', hh.mandate], ['Next review', weekdayDate(hh.nextReviewDate)], ['Advisor', hh.advisorName],
  ] : []) as [string, string, string?][]).map(([k, v, c]) => ({ k, v, color: c || INK }));

  return {
    nav,
    crumb,
    title,
    subtitle,
    ctx,
    isClientView,
    showCtx: !isOps && !isClientView && !slice,
    userInitials: pvUser ? initials(pvUser.fullName || pvUser.username) : isOps ? 'AN' : 'AD',
    userName: pvUser ? pvUser.fullName || pvUser.username : isOps ? 'A. Nguyen' : 'Aaron Diamond',
    userRole: pvUser ? `${pvUser.username} · ${pvUser.role}` : isOps ? 'Wealth Ops · Settlement' : 'Investment Advisor · Toronto–Bay St',
    show: Object.fromEntries(SCREENS.map(k => [k, !gate && dataState === 'Populated' && k === screen])) as Record<Screen, boolean>,
    isLoading: !gate && dataState === 'Loading',
    isEmpty: !gate && dataState === 'Empty',
    isError: !gate && dataState === 'Error',
    pvGate: gate,
    pvSignedIn: !!pv?.user,
    pvSignOut: () => pv?.signOut(),
    pvSignIn: {
      title: 'Sign in to Portfolio Viewer',
      body: `${title} is part of Portfolio Viewer. Sign in with your Portfolio Viewer user ID to continue.`,
      notice: pv?.signIn.notice ?? null,
      error: pv?.signIn.error ?? null,
      pending: pv?.signIn.pending ?? false,
      submit: (u: string, p: string) => pv?.signIn.submit(u, p),
    },
    pvForbidden: {
      title: 'Not authorised for this page',
      body: `${pvPageForScreen(screen)?.label ?? title} requires the ${rolesLabel(pvPageForScreen(screen)?.roles ?? null)} role. You are signed in as ${pv?.user?.username ?? ''} (${pv?.user?.role ?? ''}).`,
      ref: `Ref ${screen.toUpperCase()}-403 · ${pvPageForScreen(screen)?.page ?? ''}`,
    },
    loadingMsg: copy?.loading ?? 'Loading ' + title.toLowerCase() + '…',
    skeleton: [80, 65, 90, 55, 75, 60, 85, 70].map(w => ({ w: w + '%' })),
    emptyTitle: emptyText[0],
    emptyBody: emptyText[1],
    emptyCta: emptyText[2],
    /** Empty CTA for PV screens with URL filters (spec 009 "Clear filters"): removes the screen's keys. */
    emptyAction: PV_SCREEN_KEYS[screen] && pv?.setParams ? () => pv.setParams!(Object.fromEntries(PV_SCREEN_KEYS[screen]!.map(k => [k, null]))) : undefined,
    errTitle: errText[0],
    errBody: errText[1],
    errAction: errText[2],
    errRef: 'Ref ' + screen.toUpperCase() + '-503-7f2a · 14:47:12 ET',
  };
}

export type ShellModel = ReturnType<typeof buildShell>;
