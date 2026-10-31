# Playbook: Wealth Platform parent-child UI QA run

## Overview
Run the 50-case Wealth Platform UI workbook (plus Wiki-derived gap tests) as real Playwright browser tests in isolated child sessions, record a video of every test attempt, fix genuine failures in focused remediation PRs, retest them on the fix revision, and deliver one portable evidence bundle and a structured per-test report. The parent orchestrates and owns merges and the report. Children author and run tests, or fix one bug each. Results are never inferred or faked. A test that fails on the frozen baseline is a finding: it is never skipped, loosened or rewritten to pass. The tooling lives in `qa/tooling` (see `qa/README.md`), and the child how-to lives in `.agents/skills/wealth-qa/SKILL.md`.

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
   - Run `node qa/tooling/qa.mjs validate-cases` and `node --test qa/tooling/test/`. Both must pass. Do not require any tests to exist yet.
2. **Research Wiki-first, then Jira.**
   - Read the DeepWiki for `aaron-cog-gtm-gh-org/wealth-platform` (`devin_read_wiki_structure`, `devin_read_wiki_contents`, `devin_ask_wiki_question`) and list its documented user-facing behaviors per area.
   - Read KAN-12..KAN-18 through the Atlassian MCP.
   - Map every workbook case to its story.
   - List the Wiki behaviors that the workbook does not cover as gap candidates, `WM-GAP-NNN`, each with a `wikiRef` and Jira KAN-18 (e.g. outage recovery through a real request failure and retry, legacy portfolio period and chart consistency, alternatives commitment/called/unfunded valuations, workspace Back/Forward route consistency).
   - Give each gap an area and a globally unique number block per child: clients 001–019, portfolio 020–039, orders 040–059, money 060–079, rebalance 080–089, settlements 090–099.
   - Do not tell children about suspected bugs, prior runs or existing bug PRs.
3. **Spawn six QA children**, one per area (`clients`, `portfolio`, `orders`, `money`, `rebalance`, `settlements`), all at once.
   - Use the "QA child prompt" in Specifications, the QA child output schema, `notify_on_response=true` and no tags.
   - Pass each child its cases, its Jira story, and its gap list with IDs from its block, verbatim in the prompt. Children must not share or edit each other's spec files.
4. **Collect and gate the baseline.**
   - When each child settles, read its structured output and attachments (`devin_session_interact` with `get` and `get_attachments`).
   - Review each test-only PR. Its diff may touch only `qa/tests/<area>.spec.ts`. Reject any app edit, `skip`/`fixme`/`fail`/`only`, retries, waits used as assertions, or assertions that do not check the case's expected results. Send such a child back with specific feedback.
   - Fetch each child's evidence branch into `qa-artifacts/$RUN_ID/baseline/<area>/` (see `qa/README.md`, "Evidence transport").
   - Do not re-run or replace a child's baseline segment.
5. **Merge the test-only PRs.**
   - Merge each approved test-only PR into `main` on its own, with `--no-ff` and no squashing, and never together with a fix. Main may go red. That is the honest baseline.
   - On the merged head (`TESTS_SHA`), run `node qa/tooling/qa.mjs validate-suite`. It must report `OK 50/50` plus the gap count. Fix any coverage error through the owning child, not by hand.
   - Run `node qa/tooling/qa.mjs report --run-id $RUN_ID`. It must report no `MISSING_CASE`, `DUPLICATE_OWNERSHIP`, `MISSING_EVIDENCE`, `MANUAL_RESULT` or `REVISION_MISMATCH` errors. If one appears, have the owning child produce a new segment under a new label. Never edit results.
6. **Triage failures by signature.**
   - Group the baseline failures (`failed` or `timedOut`) by signature: `<feature>|<normalized first error line>|<failing locator or URL>`. Use the children's `findings` as input, but confirm each one against the trace or video.
   - Deduplicate against existing PRs: run `gh pr list -R aaron-cog-gtm-gh-org/wealth-platform --state all --search "<case id> OR <key error text>"` and read the candidates.
   - Classify each signature as a **new bug**, a **covered by existing PR #N** bug, or a **test defect**. A test defect means the test contradicts the workbook, the Jira story or the Wiki; return it to the QA child with evidence.
   - Never classify a failure as expected without evidence.
7. **Spawn remediation children**, one per new signature, using the "Remediation child prompt", up to the parallel limit. For each covered signature, spawn a child to retest that existing PR head; it does not open a new PR. Fix PRs stay **open and unmerged**, each with its own focused diff.
8. **Collect the retests.**
   - Fetch each retest evidence branch into `qa-artifacts/$RUN_ID/retest/<label>/`.
   - Write `qa-artifacts/$RUN_ID/fixes.json` from the children's outputs: `{fixes:[{signature, caseIds, prUrl, fixRevision, retestLabel, existingPr}]}`.
   - Run `report`. It must show no `FIX_UNLINKED` errors. Investigate every `RETEST_REGRESSION` warning and every case that is still `failing`, and say why in the final report. Never mark a red case as fixed.
9. **Package the evidence.**
   - Run `node qa/tooling/qa.mjs bundle --run-id $RUN_ID`. It produces `qa-artifacts/$RUN_ID-evidence.zip`.
   - Unzip the bundle to a fresh directory, open `<runId>/index.html` over `file://` in the browser, and spot-check the baseline and fixed-outcome tabs. At least one video per tab must play.
   - Attach the zip, `index.html` and `report.md` with `message_user`.
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
- **Frozen revision**: QA children check out `FROZEN_SHA` and run with `--base-sha $FROZEN_SHA`; the tool rejects any non-`qa/tests` change. Remediation children branch from `TESTS_SHA`, and their PR must not touch `qa/`.
- **Evidence**:
  - Playwright `video: on`, `trace: on`, `screenshot: on` at 1280×900, plus before and after screenshots, kept per attempt and never overwritten (`SEGMENT_EXISTS`).
  - The baseline runs with `QA_RETRIES=0`. Optional `QA_SLOW_MO` (≤250 ms) is allowed for watchable replays. Do not add sleeps.
  - Terminal, slideshow or hand-made recordings are not evidence.
  - Every recording link is relative inside the bundle.
- **Report**:
  - One row per case per phase: baseline, and retest where one exists. Each row has the case ID, title, feature, Jira key and link, test path, initial status and recording, fix PR, retest status and recording, and final status (`passed`, `fixed`, `failing`, `flaky` or `not-run`).
  - The report also lists the discovered gap tests (`WM-GAP-*`, mapped to KAN-18), and records the run ID, `BASE_SHA`/`FROZEN_SHA`/`TESTS_SHA`, the fix SHAs, the seed hash, and the invocation and attempt metadata.
  - The tooling exits 2 on any collector error, and the parent fixes the cause rather than suppressing it.
- **Done when**:
  - `validate-suite` reports `OK 50/50`, with at least one gap test or a written reason why the Wiki has no gaps.
  - `report` has zero errors.
  - Every baseline failure is either `fixed`, with a linked open PR and a green retest at that PR's head SHA, or explicitly `failing` with a stated reason.
  - The bundle opens offline, and its videos play.
- **Validation**: re-run `validate-suite`, `report` and `bundle` on a clean checkout of `main` plus the collected `qa-artifacts`. The outputs must be identical, with the same `report.json` hash.

### QA child prompt (fill `<…>`; no tags)
```
Repo aaron-cog-gtm-gh-org/wealth-platform. Area: <area> (Jira <KEY>, <url>). Run ID <RUN_ID>.
Check out FROZEN_SHA <sha> on a new branch devin/qa-<RUN_ID>-<area>. Follow .agents/skills/wealth-qa/SKILL.md.
Before writing tests, read this repo's DeepWiki for the <area> area and read Jira <KEY>.
Write qa/tests/<area>.spec.ts with one caseTest per case WM-TC-<first>..<last> from qa/cases.json.
Each test must perform every step and assert every expected result through the UI. In the same file,
add these gap tests: <list of WM-GAP-NNN, title, wikiRef>. Write each one as
gapTest(id, {title, area:'<area>', wikiRef}, ...).
Do not change app code, qa/cases.json or qa/tooling.
Never skip a test, add retries or weaken an assertion to make it pass. A red test is a finding: report it and do not fix the app.
1. Run `node qa/tooling/qa.mjs validate-suite --area <area>`. It must print OK.
2. Run `QA_RETRIES=0 node qa/tooling/qa.mjs run --run-id <RUN_ID> --phase baseline --label <area> --base-sha <sha> -- qa/tests/<area>.spec.ts`.
   Run it exactly once. A non-zero exit from test failures is expected data. If the run broke for an
   environment reason, re-run it under a new label (<area>-r2) and say why.
3. Publish the segment as described in the "Evidence transport" section of qa/README.md.
4. Run `export-videos` and attach every exported file with message_user.
5. Open a test-only PR to main titled "QA <RUN_ID>: <area> UI tests". Its body lists the per-test statuses.
6. Report the structured output.
```

### Remediation child prompt (no tags)
```
Repo aaron-cog-gtm-gh-org/wealth-platform. Run ID <RUN_ID>. Bug signature: <signature>.
Failing cases: <IDs + titles + Jira links>. Baseline evidence: <video/trace attachment URLs>.
Mode <new|existing>:
- new: create a branch devin/qa-fix-<RUN_ID>-<slug> from TESTS_SHA <sha>.
- existing: check out the head of PR #<n>. Do not open a new PR, and only retest unless the PR is clearly incomplete.
Follow .agents/skills/wealth-qa/SKILL.md to start the app.
1. Reproduce the failure first: `npx playwright test qa/tests/<area>.spec.ts -g "<ID>"`.
2. Make the smallest app fix that makes the existing test pass. Do not modify anything under qa/.
3. Commit and push, then run:
   `node qa/tooling/qa.mjs run --run-id <RUN_ID> --phase retest --label fix-<slug> --base-sha $(git rev-parse HEAD) --fix-pr <pr url> -- qa/tests/<area>.spec.ts`
4. Publish the segment as described in the "Evidence transport" section of qa/README.md.
5. Run `export-videos` and attach every exported file.
6. Open the PR (or update the existing one) titled "Fix <IDs>: <summary>". Link the Jira story and the failing cases. Leave it OPEN and do not merge it.
7. Report the structured output, including any other test in that spec that now fails.
```

### Structured output schemas
- QA child: `{area, branch, prUrl, headSha, frozenSha, validateSuite, evidenceBranch, segment, tests:[{id,title,status,attempts,videoAttachment}], findings:[{signature,caseIds,summary,errorExcerpt}], gapTests:[{id,title,wikiRef,status}]}`.
- Remediation child: `{signature, caseIds, prUrl, existingPr, fixSha, retestLabel, evidenceBranch, retest:[{id,status,videoAttachment}]}`.
- Parent: the output of `qa.mjs structured` (`runId`, revisions, seed, summary, `cases[]`, `gaps[]`, `errors[]`).

## Advice and Pointers
- A child that sees only its area and the frozen app gives a clean baseline. Spoiling it with known bugs turns QA into confirmation.
- Read the trace and video before blaming the app. Selector or timing defects in a test go back to its author. Real UI defects go to remediation.
- Retest the whole area spec on the fix head. The collector then catches regressions.
- Restart the API after changing branches. `dev:full` does not reload routes.

## Forbidden Actions
- Do not merge fix PRs, squash test and fix changes together, or push to `main` other than the test-only merges.
- Do not edit, delete or re-run-over a baseline segment, a `results.json`, or `qa/cases.json` during a run.
- Do not mark a case as passed or fixed without a Playwright recording at the recorded revision.
- Do not add tags to child sessions, and do not write to Jira unless the user asks.
