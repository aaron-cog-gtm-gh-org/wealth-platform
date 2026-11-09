# Implementation Plan: Archive indexing & settlements

**Branch**: `002-archive-index` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

## Summary
This feature copies the legacy archive byte-for-byte into `archive/`. It ports `ArchiveIndex` and `SettlementReader` as pure functions over an `ArchiveSource` seam, and adds a Node file-system adapter in `server/pv/`. Parity is proven against the legacy golden output.

## Technical Context
**Language/Version**: TypeScript 5.6, Node 22 · **Dependencies**: none new · **Storage**: files in `archive/` ·
**Testing**: Vitest (`src/domain/**`, `server/pv/**`) · **Project Type**: web app ·
**Performance**: full index in about 0.7 s · **Scale**: 6,044 files, 25 MB

## Constitution Check
| Principle | Status |
| --- | --- |
| I Parity | PASS: golden comparison of index and settlements; Q7/Q9/Q10/Q18 preserved |
| II Pure core | PASS: `src/domain/archive` sees only `ArchiveSource`; singleton removed; clock injected |
| III Legacy fixtures | PASS: `ToAmount_*` ported; `ArchiveFileTests` ported as skipped, with reasons |
| V No regression | PASS: no screen, workspace or QA change; one CI step added |
| VI Secure | PASS: raw lookup only through `findArchiveFile` |
| VII Traceability | PASS: `legacy:` comments |

## Project Structure
```text
archive/                      # byte-for-byte legacy copy (.gitattributes archive/** -text)
src/domain/archive/
├── source.ts                 # ArchiveSource, memorySource
├── archive-index.ts          # buildArchiveIndex, makeEntry, findArchiveFile, statementKey
├── settlements.ts            # getSettlements, toAmount
└── archive.test.ts
server/pv/
├── archive-fs.ts             # fsArchiveSource, readArchiveBytes, DEFAULT_ARCHIVE_ROOT
├── legacy-golden.ts          # test loader for parity/legacy-golden
└── archive.golden.test.ts    # manifest + golden parity
```

## Complexity Tracking
None.
