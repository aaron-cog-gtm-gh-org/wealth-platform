import { Fragment } from 'react';
import type { Model } from '../model';
import type { SettlementsModel } from '../model/settlements';

const card = { background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" };
const head = { padding: "10px 12px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" };
const mono = "'IBM Plex Mono',monospace";
const th = { padding: "6px 10px", textAlign: "left" as const, fontWeight: "400", fontSize: "11px", color: "rgba(25,25,25,.56)", background: "#f8f9fb", whiteSpace: "nowrap" as const };
const td = { padding: "6px 10px", borderTop: "1px solid #f3f4f6", whiteSpace: "nowrap" as const };
const num = { ...td, textAlign: "right" as const };
const input = { width: "104px", height: "28px", boxSizing: "border-box" as const, padding: "0 8px", border: "1px solid #cfd5dd", borderRadius: "6px", font: `500 12px ${mono}`, color: "#191919", background: "#fff" };

/** Account header and From / To form (Settlements.aspx lblAcct/lblClient/lblSafe, txtFrom/txtTo/btnShow). */
export function SettlementsRange({ s }: { s: SettlementsModel }) {
  const r = s.range!;
  return (
    <div className="stl-header" style={{ ...card, padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: "22px", flexWrap: "wrap" }}>
        {s.header!.map((f, f_i) => (<Fragment key={f_i}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{f.k}</span>
            <span style={{ fontWeight: "600", fontFamily: f.k === 'Acct No' || f.k === 'Safe Code' ? mono : undefined }}>{f.v}</span>
          </div>
        </Fragment>))}
      </div>
      <form className="stl-range" onSubmit={e => { e.preventDefault(); r.onShow(); }} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(25,25,25,.7)" }}>From<input name="from" value={r.from} onChange={e => r.onFrom(e.target.value)} placeholder="yyyy-mm-dd" aria-label="From date" style={input} /></label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(25,25,25,.7)" }}>To<input name="to" value={r.to} onChange={e => r.onTo(e.target.value)} placeholder="yyyy-mm-dd" aria-label="To date" style={input} /></label>
        <button type="submit" className="stl-show" style={{ height: "28px", padding: "0 14px", background: "#005daa", color: "#fff", border: "none", borderRadius: "6px", font: "600 12px Inter,sans-serif", cursor: "pointer" }}>Show</button>
        <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>yyyy-mm-dd · dd/MM/yyyy also accepted</span>
      </form>
      </div>
      {r.msg && <div className="stl-msg" role="alert" style={{ textAlign: "right", color: "#b3201f", fontWeight: "600" }}>{r.msg}</div>}
    </div>
  );
}

function AccountPicker({ s }: { s: SettlementsModel }) {
  return (
    <div className="stl-pick" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {s.notice && <div className="stl-msg" role="alert" style={{ border: "1px solid #f0dd8a", background: "#fff8d6", borderRadius: "6px", padding: "8px 12px", color: "#5c4a00", fontWeight: "600" }}>{s.notice}</div>}
      <div style={card}>
        <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>{s.title}</span><span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>Choose an account to see its settlement confirmations</span></div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Acct No</th><th style={th}>Client</th><th style={th}>Account type</th><th style={th}>Safe Code</th><th style={th}>Ccy</th><th style={th}>Status</th></tr></thead>
            <tbody>
              {s.accounts.map(a => (
                <tr key={a.acctId} onClick={a.onClick} className="hov-row" style={{ cursor: "pointer" }}>
                  <td style={{ ...td, fontFamily: mono, fontWeight: "600", color: "#005daa" }}>{a.acctNo}</td>
                  <td style={td}>{a.client}</td>
                  <td style={td}>{a.type}</td>
                  <td style={{ ...td, fontFamily: mono }}>{a.safeCode}</td>
                  <td style={td}>{a.ccy}</td>
                  <td style={td}>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function Settlements({ m }: { m: Model }) {
  const s = m.settlements!;
  if (s.kind === 'pick') return <AccountPicker s={s} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <SettlementsRange s={s} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", ...card }}>
        {s.kpis.map((k, k_i) => (<Fragment key={k_i}>
          <div style={{ padding: "10px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.k}</span>
            <span style={{ font: "600 17px/22px Inter,sans-serif" }}>{k.v}</span>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.sub}</span>
          </div>
        </Fragment>))}
      </div>
      <div style={{ ...card, minWidth: "0" }}>
        <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>{s.title}</span><span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>Settle date {s.range!.label} · newest first</span></div>
        <div style={{ overflowX: "auto" }}>
          <table className="stl-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Trade date</th><th style={th}>Settle date</th><th style={th}>Msg</th><th style={th}>Dir</th><th style={th}>ISIN</th><th style={th}>Instrument</th>
              <th style={{ ...th, textAlign: "right" }}>Qty</th><th style={{ ...th, textAlign: "right" }}>Amount</th><th style={th}>Ccy</th><th style={th}>Ref</th>
            </tr></thead>
            <tbody>
              {s.rows.map(r => (
                <tr key={r.key} className="hov-row" title={r.source}>
                  <td style={td}>{r.trade}</td>
                  <td style={{ ...td, fontWeight: "600" }}>{r.settle}</td>
                  <td style={{ ...td, fontFamily: mono, fontSize: "11px" }}>{r.msg}</td>
                  <td style={td}><span style={{ fontSize: "10.5px", fontWeight: "600", padding: "1px 7px", borderRadius: "9px", background: r.dirBg, color: r.dirFg }}>{r.dir}</span></td>
                  <td style={{ ...td, fontFamily: mono, fontSize: "11px" }}>{r.isin}</td>
                  <td style={{ ...td, whiteSpace: "normal", minWidth: "180px" }}>{r.instrument}</td>
                  <td style={num}>{r.qty}</td>
                  <td style={num} title={r.amountWarn ?? undefined}>{r.amountWarn && <span style={{ color: "#b3201f", fontWeight: "700", marginRight: "4px" }}>!</span>}{r.amount}</td>
                  <td style={td}>{r.ccy}</td>
                  <td style={{ ...td, fontFamily: mono, fontSize: "11px" }}>{r.seme}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
