-- Portfolio Viewer reference data (spec 004), ported from legacy-wealth-platform db/schema/01_tables.sql.
-- Re-runnable. Legacy APP_USER.PWD_HASH (unsalted SHA1) is not carried forward: password_hash is a
-- scrypt string set by `npm run pv:set-password`, NULL until then (user cannot sign in).
DROP SCHEMA IF EXISTS pv CASCADE;
CREATE SCHEMA pv;

CREATE TABLE pv.app_user (
  user_id integer PRIMARY KEY,
  username varchar(20) NOT NULL UNIQUE,
  password_hash text NULL,
  full_name varchar(60) NULL,
  role_cd varchar(10) NOT NULL,
  active_flg char(1) NOT NULL DEFAULT 'Y',
  last_login_dt timestamp(3) NULL,
  created_dt timestamp(3) NOT NULL DEFAULT localtimestamp(3)
);

CREATE TABLE pv.client (
  client_id integer PRIMARY KEY,
  client_ref varchar(12) NOT NULL,
  client_name varchar(100) NOT NULL,
  adviser_user_id integer NULL REFERENCES pv.app_user (user_id),
  status_cd char(1) NOT NULL,
  created_dt timestamp(3) NULL
);
CREATE INDEX ix_pv_client_name ON pv.client (client_name);

CREATE TABLE pv.account (
  acct_id integer PRIMARY KEY,
  acct_no varchar(12) NOT NULL,
  client_id integer NOT NULL REFERENCES pv.client (client_id),
  acct_type varchar(40) NULL,
  base_ccy char(3) NOT NULL,
  safe_code varchar(10) NULL,
  open_dt timestamp(3) NULL,
  close_dt timestamp(3) NULL,
  status_cd char(1) NOT NULL
);
CREATE INDEX ix_pv_account_client ON pv.account (client_id);

CREATE TABLE pv.instrument (
  isin char(12) PRIMARY KEY,
  instr_name varchar(100) NOT NULL,
  asset_class_cd varchar(4) NULL,
  ccy char(3) NULL,
  sedol varchar(7) NULL,
  added_dt timestamp(3) NULL
);

CREATE TABLE pv.recon_note (
  acct_id integer NOT NULL,
  isin char(12) NOT NULL,
  stmt_dt date NOT NULL,
  status_cd varchar(10) NOT NULL,
  note_txt varchar(500) NULL,
  updated_by varchar(20) NULL,
  updated_dt timestamp(3) NULL,
  PRIMARY KEY (acct_id, isin, stmt_dt)
);
