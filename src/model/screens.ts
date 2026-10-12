import { ASSET_CLASSES, CLASS_COLORS, PRICE_SOURCE, accounts, allocation, holdings, settlementExceptions, totalValue } from '../data';
import type { ChangeEvent } from 'react';
import { AMBER as amber, GREEN as green, MUTE as mute, RED as red, fmt, money, pct as pc, pill, signedMoney as sgn } from '../format';
import type { PillKind } from '../format';
import type { Period, Rail, Screen, SetUiState, UiState } from '../types';
import { TOTAL_SOURCE } from './shell';

const D = { holdings, total: totalValue, accounts, alloc: allocation, SRC: PRICE_SOURCE, COLORS: CLASS_COLORS, classes: ASSET_CLASSES };

export function buildScreens(st: UiState, setState: SetUiState, go: (s: Screen) => void) {
  const totalFmt = money(D.total);
  const totalSrc = TOTAL_SOURCE;
  const goOrders = () => go('orders');
  const goActivity = () => go('activity');
  const goMoney = () => go('money');
    // Client 360
    const accounts = D.accounts.map(a => ({ ...a, mvFmt: money(a.mv) }));
    const alloc = D.alloc.map(a => { const d = a.a - a.t; return { cls: a.cls, color: a.color, mvFmt: money(a.mv), actual: a.a.toFixed(1) + '%', target: a.t.toFixed(1) + '%', actualW: (a.a * 100 / 35).toFixed(1) + '%', targetW: (a.t * 100 / 35).toFixed(1) + '%', drift: (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1), driftColor: Math.abs(d) > 2 ? red : Math.abs(d) > 1 ? amber : mute, src: `${D.holdings.filter(h => h.cls === a.cls).length} positions · ${D.SRC[a.cls]}` }; });
    const profile = [['Legal name', 'Eleanor Margaret Whitfield'], ['Client ID', 'C-00418823'], ['Born', '17-Apr-1961 (65)'], ['Tax residency', 'Canada (ON) · SIN on file'], ['Occupation', 'Retired · former CFO'], ['Risk profile', 'Balanced growth · 6/10'], ['Time horizon', '10+ years'], ['KYC / AML', 'Current · next refresh 14-Mar-2027', green], ['Suitability', 'Signed 14-Mar-2026'], ['Preferred contact', 'Email · weekday mornings'], ['Power of attorney', 'Claire Whitfield (property)']].map(([k, v, c]) => ({ k, v, color: c || '#191919' }));
    const household = [['Eleanor Whitfield', 'Primary · client since 2009', 'NR (joint), RRSP'], ['David Whitfield', 'Spouse · joint owner', 'NR (joint)'], ['Whitfield Holdings Ltd.', 'Holding company · Eleanor 60%, David 40%', 'Corporate'], ['Claire Whitfield', 'Daughter · POA (property)', 'No accounts']].map(([n, r, a]) => ({ n, r, a }));
    const tasks = [
      ['RRSP underweight bonds by 2.6 pts', 'Review proposed rebalance RB-2026-0412', 'Today', red, red],
      ['Capital call notice · Northgate IV', '$85,000 due 28-Oct · confirm funding from corporate account', '16 days', amber, amber],
      ['Annual review prep', 'Agenda, performance pack and IPS check', '04-Nov', '#005daa', mute],
      ['RRIF conversion planning', 'Eleanor turns 71 in 2032 · add to review agenda', '04-Nov', '#8a94a3', mute],
      ['Beneficiary update requested', 'Signed form received 06-Oct · Ops verifying', 'With Ops', '#8a94a3', mute],
    ].map(([t, next, due, color, dueColor]) => ({ t, next, due, color, dueColor }));
    const comms = [['Email · Eleanor', '08-Oct', 'Asked about the Northgate capital call and whether USD cash can cover it.'], ['Call · 22 min · David', '29-Sep', 'Discussed Shopify gain and timing a partial sale in the corporate account.'], ['Secure message sent', '15-Sep', 'Q2 private investments statement and NAV explanation.'], ['Meeting · in person', '12-Jun', 'Mid-year review. Agreed to trim Canadian dividend fund toward target.']].map(([t, d, s]) => ({ t, d, s }));
    const docs = [['Q3 2026 consolidated statement', '06-Oct-2026'], ['Northgate IV capital call notice #9', '05-Oct-2026'], ['Investment Policy Statement v4', '14-Mar-2026'], ['KYC & suitability record', '14-Mar-2026'], ['2025 T5 / T3 tax pack', '28-Feb-2026']].map(([n, d]) => ({ n, d }));

    // Portfolio
    const cls = st.cls;
    const hs = D.holdings.filter(h => cls === 'All' || h.cls === cls);
    const holdCount = hs.length;
    const clsChips = ['All', ...D.classes].map(c => { const a = c === cls; const n = c === 'All' ? 25 : D.holdings.filter(h => h.cls === c).length; return { label: `${c} ${n}`, onClick: () => setState({ cls: c }), bg: a ? '#005daa' : '#fff', fg: a ? '#fff' : '#191919', border: a ? '#005daa' : '#d5dbe3' }; });
    const holdings = hs.map(h => { const u = h.mv - h.cost; const isB = h.cls === 'Bonds', isA = h.cls === 'Alternatives', isC = h.cls === 'Cash'; return {
      n: h.n, id: h.id, cls: h.cls, color: D.COLORS[h.cls], acct: h.acct,
      qtyFmt: isC ? '—' : isB ? fmt(h.qty) + ' face' : isA ? 'paid-in' : fmt(h.qty, h.qty % 1 ? 3 : 0),
      pxFmt: isC ? (h.ccy === 'USD' ? 'FX 1.3683' : '—') : isB ? h.px.toFixed(2) : isA ? 'NAV ' + h.px.toFixed(3) + 'x' : (h.ccy === 'USD' ? 'US$' : '$') + h.px.toFixed(2),
      mvFmt: money(h.mv), wFmt: (h.mv / D.total * 100).toFixed(2) + '%', uFmt: isC ? '—' : sgn(u), uColor: u > 0 ? green : u < 0 ? red : mute, dFmt: h.day ? pc(h.day) : '—', dColor: h.day > 0 ? green : h.day < 0 ? red : mute,
      src: `${isC ? '' : fmt(h.qty, h.qty % 1 ? 3 : 0) + ' × ' + h.px + (h.ccy === 'USD' && !isC ? ' USD × FX 1.3683' : '') + ' · '}${D.SRC[h.cls]} · cost basis ${money(h.cost)} (ACB)` }; });
    const dayAmt = D.holdings.reduce((s, h) => s + h.mv * h.day / 100, 0);
    const dayChg = pc(dayAmt / D.total * 100) + ' (' + sgn(dayAmt) + ')'; const ytdChg = '+7.84%';
    const kpis = [
      ['Market value', money(D.total), 'CAD · 3 accounts', '#191919', totalSrc],
      ['Today', sgn(dayAmt), pc(dayAmt / D.total * 100), green, 'Σ position value × day change · listed prices only'],
      ['YTD return (TWR)', '+7.84%', 'Benchmark +7.12% · +0.72 pts', green, 'Modified Dietz daily, linked · net of fees · 01-Jan to 12-Oct-2026'],
      ['Unrealized gain', sgn(D.holdings.reduce((s, h) => s + h.mv - h.cost, 0)), 'vs adjusted cost base', green, 'Market value − ACB per tax lot · 61 lots'],
      ['Income, next 90 days', '$58,420', 'coupons $31,880 · dividends $26,540', '#191919', 'Coupon schedules + declared/estimated dividends'],
      ['Unfunded commitments', '$650,000', '2 alternative funds', '#191919', 'Committed $1,750,000 − called $1,100,000'],
    ].map(([k, v, sub, color, src]) => ({ k, v, sub, color, src }));
    const P: Record<Period, [number, number, number]> = { '1M': [22, 0.4, 0.35], '3M': [26, 2.1, 1.8], 'YTD': [40, 7.84, 7.12], '1Y': [52, 11.6, 10.4], '3Y': [36, 28.9, 26.2], 'Since inception': [60, 142.3, 128.7] };
    const [n, pr, br] = P[st.period];
    let seed = n * 7 + 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ps = [0], bs = [0];
    for (let i = 1; i <= n; i++) { const shock = (rnd() - 0.5) * pr * 0.18; ps.push(ps[i - 1] + pr / n + shock); bs.push(bs[i - 1] + br / n + shock * 0.85 + (rnd() - 0.5) * br * 0.05); }
    ps[n] = pr; bs[n] = br;
    const all = ps.concat(bs); const mn = Math.min(...all, 0), mx = Math.max(...all);
    const path = (arr: number[]) => arr.map((v, i) => (i ? 'L' : 'M') + (i / n * 600).toFixed(1) + ' ' + (160 - (v - mn) / (mx - mn || 1) * 150).toFixed(1)).join(' ');
    const perfPath = path(ps); const benchPath = path(bs); const perfP = pc(pr); const perfB = pc(br);
    const perfStart = { '1M': '12-Sep-2026', '3M': '12-Jul-2026', 'YTD': '01-Jan-2026', '1Y': '12-Oct-2025', '3Y': '12-Oct-2023', 'Since inception': '02-Mar-2009' }[st.period];
    const periods = (Object.keys(P) as Period[]).map(id => ({ id, onClick: () => setState({ period: id }), bg: id === st.period ? '#fff' : 'transparent', shadow: id === st.period ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }));
    const fees = [['Management fee', '0.85% tiered', '$51,240'], ['Fund MER (embedded)', '0.21% avg', '$11,980'], ['Trading commissions', '14 trades', '$1,390'], ['Total', '1.07% annualized', '$64,610']].map(([k, r, v]) => ({ k, r, v }));

    // Orders
    const ex = st.excluded;
    const T: [string, string, string, string, number, number, number, string, string][] = [
      ['SELL', 'RBC Canadian Dividend Fund Sr F', 'NR', '1,200.000 units', 117768, 0, 26560, 'Fundserv · NAV 12-Oct', 'Forward-priced · cut-off 16:00 ET'],
      ['SELL', 'Shopify Inc. Cl A', 'CO', '400 sh', 60920, 9.95, 23320, 'RBC DS Equity desk', 'Limit $151.80 · day'],
      ['SELL', 'Alimentation Couche-Tard', 'RR', '1,400 sh', 111230, 9.95, 0, 'RBC DS Equity desk', 'Registered · no tax impact'],
      ['BUY', 'Govt of Canada 3.25% 01-Dec-2034', 'RR', '100,000 face', 98420, 150, 0, 'RBC CM Fixed Income', 'Indicative 98.42 + accrued $363'],
      ['BUY', 'Province of Ontario 3.65% 02-Jun-2033', 'NR', '50,000 face', 49575, 90, 0, 'RBC CM Fixed Income', 'Indicative 99.15 + accrued $640'],
      ['BUY', 'Canadian National Railway', 'RR', '300 sh', 47460, 9.95, 0, 'RBC DS Equity desk', 'Market · day'],
      ['BUY', 'Microsoft Corp.', 'RR', '80 sh', 56100, 9.95, 0, 'RBC DS US Equity', 'USD · FX converted at execution'],
    ];
    const active = T.map((_t, i) => !ex[i]);
    const rrCash = 42150 + (active[2] ? 111230 : 0); const rrBuys = [3, 5, 6].reduce((s, i) => s + (active[i] ? T[i][4] : 0), 0);
    const cashFail = rrBuys > rrCash;
    const trades = T.map((t, i) => ({ side: t[0], n: t[1], acct: t[2], qty: t[3], valFmt: money(t[4]), costFmt: t[5] ? '$' + t[5].toFixed(2) : 'nil', gainFmt: t[6] ? '+$' + fmt(t[6]) : '—', gainColor: t[6] ? amber : mute, route: t[7], note: (i === 6 && cashFail) ? 'Fails cash availability in RRSP' : t[8], noteColor: (i === 6 && cashFail) ? red : mute,
      sideBg: t[0] === 'BUY' ? '#e3f5ec' : '#fdecec', sideFg: t[0] === 'BUY' ? '#00703f' : '#b3201f', opacity: ex[i] ? 0.4 : 1, rowBg: (i === 6 && cashFail) ? '#fff6f6' : 'transparent',
      toggle: (e?: { preventDefault?: () => void }) => { e && e.preventDefault && e.preventDefault(); setState(s => ({ excluded: { ...s.excluded, [i]: !s.excluded[i] }, approved: false })); }, toggleLabel: ex[i] ? 'Include' : 'Exclude' }));
    const nAct = active.filter(Boolean).length;
    const tradeCountLabel = `${nAct} of 7 included`;
    const checkRows: [string, string, string][] = [
      ['Mandate limits', 'pass', 'All accounts within IPS bands after trades (equity 25–35%, fixed income 20–32%).'],
      ['Single-issuer concentration', 'pass', 'Largest issuer after trades: Govt of Canada 8.0% (limit 10%).'],
      ['Restricted & watch lists', 'pass', 'No instruments on RBC restricted list. RY: employee pre-clearance not required for client accounts.'],
      ['Cash availability', cashFail ? 'fail' : 'pass', cashFail ? `RRSP 4417-9034 short ${money(rrBuys - rrCash)}: buys ${money(rrBuys)} vs cash + sale proceeds ${money(rrCash)}. Exclude the MSFT buy or add a sell.` : `RRSP 4417-9034: buys ${money(rrBuys)} covered by cash + sale proceeds ${money(rrCash)}.`],
      ['Suitability vs risk profile', 'pass', 'Portfolio risk score 5.8 after trades vs client profile 6/10.'],
      ['Fund dealing cut-off', 'warn', 'Fund order placed 14:47 ET prices at 12-Oct NAV if submitted before 16:00 ET. 1h 13m remaining.'],
      ['Tax impact', 'warn', 'Realized capital gains $49,880 ($26,560 joint NR, $23,320 corporate). Client informed on 29-Sep call.'],
      ['Superficial loss', 'pass', 'No repurchases of instruments sold at a loss in the last 30 days.'],
    ];
    const fails = checkRows.filter(c => c[1] === 'fail').length, warns = checkRows.filter(c => c[1] === 'warn').length;
    const checks = checkRows.map(([n, s, d]) => { const p = pill(s === 'pass' ? 'ok' : s === 'warn' ? 'warn' : 'bad'); return { n, d, status: s.toUpperCase(), bg: p[0], fg: p[1] }; });
    const checkSummary = fails ? `${fails} failed · ${warns} warnings` : `All passed · ${warns} warnings`; const checkSummaryColor = fails ? red : green;
    const sells = T.reduce((s, t, i) => s + (active[i] && t[0] === 'SELL' ? t[4] : 0), 0), buys = T.reduce((s, t, i) => s + (active[i] && t[0] === 'BUY' ? t[4] : 0), 0);
    const impact = [['Sells', money(sells)], ['Buys', money(buys)], ['Net cash', sgn(sells - buys), sells - buys >= 0 ? green : red], ['Turnover', (Math.max(sells, buys) / D.total * 100).toFixed(2) + '% of AUA'], ['Est. trading costs', '$' + T.reduce((s, t, i) => s + (active[i] ? t[5] : 0), 0).toFixed(2)], ['Realized gains (taxable)', '$' + fmt(T.reduce((s, t, i) => s + (active[i] ? t[6] : 0), 0)), amber], ['Tracking error vs model', '1.9% → 0.6%']].map(([k, v, c]) => ({ k, v, color: c || '#191919' }));
    const driftAfter = [['Cash', '+1.2', '+0.9'], ['Equities', '−1.6', '−0.4'], ['Bonds', '−1.8', '−0.3'], ['Funds', '+1.4', '+0.0'], ['Alternatives', '+0.8', '+0.8']].map(([cls, b, a]) => ({ cls, before: b + ' pts', after: a + ' pts', beforeColor: mute, afterColor: green }));
    const canApprove = !fails && !st.approved;
    const approveBg = st.approved ? '#e3f5ec' : canApprove ? '#005daa' : '#e5e8ec'; const approveFg = st.approved ? '#00703f' : canApprove ? '#fff' : 'rgba(25,25,25,.45)'; const approveCursor = canApprove ? 'pointer' : 'default';
    const approveLabel = st.approved ? `${nAct} orders sent to routing · 14:48 ET` : fails ? 'Resolve 1 failed check to approve' : `Approve and route ${nAct} orders`;
    const approveNote = st.approved ? 'Fills will book to the ledger as they arrive. Settlement instructions are created automatically (equities T+1, bonds T+1, funds T+2).' : 'Approval requires step-up authentication. Warnings are recorded in the audit trail with your ID.';
    const approve = () => { if (canApprove) setState({ approved: true }); };

    // Alternatives
    const commits = [
      { n: 'Northgate Infrastructure Partners IV', meta: 'Whitfield Holdings Ltd. · 4418-1157 · CAD', vintage: '2021', commit: 1000000, called: 620000, dist: 92000, nav: 712400, navNote: 'Manager NAV 30-Jun-2026 · approved', navColor: green },
      { n: 'Lakeshore Private Credit Fund II', meta: 'Non-registered · 4417-8821 · CAD', vintage: '2023', commit: 750000, called: 480000, dist: 61200, nav: 468900, navNote: 'Manager NAV 30-Jun-2026 · approved', navColor: green },
    ].map(c => ({ ...c, commitFmt: money(c.commit), calledFmt: money(c.called), calledPct: Math.round(c.called / c.commit * 100) + '%', unfundedFmt: money(c.commit - c.called), distFmt: money(c.dist), navFmt: money(c.nav), dpi: (c.dist / c.called).toFixed(2) + 'x', tvpi: ((c.dist + c.nav) / c.called).toFixed(2) + 'x', src: `Manager NAV 30-Jun-2026 (administrator: SS&C) + calls since − distributions since · entered by M. Tremblay, approved by R. Osei 14-Aug-2026` }));
    const altKpis = [['Committed', '$1,750,000', '2 funds · CAD'], ['Called to date', '$1,100,000', '62.9% of committed'], ['Unfunded', '$650,000', '7.6% of household AUA'], ['Current value', '$1,181,300', 'as of 30-Jun-2026 NAVs'], ['Distributions received', '$153,200', 'DPI 0.14x'], ['Net TVPI', '1.21x', 'IRR 9.8% since first call']].map(([k, v, sub]) => ({ k, v, sub, src: 'Commitment register · capital call and distribution notices · manager NAVs' }));
    const calls = [['28-Oct-2026', 'Northgate IV · call #10', '$85,000', 'Notice received', 'info'], ['Jan-2027', 'Lakeshore II · est.', '$60,000', 'Estimate', 'mute'], ['Mar-2027', 'Northgate IV · est.', '$110,000', 'Estimate', 'mute'], ['Jun-2027', 'Lakeshore II · est.', '$75,000', 'Estimate', 'mute']].map(([d, f, a, s, k]) => { const p = pill(k as PillKind); return { d, f, a, s, bg: p[0], fg: p[1] }; });
    const dists = [['15-Sep-2026', 'Lakeshore II', 'Income', '$14,800'], ['30-Jun-2026', 'Northgate IV', 'Return of capital', '$38,000'], ['15-Jun-2026', 'Lakeshore II', 'Income', '$13,900'], ['31-Mar-2026', 'Northgate IV', 'Income', '$22,000'], ['15-Mar-2026', 'Lakeshore II', 'Income', '$12,600']].map(([d, f, t, a]) => ({ d, f, t, a }));

    // Exceptions
    const E = settlementExceptions;
    const rows = E.rows.filter(r => st.exCause === 'All' || r.cause === st.exCause);
    const selId = st.exSel ?? E.rows[0].id; const sel = E.rows.find(r => r.id === selId) || E.rows[0];
    const ageC = (a: number) => a >= 5 ? red : a >= 2 ? amber : '#191919';
    const causeChips = ['All', ...E.causes].map(c => { const a = c === st.exCause; const n = c === 'All' ? 40 : E.rows.filter(r => r.cause === c).length; return { label: `${c} ${n}`, onClick: () => setState({ exCause: c }), bg: a ? '#005daa' : '#fff', fg: a ? '#fff' : '#191919', border: a ? '#005daa' : '#d5dbe3' }; });
    const exRows = rows.map(r => ({ ...r, age: r.age + 'd', ageColor: ageC(r.age), valFmt: money(r.val), ownerColor: r.owner === 'Unassigned' ? red : '#191919', bg: r.id === sel.id ? '#eaf1fa' : 'transparent', onClick: () => setState({ exSel: r.id }) }));
    const totV = E.rows.reduce((s, r) => s + r.val, 0);
    const exKpis = [['Open exceptions', '40', '7 opened today', '#191919'], ['Value at risk', money(totV), 'gross settlement value', '#191919'], ['Aged 5+ days', String(E.rows.filter(r => r.age >= 5).length), 'buy-in risk from day 7 (CSDR/CDS)', red], ['Unassigned', String(E.rows.filter(r => r.owner === 'Unassigned').length), 'auto-assign at 15:00 ET', amber], ['Cleared today', '23', 'median 3h 10m to resolve', green]].map(([k, v, sub, color]) => ({ k, v, sub, color }));
    const exSel = { ...sel, ageColor: ageC(sel.age), ageLong: sel.age === 0 ? 'Opened today' : `Open ${sel.age} business day${sel.age > 1 ? 's' : ''}`,
      fields: [['Value', money(sel.val)], ['Instrument', sel.inst], ['Direction', sel.side], ['Account', sel.acct], ['Counterparty', sel.cpty], ['Intended settle', sel.age ? `${sel.age}d ago` : 'Today'], ['Owner', sel.owner], ['Linked trade', 'TR-' + sel.id.slice(3) + '-01']].map(([k, v]) => ({ k, v })),
      timeline: [['Fail reported by ' + sel.cpty, sel.age ? `${sel.age}d ago · 09:12 ET` : 'Today · 09:12 ET', red], ['Exception created, cause classified', 'auto · rule SET-FAIL-04', '#8a94a3'], [sel.owner === 'Unassigned' ? 'Awaiting owner' : 'Assigned to ' + sel.owner, sel.owner === 'Unassigned' ? 'auto-assign 15:00 ET' : 'Wealth Ops – Toronto', sel.owner === 'Unassigned' ? amber : '#8a94a3'], ['Next: ' + sel.actionShort, 'suggested', '#005daa']].map(([t, d, color]) => ({ t, d, color })) };

    // Client home / activity
    const recent = ([['09-Oct', 'Dividend · Royal Bank of Canada', 'Non-registered', 2208], ['09-Oct', 'Bought PH&N Bond Fund Sr F', 'RRSP', -25000], ['06-Oct', 'Interest · CAD cash', 'Non-registered', 612.4], ['01-Oct', 'Coupon · Bell Canada 5.15%', 'Whitfield Holdings', 7725], ['30-Sep', 'Management fee · Q3', 'All accounts', -17080], ['15-Sep', 'Distribution · Lakeshore II', 'Non-registered', 14800]] as [string, string, string, number][]).map(([date, desc, acct, amt]) => ({ date, desc, acct, amtFmt: sgn(amt, 2), amtColor: amt > 0 ? green : '#191919' }));
    const mk = (names: string[], at: number, dates: string[]) => ({ bars: names.map((_, i) => ({ c: i < at ? '#005daa' : i === at ? '#ffd200' : '#e5e8ec' })), steps: names.map((n, i) => ({ n, d: dates[i] || '', c: i <= at ? '#005daa' : '#cfd5dd', fill: i < at ? '#005daa' : i === at ? '#ffd200' : '#fff', w: i === at ? 600 : 400, fg: i > at ? 'rgba(25,25,25,.5)' : '#191919' })) });
    const pending = [
      { t: 'Wire to TD Canada Trust ···4471', a: '$40,000.00', s: 'Second approval in progress', eta: 'Expected today by 4:00 PM', ...mk(['Submitted', 'Screening', 'Approval', 'Sent', 'Received'], 2, ['13:12', '13:13', 'by 16:00', '', 'by 17:30']) },
      { t: 'Buy PH&N Bond Fund Sr F', a: '$25,000.00', s: 'Waiting for fund price', eta: 'Price known tonight · settles 14-Oct', ...mk(['Placed', 'Priced', 'Settled'], 1, ['09-Oct', '12-Oct eve', '14-Oct']) },
      { t: 'Capital call · Northgate IV', a: '$85,000.00', s: 'Notice received · funding from corporate account', eta: 'Due 28-Oct-2026', ...mk(['Notice', 'Funding', 'Paid', 'Matched'], 1, ['05-Oct', 'by 26-Oct', '28-Oct', '']) },
      { t: 'Beneficiary designation · RRSP', a: '', s: 'Form received · being verified', eta: 'Usually 3–5 business days', ...mk(['Received', 'Verified', 'Updated'], 1, ['06-Oct', '', '']) },
    ];
    const txns = ([
      ['12-Oct', '14-Oct', 'Buy · PH&N Bond Fund Sr F', '2,470.4 units at NAV tbc', 'RR', -25000, 'Awaiting price', 'warn', 'NAV published ~19:00 ET'],
      ['12-Oct', '12-Oct', 'Wire out · TD Canada Trust ···4471', 'Ref PMT-2026-1012-08841', 'NR', -40000, 'In approval', 'warn', 'Second approver by 16:00 ET'],
      ['09-Oct', '09-Oct', 'Dividend · Royal Bank of Canada', '2,400 sh × $1.48 · eligible', 'NR', 3552, 'Settled', 'ok', ''],
      ['08-Oct', '10-Oct', 'Sell · Enbridge Inc.', '800 sh at $62.10', 'NR', 49670, 'Settlement failed', 'bad', 'Retrying 13-Oct · no action needed'],
      ['08-Oct', '09-Oct', 'Buy · Govt of Canada 3.25% 2034', '50,000 face at 98.30 + accrued', 'RR', -49332, 'Settled', 'ok', ''],
      ['06-Oct', '06-Oct', 'Interest · CAD cash', 'Sept accrual at 2.15%', 'NR', 612.4, 'Settled', 'ok', ''],
      ['05-Oct', '28-Oct', 'Capital call · Northgate IV #10', 'Notice received', 'CO', -85000, 'Scheduled', 'info', 'Paid 28-Oct from USD/CAD cash'],
      ['01-Oct', '01-Oct', 'Coupon · Bell Canada 5.15%', '300,000 face · semi-annual', 'CO', 7725, 'Settled', 'ok', ''],
      ['30-Sep', '30-Sep', 'Management fee · Q3 2026', '0.85% tiered on avg AUA', 'NR', -17080, 'Settled', 'ok', ''],
      ['29-Sep', '30-Sep', 'Sell · Shopify Inc. Cl A', '200 sh at $149.80', 'CO', 29950, 'Settled', 'ok', ''],
      ['24-Sep', '24-Sep', 'FX · USD → CAD', 'US$20,000 at 1.3651', 'CO', 27302, 'Settled', 'ok', ''],
      ['15-Sep', '15-Sep', 'Distribution · Lakeshore II', 'Income · Q3', 'NR', 14800, 'Settled', 'ok', ''],
    ] as [string, string, string, string, string, number, string, PillKind, string][]).map(([td, sd, desc, det, acct, amt, status, k, next]) => { const p = pill(k as PillKind); return { td, sd, desc, det, acct, amtFmt: sgn(amt, 2), amtColor: amt > 0 ? green : '#191919', status, bg: p[0], fg: p[1], next }; });

    // Move money
    const amt = parseFloat(String(st.amount).replace(/[^0-9.]/g, '')) || 0;
    const B = [['TD Canada Trust ···4471', 'David Whitfield · chequing', 'Paid 6× since 2023'], ['Ontario Land Registry Trust', 'Lawyer trust account · Hughes LLP', 'New · added 02-Oct'], ['RBC Royal Bank ···0093', 'Eleanor · chequing', 'Paid 41×']];
    const benes = B.map(([n, d, h], i) => { const a = i === st.bene; return { n, d, h, onClick: () => setState({ bene: i }), border: a ? '#005daa' : '#cfd5dd', bg: a ? '#f3f8fd' : '#fff', ring: a ? '#005daa' : '#9aa3af', dot: a ? '#005daa' : '#fff' }; });
    const amount = st.amount; const onAmount = (e: ChangeEvent<HTMLInputElement>) => setState({ amount: e.target.value });
    const rails = (['Wire', 'EFT', 'Interac e-Transfer'] as Rail[]).map(n => ({ n, onClick: () => setState({ rail: n }), bg: n === st.rail ? '#fff' : 'transparent', shadow: n === st.rail ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }));
    const lim = { Wire: 250000, EFT: 100000, 'Interac e-Transfer': 3000 }[st.rail];
    const railNote = { Wire: 'Same day if approved by 4:00 PM ET · $25 fee · limit $250,000/day', EFT: '1–2 business days · no fee · limit $100,000/day', 'Interac e-Transfer': 'Within 30 minutes · no fee · limit $3,000/day' }[st.rail];
    const amountError = amt <= 0 ? 'Enter an amount greater than $0.' : amt > 184220 ? `That’s more than the available cash of $184,220. Lower the amount or sell investments first.` : amt > lim ? `${st.rail} limit is ${money(lim)} per day. Choose Wire or lower the amount.` : null;
    const needsApproval = amt > 25000;
    const mSteps = ['1  Details', '2  Review', '3  Confirmation'].map((n, i) => ({ n, bar: i + 1 === st.mStep ? '#005daa' : i + 1 < st.mStep ? '#9fc0e3' : 'transparent', fg: i + 1 <= st.mStep ? '#191919' : 'rgba(25,25,25,.45)' }));
    const m1 = st.mStep === 1; const m2 = st.mStep === 2; const m3 = st.mStep === 3;
    const toReview = () => { if (!amountError) setState({ mStep: 2 }); }; const toEdit = () => setState({ mStep: 1 }); const toConfirm = () => setState({ mStep: 3 });
    const review = [['From', 'Non-registered investment · 4417-8821'], ['To', B[st.bene][0] + ' · ' + B[st.bene][1]], ['Amount', money(amt, 2)], ['Fee', st.rail === 'Wire' ? '$25.00' : '$0.00'], ['Send by', st.rail], ['Arrives', st.rail === 'Wire' ? 'Today by 5:30 PM ET' : st.rail === 'EFT' ? 'Wed 14-Oct-2026' : 'Within 30 minutes']].map(([k, v]) => ({ k, v }));
    const confirmTitle = needsApproval ? 'Submitted. A second approver is reviewing your payment.' : 'Sent. Your payment is on its way.';
    const at = needsApproval ? 2 : 3;
    const tracking = [['Submitted', 'You confirmed with 2-step verification', '14:47'], ['Sanctions and fraud screening', 'Passed · payee history checked', '14:47'], ['Second approval', needsApproval ? 'Over $25,000 · RBC Payments team' : 'Not required under $25,000', needsApproval ? 'by 16:00' : '—'], ['Sent via ' + st.rail, 'Funds leave your account', ''], ['Confirmed by receiving bank', 'We’ll notify you by email and text', '']].map(([n, sub, d], i) => ({ n, sub, d, c: i <= at ? '#005daa' : '#cfd5dd', fill: i < at ? '#005daa' : i === at ? '#ffd200' : '#fff', w: i === at ? 600 : 400, fg: i > at ? 'rgba(25,25,25,.5)' : '#191919' }));
    const limits = [['Available cash', '$184,220', 'Non-registered 4417-8821 · settled cash only', '#191919'], ['Daily limit remaining', money(lim), st.rail + ' · resets midnight ET', '#191919'], ['Payee', B[st.bene][2], st.bene === 1 ? 'New payee: first payment held for a callback' : 'Known payee', st.bene === 1 ? amber : green], ['Second approval', amt > 25000 ? 'Required' : 'Not required', 'Payments over $25,000', amt > 25000 ? amber : green], ['Screening', 'Runs on submit', 'Sanctions, fraud and AML rules', '#191919']].map(([k, v, sub, color]) => ({ k, v, sub, color }));

  return {
    totalFmt,
    totalSrc,
    goOrders,
    goActivity,
    goMoney,
    accounts,
    alloc,
    profile,
    household,
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
  };
}

export type ScreensModel = ReturnType<typeof buildScreens>;
