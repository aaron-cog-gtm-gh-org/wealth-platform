import { Fragment } from 'react';
import type { Model } from '../model';

export function SettlementExceptions({ m }: { m: Model }) {
  const { causeChips, exKpis, exRows, exSel } = m;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          {exKpis.map((k, k_i) => (<Fragment key={k_i}>
            <div style={{ padding: "10px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.k}</span>
              <span style={{ font: "600 17px/22px Inter,sans-serif", color: k.color }}>{k.v}</span>
              <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.sub}</span>
            </div>
          </Fragment>))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: "12px", alignItems: "start" }}>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", minWidth: "0" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f3", display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: "600", marginRight: "6px" }}>Cause</span>
              {causeChips.map((c, c_i) => (<Fragment key={c_i}>
                <div onClick={c.onClick} style={{ padding: "3px 9px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${c.border}`, background: c.bg, color: c.fg, fontWeight: "500" }}>{c.label}</div>
              </Fragment>))}
            </div>
            <div style={{ overflowX: "auto" }}><div style={{ minWidth: "940px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "78px 44px 96px minmax(150px,1fr) 150px 150px 170px 96px", gap: "10px", padding: "6px 12px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}><span>ID</span><span>Age</span><span style={{ textAlign: "right" }}>Value (CAD)</span><span>Instrument · account</span><span>Counterparty</span><span>Cause</span><span>Suggested action</span><span>Owner</span></div>
              {exRows.map((e, e_i) => (<Fragment key={e_i}>
                <div onClick={e.onClick} style={{ display: "grid", gridTemplateColumns: "78px 44px 96px minmax(150px,1fr) 150px 150px 170px 96px", gap: "10px", padding: "5px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center", cursor: "pointer", background: e.bg }} className="hov-row">
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px" }}>{e.id}</span>
                  <span style={{ fontWeight: "600", color: e.ageColor }}>{e.age}</span>
                  <span style={{ textAlign: "right", fontWeight: "600" }}>{e.valFmt}</span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: "0" }}><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.inst}</span><span style={{ fontSize: "11px", color: "rgba(25,25,25,.5)" }}>{e.side} · {e.acct}</span></div>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.cpty}</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.cause}</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#005daa" }}>{e.action}</span>
                  <span style={{ color: e.ownerColor }}>{e.owner}</span>
                </div>
              </Fragment>))}
            </div></div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", position: "sticky", top: "12px" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: "600" }}>{exSel.id}</span><span style={{ fontWeight: "600", color: exSel.ageColor }}>{exSel.ageLong}</span></div>
              <span style={{ font: "600 14px Inter,sans-serif" }}>{exSel.cause}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "104px 1fr", rowGap: "6px", padding: "10px 12px", borderBottom: "1px solid #eef0f3" }}>
              {exSel.fields.map((f, f_i) => (<Fragment key={f_i}><span style={{ color: "rgba(25,25,25,.56)" }}>{f.k}</span><span style={{ fontWeight: "500" }}>{f.v}</span></Fragment>))}
            </div>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>Suggested next action</span>
              <span style={{ fontWeight: "600" }}>{exSel.action}</span>
              <span style={{ color: "rgba(25,25,25,.7)", textWrap: "pretty" }}>{exSel.why}</span>
              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}><div style={{ flex: "1", padding: "7px", border: "1px solid #00427a", background: "#005daa", color: "#fff", borderRadius: "6px", textAlign: "center", fontWeight: "600" }}>{exSel.actionShort}</div><div style={{ padding: "7px 10px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500" }}>Assign</div><div style={{ padding: "7px 10px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500" }}>Escalate</div></div>
            </div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>Timeline</span>
              {exSel.timeline.map((t, t_i) => (<Fragment key={t_i}>
                <div style={{ display: "grid", gridTemplateColumns: "8px 1fr", gap: "10px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", marginTop: "4px", background: t.color }}></span><div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "500" }}>{t.t}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{t.d}</span></div></div>
              </Fragment>))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
