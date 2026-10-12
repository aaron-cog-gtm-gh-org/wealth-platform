-- Test seed data for the Whitfield household demo. Run after schema.sql.
SET DEFINE OFF

-- households
INSERT INTO households (household_id, household_name, mandate, next_review_date, advisor_name, total_fee_rate_pct, income_90d, coupons_90d, dividends_90d, tax_lots, alt_net_irr_pct) VALUES ('HH-WHITFIELD', 'Whitfield family', 'Discretionary + Advisory', DATE '2026-11-04', 'Aaron Diamond, CFP', 1.07, 58420, 31880, 26540, 61, 9.8);

-- clients
INSERT INTO clients (client_id, household_id, legal_name, display_name, is_primary, date_of_birth, tax_residency, occupation, risk_profile, risk_score, time_horizon, kyc_status, kyc_reviewed_date, kyc_next_refresh_date, suitability_signed_date, preferred_contact, power_of_attorney, funding_account_key) VALUES ('C-00418823', 'HH-WHITFIELD', 'Eleanor Margaret Whitfield', 'Eleanor Whitfield', 1, DATE '1961-04-17', 'Canada (ON) · SIN on file', 'Retired · former CFO', 'Balanced growth', 6, '10+ years', 'Current', DATE '2026-03-14', DATE '2027-03-14', DATE '2026-03-14', 'Email · weekday mornings', 'Claire Whitfield (property)', 'NR');

-- household_members
INSERT INTO household_members (household_id, display_order, member_name, relationship, accounts_desc) VALUES ('HH-WHITFIELD', 1, 'Eleanor Whitfield', 'Primary · client since 2009', 'NR (joint), RRSP');
INSERT INTO household_members (household_id, display_order, member_name, relationship, accounts_desc) VALUES ('HH-WHITFIELD', 2, 'David Whitfield', 'Spouse · joint owner', 'NR (joint)');
INSERT INTO household_members (household_id, display_order, member_name, relationship, accounts_desc) VALUES ('HH-WHITFIELD', 3, 'Whitfield Holdings Ltd.', 'Holding company · Eleanor 60%, David 40%', 'Corporate');
INSERT INTO household_members (household_id, display_order, member_name, relationship, accounts_desc) VALUES ('HH-WHITFIELD', 4, 'Claire Whitfield', 'Daughter · POA (property)', 'No accounts');

-- accounts
INSERT INTO accounts (account_key, account_no, household_id, account_name, short_name, ownership, management, currencies, drift_pts, drift_status, day_change_pct) VALUES ('NR', '4417-8821', 'HH-WHITFIELD', 'Non-registered investment', 'Non-registered', 'Joint (Eleanor & David)', 'Discretionary', 'CAD', 1.8, 'WARN', 0.31);
INSERT INTO accounts (account_key, account_no, household_id, account_name, short_name, ownership, management, currencies, drift_pts, drift_status, day_change_pct) VALUES ('RR', '4417-9034', 'HH-WHITFIELD', 'RRSP', 'RRSP', 'Eleanor', 'Advisory', 'CAD', -2.6, 'ALERT', 0.12);
INSERT INTO accounts (account_key, account_no, household_id, account_name, short_name, ownership, management, currencies, drift_pts, drift_status, day_change_pct) VALUES ('CO', '4418-1157', 'HH-WHITFIELD', 'Whitfield Holdings Ltd.', 'Whitfield Holdings Ltd.', 'Corporate', 'Advisory', 'CAD + USD', 1.1, 'OK', 0.42);

-- asset_classes
INSERT INTO asset_classes (class_name, display_order, target_weight_pct, price_source) VALUES ('Cash', 1, 3, 'Ledger balance · sum of 214 ledger entries since account open');
INSERT INTO asset_classes (class_name, display_order, target_weight_pct, price_source) VALUES ('Equities', 2, 30, 'Last trade 14:45 ET (15-min delayed) · custodian: RBC Investor Services');
INSERT INTO asset_classes (class_name, display_order, target_weight_pct, price_source) VALUES ('Bonds', 3, 26, 'Evaluated price 14:30 ET · ICE · clean price + accrued per Act/365');
INSERT INTO asset_classes (class_name, display_order, target_weight_pct, price_source) VALUES ('Funds', 4, 28, 'NAV 09-Oct-2026 from Fundserv · forward-priced');
INSERT INTO asset_classes (class_name, display_order, target_weight_pct, price_source) VALUES ('Alternatives', 5, 13, 'Manager NAV 30-Jun-2026 + calls/distributions since · approved by R. Osei 14-Aug-2026');

-- fx_rates
INSERT INTO fx_rates (base_ccy, quote_ccy, rate, rate_source) VALUES ('USD', 'CAD', 1.3683, 'WM/Reuters 14:00 ET');

-- holdings
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (1, 'NR', 'Cash', 1, 'CAD cash', 'Ledger balance', 184220, 1, 184220, 184220, 0, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (2, 'CO', 'Cash', 2, 'USD cash', 'USD sub-account', 96397, 1.3683, 131900, 131900, 0, 'USD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (3, 'RR', 'Cash', 3, 'CAD cash', 'Ledger balance', 42150, 1, 42150, 42150, 0, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (4, 'NR', 'Equities', 4, 'Royal Bank of Canada', 'RY · TSX', 2400, 192.4, 461760, 298400, 0.84, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (5, 'NR', 'Equities', 5, 'Enbridge Inc.', 'ENB · TSX', 5200, 61.85, 321620, 268000, -0.41, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (6, 'RR', 'Equities', 6, 'Canadian National Railway', 'CNR · TSX', 1800, 158.2, 284760, 301500, 0.22, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (7, 'CO', 'Equities', 7, 'Shopify Inc. Cl A', 'SHOP · TSX', 1500, 152.3, 228450, 141000, 2.13, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (8, 'NR', 'Equities', 8, 'Brookfield Corp.', 'BN · TSX', 3600, 84.1, 302760, 211000, 0.65, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (9, 'CO', 'Equities', 9, 'Microsoft Corp.', 'MSFT · NASDAQ · USD', 520, 512.4, 364580, 248000, -0.18, 'USD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (10, 'RR', 'Equities', 10, 'Alimentation Couche-Tard', 'ATD · TSX', 3100, 79.45, 246295, 230100, -0.32, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (11, 'CO', 'Equities', 11, 'Johnson & Johnson', 'JNJ · NYSE · USD', 900, 178.2, 219450, 196000, 0.11, 'USD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (12, 'RR', 'Bonds', 12, 'Govt of Canada 3.25% 01-Dec-2034', 'CA135087R895 · AA+ · accrued $2,180', 600000, 98.42, 590520, 584000, 0.06, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (13, 'NR', 'Bonds', 13, 'Province of Ontario 3.65% 02-Jun-2033', 'CA68333ZAV98 · AA- · accrued $5,120', 400000, 99.15, 396600, 401200, 0.04, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (14, 'RR', 'Bonds', 14, 'Province of Quebec 4.40% 01-Dec-2055', 'CA74814ZFK24 · AA- · accrued $1,240', 250000, 96.8, 242000, 255000, -0.12, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (15, 'CO', 'Bonds', 15, 'Bell Canada 5.15% 14-Nov-2031', 'CA07813ZCN18 · BBB · accrued $6,980', 300000, 103.1, 309300, 300900, 0.02, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (16, 'NR', 'Bonds', 16, 'RBC Deposit Note 4.63% 01-May-2028', 'CA780086XC51 · AA · accrued $1,560', 250000, 101.45, 253625, 250000, 0.01, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (17, 'CO', 'Bonds', 17, 'US Treasury 4.25% 15-Nov-2030', 'US91282CJL64 · AA+ · USD', 200000, 100.62, 275360, 271000, 0.03, 'USD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (18, 'NR', 'Funds', 18, 'RBC Canadian Dividend Fund Sr F', 'RBF6270 · Fundserv', 8420.112, 98.14, 826350, 640000, 0.38, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (19, 'RR', 'Funds', 19, 'PH&N Bond Fund Sr F', 'RBF1330 · Fundserv', 41230.5, 10.12, 417252, 430000, 0.05, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (20, 'RR', 'Funds', 20, 'RBC Global Equity Focus Fund Sr F', 'RBF6670 · Fundserv', 12880.4, 31.66, 407794, 322000, 0.47, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (21, 'CO', 'Funds', 21, 'BlueBay Global Inv. Grade Corp Bond Sr F', 'RBF1910 · Fundserv', 28450, 10.84, 308398, 300000, 0.03, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (22, 'NR', 'Funds', 22, 'RBC Short Term Canadian Bond ETF', 'RBO · TSX', 12000, 19.62, 235440, 236000, 0.02, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (23, 'CO', 'Funds', 23, 'RBC U.S. Dividend Fund Sr F', 'RBF6280 · Fundserv', 6210, 52.18, 324038, 270000, 0.21, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (24, 'CO', 'Alternatives', 24, 'Northgate Infrastructure Partners IV', 'Commitment $1,000,000 · 62% called', 620000, 1.149, 712400, 620000, 0, 'CAD');
INSERT INTO holdings (holding_id, account_key, class_name, display_order, instrument_name, identifier, quantity, price, market_value, cost_basis, day_change_pct, currency) VALUES (25, 'NR', 'Alternatives', 25, 'Lakeshore Private Credit Fund II', 'Commitment $750,000 · 64% called', 480000, 0.977, 468900, 480000, 0, 'CAD');

-- advisor_tasks
INSERT INTO advisor_tasks (household_id, display_order, title, next_step, due_label, priority) VALUES ('HH-WHITFIELD', 1, 'RRSP underweight bonds by 2.6 pts', 'Review proposed rebalance RB-2026-0412', 'Today', 'HIGH');
INSERT INTO advisor_tasks (household_id, display_order, title, next_step, due_label, priority) VALUES ('HH-WHITFIELD', 2, 'Capital call notice · Northgate IV', '$85,000 due 28-Oct · confirm funding from corporate account', '16 days', 'MEDIUM');
INSERT INTO advisor_tasks (household_id, display_order, title, next_step, due_label, priority) VALUES ('HH-WHITFIELD', 3, 'Annual review prep', 'Agenda, performance pack and IPS check', '04-Nov', 'NORMAL');
INSERT INTO advisor_tasks (household_id, display_order, title, next_step, due_label, priority) VALUES ('HH-WHITFIELD', 4, 'RRIF conversion planning', 'Eleanor turns 71 in 2032 · add to review agenda', '04-Nov', 'LOW');
INSERT INTO advisor_tasks (household_id, display_order, title, next_step, due_label, priority) VALUES ('HH-WHITFIELD', 5, 'Beneficiary update requested', 'Signed form received 06-Oct · Ops verifying', 'With Ops', 'LOW');

-- client_communications
INSERT INTO client_communications (household_id, display_order, channel, comm_date, summary) VALUES ('HH-WHITFIELD', 1, 'Email · Eleanor', DATE '2026-10-08', 'Asked about the Northgate capital call and whether USD cash can cover it.');
INSERT INTO client_communications (household_id, display_order, channel, comm_date, summary) VALUES ('HH-WHITFIELD', 2, 'Call · 22 min · David', DATE '2026-09-29', 'Discussed Shopify gain and timing a partial sale in the corporate account.');
INSERT INTO client_communications (household_id, display_order, channel, comm_date, summary) VALUES ('HH-WHITFIELD', 3, 'Secure message sent', DATE '2026-09-15', 'Q2 private investments statement and NAV explanation.');
INSERT INTO client_communications (household_id, display_order, channel, comm_date, summary) VALUES ('HH-WHITFIELD', 4, 'Meeting · in person', DATE '2026-06-12', 'Mid-year review. Agreed to trim Canadian dividend fund toward target.');

-- client_documents
INSERT INTO client_documents (household_id, display_order, title, doc_date) VALUES ('HH-WHITFIELD', 1, 'Q3 2026 consolidated statement', DATE '2026-10-06');
INSERT INTO client_documents (household_id, display_order, title, doc_date) VALUES ('HH-WHITFIELD', 2, 'Northgate IV capital call notice #9', DATE '2026-10-05');
INSERT INTO client_documents (household_id, display_order, title, doc_date) VALUES ('HH-WHITFIELD', 3, 'Investment Policy Statement v4', DATE '2026-03-14');
INSERT INTO client_documents (household_id, display_order, title, doc_date) VALUES ('HH-WHITFIELD', 4, 'KYC & suitability record', DATE '2026-03-14');
INSERT INTO client_documents (household_id, display_order, title, doc_date) VALUES ('HH-WHITFIELD', 5, '2025 T5 / T3 tax pack', DATE '2026-02-28');

-- fee_summary
INSERT INTO fee_summary (household_id, display_order, fee_label, rate_label, amount) VALUES ('HH-WHITFIELD', 1, 'Management fee', '0.85% tiered', 51240);
INSERT INTO fee_summary (household_id, display_order, fee_label, rate_label, amount) VALUES ('HH-WHITFIELD', 2, 'Fund MER (embedded)', '0.21% avg', 11980);
INSERT INTO fee_summary (household_id, display_order, fee_label, rate_label, amount) VALUES ('HH-WHITFIELD', 3, 'Trading commissions', '14 trades', 1390);

-- performance_periods
INSERT INTO performance_periods (household_id, period_code, display_order, start_date, portfolio_return_pct, benchmark_return_pct) VALUES ('HH-WHITFIELD', '1M', 1, DATE '2026-09-12', 0.4, 0.35);
INSERT INTO performance_periods (household_id, period_code, display_order, start_date, portfolio_return_pct, benchmark_return_pct) VALUES ('HH-WHITFIELD', '3M', 2, DATE '2026-07-12', 2.1, 1.8);
INSERT INTO performance_periods (household_id, period_code, display_order, start_date, portfolio_return_pct, benchmark_return_pct) VALUES ('HH-WHITFIELD', 'YTD', 3, DATE '2026-01-01', 7.84, 7.12);
INSERT INTO performance_periods (household_id, period_code, display_order, start_date, portfolio_return_pct, benchmark_return_pct) VALUES ('HH-WHITFIELD', '1Y', 4, DATE '2025-10-12', 11.6, 10.4);
INSERT INTO performance_periods (household_id, period_code, display_order, start_date, portfolio_return_pct, benchmark_return_pct) VALUES ('HH-WHITFIELD', '3Y', 5, DATE '2023-10-12', 28.9, 26.2);
INSERT INTO performance_periods (household_id, period_code, display_order, start_date, portfolio_return_pct, benchmark_return_pct) VALUES ('HH-WHITFIELD', 'Since inception', 6, DATE '2009-03-02', 142.3, 128.7);

-- performance_points
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 0, 0d, 0d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 1, -0.01772971254007327d, -0.011965637281167577d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 2, 0.009814667734400517d, 0.003292868866357509d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 3, 0.038397337623379574d, 0.02588304816296339d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 4, 0.04837149749374893d, 0.036246439103029104d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 5, 0.07731988725263114d, 0.06562584745004832d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 6, 0.07460918937982067d, 0.06462278196941003d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 7, 0.0900232800158188d, 0.07691617813875422d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 8, 0.10053542074094994d, 0.08040732439802029d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 9, 0.10938987653191497d, 0.08328892389001356d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 10, 0.10570221084706508d, 0.08050800109468347d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 11, 0.12714548429993242d, 0.10484735619462901d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 12, 0.14311927333534752d, 0.11150389159396892d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 13, 0.18637162182607475d, 0.1527097496836343d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 14, 0.20012456513134308d, 0.1677466458637611d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 15, 0.20476311315665516d, 0.16491511537637624d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 16, 0.2532115991935697d, 0.20943998799812294d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 17, 0.25016205775516726d, 0.20646117464181293d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 18, 0.2730134992898845d, 0.22691298169320281d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 19, 0.27854168887249964d, 0.23655429844450054d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 20, 0.30341011313118355d, 0.2556650023375855d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 21, 0.3421194941401193d, 0.28482943302303093d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1M', 22, 0.4d, 0.35d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 0, 0d, 0d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 1, -0.10768347122845758d, -0.10584985488354792d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 2, 0.08156594063944679d, 0.0871137648065245d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 3, 0.18574808364167117d, 0.1769159617980426d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 4, 0.3433473262899167d, 0.31954977698348497d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 5, 0.4883142172134369d, 0.4809852747601801d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 6, 0.7383837268485397d, 0.6574038759583841d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 7, 0.905559611255492d, 0.7907059410634497d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 8, 1.1339009806883706d, 1.0298812471887762d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 9, 1.0871466399791545d, 0.9838917810784704d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 10, 1.3311723280381855d, 1.1798137936896136d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 11, 1.3117357526418525d, 1.1236352884819125d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 12, 1.566641618389147d, 1.3076498346622765d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 13, 1.6628615024228866d, 1.388377805977607d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 14, 1.5597355438682379d, 1.3440483865590096d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 15, 1.8143397992265988d, 1.580862324193226d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 16, 1.8608447061376279d, 1.5765657789075695d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 17, 1.9619517838422769d, 1.6883678712659276d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 18, 1.9199272036656683d, 1.6733237662582017d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 19, 1.8261114868108486d, 1.6333919210996888d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 20, 1.8471250879759764d, 1.6597192727486476d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 21, 2.004323588782391d, 1.8183771869761813d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 22, 2.1577346457871447d, 1.9377281609894228d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 23, 2.250197809072268d, 2.0121187239538623d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 24, 2.464182876665517d, 2.2099566452654735d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 25, 2.5265600832541795d, 2.2848040980334146d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3M', 26, 2.1d, 1.8d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 0, 0d, 0d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 1, -0.5064743860394108d, -0.5169341482857865d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 2, 0.1641208968621311d, 0.17055533320419275d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 3, 0.7455593952651879d, 0.8418781610292374d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 4, 0.6785489549980264d, 0.6605817818515476d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 5, 0.5088828354034961d, 0.5342054604426982d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 6, 0.748754121697673d, 0.9256567068950349d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 7, 0.4694520124546497d, 0.8007209054591509d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 8, 0.14280381553266408d, 0.6787050162064212d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 9, 0.9530648747072861d, 1.2644037809055315d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 10, 1.1584199504293597d, 1.5985773407892963d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 11, 0.8584265752539164d, 1.3039601967854237d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 12, 1.3089928423286383d, 1.6319574946375737d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 13, 1.455925437981228d, 1.6332706851937204d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 14, 0.9831070738713755d, 1.0858026893853592d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 15, 1.500603819705082d, 1.5146249324491545d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 16, 1.8670697640276837d, 1.909449087354917d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 17, 1.7444168624898497d, 1.7925489480667502d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 18, 1.6739446765908714d, 1.8829894042037185d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 19, 1.2161564784121497d, 1.350113074385576d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 20, 1.3607607241902318d, 1.4455670815623394d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 21, 2.138181650874662d, 1.9617511047446308d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 22, 2.3523768444532425d, 2.0483106822464565d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 23, 2.378689436349408d, 2.107033720669631d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 24, 2.931194150578974d, 2.542536517479259d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 25, 2.6712644932046845d, 2.334572605247167d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 26, 3.4571773357046673d, 2.9065183820637857d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 27, 3.357057804250466d, 2.939131127215032d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 28, 3.795768883802263d, 3.1887029722930778d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 29, 4.252021530443442d, 3.42299327961193d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 30, 4.174097400691966d, 3.2398926410877196d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 31, 3.688241025768707d, 2.937987322078862d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 32, 3.3347560289280302d, 2.572855830967153d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 33, 3.1352216486752154d, 2.519814666407207d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 34, 3.07564704047239d, 2.5437339428158343d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 35, 2.87267644123802d, 2.5146807629653987d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 36, 3.3510686049792326d, 3.00826723103312d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 37, 3.4259163533148924d, 3.1225674619342776d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 38, 4.212521074165276d, 3.7805694468346633d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 39, 4.122508842389339d, 3.5993202409292175d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'YTD', 40, 7.84d, 7.12d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 0, 0d, 0d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 1, -0.8149257614650561d, -0.7996307926188366d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 2, -0.9945128616229512d, -1.0331040360973702d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 3, -0.718032978550403d, -0.861540401248327d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 4, -0.9848548287776195d, -1.263411791406857d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 5, -1.1756592987281331d, -1.6584187141326348d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 6, -0.44047440348186495d, -0.9577064923402425d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 7, 0.7520233841163142d, 0.16404281556356753d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 8, 1.2265373952727257d, 0.5257492365135567d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 9, 1.0567027392041057d, 0.5608962507752212d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 10, 1.7256591731539699d, 1.1560664430594376d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 11, 1.358568379350486d, 0.6181283105881547d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 12, 0.8600908170441729d, 0.1893076518700026d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 13, 1.1734712692785407d, 0.40515356619849485d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 14, 1.9208761203101112d, 1.3047270700733766d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 15, 2.502596200866687d, 1.724786797739652d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 16, 1.8648842448467349d, 1.3109901440820608d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 17, 1.7126404008025848d, 1.1500952879983442d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 18, 1.1883211541018297d, 0.6950282583476174d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 19, 0.7398020951321432d, 0.37754881257719763d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 20, 1.4028634034070413d, 0.7327674612739903d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 21, 1.966850206541365d, 1.2724374804261314d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 22, 1.5977016023335162d, 0.9594733305654828d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 23, 1.0008562847583318d, 0.5539133279331554d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 24, 1.8710911499902387d, 1.4015059960944136d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 25, 1.2267247645947879d, 0.6889318383469856d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 26, 1.0396839950791024d, 0.4506618331366502d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 27, 0.7683583485182044d, 0.43364105244606765d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 28, 1.7227518540696667d, 1.0514942748400817d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 29, 2.054153309886559d, 1.3122958535045826d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 30, 2.651761690210011d, 1.6887438613461063d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 31, 1.8468846581581668d, 0.8381322324456327d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 32, 2.026428152704167d, 0.7853753095763616d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 33, 1.4094089466560615d, 0.16180416195243735d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 34, 1.9979571765941166d, 0.5679204317040364d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 35, 2.9089877869048686d, 1.1269545793870244d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 36, 3.6739086197491755d, 2.0372094311457163d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 37, 4.291660776390753d, 2.5056040075457666d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 38, 4.342046498056167d, 2.5336577200217434d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 39, 4.230298119555369d, 2.387083665444554d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 40, 4.4027080981067765d, 2.6298524651968163d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 41, 5.270870936924785d, 3.122903772990733d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 42, 6.169303874964648d, 3.9817660651656643d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 43, 6.698684873900268d, 4.204190400194187d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 44, 6.283662214229588d, 3.7194315382600918d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 45, 7.135313977137177d, 4.248841405796187d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 46, 7.530693464257793d, 4.553756831793375d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 47, 8.427350894559877d, 5.259453598812063d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 48, 9.566401655060856d, 6.225152292035127d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 49, 9.233324727776003d, 6.126311952275465d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 50, 10.165150102827516d, 6.90265657286116d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 51, 9.742114287629416d, 6.670811349776488d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '1Y', 52, 11.6d, 10.4d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 0, 0d, 0d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 1, -1.787840465135902d, -1.4190495994741665d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 2, -0.05204674242459839d, 0.6988683005253424d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 3, 2.6007991349697726d, 3.4375201558758053d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 4, 5.985730767425541d, 5.84988737999182d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 5, 5.334983851527736d, 5.141331057178819d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 6, 7.662102440378987d, 7.100837613669271d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 7, 10.525721489670763d, 9.994143993932443d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 8, 12.018892770361674d, 10.75010583279744d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 9, 10.96504002044212d, 10.506326765866286d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 10, 13.177512681095529d, 11.835994637163713d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 11, 13.76661043689873d, 11.893568960286803d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 12, 12.951794730688967d, 10.933703340504195d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 13, 15.172414436993895d, 12.692204910190107d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 14, 15.720539453581635d, 13.530157196888766d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 15, 14.337624087754769d, 12.797813876823161d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 16, 13.225086718369052d, 11.714828936442625d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 17, 16.24138512160517d, 13.804620049902699d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 18, 18.08914362070762d, 15.682274679552378d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 19, 17.97030808699134d, 16.13060397463242d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 20, 19.889088149537624d, 17.36336665035888d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 21, 23.266418065125d, 20.345436855102808d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 22, 22.916444075702472d, 19.576892307139005d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 23, 21.832126449814528d, 18.74635819080025d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 24, 20.381674136149844d, 17.69030669146463d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 25, 21.397949926286177d, 18.317787837493924d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 26, 21.97271550459923d, 19.27305134554048d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 27, 23.464657301698175d, 20.064248543093264d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 28, 24.853022779031086d, 21.236506164284794d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 29, 23.376974296362373d, 20.554364143819495d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 30, 25.99039098567315d, 22.747698613672586d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 31, 27.763542278361797d, 24.50116686838234d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 32, 29.369772747683633d, 25.719833429184064d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 33, 30.660178538336798d, 27.470006636436164d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 34, 33.37130659233207d, 29.344205683698583d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 35, 35.10983958435153d, 31.268253968283695d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', '3Y', 36, 28.9d, 26.2d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 0, 0d, 0d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 1, -10.350536798138112d, -7.764855930444834d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 2, -4.878262427856647d, -6.143887036083679d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 3, -6.078687692337057d, -6.264665196565126d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 4, 6.535317254979156d, 2.396975981135514d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 5, 4.869696760516162d, 0.30651810958779635d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 6, 0.10475945226790451d, -2.2431334182572256d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 7, 2.433942880195851d, 0.6637135451175555d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 8, 7.732562919750764d, 2.485698671351744d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 9, 20.25222653456416d, 11.688497434950827d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 10, 14.55087957960719d, 5.5188405932818725d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 11, 19.3960183957123d, 9.797548829136554d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 12, 12.4728749094088d, 4.522251030717719d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 13, 25.822565840902385d, 18.513838889263003d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 14, 38.469257626093274d, 30.085795212302585d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 15, 52.82130795193898d, 43.08092535379398d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 16, 44.06910378317618d, 35.19001015772183d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 17, 34.08499486888775d, 24.113744548719946d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 18, 32.93825025400532d, 25.475799656552184d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 19, 38.02792646033811d, 32.90173257746632d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 20, 32.94115699522408d, 28.953250273961007d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 21, 35.24747233221564d, 31.80699347001271d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 22, 42.366681810754066d, 39.0782544655105d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 23, 47.10398376837529d, 44.81788127848472d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 24, 41.31722661101226d, 38.2979485459438d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 25, 40.008569796858964d, 37.97120182654313d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 26, 35.39506920371693d, 31.479562657273295d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 27, 39.77962348807776d, 33.955810972379766d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 28, 54.16646527389122d, 45.87964189059963d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 29, 64.14172504559494d, 55.83009630945005d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 30, 68.94741317070721d, 60.807916955305075d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 31, 75.62884174058011d, 66.05755668087205d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 32, 75.22140530891478d, 68.74208005532955d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 33, 73.74106918247567d, 70.52238408800721d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 34, 78.13948343599789d, 73.61801306496032d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 35, 90.86631995615915d, 82.60775891395697d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 36, 100.89916210817702d, 91.21410570224435d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 37, 95.73010615585325d, 87.23763763867602d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 38, 87.42451372794065d, 80.05332515441437d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 39, 77.87338769157772d, 70.04030544318653d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 40, 70.52538417006204d, 65.83171307128883d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 41, 64.36036588361671d, 57.69321006993785d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 42, 72.16316462607561d, 62.6309444551368d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 43, 68.60613116302204d, 58.4293805645493d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 44, 69.00473995729179d, 61.14486820254157d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 45, 78.30967620876615d, 71.53865577618076d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 46, 84.3040225257254d, 77.23998933424117d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 47, 86.14931939847904d, 76.45865888085027d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 48, 76.76532318782787d, 70.86488196263899d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 49, 74.2745803131431d, 71.83050199443326d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 50, 87.43502154874274d, 84.5096809473138d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 51, 84.16089298762716d, 84.61667164624481d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 52, 86.29775975526346d, 86.12849347219012d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 53, 76.46564394768575d, 79.8950317397573d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 54, 76.72729390939308d, 83.3465022278653d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 55, 68.14341232309138d, 78.47716264917321d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 56, 60.72032286714577d, 72.47545718585516d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 57, 65.37081097639965d, 78.37183337333732d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 58, 62.90784124838415d, 74.36592789898805d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 59, 67.37119938398659d, 81.46705280803148d);
INSERT INTO performance_points (household_id, period_code, point_index, portfolio_pct, benchmark_pct) VALUES ('HH-WHITFIELD', 'Since inception', 60, 142.3d, 128.7d);

-- rebalance_proposals
INSERT INTO rebalance_proposals (proposal_id, household_id, status, tracking_error_before_pct, tracking_error_after_pct) VALUES ('RB-2026-0412', 'HH-WHITFIELD', 'Draft', 1.9, 0.6);

-- proposal_trades
INSERT INTO proposal_trades (proposal_id, line_no, side, instrument_name, account_key, quantity_label, trade_value, est_cost, realized_gain, route, note) VALUES ('RB-2026-0412', 1, 'SELL', 'RBC Canadian Dividend Fund Sr F', 'NR', '1,200.000 units', 117768, 0, 26560, 'Fundserv · NAV 12-Oct', 'Forward-priced · cut-off 16:00 ET');
INSERT INTO proposal_trades (proposal_id, line_no, side, instrument_name, account_key, quantity_label, trade_value, est_cost, realized_gain, route, note) VALUES ('RB-2026-0412', 2, 'SELL', 'Shopify Inc. Cl A', 'CO', '400 sh', 60920, 9.95, 23320, 'RBC DS Equity desk', 'Limit $151.80 · day');
INSERT INTO proposal_trades (proposal_id, line_no, side, instrument_name, account_key, quantity_label, trade_value, est_cost, realized_gain, route, note) VALUES ('RB-2026-0412', 3, 'SELL', 'Alimentation Couche-Tard', 'RR', '1,400 sh', 111230, 9.95, 0, 'RBC DS Equity desk', 'Registered · no tax impact');
INSERT INTO proposal_trades (proposal_id, line_no, side, instrument_name, account_key, quantity_label, trade_value, est_cost, realized_gain, route, note) VALUES ('RB-2026-0412', 4, 'BUY', 'Govt of Canada 3.25% 01-Dec-2034', 'RR', '100,000 face', 98420, 150, 0, 'RBC CM Fixed Income', 'Indicative 98.42 + accrued $363');
INSERT INTO proposal_trades (proposal_id, line_no, side, instrument_name, account_key, quantity_label, trade_value, est_cost, realized_gain, route, note) VALUES ('RB-2026-0412', 5, 'BUY', 'Province of Ontario 3.65% 02-Jun-2033', 'NR', '50,000 face', 49575, 90, 0, 'RBC CM Fixed Income', 'Indicative 99.15 + accrued $640');
INSERT INTO proposal_trades (proposal_id, line_no, side, instrument_name, account_key, quantity_label, trade_value, est_cost, realized_gain, route, note) VALUES ('RB-2026-0412', 6, 'BUY', 'Canadian National Railway', 'RR', '300 sh', 47460, 9.95, 0, 'RBC DS Equity desk', 'Market · day');
INSERT INTO proposal_trades (proposal_id, line_no, side, instrument_name, account_key, quantity_label, trade_value, est_cost, realized_gain, route, note) VALUES ('RB-2026-0412', 7, 'BUY', 'Microsoft Corp.', 'RR', '80 sh', 56100, 9.95, 0, 'RBC DS US Equity', 'USD · FX converted at execution');

-- pretrade_checks
INSERT INTO pretrade_checks (proposal_id, display_order, check_code, check_name, status, detail) VALUES ('RB-2026-0412', 1, 'MANDATE_LIMITS', 'Mandate limits', 'PASS', 'All accounts within IPS bands after trades (equity 25–35%, fixed income 20–32%).');
INSERT INTO pretrade_checks (proposal_id, display_order, check_code, check_name, status, detail) VALUES ('RB-2026-0412', 2, 'CONCENTRATION', 'Single-issuer concentration', 'PASS', 'Largest issuer after trades: Govt of Canada 8.0% (limit 10%).');
INSERT INTO pretrade_checks (proposal_id, display_order, check_code, check_name, status, detail) VALUES ('RB-2026-0412', 3, 'RESTRICTED_LIST', 'Restricted & watch lists', 'PASS', 'No instruments on RBC restricted list. RY: employee pre-clearance not required for client accounts.');
INSERT INTO pretrade_checks (proposal_id, display_order, check_code, check_name, status, detail) VALUES ('RB-2026-0412', 4, 'CASH_AVAILABILITY', 'Cash availability', 'LIVE', NULL);
INSERT INTO pretrade_checks (proposal_id, display_order, check_code, check_name, status, detail) VALUES ('RB-2026-0412', 5, 'SUITABILITY', 'Suitability vs risk profile', 'PASS', 'Portfolio risk score 5.8 after trades vs client profile 6/10.');
INSERT INTO pretrade_checks (proposal_id, display_order, check_code, check_name, status, detail) VALUES ('RB-2026-0412', 6, 'FUND_CUTOFF', 'Fund dealing cut-off', 'WARN', 'Fund order placed 14:47 ET prices at 12-Oct NAV if submitted before 16:00 ET. 1h 13m remaining.');
INSERT INTO pretrade_checks (proposal_id, display_order, check_code, check_name, status, detail) VALUES ('RB-2026-0412', 7, 'TAX_IMPACT', 'Tax impact', 'WARN', 'Realized capital gains $49,880 ($26,560 joint NR, $23,320 corporate). Client informed on 29-Sep call.');
INSERT INTO pretrade_checks (proposal_id, display_order, check_code, check_name, status, detail) VALUES ('RB-2026-0412', 8, 'SUPERFICIAL_LOSS', 'Superficial loss', 'PASS', 'No repurchases of instruments sold at a loss in the last 30 days.');

-- proposal_drift
INSERT INTO proposal_drift (proposal_id, class_name, drift_before_pts, drift_after_pts) VALUES ('RB-2026-0412', 'Cash', 1.2, 0.9);
INSERT INTO proposal_drift (proposal_id, class_name, drift_before_pts, drift_after_pts) VALUES ('RB-2026-0412', 'Equities', -1.6, -0.4);
INSERT INTO proposal_drift (proposal_id, class_name, drift_before_pts, drift_after_pts) VALUES ('RB-2026-0412', 'Bonds', -1.8, -0.3);
INSERT INTO proposal_drift (proposal_id, class_name, drift_before_pts, drift_after_pts) VALUES ('RB-2026-0412', 'Funds', 1.4, 0);
INSERT INTO proposal_drift (proposal_id, class_name, drift_before_pts, drift_after_pts) VALUES ('RB-2026-0412', 'Alternatives', 0.8, 0.8);

-- alt_commitments
INSERT INTO alt_commitments (commitment_id, household_id, display_order, fund_name, account_key, currency, vintage, commitment_amt, called_amt, distributions_amt, nav_amt, nav_date, nav_status, administrator, entered_by, approved_by, approved_date) VALUES (1, 'HH-WHITFIELD', 1, 'Northgate Infrastructure Partners IV', 'CO', 'CAD', 2021, 1000000, 620000, 92000, 712400, DATE '2026-06-30', 'APPROVED', 'SS&C', 'M. Tremblay', 'R. Osei', DATE '2026-08-14');
INSERT INTO alt_commitments (commitment_id, household_id, display_order, fund_name, account_key, currency, vintage, commitment_amt, called_amt, distributions_amt, nav_amt, nav_date, nav_status, administrator, entered_by, approved_by, approved_date) VALUES (2, 'HH-WHITFIELD', 2, 'Lakeshore Private Credit Fund II', 'NR', 'CAD', 2023, 750000, 480000, 61200, 468900, DATE '2026-06-30', 'APPROVED', 'SS&C', 'M. Tremblay', 'R. Osei', DATE '2026-08-14');

-- capital_calls
INSERT INTO capital_calls (household_id, display_order, due_label, description, amount, status) VALUES ('HH-WHITFIELD', 1, '28-Oct-2026', 'Northgate IV · call #10', 85000, 'Notice received');
INSERT INTO capital_calls (household_id, display_order, due_label, description, amount, status) VALUES ('HH-WHITFIELD', 2, 'Jan-2027', 'Lakeshore II · est.', 60000, 'Estimate');
INSERT INTO capital_calls (household_id, display_order, due_label, description, amount, status) VALUES ('HH-WHITFIELD', 3, 'Mar-2027', 'Northgate IV · est.', 110000, 'Estimate');
INSERT INTO capital_calls (household_id, display_order, due_label, description, amount, status) VALUES ('HH-WHITFIELD', 4, 'Jun-2027', 'Lakeshore II · est.', 75000, 'Estimate');

-- alt_distributions
INSERT INTO alt_distributions (household_id, display_order, paid_date, fund_short_name, distribution_type, amount) VALUES ('HH-WHITFIELD', 1, DATE '2026-09-15', 'Lakeshore II', 'Income', 14800);
INSERT INTO alt_distributions (household_id, display_order, paid_date, fund_short_name, distribution_type, amount) VALUES ('HH-WHITFIELD', 2, DATE '2026-06-30', 'Northgate IV', 'Return of capital', 38000);
INSERT INTO alt_distributions (household_id, display_order, paid_date, fund_short_name, distribution_type, amount) VALUES ('HH-WHITFIELD', 3, DATE '2026-06-15', 'Lakeshore II', 'Income', 13900);
INSERT INTO alt_distributions (household_id, display_order, paid_date, fund_short_name, distribution_type, amount) VALUES ('HH-WHITFIELD', 4, DATE '2026-03-31', 'Northgate IV', 'Income', 22000);
INSERT INTO alt_distributions (household_id, display_order, paid_date, fund_short_name, distribution_type, amount) VALUES ('HH-WHITFIELD', 5, DATE '2026-03-15', 'Lakeshore II', 'Income', 12600);

-- ops_queues
INSERT INTO ops_queues (queue_name, opened_today, cleared_today, median_resolve_minutes, auto_assign_time, buy_in_day) VALUES ('Wealth Ops – Toronto', 7, 23, 190, '15:00', 7);

-- settlement_exception_causes
INSERT INTO settlement_exception_causes (cause_name, display_order, suggested_action, action_short, explanation) VALUES ('Insufficient securities', 1, 'Borrow or recall from stock-loan desk', 'Recall loan', 'Counterparty did not have the shares available on settlement date. RBC has 1,200 shares on loan that can be recalled to cover delivery.');
INSERT INTO settlement_exception_causes (cause_name, display_order, suggested_action, action_short, explanation) VALUES ('SSI mismatch', 2, 'Re-send instruction with corrected SSI', 'Re-send SSI', 'Counterparty BIC on our instruction does not match their standing settlement instructions on file. Their updated SSI was received 08-Oct.');
INSERT INTO settlement_exception_causes (cause_name, display_order, suggested_action, action_short, explanation) VALUES ('Late affirmation', 3, 'Chase broker to affirm in CTM', 'Chase broker', 'Trade was not affirmed by the broker before the cut-off. Affirmation usually lands within one business day once chased.');
INSERT INTO settlement_exception_causes (cause_name, display_order, suggested_action, action_short, explanation) VALUES ('Cash shortfall', 4, 'Fund from sweep account or approve overdraft', 'Fund from sweep', 'Cash in the settling account is below the amount due. The linked sweep account has sufficient balance to cover it.');
INSERT INTO settlement_exception_causes (cause_name, display_order, suggested_action, action_short, explanation) VALUES ('Unmatched instruction', 5, 'Contact counterparty to match trade details', 'Contact counterparty', 'No matching instruction from the counterparty at the depository. Usually caused by a booking delay on their side.');
INSERT INTO settlement_exception_causes (cause_name, display_order, suggested_action, action_short, explanation) VALUES ('Quantity / price mismatch', 6, 'Verify fill against broker confirm', 'Verify confirm', 'Our booked quantity or price differs from the counterparty confirmation. Compare against the broker fill before amending.');
INSERT INTO settlement_exception_causes (cause_name, display_order, suggested_action, action_short, explanation) VALUES ('Corporate action pending', 7, 'Hold until event processed', 'Place on hold', 'A corporate action on this instrument affects entitlements. Settlement should wait until the event is processed.');

-- settlement_exceptions
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48260', 'Wealth Ops – Toronto', 11, 1942050, 'Microsoft Corp.', 'Receive', '4436-5279', 'Goldman Sachs & Co.', 'Quantity / price mismatch', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48155', 'Wealth Ops – Toronto', 10, 1290200, 'Manulife Financial', 'Deliver', '4442-3295', 'Fidelity Clearing Canada', 'Quantity / price mismatch', 'A. Nguyen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48197', 'Wealth Ops – Toronto', 10, 56930, 'Shopify Inc. Cl A', 'Deliver', '4468-3593', 'BNY Mellon', 'Cash shortfall', 'S. Okafor');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48344', 'Wealth Ops – Toronto', 10, 35050, 'Canadian National Railway', 'Deliver', '4482-6125', 'CDS Clearing', 'Unmatched instruction', 'S. Okafor');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48211', 'Wealth Ops – Toronto', 9, 458510, 'Royal Bank of Canada', 'Receive', '4403-6014', 'Euroclear', 'Late affirmation', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48169', 'Wealth Ops – Toronto', 9, 456520, 'Telus Corp.', 'Deliver', '4442-8300', 'Fidelity Clearing Canada', 'Cash shortfall', 'M. Tremblay');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48302', 'Wealth Ops – Toronto', 9, 335070, 'Telus Corp.', 'Receive', '4465-7268', 'BNY Mellon', 'Corporate action pending', 'A. Nguyen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48372', 'Wealth Ops – Toronto', 8, 424590, 'Bell Canada 5.15% 2031', 'Deliver', '4473-8624', 'CDS Clearing', 'Cash shortfall', 'S. Okafor');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48162', 'Wealth Ops – Toronto', 8, 301850, 'Telus Corp.', 'Receive', '4465-9559', 'Fidelity Clearing Canada', 'Corporate action pending', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48288', 'Wealth Ops – Toronto', 7, 65580, 'Microsoft Corp.', 'Deliver', '4476-1868', 'Fundserv · PH&N', 'Quantity / price mismatch', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48134', 'Wealth Ops – Toronto', 6, 847100, 'US Treasury 4.25% 2030', 'Receive', '4423-3770', 'BNY Mellon', 'SSI mismatch', 'A. Nguyen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48218', 'Wealth Ops – Toronto', 5, 2356550, 'Bell Canada 5.15% 2031', 'Deliver', '4417-6882', 'RBC Investor Services', 'Late affirmation', 'M. Tremblay');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48351', 'Wealth Ops – Toronto', 5, 1328020, 'PH&N Bond Fund Sr F', 'Receive', '4436-9708', 'Fidelity Clearing Canada', 'Corporate action pending', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48365', 'Wealth Ops – Toronto', 4, 1459790, 'Govt of Canada 3.25% 2034', 'Receive', '4493-2126', 'DTC / Pershing', 'Quantity / price mismatch', 'L. Chen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48141', 'Wealth Ops – Toronto', 4, 1225420, 'Royal Bank of Canada', 'Receive', '4487-5698', 'CDS Clearing', 'SSI mismatch', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48239', 'Wealth Ops – Toronto', 3, 2045030, 'Govt of Canada 3.25% 2034', 'Receive', '4482-8503', 'Fundserv · PH&N', 'SSI mismatch', 'M. Tremblay');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48358', 'Wealth Ops – Toronto', 3, 1174890, 'Brookfield Corp.', 'Receive', '4477-1837', 'RBC Investor Services', 'Cash shortfall', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48225', 'Wealth Ops – Toronto', 3, 936100, 'Province of Ontario 3.65% 2033', 'Receive', '4448-5584', 'CDS Clearing', 'SSI mismatch', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48232', 'Wealth Ops – Toronto', 3, 757690, 'Microsoft Corp.', 'Deliver', '4436-1938', 'Fidelity Clearing Canada', 'Quantity / price mismatch', 'S. Okafor');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48204', 'Wealth Ops – Toronto', 3, 626720, 'Microsoft Corp.', 'Receive', '4479-8859', 'Euroclear', 'Corporate action pending', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48393', 'Wealth Ops – Toronto', 2, 1056900, 'Apple Inc.', 'Deliver', '4436-8037', 'Goldman Sachs & Co.', 'SSI mismatch', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48120', 'Wealth Ops – Toronto', 2, 238110, 'Royal Bank of Canada', 'Deliver', '4440-5656', 'RBC Investor Services', 'Insufficient securities', 'L. Chen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48330', 'Wealth Ops – Toronto', 2, 204600, 'Manulife Financial', 'Deliver', '4412-5909', 'Fidelity Clearing Canada', 'Cash shortfall', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48148', 'Wealth Ops – Toronto', 1, 1955100, 'Royal Bank of Canada', 'Deliver', '4479-9542', 'Euroclear', 'Corporate action pending', 'M. Tremblay');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48190', 'Wealth Ops – Toronto', 1, 1784860, 'PH&N Bond Fund Sr F', 'Deliver', '4430-5795', 'Euroclear', 'Cash shortfall', 'R. Singh');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48295', 'Wealth Ops – Toronto', 1, 611110, 'Shopify Inc. Cl A', 'Receive', '4451-8111', 'Goldman Sachs & Co.', 'Late affirmation', 'L. Chen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48386', 'Wealth Ops – Toronto', 0, 2073830, 'Govt of Canada 3.25% 2034', 'Receive', '4433-5833', 'CDS Clearing', 'Unmatched instruction', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48323', 'Wealth Ops – Toronto', 0, 1945170, 'Province of Ontario 3.65% 2033', 'Deliver', '4434-4140', 'Goldman Sachs & Co.', 'Insufficient securities', 'M. Tremblay');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48176', 'Wealth Ops – Toronto', 0, 1647310, 'Enbridge Inc.', 'Receive', '4454-4389', 'RBC Investor Services', 'Insufficient securities', 'A. Nguyen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48253', 'Wealth Ops – Toronto', 0, 1480870, 'Canadian National Railway', 'Receive', '4477-5375', 'Fidelity Clearing Canada', 'Quantity / price mismatch', 'A. Nguyen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48127', 'Wealth Ops – Toronto', 0, 1227070, 'Shopify Inc. Cl A', 'Receive', '4458-8439', 'RBC Investor Services', 'SSI mismatch', 'A. Nguyen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48274', 'Wealth Ops – Toronto', 0, 808990, 'RBC Canadian Dividend Fund Sr F', 'Deliver', '4449-4275', 'DTC / Pershing', 'Quantity / price mismatch', 'R. Singh');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48183', 'Wealth Ops – Toronto', 0, 793010, 'US Treasury 4.25% 2030', 'Deliver', '4409-9814', 'Goldman Sachs & Co.', 'Late affirmation', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48267', 'Wealth Ops – Toronto', 0, 772540, 'PH&N Bond Fund Sr F', 'Deliver', '4431-1762', 'RBC Investor Services', 'Cash shortfall', 'R. Singh');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48281', 'Wealth Ops – Toronto', 0, 742430, 'Govt of Canada 3.25% 2034', 'Deliver', '4483-1244', 'Fidelity Clearing Canada', 'Unmatched instruction', 'R. Singh');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48316', 'Wealth Ops – Toronto', 0, 631580, 'US Treasury 4.25% 2030', 'Deliver', '4448-3320', 'DTC / Pershing', 'Cash shortfall', NULL);
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48309', 'Wealth Ops – Toronto', 0, 261170, 'Manulife Financial', 'Deliver', '4492-8017', 'CDS Clearing', 'Corporate action pending', 'A. Nguyen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48246', 'Wealth Ops – Toronto', 0, 238820, 'Telus Corp.', 'Deliver', '4455-4800', 'Fidelity Clearing Canada', 'SSI mismatch', 'L. Chen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48379', 'Wealth Ops – Toronto', 0, 175000, 'Enbridge Inc.', 'Deliver', '4406-8137', 'RBC Investor Services', 'Corporate action pending', 'L. Chen');
INSERT INTO settlement_exceptions (exception_id, queue_name, age_days, settlement_value, instrument_name, side, account_no, counterparty, cause_name, owner_name) VALUES ('SF-48337', 'Wealth Ops – Toronto', 0, 42190, 'Enbridge Inc.', 'Deliver', '4467-1152', 'Fidelity Clearing Canada', 'Insufficient securities', 'S. Okafor');

-- portal_activity_feed
INSERT INTO portal_activity_feed (client_id, display_order, activity_date, description, account_label, amount) VALUES ('C-00418823', 1, DATE '2026-10-09', 'Dividend · Royal Bank of Canada', 'Non-registered', 2208);
INSERT INTO portal_activity_feed (client_id, display_order, activity_date, description, account_label, amount) VALUES ('C-00418823', 2, DATE '2026-10-09', 'Bought PH&N Bond Fund Sr F', 'RRSP', -25000);
INSERT INTO portal_activity_feed (client_id, display_order, activity_date, description, account_label, amount) VALUES ('C-00418823', 3, DATE '2026-10-06', 'Interest · CAD cash', 'Non-registered', 612.4);
INSERT INTO portal_activity_feed (client_id, display_order, activity_date, description, account_label, amount) VALUES ('C-00418823', 4, DATE '2026-10-01', 'Coupon · Bell Canada 5.15%', 'Whitfield Holdings', 7725);
INSERT INTO portal_activity_feed (client_id, display_order, activity_date, description, account_label, amount) VALUES ('C-00418823', 5, DATE '2026-09-30', 'Management fee · Q3', 'All accounts', -17080);
INSERT INTO portal_activity_feed (client_id, display_order, activity_date, description, account_label, amount) VALUES ('C-00418823', 6, DATE '2026-09-15', 'Distribution · Lakeshore II', 'Non-registered', 14800);

-- pending_requests
INSERT INTO pending_requests (request_id, client_id, display_order, title, amount, status_text, eta_text, current_step) VALUES (1, 'C-00418823', 1, 'Wire to TD Canada Trust ···4471', 40000, 'Second approval in progress', 'Expected today by 4:00 PM', 2);
INSERT INTO pending_requests (request_id, client_id, display_order, title, amount, status_text, eta_text, current_step) VALUES (2, 'C-00418823', 2, 'Buy PH&N Bond Fund Sr F', 25000, 'Waiting for fund price', 'Price known tonight · settles 14-Oct', 1);
INSERT INTO pending_requests (request_id, client_id, display_order, title, amount, status_text, eta_text, current_step) VALUES (3, 'C-00418823', 3, 'Capital call · Northgate IV', 85000, 'Notice received · funding from corporate account', 'Due 28-Oct-2026', 1);
INSERT INTO pending_requests (request_id, client_id, display_order, title, amount, status_text, eta_text, current_step) VALUES (4, 'C-00418823', 4, 'Beneficiary designation · RRSP', NULL, 'Form received · being verified', 'Usually 3–5 business days', 1);

-- pending_request_steps
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (1, 1, 'Submitted', '13:12');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (1, 2, 'Screening', '13:13');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (1, 3, 'Approval', 'by 16:00');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (1, 4, 'Sent', NULL);
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (1, 5, 'Received', 'by 17:30');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (2, 1, 'Placed', '09-Oct');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (2, 2, 'Priced', '12-Oct eve');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (2, 3, 'Settled', '14-Oct');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (3, 1, 'Notice', '05-Oct');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (3, 2, 'Funding', 'by 26-Oct');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (3, 3, 'Paid', '28-Oct');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (3, 4, 'Matched', NULL);
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (4, 1, 'Received', '06-Oct');
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (4, 2, 'Verified', NULL);
INSERT INTO pending_request_steps (request_id, step_no, step_name, step_time_label) VALUES (4, 3, 'Updated', NULL);

-- transactions
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (1, 'C-00418823', 1, DATE '2026-10-12', DATE '2026-10-14', 'Buy · PH&N Bond Fund Sr F', '2,470.4 units at NAV tbc', 'RR', -25000, 'Awaiting price', 'NAV published ~19:00 ET');
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (2, 'C-00418823', 2, DATE '2026-10-12', DATE '2026-10-12', 'Wire out · TD Canada Trust ···4471', 'Ref PMT-2026-1012-08841', 'NR', -40000, 'In approval', 'Second approver by 16:00 ET');
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (3, 'C-00418823', 3, DATE '2026-10-09', DATE '2026-10-09', 'Dividend · Royal Bank of Canada', '2,400 sh × $1.48 · eligible', 'NR', 3552, 'Settled', NULL);
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (4, 'C-00418823', 4, DATE '2026-10-08', DATE '2026-10-10', 'Sell · Enbridge Inc.', '800 sh at $62.10', 'NR', 49670, 'Settlement failed', 'Retrying 13-Oct · no action needed');
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (5, 'C-00418823', 5, DATE '2026-10-08', DATE '2026-10-09', 'Buy · Govt of Canada 3.25% 2034', '50,000 face at 98.30 + accrued', 'RR', -49332, 'Settled', NULL);
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (6, 'C-00418823', 6, DATE '2026-10-06', DATE '2026-10-06', 'Interest · CAD cash', 'Sept accrual at 2.15%', 'NR', 612.4, 'Settled', NULL);
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (7, 'C-00418823', 7, DATE '2026-10-05', DATE '2026-10-28', 'Capital call · Northgate IV #10', 'Notice received', 'CO', -85000, 'Scheduled', 'Paid 28-Oct from USD/CAD cash');
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (8, 'C-00418823', 8, DATE '2026-10-01', DATE '2026-10-01', 'Coupon · Bell Canada 5.15%', '300,000 face · semi-annual', 'CO', 7725, 'Settled', NULL);
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (9, 'C-00418823', 9, DATE '2026-09-30', DATE '2026-09-30', 'Management fee · Q3 2026', '0.85% tiered on avg AUA', 'NR', -17080, 'Settled', NULL);
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (10, 'C-00418823', 10, DATE '2026-09-29', DATE '2026-09-30', 'Sell · Shopify Inc. Cl A', '200 sh at $149.80', 'CO', 29950, 'Settled', NULL);
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (11, 'C-00418823', 11, DATE '2026-09-24', DATE '2026-09-24', 'FX · USD → CAD', 'US$20,000 at 1.3651', 'CO', 27302, 'Settled', NULL);
INSERT INTO transactions (transaction_id, client_id, display_order, trade_date, settle_date, description, detail, account_key, amount, status, next_step) VALUES (12, 'C-00418823', 12, DATE '2026-09-15', DATE '2026-09-15', 'Distribution · Lakeshore II', 'Income · Q3', 'NR', 14800, 'Settled', NULL);

-- payees
INSERT INTO payees (payee_id, client_id, display_order, payee_name, description, history_label, is_new) VALUES (1, 'C-00418823', 1, 'TD Canada Trust ···4471', 'David Whitfield · chequing', 'Paid 6× since 2023', 0);
INSERT INTO payees (payee_id, client_id, display_order, payee_name, description, history_label, is_new) VALUES (2, 'C-00418823', 2, 'Ontario Land Registry Trust', 'Lawyer trust account · Hughes LLP', 'New · added 02-Oct', 1);
INSERT INTO payees (payee_id, client_id, display_order, payee_name, description, history_label, is_new) VALUES (3, 'C-00418823', 3, 'RBC Royal Bank ···0093', 'Eleanor · chequing', 'Paid 41×', 0);

-- payment_rails
INSERT INTO payment_rails (rail_name, display_order, daily_limit, fee, speed_label, arrival_label) VALUES ('Wire', 1, 250000, 25, 'Same day if approved by 4:00 PM ET', 'Today by 5:30 PM ET');
INSERT INTO payment_rails (rail_name, display_order, daily_limit, fee, speed_label, arrival_label) VALUES ('EFT', 2, 100000, 0, '1–2 business days', 'Wed 14-Oct-2026');
INSERT INTO payment_rails (rail_name, display_order, daily_limit, fee, speed_label, arrival_label) VALUES ('Interac e-Transfer', 3, 3000, 0, 'Within 30 minutes', 'Within 30 minutes');
