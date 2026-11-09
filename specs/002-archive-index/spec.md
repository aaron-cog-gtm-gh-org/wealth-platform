# Feature Specification: Archive indexing & settlements (Portfolio Viewer migration 002)

**Feature Branch**: `002-archive-index`

**Created**: 2026-11-09

**Status**: Implemented

**Input**: "Archive indexing: port ArchiveIndex + SettlementReader to read the archive/ layout (or an abstraction over it)." Plus: copy the legacy `archive/` byte-for-byte and record a checksum manifest, with no data generators.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The whole archive is available to the new app (Priority: P1)

Parity checks and every later screen read the same 6,044 custodian files that the legacy app read.

**Independent Test**: hash every file in `archive/` against `parity/legacy-oracle/archive-manifest.sha256`.

**Acceptance Scenarios**:

1. **Given** the repository checkout, **When** `sha256sum -c parity/legacy-oracle/archive-manifest.sha256` runs from the repo root, **Then** all 6,044 files pass and no extra files exist.
2. **Given** a git checkout on any OS, **When** files are checked out, **Then** line endings are unchanged (`.gitattributes` `archive/** -text`).

### User Story 2 - Index the archive (Priority: P1)

The system builds one index of statements (by unpadded safekeeping account, then statement date), confirmations (by day folder, in file-name order) and a flat file list for the message browser. Like legacy, it counts and logs parse errors without failing.

**Independent Test**: build the index from `archive/` and compare it with the legacy golden output `archiveIndex` section.

**Acceptance Scenarios**:

1. **Given** the archive copy, **When** indexed, **Then** 3,073 MT535 files, 2,971 MT54x files, 0 parse errors, 120 statement accounts and 122 confirm folders are found, and every file entry, statement and confirmation equals the golden output.
2. **Given** a file that fails to parse, **When** indexed, **Then** it still appears in the file list and counts, `parseErrors` increments, and a warning `{fileName, message}` is recorded.

### User Story 3 - Settlements for an account (Priority: P1)

Settlement and reconciliation screens get the confirmations for one custodian account and date range.

**Independent Test**: for every account, the Settlements-page 90-day default and the full range equal the golden `settlementsDefault90d` / `settlementsFullRange` (1,572 + 2,950 items), including `ToAmount`.

**Acceptance Scenarios**:

1. A CANC removes the confirmation whose SEME equals its PREV, but only inside the same day folder (Q9).
2. The account is compared exactly, so callers pad SAFE_CODE to 7 digits. 8-digit `97A::SAFE` confirmations (`00011397`, `00010554`) never match (Q18).
3. The date range is inclusive, and results are sorted newest settle date first.
4. `ToAmount("GBP4303,01")` is 4303.01, `ToAmount("USD192,")` is 192, and `ToAmount("GBP11524,8")` is 11524.08 (Q10).

### Edge Cases

- If `mt535` or `mt54x` is missing, that part of the index is empty.
- Files other than `*.txt` are ignored.
- File names with fewer than three `_` parts get a null safe code and the date `0001-01-01`.
- A CANC without PREV removes every active confirmation without SEME in its folder (legacy `null == null`).
- `ToAmount` throws when given fewer than 3 characters, an empty whole part, or a `.` decimal. A fraction with three or more digits is still divided by 100 (`GBP1,123` gives 2.23).
- Ties within one settle date: legacy `List.Sort` is unstable, so their order is undefined. The port orders ties by folder, then file name, which is the oracle's order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The legacy `archive/` MUST be copied unchanged to the repo-root `archive/`. Its checksum manifest is `parity/legacy-oracle/archive-manifest.sha256`, with paths relative to the repo root. A Vitest case re-verifies it, and no generator scripts are added.
- **FR-002**: Index building MUST go through an injected `ArchiveSource` (list + read). The domain MUST NOT touch the file system. A Node adapter in `server/pv/` reads `archive/` (or `PV_ARCHIVE_ROOT`).
- **FR-003**: The index MUST reproduce `ArchiveIndex.Build`: per-file counts, keys trimmed of leading zeros, statements grouped by date, confirmations sorted ordinally by file name, files sorted ordinally by path, and parse errors counted and logged.
- **FR-004**: The index MUST be an explicit value, replacing the static `Current`/`Reload` singleton (constitution II). Load time comes from an injected clock.
- **FR-005**: `getSettlements(index, custAcct, from, to)` and `toAmount(raw)` MUST reproduce `SettlementReader` (Q9, Q10, Q18).
- **FR-006**: Raw-file access MUST resolve through the index (`findArchiveFile`), never by building a path from user input.
- **FR-007**: The legacy tests `ToAmount_*` MUST be ported. `ArchiveFileTests` MUST be ported as skipped, because they are ignored in legacy and their file is not in the archive.

### Key Entities

- **ArchiveSource / ArchiveListing / ArchiveFileRef**: the I/O seam.
- **ArchiveIndex**: counts, parse-error log, `statements` map, `confirmFolders` map and `files`.
- **ArchiveFileEntry**: `path`, `fileName`, `msgType`, `date`, `safeCode` and `size`.

## Decisions

| Topic | Decision |
| --- | --- |
| Archive location | Repo-root `archive/`, so the same relative paths as legacy and the parity manifest are used verbatim |
| Manifest | `parity/legacy-oracle/archive-manifest.sha256` (from the oracle capture) is the single manifest. There is no second copy inside `archive/`, because that would change the tree. |
| Paths | Archive-relative with `/` (`mt54x/20260420/MT545_….txt`) instead of absolute Windows paths. `folder` and `fileName` are unchanged, and no absolute path is ever exposed. |
| Enumeration order | `Directory.GetFiles`/`GetDirectories` order is replaced with ordinal order. It only affects map insertion order. |
| CI | `npm run test:domain` is added to `.github/workflows/validation.yml` |

## Quirk decisions

Q7 (index keys), Q9 (exact account compare, CANC per folder), Q10 (hundredths) and Q18 (8-digit SAFE) are all preserved. **No divergences.**

## Success Criteria *(mandatory)*

- **SC-001**: 6,044/6,044 archive files match the manifest.
- **SC-002**: The index and both settlement ranges for all 120 accounts equal the legacy golden output.
- **SC-003**: Indexing the full archive takes under 5 s on the CI runner (measured at about 0.7 s locally).
- **SC-004**: Lint, typecheck, build and the existing suites pass.

## Assumptions

- The archive is static, synthetic data. The 25 MB checked-in copy is acceptable.
- `File.ReadAllText` behaves like a UTF-8 decode with BOM removal. All archive files are ASCII.
