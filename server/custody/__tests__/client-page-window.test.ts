import assert from 'node:assert/strict';
import test from 'node:test';
import { custodyPageWindow } from '../../repositories/custody';

test('client picker paging spans households before custody clients', () => {
  assert.deepEqual(custodyPageWindow(1, 1), { offset: 0, limit: 24 });
  assert.deepEqual(custodyPageWindow(1, 2), { offset: 24, limit: 25 });
  assert.deepEqual(custodyPageWindow(30, 1), { offset: 0, limit: 0 });
  assert.deepEqual(custodyPageWindow(30, 2), { offset: 0, limit: 20 });
  assert.deepEqual(custodyPageWindow(30, 3), { offset: 20, limit: 25 });
});
