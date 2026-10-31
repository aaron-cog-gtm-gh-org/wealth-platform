# Presenter guide: Wealth Platform parent-child QA run

This is a talk track for showing a completed run of the playbook in `qa/playbook.md`. Show only the results of a real run. Do not stage or hand-edit any status.

## Before the demo (≈5 min)
- Open the parent session. Its structured output lists every case with a status, a recording, and a fix PR where there is one.
- Unzip `<runId>-evidence.zip` and open `<runId>/index.html` locally. It works offline over `file://`.
- Keep the child segment ZIP and its per-case video attachments available alongside the report.
- Have these open in tabs:
  - one QA child session
  - one remediation child session
  - one open fix PR
  - Jira KAN-12 and KAN-18
  - the repo DeepWiki

## Flow (10–12 min)
1. **Inputs (1 min).** Show `qa/Wealth-Platform-Manual-QA.xlsx`: 50 cases across six areas, each linked to a real Jira story. Its canonical source is `qa/cases.json`. Point out that `validate-cases` checks the counts, ID ranges and Jira links before any test is written.
2. **Parent plan (1 min).** Show how the parent froze the baseline SHA, read the Wiki first, then Jira, and fanned out one child per area. Each child runs on its own VM with its own PostgreSQL database, which is reset before every test.
3. **QA child (2 min).** Open a child session and show `qa/tests/<area>.spec.ts`: `[WM-TC-0NN]` titles, the steps from the workbook, and real UI assertions. Show its single baseline run at the frozen SHA, and point out that it was not allowed to skip or soften a test.
4. **Baseline evidence (2 min).** In `index.html`, open the **Baseline (original)** tab and filter to one area. Play a passing video, then a failing video, and open that failure's trace.
5. **Wiki gaps (1 min).** Open the **Discovered gaps** tab. These are `WM-GAP-*` tests for behaviors the Wiki documents but the workbook missed, traced to KAN-18.
6. **Remediation (2 min).** Open a remediation child and its fix PR. Show three things:
   - the diff is small and app-only
   - the tests are untouched
   - the PR is still open, not merged
   Then open the **Fixed outcome (retest)** tab and play the same case going green at the fix SHA. The original red baseline row is still there.
7. **Traceability (1 min).** Click a row's Jira link and fix PR link. Then show the revisions, combined seed and reset digests, and run ID in the report header.
8. **Wrap (1 min).** Read the summary counts, name any case that is still failing with its reason, and show the Audit appendix for any confirmed invalid-run ZIPs.

## Answers to likely questions
- **Why per-test videos and not one long recording?** Each row has its own evidence, so a reviewer can jump straight to the case they care about. Retried attempts keep separate recordings.
- **How do you know a result wasn't faked?** The collector rejects any result that has no Playwright recording, duplicate case ownership, missing cases, and segments with mismatched revisions.
- **Why are fixes not merged?** Fix PRs are left for human review. `main` keeps the test-only contributions, so the baseline stays reproducible.

## Launch a fresh live run

Keep the completed rehearsal open while starting a separate session in **RBC Test** with the organization playbook `!wealth_qa` (or attach `qa/playbook.md` if publication is still awaiting approval):

```text
!wealth_qa
Run Wealth Platform QA for aaron-cog-gtm-gh-org/wealth-platform at main.
Generate a new run ID wm-qa-live-<UTC timestamp>; preserve all prior runs.
Use qa/Wealth-Platform-Manual-QA.xlsx and qa/cases.json, and read DeepWiki then Jira KAN-12..KAN-18.
Use replay mode for committed specs whose workbook and Wiki-gap coverage is current.
Launch six isolated area children; record fresh per-test browser evidence for all 50 original cases and the separate gaps.
Deduplicate findings against existing PRs and retest their heads; keep every remediation PR open and unmerged.
Deliver the structured per-case output and portable offline evidence ZIP.
Synthetic data only; no Jira writes.
```

Show the new parent's frozen revision and six child links, then return to the completed rehearsal. Do not promise that a live run will finish during the presentation. The recorded results describe the rehearsal revision; the live session will report its own revision and outcomes.
