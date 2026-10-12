# Feature Specification: Legacy Portfolio Viewer Capabilities in Wealth Platform

**Feature Branch**: `001-legacy-portfolio-viewer`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Document and understand the requirements of the legacy wealth
management app (aaron-cog-gtm-gh-org/legacy-wealth-platform — Portfolio Viewer), which nobody on the
team was around to build, and plan how to integrate it into the newer wealth-platform."

> **As-built reference**: [legacy-as-built.md](./legacy-as-built.md) documents what Portfolio Viewer
> does today (screens, rules BR-1..BR-10, data variations, defects D-1..D-13). This spec defines what
> Wealth Platform must do to absorb and retire it. Requirements tagged **[parity]** reproduce
> legacy behavior; requirements tagged **[fix D-n]** are intentional corrections (Constitution III).

## Clarifications

### Session 2026-10-12

- Q: How should the legacy GBP book be handled? → A: The legacy system is GBP; Wealth Platform
  MUST support GBP as a first-class currency (storage, display, totals).
- Q: Login and access control? → A: No login for now. Any user can pick any client and open any
  screen.
- Q: Where does legacy client/account data live? → A: In separate custody tables, migrated into
  Oracle as part of standard database setup, feeding the existing app UI seamlessly.

## User Scenarios & Testing *(mandatory)*

Actors: **Adviser** (looks at client holdings and settlements), **Operations analyst** (reconciles
custodian positions, reads raw messages), **Platform administrator** (monitors ingestion).

### User Story 1 - Adviser reviews custodian holdings history (Priority: P1)

An adviser picks any migrated client from the client picker, opens Client 360 and the Portfolio
screen for that client exactly as for platform households, and sees the custodian-reported holdings for
the latest statement, can pick any earlier weekly statement, and sees per-line ISIN, instrument
name, quantity, price, currency, market value and reporting-currency value, with totals.

**Why this priority**: This is the most-used legacy screen and the minimum needed for advisers to
stop opening Portfolio Viewer. It also proves the ingestion foundation end-to-end.

**Independent Test**: Load the committed legacy archive, open a migrated account, and compare every
statement date and line against the legacy parity fixture.

**Acceptance Scenarios**:

1. **Given** an account with weekly statements, **When** the adviser opens custodian holdings,
   **Then** the latest statement is shown and older statement dates are listed newest first.
2. **Given** two files for the same account and date where one is `RPLC` and a later one is
   `NEWM/DUPL`, **When** the date is viewed, **Then** the replacement is shown, not the duplicate
   **[fix D-4]**.
3. **Given** a holding whose ISIN is not in reference data, **When** it is shown, **Then** the name
   from the custodian message is displayed with an "unverified instrument" marker **[fix D-5]**.
4. **Given** a statement flagged "no holdings", **When** viewed, **Then** the user sees an explicit
   empty-statement message distinct from "no statement on file for this date".
5. **Given** a GBP-reporting account, **When** values are shown, **Then** amounts are formatted as
   GBP (£) and totals are in GBP, never converted to CAD.

---

### User Story 2 - Adviser reviews settlement confirmations (Priority: P2)

An adviser views settled receipts and deliveries for an account over a date range (default: 90 days
ending at the latest statement), with direction, trade/settle dates, ISIN, quantity (units or face
amount), settlement amount, currency and custodian reference. Cancelled confirmations are excluded.

**Why this priority**: Second legacy screen by usage; needed to explain holdings changes.

**Independent Test**: For accounts in the fixture set, compare listed confirmations and amounts with
corrected legacy output.

**Acceptance Scenarios**:

1. **Given** a confirmation amount `GBP21637,5`, **When** listed, **Then** it shows 21,637.50
   **[fix D-1]**.
2. **Given** a confirmation whose safekeeping account is reported with 8 digits, **When** the
   account is viewed, **Then** the confirmation is listed **[fix D-2]**.
3. **Given** a cancellation filed on a later day than its original, **When** either day is in range,
   **Then** neither the original nor the cancellation is listed **[fix D-3]**.
4. **Given** a free-of-payment receipt (MT544), **When** listed, **Then** amount shows as "—" and
   the row is labelled free of payment.

---

### User Story 3 - Operations reconciles custodian positions (Priority: P3)

An operations analyst runs a position check for one account or all accounts for a statement date.
The system lists every instrument where previous statement quantity plus net settled quantity does
not equal the current statement quantity. The analyst records a status and note per break; every
change is kept with who and when.

**Why this priority**: The core operational control in the legacy app, and where legacy defects
cause most false work; it depends on US1 and US2 data.

**Independent Test**: Run the check over the full committed archive: exactly the 2 genuine breaks
documented in legacy-as-built §9 are returned; with legacy-parity mode, the 7 legacy breaks.

**Acceptance Scenarios**:

1. **Given** the committed archive, **When** "check all" is run for every statement date, **Then**
   2 breaks are reported (account 2001 `GB00ZZ011962` 2026-07-17; account 2074 `GB00ZZ000908`
   2026-07-31).
2. **Given** a break with status `CHASED`, **When** the analyst edits the note only, **Then** the
   status remains `CHASED` **[fix D-6]** and the previous version is retained in history.
3. **Given** no login, **When** the analyst saves a note, **Then** the name they entered is stored
   as the author.
4. **Given** a migrated legacy note with status `O` or `C`, **When** shown, **Then** it displays as
   `OPEN` or `RESOLVED` respectively.

---

### User Story 4 - Operations inspects raw custodian messages (Priority: P4)

An operations analyst filters stored custodian messages by type, date and safekeeping account and
views the original message text exactly as received, and can jump from a holding line,
confirmation or break to its source message.

**Why this priority**: Needed for investigation and audit, but used less often than US1–US3.

**Independent Test**: Pick 20 archive files at random; the stored text is byte-identical and is
reachable from the derived record.

**Acceptance Scenarios**:

1. **Given** any user, **When** they open a message, **Then** its raw text is displayed escaped
   and unchanged (including original line endings).
2. **Given** a derived record, **When** its source link is followed, **Then** the matching raw
   message opens.

---

### User Story 5 - Administrator monitors and re-runs ingestion (Priority: P5)

An administrator sees ingestion status: files by type, statements, confirmations, parse errors with
file names, last run time and duration, and can trigger re-ingestion of new or changed files without
downtime.

**Why this priority**: Replaces the legacy Admin page; needed before decommission, not before
first use.

**Independent Test**: Ingest the archive, add one new file, re-run; counts increase by one and
nothing is duplicated.

**Acceptance Scenarios**:

1. **Given** a file already ingested, **When** ingestion re-runs, **Then** it is not duplicated.
2. **Given** a malformed file, **When** ingested, **Then** it is listed as a parse error and other
   files still load.

---

### User Story 6 - User picks any client (Priority: P1, prerequisite of US1)

Any user opens a client picker listing every client (platform households and migrated legacy
clients), searches by name or client reference, and selects one; the existing screens then show
that client, with a summary of adviser, status, accounts, latest statement date and value, and total.

**Why this priority**: Wealth Platform is hard-wired to one household today; picking a client is
how legacy data reaches the UI, so it ships with US1.

**Independent Test**: Search for each of the 50 migrated clients by reference; summary totals equal
the sum of US1 latest-statement totals.

**Acceptance Scenarios**:

1. **Given** a surname fragment, **When** searched, **Then** matching clients are listed 25 per page.
2. **Given** a closed account, **When** the summary is shown, **Then** it is marked closed.

---

### Edge Cases

- Multiple files for one account/date: identical `NEWM` resends, `RPLC`, `NEWM/DUPL` (legacy-as-built §7).
- Safekeeping account reported unpadded (5 digits), padded (7) or over-padded (8 digits).
- Amounts with 0, 1 or 2 decimal places; comma decimal separator; no amount (free of payment).
- Quantities as `UNIT` vs `FAMT` (face amount) — must not be summed together in one figure.
- Cancellation arriving on a later day (or later week) than its original.
- Statement with no holdings (`ACTI//N`); account with no statements; closed account.
- Mixed CRLF/LF line endings; `SUBSAFE`-wrapped statements; new custodian fields added over time.
- Instrument missing from reference data; reference-data name differs from message name.
- Corporate actions (bonus issue, split) visible only as a quantity change.
- Ingestion re-run while users are reading; partial failure mid-run.

## Requirements *(mandatory)*

### Functional Requirements

**Ingestion and storage**

- **FR-001**: System MUST ingest MT535 statements and MT544/545/546/547 confirmations from the
  custodian archive layout in legacy-as-built §3.1 and store each original message unchanged with
  its source file name, folder and ingestion time.
- **FR-002**: System MUST derive normalized statements, holding lines and confirmations using the
  field mappings in legacy-as-built §5 **[parity]**.
- **FR-003**: Ingestion MUST be idempotent (same file content never stored twice) and MUST record
  per-file parse errors without stopping the run.
- **FR-004**: System MUST identify safekeeping accounts by numeric value, so `10554`, `0010554` and
  `00010554` are the same account **[fix D-2]**.
- **FR-005**: For a given account and statement date, the effective statement MUST be the latest
  `RPLC` if any, else the latest non-`DUPL` `NEWM`; superseded and duplicate statements remain
  stored and viewable **[fix D-4]**.
- **FR-006**: A cancellation MUST void the confirmation whose reference equals its `PREV`,
  regardless of which day it was filed **[fix D-3]**.
- **FR-007**: Settlement amounts MUST be parsed as decimal values (`21637,5` = 21,637.50)
  **[fix D-1]**; thousands separators MUST be rejected as parse errors, not guessed **[D-7]**.
- **FR-008**: Each statement line MUST keep both the custodian's own description and the reference
  data instrument name; display MUST fall back to the custodian description **[fix D-5]**.

**Holdings and settlements (US1, US2)**

- **FR-009**: Users MUST be able to list statement dates for an account (newest first) and view the
  effective statement with per-line values and totals in reporting currency **[parity]**.
- **FR-010**: Reporting-currency totals MUST use the custodian-reported reporting-currency value per
  line; a line without one MUST be flagged, not silently counted as zero **[fix D-8]**.
- **FR-011**: Users MUST be able to list non-cancelled confirmations for an account by settle-date
  range, default 90 days ending at the latest statement date **[parity]**.
- **FR-012**: Direction MUST be Receive for MT544/545 and Deliver for MT546/547 **[parity]**;
  free-of-payment confirmations MUST be labelled as such.

**Reconciliation (US3)**

- **FR-013**: Position check MUST compute, per instrument, expected = previous effective statement
  quantity + Σ receipts − Σ deliveries settled in (previous statement date, statement date], and
  report every instrument where expected ≠ reported **[parity BR-6, BR-7]**.
- **FR-014**: Position check MUST support one account or all accounts for a date, and MUST offer a
  legacy-parity mode that applies BR-1..BR-5 unchanged, for migration sign-off only.
- **FR-015**: Each break MUST carry a status (`NEW`, `OPEN`, `CHASED`, `RESOLVED`, `WRITEOFF`), a
  note, and a full change history (who, when, old → new); editing one field MUST NOT change the
  other **[fix D-6]**.
- **FR-016**: Existing legacy notes MUST be migrated, mapping `O`→`OPEN` and `C`→`RESOLVED`,
  preserving original author and timestamp.

**Raw messages and administration (US4, US5)**

- **FR-017**: Users MUST be able to filter stored messages by type, date and account
  and view the raw text, escaped; messages MUST be retrieved by identifier, never by file path.
- **FR-018**: Every holding line, confirmation and break MUST link to its source message(s).
- **FR-019**: Users MUST be able to see ingestion statistics (files by type, statements,
  confirmations, parse errors with file names, last run, duration) and trigger an incremental
  re-ingest without interrupting readers.

**Clients, accounts and access (US6)**

- **FR-020**: System MUST migrate legacy clients, accounts (with safekeeping code, type,
  currency, open/close dates) and adviser assignments, normalizing account types to a closed list.
- **FR-021**: Users MUST be able to pick any client from a picker listing platform households and
  migrated clients, searchable by name fragment or client reference, 25 results per page.
- **FR-022**: There MUST be no login; every screen and client is available to every user. Break-note
  edits MUST record the name the user enters. Legacy password hashes MUST NOT be migrated
  **[fix D-10]**.
- **FR-024**: GBP MUST be a supported currency end to end: stored, formatted (£) and totalled in
  GBP for GBP-reporting accounts, with no implicit conversion to CAD.
- **FR-025**: Migrated custody data MUST be loaded into Oracle by the standard database setup, and
  the existing Client 360 and Portfolio screens MUST render a picked legacy client from it, showing
  panels with no legacy source (drift, rebalance, performance) as "not available".
- **FR-023**: Dates MUST be displayed in one consistent format across all new screens **[fix D-11]**.

### Key Entities *(include if feature involves data)*

- **Custodian Message**: one received SWIFT file — type, sender, reference, function, raw text,
  source file/folder, content hash, ingestion run.
- **Safekeeping Account**: custodian account number (numeric), linked to a platform account.
- **Holdings Statement**: account, statement date, function (`NEWM`/`RPLC`/`DUPL`), sequence,
  effective flag, empty flag, source message.
- **Statement Line**: statement, ISIN, custodian description, quantity + quantity type, price,
  currency, market value, reporting-currency value.
- **Settlement Confirmation**: account, reference, MT type, direction, trade/settle date, ISIN,
  quantity + type, amount + currency (optional), cancelled-by link, source message.
- **Position Break**: account, ISIN, statement date, previous/settled/expected/reported quantity,
  difference.
- **Break Note**: break key, status, note, and append-only history entries.
- **Ingestion Run**: start/end, counts, parse errors.
- **Legacy Client / Account / Adviser**: migrated reference data mapped into the platform's client
  and account model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the 6,044 committed archive files are ingested with 0 unexplained parse
  errors; all 30,731 holding lines and 2,971 confirmations are present.
- **SC-002**: Holdings parity — for every account/date, effective statement lines equal the legacy
  output except the documented D-4 and D-5 corrections.
- **SC-003**: Settlement parity — all confirmation amounts equal legacy output except the 240
  one-decimal amounts (D-1), which equal the correctly parsed value; the 2 previously invisible
  confirmations (D-2) are listed.
- **SC-004**: Reconciliation — legacy-parity mode returns exactly the 7 legacy breaks; normal mode
  returns exactly the 2 genuine breaks (legacy-as-built §9), a 71% reduction in false work.
- **SC-005**: 13 of 13 legacy notes migrated with mapped status, author and date.
- **SC-006**: An adviser can go from client search to a holdings statement in under 3 clicks and
  each screen renders in under 2 seconds with the full archive loaded.
- **SC-007**: Re-running ingestion on an unchanged archive adds 0 records.
- **SC-008**: Portfolio Viewer can be switched off: every legacy screen in legacy-as-built §4 has
  a signed-off Wealth Platform equivalent.

## Assumptions

- The legacy book (UK clients, GBP-reporting accounts, GBP/EUR/USD instruments) is migrated as-is;
  Wealth Platform's currency set is widened rather than converting history to CAD (confirmed).
- Custodian files continue to arrive in the same archive layout; a file-drop based ingest is
  acceptable (no live SWIFT connectivity in scope).
- Raw messages are retained in the platform (Constitution IV); the flat-file archive can be
  retired after SC-001 sign-off.
- No login and no role restrictions in this feature (confirmed); legacy roles are kept only as
  reference data for a future auth feature.
- Corporate actions remain a manual reconciliation outcome in this feature; an automated
  corporate-action feed is out of scope.
- Legacy `INSTRUMENT` data is migrated as instrument reference data; FX conversion is not
  recomputed — custodian-reported values are used.
- Out of scope: changes to Portfolio Viewer itself, trading, payments, and Wealth Platform's
  existing household/rebalance features.
