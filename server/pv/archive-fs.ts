// Node file-system ArchiveSource over the in-repo archive copy (`archive/`, spec 002).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ArchiveFileRef, ArchiveSource } from '../../src/domain/archive/source';

export const DEFAULT_ARCHIVE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../archive');

const decoder = new TextDecoder('utf-8');
const isTxtFile = (dir: string, name: string) => /\.txt$/i.test(name) && statSync(join(dir, name)).isFile();

export function fsArchiveSource(root: string = process.env.PV_ARCHIVE_ROOT ?? DEFAULT_ARCHIVE_ROOT): ArchiveSource {
  const abs = (rel: string) => join(root, ...rel.split('/'));
  const files = (rel: string): ArchiveFileRef[] =>
    readdirSync(abs(rel)).filter(n => isTxtFile(abs(rel), n)).map(n => ({ path: `${rel}/${n}`, size: statSync(join(abs(rel), n)).size }));
  const dirExists = (rel: string) => existsSync(abs(rel)) && statSync(abs(rel)).isDirectory();
  return {
    root,
    list: () => ({
      mt535: dirExists('mt535') ? files('mt535') : null,
      mt54x: dirExists('mt54x')
        ? readdirSync(abs('mt54x'), { withFileTypes: true }).filter(d => d.isDirectory())
            .map(d => ({ folder: d.name, files: files(`mt54x/${d.name}`) }))
        : null,
    }),
    read: (rel: string) => decoder.decode(readFileSync(abs(rel))),
  };
}

/** Raw bytes of an indexed archive file (callers must resolve `rel` through findArchiveFile first). */
export const readArchiveBytes = (root: string, rel: string) => readFileSync(join(root, ...rel.split('/')));
