import { Fragment } from 'react';
import type { FormEvent } from 'react';
import type { Model } from '../model';

const card = { background: "#fff", border: "1px solid #e1e5eb", borderRadius: "6px" };
const head = { padding: "10px 12px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" };
const label = { display: "flex", flexDirection: "column" as const, gap: "4px", fontSize: "11px", color: "rgba(25,25,25,.56)" };
const control = { height: "30px", boxSizing: "border-box" as const, padding: "0 8px", border: "1px solid #cfd5dd", borderRadius: "6px", background: "#fff", font: "12px Inter,sans-serif", color: "#191919" };
const mono = "'IBM Plex Mono',monospace";
const COLS = "minmax(220px,1fr) 80px 90px 70px";

export function Messages({ m }: { m: Model }) {
  const v = m.messages!;
  const f = v.filters;
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    f.onList({ type: String(fd.get('type') ?? ''), date: String(fd.get('date') ?? ''), safe: String(fd.get('safe') ?? '') });
  };
  const list = v.list, viewer = v.viewer;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <form key={f.formKey} onSubmit={onSubmit} aria-label="Message filters" style={{ ...card, padding: "10px 12px", display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
        <label style={label}>Message type
          <select name="type" defaultValue={f.type} style={{ ...control, width: "110px" }}>
            {f.types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label style={label}>Date
          <input name="date" type="date" defaultValue={f.date} style={{ ...control, width: "140px" }} />
        </label>
        <label style={label}>Safe code
          <input name="safe" type="text" defaultValue={f.safe} placeholder="e.g. 0010024" autoComplete="off" style={{ ...control, width: "120px", fontFamily: mono, fontSize: "11.5px" }} />
        </label>
        <button type="submit" style={{ height: "30px", padding: "0 16px", border: "0", background: "#005daa", color: "#fff", borderRadius: "6px", font: "600 12px Inter,sans-serif", cursor: "pointer" }}>List</button>
        <span style={{ flex: "1" }}></span>
        <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)", alignSelf: "center" }}>Files are read only from the archive index · OPS / ADMIN</span>
      </form>
      {v.notice && (
        <div role={v.notice.error ? "alert" : undefined} style={{ ...card, padding: "10px 12px", display: "flex", gap: "8px", alignItems: "center", borderColor: v.notice.error ? "#f3c2c1" : "#e1e5eb", color: v.notice.error ? "#b3201f" : "rgba(25,25,25,.7)" }}>
          <span style={{ fontWeight: "600" }}>{v.notice.text}</span>
          {v.notice.detail && <span style={{ color: "rgba(25,25,25,.6)" }}>{v.notice.detail}</span>}
        </div>
      )}
      {(list || viewer) && (
        <div style={{ display: "grid", gridTemplateColumns: list && viewer ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)", gap: "12px", alignItems: "start" }}>
          {list && (
            <div style={{ ...card, minWidth: "0" }}>
              <div style={head}><span style={{ font: "600 14px Inter,sans-serif" }}>{list.title}</span><span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{list.scope}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "10px", padding: "6px 12px", background: "#f8f9fb", color: "rgba(25,25,25,.56)", fontSize: "11px" }}><span>File name</span><span>Msg type</span><span>Date</span><span style={{ textAlign: "right" }}>Size</span></div>
              {list.rows.map((r, r_i) => (<Fragment key={r_i}>
                <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "10px", padding: "5px 12px", borderTop: "1px solid #f3f4f6", alignItems: "center", background: r.selected ? "#eaf1fa" : undefined, boxShadow: r.selected ? "inset 3px 0 0 #005daa" : undefined }} className="hov-row">
                  <a href="#" onClick={r.onOpen} style={{ fontFamily: mono, fontSize: "11px", color: "#005daa", fontWeight: r.selected ? "600" : "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</a>
                  <span>{r.type}</span>
                  <span>{r.date}</span>
                  <span style={{ textAlign: "right" }}>{r.size}</span>
                </div>
              </Fragment>))}
              {list.pager && (
                <div style={{ padding: "8px 12px", borderTop: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "11px", color: "rgba(25,25,25,.56)" }}>{list.pager.range}</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <PageButton label="‹ Prev" onClick={list.pager.onPrev} />
                    {list.pager.pages.map(p => <PageButton key={p.label} label={p.label} active={p.active} onClick={p.onClick} />)}
                    <PageButton label="Next ›" onClick={list.pager.onNext} />
                  </div>
                </div>
              )}
            </div>
          )}
          {viewer && (
            <div style={{ ...card, minWidth: "0" }} aria-label="Raw message">
              <div style={head}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "0" }}>
                  <span style={{ font: "600 14px Inter,sans-serif" }}>Raw message</span>
                  <span style={{ fontFamily: mono, fontSize: "11px", color: "rgba(25,25,25,.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{viewer.path ?? viewer.name}</span>
                </div>
                <div onClick={viewer.onClose} role="button" style={{ padding: "5px 10px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500", cursor: "pointer", background: "#fff", flex: "none" }}>Close</div>
              </div>
              {viewer.notFound
                ? <div role="alert" style={{ padding: "14px 12px", color: "#b3201f", fontWeight: "600" }}>{viewer.notFoundText}</div>
                : <pre style={{ margin: "0", padding: "10px 12px", maxHeight: "640px", overflow: "auto", background: "#f8f9fb", fontFamily: mono, fontSize: "11px", lineHeight: "16px", whiteSpace: "pre", borderRadius: "0 0 6px 6px" }}>{viewer.raw}</pre>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PageButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: (() => void) | null }) {
  return (
    <div onClick={onClick ?? undefined} role="button" aria-disabled={!onClick} aria-current={active ? "page" : undefined}
      style={{ minWidth: "26px", padding: "3px 8px", textAlign: "center", borderRadius: "6px", border: `1px solid ${active ? "#005daa" : "#cfd5dd"}`, background: active ? "#005daa" : "#fff", color: active ? "#fff" : onClick ? "#191919" : "rgba(25,25,25,.35)", fontWeight: active ? "600" : "500", cursor: onClick && !active ? "pointer" : "default" }}>{label}</div>
  );
}
