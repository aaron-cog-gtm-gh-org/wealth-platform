import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bootstrap } from './api';
import {
  availableCash, heldQuantity, instruments, openSellQuantity, readArea,
  reservedCash, sortCurrencies, totalsByCurrency, workspaceHref, orderTicketError, ticketAvailability,
} from './model';

function fixture(): Bootstrap {
  return {
    clients: [], transfers: [], exceptions: [], allocations: [], audit: [],
    accounts: [
      { id: 'A1001', clientId: 'C1001', name: 'Investment', currency: 'CAD', cash: 25000 },
      { id: 'A1002', clientId: 'C1001', name: 'Savings', currency: 'CAD', cash: 10000 },
    ],
    positions: [
      { id: 'P1', accountId: 'A1001', symbol: 'RY', name: 'Royal Bank', quantity: 100, price: 140 },
      { id: 'P2', accountId: 'A1002', symbol: 'BMO', name: 'Bank of Montreal', quantity: 80, price: 125 },
    ],
    orders: [
      { id: 'O1', accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 10, price: 140, status: 'Open' },
      { id: 'O2', accountId: 'A1001', symbol: 'RY', side: 'Buy', quantity: 5, price: 140, status: 'Cancelled' },
      { id: 'O3', accountId: 'A1002', symbol: 'BMO', side: 'Buy', quantity: 5, price: 125, status: 'Open' },
      { id: 'O4', accountId: 'A1001', symbol: 'RY', side: 'Sell', quantity: 70, price: 140, status: 'Open' },
    ],
  };
}

test('cash displays exclude cancelled orders, sell proceeds and other accounts', () => {
  const data = fixture();
  assert.equal(reservedCash(data, 'A1001'), 1400);
  assert.equal(availableCash(data, data.accounts[0]), 23600);
  assert.equal(availableCash(data, data.accounts[1]), 9375);
});

test('share reservation displays are scoped to account, symbol and open status', () => {
  const data = fixture();
  assert.equal(heldQuantity(data, 'A1001', 'RY'), 100);
  assert.equal(openSellQuantity(data, 'A1001', 'RY'), 70);
  assert.equal(openSellQuantity(data, 'A1002', 'RY'), 0);
  data.orders[3].status = 'Cancelled';
  assert.equal(openSellQuantity(data, 'A1001', 'RY'), 0);
});

test('valuations retain currency separation', () => {
  const rows = [
    { currency: 'CAD', value: 14000 }, { currency: 'USD', value: 16800 },
    { currency: 'CAD', value: 10000 },
  ];
  assert.deepEqual([...totalsByCurrency(rows, row => row.currency, row => row.value)],
    [['CAD', 24000], ['USD', 16800]]);
  assert.deepEqual([...totalsByCurrency([], () => 'CAD', () => 0)], []);
  assert.deepEqual(sortCurrencies(['USD', 'CAD']), ['CAD', 'USD']);
});

test('workspace route parsing is explicit and defaults unknown areas safely', () => {
  assert.equal(readArea('?screen=workspace&area=settlements'), 'settlements');
  assert.equal(readArea('?screen=workspace&area=unknown'), 'clients');
  assert.equal(workspaceHref('portfolio', { client: 'C1002' }),
    '/?screen=workspace&area=portfolio&client=C1002');
});

test('instrument choices are unique and stable', () => {
  const data = fixture();
  data.positions.push({ ...data.positions[0], id: 'P3', accountId: 'A1002' });
  assert.deepEqual(instruments(data).map(instrument => instrument.symbol), ['BMO', 'RY']);
});

test('sell ticket errors expire only when relevant share availability changes', () => {
  const data = fixture();
  const rejection = '30 shares available to sell.';
  const snapshot = ticketAvailability(data, 'A1001', 'RY', 'Sell');
  assert.equal(snapshot.value, 30);
  const reloaded = fixture();
  reloaded.positions[1].quantity = 1;
  reloaded.orders.push({ ...reloaded.orders[3], id: 'other-symbol', symbol: 'BMO' });
  reloaded.orders.push({ ...reloaded.orders[3], id: 'other-account', accountId: 'A1002' });
  const unchanged = ticketAvailability(reloaded, 'A1001', 'RY', 'Sell');
  assert.equal(orderTicketError(rejection, snapshot, unchanged), rejection);
  assert.equal(orderTicketError(null, snapshot, unchanged), null);
  const cancelled = fixture();
  cancelled.orders[3].status = 'Cancelled';
  const released = ticketAvailability(cancelled, 'A1001', 'RY', 'Sell');
  assert.equal(released.value, 100);
  assert.equal(orderTicketError(rejection, snapshot, released), null);
  reloaded.positions[0].quantity = 101;
  assert.equal(orderTicketError(rejection, snapshot, ticketAvailability(reloaded, 'A1001', 'RY', 'Sell')), null);
});

test('buy ticket errors expire only when account cash availability changes', () => {
  const data = fixture();
  const snapshot = ticketAvailability(data, 'A1001', 'RY', 'Buy');
  assert.equal(snapshot.value, 23600);
  const reloaded = fixture();
  reloaded.accounts[1].cash = 0;
  reloaded.orders[2].status = 'Cancelled';
  reloaded.orders[3].status = 'Cancelled';
  reloaded.positions[0].quantity = 1;
  const rejection = 'Insufficient available cash.';
  assert.equal(orderTicketError(rejection, snapshot, ticketAvailability(reloaded, 'A1001', 'RY', 'Buy')), rejection);
  reloaded.orders[0].status = 'Cancelled';
  assert.equal(orderTicketError(rejection, snapshot, ticketAvailability(reloaded, 'A1001', 'RY', 'Buy')), null);
  reloaded.orders[0].status = 'Open';
  reloaded.accounts[0].cash += 1;
  assert.equal(orderTicketError(rejection, snapshot, ticketAvailability(reloaded, 'A1001', 'RY', 'Buy')), null);
  assert.equal(ticketAvailability(data, '', '', 'Buy').value, null);
  assert.equal(ticketAvailability(data, 'A1001', '', 'Sell').value, null);
  assert.equal(orderTicketError(null, { value: null }, snapshot), null);
});
