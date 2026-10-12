# Wealth Platform Constitution

## Core Principles

### I. Oracle Is the System of Record; the Browser Holds No Domain Data

All client, account, holdings, operations and portal data MUST be read from and written to Oracle
through the Express API in `server/`. React components MUST obtain domain data only via the typed
client in `src/api/`. No screen may embed fixture data, and no data source may bypass the
repository layer in `server/repositories/`. All SQL MUST use bind variables and standard Oracle
types (19c+ compatible; no 23ai-only syntax).

Rationale: one source of truth keeps the advisor, operations and client views consistent and lets
the same build run against a disposable test database or a shared Oracle instance.

### II. Explicit, Typed Wire Contracts

Every API route MUST return a named DTO declared in `src/api/types.ts`. Changing a DTO MUST be done
in the same change as the repository query and every consuming screen, and MUST pass
`npm run typecheck`. Enumerations that encode business domains (currencies, account keys, asset
classes, statuses) MUST be declared as closed unions and widened deliberately, never bypassed with
`string` or `any`.

Rationale: the UI and API are deployed together; compile-time contracts are the cheapest place to
catch a domain mismatch.

### III. Behavioral Parity Before Replacement (NON-NEGOTIABLE)

Capabilities migrated from a legacy system MUST first be documented as-built (a spec under
`specs/`) and captured as executable parity fixtures derived from real legacy inputs. A
replacement MUST reproduce legacy results on those fixtures, except where a deviation is listed in
the spec as an intentional defect correction with its measured impact. Legacy behavior MUST NOT be
silently "improved".

Rationale: nobody who built the legacy systems is still here; the only reliable specification is
the code and the data it actually processed.

### IV. Financial and Operational Records Are Auditable

Ingested source messages (e.g. SWIFT statements and confirmations) MUST be retained immutably with
provenance (source file, message reference, ingestion time) alongside the normalized facts derived
from them. Corrections MUST be modeled as new records (replace, cancel, supersede), not in-place
edits. Every user edit to an operational record (status, note, assignment) MUST record who and when.

Rationale: operations and reconciliation staff must be able to explain any figure back to the
message that produced it.

### V. Deterministic, Reproducible Verification

`server/db/schema.sql` MUST remain re-runnable and `server/db/seed.sql` deterministic. Every change
MUST pass `npm run typecheck` and `npm run build`; UI changes MUST be checked with the visual-diff
tooling against an ephemeral Oracle container. Parser and calculation logic MUST have unit tests
that run without a database.

Rationale: reproducible data and gates let any engineer (or agent) verify a change locally.

## Security and Access Constraints

- Role-restricted capabilities (e.g. raw message browsing, reconciliation edits, archive
  administration) MUST be enforced by the API, not only hidden in the UI.
- Secrets (database credentials, connection strings) MUST come from environment variables and
  MUST NOT be committed.
- Passwords, if ever stored by this platform, MUST use a modern salted adaptive hash; legacy hashes
  MUST NOT be migrated as-is.
- Raw message content rendered in the browser MUST be escaped; file access MUST be by indexed
  identifier, never by user-supplied path.

## Development Workflow and Quality Gates

- Work follows Spec Kit: `specify` → (`clarify`) → `plan` → `tasks` → (`analyze`) → `implement`.
  Specs, plans and tasks live in `specs/<NNN-feature>/` and are reviewed by PR before
  implementation starts.
- Each user story MUST be independently deliverable and demonstrable behind its own screen, route,
  or query-parameter state.
- PRs MUST state which gates were run (typecheck, build, unit tests, visual diff, parity fixtures).

## Governance

This constitution supersedes conflicting conventions in the repository. Amendments are made by PR
that updates this file, states the version bump and rationale, and updates any dependent spec or
plan that relied on the changed principle. Versioning follows semantic versioning: MAJOR for removed
or redefined principles, MINOR for new principles or materially expanded guidance, PATCH for
clarifications. Every plan MUST include a Constitution Check against these principles; violations
MUST be justified in the plan's Complexity Tracking table. Runtime development guidance lives in
`README.md`, `docs/`, and `.agents/skills/`.

**Version**: 1.0.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12
