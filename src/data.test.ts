import { describe, expect, it } from 'vitest';
import { CLASS_COLORS, deriveData } from './data';
import { buildModel } from './model';
import { DATA_STATES, INITIAL_UI_STATE, SCREENS } from './types';
import type { DataState } from './types';
import { wealthData } from './test/fixtures';

const noop = () => {};

describe('deriveData', () => {
  const raw = wealthData();
  const d = deriveData(raw);

  it('reads the USD→CAD rate and falls back to 1 when it is missing', () => {
    expect(d.FX).toBe(1.3683);
    expect(deriveData({ ...raw, portfolio: { ...raw.portfolio, fxRates: [] } }).FX).toBe(1);
  });

  it('maps every holding and totals market value across them', () => {
    expect(d.holdings).toHaveLength(raw.portfolio.holdings.length);
    expect(d.holdings[0]).toMatchObject({ n: raw.portfolio.holdings[0].name, mv: raw.portfolio.holdings[0].marketValue });
    expect(d.totalValue).toBeCloseTo(raw.portfolio.holdings.reduce((s, h) => s + h.marketValue, 0));
  });

  it('sums cash per account', () => {
    expect(d.cashIn('NR')).toBe(184220);
    expect(d.cashIn('RR')).toBe(42150);
    expect(d.cashIn('CO')).toBe(131900);
  });

  it('rolls holdings up into accounts whose values add back to the total', () => {
    expect(d.accounts.map(a => a.key).sort()).toEqual(['CO', 'NR', 'RR']);
    expect(d.accounts.reduce((s, a) => s + a.mv, 0)).toBeCloseTo(d.totalValue);
    const nr = d.accountByKey('NR');
    const n = raw.portfolio.holdings.filter(h => h.accountKey === 'NR').length;
    expect(nr.short).toBe(`${nr.no} · ${n} holdings`);
    expect(nr.drift).toMatch(/^[+−]\d+\.\d pts$/);
  });

  it('colours drift by status', () => {
    const withStatus = (driftStatus: 'OK' | 'WARN' | 'ALERT', driftPts: number) =>
      deriveData({ ...raw, portfolio: { ...raw.portfolio, accounts: raw.portfolio.accounts.map(a => ({ ...a, driftStatus, driftPts })) } }).accounts[0];
    expect(withStatus('ALERT', -3.14)).toMatchObject({ drift: '−3.1 pts', driftColor: '#d6302f' });
    expect(withStatus('WARN', 1.5)).toMatchObject({ drift: '+1.5 pts', driftColor: '#b86a00' });
    expect(withStatus('OK', 0)).toMatchObject({ drift: '+0.0 pts', driftColor: 'rgba(25,25,25,.65)' });
  });

  it('builds an allocation per asset class whose actual weights sum to 100%', () => {
    expect(d.allocation.map(a => a.cls)).toEqual(raw.portfolio.assetClasses.map(c => c.name));
    expect(d.allocation.reduce((s, a) => s + a.a, 0)).toBeCloseTo(100);
    for (const a of d.allocation) expect(a.color).toBe(CLASS_COLORS[a.cls]);
  });

  it('joins settlement exceptions to their cause and defaults a missing owner to Unassigned', () => {
    const E = d.settlementExceptions;
    expect(E.rows).toHaveLength(raw.exceptions.exceptions.length);
    expect(E.causes).toEqual(raw.exceptions.causes.map(c => c.name));
    const first = raw.exceptions.exceptions[0], cause = raw.exceptions.causes.find(c => c.name === first.cause)!;
    expect(E.rows[0]).toMatchObject({ id: first.id, action: cause.suggestedAction, actionShort: cause.actionShort, why: cause.explanation });
    const unowned = deriveData({ ...raw, exceptions: { ...raw.exceptions, exceptions: [{ ...first, owner: null }] } });
    expect(unowned.settlementExceptions.rows[0].owner).toBe('Unassigned');
  });
});

describe('data-state handling', () => {
  const data = deriveData(wealthData());
  const model = (dataState: DataState, withData = true) =>
    buildModel('portfolio', dataState, INITIAL_UI_STATE, noop, noop, withData ? data : null, noop);

  it.each(DATA_STATES)('%s sets exactly the matching state flag', state => {
    const m = model(state);
    expect({ Loading: m.isLoading, Empty: m.isEmpty, Error: m.isError }).toEqual({ Loading: state === 'Loading', Empty: state === 'Empty', Error: state === 'Error' });
  });

  it.each(SCREENS)('renders the %s screen only when Populated', screen => {
    for (const state of DATA_STATES) {
      const { show } = buildModel(screen, state, INITIAL_UI_STATE, noop, noop, data, noop);
      expect(Object.entries(show).filter(([, v]) => v).map(([k]) => k)).toEqual(state === 'Populated' ? [screen] : []);
    }
  });

  it('builds the shell without data (Loading/Error before the API responds)', () => {
    const m = model('Loading', false);
    expect(m.title).toBe('Portfolio detail');
    expect(m.loadingMsg).toBe('Loading portfolio detail…');
    expect(m.ctx).toEqual([]);
    expect(m.nav.flatMap(g => g.items).find(i => i.id === 'exceptions')?.badge).toBeNull();
  });

  it('derives the exceptions badge and household context once data has loaded', () => {
    const m = model('Populated');
    expect(m.nav.flatMap(g => g.items).find(i => i.id === 'exceptions')?.badge).toBe(String(data.settlementExceptions.rows.length));
    expect(m.ctx.find(c => c.k === 'Household')?.v).toBe(data.raw.household.name);
  });

  it('labels error references by screen', () => {
    expect(model('Error').errRef).toBe('Ref PORTFOLIO-503-7f2a · 14:47:12 ET');
  });
});
