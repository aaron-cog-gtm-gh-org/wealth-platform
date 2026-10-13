import { Fragment, useCallback, useEffect, useState } from 'react';
import { getIngestionStatus, postIngestRun } from '../api/client';
import type { IngestRun, IngestionStatus } from '../api/types';
import { fmt } from '../format';

// Custody ingestion admin (US5): archive stats, last run, and an on-demand incremental ingest.
// Replaces Portfolio Viewer Admin → Reload archive. Users are not managed here (no login).

const MONO = "'IBM Plex Mono',monospace";
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e1e5eb', borderRadius: '6px', minWidth: 0 };
const sectionTitle: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #eef0f3', fontWeight: 600, fontSize: '12.5px' };
const kv = (k: string, v: React.ReactNode) => (
  <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '10px', padding: '4px 12px' }}>
    <span style={{ color: 'rgba(25,25,25,.56)' }}>{k}</span><span style={{ fontWeight: 500, fontFamily: MONO, fontSize: '11.5px' }}>{v}</span>
  </div>
);

const MT_TYPES = ['535', '544', '545', '546', '547'] as const;

export function CustodyAdmin() {
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    getIngestionStatus().then(s => { setStatus(s); setLoadErr(false); }, () => setLoadErr(true));
  }, []);
  useEffect(refresh, [refresh]);

  const run = () => {
    setRunning(true);
    setBanner(null);
    postIngestRun().then((r: IngestRun) => {
      setBanner({ ok: true, text: `Run ${r.runId}: ${fmt(r.filesSeen)} files seen · ${fmt(r.filesNew)} new · ${fmt(r.filesDuplicate)} duplicate · ${fmt(r.parseErrors)} parse errors` });
      refresh();
    }, (err: Error) => {
      setBanner({ ok: false, text: err.message });
      refresh();
    }).finally(() => setRunning(false));
  };

  if (loadErr && !status) return <div style={{ ...card, padding: '14px', color: '#b3201f' }}>Ingestion status unavailable — the custody service did not respond.</div>;
  if (!status) return <div style={{ ...card, padding: '14px', color: 'rgba(25,25,25,.56)' }}>Loading ingestion status…</div>;

  const byType = status.messagesByType;
  const mt54x = MT_TYPES.filter(t => t !== '535').reduce((n, t) => n + (byType[t] ?? 0), 0);
  const total = Object.values(byType).reduce((a, b) => a + b, 0);
  const run54xRow = (label: string, n: number, bold = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', padding: '3px 12px', fontWeight: bold ? 600 : 400 }}>
      <span>{label}</span><span style={{ textAlign: 'right', fontFamily: MONO }}>{fmt(n)}</span>
    </div>
  );
  const lr = status.lastRun;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {banner && (
        <div style={{ padding: '9px 12px', borderRadius: '6px', border: `1px solid ${banner.ok ? '#bfe3d0' : '#f3c2c1'}`, background: banner.ok ? '#e3f5ec' : '#fdecec', color: banner.ok ? '#00703f' : '#b3201f', fontWeight: 500 }}>
          {banner.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '12px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={card}>
            <div style={sectionTitle}>Archive</div>
            <div style={{ padding: '6px 0' }}>
              {kv('Archive root', status.archiveRoot)}
              {kv('Statements', `${fmt(status.statements)} (${fmt(status.effectiveStatements)} effective)`)}
              {kv('Confirmations', fmt(status.confirmations))}
              {kv('Unmatched cancellations', fmt(status.unmatchedCancellations))}
            </div>
          </div>
          <div style={card}>
            <div style={sectionTitle}>Files by type</div>
            <div style={{ padding: '6px 0' }}>
              {run54xRow('MT535', byType['535'] ?? 0)}
              {run54xRow('MT544', byType['544'] ?? 0)}
              {run54xRow('MT545', byType['545'] ?? 0)}
              {run54xRow('MT546', byType['546'] ?? 0)}
              {run54xRow('MT547', byType['547'] ?? 0)}
              <div style={{ borderTop: '1px solid #f3f4f6', margin: '4px 0' }} />
              {run54xRow('MT54x subtotal', mt54x)}
              {run54xRow('Total', total, true)}
            </div>
          </div>
          <div style={card}>
            <div style={sectionTitle}>Parse errors ({status.errors.length})</div>
            {status.errors.length === 0
              ? <div style={{ padding: '8px 12px', color: 'rgba(25,25,25,.56)' }}>None — every file parsed.</div>
              : <div style={{ padding: '6px 0', maxHeight: '200px', overflowY: 'auto' }}>
                  {status.errors.map((e, i) => (
                    <Fragment key={i}>
                      <div style={{ padding: '3px 12px', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontFamily: MONO, fontSize: '11px' }}>{e.sourceFile}</span>
                        <span style={{ color: '#b3201f', fontSize: '11px' }}>{e.error}</span>
                      </div>
                    </Fragment>
                  ))}
                </div>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={card}>
            <div style={sectionTitle}>Last run</div>
            {lr === null
              ? <div style={{ padding: '8px 12px', color: 'rgba(25,25,25,.56)' }}>No ingest runs yet.</div>
              : <div style={{ padding: '6px 0' }}>
                  {kv('Run id', `#${lr.runId}`)}
                  {kv('Started', lr.startedAt)}
                  {kv('Finished', lr.finishedAt ?? '—')}
                  {kv('Duration', lr.durationMs === null ? '—' : `${fmt(lr.durationMs)} ms`)}
                  {kv('Files seen', fmt(lr.filesSeen))}
                  {kv('New', fmt(lr.filesNew))}
                  {kv('Duplicate', fmt(lr.filesDuplicate))}
                  {kv('Parse errors', fmt(lr.parseErrors))}
                  {kv('Triggered by', lr.triggeredBy)}
                </div>}
          </div>
          <div style={{ ...card, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div onClick={() => !running && !status.runInProgress && run()}
                style={{ padding: '7px 16px', background: running || status.runInProgress ? '#7fa8cc' : '#005daa', color: '#fff', borderRadius: '6px', fontWeight: 600, cursor: running || status.runInProgress ? 'default' : 'pointer' }}>
                {running || status.runInProgress ? 'Running…' : 'Run ingest'}
              </div>
              {(running || status.runInProgress) && <span style={{ fontSize: '11px', color: 'rgba(25,25,25,.56)' }}>An ingest run is in progress; only one can run at a time.</span>}
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(25,25,25,.56)', textWrap: 'pretty' }}>
              Incremental: unchanged files are skipped, changed files at the same path are rejected. Replaces Portfolio Viewer Admin → Reload archive. Users are not managed here (no login).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
