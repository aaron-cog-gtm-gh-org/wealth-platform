import fs from 'node:fs';
import path from 'node:path';
import { caseIdFromTitle, diagnostic, loadAreas, normalizeRelative, readJson, sortedDiagnostics, writeJson } from './common.mjs';
import { normalizeSegment } from './normalize.mjs';

function segmentPrefix(runDir, segmentDir) {
  return normalizeRelative(path.relative(runDir, segmentDir));
}

function evidencePath(prefix, attachment) {
  return attachment ? `${prefix}/${normalizeRelative(attachment)}` : null;
}

function testId(test) {
  return test.caseId ?? test.gapId ?? caseIdFromTitle(test.title);
}

function testFeature(test, testCase, config) {
  return testCase?.feature ?? test.annotations?.find((annotation) => annotation.type === 'feature')?.description ??
    config.areas.find((area) => area.spec === test.file)?.feature ?? '';
}

function testArea(test, testCase, config) {
  if (testCase) return config.areas.find((area) => area.feature === testCase.feature)?.area ?? '';
  const annotationArea = test.annotations?.find((annotation) => annotation.type === 'area')?.description;
  if (annotationArea) return annotationArea;
  const annotationFeature = test.annotations?.find((annotation) => annotation.type === 'feature')?.description;
  return config.areas.find((area) => area.area === annotationFeature || area.feature === annotationFeature)?.area ?? '';
}

function annotateTest(test, segment, runDir, testCase, config) {
  const prefix = segmentPrefix(runDir, segment.directory);
  const attempts = (test.attempts ?? []).map((attempt) => ({
    retry: attempt.retry,
    status: attempt.status,
    video: evidencePath(prefix, attempt.video),
    screenshots: (attempt.screenshots ?? []).map((file) => evidencePath(prefix, file)),
    trace: evidencePath(prefix, attempt.trace),
    before: evidencePath(prefix, attempt.before),
    after: evidencePath(prefix, attempt.after),
    error: attempt.error ?? ''
  }));
  return {
    id: testId(test),
    title: test.title,
    area: testArea(test, testCase, config),
    feature: testFeature(test, testCase, config),
    jiraKey: testCase?.jiraKey ?? config.gap.jiraKey,
    jiraUrl: testCase?.jiraUrl ?? `${config.jiraBaseUrl}${config.gap.jiraKey}`,
    testPath: test.line ? `${test.file}:${test.line}` : test.file,
    file: test.file,
    line: test.line ?? null,
    status: test.status,
    outcome: test.outcome,
    expectedStatus: test.expectedStatus,
    recordings: attempts,
    primaryRecording: attempts.at(-1)?.video ?? null,
    trace: attempts.at(-1)?.trace ?? null,
    screenshots: attempts.flatMap((attempt) => attempt.screenshots),
    revision: segment.meta.revision ?? null,
    baseRevision: segment.meta.baseRevision ?? null,
    phase: segment.meta.phase,
    label: segment.meta.label,
    fixPr: segment.meta.fixPr ?? null,
    seed: segment.meta.seed ?? null
  };
}

function statusOf(row) {
  return row?.status ?? 'not-run';
}

function linkedFixesFor(caseId, fixes) {
  return fixes.filter((fix) => (fix.caseIds ?? []).includes(caseId));
}

function isLinkedFix(caseId, segment, fixes) {
  return fixes.some((fix) => (fix.caseIds ?? []).includes(caseId) && fix.retestLabel === segment.meta.label);
}

function expectedCases(config, workbook) {
  if (workbook?.cases?.length) return workbook.cases;
  const generated = [];
  for (const area of config.areas) {
    for (let number = area.first; number <= area.last; number += 1) {
      generated.push({
        id: `WM-TC-${String(number).padStart(3, '0')}`,
        feature: area.feature,
        title: '',
        jiraKey: area.jiraKey,
        jiraUrl: `${config.jiraBaseUrl}${area.jiraKey}`
      });
    }
  }
  return generated;
}

function addMissingVideoErrors(segment, tests, errors) {
  for (const test of tests) {
    const id = testId(test) ?? 'untagged';
    for (const attempt of test.attempts ?? []) {
      if (!attempt.video) {
        errors.push(diagnostic('MISSING_EVIDENCE', segment.relative, `${id} retry ${attempt.retry} has no video`));
      } else if (!fs.existsSync(path.resolve(segment.directory, attempt.video))) {
        errors.push(diagnostic('MISSING_EVIDENCE', segment.relative, `${id} retry ${attempt.retry} video does not exist`));
      }
    }
  }
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029'
  })[character]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[character]);
}

function renderHtml(report) {
  const embedded = escapeJsonForHtml(report);
  const runLabel = escapeHtml(report.runId);
  const generatedLabel = escapeHtml(report.generatedAt ?? 'unknown');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QA evidence — ${runLabel}</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17263c;background:#f4f7fb;--navy:#003168;--yellow:#ffd200;--line:#dbe3ed}
*{box-sizing:border-box}body{margin:0}header{background:var(--navy);color:white;padding:28px clamp(18px,4vw,56px);border-bottom:5px solid var(--yellow)}
h1{font-size:clamp(22px,3vw,34px);margin:0 0 7px}.sub{opacity:.85;font-size:14px}.wrap{max-width:1440px;margin:24px auto;padding:0 20px}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.chip{background:white;border:1px solid var(--line);border-radius:8px;padding:10px 14px;font-weight:650}.chip span{color:#566579;font-weight:500}
.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:20px 0}.toolbar input{flex:1;min-width:220px;padding:11px 13px;border:1px solid #b8c6d6;border-radius:7px;font:inherit}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);overflow:auto}.tabs button{border:0;background:transparent;padding:12px 16px;color:#314761;font:inherit;font-weight:650;cursor:pointer;white-space:nowrap;border-bottom:3px solid transparent}.tabs button[aria-selected=true]{color:var(--navy);border-color:var(--yellow)}
.panel{display:none}.panel.active{display:block}.table-wrap{overflow:auto;background:white;border:1px solid var(--line);border-radius:8px;margin-top:12px}table{border-collapse:collapse;width:100%;min-width:1040px}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #e7edf3;font-size:13px}th{background:#edf2f7;color:#32465d;position:sticky;top:0}td:first-child{font-weight:700;color:var(--navy);white-space:nowrap}
.pill{display:inline-block;border-radius:999px;padding:4px 9px;font-weight:700;text-transform:capitalize;background:#e7edf5;color:#314761}.pill.passed,.pill.fixed{background:#d9f2e5;color:#145d36}.pill.failing,.pill.failed,.pill.timedOut{background:#ffe1dd;color:#9a2418}.pill.flaky{background:#fff1c2;color:#705600}.pill.not-run,.pill.skipped{background:#e7edf5}
video{display:block;max-width:320px;background:#0b1726;border-radius:5px;margin:4px 0}.links{display:flex;gap:8px;flex-wrap:wrap;margin:5px 0}.links a,.jira{color:#0055a6}.thumb{width:80px;height:55px;object-fit:cover;border:1px solid var(--line);border-radius:4px}.error{border-left:4px solid #bd2d23;background:#fff0ed;padding:10px 13px;margin:8px 0}.warning{border-left:4px solid #b88a00;background:#fff8d8;padding:10px 13px;margin:8px 0}.empty{padding:28px;color:#64758a;text-align:center}
</style></head><body>
<header><h1>Wealth Platform QA Evidence</h1><div class="sub">Run ${runLabel} · generated ${generatedLabel}</div></header>
<main class="wrap">
<section class="chips" id="chips"></section>
<div class="toolbar"><input id="filter" type="search" placeholder="Filter by ID, title, or feature" aria-label="Filter cases"></div>
<nav class="tabs" role="tablist">
<button role="tab" aria-selected="true" data-panel="baseline">Baseline (original)</button>
<button role="tab" aria-selected="false" data-panel="retest">Fixed outcome (retest)</button>
<button role="tab" aria-selected="false" data-panel="gaps">Discovered gaps</button>
<button role="tab" aria-selected="false" data-panel="errors">Errors <span id="error-count"></span></button>
</nav>
<section class="panel active" id="baseline"></section><section class="panel" id="retest"></section><section class="panel" id="gaps"></section><section class="panel" id="errors"></section>
</main>
<script type="application/json" id="report-data">${embedded}</script>
<script>
const data=JSON.parse(document.getElementById('report-data').textContent);
const h=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e};
const link=(label,url,cls)=>{if(!url)return null;if(!/^https?:\\/\\//i.test(url)&&(url.startsWith('/')||url.includes('..')))return null;const a=h('a',label,cls);a.href=url;if(/^https?:/i.test(url))a.target='_blank',a.rel='noopener noreferrer';return a};
const safeUrl=url=>typeof url==='string'&&!url.startsWith('/')&&!url.includes('..')?url:null;
const summary=data.summary||{};
const apiRevision=Array.isArray(data.apiRevision)?data.apiRevision.join(', '):data.apiRevision||'unknown';
const chipData=[['Passed',summary.passed],['Fixed',summary.fixed],['Failing',summary.failing],['Not run',summary.notRun],['Flaky',summary.flaky],['Revision',data.baselineRevisions?.join(', ')||'—'],['API revision',apiRevision],['Run',data.runId]];
const chips=document.getElementById('chips');for(const [label,value] of chipData){const e=h('div');e.className='chip';e.append(document.createTextNode(String(value??0)+' '));const s=h('span',label);e.append(s);chips.append(e)}
function makeTable(rows){
 if(!rows.length)return h('div','No results for this section.','empty');
 const wrap=h('div');wrap.className='table-wrap';const table=h('table');const head=h('thead');const tr=h('tr');
 for(const name of ['ID','Title','Area','Feature','Jira','Test path','Status','Recordings','Screenshots','Trace','Fix PR'])tr.append(h('th',name));
 head.append(tr);table.append(head);const body=h('tbody');
 for(const row of rows){const line=h('tr');line.dataset.filter=[row.id,row.title,row.area,row.feature].join(' ').toLowerCase();
 line.append(h('td',row.id),h('td',row.title),h('td',row.area),h('td',row.feature));
 const jiraCell=h('td');const jira=link(row.jiraKey,row.jiraUrl,'jira');if(jira)jiraCell.append(jira);line.append(jiraCell);
 line.append(h('td',row.testPath||'—'));const statusCell=h('td');statusCell.append(h('span',row.status,'pill '+String(row.status).replace(/[^a-z]/gi,'')));line.append(statusCell);
 const media=h('td');const recordings=row.recordings||[];const primary=recordings.at(-1)?.video||row.primaryRecording;
 if(primary){const video=document.createElement('video');video.controls=true;video.preload='none';video.width=320;video.src=safeUrl(primary)||'';media.append(video)}
 const recordLinks=h('div');recordLinks.className='links';recordings.slice(0,-1).forEach((item,index)=>{const a=link('retry '+item.retry,safeUrl(item.video));if(a)recordLinks.append(a)});if(recordLinks.childNodes.length)media.append(recordLinks);line.append(media);
 const shots=h('td');for(const file of row.screenshots||[]){const url=safeUrl(file);if(url){const a=link('',url);const img=document.createElement('img');img.src=url;img.alt='Screenshot';img.className='thumb';a.append(img);shots.append(a)}}line.append(shots);
 const traceCell=h('td');const trace=link('trace',safeUrl(row.trace));if(trace)traceCell.append(trace);line.append(traceCell);
 const fixCell=h('td');for(const fix of (row.fixPrs||[])){const a=link(fix,fix);if(a)fixCell.append(a)}if(row.fixPr&&!row.fixPrs?.length){const a=link(row.fixPr,row.fixPr);if(a)fixCell.append(a)}line.append(fixCell);body.append(line)}
 table.append(body);wrap.append(table);return wrap;
}
document.getElementById('baseline').append(makeTable(data.baselineRows||[]));
document.getElementById('retest').append(makeTable(data.retestRows||[]));
document.getElementById('gaps').append(makeTable(data.gapTests||[]));
const errorPanel=document.getElementById('errors');for(const item of data.errors||[]){const block=h('div',item.code+' '+item.path+': '+item.message,'error');errorPanel.append(block)}for(const item of data.warnings||[]){const block=h('div',item.code+' '+item.path+': '+item.message,'warning');errorPanel.append(block)}if(!errorPanel.childNodes.length)errorPanel.append(h('div','No errors or warnings.','empty'));document.getElementById('error-count').textContent=String((data.errors||[]).length+(data.warnings||[]).length);
document.querySelectorAll('[role=tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[role=tab]').forEach(item=>item.setAttribute('aria-selected',String(item===button)));document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',panel.id===button.dataset.panel))}));
document.getElementById('filter').addEventListener('input',event=>{const query=event.target.value.toLowerCase();document.querySelectorAll('tbody tr').forEach(row=>row.hidden=!row.dataset.filter.includes(query))});
</script></body></html>`;
}

function renderMarkdown(report) {
  const output = [
    `# QA report: ${report.runId}`,
    '',
    `Generated: ${report.generatedAt ?? 'unknown'}`,
    `Baseline revision(s): ${(report.baselineRevisions ?? []).join(', ') || 'none'}`,
    `API revision(s): ${Array.isArray(report.apiRevision) ? report.apiRevision.join(', ') : report.apiRevision ?? 'unknown'}`,
    `Base revision: ${report.baseRevision ?? 'none'}`,
    `Fix revision(s): ${(report.fixRevisions ?? []).join(', ') || 'none'}`,
    `Summary: ${report.summary.passed} passed, ${report.summary.fixed} fixed, ${report.summary.failing} failing, ${report.summary.flaky} flaky, ${report.summary.notRun} not-run`,
    '',
    '## Errors and warnings',
    ''
  ];
  output.push(...(report.errors.length ? report.errors.map((item) => `- ERROR ${item.code} ${item.path}: ${item.message}`) : ['- None']));
  output.push(...report.warnings.map((item) => `- WARN ${item.code} ${item.path}: ${item.message}`));
  output.push('', '## Case results', '', '| ID | Area | Feature | Baseline | Retest | Final | Jira | Test |', '|---|---|---|---|---|---|---|---|');
  for (const row of report.cases) {
    output.push(`| ${row.id} | ${row.area} | ${row.feature} | ${row.initialStatus} | ${row.retestStatus ?? '—'} | ${row.finalStatus} | [${row.jiraKey}](${row.jiraUrl}) | ${row.testPath ?? '—'} |`);
  }
  output.push('', '## Discovered gaps', '');
  for (const gap of report.gapTests) output.push(`- ${gap.id}: ${gap.title} (${gap.feature}; ${gap.status}; ${gap.wikiRef ?? 'no wiki ref'})`);
  return `${output.join('\n')}\n`;
}

export function buildReport(runId, {
  artifacts = 'qa-artifacts',
  casesFile = path.join('qa', 'cases.json'),
  generatedAt,
  root = process.cwd(),
  config = loadAreas()
} = {}) {
  const errors = [];
  const warnings = [];
  if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) {
    errors.push(diagnostic('INVALID_RUN_ID', '.', 'run id must match ^[A-Za-z0-9][A-Za-z0-9._-]*$'));
    return { report: null, errors: sortedDiagnostics(errors), warnings };
  }
  const artifactsDir = path.resolve(root, artifacts);
  const runDir = path.join(artifactsDir, runId);
  if (!fs.existsSync(runDir)) {
    errors.push(diagnostic('MISSING_RUN', runId, 'run artifacts directory does not exist'));
    return { report: null, errors, warnings };
  }
  const casePath = path.isAbsolute(casesFile) ? casesFile : path.resolve(root, casesFile);
  const workbook = fs.existsSync(casePath) ? readJson(casePath) : { cases: [] };
  const cases = expectedCases(config, workbook);
  const fixesPath = path.join(runDir, 'fixes.json');
  const fixes = fs.existsSync(fixesPath) ? readJson(fixesPath).fixes ?? [] : [];
  const metaFiles = walkFilesSync(runDir, (file) => path.basename(file) === 'run-meta.json');
  const segments = [];

  for (const metaFile of metaFiles) {
    const directory = path.dirname(metaFile);
    const relative = normalizeRelative(path.relative(runDir, directory));
    const resultsPath = path.join(directory, 'results.json');
    const summaryPath = path.join(directory, 'summary.json');
    let summary;
    if (!fs.existsSync(summaryPath)) {
      const normalized = normalizeSegment(directory, { cwd: root });
      if (normalized.errors.length) errors.push(...normalized.errors.map((item) => diagnostic(item.code, relative, item.message)));
      summary = normalized.summary;
    } else {
      summary = readJson(summaryPath);
      if (!fs.existsSync(resultsPath)) errors.push(diagnostic('MANUAL_RESULT', relative, 'results.json is missing; summary is not derived from Playwright'));
    }
    if (!summary) continue;
    const meta = readJson(metaFile);
    const tests = summary.tests ?? [];
    for (const item of summary.errors ?? []) {
      errors.push(diagnostic(item.code, `${relative}/${item.path}`, item.message));
    }
    addMissingVideoErrors({ directory, relative }, tests, errors);
    segments.push({ directory, relative, meta, summary, tests });
  }
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  segments.sort((a, b) =>
    compare(String(a.meta.phase), String(b.meta.phase)) ||
    compare(String(a.meta.label), String(b.meta.label)) ||
    compare(a.relative, b.relative)
  );

  const baselineSegments = segments.filter((segment) => segment.meta.phase === 'baseline');
  const retestSegments = segments.filter((segment) => segment.meta.phase === 'retest');
  const baselineRevisions = [...new Set(baselineSegments.map((segment) => segment.meta.revision).filter(Boolean))].sort();
  const baseRevisions = [...new Set(baselineSegments.map((segment) => segment.meta.baseRevision ?? null))];
  if (baseRevisions.length > 1) errors.push(diagnostic('REVISION_MISMATCH', runId, 'baseline segments have different base revisions'));
  const baseRevision = baseRevisions.length === 1 ? baseRevisions[0] : null;
  const baselineById = new Map();
  const retestById = new Map();
  const baselineRows = [];
  const retestRows = [];
  const gapTests = [];

  for (const segment of segments) {
    for (const test of segment.tests) {
      const id = testId(test);
      const isGap = id?.startsWith('WM-GAP-');
      if (!id) continue;
      const caseRecord = cases.find((item) => item.id === id);
      const row = annotateTest(test, segment, runDir, caseRecord, config);
      if (isGap) {
        const wikiRef = test.annotations?.find((annotation) => annotation.type === 'wiki')?.description ?? null;
        gapTests.push({ ...row, wikiRef, jiraKey: config.gap.jiraKey, jiraUrl: `${config.jiraBaseUrl}${config.gap.jiraKey}` });
        continue;
      }
      if (segment.meta.phase === 'baseline') {
        const list = baselineById.get(id) ?? [];
        list.push({ row, segment });
        baselineById.set(id, list);
        baselineRows.push(row);
      } else if (segment.meta.phase === 'retest') {
        const list = retestById.get(id) ?? [];
        list.push({ row, segment });
        retestById.set(id, list);
        retestRows.push(row);
        if (['failed', 'timedOut'].includes(row.status) && !isLinkedFix(id, segment, fixes)) {
          warnings.push(diagnostic('RETEST_REGRESSION', segment.relative, `${id} failed in retest without a matching fixes.json entry`));
        }
      }
    }
  }

  for (const [id, entries] of baselineById) {
    if (entries.length > 1) errors.push(diagnostic('DUPLICATE_OWNERSHIP', runId, `${id} appears in ${entries.length} baseline segments`));
  }
  for (const testCase of cases) {
    if (!(baselineById.get(testCase.id)?.length)) errors.push(diagnostic('MISSING_CASE', runId, `${testCase.id} has no baseline result`));
  }
  for (const fix of fixes) {
    const segment = retestSegments.find((item) => item.meta.label === fix.retestLabel);
    if (!segment || fix.fixRevision !== segment.meta.revision) {
      errors.push(diagnostic('FIX_UNLINKED', 'fixes.json', `fix ${fix.signature ?? fix.retestLabel} does not match a retest segment revision`));
    }
  }

  const caseSummaries = cases.map((item) => {
    const baselineEntries = baselineById.get(item.id) ?? [];
    const baseline = baselineEntries[0]?.row ?? null;
    const retests = (retestById.get(item.id) ?? []).sort((a, b) =>
      compare(String(a.segment.meta.finishedAt ?? ''), String(b.segment.meta.finishedAt ?? '')) ||
      compare(String(a.segment.meta.label), String(b.segment.meta.label))
    );
    const latestRetest = retests.at(-1) ?? null;
    const baselineStatus = statusOf(baseline);
    const retestStatus = statusOf(latestRetest?.row);
    const linked = latestRetest ? isLinkedFix(item.id, latestRetest.segment, fixes) : false;
    let finalStatus = 'not-run';
    if (['failed', 'timedOut'].includes(retestStatus)) finalStatus = 'failing';
    else if (retestStatus === 'flaky' || baselineStatus === 'flaky') finalStatus = 'flaky';
    else if (baselineStatus === 'passed' && (!latestRetest || retestStatus === 'passed')) finalStatus = 'passed';
    else if (['failed', 'timedOut'].includes(baselineStatus) && retestStatus === 'passed' && linked) finalStatus = 'fixed';
    else if (retestStatus === 'passed' && ['failed', 'timedOut'].includes(baselineStatus)) finalStatus = 'failing';
    else if (!latestRetest && ['failed', 'timedOut'].includes(baselineStatus)) finalStatus = 'failing';
    if (latestRetest && linkedFixesFor(item.id, fixes).some((fix) => fix.retestLabel === latestRetest.segment.meta.label) && !['failed', 'timedOut'].includes(baselineStatus)) {
      warnings.push(diagnostic('RETEST_WITHOUT_BASELINE_FAILURE', latestRetest.segment.relative, `${item.id} was retested without a baseline failure`));
    }
    const linkedFixes = linkedFixesFor(item.id, fixes);
    const fixPrs = [...new Set([
      ...linkedFixes.map((fix) => fix.prUrl),
      ...(latestRetest?.segment.meta.fixPr ? [latestRetest.segment.meta.fixPr] : [])
    ].filter(Boolean))];
    return {
      id: item.id,
      title: item.title ?? baseline?.title ?? '',
      area: config.areas.find((area) => area.feature === item.feature)?.area ?? baseline?.area ?? '',
      feature: item.feature ?? baseline?.feature ?? '',
      jiraKey: item.jiraKey ?? baseline?.jiraKey ?? '',
      jiraUrl: item.jiraUrl ?? baseline?.jiraUrl ?? '',
      testPath: baseline?.testPath ?? latestRetest?.row.testPath ?? null,
      initialStatus: baselineStatus,
      initialRecording: baseline?.primaryRecording ?? null,
      fixPr: fixPrs[0] ?? null,
      fixPrs,
      retestStatus: latestRetest ? retestStatus : null,
      retestRecording: latestRetest?.row.primaryRecording ?? null,
      finalStatus,
      baseline,
      retest: latestRetest?.row ?? null
    };
  });
  const gapCountByStatus = gapTests.reduce((counts, gap) => {
    counts[gap.status] = (counts[gap.status] ?? 0) + 1;
    return counts;
  }, {});
  const summary = {
    total: caseSummaries.length,
    passed: caseSummaries.filter((item) => item.finalStatus === 'passed').length,
    fixed: caseSummaries.filter((item) => item.finalStatus === 'fixed').length,
    failing: caseSummaries.filter((item) => item.finalStatus === 'failing').length,
    flaky: caseSummaries.filter((item) => item.finalStatus === 'flaky').length,
    notRun: caseSummaries.filter((item) => item.finalStatus === 'not-run').length,
    gapTests: gapTests.length,
    gapCounts: gapCountByStatus
  };
  const finishedDates = segments.map((segment) => segment.meta.finishedAt).filter(Boolean).sort();
  const generated = generatedAt ?? finishedDates.at(-1) ?? null;
  const seeds = segments.map((segment) => segment.meta.seed).filter(Boolean);
  const apiRevisions = [...new Set(segments.map((segment) => segment.meta.apiRevision ?? 'unknown'))].sort();
  const apiRevision = apiRevisions.length === 0 ? 'unknown' : apiRevisions.length === 1 ? apiRevisions[0] : apiRevisions;
  const fixRevisions = [...new Set([
    ...fixes.map((fix) => fix.fixRevision),
    ...retestSegments.map((segment) => segment.meta.revision)
  ].filter(Boolean))].sort();
  const report = {
    schema: 1,
    runId,
    baselineRevisions,
    apiRevision: apiRevision ?? 'unknown',
    baseRevision,
    fixRevisions,
    seed: seeds[0] ?? null,
    invocations: segments.map((segment) => ({ phase: segment.meta.phase, label: segment.meta.label, argv: segment.meta.invocation?.argv ?? [], env: segment.meta.invocation?.env ?? {} })),
    attemptCounts: {
      total: segments.reduce((count, segment) => count + segment.tests.reduce((sum, test) => sum + (test.attempts?.length ?? 0), 0), 0),
      byStatus: segments.flatMap((segment) => segment.tests.flatMap((test) => test.attempts ?? []))
        .reduce((counts, attempt) => {
          counts[attempt.status] = (counts[attempt.status] ?? 0) + 1;
          return counts;
        }, {})
    },
    generatedAt: generated,
    summary,
    baselineRows: baselineRows.sort((a, b) => compare(a.id, b.id)),
    retestRows: retestRows.sort((a, b) => compare(a.id, b.id) || compare(a.label, b.label)),
    cases: caseSummaries,
    gapTests: gapTests.sort((a, b) => compare(a.id, b.id)),
    errors: sortedDiagnostics(errors),
    warnings: sortedDiagnostics(warnings)
  };
  fs.mkdirSync(runDir, { recursive: true });
  writeJson(path.join(runDir, 'report.json'), report);
  fs.writeFileSync(path.join(runDir, 'report.md'), renderMarkdown(report));
  fs.writeFileSync(path.join(runDir, 'index.html'), renderHtml(report));
  return { report, errors: report.errors, warnings: report.warnings };
}

function walkFilesSync(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walkFilesSync(fullPath, predicate));
    else if (entry.isFile() && predicate(fullPath)) result.push(fullPath);
  }
  return result;
}
