import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createZip, crc32, isZip, writeZipFile } from '../lib/zip.mjs';

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

test('streamed ZIP file matches the in-memory archive byte for byte', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-stream-'));
  const files = [
    { name: 'run/video.webm', data: Buffer.alloc(3 * 1024 * 1024 + 7, 0x5a) },
    { name: 'run/report.md', data: Buffer.from('report') }
  ];
  const entries = files.map((entry, index) => {
    const file = path.join(dir, `f${index}`);
    fs.writeFileSync(file, entry.data);
    return { name: entry.name, file };
  });
  const output = path.join(dir, 'out.zip');
  const size = writeZipFile(entries, output);
  const expected = createZip(files);
  assert.equal(size, expected.length);
  assert.deepEqual(fs.readFileSync(output), expected);
  fs.rmSync(dir, { recursive: true, force: true });
});
