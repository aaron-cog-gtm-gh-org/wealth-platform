# Data Model: Custody area (PostgreSQL)

Reference data is migrated 1:1 from PV `db/seed/*.sql` (T-SQL → PostgreSQL). IDs are preserved.

| Table | Columns (type, constraint) |
| --- | --- |
| `custody_users` | user_id INT PK; username VARCHAR(20) UNIQUE; full_name VARCHAR(60); role VARCHAR(10) CHECK IN ('ADVISER','OPS','ADMIN'); active BOOLEAN |
| `custody_clients` | client_id INT PK; client_ref VARCHAR(12) NOT NULL; name VARCHAR(100) NOT NULL; adviser_user_id INT FK custody_users NULL; status CHAR(1) CHECK IN ('A','D','C') |
| `custody_accounts` | acct_id INT PK; acct_no VARCHAR(12) NOT NULL; client_id INT FK; acct_type VARCHAR(40) (kept verbatim incl. trailing spaces trimmed on display); base_ccy CHAR(3); safe_code VARCHAR(10) unpadded; open_date DATE; close_date DATE NULL; status CHAR(1) CHECK IN ('O','C') |
| `custody_instruments` | isin CHAR(12) PK; name VARCHAR(100) NOT NULL; asset_class VARCHAR(4); ccy CHAR(3); sedol VARCHAR(7); added_date DATE |
| `custody_recon_notes` | acct_id INT FK; isin CHAR(12); stmt_date DATE; status VARCHAR(10) CHECK IN ('NEW','O','CHASED','C','RESOLVED','WRITEOFF'); note VARCHAR(500); updated_by VARCHAR(20) NULL; updated_at TIMESTAMPTZ NULL; PK (acct_id, isin, stmt_date). The 13 seed rows are restored by `POST /api/test/reset` |
| `custody_messages` | message_id SERIAL PK; file_name VARCHAR(64) UNIQUE; rel_path VARCHAR(128); msg_family VARCHAR(5) CHECK IN ('MT535','MT54x'); mt_type SMALLINT (from file name: 535/544–547); safe_code VARCHAR(10) unpadded (from file name); msg_date DATE (from file name); file_seq INT; day_folder CHAR(8) NULL (MT54x only); size_bytes INT; raw_text TEXT; parse_status VARCHAR(8) CHECK IN ('pending','ok','error'); parse_error VARCHAR(300) |
| `custody_statements` | statement_id SERIAL PK; message_id INT FK UNIQUE; safe_code VARCHAR(10) unpadded; stmt_date DATE; function VARCHAR(20); file_seq INT; INDEX (safe_code, stmt_date) |
| `custody_statement_lines` | statement_id INT FK; line_no SMALLINT; isin CHAR(12); description VARCHAR(140); qty NUMERIC(18,4); qty_type VARCHAR(4); price NUMERIC(18,6); ccy CHAR(3); mkt_val NUMERIC(16,2); mkt_val_gbp NUMERIC(16,2); PK (statement_id, line_no) |
| `custody_confirmations` | message_id INT PK FK; mt_type SMALLINT; seme VARCHAR(35); prev VARCHAR(35) NULL; function VARCHAR(8); trade_date DATE; settle_date DATE; isin CHAR(12); qty NUMERIC(18,4); safe_code_raw VARCHAR(10); safe_code VARCHAR(10) unpadded; amount NUMERIC(16,2); amount_raw VARCHAR(40); ccy CHAR(3); direction CHAR(3) CHECK IN ('REC','DEL'); day_folder CHAR(8) |
| `custody_archive_loads` | load_id SERIAL PK; loaded_at TIMESTAMPTZ; load_ms INT; mt535_count INT; mt54x_count INT; statements INT; confirmations INT; parse_errors INT |

Pipeline: `load-archive.ts` (C3) inserts every file as `custody_messages` with `parse_status='pending'`.
`parse-archive.ts` (C4) parses the pending rows with `server/custody/swift` (C2), fills
statements/lines/confirmations, sets status ok/error, and writes a `custody_archive_loads` row.
`db:setup` runs both. Reload re-runs both inside a transaction.

## Domain types (C2 exports, `server/custody/swift/types.ts`)
```ts
export interface StatementLine { isin: string; description: string; qty: number; qtyType: string; price: number; ccy: string; mktVal: number; mktValGbp: number }
export interface Statement { function: string | null; statementDate: string; safekeepingAcct: string | null; lines: StatementLine[] }
export interface Confirmation { mtType: number; seme: string | null; prev: string | null; function: string | null; tradeDate: string; settleDate: string; isin: string | null; qty: number; safekeepingAcct: string | null; amountRaw: string | null; amount: number | null; ccy: string | null; direction: 'REC' | 'DEL' }
export function parseStatement(text: string): Statement
export function parseConfirmation(text: string): Confirmation
// server/custody/domain
export function activeConfirmations(all: (Confirmation & { dayFolder: string })[]): ...            // D2 fix
export function settlementsFor(confs, safeCode: string, from: string, to: string): ...             // D1 fix, newest first
export function positionCheck(prev: Statement | null, curr: Statement | null, settles, notes): PositionCheckResult
```
Dates are ISO strings; quantities are numbers rounded to 4 dp and amounts to 2 dp.
