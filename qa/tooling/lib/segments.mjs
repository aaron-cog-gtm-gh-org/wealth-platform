import fs from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { diagnostic, normalizeRelative, walkFiles } from './common.mjs';
import { createZip, crc32 } from './zip.mjs';

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function pathExists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

function safeEntryName(name) {
  if (!name || name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[a-z]:/i.test(name)) {
    fail('ZIP_ENTRY_PATH', `invalid archive entry path "${name}"`);
  }
  const isDirectory = name.endsWith('/');
  const cleanName = isDirectory ? name.slice(0, -1) : name;
  const parts = cleanName.split('/');
  if (!cleanName || parts.some((part) => !part || part === '.' || part === '..')) {
    fail('ZIP_ENTRY_PATH', `invalid archive entry path "${name}"`);
  }
  return { name: parts.join('/'), parts, isDirectory };
}

function parseZip(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) fail('ZIP_INVALID', 'archive is too small');
  const firstEndRecord = Math.max(0, buffer.length - 22 - 0xffff);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= firstEndRecord; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === buffer.length) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) fail('ZIP_INVALID', 'end-of-central-directory record is missing');

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDisk = buffer.readUInt16LE(endOffset + 6);
  const diskCount = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (diskNumber !== 0 || centralDisk !== 0 || diskCount !== entryCount) {
    fail('ZIP_INVALID', 'multi-disk ZIP archives are not supported');
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    fail('ZIP_INVALID', 'ZIP64 archives are not supported');
  }
  const centralEnd = centralOffset + centralSize;
  if (centralEnd > endOffset || centralEnd > buffer.length) {
    fail('ZIP_INVALID', 'central directory is outside the archive');
  }

  const entries = [];
  const names = new Map();
  const ranges = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralEnd || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      fail('ZIP_INVALID', 'central directory entry is malformed');
    }
    const versionMadeBy = buffer.readUInt16LE(cursor + 4);
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const recordEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (recordEnd > centralEnd) fail('ZIP_INVALID', 'central directory entry is truncated');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      fail('ZIP_INVALID', 'ZIP64 entries are not supported');
    }
    if (flags & 1) fail('ZIP_ENCRYPTED', 'encrypted ZIP entries are not supported');
    if (method !== 0 && method !== 8) fail('ZIP_METHOD_UNSUPPORTED', `compression method ${method} is not supported`);

    const entryName = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const safeName = safeEntryName(entryName);
    const previous = names.get(safeName.name);
    if (previous) fail('ZIP_DUPLICATE_ENTRY', `duplicate archive entry "${entryName}"`);

    const creatorOs = versionMadeBy >>> 8;
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const unixType = unixMode & 0o170000;
    if (creatorOs === 3 && unixType === 0o120000) {
      fail('ZIP_ENTRY_SYMLINK', `symbolic-link entry "${entryName}" is not allowed`);
    }
    if (creatorOs === 3 && unixType && unixType !== 0o100000 && unixType !== 0o040000) {
      fail('ZIP_ENTRY_TYPE', `special-file entry "${entryName}" is not allowed`);
    }
    const isDirectory = safeName.isDirectory || (creatorOs === 3 && unixType === 0o040000);
    if (isDirectory && uncompressedSize !== 0) {
      fail('ZIP_ENTRY_TYPE', `directory entry "${entryName}" contains data`);
    }

    if (localOffset + 30 > centralOffset || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      fail('ZIP_INVALID', `local header for "${entryName}" is malformed`);
    }
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const localDataStart = localNameStart + localNameLength + localExtraLength;
    const localName = buffer.toString('utf8', localNameStart, localNameStart + localNameLength);
    const dataEnd = localDataStart + compressedSize;
    if (localName !== entryName || localFlags !== flags || localMethod !== method || dataEnd > centralOffset) {
      fail('ZIP_INVALID', `local and central headers disagree for "${entryName}"`);
    }

    const compressed = buffer.subarray(localDataStart, dataEnd);
    let data;
    try {
      data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    } catch {
      fail('ZIP_INVALID', `entry "${entryName}" could not be decompressed`);
    }
    if (data.length !== uncompressedSize || crc32(data) !== crc) {
      fail('ZIP_CRC_MISMATCH', `entry "${entryName}" failed size or CRC validation`);
    }

    names.set(safeName.name, isDirectory ? 'directory' : 'file');
    entries.push({ ...safeName, isDirectory, data, localOffset, dataEnd });
    ranges.push({ start: localOffset, end: dataEnd, name: entryName });
    cursor = recordEnd;
  }
  if (cursor !== centralEnd) fail('ZIP_INVALID', 'central directory size does not match its entries');

  for (const entry of entries) {
    for (let index = 1; index < entry.parts.length; index += 1) {
      const parent = entry.parts.slice(0, index).join('/');
      if (names.get(parent) === 'file') fail('ZIP_ENTRY_PATH', `file entry "${parent}" is a parent of "${entry.name}"`);
    }
    if (!entry.isDirectory && [...names.keys()].some((name) => name.startsWith(`${entry.name}/`))) {
      fail('ZIP_ENTRY_PATH', `file entry "${entry.name}" conflicts with a directory path`);
    }
  }
  ranges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index - 1].end > ranges[index].start) {
      fail('ZIP_INVALID', `local entries "${ranges[index - 1].name}" and "${ranges[index].name}" overlap`);
    }
  }
  return entries;
}

export async function packSegment(segmentPath, outputPath) {
  const segment = path.resolve(segmentPath);
  const output = path.resolve(outputPath);
  if (!fs.existsSync(segment) || !fs.lstatSync(segment).isDirectory()) {
    return { errors: [diagnostic('SEGMENT_MISSING', segment, 'segment directory does not exist')] };
  }
  if (pathExists(output)) return { errors: [diagnostic('OUTPUT_EXISTS', output, 'refusing to overwrite output')] };
  const metaPath = path.join(segment, 'run-meta.json');
  if (!fs.existsSync(metaPath) || !fs.lstatSync(metaPath).isFile()) {
    return { errors: [diagnostic('RUN_META_MISSING', segment, 'segment requires run-meta.json')] };
  }
  try {
    const files = await walkFiles(segment);
    const entries = files.map((file) => ({
      name: normalizeRelative(path.relative(segment, file)),
      data: fs.readFileSync(file)
    }));
    const bytes = createZip(entries);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, bytes, { flag: 'wx' });
    return { errors: [], zipPath: output, entryCount: entries.length, size: bytes.length };
  } catch (error) {
    const code = error.code === 'EEXIST' ? 'OUTPUT_EXISTS' : error.code ?? 'PACK_SEGMENT_FAILED';
    return { errors: [diagnostic(code, output, error.message)] };
  }
}

export function unpackSegment(zipPath, targetPath) {
  const archive = path.resolve(zipPath);
  const target = path.resolve(targetPath);
  if (pathExists(target)) return { errors: [diagnostic('TARGET_EXISTS', target, 'refusing to extract into an existing path')] };
  if (!fs.existsSync(archive) || !fs.lstatSync(archive).isFile()) {
    return { errors: [diagnostic('ZIP_MISSING', archive, 'ZIP file does not exist')] };
  }

  let entries;
  try {
    entries = parseZip(fs.readFileSync(archive));
  } catch (error) {
    return { errors: [diagnostic(error.code ?? 'ZIP_INVALID', archive, error.message)] };
  }

  let created = false;
  try {
    fs.mkdirSync(target, { recursive: true });
    created = true;
    for (const entry of entries) {
      const destination = path.resolve(target, ...entry.parts);
      const relative = path.relative(target, destination);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        fail('ZIP_ENTRY_PATH', `archive entry escapes target: "${entry.name}"`);
      }
      if (entry.isDirectory) {
        fs.mkdirSync(destination, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, entry.data, { flag: 'wx' });
      }
    }

    const metaPath = path.join(target, 'run-meta.json');
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      fail('SEGMENT_MISMATCH', 'extracted segment has no valid run-meta.json');
    }
    const expected = {
      runId: path.basename(path.dirname(path.dirname(target))),
      phase: path.basename(path.dirname(target)),
      label: path.basename(target)
    };
    if (meta.runId !== expected.runId || meta.phase !== expected.phase || meta.label !== expected.label) {
      fail(
        'SEGMENT_MISMATCH',
        `run-meta.json identifies ${meta.runId ?? 'unknown'}/${meta.phase ?? 'unknown'}/${meta.label ?? 'unknown'}, expected ${expected.runId}/${expected.phase}/${expected.label}`
      );
    }
    return { errors: [], targetDir: target, entryCount: entries.length };
  } catch (error) {
    if (created) fs.rmSync(target, { recursive: true, force: true });
    return { errors: [diagnostic(error.code ?? 'UNPACK_SEGMENT_FAILED', target, error.message)] };
  }
}
