import { Fragment, useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { loadWealthData } from './api/client';
import { deriveData } from './data';
import type { Data } from './data';
import { buildModel } from './model';
import { Client360 } from './screens/Client360';
import { PortfolioDetail } from './screens/PortfolioDetail';
import { RebalanceOrders } from './screens/RebalanceOrders';
import { Alternatives } from './screens/Alternatives';
import { SettlementExceptions } from './screens/SettlementExceptions';
import { ClientHome } from './screens/ClientHome';
import { ActivityStatus } from './screens/ActivityStatus';
import { MoveMoney } from './screens/MoveMoney';
import { DATA_STATES, INITIAL_UI_STATE, SCREENS } from './types';
import { Workspace } from './workspace/Workspace';
import { isWorkspaceLocation, workspaceHref } from './workspace/model';
import type { DataState, Screen, SetUiState } from './types';

interface Location {
  screen: Screen;
  /** Forced via `?state=` for design review; otherwise derived from the API request. */
  dataState: DataState | null;
}

function readLocation(): Location {
  const q = new URLSearchParams(window.location.search);
  const screen = SCREENS.find(s => s === q.get('screen')) ?? 'c360';
  const dataState = DATA_STATES.find(s => s === q.get('state')) ?? null;
  return { screen, dataState };
}

function preventHashLinks(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a[href="#"]')) e.preventDefault();
}

export function App() {
  return isWorkspaceLocation() ? <Workspace /> : <LegacyApp />;
}

function LegacyApp() {
  const [loc, setLoc] = useState(readLocation);
  const [ui, setUi] = useState(INITIAL_UI_STATE);
  const [data, setData] = useState<Data | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    setData(null);
    loadWealthData().then(
      raw => setData(deriveData(raw)),
      err => { console.error(err); setLoadFailed(true); },
    );
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    const onPop = () => setLoc(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setState: SetUiState = useCallback(patch => setUi(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);

  const go = useCallback((screen: Screen) => {
    const q = new URLSearchParams(window.location.search);
    q.set('screen', screen);
    window.history.pushState(null, '', '?' + q.toString());
    setLoc(l => ({ ...l, screen }));
  }, []);

  const fetched: DataState = loadFailed ? 'Error' : data ? 'Populated' : 'Loading';
  const dataState = loc.dataState && loc.dataState !== 'Populated' ? loc.dataState : fetched;
  const m = buildModel(loc.screen, dataState, ui, setState, go, data, load);
  const { nav, crumb, title, subtitle, ctx, isClientView, showCtx, userInitials, userName, userRole, show, isLoading, isEmpty, isError, loadingMsg, skeleton, emptyTitle, emptyBody, emptyCta, errTitle, errBody, errAction, errRef } = m;

  return (
    <div onClickCapture={preventHashLinks} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontSize: "12px", lineHeight: "16px", fontVariantNumeric: "tabular-nums" }}>
      <header style={{ height: "48px", background: "#005daa", color: "#fff", display: "flex", alignItems: "center", gap: "16px", padding: "0 16px", borderBottom: "3px solid #ffd200", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "none" }}>
          <img src="/assets/rbc-logo.png" alt="RBC" style={{ width: "26px", height: "34px", objectFit: "cover" }} />
          <div style={{ font: "600 14px/1 Inter,sans-serif", letterSpacing: "-0.01em" }}>Wealth Platform</div>
          <div style={{ font: "500 10px/1 'IBM Plex Mono',monospace", letterSpacing: ".04em", padding: "3px 6px", border: "1px solid rgba(255,255,255,.5)", borderRadius: "4px" }}>UAT</div>
        </div>
        <div style={{ flex: "1", minWidth: "0", maxWidth: "520px", height: "30px", background: "rgba(255,255,255,.14)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "0 10px", color: "rgba(255,255,255,.85)" }}>
          <span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Search clients, accounts, instruments, exceptions</span>
          <span style={{ font: "500 11px 'IBM Plex Mono',monospace", flex: "none" }}>⌘K</span>
        </div>
        <div style={{ flex: "0 1 auto", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "14px", fontSize: "11px", color: "rgba(255,255,255,.9)", marginLeft: "auto" }}>
          <span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>TSX open · data as of 14:47 ET · Mon 12-Oct-2026</span>
          <a href={workspaceHref('clients')} style={{ flex: "none", padding: "5px 10px", background: "#ffd200", color: "#002d62", borderRadius: "6px", fontWeight: "700", fontSize: "12px", textDecoration: "none" }}>Wealth workspace</a>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "none" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#ffd200", color: "#002d62", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "11px" }}>{userInitials}</div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: "13px", whiteSpace: "nowrap" }}><span style={{ fontWeight: "600", color: "#fff" }}>{userName}</span><span>{userRole}</span></div>
          </div>
        </div>
      </header>
      <div style={{ flex: "1", display: "flex", minHeight: "0" }}>
        <nav style={{ width: "208px", flex: "none", background: "#fff", borderRight: "1px solid #e1e5eb", padding: "12px 0", display: "flex", flexDirection: "column", gap: "14px" }}>
          {nav.map((g, g_i) => (<Fragment key={g_i}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <div style={{ font: "500 10.5px 'IBM Plex Mono',monospace", letterSpacing: ".04em", textTransform: "uppercase", color: "rgba(25,25,25,.5)", padding: "0 16px 6px" }}>{g.label}</div>
              {g.items.map((it, it_i) => (<Fragment key={it_i}>
                <div onClick={it.onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 16px 7px 13px", cursor: "pointer", borderLeft: `3px solid ${it.bar}`, background: it.bg, color: it.fg, fontWeight: it.weight, fontSize: "12.5px" }} className="hov-nav">
                  <span>{it.label}</span>
                  {it.badge && (<><span style={{ fontSize: "10.5px", fontWeight: "600", padding: "1px 6px", borderRadius: "9px", background: it.badgeBg, color: it.badgeFg }}>{it.badge}</span></>)}
                </div>
              </Fragment>))}
            </div>
          </Fragment>))}
          <div style={{ flex: "1" }}></div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid #eef0f3", fontSize: "11px", color: "rgba(25,25,25,.56)", display: "flex", flexDirection: "column", gap: "3px" }}>
            <span>Hover any figure with a dotted underline to see its source.</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px" }}>build 0.2.0</span>
          </div>
        </nav>
        <main style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column" }}>
          {isClientView && (<>
            <div style={{ background: "#fff8d6", borderBottom: "1px solid #f0dd8a", padding: "7px 20px", fontSize: "12px", color: "#5c4a00", display: "flex", justifyContent: "space-between" }}>
              <span><strong>Client portal preview</strong> — you are viewing what Eleanor Whitfield sees. Actions are simulated and nothing is submitted.</span>
              <span>WCAG 2.2 AA layout</span>
            </div>
          </>)}
          <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{crumb}</div>
              <h1 style={{ margin: "0", font: "600 20px/26px Inter,sans-serif", letterSpacing: "-0.02em" }}>{title}</h1>
            </div>
            <div style={{ fontSize: "11.5px", color: "rgba(25,25,25,.56)" }}>{subtitle}</div>
          </div>
          {showCtx && (<>
            <div style={{ margin: "12px 20px 0", background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", display: "flex", flexWrap: "wrap" }}>
              {ctx.map((c, c_i) => (<Fragment key={c_i}>
                <div style={{ padding: "8px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "2px", minWidth: "0" }}>
                  <span style={{ fontSize: "10.5px", color: "rgba(25,25,25,.5)" }}>{c.k}</span>
                  <span style={{ fontWeight: "600", color: c.color }}>{c.v}</span>
                </div>
              </Fragment>))}
            </div>
          </>)}

          <div style={{ padding: "12px 20px 32px", flex: "1" }}>
            {isLoading && (<>
              <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "12px", color: "rgba(25,25,25,.56)" }}>{loadingMsg}</div>
                {skeleton.map((s, s_i) => (<Fragment key={s_i}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "16px" }}>
                    <div style={{ height: "12px", borderRadius: "3px", background: "#eceff3", width: s.w }}></div>
                    <div style={{ height: "12px", borderRadius: "3px", background: "#f1f3f6" }}></div>
                    <div style={{ height: "12px", borderRadius: "3px", background: "#f1f3f6" }}></div>
                    <div style={{ height: "12px", borderRadius: "3px", background: "#f1f3f6" }}></div>
                    <div style={{ height: "12px", borderRadius: "3px", background: "#f1f3f6" }}></div>
                  </div>
                </Fragment>))}
              </div>
            </>)}
            {isEmpty && (<>
              <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", textAlign: "center" }}>
                <div style={{ font: "600 15px Inter,sans-serif" }}>{emptyTitle}</div>
                <div style={{ maxWidth: "460px", color: "rgba(25,25,25,.6)", textWrap: "pretty" }}>{emptyBody}</div>
                <div style={{ marginTop: "6px", padding: "7px 12px", background: "#005daa", color: "#fff", borderRadius: "6px", fontWeight: "600" }}>{emptyCta}</div>
              </div>
            </>)}
            {isError && (<>
              <div style={{ background: "#fff", border: "1px solid #f3c2c1", borderRadius: "6px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#d6302f" }}></span><span style={{ font: "600 14px Inter,sans-serif" }}>{errTitle}</span></div>
                <div style={{ color: "rgba(25,25,25,.7)", maxWidth: "720px", textWrap: "pretty" }}>{errBody}</div>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <div onClick={m.retry} style={{ padding: "6px 12px", background: "#005daa", color: "#fff", borderRadius: "6px", fontWeight: "600" }}>Retry</div>
                  <div style={{ padding: "6px 12px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500" }}>{errAction}</div>
                </div>
                <div style={{ font: "11px 'IBM Plex Mono',monospace", color: "rgba(25,25,25,.5)" }}>{errRef}</div>
              </div>
            </>)}

            {show.c360 && <Client360 m={m} />}

            {show.portfolio && <PortfolioDetail m={m} />}

            {show.orders && <RebalanceOrders m={m} />}

            {show.alts && <Alternatives m={m} />}

            {show.exceptions && <SettlementExceptions m={m} />}

            {show.home && <ClientHome m={m} />}

            {show.activity && <ActivityStatus m={m} />}

            {show.money && <MoveMoney m={m} />}
          </div>
        </main>
      </div>
    </div>
  );
}
