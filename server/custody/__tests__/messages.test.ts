// Unit tests for US4 helpers (T040): message type filter parsing and line-ending detection.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CustodyValidationError, parseMessageType } from '../../repositories/custody';
import { detectLineEndings } from '../../../src/model/messages';

test('parseMessageType accepts valid forms', () => {
  assert.equal(parseMessageType(undefined), undefined);
  assert.equal(parseMessageType(''), undefined);
  assert.equal(parseMessageType('535'), '535');
  assert.equal(parseMessageType('MT535'), '535');
  assert.equal(parseMessageType('mt535'), '535');
  assert.equal(parseMessageType('54x'), '54x');
  assert.equal(parseMessageType('MT54X'), '54x');
  for (const t of ['544', '545', '546', '547']) {
    assert.equal(parseMessageType(t), t);
    assert.equal(parseMessageType(`mt${t}`), t);
  }
});

test('parseMessageType rejects anything else', () => {
  for (const bad of ['54', '536', 'MT', 'foo', '535 ']) {
    // '535 ' trims to a valid filter; everything else must throw
    if (bad === '535 ') { assert.equal(parseMessageType(bad), '535'); continue; }
    assert.throws(() => parseMessageType(bad), CustodyValidationError, String(bad));
  }
  assert.equal(parseMessageType(535), '535'); // numeric input coerces like a string
  assert.throws(() => parseMessageType('536'), /type must be 535, 54x, 544, 545, 546 or 547/);
});

test('detectLineEndings', () => {
  assert.equal(detectLineEndings('a\r\nb\r\n'), 'CRLF');
  assert.equal(detectLineEndings('a\nb\n'), 'LF');
  assert.equal(detectLineEndings('a\rb\r'), 'CR');
  assert.equal(detectLineEndings('a\r\nb\n'), 'Mixed');
  assert.equal(detectLineEndings('no endings'), 'None');
  assert.equal(detectLineEndings(''), 'None');
});
