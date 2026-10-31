---
name: wealth-qa
description: Use when authoring or running Wealth Platform QA cases, Playwright evidence segments, or child evidence uploads.
---

# Wealth Platform QA

## Author

1. Read the case title, steps, expected results, and test data in `qa/cases.json`.
2. Import `caseTest`, `gapTest`, `expect`, and `openArea` from `../tooling/fixtures`.
3. Register one `caseTest('WM-TC-0NN', async ({ page }) => { ... })` per workbook case in `qa/tests/<area>.spec.ts`.
4. Call `openArea(page, '<area-slug>')`; assert user-visible roles and text against the case's expected results.
5. Put wiki-derived `gapTest` coverage in the spec for its canonical area slug, with a wiki reference.
6. Treat failures as findings: keep assertions strict and never skip, weaken, or loosen a failing test to get a green run.

## Run and publish

1. Start Oracle Free with `npm run db:up && npm run db:wait && npm run db:setup`.
2. Start the app with `ENABLE_TEST_RESET=1 npm run dev:full` and confirm `http://localhost:3001/api/health` returns 200.
3. Validate the area and run its segment:

   ```sh
   node qa/tooling/qa.mjs validate-cases
   node qa/tooling/qa.mjs validate-suite --area clients
   node qa/tooling/qa.mjs run --run-id "$RUN_ID" --phase baseline --label clients
   node qa/tooling/qa.mjs export-videos --segment "qa-artifacts/$RUN_ID/baseline/clients" --out "qa-uploads/$RUN_ID/clients"
   ```

4. Keep the generated `run-meta.json`, `results.json`, `summary.json`, `test-results/`, and `html/` together in the segment.
5. Export attempt videos and after screenshots, then publish the segment using the evidence transport instructions in `qa/README.md`. Videos must be created by Playwright.
