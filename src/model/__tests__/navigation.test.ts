import assert from 'node:assert/strict';
import test from 'node:test';
import { clientParam } from '../../api/client';
import type { ClientSelection } from '../../api/client';
import { clientSwitchLocation } from '../navigation';

const custodySelection: ClientSelection = { kind: 'custody', clientId: 1040 };
const householdSelection: ClientSelection = { kind: 'household', id: 'HH-WHITFIELD' };

test('client switch clears stale screen scope while preserving unrelated params', () => {
  const { search, screen } = clientSwitchLocation(
    '?client=1001&screen=position-check&acct=2001&safe=16598&message=7&messageId=8&page=2&date=2026-07-17&account=2001&from=2026-06-01&to=2026-07-31&mode=legacy&type=535&state=Error&keep=yes',
    custodySelection,
    'position-check',
  );
  const params = new URLSearchParams(search);

  assert.equal(screen, 'position-check');
  assert.equal(params.get('screen'), 'position-check');
  assert.equal(params.get('client'), clientParam(custodySelection));
  for (const name of ['acct', 'safe', 'message', 'messageId', 'page', 'date', 'account', 'from', 'to']) {
    assert.equal(params.has(name), false, `${name} should be cleared`);
  }
  assert.equal(params.get('mode'), 'legacy');
  assert.equal(params.get('type'), '535');
  assert.equal(params.get('state'), 'Error');
  assert.equal(params.get('keep'), 'yes');
});

test('switching to the default household removes client and moves custody holdings to Client 360', () => {
  const { search, screen } = clientSwitchLocation(
    '?client=1040&screen=custody-holdings&account=2001&date=2026-07-17',
    householdSelection,
    'custody-holdings',
  );
  const params = new URLSearchParams(search);

  assert.equal(screen, 'c360');
  assert.equal(params.get('screen'), 'c360');
  assert.equal(params.has('client'), false);
  assert.equal(params.has('account'), false);
  assert.equal(params.has('date'), false);
});

test('position check remains cross-client when switching to the default household', () => {
  const { search, screen } = clientSwitchLocation(
    '?client=1040&screen=position-check&acct=2001',
    householdSelection,
    'position-check',
  );
  const params = new URLSearchParams(search);

  assert.equal(screen, 'position-check');
  assert.equal(params.get('screen'), 'position-check');
});
