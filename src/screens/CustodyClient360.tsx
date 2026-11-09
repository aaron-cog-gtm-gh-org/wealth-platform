import { Fragment } from 'react';
import type { Model } from '../model';

const card = { background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" };
const head = { padding: "10px 12px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" };
const COLS = "96px minmax(150px,1fr) 52px 84px 72px 108px 108px 108px 140px 250px";
const cell = { padding: "8px 10px", borderBottom: "1px solid #eef0f3", whiteSpace: "nowrap" as const };

/** Custody Client 360 (legacy ClientSummary.aspx, spec 008). Shown only for `?screen=c360&cid=`. */
export function CustodyClient360({ m }: { m: Model }) {
  const c = m.client360!;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", ...card }}>
        {c.kpis.map((k, i) => (
          <div key={k.k} style={{ padding: "10px 14px", borderRight: i < 3 ? "1px solid #eef0f3" : "0", borderTop: i === 0 ? "3px solid #ffd200" : "3px solid transparent", display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.k}</span>
            <span style={{ font: "600 17px/22px Inter,sans-serif", color: "#002144" }}>{k.v}</span>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.sub}</span>
          </div>
        ))}
      </div>
      <>
        <div style={card}>
          <div style={head}>
            <span style={{ font: "600 14px Inter,sans-serif" }}>Client</span>
            <span role="button" onClick={c.back} style={{ color: "#005daa", fontWeight: "600", cursor: "pointer" }}>Back to search</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", padding: "10px 12px", gap: "12px" }}>
            {c.fields.map(f => (<div key={f.k} style={{ display: "flex", flexDirection: "column", gap: "3px" }}><span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{f.k}</span><span style={{ fontWeight: "600" }}>{f.v}</span></div>))}
          </div>
        </div>
        <div style={card}>
          <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>Accounts <span style={{ fontWeight: "400", color: "rgba(25,25,25,.56)" }}>· {c.accounts.length} · latest MT535 statement per account</span></span></div>
          <div style={{ display: "grid", gridTemplateColumns: COLS }}>
            {['Account no', 'Type', 'Ccy', 'Safe code', 'Status', 'Opened', 'Closed', 'Stmt date', 'Mkt value (GBP)', ''].map((h, i) => (
              <span key={i} style={{ whiteSpace: "nowrap", padding: "7px 10px", background: "#f6f7f9", borderBottom: "1px solid #eef0f3", color: "rgba(25,25,25,.56)", fontWeight: "600", textAlign: i === 8 ? "right" : "left" }}>{h}</span>
            ))}
            {c.accounts.map(a => (<Fragment key={a.key}>
              <span style={{ ...cell, fontFamily: "'Roboto Mono',monospace" }}>{a.no}</span>
              <span style={cell}>{a.type}</span>
              <span style={cell}>{a.ccy}</span>
              <span style={{ ...cell, fontFamily: "'Roboto Mono',monospace" }}>{a.safe}</span>
              <span style={{ ...cell, color: a.open ? "#00703f" : "rgba(25,25,25,.56)", fontWeight: "600" }}>{a.status}</span>
              <span style={cell}>{a.opened}</span>
              <span style={cell}>{a.closed}</span>
              <span style={cell}>{a.stmt}</span>
              <span style={{ ...cell, textAlign: "right", fontWeight: "600" }}>{a.value}</span>
              <span style={{ ...cell, display: "flex", gap: "10px" }}>
                {a.links.map(l => l.enabled
                  ? <span key={l.label} role="button" onClick={l.go} style={{ color: "#005daa", fontWeight: "600", cursor: "pointer" }}>{l.label}</span>
                  : <span key={l.label} title={`${l.label} opens once that Portfolio Viewer screen is available`} style={{ color: "rgba(25,25,25,.4)", fontWeight: "600" }}>{l.label}</span>)}
              </span>
            </Fragment>))}
            <span style={{ gridColumn: "1 / span 8", padding: "9px 10px", textAlign: "right", fontWeight: "600", background: "#f6f7f9" }}>{c.totalLabel}</span>
            <span style={{ padding: "9px 10px", textAlign: "right", fontWeight: "700", background: "#f6f7f9", color: "#002144" }}>{c.total}</span>
            <span style={{ background: "#f6f7f9" }} />
          </div>
        </div>
      </>
    </div>
  );
}
