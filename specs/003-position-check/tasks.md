# Tasks: Position building & reconciliation

## Phase 1: Foundational
- [x] T001 Provider interfaces + in-memory providers in src/domain/positions/providers.ts

## Phase 2: User Story 1 - Holdings (P1)
- [x] T002 [US1] Tests for PositionBuilder in src/domain/positions/positions.test.ts
- [x] T003 [US1] Port PositionBuilder + holdingLines in src/domain/positions/position-builder.ts
- [x] T004 [US1] Golden holdings/dates/selected-file parity in server/pv/positions.golden.test.ts

## Phase 3: User Story 2 - Position check (P1)
- [x] T005 [US2] Port ExpectedQty_PrevPlusRecMinusDel + Q11/Q18 tests in src/domain/positions/positions.test.ts
- [x] T006 [US2] Port PositionCheck.Run in src/domain/positions/position-check.ts
- [x] T007 [US2] Golden Run parity (3,065) + Q18 assertion in server/pv/positions.golden.test.ts

## Phase 4: User Story 3 - Check All (P2)
- [x] T008 [US3] checkAll in src/domain/positions/position-check.ts with tests and golden parity

## Phase 5: Polish
- [x] T009 Barrel exports; contracts in specs/003-position-check/contracts/domain-positions.md
- [x] T010 Lint, typecheck, build, test:unit, test:backend, test:domain
