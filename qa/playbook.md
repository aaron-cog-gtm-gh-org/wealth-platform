# Playbook: Wealth Platform parent-child UI QA run

## Overview
Run the 50-case Wealth Platform UI workbook (plus Wiki-derived gap tests) as real Playwright browser tests in isolated child sessions, record a video of every test attempt, fix genuine failures in focused remediation PRs, retest them on the fix revision, and deliver one portable evidence bundle and a structured per-test report. The parent orchestrates and owns merges and the report. Children author and run tests, or fix one bug each. Results are never inferred or faked. A test that fails on the frozen baseline is a finding: it is never skipped, loosened or rewritten to pass. The tooling lives in `qa/tooling` (see `qa/README.md`), and the child how-to lives in `.agents/skills/wealth-qa/SKILL.md`.

## Clean spreadsheet-first starting point
`main` contains the application, manual workbook and reusable recording harness, but no generated Playwright case specs. Every demo starts by authoring new tests from the workbook and Wiki/Jira requirements. Keep those tests on run-specific QA branches; `main` must remain ready for the next spreadsheet-to-tests demonstration. Historical runs and their test source are evidence, not templates to restore or copy.

## What's Needed From User
- **Workbook**: the 50-case UI test workbook, either already converted to `qa/cases.json` on the baseline ref or attached as a file. Schema: `{cases:[{id,feature,title,jiraKey,jiraUrl,priority,preconditions,testData,steps:[{action,expected}]}]}`. IDs by feature label (and its `area` slug): Clients (`clients`) `WM-TC-001..008`, Portfolio (`portfolio`) `009..018`, Orders (`orders`) `019..030`, Move Money (`money`) `031..038`, Rebalance (`rebalance`) `039..044`, Settlements (`settlements`) `045..050`. `qa/tooling/areas.json` maps each label to its slug, spec file and Jira key. `qa/requirements.md` (from the workbook branch) holds the seed fixture and the execution rules.
- **Baseline ref**: the branch, tag or SHA of `aaron-cog-gtm-gh-org/wealth-platform` to test, e.g. `main`.
- **Run ID**: a short slug matching `^[A-Za-z0-9._-]+$`, e.g. `wm-qa-2026-11-01`.
- **Jira stories** (read-only): clients KAN-12, portfolio KAN-13, orders KAN-14, money KAN-15, rebalance KAN-16, settlements KAN-17, and Wiki gap coverage KAN-18, all at `https://cognition-team-x9dqnayp.atlassian.net/browse/<KEY>`. The Atlassian integration must be enabled in the org.
- The repo's DeepWiki must be indexed. Check `devin_list_wiki_repos`.
- Optional: the number of remediation children allowed in parallel (default 4), and whether to post Jira comments (default: no Jira writes).

## Procedure
1. **Freeze the baseline.**
   - Resolve the baseline ref to a SHA (`BASE_SHA`) and record it.
   - Confirm that `qa/tooling`, `playwright.config.ts` and `qa/cases.json` exist at that SHA. If the workbook is only attached, convert it in one child session first, and merge that data-only PR.
   - Re-resolve to the merged SHA and record `FROZEN_SHA`.
   - Prove that the app is unchanged with `git diff --stat $BASE_SHA $FROZEN_SHA -- . ':(exclude)qa' ':(exclude)playwright.config.ts' ':(exclude).agents'`, which must print nothing.
   - Run `node qa/tooling/qa.mjs validate-cases` and `npm run qa:test`. Both must pass. Do not require any tests to exist yet.
   - Verify `ffmpeg` and `ffprobe` for parent video compilation. Children using system Chrome via `QA_CHROME` must still install Playwright's recording encoder with `npx playwright install ffmpeg`.
   - Confirm that `qa/tests` contains no `*.spec.ts` files at `FROZEN_SHA`. If it already contains generated cases, stop and report that the selected ref is not a clean authoring baseline. Do not replay or recover historical specs.
   - Create and push `RUN_BRANCH=devin/qa-run-<RUN_ID>` from `FROZEN_SHA`. This is the integration branch for this run's newly authored tests; it is never merged into `main`.
2. **Research Wiki-first, then Jira.**
   - Read the DeepWiki for `aaron-cog-gtm-gh-org/wealth-platform` (`devin_read_wiki_structure`, `devin_read_wiki_contents`, `devin_ask_wiki_question`) and list its documented user-facing behaviors per area.
   - Read KAN-12..KAN-18 through the Atlassian MCP.
   - Map every workbook case to its story.
   - List the Wiki behaviors that the workbook does not cover as gap candidates, `WM-GAP-NNN`, each with a `wikiRef` and Jira KAN-18 (e.g. outage recovery through a real request failure and retry, legacy portfolio period and chart consistency, alternatives commitment/called/unfunded valuations, workspace Back/Forward route consistency).
   - Give each gap an area and a globally unique number block per child: clients 001–019, portfolio 020–039, orders 040–059, money 060–079, rebalance 080–089, settlements 090–099.
   - Do not tell children about suspected bugs, prior runs or existing bug PRs.
3. **Spawn six QA children**, one per area (`clients`, `portfolio`, `orders`, `money`, `rebalance`, `settlements`), all at once.
   - Use the authoring "QA child prompt" in Specifications, the QA child output schema, `notify_on_response=true` and no tags. Pass `RUN_BRANCH` as the test PR's base branch.
   - Pass each child its cases, its Jira story, and its gap list with IDs from its block, verbatim in the prompt. Children must not share or edit each other's spec files.
4. **Collect and gate the baseline.**
   - When each child settles, read its structured output and attachments with `devin_session_interact` (`get` and `get_attachments`); download segment ZIPs and videos with `download_attachment` using `{url}` or `{urls}`.
   - Review each area's newly authored test source against every workbook step and expected result. Each recording should show at least two meaningful, visible UI actions (for example, select a client or filter, then open a detail or submit a change) and the asserted outcome; follow the workbook rather than padding with unrelated clicks. The test-only PR diff may touch only `qa/tests/<area>.spec.ts`. Reject any app edit, `skip`/`fixme`/`fail`/`only`, retries, waits used as assertions, or assertions that do not check the case's expected results. Send such a child back with specific feedback.
   - Collect exactly one valid baseline segment per area into `qa-artifacts/$RUN_ID/baseline/<label>/` with `unpack-segment` (the target path must match the ZIP's `run-meta.json` label, e.g. `<area>` or `<area>-r2`). A valid segment remains baseline evidence even when its tests show product failures.
   - If an attempt is confirmed invalid because of an environment or test-authoring problem, preserve its ZIP unchanged as `qa-artifacts/$RUN_ID/rejected/<phase>-<label>.zip`, do not extract it, and add its ZIP name, reason, affected case IDs, and revision to `qa-artifacts/$RUN_ID/rejected/rejected.json`. Never classify a product failure as environmental or delete raw evidence.
   - A child may re-run only after a confirmed environment/test-authoring failure, and must pack and attach that invalid attempt first. Never re-run to erase a product failure. Selector repairs go through the test-only PR and a new baseline label.
5. **Integrate tests on the run branch.**
   - Merge each approved test-only PR into `RUN_BRANCH` on its own, with `--no-ff` and no squashing, and never together with a fix. Record its resulting head as `TESTS_SHA`. Keep `main` unchanged.
   - On the merged head (`TESTS_SHA`), run `node qa/tooling/qa.mjs validate-suite`. It must report `OK 50/50` plus the gap count. Fix any coverage error through the owning child, not by hand.
   - Run `node qa/tooling/qa.mjs report --run-id $RUN_ID`. It must report no `MISSING_CASE`, `DUPLICATE_OWNERSHIP`, `MISSING_EVIDENCE`, `MANUAL_RESULT`, `REVISION_MISMATCH`, `API_REVISION_UNVERIFIED`, or `SEED_MISMATCH` errors. If one appears, have the owning child produce a new segment under a new label. Never edit results.
6. **Triage failures by signature.**
   - Group the baseline failures (`failed` or `timedOut`) by signature: `<feature>|<normalized first error line>|<failing locator or URL>`. Use the children's `findings` as input, but confirm each one against the trace or video.
   - Deduplicate against existing PRs: run `gh pr list -R aaron-cog-gtm-gh-org/wealth-platform --state all --search "<case id> OR <key error text>"` and read the candidates.
   - Classify each signature as a **new bug**, a **covered by existing PR #N** bug, or a **test defect**. A test defect means the test contradicts the workbook, the Jira story or the Wiki; return it to the QA child with evidence.
   - Never classify a failure as expected without evidence.
7. **Spawn remediation children**, one per new signature, using the "Remediation child prompt", up to the parallel limit. For each covered signature, spawn a child to retest that existing PR head; it does not open a new PR. Fix PRs stay **open and unmerged**, each with its own focused diff.
8. **Collect the retests.**
   - Download each retest segment ZIP and videos from the child attachments. Extract accepted retests with `unpack-segment` under `qa-artifacts/$RUN_ID/retest/<label>/`; preserve confirmed invalid attempts under `rejected/` without extraction and record them in `rejected.json`.
   - Write `qa-artifacts/$RUN_ID/fixes.json` from the children's outputs: `{fixes:[{signature, caseIds, prUrl, fixRevision, retestLabel, existingPr}]}`.
   - Run `report`. It must show no `FIX_UNLINKED` errors. Investigate every `RETEST_REGRESSION` warning and every case that is still `failing`, and say why in the final report. Never mark a red case as fixed.
9. **Package the evidence.**
   - Run `node qa/tooling/qa.mjs demo-video --run-id $RUN_ID` after all accepted baseline, gap and retest segments are collected. It composes their original Playwright footage, including every attempt, with a title card before each clip; it does not replace individual recordings. Check `demo-manifest.json` against the report's attempt count and use `ffprobe` to confirm `full-run.mp4` has a nonzero duration.
   - Run `node qa/tooling/qa.mjs bundle --run-id $RUN_ID`. It produces `qa-artifacts/$RUN_ID-evidence.zip`, including preserved `rejected/**` archives and `rejected.json`.
   - Open `index.html` *as a standalone attachment in Devin preview* and over `file://` after extracting the ZIP. In each view, play baseline and retest videos, confirm both have nonzero duration, and verify that the file still plays when moved away from its media directories. Open `full-run.mp4`: confirm a test title card, browser actions with visible click cursor, then the next title card. If any media is missing, fix packaging rather than reporting success.
   - Attach the ZIP, standalone `index.html`, `report.md`, and `full-run.mp4` with `message_user` in the parent session. Include an **Audit appendix** in the final report listing each rejected ZIP, its reason, affected case IDs, and revision.
10. **Publish the structured output.**
    - Export the videos to upload, or reuse the child attachment URLs, and write `uploads.json` mapping each file name to its URL.
    - Run `node qa/tooling/qa.mjs structured --run-id $RUN_ID --uploads uploads.json`.
    - Submit that JSON as the parent's structured output. Reply with one line of counts, plus links to the test PRs, the open fix PRs and the bundle.

## Specifications
- **Isolation**:
  - Each child runs on its own VM with its own PostgreSQL Docker database: `npm ci`, `npx playwright install --with-deps chromium`, `npm run db:up && npm run db:wait && npm run db:setup`, then `ENABLE_TEST_RESET=1 npm run dev:full` (API on :3001, web on :5173).
  - Check the API health endpoint before running.
  - Tests run serially (one worker), and the backend is reset before every test through `POST /api/test/reset`.
  - Area URLs are `/?screen=workspace&area=<area>`.
- **Frozen revision**: QA children check out `FROZEN_SHA` and run with `--base-sha $FROZEN_SHA`; the tool rejects any non-`qa/tests` change. New remediation branches start from `FROZEN_SHA`, not the QA integration branch, so their PRs remain app-only. Supply the newly authored area spec from `TESTS_SHA` as an uncommitted test overlay in an isolated remediation worktree. Keep that spec unchanged and out of the fix commit, including when retesting an older existing PR head that contains historical tests.
- **Evidence**:
  - Playwright `video: on`, `trace: on`, `screenshot: on` at 1280×900, plus before and after screenshots, kept per attempt and never overwritten (`SEGMENT_EXISTS`).
  - The baseline runs with `QA_RETRIES=0` and the harness default `QA_SLOW_MO=400` ms. The fixture overlays a yellow cursor and click indicator and gives the viewer time to read the initial/final state. Keep the pace human-followable; timing is presentation only, never a replacement for an assertion.
  - `full-run.mp4` is a compilation of the original Playwright recordings with title cards, not a terminal or hand-made recording. Preserve the original WebMs and their evidence links. FFmpeg and ffprobe are required on the parent's VM.
  - Raw recording links remain relative inside the bundle; the standalone HTML also embeds the actual recording bytes so it works in Devin preview without adjacent files.
- **Report**:
  - One row per case per phase: baseline, and retest where one exists. Each row has the case ID, title, feature, Jira key and link, test path, initial status, application/API revisions and recording, fix PR, retest status, revisions and recording, and final status (`passed`, `fixed`, `failing`, `flaky` or `not-run`). Retest fields are null when no retest exists.
  - The report also lists the discovered gap tests (`WM-GAP-*`, mapped to KAN-18), and records the run ID, `BASE_SHA`/`FROZEN_SHA`/`TESTS_SHA`, the fix SHAs, the seed hash, and the invocation and attempt metadata.
  - The tooling exits 2 on any collector error, and the parent fixes the cause rather than suppressing it.
- **Done when**:
  - `validate-suite` reports `OK 50/50`, with at least one gap test or a written reason why the Wiki has no gaps.
  - `report` has zero errors.
  - `demo-manifest.json` lists every accepted attempt and `full-run.mp4` plays each one in order, with the next title card after each clip. The parent attaches that full-run video alongside the individual child recordings.
  - The online structured report uses HTTPS recording URLs for every attempted case and gap. Merge each child's latest upload map, including rerun labels; if a recording is still a relative path, fetch its exact exported attachment and regenerate `structured --uploads` without rerunning tests or relabeling evidence. Keep relative video links in the offline bundle.
  - Every baseline failure is either `fixed`, with a linked open PR and a green retest at that PR's head SHA, or explicitly `failing` with a stated reason.
  - The report opens alone in Devin preview, has playable nonzero-duration videos on baseline/retest rows, and the ZIP opens offline.
- **Validation**: re-run `validate-suite`, `report` and `bundle` on a clean checkout of `TESTS_SHA` from the run branch plus the collected `qa-artifacts`. The outputs must be identical, with the same `report.json` hash. Verify that `main` still has no generated case specs.

### QA child prompt (authoring; fill `<…>`; no tags)
```
Repo aaron-cog-gtm-gh-org/wealth-platform. Area: <area> (Jira <KEY>, <url>). Run ID <RUN_ID>.
Check out FROZEN_SHA <sha> on a new branch devin/qa-<RUN_ID>-<area>. Follow .agents/skills/wealth-qa/SKILL.md.
Before writing tests, read this repo's DeepWiki for the <area> area and read Jira <KEY>.
Author from the workbook and requirements; historical specs, recordings and fix PRs are not source material for writing these tests.
Write qa/tests/<area>.spec.ts with one caseTest per case WM-TC-<first>..<last> from qa/cases.json.
Each test must perform every step and assert every expected result through the UI. Show at least two meaningful
visible UI actions before the outcome (selection/filter, navigation, entry or submit, as appropriate to the case);
never pad a scenario with unrelated clicks. Inspect the recorded video for followable pacing and cursor visibility. In the same file,
add these gap tests: <list of WM-GAP-NNN, title, wikiRef>. Write each one as
gapTest(id, {title, area:'<area>', wikiRef}, ...).
Do not change app code, qa/cases.json or qa/tooling.
Never skip a test, add retries or weaken an assertion to make it pass. A red test is a finding: report it and do not fix the app.
1. Run `node qa/tooling/qa.mjs validate-suite --area <area>`. It must print OK.
2. Run `QA_RETRIES=0 node qa/tooling/qa.mjs run --run-id <RUN_ID> --phase baseline --label <area> --base-sha <sha> -- qa/tests/<area>.spec.ts`.
   A non-zero exit from test failures is expected product evidence; never re-run to get rid of a product failure.
3. Run `pack-segment` and `export-videos` for the segment. Attach its ZIP and every exported per-case video with `message_user`. If the run is confirmed invalid for an environment or test-authoring reason, pack and attach that original ZIP first, then re-run under a new label (`<area>-r2`), pack and attach the new segment and videos, and report the reason, affected case IDs, and revision. Keep both ZIPs; do not replace or delete the original.
4. Open a test-only PR targeting RUN_BRANCH <branch>, not main, titled "QA <RUN_ID>: <area> UI tests". Its body lists the per-test statuses.
5. Report the structured output.
```

### Remediation child prompt (no tags)
```
Repo aaron-cog-gtm-gh-org/wealth-platform. Run ID <RUN_ID>. Bug signature: <signature>.
Failing cases: <IDs + titles + Jira links>. Baseline evidence: <video/trace attachment URLs>.
Mode <new|existing>:
- new: create a branch devin/qa-fix-<RUN_ID>-<slug> from FROZEN_SHA <sha>.
- existing: check out the head of PR #<n>. Do not open a new PR, and only retest unless the PR is clearly incomplete.
In a dedicated worktree, load the exact newly authored qa/tests/<area>.spec.ts from TESTS_SHA <sha>
as an uncommitted overlay. Use this run's assertions, not historical specs from the fix branch.
Keep the overlay uncommitted; stage only explicit application and regression-test files for any fix.
Follow .agents/skills/wealth-qa/SKILL.md to start the app.
For existing mode, reproduce, then proceed to steps 7–10 if the PR is complete. Use steps 2–6 only for a new or demonstrably incomplete fix.
1. Reproduce with `npx playwright test qa/tests/<area>.spec.ts -g "<ID>"`.
2. Add a focused server/unit regression test next to the code being fixed (for example, `server/**/*.test.ts` or the existing unit-test location). It must fail before the fix. Never commit `qa/**` or change the freshly authored QA assertions; only the exact overlay described above is allowed.
3. Make the smallest app fix.
4. Run `npm run lint`, `npm run typecheck`, and the relevant unit tests.
5. Commit and push.
6. Open a PR, or in existing mode use the existing PR. Title it "Fix <IDs>: <summary>", link the Jira story and failing cases, leave it OPEN, and do not merge it.
7. Restart `npm run dev:full` so `/api/health` serves HEAD.
8. Retest with the exact command:
   `QA_RETRIES=0 node qa/tooling/qa.mjs run --run-id <RUN_ID> --phase retest --label fix-<slug> --base-sha $(git rev-parse HEAD) --fix-pr <that PR URL> -- qa/tests/<area>.spec.ts`.
9. Run `pack-segment` and `export-videos` for the retest; attach the segment ZIP and every exported per-case video.
10. Report the structured output, including any other test in that spec that now fails.
```

### Structured output schemas
- QA child: `{area, branch, prUrl, headSha, frozenSha, validateSuite, segmentZip (attachment URL), rejectedAttempts:[{phase,label,segmentZip,reason,caseIds,revision}], segment, tests:[{id,title,status,attempts,videoAttachment}], findings:[{signature,caseIds,summary,errorExcerpt}], gapTests:[{id,title,wikiRef,status}]}`.
- Remediation child: `{signature, caseIds, prUrl, existingPr, fixSha, retestLabel, segmentZip (attachment URL), rejectedAttempts:[{phase,label,segmentZip,reason,caseIds,revision}], retest:[{id,status,videoAttachment}]}`.
- Parent: the output of `qa.mjs structured` (`runId`, revisions, seed, summary, `cases[]`, `gaps[]`, `errors[]`).

## Advice and Pointers
- A child that sees only its area and the frozen app gives a clean baseline. Spoiling it with known bugs turns QA into confirmation.
- Read the trace and video before blaming the app. Selector or timing defects in a test go back to its author. Real UI defects go to remediation.
- Retest the whole area spec on the fix head. The collector then catches regressions.
- Restart the API after changing branches. `dev:full` does not reload routes.

## Forbidden Actions
- Keep both generated tests and application fixes off `main`. Merge test-only PRs only into `RUN_BRANCH`; leave fix PRs open and unmerged.
- Do not edit or delete raw evidence or re-run to erase a product failure. Preserve confirmed invalid-run ZIPs without extracting them; see the rejected-evidence procedure above.
- Do not edit a `results.json` or `qa/cases.json` during a run.
- Do not mark a case as passed or fixed without a Playwright recording at the recorded revision.
- Do not add tags to child sessions, and do not write to Jira unless the user asks.
