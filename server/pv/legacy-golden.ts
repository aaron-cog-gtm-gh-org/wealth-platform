// Loader for the legacy parity oracle output (parity/legacy-golden, format pv-legacy-golden/1). Test-only.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const GOLDEN_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../parity/legacy-golden/legacy-golden.json.gz');
export const MANIFEST_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../parity/legacy-oracle/archive-manifest.sha256');

export type Golden = any;
let cached: Golden | null = null;
export function loadGolden(): Golden {
  cached ??= JSON.parse(gunzipSync(readFileSync(GOLDEN_PATH)).toString('utf8'));
  return cached;
}
