import assert from 'node:assert/strict';
import test from 'node:test';
import { createZip, crc32, isZip } from '../lib/zip.mjs';

function parseZip(buffer) {
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  assert.notEqual(endOffset, -1);
  const count = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    assert.equal(crc32(data), crc);
    entries.push({ name, data: data.toString('utf8') });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

test('ZIP writer produces deterministic STORE archives with valid CRCs and names', () => {
  const files = [
    { name: 'run/report.md', data: Buffer.from('report') },
    { name: 'run/video.webm', data: Buffer.from('video-bytes') },
    { name: 'run/index.html', data: Buffer.from('<h1>Evidence</h1>') }
  ];
  const first = createZip(files);
  const second = createZip(files);
  assert.ok(isZip(first));
  assert.deepEqual(first, second);
  assert.deepEqual(parseZip(first), [
    { name: 'run/index.html', data: '<h1>Evidence</h1>' },
    { name: 'run/report.md', data: 'report' },
    { name: 'run/video.webm', data: 'video-bytes' }
  ]);
  assert.throws(() => createZip([{ name: '../escape.txt', data: 'unsafe' }]), /ZIP_ENTRY_PATH/);
});
