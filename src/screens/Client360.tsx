import { Fragment } from 'react';
import type { Model } from '../model';

export function Client360({ m }: { m: Model }) {
  const { accounts, alloc, comms, docs, goOrders, household, profile, tasks, totalFmt, totalSrc } = m;
  const isCustody = m.isCustody, householdName = m.householdName ?? 'Whitfield family';
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: "12px", alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "600" }}>Profile</span><a href="#">Edit</a></div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: "6px", padding: "10px 12px" }}>
            {profile.map((p, p_i) => (<Fragment key={p_i}>
              <span style={{ color: "rgba(25,25,25,.56)" }}>{p.k}</span><span style={{ fontWeight: "500", color: p.color }}>{p.v}</span>
            </Fragment>))}
          </div>
          <div style={{ padding: "9px 12px", borderTop: "1px solid #eef0f3", borderBottom: "1px solid #eef0f3", fontWeight: "600" }}>Household · {householdName}</div>
          {household.map((m, m_i) => (<Fragment key={m_i}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "6px 12px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "500" }}>{m.n}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{m.r}</span></div>
              <span style={{ textAlign: "right", color: "rgba(25,25,25,.7)" }}>{m.a}</span>
            </div>
          </Fragment>))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "600" }}>Accounts</span><span style={{ color: "rgba(25,25,25,.56)" }}>Total <span title={totalSrc} style={{ fontWeight: "600", color: "#191919", borderBottom: "1px dotted #8a94a3" }}>{totalFmt}</span>{isCustody && <> · <a href="#" onClick={e => { e.preventDefault(); m.goCustodyStatements(); }}>Custodian statements</a></>}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 64px", gap: "8px", padding: "6px 12px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}><span>Account</span><span style={{ textAlign: "right" }}>Market value</span><span style={{ textAlign: "right" }}>Drift</span></div>
            {accounts.map((a, a_i) => (<Fragment key={a_i}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 64px", gap: "8px", padding: "7px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: "0" }}><span style={{ fontWeight: "500" }}>{a.name}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{a.meta}</span></div>
                <span title={a.src} style={{ textAlign: "right", fontWeight: "600", borderBottom: "1px dotted #8a94a3", justifySelf: "end" }}>{a.mvFmt}</span>
                <span style={{ textAlign: "right", fontWeight: "600", color: a.driftColor }}>{a.drift}</span>
              </div>
            </Fragment>))}
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "600" }}>{isCustody ? 'Drift' : 'Drift vs Balanced Growth model'}</span>{!isCustody && <a href="#" onClick={goOrders}>Propose rebalance</a>}</div>
            {isCustody ? <div style={{ padding: "10px 12px", color: "rgba(25,25,25,.56)" }}>Not available</div> : <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "9px" }}>
              {alloc.map((d, d_i) => (<Fragment key={d_i}>
                <div style={{ display: "grid", gridTemplateColumns: "86px 1fr 92px", gap: "10px", alignItems: "center" }}>
                  <span>{d.cls}</span>
                  <div style={{ position: "relative", height: "10px", background: "#eef1f5", borderRadius: "2px" }}>
                    <div style={{ position: "absolute", left: "0", top: "0", bottom: "0", width: d.actualW, background: d.color, borderRadius: "2px" }}></div>
                  {d.targetW !== null && <div style={{ position: "absolute", top: "-3px", bottom: "-3px", width: "2px", background: "#191919", left: d.targetW }}></div>}
                  </div>
                  <span style={{ textAlign: "right" }}><span style={{ fontWeight: "600" }}>{d.actual}</span> <span style={{ color: d.driftColor }}>{d.drift}</span></span>
                </div>
              </Fragment>))}
              <div style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>Bar = actual weight · black tick = target · tolerance ±2.0 pts per class</div>
            </div>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "600" }}>Tasks &amp; alerts</span><span style={{ color: "rgba(25,25,25,.56)" }}>{isCustody ? 'Not available' : `${tasks.length} open`}</span></div>
            {isCustody ? <div style={{ padding: '10px 12px', color: 'rgba(25,25,25,.56)' }}>Not available</div> : tasks.map((t, t_i) => (<Fragment key={t_i}>
              <div style={{ display: "grid", gridTemplateColumns: "8px 1fr auto", gap: "10px", padding: "7px 12px", borderBottom: "1px solid #f3f4f6", alignItems: "start" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.color, marginTop: "4px" }}></span>
                <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "500" }}>{t.t}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{t.next}</span></div>
                <span style={{ color: t.dueColor, whiteSpace: "nowrap" }}>{t.due}</span>
              </div>
            </Fragment>))}
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", fontWeight: "600" }}>Recent communication</div>
            {isCustody ? <div style={{ padding: '10px 12px', color: 'rgba(25,25,25,.56)' }}>Not available</div> : comms.map((c, c_i) => (<Fragment key={c_i}>
              <div style={{ padding: "7px 12px", borderBottom: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "500" }}>{c.t}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{c.d}</span></div>
                <span style={{ color: "rgba(25,25,25,.65)" }}>{c.s}</span>
              </div>
            </Fragment>))}
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "9px 12px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: "600" }}>Documents</span><a href="#">{isCustody ? 'Not available' : `All ${m.documentCount ?? docs.length}`}</a></div>
            {isCustody ? <div style={{ padding: '10px 12px', color: 'rgba(25,25,25,.56)' }}>Not available</div> : docs.map((d, d_i) => (<Fragment key={d_i}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", padding: "6px 12px", borderBottom: "1px solid #f3f4f6" }}><a href="#">{d.n}</a><span style={{ color: "rgba(25,25,25,.56)" }}>{d.d}</span></div>
            </Fragment>))}
          </div>
        </div>
      </div>
    </>
  );
}
