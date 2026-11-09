import { useCallback, useMemo } from 'react';
import { useWorkspace } from '../context';
import { custodyApi } from './api';
import { custodyParams, NAV_VIEWS, readCustodyRoute } from './model';
import type { CustodyView } from './model';
import { CustodyContext, CustodyLink, useLoad } from './shared';
import type { CustodyCtx } from './shared';
import { ClientSearchView, ClientSummaryView } from './views/Clients';
import { HoldingsView } from './views/Holdings';
import { SettlementsView } from './views/Settlements';
import { CheckAllView, PositionCheckView } from './views/PositionCheck';
import { MessagesView } from './views/Messages';
import { ArchiveView } from './views/Archive';
import './custody.css';

/** Views that belong under a nav entry when they don't have their own. */
const NAV_PARENT: Partial<Record<CustodyView, CustodyView>> = { client: 'clients' };

export function CustodyArea() {
  const { go, params, reload } = useWorkspace();
  const route = useMemo(() => readCustodyRoute(params), [params]);
  const accounts = useLoad('accounts', custodyApi.accounts);

  const nav = useCallback<CustodyCtx['nav']>((view, extra) => go('custody', custodyParams(view, extra)), [go]);

  const ctx = useMemo<CustodyCtx>(() => ({ route, nav, accounts: accounts.state, refreshAudit: reload }), [route, nav, accounts.state, reload]);
  const active = NAV_PARENT[route.view] ?? route.view;
  // Carry the selected account and date between account views.
  const carry = { acct: route.acct, date: route.date };

  return (
    <CustodyContext.Provider value={ctx}>
      <div className="ws-stack">
        <nav className="cu-nav" aria-label="Custody views">
          <ul className="cu-nav__list">
            {NAV_VIEWS.map(n => (
              <li key={n.view}>
                <CustodyLink
                  view={n.view}
                  extra={n.view === 'holdings' || n.view === 'check' ? carry : n.view === 'settlements' ? { acct: route.acct } : n.view === 'checkall' ? { date: route.date } : undefined}
                  className="cu-nav__link"
                  aria-current={active === n.view ? 'page' : undefined}
                >
                  {n.label}
                </CustodyLink>
              </li>
            ))}
          </ul>
        </nav>
        {route.view === 'clients' && <ClientSearchView />}
        {route.view === 'client' && <ClientSummaryView />}
        {route.view === 'holdings' && <HoldingsView />}
        {route.view === 'settlements' && <SettlementsView />}
        {route.view === 'check' && <PositionCheckView />}
        {route.view === 'checkall' && <CheckAllView />}
        {route.view === 'messages' && <MessagesView />}
        {route.view === 'archive' && <ArchiveView />}
      </div>
    </CustodyContext.Provider>
  );
}
