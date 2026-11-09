# Implementation Plan: Portfolio Viewer decommission parity

**Branch**: `devin/1794240797-spec-011-parity` | **Spec**: [spec.md](./spec.md)

## Summary
Add `npm run parity` (`server/pv/parity.ts`). It builds the archive index from the in-repo archive copy, wires `runPositionCheck` with the PostgreSQL providers (`getInstruments`, `pgReconNotes`), replays every golden case and writes `parity/report/parity-report.{json,md}`. Declared divergences live in `parity/divergences.json`. The decommission checklist lives in `checklists/decommission.md`.

## Technical Context
Node 22 + tsx, the existing `src/domain` port, `server/pv` providers, PostgreSQL 16 (`npm run db:up && npm run db:wait && npm run db:setup`). Comparison uses `util.isDeepStrictEqual` over values with decimals normalised by `Decimal.parse(...).toString()`.

## Constitution Check
- I Parity before improvement: PASS — this feature is the parity gate; divergences must be declared.
- II Pure domain core: PASS — the runner is server-side tooling; no domain changes.
- III Test-first with legacy fixtures: PASS — golden Vitest suites remain; the runner was checked against a seeded mismatch.
- IV View-model contract: N/A — no screens.
- V No regression: PASS — no existing code changed.
- VI Secure by default: PASS — local synthetic database only.
- VII Simplicity and traceability: PASS — each check names its legacy origin.

## Project Structure
```text
server/pv/parity.ts                 # runner
parity/divergences.json             # declared divergences (empty)
parity/report/parity-report.{json,md}
specs/011-decommission-parity/checklists/decommission.md
```

## Complexity Tracking
None.
