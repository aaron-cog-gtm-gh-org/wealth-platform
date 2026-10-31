import fs from 'node:fs';
import path from 'node:path';
import { normalizeRelative, walkFiles } from './common.mjs';

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  crcTable[index] = value >>> 0;
}

export function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
  return { date: 0x0021, time: 0 };
}

function headerSignature(buffer, signature) {
  return buffer.readUInt32LE(0) === signature;
}

export function createZip(entries) {
  const files = entries.map((entry) => {
    const name = normalizeRelative(entry.name).replace(/^\//, '');
    if (!name || name.split('/').includes('..') || /^[A-Za-z]:\//.test(name)) {
      throw new Error(`ZIP_ENTRY_PATH: invalid archive entry path "${name}"`);
    }
    return { name, data: Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data) };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { date, time } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const size = file.data.length;
    if (size > 0xffffffff || offset > 0xffffffff) throw new Error('ZIP64_NOT_SUPPORTED: archive entry exceeds 4 GiB');
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, file.data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + size;
  }
  const centralDirectory = Buffer.concat(centralParts);
  if (centralDirectory.length > 0xffffffff || offset > 0xffffffff || files.length > 0xffff) {
    throw new Error('ZIP64_NOT_SUPPORTED: archive exceeds ZIP32 limits');
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export async function zipFilesFromDirectory(directory, files) {
  const entries = [];
  for (const name of files) {
    const fullPath = path.join(directory, name);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      entries.push({ name, data: fs.readFileSync(fullPath) });
    }
  }
  return entries;
}

export async function collectDirectoryEntries(directory, prefix, predicate = () => true) {
  const files = await walkFiles(directory, predicate);
  return files.map((file) => ({
    name: `${prefix}/${normalizeRelative(path.relative(directory, file))}`,
    data: fs.readFileSync(file)
  }));
}

export function isZip(buffer) {
  return Buffer.isBuffer(buffer) && headerSignature(buffer, 0x04034b50);
}
