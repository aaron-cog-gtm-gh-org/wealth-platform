import { Fragment } from 'react';
import type { Model } from '../model';

const card = { background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" };
const COLS = "112px minmax(220px,2.4fr) 96px 64px 92px 48px 108px 116px";
const right = { textAlign: "right" as const };

/** Holdings.aspx: custody statement of holdings for `?acct=` (spec 005). */
export function CustodyHoldings({ m }: { m: Model }) {
  const h = m.portfolio!;
  const p = h.picker;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
        {h.fields.map((f, f_i) => (<Fragment key={f_i}>
          <div style={{ padding: "8px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "2px", minWidth: "0" }}>
            <span style={{ fontSize: "10.5px", color: "rgba(25,25,25,.5)" }}>{f.k}</span>
            <span style={{ fontWeight: "600", fontFamily: f.k === 'Safe Code' || f.k === 'Acct No' ? "'IBM Plex Mono',monospace" : undefined }}>{f.v}</span>
          </div>
        </Fragment>))}
        <label style={{ marginLeft: "auto", padding: "6px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
            <span style={{ fontSize: "10.5px", color: "rgba(25,25,25,.5)" }}>Stmt Date</span>
            <span style={{ fontSize: "10.5px", color: "rgba(25,25,25,.5)" }}>{p.note}</span>
          </span>
          <select name="stmt" aria-label="Statement date" value={p.value} onChange={e => p.onChange(e.target.value)} style={{ height: "30px", border: "1px solid #cfd5dd", borderRadius: "6px", padding: "0 8px", font: "600 12.5px Inter,sans-serif", color: "#191919", background: "#fff", cursor: "pointer" }}>
            {p.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", ...card }}>
        {h.kpis.map((k, k_i) => (<Fragment key={k_i}>
          <div style={{ padding: "10px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.k}</span>
            <span title={k.src || undefined} style={{ font: "600 17px/22px Inter,sans-serif", letterSpacing: "-0.01em", color: k.color, alignSelf: "flex-start", borderBottom: k.src ? "1px dotted #8a94a3" : "none" }}>{k.v}</span>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.sub}</span>
          </div>
        </Fragment>))}
      </div>
      <div style={card}>
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontWeight: "600" }}>Holdings <span style={{ fontWeight: "400", color: "rgba(25,25,25,.56)" }}>· {h.title}</span></span>
          {h.statement && <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "rgba(25,25,25,.56)" }}>
            <span style={{ fontSize: "10.5px", fontWeight: "600", padding: "1px 7px", borderRadius: "9px", background: h.statement.fn === 'NEWM' ? "#e6eef8" : "#fdf0dd", color: h.statement.fn === 'NEWM' ? "#00498a" : "#94520a" }}>{h.statement.fn}</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{h.statement.file}</span>
          </span>}
        </div>
        {h.message && <div role="status" style={{ padding: "16px 12px", color: "rgba(25,25,25,.7)", fontWeight: "500" }}>{h.message}</div>}
        {!h.message && (
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: "940px" }}>
            <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "10px", padding: "6px 12px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}>
              <span>ISIN</span><span>Instrument</span><span style={right}>Qty</span><span>Qty type</span><span style={right}>Px</span><span>Ccy</span><span style={right}>Mkt Val</span><span style={right}>Mkt Val (GBP)</span>
            </div>
            {h.rows.map((r, r_i) => (<Fragment key={r_i}>
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "10px", padding: "6px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center" }} className="hov-row">
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px" }}>{r.isin}</span>
                <span style={{ fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: r.unknown ? "rgba(25,25,25,.56)" : "#191919", fontStyle: r.unknown ? "italic" : "normal" }}>{r.instrument}</span>
                <span style={right}>{r.qty}</span>
                <span><span style={{ fontSize: "10.5px", fontWeight: "600", padding: "1px 6px", borderRadius: "9px", background: r.qtyType === 'FAMT' ? "#fdf0dd" : "#eef0f3", color: r.qtyType === 'FAMT' ? "#94520a" : "#4b5563" }}>{r.qtyType}</span></span>
                <span style={right}>{r.px}</span>
                <span>{r.ccy}</span>
                <span style={right}>{r.mv}</span>
                <span title={r.gbpSrc} style={{ ...right, fontWeight: "600", justifySelf: "end", color: r.gbpColor, borderBottom: "1px dotted #8a94a3" }}>{r.mvGbp}</span>
              </div>
            </Fragment>))}
            <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "10px", padding: "8px 12px", borderTop: "1px solid #e1e5eb", background: "#f8f9fb", alignItems: "center" }}>
              <span style={{ gridColumn: "1 / 8", fontWeight: "600" }}>Total Mkt Val (GBP)</span>
              <span title={h.totalSrc} style={{ ...right, fontWeight: "700", justifySelf: "end", borderBottom: "1px dotted #8a94a3" }}>{h.total}</span>
            </div>
          </div></div>
        )}
      </div>
    </div>
  );
}
