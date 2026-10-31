# QA harness

The harness validates the case workbook and Playwright suite, runs a frozen test segment, then collects child evidence into a report and portable ZIP. It does not infer passing results: a missing result is `not-run`, and missing recordings are collector errors.

## Setup

`@playwright/test` 1.60.0 and the QA scripts are pinned in the repository. On a fresh checkout, run:

```sh
npm ci
npx playwright install --with-deps chromium
```

The `npm run qa`, `npm run qa:test`, `npm run typecheck:qa`, and `npm run lint` scripts already exist.

## Child run

Start the app and verify its health before running tests. The web server uses strict port 5173. Use `validate-suite --area <slug>` while authoring an area spec; `--feature <slug-or-label>` is an alias. Without an area filter it requires the full 50-case suite.

```sh
npm run db:up && npm run db:wait && npm run db:setup
ENABLE_TEST_RESET=1 npm run dev:full
curl -fsS http://localhost:3001/api/health
node qa/tooling/qa.mjs validate-cases
node qa/tooling/qa.mjs validate-suite --area clients
FROZEN_SHA=$(git rev-parse HEAD)
QA_RETRIES=0 node qa/tooling/qa.mjs run --run-id "$RUN_ID" --phase baseline --label clients --base-sha "$FROZEN_SHA" -- qa/tests/clients.spec.ts
node qa/tooling/qa.mjs export-videos --segment "qa-artifacts/$RUN_ID/baseline/clients" --out "qa-uploads/$RUN_ID/clients"
```

Repeat `validate-suite` and `run` for each area slug. Workbook `feature` values are title-case display labels; route, suite filter, and spec names use the lowercase `area` slug. Tests import helpers from `qa/tooling/fixtures.ts`, register exactly one `caseTest` per workbook case, use `openArea`, and assert visible roles or text. Gaps use `gapTest(id, { title, area, wikiRef }, body)` and belong in that area's spec.

`--base-sha` records the frozen starting revision; committed changes outside `qa/tests/**` since that revision are rejected, while uncommitted area spec edits are allowed. The API health response includes its startup Git revision (or `APP_REVISION` override). A mismatch blocks the run with `API_REVISION_MISMATCH`; a missing, non-SHA, or unknown revision blocks it with `API_REVISION_UNKNOWN`. `--skip-preflight` records `apiRevision: "unknown"`; reports flag that evidence with `API_REVISION_UNVERIFIED`.

Baseline and retest examples use `QA_RETRIES=0`. `run` creates a fresh segment directory and refuses collisions; the Playwright config itself can reload an existing directory. Do not use Playwright retries or new runs to suppress product failures. Each test resets through `POST /api/test/reset`, captures `before.png` from `openArea` and attaches `after.png` automatically.

After recording the baseline, committing a fix, and opening its PR, restart the API from that fix revision and run a fresh retest segment. The retest base is the fix head, not the original baseline: the runner intentionally rejects application changes relative to its `--base-sha`.

```sh
FIX_SHA=$(git rev-parse HEAD)
QA_RETRIES=0 node qa/tooling/qa.mjs run --run-id "$RUN_ID" --phase retest --label fix-1 --base-sha "$FIX_SHA" --fix-pr "$FIX_PR_URL" -- qa/tests/clients.spec.ts
```

Record each verified fix in `qa-artifacts/$RUN_ID/fixes.json` under a `fixes` array, with its `signature`, `caseIds`, `prUrl`, `fixRevision`, and `retestLabel`. `fixRevision` must equal the revision captured by that retest segment.

### Replay a committed suite

For a fresh live run, use the replay path in `qa/playbook.md`: freeze `main`, reuse each verified area spec, and give the six children a new run ID. The commands and per-case evidence requirements are unchanged. Unchanged specs need no new test PR. The parent still reads Wiki/Jira, reviews coverage, collects fresh baseline evidence, and deduplicates failures against existing open fix PRs before retesting those heads. Keep all remediation PRs unmerged.

### Child evidence attachments

Package each segment and export every retry's video plus available after screenshot to unique flat filenames:

```sh
node qa/tooling/qa.mjs pack-segment \
  --segment "qa-artifacts/$RUN_ID/baseline/clients" \
  --out "qa-uploads/$RUN_ID/clients-baseline.zip"
node qa/tooling/qa.mjs export-videos \
  --segment "qa-artifacts/$RUN_ID/baseline/clients" \
  --out "qa-uploads/$RUN_ID/clients"
```

Attach the segment ZIP and every per-case video file from the export directory with `message_user`. The export command writes `manifest.json` with each relative source path and attempt status, and refuses to replace an existing export. After upload, save a JSON object mapping each exported video filename to its URL, then pass it to `structured`; recording fields use the matching upload URL when present and otherwise retain their relative evidence path. Include the segment ZIP attachment URL as `segmentZip` in child structured output.

## Parent collection

Read each child's attachments with `devin_session_interact` using `get_attachments`. Download the segment ZIP and videos with `download_attachment`, passing `{url}` for one attachment or `{urls}` for several, and save them locally. Use `unpack-segment` to validate and extract each accepted segment. Collect exactly one valid baseline segment per area under `qa-artifacts/$RUN_ID/baseline/<label>/` (the path must match the ZIP's `run-meta.json` label, e.g. `<area>` or `<area>-r2`); keep all valid product failures in the baseline.

If a run is confirmed invalid because of an environment or test-authoring problem, do not extract it. Preserve the original ZIP untouched as `qa-artifacts/$RUN_ID/rejected/<phase>-<label>.zip` and add an entry to `qa-artifacts/$RUN_ID/rejected/rejected.json` with the ZIP name, reason, affected case IDs, and revision. For example:

```json
{
  "rejected": [
    {
      "zip": "baseline-clients-r1.zip",
      "reason": "The browser process could not start because the runtime dependency was missing.",
      "caseIds": ["WM-TC-001"],
      "revision": "0123456789abcdef"
    }
  ]
}
```

Never classify a product failure as environmental or delete raw evidence. Include an **Audit appendix** in the final report listing these rejected ZIPs and reasons. `bundle` includes everything under `rejected/`. Selector repairs go through the test-only PR workflow and a new baseline label.

```sh
node qa/tooling/qa.mjs unpack-segment \
  --zip "qa-downloads/$RUN_ID/clients-baseline.zip" \
  --into "qa-artifacts/$RUN_ID/baseline/clients"
```

Invalid retest attempts follow the same preservation rule; accepted retests are extracted under `qa-artifacts/$RUN_ID/retest/<label>/`. `unpack-segment` rejects unsafe ZIP paths and requires the embedded run ID, phase, and label to match the target path.

After collecting accepted segments, generate the report and bundle:

```sh
node qa/tooling/qa.mjs report --run-id "$RUN_ID"
node qa/tooling/qa.mjs structured --run-id "$RUN_ID" --uploads "qa-uploads/$RUN_ID/uploads.json"
node qa/tooling/qa.mjs bundle --run-id "$RUN_ID"
```

`report` writes `report.json`, `report.md`, and self-contained `index.html`; retest failures not linked to that segment in `fixes.json` appear as `RETEST_REGRESSION` warnings. `structured` writes `structured-output.json` and prints the compact Devin projection. Each case includes its initial and retest application/API revisions; gap rows include their own revisions. A case without a retest has null retest status, revision and recording fields:

Fix links come from explicit `fixes.json` case IDs, not merely from sharing an area retest. Gap rows retain baseline/retest phases and labels. `summary.gapTests` counts unique gap IDs; `summary.gapAttempts` counts the preserved phase rows.

```sh
node qa/tooling/qa.mjs structured \
  --run-id "$RUN_ID" \
  --uploads "qa-uploads/$RUN_ID/uploads.json"
```

`bundle` includes reports, every accepted segment's metadata/results/Playwright evidence/HTML report, and `rejected/**`; collector errors (including `API_REVISION_UNVERIFIED` and baseline `SEED_MISMATCH`) block it unless `--allow-errors` is supplied.

```text
qa-artifacts/
└── <run-id>/
    ├── baseline/<label>/
    │   ├── run-meta.json
    │   ├── results.json
    │   ├── summary.json
    │   ├── test-results/
    │   └── html/
    ├── retest/<label>/...
    ├── rejected/
    │   ├── rejected.json
    │   └── <phase>-<label>.zip
    ├── fixes.json
    ├── report.json
    ├── report.md
    ├── index.html
    └── structured-output.json
```

## Configuration and integration

| Variable | Default | Purpose |
|---|---|---|
| `QA_BASE_URL` | `http://localhost:5173` | Web app URL |
| `QA_API_URL` | `http://localhost:3001` | API URL |
| `QA_RESET_PATH` | `/api/test/reset` | POST reset endpoint |
| `QA_HEALTH_PATH` | `/api/health` | GET health endpoint |
| `QA_ARTIFACTS_DIR` | `qa-artifacts` | Parent directory for run segments |
| `QA_SEGMENT_DIR` | `qa-artifacts/_adhoc` | Playwright output segment (set by `run`) |
| `QA_RETRIES` | `0` | Playwright retries |
| `QA_SLOW_MO` | `0` | Browser launch delay in milliseconds |
| `QA_CHROME` | Playwright Chromium | Optional browser executable |
| `QA_SEED` | `null` | Seed identifier recorded in metadata |
| `QA_SEED_FILES` | `server/db/schema.sql,server/db/seed.sql,server/db/workflow-seed.sql` | Ordered, comma-separated repo-relative files included in the combined seed digest |
| `QA_RESET_FILES` | `server/db/workflow-seed.sql` | Ordered, comma-separated repo-relative files included in the reset digest |
| `APP_REVISION` | Git SHA captured at API startup | Optional API revision override |

The app contract is `GET /api/health` → `{ "status": "ok", "revision": "<SHA>" }` and `POST /api/test/reset` → 2xx after reseeding. Reset is gated by `ENABLE_TEST_RESET=1`. The app must support `/?screen=workspace&area=<area-slug>`. `npm run db:setup` loads `schema.sql`, `seed.sql`, and `workflow-seed.sql`; each test reset reloads only `workflow-seed.sql`. Metadata records per-file hashes and a combined digest over ordered `<file>\0<sha256>\n` lines, plus the reset digest. Missing files block the run with `SEED_FILE_MISSING`.

The app uses Docker `postgres:16-alpine` on `localhost:5432`; start it with `npm run db:up && npm run db:wait && npm run db:setup`, then run `ENABLE_TEST_RESET=1 npm run dev:full`.

## Evidence transport

Children attach segment ZIPs and videos through the session. To create a transport ZIP:

```sh
node qa/tooling/qa.mjs pack-segment \
  --segment "qa-artifacts/$RUN_ID/$PHASE/$LABEL" \
  --out "qa-uploads/$RUN_ID/$LABEL-$PHASE.zip"
```

The parent reads the child's attachment URLs with `devin_session_interact` `get_attachments`, downloads them using `download_attachment` (`{url}` or `{urls}`), and safely unpacks each accepted segment:

```sh
node qa/tooling/qa.mjs unpack-segment \
  --zip "qa-downloads/$RUN_ID/$LABEL-$PHASE.zip" \
  --into "qa-artifacts/$RUN_ID/$PHASE/$LABEL"
```

Never publish evidence on Git branches. Keep confirmed invalid-run ZIPs untouched under `rejected/` without extracting them; record them in `rejected.json` and the final Audit appendix.
