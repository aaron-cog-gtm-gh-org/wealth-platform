-- Re-runnable: existing tables are dropped first.
DROP TABLE IF EXISTS payment_rails, payees, transactions, pending_request_steps, pending_requests,
  portal_activity_feed, settlement_exceptions, settlement_exception_causes, ops_queues,
  alt_distributions, capital_calls, alt_commitments, proposal_drift, pretrade_checks,
  proposal_trades, rebalance_proposals, performance_points, performance_periods,
  fee_summary, client_documents, client_communications, advisor_tasks, holdings,
  fx_rates, asset_classes, accounts, household_members, clients, households CASCADE;
DROP TABLE IF EXISTS wf_audit, wf_allocations, wf_exceptions, wf_transfers, wf_orders,
  wf_positions, wf_accounts, wf_clients CASCADE;
DROP SEQUENCE IF EXISTS wf_order_seq, wf_transfer_seq, wf_audit_seq;

-- Households and clients ----------------------------------------------------

CREATE TABLE households (
  household_id        VARCHAR(16)  PRIMARY KEY,
  household_name      VARCHAR(80)  NOT NULL,
  mandate             VARCHAR(80)  NOT NULL,
  next_review_date    DATE,
  advisor_name        VARCHAR(80)  NOT NULL,
  total_fee_rate_pct  NUMERIC(6,2),
  income_90d          NUMERIC(14,2),
  coupons_90d         NUMERIC(14,2),
  dividends_90d       NUMERIC(14,2),
  tax_lots            BIGINT,
  alt_net_irr_pct     NUMERIC(6,2)
);

CREATE TABLE clients (
  client_id              VARCHAR(16)  PRIMARY KEY,
  household_id           VARCHAR(16)  NOT NULL REFERENCES households,
  legal_name             VARCHAR(120) NOT NULL,
  display_name           VARCHAR(80)  NOT NULL,
  is_primary             BIGINT     DEFAULT 0 NOT NULL CHECK (is_primary IN (0, 1)),
  date_of_birth          DATE,
  tax_residency          VARCHAR(80),
  occupation             VARCHAR(80),
  risk_profile           VARCHAR(40),
  risk_score             BIGINT,
  time_horizon           VARCHAR(40),
  kyc_status             VARCHAR(20),
  kyc_reviewed_date      DATE,
  kyc_next_refresh_date  DATE,
  suitability_signed_date DATE,
  preferred_contact      VARCHAR(80),
  power_of_attorney      VARCHAR(80),
  funding_account_key    VARCHAR(4)
);

CREATE TABLE household_members (
  household_id   VARCHAR(16)  NOT NULL REFERENCES households,
  display_order  BIGINT     NOT NULL,
  member_name    VARCHAR(80)  NOT NULL,
  relationship   VARCHAR(120) NOT NULL,
  accounts_desc  VARCHAR(80),
  PRIMARY KEY (household_id, display_order)
);

-- Accounts and holdings -----------------------------------------------------

CREATE TABLE accounts (
  account_key     VARCHAR(4)   PRIMARY KEY,
  account_no      VARCHAR(12)  NOT NULL UNIQUE,
  household_id    VARCHAR(16)  NOT NULL REFERENCES households,
  account_name    VARCHAR(80)  NOT NULL,
  short_name      VARCHAR(40)  NOT NULL,
  ownership       VARCHAR(80)  NOT NULL,
  management      VARCHAR(20)  NOT NULL,
  currencies      VARCHAR(20)  NOT NULL,
  drift_pts       NUMERIC(5,2)   NOT NULL,
  drift_status    VARCHAR(8)   NOT NULL CHECK (drift_status IN ('OK', 'WARN', 'ALERT')),
  day_change_pct  NUMERIC(7,4)   NOT NULL
);

CREATE TABLE asset_classes (
  class_name         VARCHAR(20)  PRIMARY KEY,
  display_order      BIGINT     NOT NULL,
  target_weight_pct  NUMERIC(5,2)   NOT NULL,
  price_source       VARCHAR(200) NOT NULL
);

CREATE TABLE fx_rates (
  base_ccy     CHAR(3)       NOT NULL,
  quote_ccy    CHAR(3)       NOT NULL,
  rate         NUMERIC(12,6)  NOT NULL,
  rate_source  VARCHAR(60),
  PRIMARY KEY (base_ccy, quote_ccy)
);

CREATE TABLE holdings (
  holding_id       BIGINT    PRIMARY KEY,
  account_key      VARCHAR(4)   NOT NULL REFERENCES accounts,
  class_name       VARCHAR(20)  NOT NULL REFERENCES asset_classes,
  display_order    BIGINT     NOT NULL,
  instrument_name  VARCHAR(120) NOT NULL,
  identifier       VARCHAR(120) NOT NULL,
  quantity         NUMERIC(18,6)  NOT NULL,
  price            NUMERIC(18,6)  NOT NULL,
  market_value     NUMERIC(16,2)  NOT NULL,
  cost_basis       NUMERIC(16,2)  NOT NULL,
  day_change_pct   NUMERIC(7,4)   NOT NULL,
  currency         CHAR(3)       NOT NULL
);

-- Adviser workspace -----------------------------------------------------------

CREATE TABLE advisor_tasks (
  household_id   VARCHAR(16)  NOT NULL REFERENCES households,
  display_order  BIGINT     NOT NULL,
  title          VARCHAR(120) NOT NULL,
  next_step      VARCHAR(200),
  due_label      VARCHAR(20),
  priority       VARCHAR(8)   NOT NULL CHECK (priority IN ('HIGH', 'MEDIUM', 'NORMAL', 'LOW')),
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE client_communications (
  household_id   VARCHAR(16)  NOT NULL REFERENCES households,
  display_order  BIGINT     NOT NULL,
  channel        VARCHAR(80)  NOT NULL,
  comm_date      DATE          NOT NULL,
  summary        VARCHAR(400),
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE client_documents (
  household_id   VARCHAR(16)  NOT NULL REFERENCES households,
  display_order  BIGINT     NOT NULL,
  title          VARCHAR(120) NOT NULL,
  doc_date       DATE          NOT NULL,
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE fee_summary (
  household_id   VARCHAR(16)  NOT NULL REFERENCES households,
  display_order  BIGINT     NOT NULL,
  fee_label      VARCHAR(80)  NOT NULL,
  rate_label     VARCHAR(40),
  amount         NUMERIC(14,2)  NOT NULL,
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE performance_periods (
  household_id          VARCHAR(16)  NOT NULL REFERENCES households,
  period_code           VARCHAR(20)  NOT NULL,
  display_order         BIGINT     NOT NULL,
  start_date            DATE          NOT NULL,
  portfolio_return_pct  NUMERIC(8,3)   NOT NULL,
  benchmark_return_pct  NUMERIC(8,3)   NOT NULL,
  PRIMARY KEY (household_id, period_code)
);

-- Cumulative return series (TWR, %) sampled at equal intervals across the period.
CREATE TABLE performance_points (
  household_id   VARCHAR(16)  NOT NULL,
  period_code    VARCHAR(20)  NOT NULL,
  point_index    BIGINT     NOT NULL,
  portfolio_pct  DOUBLE PRECISION NOT NULL,
  benchmark_pct  DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (household_id, period_code, point_index),
  FOREIGN KEY (household_id, period_code) REFERENCES performance_periods
);

-- Rebalancing -------------------------------------------------------------------

CREATE TABLE rebalance_proposals (
  proposal_id                VARCHAR(20)  PRIMARY KEY,
  household_id               VARCHAR(16)  NOT NULL REFERENCES households,
  status                     VARCHAR(20)  NOT NULL,
  tracking_error_before_pct  NUMERIC(5,2),
  tracking_error_after_pct   NUMERIC(5,2)
);

CREATE TABLE proposal_trades (
  proposal_id      VARCHAR(20)  NOT NULL REFERENCES rebalance_proposals,
  line_no          BIGINT     NOT NULL,
  side             VARCHAR(4)   NOT NULL CHECK (side IN ('BUY', 'SELL')),
  instrument_name  VARCHAR(120) NOT NULL,
  account_key      VARCHAR(4)   NOT NULL REFERENCES accounts,
  quantity_label   VARCHAR(40)  NOT NULL,
  trade_value      NUMERIC(16,2)  NOT NULL,
  est_cost         NUMERIC(10,2)  NOT NULL,
  realized_gain    NUMERIC(16,2)  NOT NULL,
  route            VARCHAR(80),
  note             VARCHAR(200),
  PRIMARY KEY (proposal_id, line_no)
);

-- status LIVE: evaluated in the order ticket as lines are included or excluded.
CREATE TABLE pretrade_checks (
  proposal_id    VARCHAR(20)  NOT NULL REFERENCES rebalance_proposals,
  display_order  BIGINT     NOT NULL,
  check_code     VARCHAR(30)  NOT NULL,
  check_name     VARCHAR(80)  NOT NULL,
  status         VARCHAR(4)   NOT NULL CHECK (status IN ('PASS', 'WARN', 'FAIL', 'LIVE')),
  detail         VARCHAR(400),
  PRIMARY KEY (proposal_id, display_order)
);

CREATE TABLE proposal_drift (
  proposal_id       VARCHAR(20)  NOT NULL REFERENCES rebalance_proposals,
  class_name        VARCHAR(20)  NOT NULL REFERENCES asset_classes,
  drift_before_pts  NUMERIC(5,2)   NOT NULL,
  drift_after_pts   NUMERIC(5,2)   NOT NULL,
  PRIMARY KEY (proposal_id, class_name)
);

-- Alternatives ------------------------------------------------------------------

CREATE TABLE alt_commitments (
  commitment_id      BIGINT    PRIMARY KEY,
  household_id       VARCHAR(16)  NOT NULL REFERENCES households,
  display_order      BIGINT     NOT NULL,
  fund_name          VARCHAR(120) NOT NULL,
  account_key        VARCHAR(4)   NOT NULL REFERENCES accounts,
  currency           CHAR(3)       NOT NULL,
  vintage            BIGINT     NOT NULL,
  commitment_amt     NUMERIC(16,2)  NOT NULL,
  called_amt         NUMERIC(16,2)  NOT NULL,
  distributions_amt  NUMERIC(16,2)  NOT NULL,
  nav_amt            NUMERIC(16,2)  NOT NULL,
  nav_date           DATE          NOT NULL,
  nav_status         VARCHAR(12)  NOT NULL,
  administrator      VARCHAR(40),
  entered_by         VARCHAR(40),
  approved_by        VARCHAR(40),
  approved_date      DATE
);

CREATE TABLE capital_calls (
  household_id   VARCHAR(16)  NOT NULL REFERENCES households,
  display_order  BIGINT     NOT NULL,
  due_label      VARCHAR(20)  NOT NULL,
  description    VARCHAR(80)  NOT NULL,
  amount         NUMERIC(16,2)  NOT NULL,
  status         VARCHAR(30)  NOT NULL,
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE alt_distributions (
  household_id       VARCHAR(16)  NOT NULL REFERENCES households,
  display_order      BIGINT     NOT NULL,
  paid_date          DATE          NOT NULL,
  fund_short_name    VARCHAR(40)  NOT NULL,
  distribution_type  VARCHAR(40)  NOT NULL,
  amount             NUMERIC(16,2)  NOT NULL,
  PRIMARY KEY (household_id, display_order)
);

-- Operations --------------------------------------------------------------------

CREATE TABLE ops_queues (
  queue_name              VARCHAR(60)  PRIMARY KEY,
  opened_today            BIGINT     NOT NULL,
  cleared_today           BIGINT     NOT NULL,
  median_resolve_minutes  BIGINT     NOT NULL,
  auto_assign_time        VARCHAR(5)   NOT NULL,
  buy_in_day              BIGINT     NOT NULL
);

CREATE TABLE settlement_exception_causes (
  cause_name        VARCHAR(60)  PRIMARY KEY,
  display_order     BIGINT     NOT NULL,
  suggested_action  VARCHAR(120) NOT NULL,
  action_short      VARCHAR(40)  NOT NULL,
  explanation       VARCHAR(400) NOT NULL
);

CREATE TABLE settlement_exceptions (
  exception_id      VARCHAR(16)  PRIMARY KEY,
  queue_name        VARCHAR(60)  NOT NULL REFERENCES ops_queues,
  age_days          BIGINT     NOT NULL,
  settlement_value  NUMERIC(16,2)  NOT NULL,
  instrument_name   VARCHAR(120) NOT NULL,
  side              VARCHAR(8)   NOT NULL CHECK (side IN ('Deliver', 'Receive')),
  account_no        VARCHAR(16)  NOT NULL,
  counterparty      VARCHAR(80)  NOT NULL,
  cause_name        VARCHAR(60)  NOT NULL REFERENCES settlement_exception_causes,
  owner_name        VARCHAR(60)
);

-- Client portal -----------------------------------------------------------------

CREATE TABLE portal_activity_feed (
  client_id      VARCHAR(16)  NOT NULL REFERENCES clients,
  display_order  BIGINT     NOT NULL,
  activity_date  DATE          NOT NULL,
  description    VARCHAR(120) NOT NULL,
  account_label  VARCHAR(40)  NOT NULL,
  amount         NUMERIC(14,2)  NOT NULL,
  PRIMARY KEY (client_id, display_order)
);

CREATE TABLE pending_requests (
  request_id     BIGINT    PRIMARY KEY,
  client_id      VARCHAR(16)  NOT NULL REFERENCES clients,
  display_order  BIGINT     NOT NULL,
  title          VARCHAR(120) NOT NULL,
  amount         NUMERIC(14,2),
  status_text    VARCHAR(120) NOT NULL,
  eta_text       VARCHAR(120),
  current_step   BIGINT     NOT NULL
);

CREATE TABLE pending_request_steps (
  request_id       BIGINT    NOT NULL REFERENCES pending_requests,
  step_no          BIGINT     NOT NULL,
  step_name        VARCHAR(40)  NOT NULL,
  step_time_label  VARCHAR(20),
  PRIMARY KEY (request_id, step_no)
);

CREATE TABLE transactions (
  transaction_id  BIGINT    PRIMARY KEY,
  client_id       VARCHAR(16)  NOT NULL REFERENCES clients,
  display_order   BIGINT     NOT NULL,
  trade_date      DATE          NOT NULL,
  settle_date     DATE          NOT NULL,
  description     VARCHAR(120) NOT NULL,
  detail          VARCHAR(120),
  account_key     VARCHAR(4)   NOT NULL REFERENCES accounts,
  amount          NUMERIC(14,2)  NOT NULL,
  status          VARCHAR(30)  NOT NULL,
  next_step       VARCHAR(120)
);

CREATE TABLE payees (
  payee_id       BIGINT    PRIMARY KEY,
  client_id      VARCHAR(16)  NOT NULL REFERENCES clients,
  display_order  BIGINT     NOT NULL,
  payee_name     VARCHAR(80)  NOT NULL,
  description    VARCHAR(120),
  history_label  VARCHAR(40),
  is_new         BIGINT     DEFAULT 0 NOT NULL CHECK (is_new IN (0, 1))
);

CREATE TABLE payment_rails (
  rail_name      VARCHAR(30)  PRIMARY KEY,
  display_order  BIGINT     NOT NULL,
  daily_limit    NUMERIC(14,2)  NOT NULL,
  fee            NUMERIC(8,2)   NOT NULL,
  speed_label    VARCHAR(80)  NOT NULL,
  arrival_label  VARCHAR(40)  NOT NULL
);

CREATE SEQUENCE wf_order_seq START WITH 1001;
CREATE SEQUENCE wf_transfer_seq START WITH 1001;
CREATE SEQUENCE wf_audit_seq START WITH 1001;

CREATE TABLE wf_clients (
  client_id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  risk_profile VARCHAR(20) CHECK (risk_profile IN ('Conservative', 'Moderate', 'Growth')),
  kyc_status VARCHAR(20) CHECK (kyc_status IN ('Current', 'Review due'))
);

CREATE TABLE wf_accounts (
  account_id VARCHAR(16) PRIMARY KEY,
  client_id VARCHAR(16) NOT NULL REFERENCES wf_clients,
  name VARCHAR(120) NOT NULL,
  currency CHAR(3) NOT NULL CHECK (currency IN ('CAD', 'USD')),
  cash NUMERIC(14,2) NOT NULL CHECK (cash >= 0)
);

CREATE TABLE wf_positions (
  position_id VARCHAR(16) PRIMARY KEY,
  account_id VARCHAR(16) NOT NULL REFERENCES wf_accounts,
  symbol VARCHAR(12) NOT NULL,
  name VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  price NUMERIC(14,4) NOT NULL CHECK (price > 0),
  UNIQUE (account_id, symbol)
);

CREATE TABLE wf_orders (
  order_id VARCHAR(16) PRIMARY KEY,
  seq BIGINT NOT NULL,
  account_id VARCHAR(16) NOT NULL REFERENCES wf_accounts,
  symbol VARCHAR(12) NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('Buy', 'Sell')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(14,4) NOT NULL,
  status VARCHAR(12) NOT NULL CHECK (status IN ('Open', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wf_transfers (
  transfer_id VARCHAR(16) PRIMARY KEY,
  seq BIGINT NOT NULL,
  from_account_id VARCHAR(16) NOT NULL REFERENCES wf_accounts,
  to_account_id VARCHAR(16) NOT NULL REFERENCES wf_accounts,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(12) NOT NULL CHECK (status IN ('Completed')),
  reference VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wf_exceptions (
  exception_id VARCHAR(16) PRIMARY KEY,
  account_id VARCHAR(16) NOT NULL REFERENCES wf_accounts,
  reason VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('Open', 'In progress', 'Resolved')),
  owner VARCHAR(80),
  note VARCHAR(500)
);

CREATE TABLE wf_allocations (
  asset_class VARCHAR(20) PRIMARY KEY,
  display_order SMALLINT NOT NULL,
  current_weight NUMERIC(5,2) NOT NULL,
  target_weight NUMERIC(5,2) NOT NULL CHECK (target_weight BETWEEN 0 AND 100)
);

CREATE TABLE wf_audit (
  audit_id VARCHAR(16) PRIMARY KEY,
  seq BIGINT NOT NULL,
  action VARCHAR(40) NOT NULL,
  entity_id VARCHAR(16) NOT NULL,
  detail VARCHAR(300) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
