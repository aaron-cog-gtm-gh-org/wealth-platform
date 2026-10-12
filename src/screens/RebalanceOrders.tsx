import { Fragment } from 'react';
import type { Model } from '../model';

export function RebalanceOrders({ m }: { m: Model }) {
  const { approve, approveBg, approveCursor, approveFg, approveLabel, approveNote, checkSummary, checkSummaryColor, checks, driftAfter, impact, tradeCountLabel, trades } = m;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: "12px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}><span style={{ fontWeight: "600" }}>Proposed trades <span style={{ fontWeight: "400", color: "rgba(25,25,25,.56)" }}>· generated from Balanced Growth model at 14:41 ET</span></span><span style={{ color: "rgba(25,25,25,.56)" }}>{tradeCountLabel}</span></div>
            <div style={{ overflowX: "auto" }}><div style={{ minWidth: "900px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "44px minmax(200px,1fr) 58px 96px 100px 70px 100px 110px 70px", gap: "10px", padding: "6px 12px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}><span>Side</span><span>Instrument</span><span>Account</span><span style={{ textAlign: "right" }}>Quantity</span><span style={{ textAlign: "right" }}>Est. value</span><span style={{ textAlign: "right" }}>Est. cost</span><span style={{ textAlign: "right" }}>Realized gain</span><span>Route</span><span></span></div>
              {trades.map((t, t_i) => (<Fragment key={t_i}>
                <div style={{ display: "grid", gridTemplateColumns: "44px minmax(200px,1fr) 58px 96px 100px 70px 100px 110px 70px", gap: "10px", padding: "6px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center", opacity: t.opacity, background: t.rowBg }}>
                  <span style={{ fontWeight: "700", fontSize: "10.5px", padding: "2px 0", textAlign: "center", borderRadius: "3px", background: t.sideBg, color: t.sideFg }}>{t.side}</span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: "0" }}><span style={{ fontWeight: "500" }}>{t.n}</span><span style={{ fontSize: "11px", color: t.noteColor }}>{t.note}</span></div>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px" }}>{t.acct}</span>
                  <span style={{ textAlign: "right" }}>{t.qty}</span>
                  <span style={{ textAlign: "right", fontWeight: "600" }}>{t.valFmt}</span>
                  <span style={{ textAlign: "right" }}>{t.costFmt}</span>
                  <span style={{ textAlign: "right", color: t.gainColor }}>{t.gainFmt}</span>
                  <span style={{ color: "rgba(25,25,25,.65)" }}>{t.route}</span>
                  <a href="#" onClick={t.toggle} style={{ textAlign: "right" }}>{t.toggleLabel}</a>
                </div>
              </Fragment>))}
            </div></div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "600" }}>Pre-trade checks</span><span style={{ color: checkSummaryColor, fontWeight: "600" }}>{checkSummary}</span></div>
            {checks.map((c, c_i) => (<Fragment key={c_i}>
              <div style={{ display: "grid", gridTemplateColumns: "52px 220px 1fr", gap: "12px", padding: "6px 12px", borderBottom: "1px solid #f3f4f6", alignItems: "start" }}>
                <span style={{ fontSize: "10.5px", fontWeight: "700", textAlign: "center", padding: "1px 0", borderRadius: "3px", background: c.bg, color: c.fg }}>{c.status}</span>
                <span style={{ fontWeight: "500" }}>{c.n}</span>
                <span style={{ color: "rgba(25,25,25,.7)" }}>{c.d}</span>
              </div>
            </Fragment>))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", fontWeight: "600" }}>Impact summary</div>
            {impact.map((i, i_i) => (<Fragment key={i_i}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", borderBottom: "1px solid #f3f4f6" }}><span style={{ color: "rgba(25,25,25,.65)" }}>{i.k}</span><span style={{ fontWeight: "600", color: i.color }}>{i.v}</span></div>
            </Fragment>))}
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>Drift after trades</div>
              {driftAfter.map((d, d_i) => (<Fragment key={d_i}>
                <div style={{ display: "grid", gridTemplateColumns: "86px 1fr 1fr", gap: "8px" }}><span>{d.cls}</span><span style={{ color: d.beforeColor }}>{d.before}</span><span style={{ fontWeight: "600", color: d.afterColor }}>→ {d.after}</span></div>
              </Fragment>))}
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div onClick={approve} style={{ padding: "9px 12px", borderRadius: "6px", textAlign: "center", fontWeight: "600", fontSize: "13px", background: approveBg, color: approveFg, cursor: approveCursor }}>{approveLabel}</div>
            <div style={{ fontSize: "11px", color: "rgba(25,25,25,.6)", textWrap: "pretty" }}>{approveNote}</div>
            <div style={{ display: "flex", gap: "6px" }}><div style={{ flex: "1", padding: "6px", textAlign: "center", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500" }}>Save as draft</div><div style={{ flex: "1", padding: "6px", textAlign: "center", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500" }}>Send proposal to client</div></div>
          </div>
        </div>
      </div>
    </>
  );
}
