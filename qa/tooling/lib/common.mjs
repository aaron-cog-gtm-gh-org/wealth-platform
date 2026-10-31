import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const areasPath = path.join(repoRoot, 'qa/tooling/areas.json');

export function loadAreas(file = areasPath) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function relativeDisplay(file, cwd = process.cwd()) {
  if (!file) return '.';
  const resolved = path.resolve(file);
  const relative = path.relative(cwd, resolved);
  return (relative.startsWith('..') ? path.basename(resolved) : relative).split(path.sep).join('/');
}

export function diagnostic(code, file, message) {
  return { code, path: String(file || '.').split(path.sep).join('/'), message };
}

export function sortedDiagnostics(items = []) {
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  return [...items].sort((a, b) =>
    compare(a.code, b.code) || compare(a.path, b.path) || compare(a.message, b.message)
  );
}

export function printDiagnostics(errors = [], warnings = [], output = console) {
  for (const item of sortedDiagnostics(errors)) {
    output.error(`ERROR ${item.code} ${item.path}: ${item.message}`);
  }
  for (const item of sortedDiagnostics(warnings)) {
    output.warn(`WARN ${item.code} ${item.path}: ${item.message}`);
  }
}

export function parseFlags(args) {
  const flags = {};
  const rest = [];
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--') {
      rest.push(...args.slice(index + 1));
      break;
    }
    if (!item.startsWith('--')) {
      rest.push(item);
      continue;
    }
    const equal = item.indexOf('=');
    const key = item.slice(2, equal === -1 ? undefined : equal);
    let value;
    if (equal !== -1) value = item.slice(equal + 1);
    else if (args[index + 1] && !args[index + 1].startsWith('--')) value = args[++index];
    else value = true;
    if (Object.hasOwn(flags, key)) flags[key] = [...(Array.isArray(flags[key]) ? flags[key] : [flags[key]]), value];
    else flags[key] = value;
  }
  return { flags, rest };
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function walkFiles(directory, predicate = () => true) {
  const found = [];
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walkFiles(fullPath, predicate));
    else if (entry.isFile() && predicate(fullPath)) found.push(fullPath);
  }
  return found;
}

export function normalizeRelative(file) {
  return file.split(path.sep).join('/').replace(/^\.\//, '');
}

export function caseIdFromTitle(title = '') {
  return title.match(/^\[(WM-TC-\d{3}|WM-GAP-\d{3})\]\s+/)?.[1] ?? null;
}
