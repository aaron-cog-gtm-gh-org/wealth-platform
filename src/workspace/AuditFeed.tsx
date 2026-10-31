import { useId, useState } from 'react';
import { useWorkspace } from './context';
import { timestamp } from './format';
import { AREA_AUDIT_PREFIXES, AREA_LABELS } from './model';
import type { Area } from './model';

export function AuditFeed({ area }: { area: Area }) {
  const { data } = useWorkspace();
  const [all, setAll] = useState(false);
  const toggleId = useId();
  const prefixes = AREA_AUDIT_PREFIXES[area];
  const entries = [...data.audit]
    .filter(e => all || prefixes.some(p => e.action.toLowerCase().startsWith(p)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id, 'en-CA', { numeric: true }));

  return (
    <aside className="ws-panel ws-audit" aria-labelledby="ws-audit-title">
      <header className="ws-panel__head">
        <h2 id="ws-audit-title" className="ws-panel__title">Audit trail</h2>
        <label className="ws-check" htmlFor={toggleId}>
          <input id={toggleId} type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />
          Show all areas
        </label>
      </header>
      <p className="ws-audit__scope">
        {all ? 'Every recorded change in the workspace' : `Changes recorded for ${AREA_LABELS[area].toLowerCase()}`}, newest first. Entries are written by the server when a change is saved.
      </p>
      {entries.length === 0 ? (
        <p className="ws-audit__empty">No changes recorded yet. Saved actions appear here with their time and reference.</p>
      ) : (
        <ol className="ws-audit__list" aria-label="Audit entries">
          {entries.map(e => (
            <li key={e.id} className="ws-audit__item">
              <div className="ws-audit__row">
                <span className="ws-audit__action">{e.action}</span>
                <span className="ws-mono ws-muted">{e.entityId}</span>
              </div>
              <div>{e.detail}</div>
              <time className="ws-muted" dateTime={e.createdAt}>{timestamp(e.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
