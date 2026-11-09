# Feature Specification: Custody area (Portfolio Viewer integration)

**Feature Branch**: `feature/legacy-pv-integration`
**Created**: 2026-11-09
**Status**: Draft
**Input**: "Integrate aaron-cog-gtm-gh-org/legacy-wealth-platform (Portfolio Viewer) into aaron-cog-gtm-gh-org/wealth-platform."

## Context

Portfolio Viewer (PV) is the operations desk's holdings and settlement viewer for the UK custody
book held at the custodian (Kestrel). It reads the custodian's MT535 statements of holdings and
MT544–MT547 settlement confirmations from a file archive, joins them to reference data (clients,
accounts, instruments, reconciliation notes), and lets Ops reconcile each weekly statement against
the settlements booked since the previous one. This feature brings every PV capability into the
Wealth Platform workspace as a **Custody** area so PV can be retired.

Reference volumes (current archive): 50 clients, 120 GBP accounts, 302 instruments, 13 recon notes,
3,073 MT535 statements over 26 weekly statement dates (2026-04-17 to 2026-10-09), and 2,971
MT54x confirmations across 122 settlement days (2026-04-20 to 2026-10-09).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a custodian holdings statement (Priority: P1)

An operations analyst opens a custody account and sees the custodian's statement of holdings for a
chosen statement date: each line's ISIN, instrument name, quantity, price, currency, market value
and GBP market value, plus the GBP total.

**Why this priority**: Holdings is the most-used PV screen and the base every other view builds on.

**Independent Test**: Open any account, pick each statement date, and compare every line and the
total with PV for the same account and date.

**Acceptance Scenarios**:

1. **Given** account 01001-01 (The Penhaligon Family Trust) with statements on file, **When** the analyst opens Holdings, **Then** the
   latest statement date is selected and dates are listed newest first.
2. **Given** a statement date for which the custodian re-sent the statement, **When** it is shown,
   **Then** the statement with the highest file sequence is used.
3. **Given** a statement line whose ISIN is not in the instrument reference data, **When** it is
   shown, **Then** the instrument name reads "UNKNOWN INSTRUMENT <ISIN>".
4. **Given** a deep link with account and statement date, **When** it is opened or the browser goes
   Back/Forward, **Then** the same account and date are shown.

---

### User Story 2 - Reconcile a statement against settlements (Priority: P1)

Each Monday Ops checks the Friday statement: for every ISIN, expected quantity = previous statement
quantity + net settled quantity (receipts minus deliveries settling after the previous statement,
up to and including this statement date), compared with the statement quantity. Only breaks
(non-zero difference) are listed. Ops records a status and note against each break; the note
persists and is attributed to the operator.

**Why this priority**: Reconciliation is the control Ops performs weekly; it is the reason PV exists.

**Independent Test**: For any account and statement date, the list of breaks (ISIN, previous qty,
net settled, expected, statement qty, difference) matches PV except for the documented
divergences; saving a note survives reload and appears in the audit feed.

**Acceptance Scenarios**:

1. **Given** an account's first statement on file, **When** the check runs, **Then** it shows "No
   previous statement on file." and no rows.
2. **Given** a break with no saved note, **Then** its status is NEW.
3. **Given** a break, **When** Ops saves status CHASED with a note, **Then** the row shows the
   status, note, operator and time after reload, and an audit event is recorded.
4. **Given** a statement date, **When** Ops runs "Check all accounts", **Then** every account with a
   statement on that date is listed with its break count, and each links to its detailed check.

---

### User Story 3 - Review settlement confirmations (Priority: P2)

An analyst lists an account's settlement confirmations for a date range (default: 90 days ending
at the latest statement date): trade date, settlement date, message type, direction (REC/DEL),
ISIN, instrument, quantity, amount, currency and sender's reference, newest first.

**Independent Test**: For every account over its full range, the confirmation list matches PV
except for documented divergences.

**Acceptance Scenarios**:

1. **Given** a confirmation later cancelled (CANC referencing its reference), **Then** it is not
   listed, regardless of which settlement day the cancellation arrived on.
2. **Given** a range with no confirmations, **Then** "No settlements in period." is shown.
3. **Given** an invalid date range (from after to), **Then** the range is rejected with a message.

---

### User Story 4 - Find a custody client and its accounts (Priority: P2)

An analyst searches custody clients by name (contains) or client reference (prefix), sees the
adviser, status and account count, and opens a client summary listing its accounts (number, type,
currency, safekeeping account, open/close dates, status) with links to Holdings, Settlements and
Position check.

**Independent Test**: Search results and client summaries match PV for the same queries.

---

### User Story 5 - Browse raw custodian messages and archive status (Priority: P3)

Ops filters archive messages by type (MT535 / MT54x), date and safekeeping account, opens a
message to read its raw SWIFT text, and sees archive status: message counts, statements and
confirmations loaded, parse errors and last load time, with an action to reload the archive.

**Independent Test**: Filtered file lists, raw text and counts match PV's Message Browser and Admin.

### Edge Cases

- Statements with function RPLC or NEWM/DUPL, and re-sent statements (`_002`).
- MT54x files missing the trailer block `{5:...}`; files that fail to parse are counted as parse
  errors and never break the area.
- Confirmations whose safekeeping account is not zero-padded to 7 digits (2 in the archive).
- A cancellation arriving in a different settlement-day folder from the original (1 in the
  archive).
- Fractional fund quantities (up to 4 dp) and continental decimals ("1250,", "2,7316").
- Instruments with no reference name (4 ISINs).
- An account with no statements; a statement date with no breaks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The workspace MUST offer a Custody area with views Holdings, Settlements, Position
  check, Messages and Archive, plus client search and client summary, each deep-linkable.
- **FR-002**: The system MUST load all reference data from PV (clients, accounts, instruments,
  recon notes, users as operators) without loss.
- **FR-003**: The system MUST ingest the custodian archive (MT535 + MT54x) deterministically,
  storing raw message text and parsed content, and record parse errors without aborting.
- **FR-004**: Holdings MUST select the highest file sequence per account and date, list dates newest
  first, and total GBP market value.
- **FR-005**: Settlements MUST exclude cancelled confirmations by matching the cancellation's
  previous reference across the whole archive, and MUST match safekeeping accounts ignoring leading
  zeros.
- **FR-006**: Position check MUST compute expected = previous qty + net settled and list only
  non-zero differences sorted by ISIN, with no tolerance, for one account or all accounts on a date.
- **FR-007**: Ops MUST be able to set a recon status (OPEN, CHASED, RESOLVED, WRITEOFF) and a
  note (max 500 characters) per account/ISIN/statement date; saving MUST persist, record operator
  and time, and write an audit event.
- **FR-008**: Messages MUST filter by type, date and safekeeping account and display raw text only
  for messages present in the ingested archive.
- **FR-009**: Archive MUST show counts, parse errors and last load time, and support a reload.
- **FR-010**: A reproducible parity run MUST compare the new system with the running PV for every
  account × statement date (holdings, position check), every account's settlements, and every
  statement date's check-all, and report all differences.
- **FR-011**: The only accepted parity differences are the documented divergences: (a) the 2
  unpadded-safekeeping confirmations are now included, (b) the cross-day cancellation is now
  applied, and any downstream position-check rows those change.
- **FR-012**: Dates MUST display in one consistent format across all Custody views.

### Key Entities

- **Custody client**: reference, name, adviser, status (active, dormant, closed).
- **Custody account**: account number, client, type (ISA, SIPP, GIA, ...), base currency,
  safekeeping account, open/close dates, status.
- **Instrument**: ISIN, name, asset class, currency, SEDOL.
- **Custodian message**: file name, type, safekeeping account, date, file sequence, raw text, parse
  status.
- **Holdings statement / line**: account, statement date, function, file seq; ISIN, qty, qty type,
  price, currency, market value, GBP market value.
- **Settlement confirmation**: MT type, reference, previous reference, function, trade/settle date,
  ISIN, qty, amount, currency, direction, settlement-day folder.
- **Recon note**: account, ISIN, statement date, status, note, updated by, updated at.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of PV capabilities in the inventory (6 screens) are available in the Custody area.
- **SC-002**: Parity run: 0 unexplained differences across all 3,073 statements, 120 accounts'
  settlements, and 26 check-all dates.
- **SC-003**: Ingestion loads 100% of archive files, with parse-error count reported.
- **SC-004**: An analyst can go from client search to a reconciled break with a saved note in under
  1 minute; saved notes survive reload 100% of the time.
- **SC-005**: Any Custody view opens in under 2 seconds on the local stack.

## Assumptions

- No login or roles: the workspace has no authentication; PV's Ops/Admin-only screens become
  Custody views, and note edits are attributed to an operator chosen from PV's active Ops users.
- The custody book stays in GBP; no conversion to CAD.
- PV's archive and reference data are copied into wealth-platform; the legacy repository is not
  modified.
- PV.Batch (SFTP ingestion) and FX conversion are out of scope.
- The 53-case QA workbook and harness are not changed; custody browser tests live outside
  `qa/tests`.
