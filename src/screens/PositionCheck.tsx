import { Fragment } from 'react';
import type { Model } from '../model';

const card = { background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" };
const head = { padding: "10px 12px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" };
const select = { height: "30px", border: "1px solid #cfd5dd", borderRadius: "6px", padding: "0 8px", font: "12px Inter,sans-serif", color: "#191919", background: "#fff" };
const primary = { padding: "7px 12px", background: "#005daa", color: "#fff", borderRadius: "6px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" } as const;
const secondary = { padding: "6px 12px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500", cursor: "pointer", background: "#fff", whiteSpace: "nowrap" } as const;
const muted = { fontSize: "11px", color: "rgba(25,25,25,.56)" };
const mono = { fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px" };
const ROW_COLS = "18px 100px minmax(130px,1fr) 72px 72px 72px 72px 72px 78px minmax(150px,1.2fr) 76px 74px 56px";
const ALL_COLS = "110px minmax(200px,1fr) 100px 60px";

/** PositionCheck.aspx: pickers, lblMsg, gvAll (Check All) and gv (breaks with inline RECON_NOTE edit). */
export function PositionCheck({ m }: { m: Model }) {
  const p = m.posCheck!;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", ...card }}>
        {p.kpis.map((k, k_i) => (<Fragment key={k_i}>
          <div style={{ padding: "10px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "3px", minWidth: "0" }}>
            <span style={muted}>{k.k}</span>
            <span style={{ font: "600 17px/22px Inter,sans-serif", color: k.color }}>{k.v}</span>
            <span style={{ ...muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.sub}</span>
          </div>
        </Fragment>))}
      </div>

      <div style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "16px", padding: "10px 12px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontWeight: "500" }}>Account
          <select aria-label="Account" value={p.acctValue} onChange={e => p.onAccount(e.target.value)} style={{ ...select, width: "280px" }}>
            {p.accountOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontWeight: "500" }}>Stmt date
          <select aria-label="Stmt date" value={p.dateValue} onChange={e => p.onDate(e.target.value)} style={{ ...select, width: "130px" }}>
            {p.dateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div onClick={p.onRun} role="button" style={primary}>Run check</div>
        <div style={{ width: "1px", alignSelf: "stretch", background: "#eef0f3" }} />
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontWeight: "500" }}>Check all accounts for
          <select aria-label="Check all date" value={p.allDateValue} onChange={e => p.onAllDate(e.target.value)} style={{ ...select, width: "130px" }}>
            {p.allDateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div onClick={p.onCheckAll} role="button" style={secondary}>Check all</div>
      </div>

      {p.message && <div role="status" style={{ ...card, padding: "8px 12px", borderLeft: `3px solid ${p.messageKind === 'ok' ? "#00804a" : "#005daa"}`, fontWeight: "600", color: p.messageKind === 'ok' ? "#00703f" : "#00427a" }}>{p.message}</div>}
      {p.error && <div role="alert" style={{ ...card, padding: "8px 12px", borderLeft: "3px solid #d6302f", fontWeight: "600", color: "#b3201f" }}>{p.error}</div>}

      {p.showAll && (
        <div style={card}>
          <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>{p.title}</span><span style={muted}>Differences: number of breaks; “-” = no previous statement on file</span></div>
          <div style={{ display: "grid", gridTemplateColumns: ALL_COLS, gap: "10px", padding: "6px 12px", background: "#f8f9fb", ...muted }}><span>Acct no</span><span>Client</span><span style={{ textAlign: "right" }}>Differences</span><span /></div>
          {p.allRows.map((r, r_i) => (<Fragment key={r_i}>
            <div style={{ display: "grid", gridTemplateColumns: ALL_COLS, gap: "10px", padding: "5px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center" }} className="hov-row">
              <span style={{ ...mono, fontWeight: "600" }}>{r.acctNo}</span>
              <span>{r.client}</span>
              <span style={{ textAlign: "right", fontWeight: "600", color: r.diffsColor }}>{r.diffs}</span>
              <span role="link" onClick={r.onView} style={{ color: "#005daa", fontWeight: "600", cursor: "pointer" }}>View</span>
            </div>
          </Fragment>))}
        </div>
      )}

      {p.showRows && p.rows.length > 0 && (
        <div style={{ ...card, minWidth: "0" }}>
          <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>{p.title}</span><span style={muted}>Expected = previous statement + net settled since; rows where expected ≠ statement quantity</span></div>
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: "1110px" }}>
            <div style={{ display: "grid", gridTemplateColumns: ROW_COLS, gap: "6px", padding: "6px 12px", background: "#f8f9fb", ...muted }}>
              <span /><span>ISIN</span><span>Instrument</span><span style={{ textAlign: "right" }}>Prev qty</span><span style={{ textAlign: "right" }}>Net settled</span><span style={{ textAlign: "right" }}>Expected</span><span style={{ textAlign: "right" }}>Stmt qty</span><span style={{ textAlign: "right" }}>Diff</span><span>Status</span><span>Note</span><span>Updated by</span><span>Updated</span><span />
            </div>
            {p.rows.map((r, r_i) => (<Fragment key={r_i}>
              <div style={{ display: "grid", gridTemplateColumns: ROW_COLS, gap: "6px", padding: "6px 12px", borderTop: "1px solid #f3f4f6", alignItems: r.editing ? "start" : "center", background: r.editing ? "#f5f9fd" : undefined }} className={r.editing ? undefined : "hov-row"}>
                <span aria-label="Difference" style={{ width: "14px", height: "14px", borderRadius: "7px", background: "#fdecec", color: "#b3201f", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>!</span>
                <span style={mono}>{r.isin}</span>
                <span style={{ minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.instrument}</span>
                <span style={{ textAlign: "right" }}>{r.prevQty}</span>
                <span style={{ textAlign: "right" }}>{r.netSettled}</span>
                <span style={{ textAlign: "right" }}>{r.expected}</span>
                <span style={{ textAlign: "right" }}>{r.stmtQty}</span>
                <span style={{ textAlign: "right", fontWeight: "600", color: r.diffColor }}>{r.diff}</span>
                {r.editing ? (<>
                  <select aria-label="Status" value={p.editStatus} onChange={e => p.onEditStatus(e.target.value)} style={{ ...select, height: "28px", width: "100%" }}>
                    {p.statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <textarea aria-label="Note" value={p.editNote} maxLength={500} rows={3} onChange={e => p.onEditNote(e.target.value)} style={{ border: "1px solid #cfd5dd", borderRadius: "6px", padding: "5px 8px", font: "12px Inter,sans-serif", resize: "vertical" }} />
                </>) : (<>
                  <span><span style={{ fontSize: "10.5px", fontWeight: "600", padding: "1px 7px", borderRadius: "9px", background: r.statusBg, color: r.statusFg }}>{r.status}</span></span>
                  <span style={{ color: "rgba(25,25,25,.8)", textWrap: "pretty" }}>{r.note}</span>
                </>)}
                <span style={{ ...mono }}>{r.updatedBy}</span>
                <span style={{ color: "rgba(25,25,25,.7)" }}>{r.updated}</span>
                {r.editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div onClick={r.onSave} role="button" style={{ ...primary, padding: "4px 8px", textAlign: "center", background: p.busy ? "#7fa9d4" : "#005daa", cursor: p.busy ? "default" : "pointer" }}>{p.busy ? 'Saving…' : 'Update'}</div>
                    <div onClick={r.onCancel} role="button" style={{ ...secondary, padding: "3px 8px", textAlign: "center" }}>Cancel</div>
                  </div>
                ) : (
                  <div onClick={r.onEdit} role="button" style={{ ...secondary, padding: "3px 8px", textAlign: "center" }}>Edit</div>
                )}
              </div>
            </Fragment>))}
          </div></div>
        </div>
      )}
    </div>
  );
}
