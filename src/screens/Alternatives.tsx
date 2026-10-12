import { Fragment } from 'react';
import type { Model } from '../model';

export function Alternatives({ m }: { m: Model }) {
  const { altKpis, calls, commits, dists } = m;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          {altKpis.map((k, k_i) => (<Fragment key={k_i}>
            <div style={{ padding: "10px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.k}</span>
              <span title={k.src} style={{ font: "600 17px/22px Inter,sans-serif", alignSelf: "flex-start", borderBottom: "1px dotted #8a94a3" }}>{k.v}</span>
              <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.sub}</span>
            </div>
          </Fragment>))}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", fontWeight: "600" }}>Commitments</div>
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: "1040px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(210px,1.6fr) 56px 96px 150px 96px 96px 120px 54px 54px", gap: "10px", padding: "6px 12px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}><span>Fund · account</span><span>Vintage</span><span style={{ textAlign: "right" }}>Committed</span><span>Called</span><span style={{ textAlign: "right" }}>Unfunded</span><span style={{ textAlign: "right" }}>Distributions</span><span style={{ textAlign: "right" }}>Current value</span><span style={{ textAlign: "right" }}>DPI</span><span style={{ textAlign: "right" }}>TVPI</span></div>
            {commits.map((c, c_i) => (<Fragment key={c_i}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(210px,1.6fr) 56px 96px 150px 96px 96px 120px 54px 54px", gap: "10px", padding: "8px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "600" }}>{c.n}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{c.meta}</span></div>
                <span>{c.vintage}</span>
                <span style={{ textAlign: "right" }}>{c.commitFmt}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}><span>{c.calledFmt} <span style={{ color: "rgba(25,25,25,.56)" }}>· {c.calledPct}</span></span><div style={{ height: "5px", background: "#eef1f5", borderRadius: "2px" }}><div style={{ height: "5px", background: "#7a4fb5", borderRadius: "2px", width: c.calledPct }}></div></div></div>
                <span style={{ textAlign: "right", fontWeight: "600" }}>{c.unfundedFmt}</span>
                <span style={{ textAlign: "right" }}>{c.distFmt}</span>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}><span title={c.src} style={{ fontWeight: "600", borderBottom: "1px dotted #8a94a3" }}>{c.navFmt}</span><span style={{ fontSize: "10.5px", color: c.navColor }}>{c.navNote}</span></div>
                <span style={{ textAlign: "right" }}>{c.dpi}</span>
                <span style={{ textAlign: "right", fontWeight: "600" }}>{c.tvpi}</span>
              </div>
            </Fragment>))}
          </div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))", gap: "12px" }}>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "600" }}>Expected capital calls</span><span style={{ color: "rgba(25,25,25,.56)" }}>next 12 months · manager estimates</span></div>
            {calls.map((c, c_i) => (<Fragment key={c_i}>
              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 120px", gap: "10px", padding: "7px 12px", borderBottom: "1px solid #f3f4f6", alignItems: "center" }}>
                <span style={{ fontWeight: "500" }}>{c.d}</span><span>{c.f}</span><span style={{ textAlign: "right", fontWeight: "600" }}>{c.a}</span>
                <span style={{ justifySelf: "end", fontSize: "10.5px", fontWeight: "600", padding: "2px 7px", borderRadius: "9px", background: c.bg, color: c.fg }}>{c.s}</span>
              </div>
            </Fragment>))}
            <div style={{ padding: "8px 12px", fontSize: "11px", color: "rgba(25,25,25,.6)" }}>Funding source for the 28-Oct call: Corporate account 4418-1157 CAD cash. Available after pending trades: $186,420.</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "600" }}>Distributions received</span><span style={{ color: "rgba(25,25,25,.56)" }}>since inception</span></div>
            {dists.map((d, d_i) => (<Fragment key={d_i}>
              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 120px 90px", gap: "10px", padding: "7px 12px", borderBottom: "1px solid #f3f4f6" }}>
                <span>{d.d}</span><span>{d.f}</span><span style={{ color: "rgba(25,25,25,.6)" }}>{d.t}</span><span style={{ textAlign: "right", fontWeight: "600" }}>{d.a}</span>
              </div>
            </Fragment>))}
          </div>
        </div>
      </div>
    </>
  );
}
