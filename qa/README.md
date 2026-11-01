# QA harness

The harness validates the case workbook and Playwright suite, runs a frozen test segment, then collects child evidence into a report and portable ZIP. It does not infer passing results: a missing result is `not-run`, and missing recordings are collector errors.

The demo starts from the spreadsheet: `main` has no generated Playwright case specs. Children author them during each demo and keep them on a run-specific QA branch. The harness, workbook, and application unit/integration tests remain available. Before authoring, `validate-suite` should report missing cases; that is not a reason to restore historical specs or mark coverage complete.

## Opening advisor journeys

The workbook now has **53 manual cases**: the original `WM-TC-001..050` are unchanged, with three longer advisor journeys appended:

| Video order | Case | Owner | Journey |
| --- | --- | --- | --- |
| 1 | WM-TC-051 | Clients | Find a KYC review, save the profile, inspect the portfolio and verify persistence |
| 2 | WM-TC-052 | Orders | Review holdings, buy 10 RY, cancel the order and verify released cash |
| 3 | WM-TC-053 | Move Money | Review a transfer, amend the amount, confirm and reconcile both balances |

`openingCases` in `qa/tooling/areas.json` controls video order, not execution order. Each original area also owns its `additionalIds`; there are still six children. Author the new cases from their full manual steps, not prebuilt specs. All three begin in Clients and contain 10+ meaningful clicks. Import `journeyStep(page, title, action)` from the fixtures around each step: perform the browser actions and assertions inside `action`, then the helper holds the verified screen for 1.5 seconds. Click fields before typing/selecting so the cursor is visible. These reading holds are presentation, never assertions. The composer moves all baseline attempts of these journeys first, preserving failures/retries, followed by the rest of the baseline, gaps and retests. Gap coverage remains separate from the 53 manual cases.

## Setup

`@playwright/test` 1.60.0 and the QA scripts are pinned in the repository. On a fresh checkout, run:

```sh
npm ci
npx playwright install --with-deps chromium
```

If using an existing system Chrome through `QA_CHROME`, run `npx playwright install ffmpeg` even when you do not install Playwright's Chromium. That recording encoder is separate from the system `ffmpeg` and `ffprobe` commands used by `demo-video`.

The `npm run qa`, `npm run qa:test`, `npm run typecheck:qa`, and `npm run lint` scripts already exist.

## Child run

Start the app and verify its health before running tests. The web server uses strict port 5173. Use `validate-suite --area <slug>` while authoring an area spec; `--feature <slug-or-label>` is an alias. Without an area filter it requires the full 53-case suite.

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

### Author from the workbook

For a fresh demo, follow `qa/playbook.md`: freeze the clean `main`, read Wiki/Jira, and have six children write new area specs from the manual cases. Integrate their test-only PRs into the run-specific QA branch, never `main`. Deduplicate product failures only after baseline execution; retest fixes using the newly authored assertions. Keep all remediation PRs unmerged and preserve earlier runs as historical evidence.

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

For the parent session's online report, merge the latest upload maps from every child, including corrected baselines and retests. Match exact exported filenames, including phase, label and retry; never substitute an older attempt's URL. After `structured --uploads`, check that every attempted case and gap recording is an HTTPS URL. A relative recording path means the upload map is incomplete, not that the browser test failed: retrieve the missing attachment and regenerate the projection without rerunning or editing evidence. Relative links remain correct in the offline bundle's `index.html`.

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

Never classify a product failure as environmental or delete raw evidence. `report` renders an **Audit appendix** in Markdown and an offline HTML tab from this manifest, listing each rejected ZIP, reason, case IDs, and revision without adding them to result counts. ZIP filenames must be safe, existing files directly under `rejected/`. `bundle` includes everything under `rejected/`. Selector repairs go through the test-only PR workflow and a new baseline label.

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
node qa/tooling/qa.mjs demo-video --run-id "$RUN_ID"
node qa/tooling/qa.mjs bundle --run-id "$RUN_ID"
```

`report` writes `report.json`, `report.md`, and a standalone `index.html` with embedded WebM bytes (including retry attempts); it plays in Devin preview without nearby segment folders. `demo-video` needs `ffmpeg` and `ffprobe` and produces `full-run.mp4` plus `demo-manifest.json` from all accepted Playwright attempts, with a title card before each one. Attach `full-run.mp4` to the parent session; preserve and attach individual Playwright recordings through the child sessions. `bundle` includes the compilation and the original recordings. Retest failures not linked to that segment in `fixes.json` appear as `RETEST_REGRESSION` warnings. `structured` writes `structured-output.json` and prints the compact Devin projection. Each case includes its initial and retest application/API revisions; gap rows include their own revisions. A case without a retest has null retest status, revision and recording fields:

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
    ├── full-run.mp4
    ├── demo-manifest.json
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
| `QA_SLOW_MO` | `400` | Browser action delay in milliseconds; cursor and initial/final presentation time are provided by the fixture |
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
