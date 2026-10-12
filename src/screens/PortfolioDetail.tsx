import { Fragment } from 'react';
import type { Model } from '../model';

export function PortfolioDetail({ m }: { m: Model }) {
  const { alloc, benchPath, clsChips, fees, holdCount, holdings, kpis, perfB, perfP, perfPath, perfStart, periods } = m;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          {kpis.map((k, k_i) => (<Fragment key={k_i}>
            <div style={{ padding: "10px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.k}</span>
              <span title={k.src} style={{ font: "600 17px/22px Inter,sans-serif", letterSpacing: "-0.01em", color: k.color, alignSelf: "flex-start", borderBottom: "1px dotted #8a94a3" }}>{k.v}</span>
              <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.sub}</span>
            </div>
          </Fragment>))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(300px,1fr)", gap: "12px" }}>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: "600" }}>Performance vs benchmark <span style={{ fontWeight: "400", color: "rgba(25,25,25,.56)" }}>· time-weighted, net of fees, CAD</span></span>
              <div style={{ display: "flex", gap: "2px", background: "rgba(0,0,0,.06)", borderRadius: "7px", padding: "2px" }}>
                {periods.map((p, p_i) => (<Fragment key={p_i}>
                  <div onClick={p.onClick} style={{ padding: "3px 9px", borderRadius: "5px", cursor: "pointer", background: p.bg, boxShadow: p.shadow, fontWeight: "500" }}>{p.id}</div>
                </Fragment>))}
              </div>
            </div>
            <div style={{ padding: "10px 12px", display: "flex", gap: "18px", fontSize: "11.5px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "2px", background: "#005daa" }}></span>Portfolio <strong>{perfP}</strong></span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "0", borderTop: "2px dashed #8a94a3" }}></span>Benchmark (45% S&amp;P/TSX · 25% FTSE Universe · 20% MSCI World · 10% FTSE 91d T-bill) <strong>{perfB}</strong></span>
            </div>
            <svg viewBox="0 0 600 170" preserveAspectRatio="none" style={{ width: "100%", height: "190px", display: "block" }}>
              <line x1="0" y1="42" x2="600" y2="42" stroke="#eef0f3" /><line x1="0" y1="85" x2="600" y2="85" stroke="#eef0f3" /><line x1="0" y1="128" x2="600" y2="128" stroke="#eef0f3" />
              <path d={benchPath} fill="none" stroke="#8a94a3" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              <path d={perfPath} fill="none" stroke="#005daa" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px 10px", color: "rgba(25,25,25,.5)", fontSize: "10.5px" }}><span>{perfStart}</span><span>12-Oct-2026</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
              <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", fontWeight: "600" }}>Allocation</div>
              <div style={{ padding: "10px 12px 4px" }}><div style={{ display: "flex", height: "12px", borderRadius: "2px", overflow: "hidden", gap: "1px" }}>
                {alloc.map((d, d_i) => (<Fragment key={d_i}><div style={{ width: d.actualW, background: d.color }}></div></Fragment>))}
              </div></div>
              {alloc.map((d, d_i) => (<Fragment key={d_i}>
                <div style={{ display: "grid", gridTemplateColumns: "10px 1fr 80px 50px 50px", gap: "8px", padding: "5px 12px", alignItems: "center" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: d.color }}></span><span>{d.cls}</span><span title={d.src} style={{ textAlign: "right" }}>{d.mvFmt}</span><span style={{ textAlign: "right", fontWeight: "600" }}>{d.actual}</span><span style={{ textAlign: "right", color: "rgba(25,25,25,.56)" }}>{d.target}</span>
                </div>
              </Fragment>))}
              <div style={{ padding: "2px 12px 8px", fontSize: "10.5px", color: "rgba(25,25,25,.5)", textAlign: "right" }}>value · actual · target</div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
              <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", fontWeight: "600" }}>Fees, YTD</div>
              {fees.map((f, f_i) => (<Fragment key={f_i}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "12px", padding: "5px 12px", borderBottom: "1px solid #f3f4f6" }}><span>{f.k}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{f.r}</span><span style={{ fontWeight: "600", width: "70px", textAlign: "right" }}>{f.v}</span></div>
              </Fragment>))}
            </div>
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: "600" }}>Holdings <span style={{ fontWeight: "400", color: "rgba(25,25,25,.56)" }}>· {holdCount} positions across 3 accounts</span></span>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {clsChips.map((c, c_i) => (<Fragment key={c_i}>
                <div onClick={c.onClick} style={{ padding: "3px 9px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${c.border}`, background: c.bg, color: c.fg, fontWeight: "500" }}>{c.label}</div>
              </Fragment>))}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: "980px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2.4fr) 92px 64px 96px 86px 104px 60px 100px 64px", gap: "10px", padding: "6px 12px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}>
              <span>Instrument</span><span>Class</span><span>Account</span><span style={{ textAlign: "right" }}>Quantity</span><span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "right" }}>Market value</span><span style={{ textAlign: "right" }}>Weight</span><span style={{ textAlign: "right" }}>Unrealized</span><span style={{ textAlign: "right" }}>Day</span>
            </div>
            {holdings.map((h, h_i) => (<Fragment key={h_i}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2.4fr) 92px 64px 96px 86px 104px 60px 100px 64px", gap: "10px", padding: "5px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center" }} className="hov-row">
                <div style={{ display: "flex", flexDirection: "column", minWidth: "0" }}><span style={{ fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.n}</span><span style={{ color: "rgba(25,25,25,.5)", fontSize: "11px" }}>{h.id}</span></div>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "7px", height: "7px", borderRadius: "2px", background: h.color }}></span>{h.cls}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px" }}>{h.acct}</span>
                <span style={{ textAlign: "right" }}>{h.qtyFmt}</span>
                <span style={{ textAlign: "right" }}>{h.pxFmt}</span>
                <span title={h.src} style={{ textAlign: "right", fontWeight: "600", justifySelf: "end", borderBottom: "1px dotted #8a94a3" }}>{h.mvFmt}</span>
                <span style={{ textAlign: "right" }}>{h.wFmt}</span>
                <span style={{ textAlign: "right", color: h.uColor }}>{h.uFmt}</span>
                <span style={{ textAlign: "right", color: h.dColor }}>{h.dFmt}</span>
              </div>
            </Fragment>))}
          </div></div>
        </div>
      </div>
    </>
  );
}
