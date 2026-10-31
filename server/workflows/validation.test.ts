import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from './errors';
import {
  computeDrifts, parseAmount, parseQuantity, parseReference, validateAllocations,
  validateClientPatch, validateExceptionPatch, validateExceptionTransition,
} from './validation';

function rejects400(action: () => unknown, message?: string) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 400);
    if (message) assert.equal(error.message, message);
    return true;
  });
}

test('order quantities accept positive safe integers in range', () => {
  assert.equal(parseQuantity(1), 1);
  assert.equal(parseQuantity(1_000_000), 1_000_000);
  for (const value of [0, -1, 1.5, '5', 1_000_001, Number.MAX_SAFE_INTEGER + 1]) rejects400(() => parseQuantity(value));
});

test('transfer amounts accept precise positive values', () => {
  assert.equal(parseAmount(10), '10.00');
  assert.equal(parseAmount(10.5), '10.50');
  assert.equal(parseAmount('10.25'), '10.25');
  for (const value of [10.255, 0, -1, '1e3', '', '   ', 'abc', Number.NaN, '10000000.01']) rejects400(() => parseAmount(value));
});

test('references are trimmed and bounded', () => {
  assert.equal(parseReference(undefined), null);
  assert.equal(parseReference('  invoice  '), 'invoice');
  assert.equal(parseReference('  '), null);
  rejects400(() => parseReference(10));
  rejects400(() => parseReference('x'.repeat(81)));
});

test('allocation validation enforces classes, bounds, precision, and exact total', () => {
  const valid = [
    { assetClass: 'Equity', targetWeight: 55 },
    { assetClass: 'Fixed income', targetWeight: 35 },
    { assetClass: 'Cash', targetWeight: 10 },
  ];
  assert.deepEqual(validateAllocations(valid), valid);
  rejects400(() => validateAllocations(valid.slice(0, 2)));
  rejects400(() => validateAllocations([valid[0], valid[0], valid[2]]));
  rejects400(() => validateAllocations([{ assetClass: 'Unknown', targetWeight: 0 }, valid[1], valid[2]]));
  rejects400(() => validateAllocations([
    { assetClass: 'Equity', targetWeight: 59.99 },
    { assetClass: 'Fixed income', targetWeight: 30 },
    { assetClass: 'Cash', targetWeight: 10 },
  ]));
  rejects400(() => validateAllocations([
    { assetClass: 'Equity', targetWeight: 60 },
    { assetClass: 'Fixed income', targetWeight: 30.01 },
    { assetClass: 'Cash', targetWeight: 10 },
  ]));
  rejects400(() => validateAllocations([
    { assetClass: 'Equity', targetWeight: 100.01 },
    { assetClass: 'Fixed income', targetWeight: 0 },
    { assetClass: 'Cash', targetWeight: 0 },
  ]));
  rejects400(() => validateAllocations([
    { assetClass: 'Equity', targetWeight: 50.001 },
    { assetClass: 'Fixed income', targetWeight: 40 },
    { assetClass: 'Cash', targetWeight: 10 },
  ]));
  for (const targetWeight of [null, '', 'ten']) {
    rejects400(() => validateAllocations([
      { assetClass: 'Equity', targetWeight },
      { assetClass: 'Fixed income', targetWeight: 30 },
      { assetClass: 'Cash', targetWeight: 10 },
    ]), 'Every asset class needs a numeric target.');
  }
});

test('client patches require recognized editable fields', () => {
  assert.deepEqual(validateClientPatch({ riskProfile: 'Growth' }), { riskProfile: 'Growth' });
  rejects400(() => validateClientPatch({}));
  rejects400(() => validateClientPatch({ riskProfile: 'Aggressive' }));
  rejects400(() => validateClientPatch({ unexpected: true }));
});

test('exception patches and transitions validate owner, note, and resolution state', () => {
  assert.deepEqual(validateExceptionPatch({ owner: ' A. Nguyen ', status: 'In progress' }), { owner: 'A. Nguyen', note: undefined, status: 'In progress' });
  assert.deepEqual(validateExceptionPatch({ owner: 'S. Patel' }), { owner: 'S. Patel', note: undefined, status: undefined });
  rejects400(() => validateExceptionPatch({ owner: '  ' }), 'Owner is required.');
  rejects400(() => validateExceptionPatch({ owner: 'Alex' }), 'Owner must be A. Nguyen or S. Patel.');
  rejects400(() => validateExceptionPatch({ owner: null }), 'Owner must be A. Nguyen or S. Patel.');
  rejects400(() => validateExceptionPatch({ note: 'short' }), 'Add a note of at least 10 characters.');
  assert.deepEqual(validateExceptionTransition({ status: 'Open', owner: null, note: null }, { status: 'Resolved' }), {
    httpStatus: 400, message: 'Owner is required.',
  });
  assert.deepEqual(validateExceptionTransition({ status: 'Open', owner: 'Alex', note: null }, { status: 'Resolved' }), {
    httpStatus: 400, message: 'Add a note of at least 10 characters.',
  });
  assert.equal(validateExceptionTransition({ status: 'Resolved', owner: 'Alex', note: 'Enough detail' }, { status: 'Open' }).httpStatus, 409);
  assert.equal(validateExceptionTransition({ status: 'Open', owner: 'Alex', note: 'Enough detail' }, { status: 'Resolved' }).httpStatus, 200);
});

test('rebalance drift uses rounded values and tolerance without negative zero', () => {
  assert.deepEqual(computeDrifts([
    { assetClass: 'Equity', currentWeight: 60, targetWeight: 55 },
    { assetClass: 'Fixed income', currentWeight: 30, targetWeight: 35 },
    { assetClass: 'Cash', currentWeight: 10, targetWeight: 10 },
  ]), {
    trades: [
      { assetClass: 'Equity', currentWeight: 60, targetWeight: 55, drift: 5 },
      { assetClass: 'Fixed income', currentWeight: 30, targetWeight: 35, drift: -5 },
      { assetClass: 'Cash', currentWeight: 10, targetWeight: 10, drift: 0 },
    ],
    status: 'Ready',
  });
  assert.equal(computeDrifts([{ assetClass: 'Cash', currentWeight: 9.005, targetWeight: 10 }]).trades[0].drift, -0.99);
  assert.equal(computeDrifts([{ assetClass: 'Cash', currentWeight: 9.995, targetWeight: 10 }]).trades[0].drift, -0.01);
  assert.equal(computeDrifts([{ assetClass: 'Cash', currentWeight: 9.999, targetWeight: 10 }]).trades[0].drift, 0);
  assert.equal(computeDrifts([{ assetClass: 'Cash', currentWeight: 9, targetWeight: 10 }]).status, 'Within tolerance');
});
