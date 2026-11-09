-- Custody (Portfolio Viewer) tables. Re-runnable: existing tables are dropped first.
DROP TABLE IF EXISTS custody_archive_loads, custody_confirmations, custody_statement_lines,
  custody_statements, custody_messages, custody_recon_notes, custody_instruments,
  custody_accounts, custody_clients, custody_users CASCADE;

-- Reference data (migrated from PV APP_USER, CLIENT, ACCOUNT, INSTRUMENT, RECON_NOTE) ----------

CREATE TABLE custody_users (
  user_id    INT          PRIMARY KEY,
  username   VARCHAR(20)  UNIQUE,
  full_name  VARCHAR(60),
  role       VARCHAR(10)  CHECK (role IN ('ADVISER', 'OPS', 'ADMIN')),
  active     BOOLEAN
);

CREATE TABLE custody_clients (
  client_id        INT           PRIMARY KEY,
  client_ref       VARCHAR(12)   NOT NULL,
  name             VARCHAR(100)  NOT NULL,
  adviser_user_id  INT           NULL REFERENCES custody_users (user_id),
  status           CHAR(1)       CHECK (status IN ('A', 'D', 'C'))
);
CREATE INDEX custody_clients_name_idx ON custody_clients (name);

CREATE TABLE custody_accounts (
  acct_id     INT          PRIMARY KEY,
  acct_no     VARCHAR(12)  NOT NULL,
  client_id   INT          REFERENCES custody_clients (client_id),
  acct_type   VARCHAR(40),
  base_ccy    CHAR(3),
  safe_code   VARCHAR(10),
  open_date   DATE,
  close_date  DATE         NULL,
  status      CHAR(1)      CHECK (status IN ('O', 'C'))
);
CREATE INDEX custody_accounts_client_idx ON custody_accounts (client_id);

CREATE TABLE custody_instruments (
  isin         CHAR(12)      PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  asset_class  VARCHAR(4),
  ccy          CHAR(3),
  sedol        VARCHAR(7),
  added_date   DATE
);

CREATE TABLE custody_recon_notes (
  acct_id     INT           REFERENCES custody_accounts (acct_id),
  isin        CHAR(12),
  stmt_date   DATE,
  status      VARCHAR(10)   CHECK (status IN ('NEW', 'O', 'CHASED', 'C', 'RESOLVED', 'WRITEOFF')),
  note        VARCHAR(500),
  updated_by  VARCHAR(20)   NULL,
  updated_at  TIMESTAMPTZ   NULL,
  PRIMARY KEY (acct_id, isin, stmt_date)
);

-- SWIFT archive (server/custody/archive) -------------------------------------------------------

CREATE TABLE custody_messages (
  message_id    SERIAL        PRIMARY KEY,
  file_name     VARCHAR(64)   UNIQUE,
  rel_path      VARCHAR(128),
  msg_family    VARCHAR(5)    CHECK (msg_family IN ('MT535', 'MT54x')),
  mt_type       SMALLINT,
  safe_code     VARCHAR(10),
  msg_date      DATE,
  file_seq      INT,
  day_folder    CHAR(8)       NULL,
  size_bytes    INT,
  raw_text      TEXT,
  parse_status  VARCHAR(8)    DEFAULT 'pending' CHECK (parse_status IN ('pending', 'ok', 'error')),
  parse_error   VARCHAR(300)
);

CREATE TABLE custody_statements (
  statement_id  SERIAL       PRIMARY KEY,
  message_id    INT          UNIQUE REFERENCES custody_messages (message_id) ON DELETE CASCADE,
  safe_code     VARCHAR(10),
  stmt_date     DATE,
  function      VARCHAR(20),
  file_seq      INT
);
CREATE INDEX custody_statements_safe_date_idx ON custody_statements (safe_code, stmt_date);

CREATE TABLE custody_statement_lines (
  statement_id  INT            REFERENCES custody_statements (statement_id) ON DELETE CASCADE,
  line_no       SMALLINT,
  isin          CHAR(12),
  description   VARCHAR(140),
  qty           NUMERIC(18,4),
  qty_type      VARCHAR(4),
  price         NUMERIC(18,6),
  ccy           CHAR(3),
  mkt_val       NUMERIC(16,2),
  mkt_val_gbp   NUMERIC(16,2),
  PRIMARY KEY (statement_id, line_no)
);

CREATE TABLE custody_confirmations (
  message_id     INT            PRIMARY KEY REFERENCES custody_messages (message_id) ON DELETE CASCADE,
  mt_type        SMALLINT,
  seme           VARCHAR(35),
  prev           VARCHAR(35)    NULL,
  function       VARCHAR(8),
  trade_date     DATE,
  settle_date    DATE,
  isin           CHAR(12),
  qty            NUMERIC(18,4),
  safe_code_raw  VARCHAR(10),
  safe_code      VARCHAR(10),
  amount         NUMERIC(16,2),
  amount_raw     VARCHAR(40),
  ccy            CHAR(3),
  direction      CHAR(3)        CHECK (direction IN ('REC', 'DEL')),
  day_folder     CHAR(8)
);

CREATE TABLE custody_archive_loads (
  load_id        SERIAL       PRIMARY KEY,
  loaded_at      TIMESTAMPTZ  DEFAULT now(),
  load_ms        INT,
  mt535_count    INT,
  mt54x_count    INT,
  statements     INT,
  confirmations  INT,
  parse_errors   INT
);
