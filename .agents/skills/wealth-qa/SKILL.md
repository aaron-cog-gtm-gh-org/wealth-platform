---
name: wealth-qa
description: Use when authoring or running Wealth Platform QA cases, Playwright evidence segments, or child evidence uploads.
---

# Wealth Platform QA

## Author

Start from the manual workbook and current requirements. `main` intentionally has no generated area specs. Create fresh specs on the run's QA branches; integrate them only into the parent-provided run branch, leaving `main` clean. Historical specs and prior fix PRs are not authoring input.

1. Read the case title, steps, expected results, and test data in `qa/cases.json`.
2. Import `caseTest`, `gapTest`, `expect`, and `openArea` from `../tooling/fixtures`.
3. Register one `caseTest('WM-TC-0NN', async ({ page }) => { ... })` per workbook case in `qa/tests/<area>.spec.ts`.
4. Call `openArea(page, '<area-slug>')`; execute each manual step with at least two meaningful visible UI actions per scenario (selection/filter, navigation, entry or submit as appropriate), and assert user-visible roles and text against the case's expected results. For short read-only cases, include the relevant selection and the detail being checked. Do not add unrelated clicks just to fill time.
5. Put wiki-derived `gapTest` coverage in the spec for its canonical area slug, with a wiki reference.
6. Treat failures as findings: keep assertions strict and never skip, weaken, or loosen a failing test to get a green run.

## Run and publish

1. Start Docker `postgres:16-alpine` on `localhost:5432` with `npm run db:up && npm run db:wait && npm run db:setup`.
2. Start the app with `ENABLE_TEST_RESET=1 npm run dev:full` and confirm `http://localhost:3001/api/health` returns its revision.
3. Validate the area and run its segment:

   ```sh
   node qa/tooling/qa.mjs validate-cases
   node qa/tooling/qa.mjs validate-suite --area clients
   FROZEN_SHA=$(git rev-parse HEAD)
   QA_RETRIES=0 node qa/tooling/qa.mjs run --run-id "$RUN_ID" --phase baseline --label clients --base-sha "$FROZEN_SHA" -- qa/tests/clients.spec.ts
   node qa/tooling/qa.mjs pack-segment --segment "qa-artifacts/$RUN_ID/baseline/clients" --out "qa-uploads/$RUN_ID/clients-baseline.zip"
   node qa/tooling/qa.mjs export-videos --segment "qa-artifacts/$RUN_ID/baseline/clients" --out "qa-uploads/$RUN_ID/clients"
   ```

4. Attach the segment ZIP and each exported per-case video with `message_user`. Videos must be created by Playwright.
   Inspect one recording for cursor visibility and human-followable pacing before submitting the area. The harness supplies the visual cursor and presentation pacing; assertions still check the workbook outcomes.
5. Treat test failures as product evidence; never rerun to get rid of a product failure. If a run is confirmed invalid for an environment or test-authoring reason, pack and attach its ZIP first, then rerun under a new label such as `clients-r2`. Keep both ZIPs and report the reason, affected case IDs, and revision.
6. For a fix retest, commit the fix, open its PR, and restart the API from that head. Use `QA_RETRIES=0 node qa/tooling/qa.mjs run --run-id "$RUN_ID" --phase retest --label fix-1 --base-sha "$(git rev-parse HEAD)" --fix-pr "$FIX_PR_URL" -- qa/tests/clients.spec.ts`. The fix head is the retest base; the original baseline remains separate evidence.
7. Pack the retest with `pack-segment`, export attempt videos and after screenshots with `export-videos`, then attach the ZIP and each exported per-case video with `message_user`.
