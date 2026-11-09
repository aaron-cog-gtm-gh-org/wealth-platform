# Data Model: schema `pv`

| Table | Columns (legacy name) | Notes |
| --- | --- | --- |
| `pv.app_user` | user_id, username (unique), **password_hash** (was PWD_HASH), full_name, role_cd, active_flg, last_login_dt, created_dt | scrypt or NULL |
| `pv.client` | client_id, client_ref, client_name, adviser_user_id → app_user, status_cd, created_dt | |
| `pv.account` | acct_id, acct_no, client_id → client, acct_type, base_ccy, safe_code, open_dt, close_dt, status_cd | |
| `pv.instrument` | isin (char 12), instr_name, asset_class_cd, ccy, sedol, added_dt | |
| `pv.recon_note` | PK (acct_id, isin, stmt_dt date), status_cd, note_txt, updated_by, updated_dt | mixed status codes (Q12) |

Seed rows: 6 users, 50 clients, 120 accounts, 302 instruments and 13 notes.
