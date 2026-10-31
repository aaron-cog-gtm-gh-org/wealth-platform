# QA harness

The harness validates the case workbook and Playwright suite, runs a frozen test segment, then collects child evidence into a report and portable ZIP. It does not infer passing results: a missing result is `not-run`, and missing recordings are collector errors.

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

`--base-sha` records the frozen starting revision; committed changes outside `qa/tests/**` since that revision are rejected, while uncommitted area spec edits are allowed. The API health response includes its startup Git revision (or `APP_REVISION` override); a mismatch blocks the run, while an unknown revision warns and continues.

Set `QA_RETRIES=1` when a deliberate retry is needed. `run` creates a fresh segment directory and refuses collisions; the Playwright config itself can reload an existing directory. Each test resets through `POST /api/test/reset`, captures `before.png` from `openArea` and attaches `after.png` automatically.

After recording the baseline and making a fix, run a fresh retest segment:

```sh
QA_RETRIES=0 node qa/tooling/qa.mjs run --run-id "$RUN_ID" --phase retest --label fix-1 --base-sha "$FROZEN_SHA" --fix-pr "$FIX_PR_URL" -- qa/tests/clients.spec.ts
```

Record each verified fix in `qa-artifacts/$RUN_ID/fixes.json` under a `fixes` array, with its `signature`, `caseIds`, `prUrl`, `fixRevision`, and `retestLabel`. `fixRevision` must equal the revision captured by that retest segment.

### Child evidence uploads

Export every retry's video and available after screenshot to unique flat filenames before uploading them as Devin attachments:

```sh
node qa/tooling/qa.mjs export-videos \
  --segment "qa-artifacts/$RUN_ID/baseline/clients" \
  --out "qa-uploads/$RUN_ID/clients"
```

The command writes `manifest.json` with the relative source path and attempt status, and refuses to replace an existing export. After uploading, save a JSON object mapping each exported video filename to its URL, then pass it to `structured`; recording fields use the matching upload URL when present and otherwise retain their relative evidence path.

## Parent collection

Fetch every child segment, place the segment directories in the layout below, then collect the report and bundle:

```sh
node qa/tooling/qa.mjs report --run-id "$RUN_ID"
node qa/tooling/qa.mjs structured --run-id "$RUN_ID" --uploads "qa-uploads/$RUN_ID/uploads.json"
node qa/tooling/qa.mjs bundle --run-id "$RUN_ID"
```

`report` writes `report.json`, `report.md`, and self-contained `index.html`; retest failures not linked to that segment in `fixes.json` appear as `RETEST_REGRESSION` warnings. `structured` writes `structured-output.json` and prints the compact Devin projection:

```sh
node qa/tooling/qa.mjs structured \
  --run-id "$RUN_ID" \
  --uploads "qa-uploads/$RUN_ID/uploads.json"
```

`bundle` includes reports and every segment's metadata, results, Playwright evidence, and HTML report; collector errors block the bundle unless `--allow-errors` is supplied.

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
| `QA_SEED_FILE` | First existing `server/db/seed.sql`, `server/db/seed.ts` | Seed file recorded and hashed |
| `APP_REVISION` | Git SHA captured at API startup | Optional API revision override |

The app contract is `GET /api/health` → `{ "status": "ok", "revision": "<SHA>" }` and `POST /api/test/reset` → 2xx after reseeding. Reset is gated by `ENABLE_TEST_RESET=1`. The app must support `/?screen=workspace&area=<area-slug>`.

Parent setup requires `npm i -D @playwright/test@1.48.2`, `npx playwright install --with-deps chromium`, and adding `qa-artifacts/` to `.gitignore`. Suggested scripts are `"qa": "node qa/tooling/qa.mjs"` and `"qa:test": "node --test qa/tooling/test/*.test.mjs"`. The app uses Docker `postgres:16-alpine` on `localhost:5432`; start it with `npm run db:up && npm run db:wait && npm run db:setup`, then run `ENABLE_TEST_RESET=1 npm run dev:full`.

## Evidence transport (macOS and Linux)

Children publish only their segment directory to an orphan evidence branch:

```sh
SEG=qa-artifacts/$RUN_ID/$PHASE/$LABEL; ORIGIN=$(git remote get-url origin)
( cd "$SEG" && git init -q && git checkout -q -b "qa-evidence/$RUN_ID/$PHASE-$LABEL" && git add -A && git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" commit -qm "QA evidence $RUN_ID $PHASE/$LABEL" && git push -q "$ORIGIN" HEAD && rm -rf .git )
```

The parent fetches and extracts each evidence ref:

```sh
git fetch origin "refs/heads/qa-evidence/$RUN_ID/*:refs/remotes/origin/qa-evidence/$RUN_ID/*"
mkdir -p "qa-artifacts/$RUN_ID/<phase>/<label>" && git archive <ref> | tar -x -C "qa-artifacts/$RUN_ID/<phase>/<label>"
```

The upload helper names each recording with its case ID, phase, label, and retry so attachment URLs can be mapped back by `structured --uploads`.
