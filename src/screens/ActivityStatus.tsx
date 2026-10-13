import { Fragment } from 'react';
import type { Model } from '../model';

export function ActivityStatus({ m }: { m: Model }) {
  const { pending, txns } = m;
  if (m.isCustody) {
    return <div style={{ background: '#fff', border: '1px solid #e1e5eb', borderRadius: '6px', padding: '18px', color: 'rgba(25,25,25,.56)' }}>
      Transaction activity is not available for migrated custody clients.
    </div>;
  }
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "12px" }}>
          {pending.map((p, p_i) => (<Fragment key={p_i}>
            <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ fontWeight: "600" }}>{p.t}</span><span style={{ fontWeight: "600" }}>{p.a}</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {p.steps.map((s, s_i) => (<Fragment key={s_i}>
                  <div style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: "8px", alignItems: "center" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", border: `2px solid ${s.c}`, background: s.fill }}></span><span style={{ fontWeight: s.w, color: s.fg }}>{s.n}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{s.d}</span></div>
                </Fragment>))}
              </div>
            </div>
          </Fragment>))}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}><span style={{ font: "600 13px Inter,sans-serif" }}>Transactions</span><span style={{ color: "rgba(25,25,25,.56)" }}>All accounts · last 30 days · 18 transactions</span></div>
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: "860px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 80px minmax(220px,1fr) 70px 110px 150px", gap: "12px", padding: "6px 14px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}><span>Trade date</span><span>Settle date</span><span>Description</span><span>Account</span><span style={{ textAlign: "right" }}>Amount</span><span>Status</span></div>
            {txns.map((t, t_i) => (<Fragment key={t_i}>
              <div style={{ display: "grid", gridTemplateColumns: "80px 80px minmax(220px,1fr) 70px 110px 150px", gap: "12px", padding: "7px 14px", borderTop: "1px solid #f3f4f6", alignItems: "center" }}>
                <span>{t.td}</span><span style={{ color: "rgba(25,25,25,.65)" }}>{t.sd}</span>
                <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "500" }}>{t.desc}</span><span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{t.det}</span></div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px" }}>{t.acct}</span>
                <span style={{ textAlign: "right", fontWeight: "600", color: t.amtColor }}>{t.amtFmt}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}><span style={{ alignSelf: "flex-start", fontSize: "10.5px", fontWeight: "600", padding: "2px 7px", borderRadius: "9px", background: t.bg, color: t.fg }}>{t.status}</span><span style={{ fontSize: "10.5px", color: "rgba(25,25,25,.56)" }}>{t.next}</span></div>
              </div>
            </Fragment>))}
          </div></div>
        </div>
      </div>
    </>
  );
}
