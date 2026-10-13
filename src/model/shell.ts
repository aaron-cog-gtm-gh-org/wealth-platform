import type { Data } from '../data';
import { ccyMoney, GREEN, INK, dayMonthYear, money, weekdayDate } from '../format';
import { SCREENS } from '../types';
import type { DataState, Screen } from '../types';

const NAV_GROUPS: { label: string; items: [Screen, string, string?][] }[] = [
  { label: 'Adviser', items: [['c360', 'Client 360'], ['portfolio', 'Portfolio detail'], ['orders', 'Rebalance & orders', '6'], ['alts', 'Alternatives']] },
  { label: 'Operations', items: [['exceptions', 'Settlement exceptions', ''], ['position-check', 'Position check'], ['message-browser', 'Message browser']] },
  { label: 'Administration', items: [['custody-admin', 'Custody ingestion']] },
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
  'custody-holdings': ['Advisers / Custodian statements', 'Custodian statements', 'Effective MT535 statement history'],
  'custody-settlements': ['Advisers / Custodian accounts / Settlements', 'Settlement confirmations', 'Legacy custodian feed · SWIFT MT544–MT547 · by settle date'],
  'position-check': ['Operations / Custody', 'Position check', 'Custodian MT535 statements vs previous statement + settled MT54x movements'],
  'message-browser': ['Operations / Custody', 'Message browser', 'Raw SWIFT messages from the custodian archive · shown exactly as received'],
  'custody-admin': ['Administration / Custody', 'Custody ingestion', 'Custodian archive ingest status and re-runs'],
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
  'custody-holdings': ['No statement on file', 'There are no custodian statements available for this account.', 'Choose another date'],
  'custody-settlements': ['No settlement confirmations', 'Nothing settled for this account in the selected period. Widen the date range or pick another account.', 'Change date range'],
  'position-check': ['No custody statements loaded', 'Position checks run once custodian MT535 statements have been ingested. Run an ingest from the custody archive to populate this screen.', 'View ingestion status'],
  'message-browser': ['No messages ingested', 'The custodian archive has not been ingested yet. Run an ingest from Custody ingestion to load MT535 and MT54x files.', 'Open custody ingestion'],
  'custody-admin': ['No ingest runs yet', 'Nothing has been ingested from the custodian archive. Start a run to load statements and confirmations.', 'Run ingest'],
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
  'custody-holdings': ['Custodian statements are unavailable', 'The custody statement service did not respond. Retry to load the statement history.', 'Retry'],
  'custody-settlements': ['Settlement confirmations didn’t load', 'The custody service did not respond. Holdings and statements are unaffected. Retry in a minute.', 'Back to holdings'],
  'position-check': ['Position check could not run', 'The custody service did not respond. No break notes were changed. Retry, or check the ingestion status for the custody archive.', 'View ingestion status'],
  'message-browser': ['Messages didn’t load', 'The custody message store did not respond. Raw files remain in the archive; retry in a minute.', 'View ingestion status'],
  'custody-admin': ['Ingestion status unavailable', 'The custody service did not respond, so counts and the last run are unknown. No ingest has been started.', 'Retry later'],
};

export const CLIENT_PORTAL_SCREENS: Screen[] = ['home', 'activity', 'money'];
/** Ops-context screens: no household context bar, ops user in the header. */
export const OPS_SCREENS: Screen[] = ['exceptions', 'position-check', 'message-browser', 'custody-admin'];

/** Business date the seeded book is valued at. */
export const AS_OF = '2026-10-12';

export const totalSource = (d: Data) =>
  `Sum of ${d.holdings.length} positions across ${d.accounts.length} accounts · listed prices 14:45 ET · fund NAVs 09-Oct · private NAVs 30-Jun`;

export function buildShell(screen: Screen, dataState: DataState, go: (s: Screen) => void, data: Data | null) {
  const isOps = OPS_SCREENS.includes(screen);
  const isClientView = CLIENT_PORTAL_SCREENS.includes(screen);
  const hh = data?.raw.household, c = hh?.primaryClient;
  const isCustody = hh?.source?.kind === 'custody';
  const reportCcy = hh?.source?.reportingCurrency ?? 'CAD';
  const portalName = c?.displayName ?? 'Eleanor Whitfield';
  let [crumb, title, subtitle] = META[screen];
  if (isCustody && hh?.source) {
    const asOf = hh.source.asOf ? dayMonthYear(hh.source.asOf) : 'Not available';
    if (screen === 'c360') {
      crumb = `Advisers / Book of business / ${hh.name}`;
      subtitle = `${data?.accounts.length ?? 0} accounts · ${data?.holdings.length ?? 0} holdings · custodian statements as of ${asOf}`;
    } else if (screen === 'portfolio') {
      crumb = `Advisers / ${hh.name} / All accounts`;
      subtitle = `Custodian MT535 statements · reporting currency ${reportCcy} · as of ${asOf}`;
    } else if (screen === 'orders') {
      crumb = `Advisers / ${hh.name} / Rebalance`;
    } else if (screen === 'alts') {
      crumb = `Advisers / ${hh.name} / Alternatives`;
      subtitle = 'Alternatives data is not available from custodian statements';
    } else if (screen === 'custody-holdings') {
      crumb = `Advisers / ${hh.name} / Custodian statements`;
      subtitle = `Reporting currency ${reportCcy} · as of ${asOf}`;
    }
  }
  if (screen === 'home' && c) title = `Good afternoon, ${c.displayName.split(/\s+/)[0]}`;

  const navGroups = isCustody
    ? NAV_GROUPS.map((g, i) => i === 0 ? { ...g, items: [...g.items, ['custody-holdings', 'Custodian statements'] as [Screen, string]] } : g)
    : NAV_GROUPS;
  const nav = navGroups.map(g => ({
    label: g.label,
    items: g.items.map(([id, label, badge]) => {
      const active = id === screen;
      return {
        id,
        label,
        badge: id === 'exceptions' ? (data ? String(data.settlementExceptions.rows.length) : null) : isCustody && id === 'orders' ? null : badge || null,
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

  const ctx = ((data && hh && c && isCustody ? [
    ['Client', hh.name], ['Client ref', c.id || 'Not available'], ['AUA', ccyMoney(data.totalValue, reportCcy, 2)],
    ['Adviser', hh.advisorName || 'Not available'], ['Latest statement', hh.source?.asOf ? dayMonthYear(hh.source.asOf) : 'Not available'],
    ['Risk', 'Not available'], ['KYC', 'Not available'], ['Mandate', 'Not available'], ['Next review', 'Not available'],
  ] : data && hh && c ? [
    ['Household', hh.name], ['Primary', c.displayName], ['AUA', money(data.totalValue)], ['Risk profile', `${c.riskProfile} (${c.riskScore}/10)`],
    ['KYC', `${c.kycStatus} · reviewed ${dayMonthYear(c.kycReviewedDate)}`, GREEN], ['Mandate', hh.mandate], ['Next review', weekdayDate(hh.nextReviewDate)], ['Advisor', hh.advisorName],
  ] : []) as [string, string, string?][]).map(([k, v, c]) => ({ k, v, color: c || INK }));

  return {
    nav,
    crumb,
    title,
    subtitle,
    ctx,
    isCustody,
    householdName: hh?.name ?? 'Whitfield family',
    portalName,
    reportingCurrency: reportCcy,
    isClientView,
    showCtx: !isOps && !isClientView,
    userInitials: isOps ? 'AN' : 'AD',
    userName: isOps ? 'A. Nguyen' : 'Aaron Diamond',
    userRole: isOps ? 'Wealth Ops · Settlement' : 'Investment Advisor · Toronto–Bay St',
    show: Object.fromEntries(SCREENS.map(k => [k, dataState === 'Populated' && k === screen])) as Record<Screen, boolean>,
    isLoading: dataState === 'Loading',
    isEmpty: dataState === 'Empty',
    isError: dataState === 'Error',
    loadingMsg: 'Loading ' + title.toLowerCase() + '…',
    skeleton: [80, 65, 90, 55, 75, 60, 85, 70].map(w => ({ w: w + '%' })),
    emptyTitle: EMPTY[screen][0],
    emptyBody: EMPTY[screen][1],
    emptyCta: EMPTY[screen][2],
    errTitle: ERR[screen][0],
    errBody: ERR[screen][1],
    errAction: ERR[screen][2],
    errRef: 'Ref ' + screen.toUpperCase() + '-503-7f2a · 14:47:12 ET',
  };
}

export type ShellModel = ReturnType<typeof buildShell>;
