import fs from 'node:fs';
import path from 'node:path';
import { diagnostic, loadAreas, relativeDisplay, repoRoot, sortedDiagnostics, walkFiles } from './common.mjs';

const prefixPattern = /^\[(WM-TC-\d{3}|WM-GAP-\d{3})\]\s+(.+)$/;
const forbiddenPattern = /\.(skip|fixme|fail|only)\s*\(/g;

function specEntries(list, result = [], parentFile = '') {
  for (const suite of list?.suites ?? []) {
    const suiteFile = suite.file ?? parentFile;
    for (const spec of suite.specs ?? []) {
      result.push({
        title: spec.title ?? '',
        file: suiteFile || spec.file || '',
        line: spec.line ?? null,
        annotations: (spec.tests ?? []).flatMap((test) => test.annotations ?? [])
      });
    }
    specEntries(suite, result, suiteFile);
  }
  return result;
}

function resolveArea(config, areaValue, featureValue) {
  if (areaValue) return config.areas.find((area) => area.area === areaValue || area.feature === areaValue);
  if (featureValue) return config.areas.find((area) => area.area === featureValue || area.feature === featureValue);
  return null;
}

export async function validateSuite({
  workbook,
  list,
  config = loadAreas(),
  root = repoRoot,
  casesFile = 'qa/cases.json',
  areas = [],
  features = []
}) {
  const errors = [];
  const warnings = [];
  const addError = (code, message, file = 'qa/tests') => errors.push(diagnostic(code, file, message));
  const cases = workbook?.cases ?? [];
  const caseMap = new Map(cases.map((item) => [item.id, item]));
  const requested = [...areas, ...features];
  const selectedAreas = [];
  for (const requestedArea of requested) {
    const area = resolveArea(config, requestedArea);
    if (!area) addError('UNKNOWN_AREA', `unknown area "${requestedArea}"`);
    else if (!selectedAreas.some((item) => item.area === area.area)) selectedAreas.push(area);
  }
  const selectedSlugs = requested.length
    ? new Set(selectedAreas.map((area) => area.area))
    : new Set(config.areas.map((area) => area.area));
  const selectedCases = cases.filter((item) => {
    const area = config.areas.find((candidate) => candidate.feature === item.feature);
    return area && selectedSlugs.has(area.area);
  });
  const caseCounts = new Map(selectedCases.map((item) => [item.id, []]));
  const selectedSpecs = new Set(config.areas.filter((area) => selectedSlugs.has(area.area)).map((area) => area.spec));
  const gapCounts = new Map();

  for (const spec of specEntries(list)) {
    const listedFile = spec.file.replace(/\\/g, '/');
    const specPath = path.isAbsolute(spec.file)
      ? spec.file
      : path.resolve(root, listedFile.startsWith('qa/tests/') ? listedFile : path.join('qa/tests', listedFile));
    const file = relativeDisplay(specPath, root);
    if (requested.length && !selectedSpecs.has(file)) continue;
    const match = spec.title.match(prefixPattern);
    if (!match) {
      addError('UNTAGGED_TEST', `test title must begin with [WM-TC-NNN] or [WM-GAP-NNN]: ${spec.title}`, file);
      continue;
    }
    const [, id, title] = match;
    if (id.startsWith('WM-TC-')) {
      const foundCase = caseMap.get(id);
      if (!foundCase) {
        addError('UNKNOWN_CASE', `unknown case id ${id}`, file);
        continue;
      }
      const caseArea = config.areas.find((area) => area.feature === foundCase.feature);
      if (!caseArea) {
        addError('CASE_AREA', `${id} has unknown feature "${foundCase.feature}"`, file);
        continue;
      }
      if (!selectedSlugs.has(caseArea.area)) continue;
      caseCounts.get(id)?.push({ title: spec.title, file });
      if (file !== caseArea.spec) addError('WRONG_SPEC', `${id} belongs in ${caseArea.spec}`, file);
      if (spec.title !== `[${id}] ${foundCase.title}`) {
        addError('TITLE_MISMATCH', `${id} title must be "[${id}] ${foundCase.title}"`, file);
      }
    } else {
      const annotationArea = spec.annotations.find((item) => item.type === 'area')?.description;
      const annotationFeature = spec.annotations.find((item) => item.type === 'feature')?.description;
      const gapArea = resolveArea(config, annotationArea, annotationFeature);
      if (!gapArea) {
        addError('GAP_FEATURE', `${id} has non-canonical area or feature`, file);
        continue;
      }
      if (gapArea.spec !== file) {
        addError('GAP_WRONG_FILE', `${id} for ${gapArea.area} belongs in ${gapArea.spec}`, file);
      }
      if (!selectedSlugs.has(gapArea.area)) continue;
      gapCounts.set(id, (gapCounts.get(id) ?? 0) + 1);
      if (gapCounts.get(id) > 1) addError('DUPLICATE_GAP', `duplicate gap id ${id}`, file);
      if (!title.trim()) addError('GAP_TITLE', `${id} requires a title`, file);
    }
  }

  for (const [id, entries] of caseCounts) {
    if (entries.length === 0) addError('MISSING_CASE', `${id} has no test`);
    if (entries.length > 1) addError('DUPLICATE_CASE_TEST', `${id} has ${entries.length} tests`);
  }

  const specs = (await walkFiles(path.join(root, 'qa/tests'), (file) => file.endsWith('.spec.ts')))
    .filter((file) => !requested.length || selectedSpecs.has(relativeDisplay(file, root)));
  for (const specFile of specs) {
    const relative = relativeDisplay(specFile, root);
    const source = fs.readFileSync(specFile, 'utf8');
    if (!/from\s+['"]\.\.\/tooling\/fixtures['"]/.test(source)) {
      addError('FIXTURE_IMPORT', 'spec must import from ../tooling/fixtures', relative);
    }
    for (const match of source.matchAll(forbiddenPattern)) {
      addError('FORBIDDEN_TEST_API', `.${match[1]}() is forbidden`, relative);
    }
  }

  return {
    errors: sortedDiagnostics(errors),
    warnings: sortedDiagnostics(warnings),
    caseCount: selectedCases.length,
    areas: requested.length ? selectedAreas.map((area) => area.area) : [],
    gapCount: [...gapCounts.values()].reduce((total, count) => total + count, 0),
    caseFile: casesFile
  };
}

export function suiteSuccessMessage(result) {
  if (result.areas?.length === 1) {
    return `OK ${result.caseCount}/${result.caseCount} ${result.areas[0]} cases, ${result.gapCount} gap tests`;
  }
  if (result.areas?.length > 1) {
    return `OK ${result.caseCount}/${result.caseCount} ${result.areas.join(', ')} cases, ${result.gapCount} gap tests`;
  }
  return `OK ${result.caseCount}/${result.caseCount} cases, ${result.gapCount} gap tests`;
}
