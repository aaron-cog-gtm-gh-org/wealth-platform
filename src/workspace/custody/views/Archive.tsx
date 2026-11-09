import { useState } from 'react';
import { Notices, Panel, errorMessage } from '../../ui';
import { custodyApi } from '../api';
import type { ArchiveStatus } from '../api';
import { count, custodyTimestamp } from '../model';
import { LoadState, useLoad } from '../shared';

export function ArchiveStats({ status }: { status: ArchiveStatus }) {
  return (
    <dl className="cu-stats">
      <div className="cu-stat"><dt>MT535 statements on file</dt><dd>{count(status.mt535Count)}</dd></div>
      <div className="cu-stat"><dt>MT54x confirmations on file</dt><dd>{count(status.mt54xCount)}</dd></div>
      <div className="cu-stat"><dt>Statements loaded</dt><dd>{count(status.statements)}</dd></div>
      <div className="cu-stat"><dt>Confirmations loaded</dt><dd>{count(status.confirmations)}</dd></div>
      <div className={`cu-stat${status.parseErrors > 0 ? ' cu-stat--bad' : ''}`}><dt>Parse errors</dt><dd>{count(status.parseErrors)}</dd></div>
      <div className="cu-stat"><dt>Last loaded</dt><dd>{custodyTimestamp(status.loadedAt)}</dd></div>
      <div className="cu-stat"><dt>Load time</dt><dd>{status.loadMs === null ? '—' : `${count(status.loadMs)} ms`}</dd></div>
      <div className="cu-stat cu-stat--wide"><dt>Archive root</dt><dd>{status.root}</dd></div>
    </dl>
  );
}

export function ArchiveView() {
  const status = useLoad('archive-status', custodyApi.archiveStatus);
  const [current, setCurrent] = useState<ArchiveStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const shown = current ?? (status.state.status === 'ready' ? status.state.data : null);

  const reload = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await custodyApi.reloadArchive();
      setCurrent(next);
      setSuccess(`Archive reloaded: ${count(next.statements)} statements and ${count(next.confirmations)} confirmations, ${count(next.parseErrors)} parse errors.`);
    } catch (e) {
      setError('The archive could not be reloaded: ' + errorMessage(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Panel title="Archive" titleId="cu-archive-title">
      <LoadState state={status.state} what="archive status" />
      {shown && <ArchiveStats status={shown} />}
      <div className="ws-pad ws-form">
        <Notices error={error} success={success} />
        {confirming ? (
          <div className="ws-notice ws-notice--info" role="group" aria-labelledby="cu-reload-q">
            <p id="cu-reload-q" style={{ margin: '0 0 8px' }}>Reload re-reads every custodian file and rebuilds statements and confirmations. Saved recon notes are kept.</p>
            <div className="ws-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="ws-btn ws-btn--primary" onClick={reload} disabled={busy} autoFocus>{busy ? 'Reloading archive…' : 'Reload now'}</button>
              <button type="button" className="ws-btn ws-btn--secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="ws-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="ws-btn ws-btn--secondary" onClick={() => { setConfirming(true); setSuccess(null); setError(null); }} disabled={!shown}>Reload archive</button>
          </div>
        )}
      </div>
    </Panel>
  );
}
