import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { stubApi, stubApiDown } from '../test/fixtures';
import { DATA_STATES, SCREENS } from '../types';
import type { Screen } from '../types';

/** Heading, a panel only the populated screen renders, and the Empty / Error titles. */
const EXPECT: Record<Screen, { title: string; marker: string; empty: string; error: string }> = {
  c360: { title: 'Client 360', marker: 'Drift vs Balanced Growth model', empty: 'No accounts open yet', error: 'Couldn’t load client profile' },
  portfolio: { title: 'Portfolio detail', marker: 'Fees, YTD', empty: 'No holdings to show', error: 'Prices are unavailable' },
  orders: { title: 'Order ticket & rebalance', marker: 'Pre-trade checks', empty: 'Portfolio is within tolerance', error: 'Pre-trade checks could not run' },
  alts: { title: 'Alternatives holdings', marker: 'Expected capital calls', empty: 'No private investments', error: 'Valuation feed failed' },
  exceptions: { title: 'Settlement exceptions', marker: 'Suggested next action', empty: 'Queue clear', error: 'Custodian feed delayed' },
  home: { title: 'Good afternoon, Eleanor', marker: 'Total wealth · all accounts', empty: 'Welcome to RBC Wealth', error: 'We can’t show your balances right now' },
  activity: { title: 'Activity and status', marker: 'Trade date', empty: 'No activity in the last 30 days', error: 'Activity didn’t load' },
  money: { title: 'Move money', marker: 'Review payment', empty: 'No payees yet', error: 'Payments are temporarily unavailable' },
};

const visit = (search: string) => window.history.replaceState(null, '', '/' + search);

/** Lets the stubbed API calls settle so late state updates happen inside act(). */
const settle = () => act(() => new Promise(r => setTimeout(r, 0)));

const heading = () => screen.getByRole('heading', { level: 1 });

beforeEach(() => { stubApi(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); visit(''); });

describe.each(SCREENS)('?screen=%s', s => {
  const e = EXPECT[s];

  it('Populated renders the screen from API data', async () => {
    visit(`?screen=${s}&state=Populated`);
    render(<App />);
    expect(heading()).toHaveTextContent(e.title);
    expect(await screen.findByText(e.marker)).toBeInTheDocument();
    expect(screen.queryByText(e.empty)).not.toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('Loading shows the skeleton, not the screen', async () => {
    visit(`?screen=${s}&state=Loading`);
    render(<App />);
    await settle();
    expect(heading()).toHaveTextContent(e.title);
    expect(screen.getByText(`Loading ${e.title.toLowerCase()}…`)).toBeInTheDocument();
    expect(screen.queryByText(e.marker)).not.toBeInTheDocument();
  });

  it('Empty shows the empty-state message', async () => {
    visit(`?screen=${s}&state=Empty`);
    render(<App />);
    await settle();
    expect(screen.getByText(e.empty)).toBeInTheDocument();
    expect(screen.queryByText(e.marker)).not.toBeInTheDocument();
  });

  it('Error shows the error panel with retry and reference', async () => {
    visit(`?screen=${s}&state=Error`);
    render(<App />);
    await settle();
    expect(screen.getByText(e.error)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.getByText(`Ref ${s.toUpperCase()}-503-7f2a · 14:47:12 ET`)).toBeInTheDocument();
    expect(screen.queryByText(e.marker)).not.toBeInTheDocument();
  });
});

describe('routing and fetched data state', () => {
  it('covers every documented screen and state', () => {
    expect(Object.keys(EXPECT)).toEqual([...SCREENS]);
    expect([...DATA_STATES]).toEqual(['Populated', 'Loading', 'Empty', 'Error']);
  });

  it('defaults to Client 360 for a missing or unknown screen and ignores an unknown state', async () => {
    visit('?screen=nope&state=Bogus');
    render(<App />);
    expect(heading()).toHaveTextContent('Client 360');
    expect(await screen.findByText(EXPECT.c360.marker)).toBeInTheDocument();
  });

  it('shows Loading until the API responds, then Populated', async () => {
    visit('?screen=portfolio');
    render(<App />);
    expect(screen.getByText('Loading portfolio detail…')).toBeInTheDocument();
    expect(await screen.findByText(EXPECT.portfolio.marker)).toBeInTheDocument();
    expect(screen.queryByText('Loading portfolio detail…')).not.toBeInTheDocument();
  });

  it('shows Error when the API is down, and Retry reloads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubApiDown();
    visit('?screen=home');
    render(<App />);
    expect(await screen.findByText(EXPECT.home.error)).toBeInTheDocument();

    const fetchMock = stubApi();
    fireEvent.click(screen.getByText('Retry'));
    expect(await screen.findByText(EXPECT.home.marker)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('nav clicks switch screens and push ?screen= to history', async () => {
    visit('?screen=c360');
    render(<App />);
    await screen.findByText(EXPECT.c360.marker);
    fireEvent.click(screen.getByText('Settlement exceptions', { selector: 'nav span' }));
    expect(heading()).toHaveTextContent(EXPECT.exceptions.title);
    expect(new URLSearchParams(window.location.search).get('screen')).toBe('exceptions');
  });
});
