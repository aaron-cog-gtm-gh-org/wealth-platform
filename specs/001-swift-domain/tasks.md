# Tasks: SWIFT domain & parsing

**Input**: Design documents from `specs/001-swift-domain/`

## Phase 1: Setup

- [x] T001 Add Vitest devDependency and `test:domain` script in package.json
- [x] T002 Create vitest.config.ts limited to `src/domain/**/*.test.ts` and add it to tsconfig.json include

## Phase 2: Foundational

- [x] T003 [P] Implement exact decimal in src/domain/decimal.ts
- [x] T004 [P] Implement IsoDate helpers and DateUtil.FormatDate in src/domain/date.ts
- [x] T005 [P] Implement .NET string/path/int helpers in src/domain/dotnet.ts
- [x] T006 Decimal/date tests in src/domain/decimal.test.ts

## Phase 3: User Story 1 - Read a holdings statement (P1)

- [x] T007 [US1] Copy legacy fixtures to src/domain/swift/__fixtures__/legacy.ts
- [x] T008 [US1] Port SwiftParserTests to src/domain/swift/parser.legacy.test.ts (fails first)
- [x] T009 [P] [US1] Port Models.cs to src/domain/swift/models.ts
- [x] T010 [P] [US1] Port SwiftMessage.cs to src/domain/swift/message.ts
- [x] T011 [US1] Port SwiftParser.Parse/ParseStatement/FileSeq/ParseDecimal to src/domain/swift/parser.ts
- [x] T012 [US1] Q1–Q5 edge-case tests in src/domain/swift/parser.test.ts

## Phase 4: User Story 2 - Read a settlement confirmation (P1)

- [x] T013 [US2] Port SwiftParser.ParseConfirm to src/domain/swift/parser.ts
- [x] T014 [US2] Q6 edge-case tests in src/domain/swift/parser.test.ts

## Phase 5: User Story 3 - Exact numbers and legacy formats (P2)

- [x] T015 [US3] Port WebUtil display helpers to src/domain/format.ts
- [x] T016 [US3] Format tests in src/domain/decimal.test.ts

## Phase 6: Polish

- [x] T017 Barrels src/domain/index.ts and src/domain/swift/index.ts
- [x] T018 Document contracts in specs/001-swift-domain/contracts/domain-swift.md
- [x] T019 Run lint, typecheck, build, test:unit, test:backend, test:domain
