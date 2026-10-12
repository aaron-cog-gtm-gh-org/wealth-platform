# Phase 0 Research: Legacy Portfolio Viewer Integration

**Feature**: [spec.md](./spec.md) | **Legacy reference**: [legacy-as-built.md](./legacy-as-built.md)

## R-1 Integration strategy

- **Decision**: Re-implement the custodian ingestion and read model inside Wealth Platform
  (strangler pattern), screen by screen, then decommission Portfolio Viewer.
- **Rationale**: Legacy logic is small (~5 core classes) but tied to Web Forms, in-memory state and
  SQL Server; its value is in the rules and the data, both now documented and testable.
- **Alternatives considered**: (a) wrap Portfolio Viewer behind an API — rejected: .NET Framework
  4.8/IIS dependency, in-memory index, unfixed defects; (b) iframe/link out — rejected: two auth
  models, no shared data; (c) lift-and-shift to SQL Server alongside Oracle — rejected:
  Constitution I.

## R-2 Data ownership: raw messages vs normalized facts

- **Decision**: Store both. Each file becomes one `custody_messages` row (raw CLOB, SHA-256,
  source path) and derived rows reference it.
- **Rationale**: Constitution IV; Message Browser (US4) needs raw text; parser fixes can be replayed
  from stored raw text without the file share.
- **Alternatives considered**: normalized only (loses audit and US4); files only with index
  (repeats legacy in-memory design).

## R-3 Currency and account domain

- **Decision**: Widen `Currency` to `'CAD' | 'USD' | 'GBP' | 'EUR'`; custody amounts carry their own
  currency and the account's reporting currency (GBP for all migrated accounts). Account types
  normalized to `ISA | SIPP | GIA` (closed union), mapping the free-text variants.
- **Rationale**: Legacy is a UK GBP book; converting history to CAD would invent FX data.
- **Alternatives considered**: convert to CAD at migration (rejected: not custodian-reported);
  `string` currency (rejected: Constitution II).
- **Open for product owner**: confirm the legacy book is in scope as a business line on Wealth
  Platform (vs. reference-only archive).

## R-4 Client/account identity

- **Decision**: New `custody_clients` / `custody_accounts` tables keyed by legacy IDs, with
  `safe_no NUMBER` (numeric safekeeping key) and nullable `platform_client_id` for future linking
  to `clients`.
- **Rationale**: Fixes D-2 by construction (numeric key); avoids fabricating household fields.

## R-5 Effective statement and cancellation rules

- **Decision**: Effective statement = latest `RPLC` by sequence, else latest `NEWM` (excluding
  `NEWM/DUPL`), else latest by sequence. Identical-content `NEWM` resends are stored as separate
  messages; either yields the same lines.
  Cancellations resolved globally by `(safe_no, PREV = SEME)` after each ingest run; an orphan
  cancellation is kept and flagged until its original arrives.
- **Rationale**: Fixes D-3, D-4; matches ISO 15022 semantics of `RPLC`/`DUPL`/`CANC`.
- **Legacy-parity mode**: rules BR-1..BR-5 implemented side by side (`mode=legacy`) for sign-off.

## R-6 Decimal and quantity handling

- **Decision**: Parse SWIFT decimals as strings → fixed-point (`NUMBER(18,6)` in Oracle; integer
  minor units / string decimals in TS, never `Number` arithmetic on amounts). `FAMT` and `UNIT`
  quantities stored with `qty_type` and never summed together.
- **Rationale**: Fixes D-1; avoids float error; bonds reported as face amount.

## R-7 Parity fixtures

- **Decision**: Build `tools/legacy-parity`, a .NET 4.8 console app referencing `PV.Core`, that
  writes JSON for every statement, confirmation list and position check over the committed
  archive. Commit outputs under `fixtures/custody/legacy/`. A scratch re-implementation already
  reproduces 7 legacy / 2 corrected breaks (legacy-as-built §9) and is used to cross-check.
- **Rationale**: Constitution III — the legacy binary, not our reading of it, is the oracle.
- **Alternatives considered**: hand-written expectations (rejected: not authoritative).

## R-8 Ingestion trigger

- **Decision**: `npm run custody:ingest -- --archive <dir>` CLI plus
  `POST /api/custody/admin/ingest-runs` (ADMIN) calling the same function; each run in its own
  transaction per file, readers unaffected.
- **Alternatives considered**: scheduled watcher — deferred until the file-drop location on the
  new platform is known.

## R-9 Identity and roles

- **Decision**: `custody_users` (user name, role, active) migrated without password hashes.
  `server/auth/roles.ts` resolves the current user; until platform auth exists it reads
  `X-Sim-User` (sent by the client from `?as=`) only when `SIMULATED_AUTH=1`. Routes declare
  required roles; violations return HTTP 403 `{ error: 'Forbidden' }`.
- **Open for product owner**: real authentication (SSO) timing; whether advisers are scoped to their
  own clients (legacy is not — D-10).

## R-10 Reconciliation notes

- **Decision**: `custody_break_notes` (current) + `custody_break_note_history` (append-only);
  `PATCH` updates only supplied fields (fixes D-6). Legacy `O`→`OPEN`, `C`→`RESOLVED`.
- **Corporate actions**: remain manual notes (BR-10); a `cause` tag (`CORP_ACTION`,
  `MISSING_CONFIRM`, `OTHER`) is added to make them reportable.

## R-11 Placement in the UI

- **Decision**: Advisers reach Custody Holdings/Settlements from Client 360 and Client Search;
  operations reach Position Check and Message Browser from the operations workspace next to
  Settlement Exceptions; Admin under an admin nav entry. Existing screens are unchanged except for
  entry links.
- **Rationale**: Settlement Exceptions are trade-lifecycle exceptions; position breaks are
  custody-statement differences — related but different queues.
