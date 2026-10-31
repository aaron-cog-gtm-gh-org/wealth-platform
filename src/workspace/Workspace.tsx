import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { api } from './api';
import type { Bootstrap } from './api';
import { AuditFeed } from './AuditFeed';
import { WorkspaceContext } from './context';
import type { WorkspaceCtx } from './context';
import { clockTime } from './format';
import { AREA_LABELS, AREAS, isOpen, lookups, readArea } from './model';
import type { Area } from './model';
import { errorMessage } from './ui';
import { ClientsArea } from './areas/Clients';
import { PortfolioArea } from './areas/Portfolio';
import { OrdersArea } from './areas/Orders';
import { MoneyArea } from './areas/Money';
import { RebalanceArea } from './areas/Rebalance';
import { SettlementsArea } from './areas/Settlements';
import './workspace.css';

const SUBTITLES: Record<Area, string> = {
  clients: 'Review client profiles and keep risk and KYC details current.',
  portfolio: 'Holdings and cash by account. Totals are shown per currency.',
  orders: 'Place and cancel equity orders against client accounts.',
  money: 'Move cash between a client\u2019s own CAD accounts.',
  rebalance: 'Set target weights and preview drift. Previews never place trades.',
  settlements: 'Assign, annotate and resolve settlement exceptions.',
};

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: Bootstrap; at: Date };

export function Workspace() {
  const [area, setArea] = useState<Area>(() => readArea());
  const [search, setSearch] = useState(() => window.location.search);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const fetchData = useCallback(async () => {
    const data = await api.bootstrap();
    setLoad({ state: 'ready', data, at: new Date() });
  }, []);

  const initial = useCallback(() => {
    setLoad({ state: 'loading' });
    fetchData().catch(e => setLoad({ state: 'error', message: errorMessage(e) }));
  }, [fetchData]);

  useEffect(initial, [initial]);

  useEffect(() => {
    document.title = `${AREA_LABELS[area]} · Wealth workspace · RBC Wealth Platform`;
  }, [area]);

  useEffect(() => {
    const onPop = () => { setArea(readArea()); setSearch(window.location.search); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((next: Area, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ screen: 'workspace', area: next, ...extra });
    window.history.pushState(null, '', '?' + q.toString());
    setArea(next);
    setSearch('?' + q.toString());
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await fetchData();
    } catch (e) {
      setRefreshError('Could not refresh workspace data: ' + errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const ctx = useMemo<WorkspaceCtx | null>(() => load.state === 'ready'
    ? { data: load.data, lk: lookups(load.data), reload: fetchData, go, params: new URLSearchParams(search) }
    : null, [load, fetchData, go, search]);

  const badges: Partial<Record<Area, number>> = load.state === 'ready' ? {
    orders: load.data.orders.filter(isOpen).length,
    settlements: load.data.exceptions.filter(e => e.status !== 'Resolved').length,
    clients: load.data.clients.filter(c => c.kycStatus === 'Review due').length,
  } : {};

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? AREAS.length - 1 : delta ? (i + delta + AREAS.length) % AREAS.length : -1;
    if (target < 0) return;
    e.preventDefault();
    const next = AREAS[target];
    go(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="ws">
      <header className="ws-top">
        <a className="ws-brand" href="/?screen=c360" aria-label="RBC Wealth Platform home">
          <img src="/assets/rbc-logo.png" alt="" className="ws-brand__logo" />
          <span className="ws-brand__name">Wealth Platform</span>
        </a>
        <span className="ws-env" title="Synthetic UAT data">UAT</span>
        <span className="ws-top__product">Wealth workspace</span>
        <div className="ws-top__right">
          <a className="ws-top__link" href="/?screen=c360">Client 360 and household views</a>
          <div className="ws-user">
            <span className="ws-user__avatar" aria-hidden="true">AD</span>
            <span className="ws-user__text"><strong>A. Diamond</strong><span>Investment adviser</span></span>
          </div>
        </div>
      </header>

      <div className="ws-tabs">
        <div role="tablist" aria-label="Workspace areas" className="ws-tabs__list">
          {AREAS.map((a, i) => (
            <button
              key={a}
              ref={el => { tabRefs.current[a] = el; }}
              type="button"
              role="tab"
              id={`ws-tab-${a}`}
              aria-selected={a === area}
              aria-controls="ws-panel-main"
              tabIndex={a === area ? 0 : -1}
              className="ws-tab"
              onClick={() => go(a)}
              onKeyDown={e => onTabKey(e, i)}
            >
              {AREA_LABELS[a]}
              {!!badges[a] && <span className="ws-tab__badge" aria-label={`${badges[a]} need attention`}>{badges[a]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="ws-titlebar">
        <div>
          <p className="ws-crumb">Wealth workspace / {AREA_LABELS[area]}</p>
          <h1 className="ws-h1">{AREA_LABELS[area]}</h1>
          <p className="ws-sub">{SUBTITLES[area]}</p>
        </div>
        <div className="ws-titlebar__meta">
          {load.state === 'ready' && (
            <span className="ws-muted" aria-live="polite">{refreshing ? 'Refreshing…' : `Data loaded ${clockTime(load.at)}`}</span>
          )}
          <button type="button" className="ws-btn ws-btn--secondary" onClick={refresh} disabled={load.state !== 'ready' || refreshing}>
            Refresh data
          </button>
        </div>
      </div>

      <main id="ws-panel-main" role="tabpanel" aria-labelledby={`ws-tab-${area}`} className="ws-main">
        {refreshError && <div role="alert" className="ws-notice ws-notice--error ws-main__full">{refreshError}</div>}
        {load.state === 'loading' && (
          <div className="ws-panel ws-state ws-main__full" role="status" aria-live="polite">
            <p className="ws-state__title">Loading workspace data…</p>
            <div className="ws-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>
          </div>
        )}
        {load.state === 'error' && (
          <div className="ws-panel ws-state ws-state--error ws-main__full">
            <div role="alert">
              <p className="ws-state__title">Workspace data couldn’t be loaded</p>
              <p>{load.message}</p>
            </div>
            <button type="button" className="ws-btn ws-btn--primary" onClick={initial}>Retry</button>
          </div>
        )}
        {ctx && (
          <WorkspaceContext.Provider value={ctx}>
            <div className="ws-content">
              {area === 'clients' && <ClientsArea />}
              {area === 'portfolio' && <PortfolioArea />}
              {area === 'orders' && <OrdersArea />}
              {area === 'money' && <MoneyArea />}
              {area === 'rebalance' && <RebalanceArea />}
              {area === 'settlements' && <SettlementsArea />}
            </div>
            <AuditFeed area={area} />
          </WorkspaceContext.Provider>
        )}
      </main>
    </div>
  );
}
