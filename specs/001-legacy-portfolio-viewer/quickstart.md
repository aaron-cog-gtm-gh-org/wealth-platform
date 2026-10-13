# Quickstart: Validate Custody (Legacy Portfolio Viewer) Integration

**Feature**: [spec.md](./spec.md) | Contract: [contracts/api.md](./contracts/api.md) |
Model: [data-model.md](./data-model.md)

This guide proves the feature end-to-end once implemented. Expected figures come from
[legacy-as-built.md](./legacy-as-built.md) §7–§9.

## Prerequisites

- Wealth Platform setup per `docs/oracle-setup.md` (Node 20, Docker, Oracle Free container).
- A checkout of `aaron-cog-gtm-gh-org/legacy-wealth-platform` (archive + seed SQL) at `$LEGACY`.
- For regenerating parity fixtures only: Windows with .NET Framework 4.8 build tools.

## 1. Unit and parity tests (no database)

```bash
npm run test:unit            # tsx --test server/custody/__tests__
```

Expected: parser cases for 0/1/2-decimal amounts, 5/7/8-digit safes, RPLC vs NEWM/DUPL, cross-day
CANC, FAMT vs UNIT, LF-only files, SUBSAFE; parity suite compares against
`fixtures/custody/legacy/*.json` with only the D-1..D-5 deviations allowed.

## 2. Load schema, legacy reference data and full archive

```bash
npm run db:up && npm run db:wait && npm run db:setup   # also migrates data/legacy-pv seed + archive
# re-run pieces on their own:
npm run custody:migrate-legacy -- --seed data/legacy-pv/seed
npm run custody:ingest -- --archive data/legacy-pv/archive
```

Expected ingest summary: 6,044 files seen, 6,044 new, 0 parse errors, 3,073 statements,
2,971 confirmations, 0 unmatched cancellations. Re-running the ingest: 0 new (SC-007).

## 3. API checks

```bash
npm run api
curl 'localhost:3001/api/clients?q=' # households + 50 custody clients
curl 'localhost:3001/api/custody/position-checks?date=2026-07-17'
curl 'localhost:3001/api/custody/position-checks?date=2026-07-17&mode=legacy'
```

| Check | Expected |
|---|---|
| Corrected breaks across all statement dates | 2 — account 2001 `GB00ZZ011962` (2026-07-17), account 2074 `GB00ZZ000908` (2026-07-31) |
| Legacy-mode breaks across all dates | 7 (adds 16056/07-17, 16558/06-26 & 07-03, 10554/09-18, 11397/09-18) |
| Confirmations for safe 16056 around 2026-07-14 | cancelled original not listed |
| Any one-decimal amount, e.g. `GBP21637,5` | `"21637.50"` |
| Statement 16558 / 2026-06-26 | `functionCode: "RPLC"`, `superseded: 2` |
| Statement line for `GB00ZZ004322` | custodian name, `nameVerified: false` |
| `/api/clients` | lists HH-WHITFIELD and all 50 migrated clients |
| `/api/custody/clients/:id/portfolio` for a GBP account | values as GBP strings, `currency: "GBP"` |
| `PATCH` break note without `author` | 400 |

## 4. UI walk-through

To run the legacy Portfolio Viewer alongside for comparison, see `.agents/skills/running-legacy-portfolio-viewer/SKILL.md`.

```bash
npm run dev:full
```

1. Open the client picker in the header → search a legacy surname → pick the client (no login).
2. Client 360 shows the legacy client with GBP (£) totals; Portfolio shows the latest effective
   statement; drift/rebalance/performance panels read "not available".
3. From Portfolio open Custody Holdings → change statement date → lines and totals update.
4. Custody Settlements → default 90-day window; FOP rows labelled.
5. `?screen=position-check` → Check All for 2026-07-17 → enter your name, edit the break note only →
   status unchanged; history shows the change and your name.
6. Click a break's source link → Message Browser shows raw MT535 text.
7. `?screen=custody-admin` → counts match §2; run ingest → 0 new.
8. Pick HH-WHITFIELD again → existing CAD household screens unchanged.

## 5. Decommission sign-off

All rows of legacy-as-built §4 have a passing step above; legacy-mode numbers reviewed by
operations; Portfolio Viewer read-only for one statement cycle, then switched off.
