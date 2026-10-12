import { Fragment } from 'react';
import type { Model } from '../model';

export function MoveMoney({ m }: { m: Model }) {
  const { amount, amountError, availableCashFmt, benes, confirmTitle, fromLabel, goActivity, limits, m1, m2, m3, mSteps, needsApproval, onAmount, railNote, rails, review, toConfirm, toEdit, toReview, tracking } = m;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "12px", alignItems: "start", maxWidth: "1100px" }}>
        <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #eef0f3" }}>
            {mSteps.map((s, s_i) => (<Fragment key={s_i}>
              <div style={{ flex: "1", padding: "10px 14px", borderBottom: `3px solid ${s.bar}`, color: s.fg, fontWeight: "600" }}>{s.n}</div>
            </Fragment>))}
          </div>
          {m1 && (<>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><span style={{ fontWeight: "600" }}>From</span>
                <div style={{ padding: "9px 11px", border: "1px solid #cfd5dd", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}><span>{fromLabel}</span><span style={{ color: "rgba(25,25,25,.56)" }}>Available cash {availableCashFmt}</span></div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><span style={{ fontWeight: "600" }}>To</span>
                {benes.map((b, b_i) => (<Fragment key={b_i}>
                  <div onClick={b.onClick} style={{ padding: "9px 11px", border: `1px solid ${b.border}`, background: b.bg, borderRadius: "6px", display: "grid", gridTemplateColumns: "14px 1fr auto", gap: "10px", alignItems: "center", cursor: "pointer" }}>
                    <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: `2px solid ${b.ring}`, background: b.dot }}></span>
                    <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: "500" }}>{b.n}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{b.d}</span></div>
                    <span style={{ color: "rgba(25,25,25,.56)" }}>{b.h}</span>
                  </div>
                </Fragment>))}
                <a href="#">Add a new payee</a></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}><span style={{ fontWeight: "600" }}>Amount (CAD)</span>
                  <input value={amount} onChange={onAmount} style={{ padding: "9px 11px", border: "1px solid #cfd5dd", borderRadius: "6px", font: "600 14px Inter,sans-serif" }} /></label>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><span style={{ fontWeight: "600" }}>Date</span><div style={{ padding: "9px 11px", border: "1px solid #cfd5dd", borderRadius: "6px", fontSize: "13px" }}>Today, Mon 12-Oct-2026</div></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><span style={{ fontWeight: "600" }}>Send by</span>
                <div style={{ display: "flex", gap: "2px", background: "rgba(0,0,0,.06)", borderRadius: "7px", padding: "2px", alignSelf: "flex-start" }}>
                  {rails.map((r, r_i) => (<Fragment key={r_i}><div onClick={r.onClick} style={{ padding: "5px 12px", borderRadius: "5px", cursor: "pointer", background: r.bg, boxShadow: r.shadow, fontWeight: "500" }}>{r.n}</div></Fragment>))}
                </div>
                <span style={{ color: "rgba(25,25,25,.6)" }}>{railNote}</span></div>
              {amountError && (<><div style={{ padding: "8px 11px", borderRadius: "6px", background: "#fdecec", color: "#a8201f" }}>{amountError}</div></>)}
              <div style={{ display: "flex", justifyContent: "flex-end" }}><div onClick={toReview} style={{ padding: "9px 18px", background: "#005daa", color: "#fff", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Review payment</div></div>
            </div>
          </>)}
          {m2 && (<>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: "8px" }}>
                {review.map((r, r_i) => (<Fragment key={r_i}><span style={{ color: "rgba(25,25,25,.56)" }}>{r.k}</span><span style={{ fontWeight: "600" }}>{r.v}</span></Fragment>))}
              </div>
              {needsApproval && (<><div style={{ padding: "9px 11px", borderRadius: "6px", background: "#fff8d6", color: "#5c4a00" }}>Payments over $25,000 are checked by a second RBC approver. We'll confirm with you by text before 4:00 PM ET today.</div></>)}
              <div style={{ display: "flex", justifyContent: "space-between" }}><div onClick={toEdit} style={{ padding: "9px 14px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500", cursor: "pointer" }}>Edit</div><div onClick={toConfirm} style={{ padding: "9px 18px", background: "#005daa", color: "#fff", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Confirm and send</div></div>
            </div>
          </>)}
          {m3 && (<>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ font: "600 15px Inter,sans-serif" }}>{confirmTitle}</span><span style={{ color: "rgba(25,25,25,.6)" }}>Reference PMT-2026-1012-08841 · You can leave this page; status updates appear in Activity.</span></div>
              {tracking.map((s, s_i) => (<Fragment key={s_i}>
                <div style={{ display: "grid", gridTemplateColumns: "12px 1fr auto", gap: "10px", alignItems: "start" }}><span style={{ width: "12px", height: "12px", borderRadius: "50%", marginTop: "2px", border: `2px solid ${s.c}`, background: s.fill }}></span><div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: s.w, color: s.fg }}>{s.n}</span><span style={{ color: "rgba(25,25,25,.56)" }}>{s.sub}</span></div><span style={{ color: "rgba(25,25,25,.56)" }}>{s.d}</span></div>
              </Fragment>))}
              <div style={{ display: "flex", gap: "8px" }}><div onClick={toEdit} style={{ padding: "8px 14px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500", cursor: "pointer" }}>Make another payment</div><div onClick={goActivity} style={{ padding: "8px 14px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500", cursor: "pointer" }}>View in Activity</div></div>
            </div>
          </>)}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef0f3", fontWeight: "600" }}>Limits &amp; checks</div>
          {limits.map((l, l_i) => (<Fragment key={l_i}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: "2px" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{l.k}</span><span style={{ fontWeight: "600", color: l.color }}>{l.v}</span></div><span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{l.sub}</span></div>
          </Fragment>))}
        </div>
      </div>
    </>
  );
}
