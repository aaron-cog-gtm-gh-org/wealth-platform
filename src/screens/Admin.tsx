import { Fragment } from 'react';
import type { Model } from '../model';

const card = { background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" };
const head = { padding: "10px 12px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" };
const USER_COLS = "120px minmax(160px,1fr) 110px 80px 140px";

export function Admin({ m }: { m: Model }) {
  const a = m.admin!;
  const r = a.reload;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", ...card }}>
        {a.kpis.map((k, k_i) => (<Fragment key={k_i}>
          <div style={{ padding: "10px 14px", borderRight: "1px solid #eef0f3", display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.k}</span>
            <span style={{ font: "600 17px/22px Inter,sans-serif", color: k.color }}>{k.v}</span>
            <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{k.sub}</span>
          </div>
        </Fragment>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0,1fr)", gap: "12px", alignItems: "start" }}>
        <div style={card}>
          <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>Archive index</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: "6px", padding: "10px 12px", borderBottom: "1px solid #eef0f3" }}>
            {a.fields.map((f, f_i) => (<Fragment key={f_i}><span style={{ color: "rgba(25,25,25,.56)" }}>{f.k}</span><span style={{ fontWeight: "500" }}>{f.v}</span></Fragment>))}
          </div>
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {!r.confirm && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div onClick={r.onAsk} role="button" style={{ padding: "7px 12px", background: r.busy ? "#7fa9d4" : "#005daa", color: "#fff", borderRadius: "6px", fontWeight: "600", cursor: r.busy ? "default" : "pointer" }}>{r.label}</div>
                {r.notice && <span style={{ color: "#00703f", fontWeight: "600" }}>{r.notice}</span>}
              </div>
            )}
            {r.confirm && (
              <div style={{ border: "1px solid #f0dd8a", background: "#fff8d6", borderRadius: "6px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontWeight: "600", color: "#5c4a00" }}>Reload the archive index?</span>
                <span style={{ color: "rgba(25,25,25,.7)" }}>All MT535 and MT54x files are re-read from the archive share. Screens show the new figures once the reload finishes.</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div onClick={r.onConfirm} role="button" style={{ padding: "6px 12px", background: "#005daa", color: "#fff", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Reload</div>
                  <div onClick={r.onCancel} role="button" style={{ padding: "6px 12px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500", cursor: "pointer", background: "#fff" }}>Cancel</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ ...card, minWidth: "0" }}>
          <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>{a.errorTitle}</span><span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>Files the index could not parse are skipped</span></div>
          {a.noErrors && <div style={{ padding: "14px 12px", color: "rgba(25,25,25,.6)" }}>No parse errors at the last load.</div>}
          {a.errors.map((e, e_i) => (<Fragment key={e_i}>
            <div style={{ padding: "7px 12px", borderTop: e_i ? "1px solid #f3f4f6" : "none", display: "flex", flexDirection: "column", gap: "2px", minWidth: "0" }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.path}</span>
              <span style={{ color: "#b3201f" }}>{e.message}</span>
            </div>
          </Fragment>))}
        </div>
      </div>
      <div style={card}>
        <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>{a.usersTitle}</span></div>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: "640px" }}>
          <div style={{ display: "grid", gridTemplateColumns: USER_COLS, gap: "10px", padding: "6px 12px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}><span>User ID</span><span>Name</span><span>Role</span><span>Active</span><span>Last login</span></div>
          {a.users.map((u, u_i) => (<Fragment key={u_i}>
            <div style={{ display: "grid", gridTemplateColumns: USER_COLS, gap: "10px", padding: "6px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center" }} className="hov-row">
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", fontWeight: "600" }}>{u.username}</span>
              <span>{u.name}</span>
              <span><span style={{ fontSize: "10.5px", fontWeight: "600", padding: "1px 7px", borderRadius: "9px", background: u.roleBg, color: u.roleFg }}>{u.role}</span></span>
              <span><span style={{ fontSize: "10.5px", fontWeight: "600", padding: "1px 7px", borderRadius: "9px", background: u.activeBg, color: u.activeFg }}>{u.active}</span></span>
              <span style={{ color: "rgba(25,25,25,.7)" }}>{u.lastLogin}</span>
            </div>
          </Fragment>))}
        </div></div>
      </div>
    </div>
  );
}
