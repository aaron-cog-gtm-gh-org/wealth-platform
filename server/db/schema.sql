-- RBC Wealth Platform schema. Compatible with Oracle Database 19c and later.
-- Re-runnable: existing tables are dropped first.
SET DEFINE OFF

BEGIN
  FOR t IN (
    SELECT table_name FROM user_tables WHERE table_name IN (
      'PAYMENT_RAILS', 'PAYEES', 'TRANSACTIONS', 'PENDING_REQUEST_STEPS', 'PENDING_REQUESTS',
      'PORTAL_ACTIVITY_FEED', 'SETTLEMENT_EXCEPTIONS', 'SETTLEMENT_EXCEPTION_CAUSES', 'OPS_QUEUES',
      'ALT_DISTRIBUTIONS', 'CAPITAL_CALLS', 'ALT_COMMITMENTS', 'PROPOSAL_DRIFT', 'PRETRADE_CHECKS',
      'PROPOSAL_TRADES', 'REBALANCE_PROPOSALS', 'PERFORMANCE_POINTS', 'PERFORMANCE_PERIODS',
      'FEE_SUMMARY', 'CLIENT_DOCUMENTS', 'CLIENT_COMMUNICATIONS', 'ADVISOR_TASKS', 'HOLDINGS',
      'FX_RATES', 'ASSET_CLASSES', 'ACCOUNTS', 'HOUSEHOLD_MEMBERS', 'CLIENTS', 'HOUSEHOLDS'
    )
  ) LOOP
    EXECUTE IMMEDIATE 'DROP TABLE ' || t.table_name || ' CASCADE CONSTRAINTS PURGE';
  END LOOP;
END;
/

-- Households and clients ----------------------------------------------------

CREATE TABLE households (
  household_id        VARCHAR2(16)  PRIMARY KEY,
  household_name      VARCHAR2(80)  NOT NULL,
  mandate             VARCHAR2(80)  NOT NULL,
  next_review_date    DATE,
  advisor_name        VARCHAR2(80)  NOT NULL,
  total_fee_rate_pct  NUMBER(6,2),
  income_90d          NUMBER(14,2),
  coupons_90d         NUMBER(14,2),
  dividends_90d       NUMBER(14,2),
  tax_lots            NUMBER(6),
  alt_net_irr_pct     NUMBER(6,2)
);

CREATE TABLE clients (
  client_id              VARCHAR2(16)  PRIMARY KEY,
  household_id           VARCHAR2(16)  NOT NULL REFERENCES households,
  legal_name             VARCHAR2(120) NOT NULL,
  display_name           VARCHAR2(80)  NOT NULL,
  is_primary             NUMBER(1)     DEFAULT 0 NOT NULL CHECK (is_primary IN (0, 1)),
  date_of_birth          DATE,
  tax_residency          VARCHAR2(80),
  occupation             VARCHAR2(80),
  risk_profile           VARCHAR2(40),
  risk_score             NUMBER(2),
  time_horizon           VARCHAR2(40),
  kyc_status             VARCHAR2(20),
  kyc_reviewed_date      DATE,
  kyc_next_refresh_date  DATE,
  suitability_signed_date DATE,
  preferred_contact      VARCHAR2(80),
  power_of_attorney      VARCHAR2(80),
  funding_account_key    VARCHAR2(4)
);

CREATE TABLE household_members (
  household_id   VARCHAR2(16)  NOT NULL REFERENCES households,
  display_order  NUMBER(4)     NOT NULL,
  member_name    VARCHAR2(80)  NOT NULL,
  relationship   VARCHAR2(120) NOT NULL,
  accounts_desc  VARCHAR2(80),
  PRIMARY KEY (household_id, display_order)
);

-- Accounts and holdings -----------------------------------------------------

CREATE TABLE accounts (
  account_key     VARCHAR2(4)   PRIMARY KEY,
  account_no      VARCHAR2(12)  NOT NULL UNIQUE,
  household_id    VARCHAR2(16)  NOT NULL REFERENCES households,
  account_name    VARCHAR2(80)  NOT NULL,
  short_name      VARCHAR2(40)  NOT NULL,
  ownership       VARCHAR2(80)  NOT NULL,
  management      VARCHAR2(20)  NOT NULL,
  currencies      VARCHAR2(20)  NOT NULL,
  drift_pts       NUMBER(5,2)   NOT NULL,
  drift_status    VARCHAR2(8)   NOT NULL CHECK (drift_status IN ('OK', 'WARN', 'ALERT')),
  day_change_pct  NUMBER(7,4)   NOT NULL
);

CREATE TABLE asset_classes (
  class_name         VARCHAR2(20)  PRIMARY KEY,
  display_order      NUMBER(4)     NOT NULL,
  target_weight_pct  NUMBER(5,2)   NOT NULL,
  price_source       VARCHAR2(200) NOT NULL
);

CREATE TABLE fx_rates (
  base_ccy     CHAR(3)       NOT NULL,
  quote_ccy    CHAR(3)       NOT NULL,
  rate         NUMBER(12,6)  NOT NULL,
  rate_source  VARCHAR2(60),
  PRIMARY KEY (base_ccy, quote_ccy)
);

CREATE TABLE holdings (
  holding_id       NUMBER(10)    PRIMARY KEY,
  account_key      VARCHAR2(4)   NOT NULL REFERENCES accounts,
  class_name       VARCHAR2(20)  NOT NULL REFERENCES asset_classes,
  display_order    NUMBER(4)     NOT NULL,
  instrument_name  VARCHAR2(120) NOT NULL,
  identifier       VARCHAR2(120) NOT NULL,
  quantity         NUMBER(18,6)  NOT NULL,
  price            NUMBER(18,6)  NOT NULL,
  market_value     NUMBER(16,2)  NOT NULL,
  cost_basis       NUMBER(16,2)  NOT NULL,
  day_change_pct   NUMBER(7,4)   NOT NULL,
  currency         CHAR(3)       NOT NULL
);

-- Adviser workspace -----------------------------------------------------------

CREATE TABLE advisor_tasks (
  household_id   VARCHAR2(16)  NOT NULL REFERENCES households,
  display_order  NUMBER(4)     NOT NULL,
  title          VARCHAR2(120) NOT NULL,
  next_step      VARCHAR2(200),
  due_label      VARCHAR2(20),
  priority       VARCHAR2(8)   NOT NULL CHECK (priority IN ('HIGH', 'MEDIUM', 'NORMAL', 'LOW')),
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE client_communications (
  household_id   VARCHAR2(16)  NOT NULL REFERENCES households,
  display_order  NUMBER(4)     NOT NULL,
  channel        VARCHAR2(80)  NOT NULL,
  comm_date      DATE          NOT NULL,
  summary        VARCHAR2(400),
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE client_documents (
  household_id   VARCHAR2(16)  NOT NULL REFERENCES households,
  display_order  NUMBER(4)     NOT NULL,
  title          VARCHAR2(120) NOT NULL,
  doc_date       DATE          NOT NULL,
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE fee_summary (
  household_id   VARCHAR2(16)  NOT NULL REFERENCES households,
  display_order  NUMBER(4)     NOT NULL,
  fee_label      VARCHAR2(80)  NOT NULL,
  rate_label     VARCHAR2(40),
  amount         NUMBER(14,2)  NOT NULL,
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE performance_periods (
  household_id          VARCHAR2(16)  NOT NULL REFERENCES households,
  period_code           VARCHAR2(20)  NOT NULL,
  display_order         NUMBER(4)     NOT NULL,
  start_date            DATE          NOT NULL,
  portfolio_return_pct  NUMBER(8,3)   NOT NULL,
  benchmark_return_pct  NUMBER(8,3)   NOT NULL,
  PRIMARY KEY (household_id, period_code)
);

-- Cumulative return series (TWR, %) sampled at equal intervals across the period.
CREATE TABLE performance_points (
  household_id   VARCHAR2(16)  NOT NULL,
  period_code    VARCHAR2(20)  NOT NULL,
  point_index    NUMBER(4)     NOT NULL,
  portfolio_pct  BINARY_DOUBLE NOT NULL,
  benchmark_pct  BINARY_DOUBLE NOT NULL,
  PRIMARY KEY (household_id, period_code, point_index),
  FOREIGN KEY (household_id, period_code) REFERENCES performance_periods
);

-- Rebalancing -------------------------------------------------------------------

CREATE TABLE rebalance_proposals (
  proposal_id                VARCHAR2(20)  PRIMARY KEY,
  household_id               VARCHAR2(16)  NOT NULL REFERENCES households,
  status                     VARCHAR2(20)  NOT NULL,
  tracking_error_before_pct  NUMBER(5,2),
  tracking_error_after_pct   NUMBER(5,2)
);

CREATE TABLE proposal_trades (
  proposal_id      VARCHAR2(20)  NOT NULL REFERENCES rebalance_proposals,
  line_no          NUMBER(4)     NOT NULL,
  side             VARCHAR2(4)   NOT NULL CHECK (side IN ('BUY', 'SELL')),
  instrument_name  VARCHAR2(120) NOT NULL,
  account_key      VARCHAR2(4)   NOT NULL REFERENCES accounts,
  quantity_label   VARCHAR2(40)  NOT NULL,
  trade_value      NUMBER(16,2)  NOT NULL,
  est_cost         NUMBER(10,2)  NOT NULL,
  realized_gain    NUMBER(16,2)  NOT NULL,
  route            VARCHAR2(80),
  note             VARCHAR2(200),
  PRIMARY KEY (proposal_id, line_no)
);

-- status LIVE: evaluated in the order ticket as lines are included or excluded.
CREATE TABLE pretrade_checks (
  proposal_id    VARCHAR2(20)  NOT NULL REFERENCES rebalance_proposals,
  display_order  NUMBER(4)     NOT NULL,
  check_code     VARCHAR2(30)  NOT NULL,
  check_name     VARCHAR2(80)  NOT NULL,
  status         VARCHAR2(4)   NOT NULL CHECK (status IN ('PASS', 'WARN', 'FAIL', 'LIVE')),
  detail         VARCHAR2(400),
  PRIMARY KEY (proposal_id, display_order)
);

CREATE TABLE proposal_drift (
  proposal_id       VARCHAR2(20)  NOT NULL REFERENCES rebalance_proposals,
  class_name        VARCHAR2(20)  NOT NULL REFERENCES asset_classes,
  drift_before_pts  NUMBER(5,2)   NOT NULL,
  drift_after_pts   NUMBER(5,2)   NOT NULL,
  PRIMARY KEY (proposal_id, class_name)
);

-- Alternatives ------------------------------------------------------------------

CREATE TABLE alt_commitments (
  commitment_id      NUMBER(10)    PRIMARY KEY,
  household_id       VARCHAR2(16)  NOT NULL REFERENCES households,
  display_order      NUMBER(4)     NOT NULL,
  fund_name          VARCHAR2(120) NOT NULL,
  account_key        VARCHAR2(4)   NOT NULL REFERENCES accounts,
  currency           CHAR(3)       NOT NULL,
  vintage            NUMBER(4)     NOT NULL,
  commitment_amt     NUMBER(16,2)  NOT NULL,
  called_amt         NUMBER(16,2)  NOT NULL,
  distributions_amt  NUMBER(16,2)  NOT NULL,
  nav_amt            NUMBER(16,2)  NOT NULL,
  nav_date           DATE          NOT NULL,
  nav_status         VARCHAR2(12)  NOT NULL,
  administrator      VARCHAR2(40),
  entered_by         VARCHAR2(40),
  approved_by        VARCHAR2(40),
  approved_date      DATE
);

CREATE TABLE capital_calls (
  household_id   VARCHAR2(16)  NOT NULL REFERENCES households,
  display_order  NUMBER(4)     NOT NULL,
  due_label      VARCHAR2(20)  NOT NULL,
  description    VARCHAR2(80)  NOT NULL,
  amount         NUMBER(16,2)  NOT NULL,
  status         VARCHAR2(30)  NOT NULL,
  PRIMARY KEY (household_id, display_order)
);

CREATE TABLE alt_distributions (
  household_id       VARCHAR2(16)  NOT NULL REFERENCES households,
  display_order      NUMBER(4)     NOT NULL,
  paid_date          DATE          NOT NULL,
  fund_short_name    VARCHAR2(40)  NOT NULL,
  distribution_type  VARCHAR2(40)  NOT NULL,
  amount             NUMBER(16,2)  NOT NULL,
  PRIMARY KEY (household_id, display_order)
);

-- Operations --------------------------------------------------------------------

CREATE TABLE ops_queues (
  queue_name              VARCHAR2(60)  PRIMARY KEY,
  opened_today            NUMBER(6)     NOT NULL,
  cleared_today           NUMBER(6)     NOT NULL,
  median_resolve_minutes  NUMBER(6)     NOT NULL,
  auto_assign_time        VARCHAR2(5)   NOT NULL,
  buy_in_day              NUMBER(3)     NOT NULL
);

CREATE TABLE settlement_exception_causes (
  cause_name        VARCHAR2(60)  PRIMARY KEY,
  display_order     NUMBER(4)     NOT NULL,
  suggested_action  VARCHAR2(120) NOT NULL,
  action_short      VARCHAR2(40)  NOT NULL,
  explanation       VARCHAR2(400) NOT NULL
);

CREATE TABLE settlement_exceptions (
  exception_id      VARCHAR2(16)  PRIMARY KEY,
  queue_name        VARCHAR2(60)  NOT NULL REFERENCES ops_queues,
  age_days          NUMBER(4)     NOT NULL,
  settlement_value  NUMBER(16,2)  NOT NULL,
  instrument_name   VARCHAR2(120) NOT NULL,
  side              VARCHAR2(8)   NOT NULL CHECK (side IN ('Deliver', 'Receive')),
  account_no        VARCHAR2(16)  NOT NULL,
  counterparty      VARCHAR2(80)  NOT NULL,
  cause_name        VARCHAR2(60)  NOT NULL REFERENCES settlement_exception_causes,
  owner_name        VARCHAR2(60)
);

-- Client portal -----------------------------------------------------------------

CREATE TABLE portal_activity_feed (
  client_id      VARCHAR2(16)  NOT NULL REFERENCES clients,
  display_order  NUMBER(4)     NOT NULL,
  activity_date  DATE          NOT NULL,
  description    VARCHAR2(120) NOT NULL,
  account_label  VARCHAR2(40)  NOT NULL,
  amount         NUMBER(14,2)  NOT NULL,
  PRIMARY KEY (client_id, display_order)
);

CREATE TABLE pending_requests (
  request_id     NUMBER(10)    PRIMARY KEY,
  client_id      VARCHAR2(16)  NOT NULL REFERENCES clients,
  display_order  NUMBER(4)     NOT NULL,
  title          VARCHAR2(120) NOT NULL,
  amount         NUMBER(14,2),
  status_text    VARCHAR2(120) NOT NULL,
  eta_text       VARCHAR2(120),
  current_step   NUMBER(2)     NOT NULL
);

CREATE TABLE pending_request_steps (
  request_id       NUMBER(10)    NOT NULL REFERENCES pending_requests,
  step_no          NUMBER(2)     NOT NULL,
  step_name        VARCHAR2(40)  NOT NULL,
  step_time_label  VARCHAR2(20),
  PRIMARY KEY (request_id, step_no)
);

CREATE TABLE transactions (
  transaction_id  NUMBER(10)    PRIMARY KEY,
  client_id       VARCHAR2(16)  NOT NULL REFERENCES clients,
  display_order   NUMBER(4)     NOT NULL,
  trade_date      DATE          NOT NULL,
  settle_date     DATE          NOT NULL,
  description     VARCHAR2(120) NOT NULL,
  detail          VARCHAR2(120),
  account_key     VARCHAR2(4)   NOT NULL REFERENCES accounts,
  amount          NUMBER(14,2)  NOT NULL,
  status          VARCHAR2(30)  NOT NULL,
  next_step       VARCHAR2(120)
);

CREATE TABLE payees (
  payee_id       NUMBER(10)    PRIMARY KEY,
  client_id      VARCHAR2(16)  NOT NULL REFERENCES clients,
  display_order  NUMBER(4)     NOT NULL,
  payee_name     VARCHAR2(80)  NOT NULL,
  description    VARCHAR2(120),
  history_label  VARCHAR2(40),
  is_new         NUMBER(1)     DEFAULT 0 NOT NULL CHECK (is_new IN (0, 1))
);

CREATE TABLE payment_rails (
  rail_name      VARCHAR2(30)  PRIMARY KEY,
  display_order  NUMBER(4)     NOT NULL,
  daily_limit    NUMBER(14,2)  NOT NULL,
  fee            NUMBER(8,2)   NOT NULL,
  speed_label    VARCHAR2(80)  NOT NULL,
  arrival_label  VARCHAR2(40)  NOT NULL
);
