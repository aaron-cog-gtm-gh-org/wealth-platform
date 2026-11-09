# Implementation Plan: PV data layer & /api/pv

**Branch**: `004-pv-data-api` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

## Summary
This feature adds a dedicated `pv` PostgreSQL schema with the seed data, an Express router at `/api/pv` over the spec 001–003 domain, signed-token auth with legacy roles, and a typed client in `src/api/`.

## Technical Context
**Stack**: Express, pg, node:crypto (scrypt, HMAC). There are no new dependencies. **Testing**: `node --test` integration suite (`server/pv/api.int.test.ts`, part of `test:int`) against a throwaway database.

## Constitution Check
| Principle | Status |
| --- | --- |
| I Parity | PASS: golden parity over HTTP |
| II Pure core | PASS: SQL and fs live only in `server/pv` |
| IV Security | PASS: parameterized SQL, server-side roles, no SHA1, raw files via the index |
| V No regression | PASS: existing routes and suites unchanged; `/api/pv` is mounted before the `/api` 404 |
| Data-layer default | Kept, no amendment |

## Project Structure
```text
server/db/pv-schema.sql, pv-seed.sql     # added to setup DEFAULT_FILES
server/pv/auth.ts                        # scrypt, token, login, requireSession, requireRole
server/pv/context.ts                     # index singleton, pg providers, saveNote
server/pv/routes.ts                      # pvRouter
server/pv/set-password.ts                # npm run pv:set-password
server/pv/api.int.test.ts
src/api/pv.ts, src/api/pv-types.ts
```
