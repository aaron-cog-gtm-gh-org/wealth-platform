import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { Transfer } from '../api';
import { useWorkspace } from '../context';
import { money } from '../format';
import { availableCash } from '../model';
import { EmptyRow, Notices, Panel, SortHeader, StatusPill, useAction, useSort } from '../ui';

const REF_MAX = 80;
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

interface Draft { fromAccountId: string; toAccountId: string; amount: string; reference: string }
const EMPTY: Draft = { fromAccountId: '', toAccountId: '', amount: '', reference: '' };

function validate(d: Draft): string | null {
  if (!d.fromAccountId) return 'Choose the account to move money from.';
  if (!d.toAccountId) return 'Choose the account to move money to.';
  if (d.fromAccountId === d.toAccountId) return 'Choose two different accounts.';
  const a = d.amount.trim().replace(/,/g, '');
  if (!a) return 'Enter an amount. The amount must be greater than 0.';
  if (!/^-?\d*\.?\d+$/.test(a)) return 'Amount must be a number greater than 0, for example 1000.00.';
  if (Number(a) <= 0) return 'Amount must be greater than 0.';
  if (!AMOUNT_RE.test(a)) return 'Amount can have at most 2 decimal places.';
  if (d.reference.length > REF_MAX) return `Reference must be ${REF_MAX} characters or fewer.`;
  return null;
}

export function MoneyArea() {
  return (
    <div className="ws-split ws-split--ticket">
      <TransferForm />
      <TransferHistory />
    </div>
  );
}

function TransferForm() {
  const { data, lk, reload } = useWorkspace();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const action = useAction(reload);
  const ids = { from: useId(), to: useId(), amount: useId(), ref: useId(), refHint: useId(), amountHint: useId() };

  const cad = data.accounts.filter(a => a.currency === 'CAD');
  const from = lk.accounts.get(draft.fromAccountId);
  const toChoices = cad.filter(a => from && a.clientId === from.clientId && a.id !== from.id);
  const amount = Number(draft.amount.trim().replace(/,/g, ''));
  const set = (patch: Partial<Draft>) => { setDraft(d => ({ ...d, ...patch })); setFieldError(null); action.clear(); };

  const review = (e: FormEvent) => {
    e.preventDefault();
    const err = validate(draft);
    if (err) { setFieldError(err); return; }
    setFieldError(null);
    action.clear();
    setStep('review');
  };

  const confirm = async () => {
    const body = { fromAccountId: draft.fromAccountId, toAccountId: draft.toAccountId, amount, reference: draft.reference.trim() };
    const ok = await action.run(() => api.createTransfer(body), t =>
      `Transfer${t?.id ? ' ' + t.id : ''} of ${money(amount, 'CAD')} from ${lk.accountLabel(body.fromAccountId)} to ${lk.accountLabel(body.toAccountId)}. Status: ${t?.status ?? 'Completed'}.${t?.reference ? ` Reference: ${t.reference}.` : ''}`);
    if (ok) { setDraft(EMPTY); setStep('edit'); }
  };

  if (step === 'review' && from) {
    const to = lk.accounts.get(draft.toAccountId);
    return (
      <Panel title="Review transfer" titleId="ws-transfer-title">
        <div className="ws-form ws-pad">
          <dl className="ws-dl" aria-label="Transfer details">
            <dt>Client</dt><dd>{lk.clients.get(from.clientId)?.name}</dd>
            <dt>From</dt><dd>{lk.accountLabel(from.id)}</dd>
            <dt>To</dt><dd>{to ? lk.accountLabel(to.id) : draft.toAccountId}</dd>
            <dt>Amount</dt><dd className="ws-strong">{money(amount, 'CAD')}</dd>
            <dt>Reference</dt><dd>{draft.reference.trim() || 'None'}</dd>
            <dt>Available before</dt><dd>{money(availableCash(data, from), 'CAD')}</dd>
          </dl>
          <p className="ws-hint">Nothing moves until you confirm. Available cash is checked again when you confirm.</p>
          <Notices error={action.error} success={null} />
          <div className="ws-actions">
            <button type="button" className="ws-btn ws-btn--secondary" onClick={() => { setStep('edit'); action.clear(); }} disabled={action.busy}>Edit transfer</button>
            <button type="button" className="ws-btn ws-btn--primary" onClick={confirm} disabled={action.busy}>{action.busy ? 'Transferring…' : 'Confirm transfer'}</button>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="New transfer" titleId="ws-transfer-title">
      <form className="ws-form ws-pad" onSubmit={review} noValidate aria-labelledby="ws-transfer-title">
        <div className="ws-field">
          <label htmlFor={ids.from}>From account</label>
          <select id={ids.from} value={draft.fromAccountId} onChange={e => {
            const next = lk.accounts.get(e.target.value);
            const keepTo = next && lk.accounts.get(draft.toAccountId)?.clientId === next.clientId && draft.toAccountId !== next.id;
            set({ fromAccountId: e.target.value, toAccountId: keepTo ? draft.toAccountId : '' });
          }}>
            <option value="">Select an account</option>
            {data.clients.map(c => {
              const own = cad.filter(a => a.clientId === c.id);
              return own.length ? (
                <optgroup key={c.id} label={c.name}>
                  {own.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id}) · {money(availableCash(data, a), 'CAD')} available</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
        </div>
        <div className="ws-field">
          <label htmlFor={ids.to}>To account</label>
          <select id={ids.to} value={draft.toAccountId} onChange={e => set({ toAccountId: e.target.value })} disabled={!from}>
            <option value="">{from ? 'Select an account' : 'Choose a from account first'}</option>
            {toChoices.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
          </select>
          {from && toChoices.length === 0 && <span className="ws-hint">This client has no other CAD account.</span>}
        </div>
        <div className="ws-field">
          <label htmlFor={ids.amount}>Amount (CAD)</label>
          <input id={ids.amount} inputMode="decimal" value={draft.amount} onChange={e => set({ amount: e.target.value })} aria-describedby={ids.amountHint} />
          <span id={ids.amountHint} className="ws-hint">{from ? `Available ${money(availableCash(data, from), 'CAD')} after open buy orders.` : 'Up to 2 decimal places.'}</span>
        </div>
        <div className="ws-field">
          <label htmlFor={ids.ref}>Reference (optional)</label>
          <input id={ids.ref} value={draft.reference} maxLength={REF_MAX + 20} onChange={e => set({ reference: e.target.value })} aria-describedby={ids.refHint} />
          <span id={ids.refHint} className={`ws-hint${draft.reference.length > REF_MAX ? ' ws-hint--bad' : ''}`}>{draft.reference.length}/{REF_MAX} characters</span>
        </div>
        <p className="ws-hint">Transfers are between CAD accounts owned by the same client. USD accounts aren’t eligible.</p>
        {fieldError && <div role="alert" className="ws-notice ws-notice--error">{fieldError}</div>}
        <Notices error={action.error} success={action.success} />
        <div className="ws-actions">
          <button type="button" className="ws-btn ws-btn--secondary" onClick={() => { setDraft(EMPTY); setFieldError(null); action.clear(); }}>Clear form</button>
          <button type="submit" className="ws-btn ws-btn--primary">Review transfer</button>
        </div>
      </form>
    </Panel>
  );
}

function TransferHistory() {
  const { data, lk } = useWorkspace();
  const [query, setQuery] = useState('');
  const searchId = useId();
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.transfers.filter(t => !q || [t.id, t.reference ?? '', lk.accountLabel(t.fromAccountId), lk.accountLabel(t.toAccountId)].some(v => v.toLowerCase().includes(q)));
  }, [data.transfers, query, lk]);
  const sort = useSort(rows, 'id', {
    id: (t: Transfer) => t.id,
    amount: (t: Transfer) => t.amount,
    status: (t: Transfer) => t.status,
  }, 'descending');

  return (
    <Panel title="Transfers" titleId="ws-transfers-title" actions={<span className="ws-count" aria-live="polite">{rows.length} of {data.transfers.length} transfers</span>}>
      <div className="ws-filters" role="search" aria-label="Filter transfers">
        <div className="ws-field ws-field--grow">
          <label htmlFor={searchId}>Search transfers</label>
          <input id={searchId} type="search" value={query} placeholder="Transfer ID, account or reference" onChange={e => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <caption className="ws-sr">Transfers</caption>
          <thead>
            <tr>
              <SortHeader label="Transfer" k="id" sort={sort} />
              <th scope="col">From</th>
              <th scope="col">To</th>
              <SortHeader label="Amount" k="amount" sort={sort} align="right" />
              <th scope="col">Reference</th>
              <SortHeader label="Status" k="status" sort={sort} />
            </tr>
          </thead>
          <tbody>
            {sort.sorted.map(t => (
              <tr key={t.id}>
                <th scope="row" className="ws-mono">{t.id}</th>
                <td>{lk.accountLabel(t.fromAccountId)}</td>
                <td>{lk.accountLabel(t.toAccountId)}</td>
                <td className="ws-num ws-strong">{money(t.amount, lk.accounts.get(t.fromAccountId)?.currency ?? 'CAD')}</td>
                <td>{t.reference ?? <span className="ws-muted">None</span>}</td>
                <td><StatusPill status={t.status} /></td>
              </tr>
            ))}
            {sort.sorted.length === 0 && <EmptyRow colSpan={6}>{data.transfers.length === 0 ? 'No transfers yet. Completed transfers appear here.' : 'No transfers match this search.'}</EmptyRow>}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
