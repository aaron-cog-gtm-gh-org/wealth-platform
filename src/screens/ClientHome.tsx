import { Fragment } from 'react';
import type { Model } from '../model';

export function ClientHome({ m }: { m: Model }) {
  const { accounts, dayChg, goActivity, goMoney, homeAdvisor, homeAdvisorInitials, homeAdvisorReview, homeValuationNote, isCustody, pending, recent, totalFmt, totalSrc, ytdChg } = m;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(320px,1fr)", gap: "12px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "#005daa", color: "#fff", borderRadius: "6px", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,.85)" }}>Total wealth · all accounts</span>
              <span title={totalSrc} style={{ font: "600 32px/38px Inter,sans-serif", letterSpacing: "-0.02em" }}>{totalFmt}</span>
              <span style={{ fontSize: "12.5px" }}>{isCustody ? `${dayChg} · Year-to-date return not available` : <><span style={{ background: "#ffd200", color: "#002d62", fontWeight: "700", padding: "1px 6px", borderRadius: "3px" }}>{dayChg}</span> today · {ytdChg} this year</>}</span>
            </div>
            <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,.85)", textAlign: "right" }}>{isCustody ? homeValuationNote : <>{homeValuationNote}<br />Prices as of 14:47 ET</>}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef0f3", font: "600 13px Inter,sans-serif" }}>Your accounts</div>
            {accounts.map((a, a_i) => (<Fragment key={a_i}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "18px", padding: "11px 14px", borderBottom: "1px solid #f3f4f6", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "600", fontSize: "13px" }}>{a.name}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{a.short}</span></div>
                <span style={{ color: a.dayColor }}>{a.day}</span>
                <span style={{ font: "600 14px Inter,sans-serif", width: "110px", textAlign: "right" }}>{a.mvFmt}</span>
              </div>
            </Fragment>))}
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between" }}><span style={{ font: "600 13px Inter,sans-serif" }}>Recent activity</span><a href="#" onClick={goActivity}>See all activity</a></div>
            {recent.map((r, r_i) => (<Fragment key={r_i}>
              <div style={{ display: "grid", gridTemplateColumns: "72px 1fr auto", gap: "12px", padding: "8px 14px", borderBottom: "1px solid #f3f4f6", alignItems: "center" }}>
                <span style={{ color: "rgba(25,25,25,.56)" }}>{r.date}</span>
                <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "500" }}>{r.desc}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{r.acct}</span></div>
                <span style={{ fontWeight: "600", color: r.amtColor }}>{r.amtFmt}</span>
              </div>
            </Fragment>))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef0f3", font: "600 13px Inter,sans-serif" }}>In progress</div>
            {pending.map((p, p_i) => (<Fragment key={p_i}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: "5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span style={{ fontWeight: "600" }}>{p.t}</span><span style={{ fontWeight: "600" }}>{p.a}</span></div>
                <div style={{ display: "flex", gap: "3px" }}>{p.bars.map((b, b_i) => (<Fragment key={b_i}><div style={{ flex: "1", height: "4px", borderRadius: "2px", background: b.c }}></div></Fragment>))}</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", color: "rgba(25,25,25,.65)" }}><span>{p.s}</span><span>{p.eta}</span></div>
              </div>
            </Fragment>))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div onClick={goMoney} style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "12px 14px", cursor: "pointer", fontWeight: "600", color: "#005daa" }} className="hov-tile">Move money</div>
            <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "12px 14px", fontWeight: "600", color: "#005daa" }}>Statements &amp; tax slips</div>
            <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "12px 14px", fontWeight: "600", color: "#005daa" }}>Message your advisor</div>
            <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "12px 14px", fontWeight: "600", color: "#005daa" }}>Update my details</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px", padding: "12px 14px", display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#e6eef8", color: "#005daa", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>{homeAdvisorInitials}</div>
            <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "600" }}>{homeAdvisor} · Your advisor</span><span style={{ color: "rgba(25,25,25,.56)" }}>{homeAdvisorReview}</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
