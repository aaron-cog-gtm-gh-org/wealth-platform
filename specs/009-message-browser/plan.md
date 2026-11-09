# Implementation Plan: MessageBrowser.aspx → Message Browser screen

**Branch**: `009-message-browser` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

## Summary
A new `messages` screen (OPS/ADMIN) built on the spec 010 PV plumbing: the filters live in the URL (`type`, `date`, `safe`, `file`), are parsed into the PV context, and a `messages` slice loads the file list (`/api/pv/archive/files`) and, when a file is selected, the raw message (`/api/pv/archive/files/raw?file=`). `buildMessageBrowser` turns that into a view model with a 50-row pager; `src/screens/Messages.tsx` renders it in the RBC visual language. Dates are entered with a native date input; `?date=` accepts ISO and legacy `dd/MM/yyyy` (D-009-1).

## Technical Context
**Stack**: React 18 + TS, existing `src/api/pv.ts` client and Express `/api/pv`. No new dependencies. **Server change**: the raw route accepts `file=<name>` (index lookup by file name, the legacy `ShowFile` loop) next to `path=`, and sends `X-Archive-Path`. **Testing**: `node --test` model tests in `src/model/pv/messages.test.ts` (added to `test:unit`), a vitest case for `findArchiveFileByName` (test:domain), a backend case for `?file=` (test:backend), and visual-diff app-only cases with baselines.

## Constitution Check
| Principle | Status |
| --- | --- |
| I Parity | PASS: Q16 safe trimming and index-only raw access preserved; Q14 display preserved; Q17 roles preserved. D-009-1..5 named. |
| II Pure core | PASS: `findArchiveFileByName` is a pure function over the index in `src/domain/archive`; the browser uses the HTTP client only. |
| III Single source / IV view models | PASS: `PV_PAGES` row gets `screen: 'messages'`; slice in `PV_SLICES`; rendering from `buildMessageBrowser` via `buildScreens`; four DataStates. |
| IV Security | PASS: the raw route still never builds a path from input (`file` is matched against index entries; `readArchiveBytes` keeps its root check). `requireRole('OPS','ADMIN')` unchanged. |
| V No regression | PASS: additive edits only; mockup diff counts unchanged; existing PV tests updated only where the nav now includes Message browser. |
| VII Simplicity | PASS: one slice, one builder, one screen; paging client-side on the loaded list. |

## Project Structure
```text
src/domain/archive/archive-index.ts   # + findArchiveFileByName (legacy ShowFile)
server/pv/routes.ts                   # raw route: ?file= | ?path=, X-Archive-Path
src/api/pv.ts                         # + archiveFileByName
src/model/pv/message-query.ts         # parseMessageQuery, parseMessageDate (ISO | dd/MM/yyyy), toLegacyType
src/model/pv/messages-slice.ts        # messages slice (load / isEmpty / preview)
src/model/pv/messages-preview.ts      # synthetic preview (MT535, 2026-09-18, 118 files + one raw file)
src/model/messages.ts                 # buildMessageBrowser view model, MSG_PAGE_SIZE
src/model/pv/{context,slice,access}.ts, src/model/{shell,screens}.ts, src/types.ts   # additive registration
src/screens/Messages.tsx, src/App.tsx # screen + render branch, setParams, Empty CTA
scripts/visual-diff.mjs               # messages × 4 + flows; text/plain routes
```

## Complexity Tracking
None.
