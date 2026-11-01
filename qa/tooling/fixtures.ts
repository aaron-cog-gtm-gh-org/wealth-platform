import { readFileSync } from 'node:fs';
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

type CaseRecord = {
  id: string;
  feature: string;
  title: string;
  jiraUrl: string;
  priority: string;
};

type AreasConfig = {
  jiraBaseUrl: string;
  gap: { jiraKey: string };
  areas: Array<{ area: string; feature: string }>;
};

const casesPath = new URL('../cases.json', import.meta.url);
const areasPath = new URL('./areas.json', import.meta.url);
let cases: CaseRecord[];
let areas: AreasConfig;

try {
  cases = (JSON.parse(readFileSync(casesPath, 'utf8')) as { cases: CaseRecord[] }).cases;
  areas = JSON.parse(readFileSync(areasPath, 'utf8')) as AreasConfig;
} catch (error) {
  throw new Error(`Unable to load QA cases or areas config: ${(error as Error).message}`, { cause: error });
}

const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));
const areaSlugs = new Set(areas.areas.map((area) => area.area));
const areaForFeature = (feature: string) => areas.areas.find((area) => area.feature === feature);

type TestBody = (args: { page: Page }, testInfo: TestInfo) => void | Promise<void>;
type GapOptions = { title: string; area?: string; feature?: string; wikiRef: string };

export const caseTest = (id: string, body: TestBody) => {
  const testCase = byId.get(id);
  if (!testCase) throw new Error(`Unknown QA case id "${id}" in qa/cases.json`);
  const area = areaForFeature(testCase.feature);
  if (!area) throw new Error(`Unknown QA feature "${testCase.feature}" for ${id}`);
  return test(
    `[${id}] ${testCase.title}`,
    {
      annotation: [
        { type: 'case', description: id },
        { type: 'area', description: area.area },
        { type: 'feature', description: testCase.feature },
        { type: 'jira', description: testCase.jiraUrl },
        { type: 'priority', description: testCase.priority }
      ]
    },
    body
  );
};

export const gapTest = (id: string, options: GapOptions, body: TestBody) => {
  const pattern = /^WM-GAP-\d{3}$/;
  if (!pattern.test(id)) throw new Error(`Invalid gap id "${id}"`);
  const area = areas.areas.find((candidate) =>
    candidate.area === options.area || candidate.area === options.feature || candidate.feature === options.feature
  );
  if (!area) throw new Error(`Unknown QA area "${options.area ?? options.feature}"`);
  const jiraUrl = `${areas.jiraBaseUrl}${areas.gap.jiraKey}`;
  return test(
    `[${id}] ${options.title}`,
    {
      annotation: [
        { type: 'case', description: id },
        { type: 'area', description: area.area },
        { type: 'feature', description: area.feature },
        { type: 'jira', description: jiraUrl },
        { type: 'wiki', description: options.wikiRef }
      ]
    },
    body
  );
};

type QaFixtures = { demoCursor: void; qaReset: void; qaAfterScreenshot: void };

function installDemoCursor() {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    .pointer{position:absolute;left:0;top:0;width:22px;height:22px;opacity:0;transform:translate(-30px,-30px);
      transition:transform .16s ease-out,opacity .1s;filter:drop-shadow(0 1px 2px #002147)}
    .pointer:before{content:'';display:block;width:14px;height:14px;border:2px solid #003168;
      border-radius:50%;background:#ffd200;box-shadow:0 0 0 2px white}
    .pointer.down:after{content:'';position:absolute;left:-7px;top:-7px;width:28px;height:28px;
      border:3px solid #ffd200;border-radius:50%;box-shadow:0 0 0 1px #003168}
  </style><div class="pointer"></div>`;
  const pointer = shadow.querySelector<HTMLElement>('.pointer')!;
  let release: number | undefined;
  const mount = () => { if (!host.isConnected) document.documentElement.append(host); };
  window.addEventListener('mousemove', (event) => {
    mount();
    pointer.style.opacity = '1';
    pointer.style.transform = `translate(${event.clientX - 7}px,${event.clientY - 7}px)`;
  }, true);
  window.addEventListener('mousedown', () => {
    pointer.classList.add('down');
    window.clearTimeout(release);
    release = window.setTimeout(() => pointer.classList.remove('down'), 450);
  }, true);
}

export const test = base.extend<QaFixtures>({
  demoCursor: [async ({ context }, use) => {
    await context.addInitScript(installDemoCursor);
    await use();
  }, { auto: true }],
  qaReset: [
    async ({ request }, use) => {
      const apiUrl = process.env.QA_API_URL ?? 'http://localhost:3001';
      const resetPath = process.env.QA_RESET_PATH ?? '/api/test/reset';
      try {
        const response = await request.post(new URL(resetPath, apiUrl).toString());
        if (!response.ok()) throw new Error(String(response.status()));
      } catch (error) {
        throw new Error(`QA reset failed: ${(error as Error).message}`, { cause: error });
      }
      await use();
    },
    { auto: true }
  ],
  qaAfterScreenshot: [
    async ({ page }, use, testInfo) => {
      await use();
      if (!page.isClosed()) {
        await page.waitForTimeout(800);
        await testInfo.attach('after.png', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png'
        });
      }
    },
    { auto: true }
  ]
});

export const openArea = async (
  page: Page,
  area: string,
  extraQuery?: string | URLSearchParams | Record<string, string>
) => {
  if (!areaSlugs.has(area)) throw new Error(`Unknown QA area "${area}"`);
  const query = new URLSearchParams({ screen: 'workspace', area });
  if (typeof extraQuery === 'string') {
    const additional = new URLSearchParams(extraQuery.replace(/^\?/, ''));
    additional.forEach((value, key) => query.set(key, value));
  } else if (extraQuery instanceof URLSearchParams) {
    extraQuery.forEach((value, key) => query.set(key, value));
  } else if (extraQuery) {
    Object.entries(extraQuery).forEach(([key, value]) => query.set(key, value));
  }
  await page.goto(`/?${query.toString()}`);
  await page.waitForLoadState('load');
  await test.info().attach('before.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  await page.waitForTimeout(500);
};

export { expect };
