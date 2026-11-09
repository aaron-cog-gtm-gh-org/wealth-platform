# Tasks: 009 Message Browser

## Phase 1: Setup
- [x] T001 Add `messages` to `SCREENS` and `msgPage` to `UiState` in src/types.ts

## Phase 2: Foundational
- [x] T002 `findArchiveFileByName` in src/domain/archive/archive-index.ts (+ vitest)
- [x] T003 Raw route `?file=` + `X-Archive-Path` in server/pv/routes.ts (+ backend test); `archiveFileByName` in src/api/pv.ts
- [x] T004 `parseMessageQuery` / `parseMessageDate` in src/model/pv/message-query.ts; `messages` on `PvContext`, `PV_SCREEN_KEYS` in src/model/pv/context.ts
- [x] T005 Slice + preview (src/model/pv/messages-slice.ts, messages-preview.ts); register in `PV_SLICES`; `screen: 'messages'` on the `PV_PAGES` row; `setParams` on `PvModelInput`

## Phase 3: User stories
- [x] T006 [US1] `buildMessageBrowser` (filters, list, 50-row pager) in src/model/messages.ts; src/screens/Messages.tsx
- [x] T007 [US2] Native date input; ISO + dd/MM/yyyy `?date=`; invalid-date notice
- [x] T008 [US3] Raw viewer (index lookup by name, not found, close)
- [x] T009 [US4] Shell META/EMPTY/ERR + Empty CTA "Clear filters"; buildScreens + App render branch; nav keys dropped on leave

## Phase 4: Verification
- [x] T010 src/model/pv/messages.test.ts (dates both forms, query, slice, VM, paging, roles/nav); update pv.test.ts nav expectations
- [x] T011 visual-diff app-only: messages × 4 + flows, baselines
- [x] T012 lint, typecheck, build, test:unit, test:domain, test:backend, test:db, qa:test; full visual-diff with mockup counts unchanged
