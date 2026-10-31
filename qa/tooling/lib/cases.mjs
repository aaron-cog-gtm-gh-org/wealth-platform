import { diagnostic, loadAreas, relativeDisplay, sortedDiagnostics } from './common.mjs';

export function validateCases(workbook, { config = loadAreas(), file = 'qa/cases.json', cwd = process.cwd() } = {}) {
  const errors = [];
  const warnings = [];
  const displayPath = relativeDisplay(file, cwd);
  const addError = (code, message, casePath = displayPath) => errors.push(diagnostic(code, casePath, message));

  if (!workbook || typeof workbook !== 'object' || !Array.isArray(workbook.cases)) {
    addError('INVALID_WORKBOOK', 'expected an object with a cases array');
    return { errors: sortedDiagnostics(errors), warnings };
  }

  for (const key of Object.keys(workbook)) {
    if (key !== 'cases') warnings.push(diagnostic('UNKNOWN_TOP_LEVEL_KEY', displayPath, `unknown top-level key "${key}"`));
  }
  if (workbook.cases.length !== config.totalCases) {
    addError('CASE_COUNT', `expected ${config.totalCases} cases, found ${workbook.cases.length}`);
  }

  const seen = new Map();
  const perArea = new Map(config.areas.map((area) => [area.area, []]));
  const caseRegex = new RegExp(config.casePattern);

  for (const [index, item] of workbook.cases.entries()) {
    const itemPath = `${displayPath}#${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      addError('INVALID_CASE', 'expected a case object', itemPath);
      continue;
    }
    const id = item.id;
    if (typeof id !== 'string' || !caseRegex.test(id)) {
      addError('INVALID_ID', `id must match ${config.casePattern}`, itemPath);
    } else {
      if (seen.has(id)) addError('DUPLICATE_ID', `duplicate case id ${id}`, itemPath);
      else seen.set(id, index);
    }

    const area = config.areas.find((candidate) => candidate.feature === item.feature);
    if (!area) {
      addError('UNKNOWN_FEATURE', `unknown feature "${String(item.feature)}"`, itemPath);
    } else {
      if (item.feature !== area.feature) {
        addError('FEATURE_LABEL', `expected canonical feature label "${area.feature}"`, itemPath);
      }
      perArea.get(area.area).push(item);
      if (item.jiraKey !== area.jiraKey) addError('JIRA_KEY', `expected Jira key ${area.jiraKey}`, itemPath);
      if (item.jiraUrl !== `${config.jiraBaseUrl}${area.jiraKey}`) {
        addError('JIRA_URL', `expected Jira URL ${config.jiraBaseUrl}${area.jiraKey}`, itemPath);
      }
      if (typeof id === 'string' && caseRegex.test(id)) {
        const number = Number(id.slice('WM-TC-'.length));
        if (number < area.first || number > area.last) {
          addError('ID_OUT_OF_RANGE', `${id} is outside ${area.feature} range ${area.first}-${area.last}`, itemPath);
        }
      }
    }

    for (const field of ['title', 'priority']) {
      if (typeof item[field] !== 'string' || !item[field].trim()) {
        addError('REQUIRED_STRING', `${field} must be a non-empty string`, itemPath);
      }
    }
    if (typeof item.priority === 'string' && !['Critical', 'High', 'Medium', 'Low'].includes(item.priority)) {
      addError('PRIORITY', 'priority must be Critical, High, Medium, or Low', itemPath);
    }
    if (typeof item.preconditions !== 'string') addError('PRECONDITIONS', 'preconditions must be a string', itemPath);
    if (typeof item.testData !== 'string') addError('TEST_DATA', 'testData must be a string', itemPath);
    if (!Array.isArray(item.steps) || item.steps.length === 0) {
      addError('STEPS', 'steps must be a non-empty array', itemPath);
    } else {
      for (const [stepIndex, step] of item.steps.entries()) {
        if (!step || typeof step !== 'object' ||
            typeof step.action !== 'string' || !step.action.trim() ||
            typeof step.expected !== 'string' || !step.expected.trim()) {
          addError('STEP_FIELDS', `steps[${stepIndex}] requires non-empty action and expected strings`, itemPath);
        }
      }
    }
    for (const key of Object.keys(item)) {
      if (!['id', 'feature', 'title', 'jiraKey', 'jiraUrl', 'priority', 'preconditions', 'testData', 'steps'].includes(key)) {
        warnings.push(diagnostic('UNKNOWN_CASE_KEY', itemPath, `unknown case key "${key}"`));
      }
    }
  }

  for (const area of config.areas) {
    const items = perArea.get(area.area);
    if (items.length !== area.count) {
      addError('AREA_COUNT', `${area.feature} expected ${area.count} cases, found ${items.length}`);
    }
    const numbers = new Set(items.map((item) => Number(String(item.id).slice('WM-TC-'.length))));
    for (let number = area.first; number <= area.last; number += 1) {
      if (!numbers.has(number)) addError('MISSING_AREA_ID', `missing WM-TC-${String(number).padStart(3, '0')} in ${area.feature}`);
    }
  }

  return { errors: sortedDiagnostics(errors), warnings: sortedDiagnostics(warnings) };
}

export function caseSuccessMessage(config = loadAreas()) {
  const counts = config.areas.map((area) => `${area.feature} ${area.count}`).join(', ');
  return `OK ${config.totalCases} cases (${counts})`;
}
