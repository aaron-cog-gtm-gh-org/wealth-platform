import { Fragment, useState } from 'react';
import type { Model } from '../model';

const card = { background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" };
const head = { padding: "10px 12px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" };
const COLS = "120px minmax(220px,1fr) 180px 100px 80px";
const TONE: Record<string, { background: string; color: string }> = {
  ok: { background: "#e6f4ec", color: "#00703f" }, warn: { background: "#fff4d6", color: "#7a5a00" }, off: { background: "#eef0f3", color: "rgba(25,25,25,.7)" },
};

export function ClientSearch({ m }: { m: Model }) {
  const v = m.clientSearch!;
  const [text, setText] = useState(v.query ?? '');
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <form onSubmit={e => { e.preventDefault(); v.search(text); }} style={card}>
        <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>Find a custody client</span></div>
        <div style={{ padding: "12px", display: "flex", alignItems: "flex-end", gap: "10px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: "600" }}>Name or client ref</span>
            <input name="q" value={text} onChange={e => setText(e.target.value)} autoComplete="off" placeholder="e.g. Penhaligon or C2017"
              style={{ width: "320px", padding: "7px 10px", border: "1px solid #c5ccd6", borderRadius: "6px", font: "inherit" }} />
          </label>
          <button type="submit" style={{ padding: "8px 16px", background: "#005daa", color: "#fff", border: "0", borderRadius: "6px", fontWeight: "600", font: "inherit", cursor: "pointer" }}>Search</button>
          <span style={{ color: "rgba(25,25,25,.56)", paddingBottom: "8px" }}>Client name contains the text, or client reference starts with it. Leave blank to list every client.</span>
        </div>
      </form>
      {v.searched && (
        <div style={card}>
          <div style={head}>
            <span style={{ font: "600 14px Inter,sans-serif" }}>{v.query ? `Results for “${v.query}”` : 'All clients'} <span style={{ fontWeight: "400", color: "rgba(25,25,25,.56)" }}>· {v.resultLabel}</span></span>
            <span style={{ color: "rgba(25,25,25,.56)" }}>{v.rangeLabel}</span>
          </div>
          {v.noResults && <div style={{ padding: "14px 12px", color: "#a3000b", fontWeight: "600" }}>{v.noResults}</div>}
          {v.rows.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: COLS }}>
              {['Client ref', 'Client name', 'Adviser', 'Status', 'No. accts'].map((h, i) => (
                <span key={h} style={{ padding: "7px 12px", background: "#f6f7f9", borderBottom: "1px solid #eef0f3", color: "rgba(25,25,25,.56)", fontWeight: "600", textAlign: i === 4 ? "right" : "left" }}>{h}</span>
              ))}
              {v.rows.map(r => (<Fragment key={r.key}>
                <span style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f3", fontFamily: "'Roboto Mono',monospace" }}>{r.ref}</span>
                <span style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f3" }}>
                  <a href={r.href} onClick={e => { e.preventDefault(); r.open(); }} style={{ color: "#005daa", fontWeight: "600", textDecoration: "none" }}>{r.name}</a>
                </span>
                <span style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f3" }}>{r.adviser}</span>
                <span style={{ padding: "6px 12px", borderBottom: "1px solid #eef0f3" }}>
                  <span style={{ ...TONE[r.statusTone], padding: "2px 8px", borderRadius: "10px", fontWeight: "600", fontSize: "11px" }}>{r.status}</span>
                </span>
                <span style={{ padding: "8px 12px", borderBottom: "1px solid #eef0f3", textAlign: "right" }}>{r.accts}</span>
              </Fragment>))}
            </div>
          )}
          {v.pager.length > 0 && (
            <div style={{ padding: "8px 12px", display: "flex", gap: "4px", alignItems: "center" }}>
              <span style={{ color: "rgba(25,25,25,.56)", marginRight: "6px" }}>Page</span>
              {v.pager.map(p => (
                <span key={p.label} role="button" onClick={p.go} style={{ minWidth: "24px", textAlign: "center", padding: "3px 6px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", background: p.current ? "#005daa" : "transparent", color: p.current ? "#fff" : "#005daa" }}>{p.label}</span>
              ))}
              <span role="button" onClick={v.prev ?? undefined} style={{ marginLeft: "8px", fontWeight: "600", cursor: v.prev ? "pointer" : "default", color: v.prev ? "#005daa" : "rgba(25,25,25,.35)" }}>‹ Previous</span>
              <span role="button" onClick={v.next ?? undefined} style={{ marginLeft: "8px", fontWeight: "600", cursor: v.next ? "pointer" : "default", color: v.next ? "#005daa" : "rgba(25,25,25,.35)" }}>Next ›</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
