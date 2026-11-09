# Tasks: Archive indexing & settlements

## Phase 1: Setup
- [x] T001 Copy legacy archive/ byte-for-byte to archive/ and add .gitattributes `archive/** -text`
- [x] T002 Extend vitest.config.ts include to server/pv/**/*.test.ts; add `npm run test:domain` to .github/workflows/validation.yml

## Phase 2: User Story 1 - Archive available (P1)
- [x] T003 [US1] Manifest verification test in server/pv/archive.golden.test.ts

## Phase 3: User Story 2 - Index the archive (P1)
- [x] T004 [P] [US2] ArchiveSource seam + memorySource in src/domain/archive/source.ts
- [x] T005 [US2] Unit tests for the index in src/domain/archive/archive.test.ts (fail first)
- [x] T006 [US2] Port ArchiveIndex.Build/MakeEntry + findArchiveFile in src/domain/archive/archive-index.ts
- [x] T007 [P] [US2] Node adapter server/pv/archive-fs.ts
- [x] T008 [US2] Golden loader server/pv/legacy-golden.ts and index parity tests in server/pv/archive.golden.test.ts

## Phase 4: User Story 3 - Settlements (P1)
- [x] T009 [US3] Port ToAmount_* NUnit cases and Q9/Q10/Q18 tests in src/domain/archive/archive.test.ts
- [x] T010 [US3] Port SettlementReader in src/domain/archive/settlements.ts
- [x] T011 [US3] Settlement golden parity (90-day + full range, all accounts) in server/pv/archive.golden.test.ts

## Phase 5: Polish
- [x] T012 Port ArchiveFileTests as skipped with legacy reasons
- [x] T013 Barrel exports in src/domain/archive/index.ts and src/domain/index.ts
- [x] T014 Contracts in specs/002-archive-index/contracts/domain-archive.md
- [x] T015 Lint, typecheck, build, test:unit, test:backend, test:domain
