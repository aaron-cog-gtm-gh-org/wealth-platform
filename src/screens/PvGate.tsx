import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Model } from '../model';

const input = { height: "30px", border: "1px solid #cfd5dd", borderRadius: "6px", padding: "0 10px", font: "12.5px Inter,sans-serif", color: "#191919", background: "#fff" };

/** Login.aspx in the shell. Field values are transient form input; everything else comes from the model. */
export function PvSignIn({ m }: { m: Model }) {
  const s = m.pvSignIn;
  const [user, setUser] = useState('');
  const [pwd, setPwd] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); s.submit(user, pwd); };
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "24px" }}>
      <form onSubmit={submit} style={{ width: "380px", background: "#fff", border: "1px solid #e1e5eb", borderTop: "3px solid #005daa", borderRadius: "6px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ font: "600 15px Inter,sans-serif" }}>{s.title}</div>
        <div style={{ color: "rgba(25,25,25,.6)", textWrap: "pretty" }}>{s.body}</div>
        {s.notice && <div style={{ background: "#fff8d6", border: "1px solid #f0dd8a", color: "#5c4a00", borderRadius: "6px", padding: "7px 10px" }}>{s.notice}</div>}
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontWeight: "500" }}>User ID
          <input name="username" autoComplete="username" value={user} onChange={e => setUser(e.target.value)} style={input} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontWeight: "500" }}>Password
          <input name="password" type="password" autoComplete="current-password" value={pwd} onChange={e => setPwd(e.target.value)} style={input} />
        </label>
        {s.error && <div role="alert" style={{ color: "#b3201f", fontWeight: "600" }}>{s.error}</div>}
        <button type="submit" disabled={s.pending} style={{ marginTop: "4px", height: "32px", border: "none", borderRadius: "6px", background: s.pending ? "#7fa9d4" : "#005daa", color: "#fff", font: "600 12.5px Inter,sans-serif", cursor: s.pending ? "default" : "pointer" }}>{s.pending ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

/** BasePage role check failure (legacy redirected to ClientSearch.aspx?err=1; D-010-2). */
export function PvForbidden({ m }: { m: Model }) {
  const f = m.pvForbidden;
  return (
    <div style={{ background: "#fff", border: "1px solid #f3c2c1", borderRadius: "6px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#d6302f" }}></span><span style={{ font: "600 14px Inter,sans-serif" }}>{f.title}</span></div>
      <div style={{ color: "rgba(25,25,25,.7)", maxWidth: "720px", textWrap: "pretty" }}>{f.body}</div>
      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <div onClick={m.pvSignOut} role="button" style={{ padding: "6px 12px", border: "1px solid #cfd5dd", borderRadius: "6px", fontWeight: "500", cursor: "pointer" }}>Sign in as another user</div>
      </div>
      <div style={{ font: "11px 'IBM Plex Mono',monospace", color: "rgba(25,25,25,.5)" }}>{f.ref}</div>
    </div>
  );
}
