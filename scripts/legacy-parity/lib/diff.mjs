// Pure diff + classification logic for legacy-parity (no I/O). Inputs are golden-shaped snapshots
// (see capture.mjs); outputs are flat diff records that expected-divergences.json rules match against.
import { mtType } from './normalize.mjs';

export const DEFAULT_TOLERANCE = 0.005; // PV renders money at 2 dp; anything inside half a penny is display rounding

const stripZeros = (v) => (v === null || v === undefined ? v : String(v).replace(/^0+(?=\d)/, ''));

const FIELDS = {
  accounts: ['acctNo', 'clientName', 'safeCode', 'statementDates'],
  clients: ['clientRef', 'name', 'status', 'adviserName', 'accountCount'],
  client: ['clientRef', 'name', 'status', 'adviserName'],
  clientAccounts: ['acctType', 'baseCcy', 'safeCode', 'status', 'openDate', 'closeDate'],
  holdingLines: ['instrument', 'qty', 'price', 'ccy', 'mktVal', 'mktValGbp'],
  settlementRows: ['tradeDate', 'settleDate', 'mtType', 'direction', 'isin', 'instrument', 'qty', 'amount', 'ccy'],
  positionRows: ['instrument', 'prevQty', 'netSettled', 'expected', 'stmtQty', 'diff', 'status', 'note', 'updatedBy', 'updatedAt'],
  checkAllRows: ['acctNo', 'clientName', 'breaks', 'hasPreviousStatement'],
  archive: ['mt535Count', 'mt54xCount', 'statements', 'confirmations', 'parseErrors'],
};

const CANON = { safeCode: stripZeros, mtType };

function valuesEqual(field, a, b, tol) {
  const canon = CANON[field];
  const x = canon ? canon(a) : a;
  const y = canon ? canon(b) : b;
  if (typeof x === 'number' && typeof y === 'number') return Math.abs(x - y) <= tol + 1e-9;
  if (Array.isArray(x) || Array.isArray(y)) return JSON.stringify(x) === JSON.stringify(y);
  return (x ?? null) === (y ?? null);
}

class Differ {
  constructor(tolerance) { this.tol = tolerance; this.diffs = []; }

  push(rec) { this.diffs.push(rec); }

  fields(base, fields, legacy, api) {
    for (const field of fields) {
      if (api && !(field in api) && legacy[field] !== null && legacy[field] !== undefined) {
        this.push({ ...base, kind: 'field-missing', field, legacy: legacy[field], api: null });
      } else if (!valuesEqual(field, legacy[field], api?.[field], this.tol)) {
        this.push({ ...base, kind: 'changed', field, legacy: legacy[field] ?? null, api: api?.[field] ?? null });
      }
    }
  }

  /** Keyed collection compare: legacy-only => missing, api-only => added, both => field compare. */
  rows(base, keyOf, fields, legacyRows, apiRows) {
    const index = (rows) => {
      const m = new Map();
      for (const r of rows ?? []) {
        let k = keyOf(r); let n = 2;
        while (m.has(k)) { k = `${keyOf(r)}#${n}`; n += 1; }
        m.set(k, r);
      }
      return m;
    };
    const L = index(legacyRows); const A = index(apiRows);
    for (const [key, l] of L) {
      const a = A.get(key);
      if (!a) this.push({ ...base, kind: 'missing', key, legacy: l, api: null });
      else this.fields({ ...base, key }, fields, l, a);
    }
    for (const [key, a] of A) if (!L.has(key)) this.push({ ...base, kind: 'added', key, legacy: null, api: a });
  }

  scalar(base, field, legacy, api) {
    if (!valuesEqual(field, legacy, api, this.tol)) this.push({ ...base, kind: 'changed', field, legacy: legacy ?? null, api: api ?? null });
  }
}

const byKey = (list, keyOf) => new Map((list ?? []).map((x) => [keyOf(x), x]));

/** Compares a legacy golden snapshot to an API snapshot of the same shape; returns flat diff records. */
export function diffSnapshots(legacy, api, { tolerance = DEFAULT_TOLERANCE } = {}) {
  const d = new Differ(tolerance);

  d.fields({ dataset: 'archive' }, FIELDS.archive, legacy.archive ?? {}, api.archive ?? {});
  d.scalar({ dataset: 'statementDates' }, 'dates', legacy.statementDates, api.statementDates);
  d.rows({ dataset: 'accounts' }, (a) => a.acctId, FIELDS.accounts, legacy.accounts, api.accounts);

  const apiSearch = byKey(api.clientSearch, (s) => s.q);
  for (const s of legacy.clientSearch ?? []) {
    const a = apiSearch.get(s.q);
    const base = { dataset: 'clientSearch', q: s.q };
    if (!a) { d.push({ ...base, kind: 'not-captured', legacy: s.clients.length, api: null }); continue; }
    d.rows(base, (c) => c.clientId, FIELDS.clients, s.clients, a.clients);
  }

  const apiSummaries = byKey(api.clientSummaries, (s) => s.client.clientId);
  for (const s of legacy.clientSummaries ?? []) {
    const clientId = s.client.clientId;
    const a = apiSummaries.get(clientId);
    const base = { dataset: 'clientSummaries', clientId };
    if (!a) { d.push({ ...base, kind: 'not-captured', legacy: s.client.name, api: null }); continue; }
    d.fields(base, FIELDS.client, s.client, a.client);
    d.rows(base, (x) => x.acctNo, FIELDS.clientAccounts, s.accounts, a.accounts);
  }

  const apiHoldings = byKey(api.holdings, (h) => `${h.acctId}|${h.statementDate}`);
  for (const h of legacy.holdings ?? []) {
    const a = apiHoldings.get(`${h.acctId}|${h.statementDate}`);
    const base = { dataset: 'holdings', acctId: h.acctId, date: h.statementDate };
    if (!a) { d.push({ ...base, kind: 'not-captured', legacy: h.lines.length, api: null }); continue; }
    d.scalar(base, 'message', h.message, a.message);
    d.scalar(base, 'totalGbp', h.totalGbp, a.totalGbp);
    d.rows(base, (l) => l.isin, FIELDS.holdingLines, h.lines, a.lines);
  }

  const apiSettlements = byKey(api.settlements, (s) => s.acctId);
  for (const s of legacy.settlements ?? []) {
    const a = apiSettlements.get(s.acctId);
    const base = { dataset: 'settlements', acctId: s.acctId };
    if (!a) { d.push({ ...base, kind: 'not-captured', legacy: s.settlements.length, api: null }); continue; }
    d.rows(base, (r) => r.seme, FIELDS.settlementRows, s.settlements, a.settlements);
  }

  const apiChecks = byKey(api.positionChecks, (p) => `${p.acctId}|${p.statementDate}`);
  for (const p of legacy.positionChecks ?? []) {
    const a = apiChecks.get(`${p.acctId}|${p.statementDate}`);
    const base = { dataset: 'positionChecks', acctId: p.acctId, date: p.statementDate };
    if (!a) { d.push({ ...base, kind: 'not-captured', legacy: p.rows.length, api: null }); continue; }
    d.scalar(base, 'message', p.message, a.message);
    d.rows(base, (r) => r.isin, FIELDS.positionRows, p.rows, a.rows);
  }

  const apiCheckAll = byKey(api.checkAll, (c) => c.statementDate);
  for (const c of legacy.checkAll ?? []) {
    const a = apiCheckAll.get(c.statementDate);
    const base = { dataset: 'checkAll', date: c.statementDate };
    if (!a) { d.push({ ...base, kind: 'not-captured', legacy: c.accounts.length, api: null }); continue; }
    d.rows(base, (r) => r.acctId, FIELDS.checkAllRows, c.accounts, a.accounts);
  }

  for (const r of d.diffs) if (r.dataset === 'checkAll' && r.key !== undefined) r.acctId = r.key;
  return d.diffs;
}

const MATCH_KEYS = ['dataset', 'kind', 'acctId', 'clientId', 'date', 'q', 'key', 'field', 'legacy', 'api'];

function ruleMatches(rule, rec) {
  for (const k of MATCH_KEYS) {
    if (!(k in rule)) continue;
    const want = rule[k]; const got = rec[k];
    if (typeof want === 'object' && want !== null) { if (JSON.stringify(want) !== JSON.stringify(got)) return false; }
    else if (String(want) !== String(got)) return false;
  }
  if ('delta' in rule) {
    if (typeof rec.legacy !== 'number' || typeof rec.api !== 'number') return false;
    if (Math.abs(rec.api - rec.legacy - rule.delta) > 1e-9) return false;
  }
  return true;
}

/**
 * Tags each diff with the divergence it is explained by (or null) and reports which expected
 * divergences were never observed (i.e. the API still behaves like PV for that case).
 */
export function classify(diffs, expected) {
  const divergences = expected.divergences ?? [];
  const hits = new Map(divergences.flatMap((dv) => dv.expect.map((_, i) => [`${dv.id}:${i}`, 0])));
  const classified = diffs.map((rec) => {
    for (const dv of divergences) {
      const i = dv.expect.findIndex((rule) => ruleMatches(rule, rec));
      if (i >= 0) { hits.set(`${dv.id}:${i}`, hits.get(`${dv.id}:${i}`) + 1); return { ...rec, divergence: dv.id }; }
    }
    return { ...rec, divergence: null };
  });
  const notObserved = divergences.flatMap((dv) => dv.expect
    .map((rule, i) => ({ divergence: dv.id, rule, hits: hits.get(`${dv.id}:${i}`) }))
    .filter((x) => x.hits === 0));
  const byDivergence = Object.fromEntries(divergences.map((dv) => [dv.id, classified.filter((r) => r.divergence === dv.id).length]));
  const unexplained = classified.filter((r) => r.divergence === null);
  return { classified, unexplained, notObserved, byDivergence };
}

export function summarize(result) {
  const byDataset = {};
  for (const r of result.classified) {
    const s = (byDataset[r.dataset] ??= { total: 0, expected: 0, unexplained: 0 });
    s.total += 1;
    if (r.divergence) s.expected += 1; else s.unexplained += 1;
  }
  return {
    totalDiffs: result.classified.length,
    expectedDiffs: result.classified.length - result.unexplained.length,
    unexplainedDiffs: result.unexplained.length,
    notObservedRules: result.notObserved.length,
    byDivergence: result.byDivergence,
    byDataset,
  };
}

const fmt = (v) => {
  if (v === null || v === undefined) return '–';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return (s.length > 120 ? `${s.slice(0, 117)}...` : s).replace(/\|/g, '\\|');
};
const where = (r) => ['acctId', 'clientId', 'date', 'q', 'key']
  .filter((k) => r[k] !== undefined).map((k) => `${k}=${r[k] === '' ? "''" : r[k]}`).join(' ');

export function renderMarkdown(report, expected, { maxRows = 200 } = {}) {
  const s = report.summary;
  const out = [];
  out.push('# Legacy parity report', '');
  out.push(`- Golden: \`${report.golden}\` (${report.goldenFormat})`);
  out.push(`- API: \`${report.api}\``);
  out.push(`- Generated: ${report.generatedAt}`);
  out.push(`- Verdict: **${s.unexplainedDiffs === 0 ? 'PASS' : 'FAIL'}** — ${s.totalDiffs} diffs, ${s.expectedDiffs} expected, ${s.unexplainedDiffs} unexplained, ${s.notObservedRules} expected rules not observed`, '');
  out.push('## Expected divergences', '', '| ID | Diffs | Description |', '| --- | --- | --- |');
  for (const dv of expected.divergences ?? []) out.push(`| ${dv.id} | ${s.byDivergence[dv.id] ?? 0} | ${fmt(dv.title)} |`);
  out.push('', '## By dataset', '', '| Dataset | Total | Expected | Unexplained |', '| --- | --- | --- | --- |');
  for (const [k, v] of Object.entries(s.byDataset)) out.push(`| ${k} | ${v.total} | ${v.expected} | ${v.unexplained} |`);
  const table = (title, rows) => {
    out.push('', `## ${title}`, '');
    if (!rows.length) { out.push('None.'); return; }
    out.push('| Dataset | Where | Kind | Field | Legacy (PV) | API | Divergence |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const r of rows.slice(0, maxRows)) out.push(`| ${r.dataset} | ${where(r)} | ${r.kind} | ${r.field ?? ''} | ${fmt(r.legacy)} | ${fmt(r.api)} | ${r.divergence ?? '**unexplained**'} |`);
    if (rows.length > maxRows) out.push('', `…${rows.length - maxRows} more in report.json`);
  };
  table('Unexplained diffs', report.diffs.filter((r) => !r.divergence));
  table('Expected diffs', report.diffs.filter((r) => r.divergence));
  out.push('', '## Expected rules not observed', '');
  if (!report.notObserved.length) out.push('None.');
  for (const n of report.notObserved) out.push(`- ${n.divergence}: \`${JSON.stringify(n.rule)}\``);
  return `${out.join('\n')}\n`;
}
