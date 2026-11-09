# Contract: `src/domain/archive` (spec 002)

```ts
interface ArchiveSource { readonly root: string; list(): ArchiveListing; read(path: string): string }
memorySource(files: Record<string, string>, root?): ArchiveSource             // tests/fixtures

buildArchiveIndex(source, { clock?: () => Date }): ArchiveIndex               // ArchiveIndex.Build
makeEntry(path, size, msgType): ArchiveFileEntry                               // ArchiveIndex.MakeEntry
findArchiveFile(index, path): ArchiveFileEntry | null                          // indexed raw lookup
statementKey(safeCode): string                                                 // TrimStart('0')

getSettlements(index | null, custAcct, from: IsoDate, to: IsoDate): SettlementConfirm[]  // SettlementReader.GetSettlements
toAmount(raw: string): Decimal                                                 // SettlementReader.ToAmount (throws)
```

Callers:
- **Settlements page (007)**: `getSettlements(idx, safeCode.padStart(7, '0'), latest - 90d, latest)` by default. The amount is `toAmount(amountRaw)`, or 0 when `amountRaw` is null.
- **Message browser (009)**: lists `index.files` and serves raw bytes only for a `findArchiveFile` hit.

## Server adapter (`server/pv/archive-fs.ts`)
```ts
DEFAULT_ARCHIVE_ROOT                     // <repo>/archive
fsArchiveSource(root = process.env.PV_ARCHIVE_ROOT ?? DEFAULT_ARCHIVE_ROOT): ArchiveSource
readArchiveBytes(root, relPath): Buffer  // only for paths returned by findArchiveFile
```

## Archive layout (`archive/`)
`mt535/MT535_<safe>_<yyyyMMdd>_<seq>.txt` · `mt54x/<yyyyMMdd>/MT54n_<safe>_<yyyyMMdd>_<seq>.txt`.
Manifest: `parity/legacy-oracle/archive-manifest.sha256` (`sha256sum -c` from the repo root).
