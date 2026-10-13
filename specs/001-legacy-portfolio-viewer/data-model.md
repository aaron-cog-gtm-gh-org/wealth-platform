# Phase 1 Data Model: Custody (Oracle)

**Feature**: [spec.md](./spec.md) | Decisions: [research.md](./research.md)

All tables are added to `server/db/schema.sql` (re-runnable; dropped first). Existing tables are
unchanged. Types are 19c-compatible.

## Reference data (migrated once from legacy SQL Server)

| Table | Columns | Notes |
|---|---|---|
| `custody_users` | `user_name` PK, `display_name`, `role` CHECK IN (`ADVISER`,`OPS`,`ADMIN`), `is_active` | Reference only (adviser names); no login, no password column (FR-022) |
| `custody_clients` | `client_id` NUMBER PK (legacy `CLIENT_ID`), `client_ref` UNIQUE, `surname`, `forename`, `adviser` → `custody_users` NULL, `status`, `platform_client_id` → `clients` NULL | 50 rows |
| `custody_accounts` | `account_id` NUMBER PK (legacy), `client_id` → `custody_clients`, `safe_no` NUMBER(10) UNIQUE, `account_type` CHECK IN (`ISA`,`SIPP`,`GIA`), `legacy_account_type`, `reporting_ccy` CHAR(3), `open_date`, `close_date` NULL | 120 rows; `safe_no` numeric fixes D-2 |
| `custody_instruments` | `isin` CHAR(12) PK, `name`, `source` CHECK IN (`LEGACY_REF`,`CUSTODIAN`) | 302 legacy + unknowns added from `35B` (D-5) |

## Ingested messages and derived facts

| Table | Columns | Notes |
|---|---|---|
| `custody_ingest_runs` | `run_id` PK, `started_at`, `finished_at`, `files_seen`, `files_new`, `files_duplicate`, `parse_errors`, `triggered_by` | US5 |
| `custody_messages` | `message_id` PK, `mt_type` NUMBER(3), `sender_bic`, `seme`, `function_code` (`NEWM`,`RPLC`,`NEWM/DUPL`,`CANC`), `safe_no`, `business_date`, `source_folder`, `source_file` UNIQUE, `file_seq`, `content_sha256` (indexed), `raw_text` CLOB, `run_id`, `parse_status` (`OK`,`ERROR`), `parse_error` | Immutable; raw bytes kept incl. line endings; re-ingest skips a known `source_file` with the same hash and errors if the hash changed |
| `custody_statements` | `statement_id` PK, `message_id` UNIQUE, `account_id`, `safe_no`, `statement_date`, `function_code`, `file_seq`, `is_effective` NUMBER(1), `is_empty` NUMBER(1) | One effective row per (`safe_no`,`statement_date`) — R-5 |
| `custody_statement_lines` | (`statement_id`, `line_no`) PK, `isin`, `custodian_desc`, `qty` NUMBER(18,6), `qty_type` (`UNIT`,`FAMT`), `price` NUMBER(18,8), `price_type`, `ccy`, `market_value` NUMBER(18,2), `reporting_value` NUMBER(18,2) NULL, `subsafe` | `reporting_value` NULL → flagged (FR-010) |
| `custody_confirmations` | `confirmation_id` PK, `message_id` UNIQUE, `account_id`, `safe_no`, `mt_type`, `direction` (`RECEIVE`,`DELIVER`), `seme`, `prev_ref` NULL, `function_code`, `trade_date`, `settle_date`, `isin`, `qty`, `qty_type`, `amount` NUMBER(18,2) NULL, `amount_ccy` NULL, `cancelled_by` → self NULL | `cancelled_by` set globally by R-5 |

Indexes: `custody_statements(safe_no, statement_date)`, `custody_confirmations(safe_no,
settle_date)`, `custody_confirmations(safe_no, seme)`, `custody_messages(mt_type,
business_date)`.

## Reconciliation

| Table | Columns | Notes |
|---|---|---|
| `custody_break_notes` | (`account_id`, `isin`, `statement_date`) PK, `status` CHECK IN (`OPEN`,`CHASED`,`RESOLVED`,`WRITEOFF`), `cause` (`CORP_ACTION`,`MISSING_CONFIRM`,`OTHER`) NULL, `note`, `updated_by`, `updated_at` | Current state; absent row ⇒ status `NEW` |
| `custody_break_note_history` | `history_id` PK, break key, `status`, `cause`, `note`, `changed_by`, `changed_at`, `source` (`LEGACY_MIGRATION`,`USER`) | Append-only |

Breaks themselves are **computed** (not stored) from effective statements and active
confirmations, so a parser fix or late cancellation updates them automatically.

## Rules and state transitions

- **Safe key**: `safe_no = TO_NUMBER(97A::SAFE)` for both message families.
- **Effective statement** (per `safe_no`, `statement_date`): latest `RPLC` by `file_seq` → else latest
  `NEWM` → else latest any; recomputed after every run.
- **Cancellation**: `CANC` with `prev_ref = X` sets `cancelled_by` on the confirmation with
  `(safe_no, seme = X)`; unmatched cancellations are reported in the run summary.
- **Break**: `expected = prev_effective.qty + Σ RECEIVE − Σ DELIVER` over active confirmations with
  `settle_date` in (prev date, date]; break iff `expected ≠ reported` per (ISIN, `qty_type`).
- **Note status**: `NEW → OPEN | CHASED | RESOLVED | WRITEOFF`, any → any by any user (author name recorded, FR-022); every change
  writes history.

## Legacy → new mapping

| Legacy | New |
|---|---|
| `APP_USER` (`PWD_HASH` dropped) | `custody_users` |
| `CLIENT` | `custody_clients` |
| `ACCOUNT.SAFE_CODE` string | `custody_accounts.safe_no` number |
| `ACCOUNT.ACCOUNT_TYPE` free text | `account_type` + original in `legacy_account_type` |
| `INSTRUMENT` | `custody_instruments` (`LEGACY_REF`) |
| `RECON_NOTE` (`O`/`C` mapped) | `custody_break_notes` + one `LEGACY_MIGRATION` history row |
| `archive\**\*.txt` | `custody_messages` + derived tables |

## Loading and UI feed (confirmed 2026-10-12)

- `npm run db:setup` (server/db/setup.ts) creates the `custody_*` tables, loads migrated legacy
  reference data and ingests the committed archive, so Oracle holds all legacy data after setup.
- `custody_break_notes.updated_by` / history `updated_by` hold the user-entered author name (no login).
- Reporting currency for all migrated accounts is GBP; values are never converted to CAD.
- `server/custody/platform-view.ts` reads these tables to serve `HouseholdDto`/`PortfolioDto` for a
  picked custody client; no rows are written to `households`/`clients`/`accounts`.
