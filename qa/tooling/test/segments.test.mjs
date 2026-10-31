import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { crc32 } from '../lib/zip.mjs';
import { packSegment, unpackSegment } from '../lib/segments.mjs';
import { tempDir } from './helpers.mjs';

function createRawZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.data);
    const method = entry.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const flags = 0x0800;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(((entry.creatorOs ?? 0) << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.externalAttributes ?? 0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function metadata(runId = 'run-one', phase = 'baseline', label = 'clients') {
  return Buffer.from(`${JSON.stringify({ runId, phase, label })}\n`);
}

function filesUnder(directory) {
  const files = new Map();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [name, data] of filesUnder(fullPath)) {
        files.set(path.join(entry.name, name).split(path.sep).join('/'), data);
      }
    } else if (entry.isFile()) {
      files.set(entry.name, fs.readFileSync(fullPath));
    }
  }
  return files;
}

test('segment ZIP roundtrip is deterministic and byte-identical', async (t) => {
  const root = tempDir(t, 'qa-segment-zip-');
  const segment = path.join(root, 'source');
  for (const [name, contents] of [
    ['run-meta.json', metadata()],
    ['results.json', Buffer.from('{"suites":[]}')],
    ['summary.json', Buffer.from('{"tests":[]}')],
    ['test-results/case/video.webm', Buffer.from([0, 1, 2, 255])],
    ['html/index.html', Buffer.from('<h1>Evidence</h1>')]
  ]) {
    const file = path.join(segment, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
  const firstZip = path.join(root, 'first.zip');
  const secondZip = path.join(root, 'second.zip');
  const first = await packSegment(segment, firstZip);
  const second = await packSegment(segment, secondZip);
  assert.deepEqual(first.errors, []);
  assert.deepEqual(second.errors, []);
  assert.equal(first.entryCount, 5);
  assert.deepEqual(fs.readFileSync(firstZip), fs.readFileSync(secondZip));
  assert.equal((await packSegment(segment, firstZip)).errors[0].code, 'OUTPUT_EXISTS');

  const target = path.join(root, 'unpacked', 'run-one', 'baseline', 'clients');
  const unpacked = unpackSegment(firstZip, target);
  assert.deepEqual(unpacked.errors, []);
  const sourceFiles = filesUnder(segment);
  const unpackedFiles = filesUnder(target);
  assert.deepEqual([...unpackedFiles.keys()].sort(), [...sourceFiles.keys()].sort());
  for (const [name, data] of sourceFiles) assert.deepEqual(unpackedFiles.get(name), data);
  assert.equal(unpackSegment(firstZip, target).errors[0].code, 'TARGET_EXISTS');
});

test('pack-segment requires run-meta.json', async (t) => {
  const root = tempDir(t, 'qa-segment-no-meta-');
  const segment = path.join(root, 'segment');
  fs.mkdirSync(segment);
  const result = await packSegment(segment, path.join(root, 'segment.zip'));
  assert.equal(result.errors[0].code, 'RUN_META_MISSING');
});

test('unpack-segment rejects traversal, absolute, drive, and backslash names', (t) => {
  const root = tempDir(t, 'qa-segment-paths-');
  const invalidNames = ['../outside.txt', '/absolute.txt', 'C:/drive.txt', 'folder\\file.txt'];
  for (const [index, name] of invalidNames.entries()) {
    const archive = path.join(root, `${index}.zip`);
    const target = path.join(root, `target-${index}`, 'run-one', 'baseline', 'clients');
    fs.writeFileSync(archive, createRawZip([{ name, data: 'blocked' }]));
    const result = unpackSegment(archive, target);
    assert.equal(result.errors[0].code, 'ZIP_ENTRY_PATH');
    assert.equal(fs.existsSync(target), false);
  }
});

test('unpack-segment rejects duplicate entries and symlinks', (t) => {
  const root = tempDir(t, 'qa-segment-types-');
  const duplicateZip = path.join(root, 'duplicate.zip');
  fs.writeFileSync(duplicateZip, createRawZip([
    { name: 'same.txt', data: 'one' },
    { name: 'same.txt', data: 'two' }
  ]));
  const duplicateResult = unpackSegment(duplicateZip, path.join(root, 'duplicate', 'run-one', 'baseline', 'clients'));
  assert.equal(duplicateResult.errors[0].code, 'ZIP_DUPLICATE_ENTRY');

  const symlinkZip = path.join(root, 'symlink.zip');
  fs.writeFileSync(symlinkZip, createRawZip([{
    name: 'link',
    data: '../outside',
    creatorOs: 3,
    externalAttributes: (0o120777 << 16) >>> 0
  }]));
  const symlinkResult = unpackSegment(symlinkZip, path.join(root, 'symlink', 'run-one', 'baseline', 'clients'));
  assert.equal(symlinkResult.errors[0].code, 'ZIP_ENTRY_SYMLINK');
});

test('unpack-segment extracts deflated entries', (t) => {
  const root = tempDir(t, 'qa-segment-deflated-');
  const archive = path.join(root, 'deflated.zip');
  fs.writeFileSync(archive, createRawZip([
    { name: 'run-meta.json', data: metadata(), method: 8 },
    { name: 'html/index.html', data: '<h1>Deflated</h1>', method: 8 }
  ]));
  const target = path.join(root, 'unpacked', 'run-one', 'baseline', 'clients');
  const result = unpackSegment(archive, target);
  assert.deepEqual(result.errors, []);
  assert.equal(fs.readFileSync(path.join(target, 'html/index.html'), 'utf8'), '<h1>Deflated</h1>');
});

test('mismatched segment metadata is rejected and the extraction is removed', (t) => {
  const root = tempDir(t, 'qa-segment-mismatch-');
  const archive = path.join(root, 'mismatch.zip');
  fs.writeFileSync(archive, createRawZip([{ name: 'run-meta.json', data: metadata('wrong-run') }]));
  const target = path.join(root, 'unpacked', 'run-one', 'baseline', 'clients');
  const result = unpackSegment(archive, target);
  assert.equal(result.errors[0].code, 'SEGMENT_MISMATCH');
  assert.equal(fs.existsSync(target), false);
});
