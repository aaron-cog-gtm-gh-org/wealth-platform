// I/O seam for the archive (constitution II): the index builder only sees this interface.
// Paths are relative to the archive root with `/` separators, e.g. `mt54x/20260420/MT545_11521_20260420_001.txt`.

export interface ArchiveFileRef {
  path: string;
  /** byte length (legacy FileInfo.Length) */
  size: number;
}

export interface ArchiveListing {
  /** `mt535/*.txt`; null when the folder does not exist */
  mt535: ArchiveFileRef[] | null;
  /** `mt54x/<day>/*.txt` per day folder; null when `mt54x` does not exist */
  mt54x: { folder: string; files: ArchiveFileRef[] }[] | null;
}

export interface ArchiveSource {
  /** label for logs/admin (legacy ArchiveIndex.Root) */
  readonly root: string;
  list(): ArchiveListing;
  /** file text as File.ReadAllText returns it (UTF-8, BOM removed) */
  read(path: string): string;
}

const isTxt = (p: string) => /\.txt$/i.test(p);

/** In-memory source for tests and fixtures: keys are archive-relative paths. */
export function memorySource(files: Record<string, string>, root = 'memory'): ArchiveSource {
  const enc = new TextEncoder();
  const ref = (path: string): ArchiveFileRef => ({ path, size: enc.encode(files[path]).length });
  const paths = Object.keys(files);
  const has = (prefix: string) => paths.some(p => p.startsWith(prefix));
  return {
    root,
    list() {
      const folders = [...new Set(paths.filter(p => /^mt54x\/[^/]+\//.test(p)).map(p => p.split('/')[1]))];
      return {
        mt535: has('mt535/') ? paths.filter(p => /^mt535\/[^/]+$/.test(p) && isTxt(p)).map(ref) : null,
        mt54x: has('mt54x/')
          ? folders.map(folder => ({
              folder,
              files: paths.filter(p => p.startsWith(`mt54x/${folder}/`) && p.split('/').length === 3 && isTxt(p)).map(ref),
            }))
          : null,
      };
    },
    read(path) {
      if (!(path in files)) throw new Error(`Could not find file '${path}'.`);
      return files[path];
    },
  };
}
