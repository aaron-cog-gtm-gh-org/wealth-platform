import assert from 'node:assert/strict';
import test from 'node:test';
import { dayMonthYearTime } from '../../format';

test('dayMonthYearTime formats valid timestamps and returns a dash for missing or invalid values', () => {
  assert.equal(dayMonthYearTime('2026-10-09T14:05:33'), '09-Oct-2026 14:05');
  assert.equal(dayMonthYearTime(null), '—');
  assert.equal(dayMonthYearTime('2026-02-30T14:05:33'), '—');
  assert.equal(dayMonthYearTime('not-a-timestamp'), '—');
});
