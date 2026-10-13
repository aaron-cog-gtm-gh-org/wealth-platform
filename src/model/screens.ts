import { CLASS_COLORS } from '../data';
import type { Data } from '../data';
import type { ChangeEvent } from 'react';
import { AMBER as amber, ccyMoney, decMoney, decQuantity, GREEN as green, MUTE as mute, RED as red, dayMonth, dayMonthYear, fmt, money, pct as pc, pill, signedMoney as sgn, signedPts, yearsBetween } from '../format';
import type { PillKind } from '../format';
import type { Period, Rail, Screen, SetUiState, UiState } from '../types';
import { AS_OF, totalSource } from './shell';

export function buildScreens(st: UiState, setState: SetUiState, go: (s: Screen) => void, data: Data) {
  const D = { holdings: data.holdings, total: data.totalValue, accounts: data.accounts, alloc: data.allocation, SRC: data.PRICE_SOURCE, COLORS: CLASS_COLORS, classes: data.ASSET_CLASSES };
  const R = data.raw, HH = R.household, C = HH.primaryClient;
  const isCustody = HH.source?.kind === 'custody';
  const reportingCurrency = HH.source?.reportingCurrency ?? 'CAD';
  const fmtMoney = (amount: number, digits = 0) => isCustody ? ccyMoney(amount, reportingCurrency, 2) : money(amount, digits);
  const totalFmt = fmtMoney(D.total);
  const totalSrc = isCustody
    ? `Sum of ${D.holdings.length} positions across ${D.accounts.length} accounts · custodian statement values as of ${HH.source?.asOf ? dayMonthYear(HH.source.asOf) : 'Not available'}`
    : totalSource(data);
  const goOrders = () => go('orders');
  const goCustodyStatements = () => go('custody-holdings');
  const goActivity = () => go('activity');
  const goMoney = () => go('money');
    // Client 360
    const accounts = D.accounts.map(a => ({ ...a, mvFmt: fmtMoney(a.mv), drift: isCustody ? '—' : a.drift, day: isCustody ? 'Not available' : a.day, dayColor: isCustody ? mute : a.dayColor }));
    const alloc = D.alloc.map(a => { const d = a.a - a.t; return { cls: a.cls, color: a.color, mvFmt: isCustody ? ccyMoney(a.mv, reportingCurrency, 2) : money(a.mv), actual: a.a.toFixed(1) + '%', target: isCustody ? '—' : a.t.toFixed(1) + '%', actualW: (a.a * 100 / 35).toFixed(1) + '%', targetW: isCustody ? null : (a.t * 100 / 35).toFixed(1) + '%', drift: isCustody ? '—' : (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1), driftColor: isCustody ? mute : Math.abs(d) > 2 ? red : Math.abs(d) > 1 ? amber : mute, src: `${D.holdings.filter(h => h.cls === a.cls).length} positions · ${D.SRC[a.cls]}` }; });
    const profileRows: [string, string, string?][] = isCustody
      ? [['Legal name', C.legalName || 'Not available'], ['Client ID', C.id || 'Not available'], ['Born', 'Not available'], ['Tax residency', 'Not available'], ['Occupation', 'Not available'], ['Risk profile', 'Not available'], ['Time horizon', 'Not available'], ['KYC / AML', 'Not available'], ['Suitability', 'Not available'], ['Preferred contact', 'Not available'], ['Power of attorney', 'Not available']]
      : [['Legal name', C.legalName], ['Client ID', C.id], ['Born', `${dayMonthYear(C.dateOfBirth)} (${yearsBetween(C.dateOfBirth, AS_OF)})`], ['Tax residency', C.taxResidency], ['Occupation', C.occupation], ['Risk profile', `${C.riskProfile} · ${C.riskScore}/10`], ['Time horizon', C.timeHorizon], ['KYC / AML', `${C.kycStatus} · next refresh ${dayMonthYear(C.kycNextRefreshDate)}`, green], ['Suitability', 'Signed ' + dayMonthYear(C.suitabilitySignedDate)], ['Preferred contact', C.preferredContact], ['Power of attorney', C.powerOfAttorney]];
    const profile = profileRows.map(([k, v, c]) => ({ k, v, color: c || '#191919' }));
    const household = HH.members.map(x => ({ n: x.name, r: x.relationship, a: x.accounts }));
    const homeAdvisor = isCustody ? HH.advisorName || 'Not available' : 'Aaron Diamond, CFP';
    const homeAdvisorInitials = isCustody
      ? (homeAdvisor === 'Not available' ? '—' : homeAdvisor.trim().split(/\s+/).slice(0, 2).map(name => name[0] ?? '').join('').toUpperCase())
      : 'AD';
    const homeAdvisorReview = isCustody ? 'Not available' : 'Next review Wed 4-Nov-2026, 10:00 · 416-555-0148';
    const homeValuationNote = isCustody
      ? `Custodian statement values · as of ${HH.source?.asOf ? dayMonthYear(HH.source.asOf) : 'Not available'}`
      : 'Includes private investments valued at 30-Jun-2026';
    const PRIORITY = { HIGH: [red, red], MEDIUM: [amber, amber], NORMAL: ['#005daa', mute], LOW: ['#8a94a3', mute] };
    const tasks = HH.tasks.map(x => ({ t: x.title, next: x.nextStep, due: x.due, color: PRIORITY[x.priority][0], dueColor: PRIORITY[x.priority][1] }));
    const comms = HH.communications.map(x => ({ t: x.channel, d: dayMonth(x.date), s: x.summary }));
    const docs = HH.documents.map(x => ({ n: x.title, d: dayMonthYear(x.date) }));

    // Portfolio
    const cls = st.cls;
    const hs = D.holdings.filter(h => cls === 'All' || h.cls === cls);
    const holdCount = hs.length;
    const clsChips = ['All', ...D.classes].map(c => { const a = c === cls; const n = c === 'All' ? D.holdings.length : D.holdings.filter(h => h.cls === c).length; return { label: `${c} ${n}`, onClick: () => setState({ cls: c }), bg: a ? '#005daa' : '#fff', fg: a ? '#fff' : '#191919', border: a ? '#005daa' : '#d5dbe3' }; });
    const holdings = hs.map(h => { const u = h.mv - h.cost; const isB = h.cls === 'Bonds', isA = h.cls === 'Alternatives', isC = h.cls === 'Cash'; return {
      n: h.n, id: h.id, cls: h.cls, color: D.COLORS[h.cls], acct: h.acct,
      qtyFmt: isCustody ? decQuantity(h.qtyDec ?? String(h.qty)) + (isB ? ' face' : '') : isC ? '—' : isB ? fmt(h.qty) + ' face' : isA ? 'paid-in' : fmt(h.qty, h.qty % 1 ? 3 : 0),
      pxFmt: isCustody ? decMoney(h.pxDec ?? String(h.px), h.ccy, 4) : isC ? (h.ccy === 'USD' ? 'FX ' + data.FX : '—') : isB ? h.px.toFixed(2) : isA ? 'NAV ' + h.px.toFixed(3) + 'x' : (h.ccy === 'USD' ? 'US$' : '$') + h.px.toFixed(2),
      mvFmt: fmtMoney(h.mv), wFmt: D.total ? (h.mv / D.total * 100).toFixed(2) + '%' : '—', uFmt: isCustody || isC ? '—' : sgn(u), uColor: u > 0 ? green : u < 0 ? red : mute, dFmt: isCustody ? '—' : h.day ? pc(h.day) : '—', dColor: h.day > 0 ? green : h.day < 0 ? red : mute,
      src: isCustody ? 'Custodian MT535 statement · cost basis not available' : `${isC ? '' : fmt(h.qty, h.qty % 1 ? 3 : 0) + ' × ' + h.px + (h.ccy === 'USD' && !isC ? ' USD × FX ' + data.FX : '') + ' · '}${D.SRC[h.cls]} · cost basis ${money(h.cost)} (ACB)` }; });
    const dayAmt = D.holdings.reduce((s, h) => s + h.mv * h.day / 100, 0);
    const dayChg = isCustody ? 'Day change not available' : pc(dayAmt / D.total * 100) + ' (' + sgn(dayAmt) + ')';
    const ytd = R.performance.periods.find(p => p.code === 'YTD')!;
    const ytdChg = isCustody ? 'Not available' : pc(ytd.portfolioReturnPct);
    const ytdRel = ytd.portfolioReturnPct - ytd.benchmarkReturnPct;
    const altCommitted = R.alternatives.commitments.reduce((s, c) => s + c.commitment, 0), altCalled = R.alternatives.commitments.reduce((s, c) => s + c.called, 0);
    const kpis = (isCustody ? [
      ['Market value', ccyMoney(D.total, reportingCurrency, 2), `${reportingCurrency} · ${D.accounts.length} accounts`, '#191919', totalSrc],
      ['Today', 'Not available', '', mute, 'Not available'],
      ['YTD return (TWR)', 'Not available', '', mute, 'Not available'],
      ['Unrealized gain', 'Not available', '', mute, 'Not available'],
      ['Income, next 90 days', 'Not available', '', mute, 'Not available'],
      ['Unfunded commitments', 'Not available', '', mute, 'Not available'],
    ] : [
      ['Market value', money(D.total), `CAD · ${D.accounts.length} accounts`, '#191919', totalSrc],
      ['Today', sgn(dayAmt), pc(dayAmt / D.total * 100), green, 'Σ position value × day change · listed prices only'],
      ['YTD return (TWR)', ytdChg, `Benchmark ${pc(ytd.benchmarkReturnPct)} · ${(ytdRel >= 0 ? '+' : '−') + Math.abs(ytdRel).toFixed(2)} pts`, green, 'Modified Dietz daily, linked · net of fees · 01-Jan to 12-Oct-2026'],
      ['Unrealized gain', sgn(D.holdings.reduce((s, h) => s + h.mv - h.cost, 0)), 'vs adjusted cost base', green, `Market value − ACB per tax lot · ${HH.taxLots} lots`],
      ['Income, next 90 days', money(HH.income90d), `coupons ${money(HH.coupons90d)} · dividends ${money(HH.dividends90d)}`, '#191919', 'Coupon schedules + declared/estimated dividends'],
      ['Unfunded commitments', money(altCommitted - altCalled), `${R.alternatives.commitments.length} alternative funds`, '#191919', `Committed ${money(altCommitted)} − called ${money(altCalled)}`],
    ]).map(([k, v, sub, color, src]) => ({ k, v, sub, color, src }));
    const per = R.performance.periods.find(p => p.code === st.period) ?? R.performance.periods[0];
    const ps = per.portfolio, bs = per.benchmark, n = ps.length - 1, pr = per.portfolioReturnPct, br = per.benchmarkReturnPct;
    const all = ps.concat(bs); const mn = Math.min(...all, 0), mx = Math.max(...all);
    const path = (arr: number[]) => arr.map((v, i) => (i ? 'L' : 'M') + (i / n * 600).toFixed(1) + ' ' + (160 - (v - mn) / (mx - mn || 1) * 150).toFixed(1)).join(' ');
    const perfPath = path(ps); const benchPath = path(bs); const perfP = pc(pr); const perfB = pc(br);
    const perfStart = dayMonthYear(per.startDate);
    const periods = R.performance.periods.map(p => p.code as Period).map(id => ({ id, onClick: () => setState({ period: id }), bg: id === st.period ? '#fff' : 'transparent', shadow: id === st.period ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }));
    const fees = [...HH.fees.map(f => ({ k: f.label, r: f.rate, v: fmtMoney(f.amount) })), { k: 'Total', r: HH.totalFeeRatePct.toFixed(2) + '% annualized', v: fmtMoney(HH.fees.reduce((s, f) => s + f.amount, 0)) }];

    // Orders
    const ex = st.excluded;
    const T = R.rebalance.trades.map(t => [t.side, t.instrument, t.accountKey, t.quantity, t.value, t.estCost, t.realizedGain, t.route, t.note] as [string, string, string, string, number, number, number, string, string]);
    const active = T.map((_t, i) => !ex[i]);
    const flow = (key: string, side: string) => T.reduce((s, t, i) => s + (active[i] && t[2] === key && t[0] === side ? t[4] : 0), 0);
    const cashPos = D.accounts.map(a => ({ a, cash: data.cashIn(a.key) + flow(a.key, 'SELL'), buys: flow(a.key, 'BUY') }));
    const tight = cashPos.reduce((x, y) => (y.buys - y.cash > x.buys - x.cash ? y : x)); const rrCash = tight.cash, rrBuys = tight.buys;
    const failIdx = T.reduce((last, t, i) => (t[2] === tight.a.key && t[0] === 'BUY' ? i : last), -1);
    const failTicker = D.holdings.find(h => h.n === T[failIdx]?.[1])?.id.split(' · ')[0] ?? T[failIdx]?.[1];
    const cashFail = rrBuys > rrCash;
    const trades = T.map((t, i) => ({ side: t[0], n: t[1], acct: t[2], qty: t[3], valFmt: money(t[4]), costFmt: t[5] ? '$' + t[5].toFixed(2) : 'nil', gainFmt: t[6] ? '+$' + fmt(t[6]) : '—', gainColor: t[6] ? amber : mute, route: t[7], note: (i === failIdx && cashFail) ? 'Fails cash availability in RRSP' : t[8], noteColor: (i === failIdx && cashFail) ? red : mute,
      sideBg: t[0] === 'BUY' ? '#e3f5ec' : '#fdecec', sideFg: t[0] === 'BUY' ? '#00703f' : '#b3201f', opacity: ex[i] ? 0.4 : 1, rowBg: (i === failIdx && cashFail) ? '#fff6f6' : 'transparent',
      toggle: (e?: { preventDefault?: () => void }) => { e && e.preventDefault && e.preventDefault(); setState(s => ({ excluded: { ...s.excluded, [i]: !s.excluded[i] }, approved: false })); }, toggleLabel: ex[i] ? 'Include' : 'Exclude' }));
    const nAct = active.filter(Boolean).length;
    const tradeCountLabel = `${nAct} of ${T.length} included`;
    const cashDetail = cashFail ? `${tight.a.name} ${tight.a.no} short ${money(rrBuys - rrCash)}: buys ${money(rrBuys)} vs cash + sale proceeds ${money(rrCash)}. Exclude the ${failTicker} buy or add a sell.` : `${tight.a.name} ${tight.a.no}: buys ${money(rrBuys)} covered by cash + sale proceeds ${money(rrCash)}.`;
    const checkRows: [string, string, string][] = R.rebalance.checks.map(c => c.status === 'LIVE' ? [c.name, cashFail ? 'fail' : 'pass', cashDetail] : [c.name, c.status.toLowerCase(), c.detail ?? '']);
    const fails = checkRows.filter(c => c[1] === 'fail').length, warns = checkRows.filter(c => c[1] === 'warn').length;
    const checks = checkRows.map(([n, s, d]) => { const p = pill(s === 'pass' ? 'ok' : s === 'warn' ? 'warn' : 'bad'); return { n, d, status: s.toUpperCase(), bg: p[0], fg: p[1] }; });
    const checkSummary = fails ? `${fails} failed · ${warns} warnings` : `All passed · ${warns} warnings`; const checkSummaryColor = fails ? red : green;
    const sells = T.reduce((s, t, i) => s + (active[i] && t[0] === 'SELL' ? t[4] : 0), 0), buys = T.reduce((s, t, i) => s + (active[i] && t[0] === 'BUY' ? t[4] : 0), 0);
    const impact = [['Sells', money(sells)], ['Buys', money(buys)], ['Net cash', sgn(sells - buys), sells - buys >= 0 ? green : red], ['Turnover', (Math.max(sells, buys) / D.total * 100).toFixed(2) + '% of AUA'], ['Est. trading costs', '$' + T.reduce((s, t, i) => s + (active[i] ? t[5] : 0), 0).toFixed(2)], ['Realized gains (taxable)', '$' + fmt(T.reduce((s, t, i) => s + (active[i] ? t[6] : 0), 0)), amber], ['Tracking error vs model', `${R.rebalance.proposal.trackingErrorBeforePct.toFixed(1)}% → ${R.rebalance.proposal.trackingErrorAfterPct.toFixed(1)}%`]].map(([k, v, c]) => ({ k, v, color: c || '#191919' }));
    const driftAfter = R.rebalance.drift.map(x => [x.assetClass, signedPts(x.beforePts), signedPts(x.afterPts)]).map(([cls, b, a]) => ({ cls, before: b + ' pts', after: a + ' pts', beforeColor: mute, afterColor: green }));
    const canApprove = !fails && !st.approved;
    const approveBg = st.approved ? '#e3f5ec' : canApprove ? '#005daa' : '#e5e8ec'; const approveFg = st.approved ? '#00703f' : canApprove ? '#fff' : 'rgba(25,25,25,.45)'; const approveCursor = canApprove ? 'pointer' : 'default';
    const approveLabel = st.approved ? `${nAct} orders sent to routing · 14:48 ET` : fails ? 'Resolve 1 failed check to approve' : `Approve and route ${nAct} orders`;
    const approveNote = st.approved ? 'Fills will book to the ledger as they arrive. Settlement instructions are created automatically (equities T+1, bonds T+1, funds T+2).' : 'Approval requires step-up authentication. Warnings are recorded in the audit trail with your ID.';
    const approve = () => { if (canApprove) setState({ approved: true }); };

    // Alternatives
    const commits = R.alternatives.commitments.map(c => { const acct = data.accountByKey(c.accountKey); return { n: c.fundName, meta: `${acct.shortName} · ${acct.no} · ${c.currency}`, vintage: String(c.vintage), commit: c.commitment, called: c.called, dist: c.distributions, nav: c.nav, navNote: `Manager NAV ${dayMonthYear(c.navDate)} · ${c.navStatus.toLowerCase()}`, navColor: c.navStatus === 'APPROVED' ? green : amber, srcText: `Manager NAV ${dayMonthYear(c.navDate)} (administrator: ${c.administrator}) + calls since − distributions since · entered by ${c.enteredBy}, approved by ${c.approvedBy} ${dayMonthYear(c.approvedDate)}` }; }).map(c => ({ ...c, commitFmt: money(c.commit), calledFmt: money(c.called), calledPct: Math.round(c.called / c.commit * 100) + '%', unfundedFmt: money(c.commit - c.called), distFmt: money(c.dist), navFmt: money(c.nav), dpi: (c.dist / c.called).toFixed(2) + 'x', tvpi: ((c.dist + c.nav) / c.called).toFixed(2) + 'x', src: c.srcText }));
    const altNav = R.alternatives.commitments.reduce((s, c) => s + c.nav, 0), altDist = R.alternatives.commitments.reduce((s, c) => s + c.distributions, 0);
    const altKpis = [['Committed', money(altCommitted), `${commits.length} funds · CAD`], ['Called to date', money(altCalled), (altCalled / altCommitted * 100).toFixed(1) + '% of committed'], ['Unfunded', money(altCommitted - altCalled), ((altCommitted - altCalled) / D.total * 100).toFixed(1) + '% of household AUA'], ['Current value', money(altNav), (R.alternatives.commitments.length ? `as of ${dayMonthYear(R.alternatives.commitments[0].navDate)} NAVs` : 'No NAVs')], ['Distributions received', money(altDist), `DPI ${(altDist / altCalled).toFixed(2)}x`], ['Net TVPI', ((altDist + altNav) / altCalled).toFixed(2) + 'x', `IRR ${HH.altNetIrrPct.toFixed(1)}% since first call`]].map(([k, v, sub]) => ({ k, v, sub, src: 'Commitment register · capital call and distribution notices · manager NAVs' }));
    const calls = R.alternatives.capitalCalls.map(c => [c.due, c.description, money(c.amount), c.status, c.status === 'Estimate' ? 'mute' : 'info']).map(([d, f, a, s, k]) => { const p = pill(k as PillKind); return { d, f, a, s, bg: p[0], fg: p[1] }; });
    const dists = R.alternatives.distributions.map(x => [dayMonthYear(x.date), x.fund, x.type, money(x.amount)]).map(([d, f, t, a]) => ({ d, f, t, a }));

    // Exceptions
    const E = data.settlementExceptions;
    const rows = E.rows.filter(r => st.exCause === 'All' || r.cause === st.exCause);
    const fallbackException = { id: '', age: 0, val: 0, inst: '', side: 'Deliver' as const, acct: '', cpty: '', cause: '', action: '', actionShort: '', why: '', owner: 'Unassigned' };
    const selId = st.exSel ?? E.rows[0]?.id; const sel = E.rows.find(r => r.id === selId) || E.rows[0] || fallbackException;
    const ageC = (a: number) => a >= 5 ? red : a >= 2 ? amber : '#191919';
    const causeChips = ['All', ...E.causes].map(c => { const a = c === st.exCause; const n = c === 'All' ? E.rows.length : E.rows.filter(r => r.cause === c).length; return { label: `${c} ${n}`, onClick: () => setState({ exCause: c }), bg: a ? '#005daa' : '#fff', fg: a ? '#fff' : '#191919', border: a ? '#005daa' : '#d5dbe3' }; });
    const exRows = rows.map(r => ({ ...r, age: r.age + 'd', ageColor: ageC(r.age), valFmt: money(r.val), ownerColor: r.owner === 'Unassigned' ? red : '#191919', bg: r.id === sel.id ? '#eaf1fa' : 'transparent', onClick: () => setState({ exSel: r.id }) }));
    const totV = E.rows.reduce((s, r) => s + r.val, 0);
    const exKpis = [['Open exceptions', String(E.rows.length), `${E.queue.openedToday} opened today`, '#191919'], ['Value at risk', money(totV), 'gross settlement value', '#191919'], ['Aged 5+ days', String(E.rows.filter(r => r.age >= 5).length), `buy-in risk from day ${E.queue.buyInDay} (CSDR/CDS)`, red], ['Unassigned', String(E.rows.filter(r => r.owner === 'Unassigned').length), `auto-assign at ${E.queue.autoAssignTime} ET`, amber], ['Cleared today', String(E.queue.clearedToday), `median ${Math.floor(E.queue.medianResolveMinutes / 60)}h ${E.queue.medianResolveMinutes % 60}m to resolve`, green]].map(([k, v, sub, color]) => ({ k, v, sub, color }));
    const exSel = { ...sel, ageColor: ageC(sel.age), ageLong: sel.age === 0 ? 'Opened today' : `Open ${sel.age} business day${sel.age > 1 ? 's' : ''}`,
      fields: [['Value', money(sel.val)], ['Instrument', sel.inst], ['Direction', sel.side], ['Account', sel.acct], ['Counterparty', sel.cpty], ['Intended settle', sel.age ? `${sel.age}d ago` : 'Today'], ['Owner', sel.owner], ['Linked trade', 'TR-' + sel.id.slice(3) + '-01']].map(([k, v]) => ({ k, v })),
      timeline: [['Fail reported by ' + sel.cpty, sel.age ? `${sel.age}d ago · 09:12 ET` : 'Today · 09:12 ET', red], ['Exception created, cause classified', 'auto · rule SET-FAIL-04', '#8a94a3'], [sel.owner === 'Unassigned' ? 'Awaiting owner' : 'Assigned to ' + sel.owner, sel.owner === 'Unassigned' ? `auto-assign ${E.queue.autoAssignTime} ET` : 'Wealth Ops – Toronto', sel.owner === 'Unassigned' ? amber : '#8a94a3'], ['Next: ' + sel.actionShort, 'suggested', '#005daa']].map(([t, d, color]) => ({ t, d, color })) };

    // Client home / activity
    const recent = R.activity.feed.map(x => [dayMonth(x.date), x.description, x.account, x.amount] as [string, string, string, number]).map(([date, desc, acct, amt]) => ({ date, desc, acct, amtFmt: sgn(amt, 2), amtColor: amt > 0 ? green : '#191919' }));
    const mk = (names: string[], at: number, dates: string[]) => ({ bars: names.map((_, i) => ({ c: i < at ? '#005daa' : i === at ? '#ffd200' : '#e5e8ec' })), steps: names.map((n, i) => ({ n, d: dates[i] || '', c: i <= at ? '#005daa' : '#cfd5dd', fill: i < at ? '#005daa' : i === at ? '#ffd200' : '#fff', w: i === at ? 600 : 400, fg: i > at ? 'rgba(25,25,25,.5)' : '#191919' })) });
    const pending = R.activity.pending.map(p => ({ t: p.title, a: p.amount == null ? '' : money(p.amount, 2), s: p.status, eta: p.eta, ...mk(p.steps.map(x => x.name), p.currentStep, p.steps.map(x => x.time ?? '')) }));
    const TXN_PILL: Record<string, PillKind> = { 'Awaiting price': 'warn', 'In approval': 'warn', Settled: 'ok', 'Settlement failed': 'bad', Scheduled: 'info' };
    const txns = R.activity.transactions.map(x => [dayMonth(x.tradeDate), dayMonth(x.settleDate), x.description, x.detail, x.accountKey, x.amount, x.status, TXN_PILL[x.status] ?? 'mute', x.nextStep ?? ''] as [string, string, string, string, string, number, string, PillKind, string]).map(([td, sd, desc, det, acct, amt, status, k, next]) => { const p = pill(k as PillKind); return { td, sd, desc, det, acct, amtFmt: sgn(amt, 2), amtColor: amt > 0 ? green : '#191919', status, bg: p[0], fg: p[1], next }; });

    // Move money
    const amt = parseFloat(String(st.amount).replace(/[^0-9.]/g, '')) || 0;
    const fundAcct = data.accountByKey(C.fundingAccountKey), availCash = data.cashIn(C.fundingAccountKey); const availableCashFmt = isCustody ? 'Not available' : money(availCash);
    const B = R.payments.payees.map(p => [p.name, p.description, p.history]); const bene = B[st.bene] ?? ['—', '', '']; const beneNew = R.payments.payees[st.bene]?.isNew;
    const benes = B.map(([n, d, h], i) => { const a = i === st.bene; return { n, d, h, onClick: () => setState({ bene: i }), border: a ? '#005daa' : '#cfd5dd', bg: a ? '#f3f8fd' : '#fff', ring: a ? '#005daa' : '#9aa3af', dot: a ? '#005daa' : '#fff' }; });
    const amount = st.amount; const onAmount = (e: ChangeEvent<HTMLInputElement>) => setState({ amount: e.target.value });
    const rails = R.payments.rails.map(r => r.name as Rail).map(n => ({ n, onClick: () => setState({ rail: n }), bg: n === st.rail ? '#fff' : 'transparent', shadow: n === st.rail ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }));
    const rail = R.payments.rails.find(r => r.name === st.rail) ?? R.payments.rails[0]; const lim = rail?.dailyLimit ?? 0;
    const railNote = isCustody ? 'Not available' : `${rail?.speed} · ${rail?.fee ? money(rail.fee) + ' fee' : 'no fee'} · limit ${money(lim)}/day`;
    const amountError = isCustody ? null : amt <= 0 ? 'Enter an amount greater than $0.' : amt > availCash ? `That’s more than the available cash of ${availableCashFmt}. Lower the amount or sell investments first.` : amt > lim ? `${st.rail} limit is ${money(lim)} per day. Choose Wire or lower the amount.` : null;
    const needsApproval = !isCustody && amt > 25000;
    const mSteps = ['1  Details', '2  Review', '3  Confirmation'].map((n, i) => ({ n, bar: i + 1 === st.mStep ? '#005daa' : i + 1 < st.mStep ? '#9fc0e3' : 'transparent', fg: i + 1 <= st.mStep ? '#191919' : 'rgba(25,25,25,.45)' }));
    const m1 = st.mStep === 1; const m2 = st.mStep === 2; const m3 = st.mStep === 3;
    const toReview = () => { if (!amountError) setState({ mStep: 2 }); }; const toEdit = () => setState({ mStep: 1 }); const toConfirm = () => setState({ mStep: 3 });
    const review = isCustody ? [] : [['From', `${fundAcct.name} · ${fundAcct.no}`], ['To', bene[0] + ' · ' + bene[1]], ['Amount', money(amt, 2)], ['Fee', money(rail?.fee ?? 0, 2)], ['Send by', st.rail], ['Arrives', rail?.arrival ?? '']].map(([k, v]) => ({ k, v }));
    const confirmTitle = needsApproval ? 'Submitted. A second approver is reviewing your payment.' : 'Sent. Your payment is on its way.';
    const at = needsApproval ? 2 : 3;
    const tracking = [['Submitted', 'You confirmed with 2-step verification', '14:47'], ['Sanctions and fraud screening', 'Passed · payee history checked', '14:47'], ['Second approval', needsApproval ? 'Over $25,000 · RBC Payments team' : 'Not required under $25,000', needsApproval ? 'by 16:00' : '—'], ['Sent via ' + st.rail, 'Funds leave your account', ''], ['Confirmed by receiving bank', 'We’ll notify you by email and text', '']].map(([n, sub, d], i) => ({ n, sub, d, c: i <= at ? '#005daa' : '#cfd5dd', fill: i < at ? '#005daa' : i === at ? '#ffd200' : '#fff', w: i === at ? 600 : 400, fg: i > at ? 'rgba(25,25,25,.5)' : '#191919' }));
    const limits = isCustody ? [] : [['Available cash', availableCashFmt, `${fundAcct.shortName} ${fundAcct.no} · settled cash only`, '#191919'], ['Daily limit remaining', money(lim), st.rail + ' · resets midnight ET', '#191919'], ['Payee', bene[2], beneNew ? 'New payee: first payment held for a callback' : 'Known payee', beneNew ? amber : green], ['Second approval', amt > 25000 ? 'Required' : 'Not required', 'Payments over $25,000', amt > 25000 ? amber : green], ['Screening', 'Runs on submit', 'Sanctions, fraud and AML rules', '#191919']].map(([k, v, sub, color]) => ({ k, v, sub, color }));

  const alternativesUnavailable = isCustody || R.alternatives.commitments.length === 0;
  return {
    totalFmt,
    totalSrc,
    goOrders,
    goCustodyStatements,
    goActivity,
    goMoney,
    accounts,
    alloc,
    profile,
    household,
    householdName: HH.name,
    documentCount: isCustody ? 0 : 38,
    isCustody,
    reportingCurrency,
    accountCount: isCustody ? D.accounts.length : undefined,
    homeAdvisor,
    homeAdvisorInitials,
    homeAdvisorReview,
    homeValuationNote,
    tasks,
    comms,
    docs,
    holdCount,
    clsChips,
    holdings,
    dayChg,
    ytdChg,
    kpis,
    perfPath,
    benchPath,
    perfP,
    perfB,
    perfStart,
    periods,
    fees,
    trades,
    tradeCountLabel,
    checks,
    checkSummary,
    checkSummaryColor,
    impact,
    driftAfter,
    approveBg,
    approveFg,
    approveCursor,
    approveLabel,
    approveNote,
    approve,
    commits,
    altKpis,
    alternativesUnavailable,
    calls,
    dists,
    causeChips,
    exRows,
    exKpis,
    exSel,
    recent,
    pending,
    txns,
    benes,
    amount,
    onAmount,
    rails,
    railNote,
    amountError,
    needsApproval,
    mSteps,
    m1,
    m2,
    m3,
    toReview,
    toEdit,
    toConfirm,
    review,
    confirmTitle,
    tracking,
    limits,
    availableCashFmt,
    fromLabel: `${fundAcct.name} · ${fundAcct.no}`,
  };
}

export type ScreensModel = ReturnType<typeof buildScreens>;
