# Feature Specification: Portfolio Viewer decommission parity

**Feature Branch**: `devin/1794240797-spec-011-parity` | **Created**: 2026-11-09 | **Status**: Draft
**Input**: "Decommission parity checklist: verify recon results match legacy PositionCheck output on identical archive fixtures."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prove reconciliation parity before switching off the legacy app (Priority: P1)

An operations lead signing off the decommission of the legacy Portfolio Viewer runs one command and gets a report that says, for the same archive files and reference data, whether every Position Check result in the new platform matches the legacy one, including recon-note status and notes.

**Why this priority**: Position Check is the control the ops team relies on. The legacy app cannot be switched off until its results are reproduced exactly.

**Independent Test**: Run the parity command against a freshly seeded local database and check that the report shows PASS with zero mismatches for every check.

**Acceptance Scenarios**:
1. **Given** the in-repo archive copy and the seeded reference data, **When** the parity command runs, **Then** every one of the 3,065 account × statement-date Position Check runs matches legacy (previous statement date, "No previous statement on file.", statement file, every break row and field).
2. **Given** a recon note that differs from the legacy seed, **When** the parity command runs, **Then** the report shows FAIL, names the account and date, and shows the legacy and new values.
3. **Given** a difference that the business has accepted as a named divergence, **When** the parity command runs, **Then** the difference is listed as accepted and does not fail the run.

### User Story 2 - Prove the inputs are identical (Priority: P1)

The sign-off is only meaningful if both sides used the same archive files.

**Acceptance Scenarios**:
1. **Given** the legacy archive checksum manifest, **When** the parity command runs, **Then** all 6,044 archive files match byte-for-byte, and any missing or changed file fails the run.

### User Story 3 - Decommission checklist (Priority: P2)

The sign-off lead reviews a checklist that maps every legacy component, page and quirk to its replacement and to the evidence that it is equivalent.

**Acceptance Scenarios**:
1. **Given** the checklist, **When** it is reviewed, **Then** every PV.Core, PV.Data, PV.Web and PV.Tests item has a replacement and evidence or an explicit open item, and every quirk Q1–Q18 is marked preserved or named divergence.

### Edge Cases
- Accounts whose first statement has no predecessor (120 cases): the no-previous message must match.
- The Q18 8-digit safekeeping confirmations produce two NEW breaks on 2026-09-18: they must still appear.
- Settlements with equal settle dates: compared in the oracle's documented order (settle date desc, folder, file name).
- Decimal scale differs (`3776.070` vs `3776.07`): compared numerically.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: A single command MUST compare the new platform with the legacy golden output for archive inputs, archive index counts, statement selection, statement dates, holdings, Position Check runs, Check All and settlements (90-day default and full range, including amounts).
- **FR-002**: Position Check comparison MUST use the platform's real reference-data store for recon notes and instrument names, not values taken from the golden output.
- **FR-003**: The command MUST write a machine-readable and a human-readable report and exit non-zero on any difference that is not a declared divergence.
- **FR-004**: Declared divergences MUST be listed in one reviewable file with an id, the check, the key and the reason. Today there are none.
- **FR-005**: A decommission checklist MUST cover every legacy component, page, test suite and quirk.

### Key Entities
- **Golden output**: the legacy oracle JSON captured by running unmodified PV.Core/PV.Data.
- **Parity check**: a named comparison with a compared count, mismatches and accepted divergences.
- **Divergence**: an approved, named difference from legacy behaviour.

## Success Criteria *(mandatory)*
- **SC-001**: 100% of the 3,065 Position Check runs, 26 Check All days, 3,065 holdings statements, 240 settlement lists and 6,044 archive files match, with zero undeclared mismatches.
- **SC-002**: A deliberately changed recon note is detected and reported with its account and date.
- **SC-003**: The run completes in under 2 minutes on a developer VM.

## Assumptions
- The golden output in `parity/legacy-golden/` was produced from legacy commit `9126128` with the same archive (checked by manifest).
- Legacy bugs Q10 (amount scaling) and Q18 (8-digit SAFE) are preserved until the business approves a divergence.
