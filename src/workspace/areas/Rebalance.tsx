import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { RebalancePreview } from '../api';
import { useWorkspace } from '../context';
import { signedWeight, weight } from '../format';
import { errorMessage, Notices, Panel, StatusPill, useAction } from '../ui';

const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const TOLERANCE = 1;
const fieldId = (cls: string) => 'ws-target-' + cls.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function RebalanceArea() {
  const { data, reload } = useWorkspace();
  const saved = data.allocations;
  const toDraft = () => Object.fromEntries(saved.map(a => [a.assetClass, String(a.targetWeight)]));
  const [draft, setDraft] = useState<Record<string, string>>(toDraft);
  const [editing, setEditing] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RebalancePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const action = useAction(reload);

  useEffect(() => setDraft(toDraft()), [saved]);

  const parsed = saved.map(a => ({ assetClass: a.assetClass, raw: (draft[a.assetClass] ?? '').trim() }));
  const allValid = parsed.every(p => NUMBER_RE.test(p.raw) && Number(p.raw) >= 0 && Number(p.raw) <= 100);
  const total = parsed.reduce((s, p) => s + (Number(p.raw) || 0), 0);
  const totalOk = Math.abs(total - 100) < 1e-9;
  const dirty = saved.some(a => Number(draft[a.assetClass]) !== a.targetWeight || (draft[a.assetClass] ?? '').trim() === '');

  const edit = (cls: string, v: string) => { setDraft(d => ({ ...d, [cls]: v })); setFieldError(null); action.clear(); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const blank = parsed.find(p => !p.raw);
    if (blank) { setFieldError(`Enter a target weight for ${blank.assetClass}. Every asset class needs a target.`); return; }
    const nan = parsed.find(p => !NUMBER_RE.test(p.raw));
    if (nan) { setFieldError(`Target weight for ${nan.assetClass} must be a number from 0 to 100.`); return; }
    if (!dirty) { setFieldError('No changes to save. Edit a target weight first.'); return; }
    const body = parsed.map(p => ({ assetClass: p.assetClass, targetWeight: Number(p.raw) }));
    const ok = await action.run(() => api.saveAllocations(body), () => 'Target weights saved: ' + body.map(b => `${b.assetClass} ${weight(b.targetWeight)}`).join(', ') + '.');
    if (ok) { setPreview(null); setPreviewError(null); setEditing(false); }
  };

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    action.clear();
    try {
      setPreview(await api.previewRebalance());
      await reload().catch(() => undefined);
    } catch (e) {
      setPreview(null);
      setPreviewError(errorMessage(e));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="ws-stack">
      <Panel title="Target allocation" titleId="ws-alloc-title">
        <form className="ws-form" onSubmit={save} noValidate aria-labelledby="ws-alloc-title">
          <div className="ws-table-wrap">
            <table className="ws-table">
              <caption className="ws-sr">Current and target weights by asset class</caption>
              <thead>
                <tr>
                  <th scope="col">Asset class</th>
                  <th scope="col" className="ws-num">Current weight</th>
                  <th scope="col" className="ws-num">Saved target</th>
                  {editing && <th scope="col">New target weight (%)</th>}
                  <th scope="col" className="ws-num">Drift (current − target)</th>
                </tr>
              </thead>
              <tbody>
                {saved.map(a => {
                  const raw = draft[a.assetClass] ?? '';
                  const invalid = !NUMBER_RE.test(raw.trim()) || Number(raw) < 0 || Number(raw) > 100;
                  const drift = a.currentWeight - a.targetWeight;
                  return (
                    <tr key={a.assetClass}>
                      <th scope="row">{a.assetClass}</th>
                      <td className="ws-num">{weight(a.currentWeight)}</td>
                      <td className="ws-num">{weight(a.targetWeight)}</td>
                      {editing && <td>
                        <label htmlFor={fieldId(a.assetClass)} className="ws-sr">Target weight for {a.assetClass} (%)</label>
                        <input id={fieldId(a.assetClass)} className="ws-input-weight" inputMode="decimal" value={raw} aria-invalid={invalid || undefined} onChange={e => edit(a.assetClass, e.target.value)} />
                      </td>}
                      <td className={`ws-num ${Math.abs(drift) >= 1 ? 'ws-warn' : 'ws-muted'}`}>{signedWeight(drift)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="ws-num">{weight(saved.reduce((s, a) => s + a.currentWeight, 0))}</td>
                  <td className="ws-num">{weight(saved.reduce((s, a) => s + a.targetWeight, 0))}</td>
                  {editing && <td><output aria-label="New target total" className={totalOk && allValid ? 'ws-ok' : 'ws-bad'}>{weight(total)}{totalOk ? '' : ' (must total exactly 100%)'}</output></td>}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="ws-pad">
            {fieldError && <div role="alert" className="ws-notice ws-notice--error">{fieldError}</div>}
            <Notices error={action.error} success={action.success} />
            <div className="ws-actions">
              {editing ? (
                <>
                  <button type="button" className="ws-btn ws-btn--secondary" disabled={action.busy} onClick={() => { setDraft(toDraft()); setFieldError(null); action.clear(); setEditing(false); }}>Cancel</button>
                  <button type="submit" className="ws-btn ws-btn--primary" disabled={action.busy}>{action.busy ? 'Saving targets…' : 'Save targets'}</button>
                </>
              ) : (
                <button type="button" className="ws-btn ws-btn--primary" onClick={() => { setDraft(toDraft()); action.clear(); setEditing(true); }}>Edit targets</button>
              )}
            </div>
          </div>
        </form>
      </Panel>

      <Panel
        title="Rebalance preview"
        titleId="ws-preview-title"
        actions={<button type="button" className="ws-btn ws-btn--primary ws-btn--sm" onClick={runPreview} disabled={previewing || editing}>{previewing ? 'Previewing…' : 'Preview rebalance'}</button>}
      >
        <div className="ws-pad">
          <p className="ws-hint">A preview compares saved targets with current weights. It doesn’t place orders or move cash.{editing ? ' Save or cancel target edits to preview.' : ''}</p>
          {previewError && <div role="alert" className="ws-notice ws-notice--error">{previewError}</div>}
          {!preview && !previewError && <p className="ws-muted">No preview yet. Choose Preview rebalance to see drift by asset class.</p>}
        </div>
        {preview && (
          <>
            <div className="ws-pad-x">
              <div role="status" className="ws-notice ws-notice--info">
                Preview status: <StatusPill status={preview.status} /> {preview.status === 'Ready' ? 'Drift exceeds tolerance for at least one asset class.' : 'All asset classes are within tolerance.'} No trades were placed.
              </div>
            </div>
            <div className="ws-table-wrap">
              <table className="ws-table">
                <caption className="ws-sr">Rebalance preview by asset class</caption>
                <thead>
                  <tr>
                    <th scope="col">Asset class</th>
                    <th scope="col" className="ws-num">Current weight</th>
                    <th scope="col" className="ws-num">Target weight</th>
                    <th scope="col" className="ws-num">Drift (current − target)</th>
                    <th scope="col">Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.trades.map(t => {
                    const drift = Number(t.currentWeight) - Number(t.targetWeight);
                    const flagged = Math.abs(drift) >= TOLERANCE;
                    return (
                      <tr key={t.assetClass}>
                        <th scope="row">{t.assetClass}</th>
                        <td className="ws-num">{weight(Number(t.currentWeight))}</td>
                        <td className="ws-num">{weight(Number(t.targetWeight))}</td>
                        <td className={`ws-num ws-strong ${flagged ? 'ws-warn' : ''}`}>{signedWeight(drift)}</td>
                        <td>{flagged ? <><StatusPill status="Proposed change" /> {drift > 0 ? 'Overweight' : 'Underweight'}</> : <StatusPill status="Within tolerance" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
