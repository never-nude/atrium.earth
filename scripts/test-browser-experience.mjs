import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { serveBrowserChecks } from './serve-browser-checks.mjs';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const artifacts = process.env.BROWSER_REPORT_DIR || 'test-results/browser';
const routes = [
  { id: 'homepage', path: '/', primary: '#v3-home-title' },
  { id: 'collection', path: '/collection/', primary: 'main h1' },
  { id: 'artwork', path: '/works/discobolus/', primary: '#v3-object-title' },
  { id: 'exhibition', path: '/exhibitions/the-work-of-the-surface/', primary: 'main h1' },
  { id: 'guided-visit', path: '/exhibitions/the-work-of-the-surface/#curated-visit', primary: '[data-visit-active] [data-visit-stop-heading]' },
  { id: 'world', path: '/world/', primary: '#world-title', prepare: async page => {
    await page.locator('[data-world-place] option').nth(1).waitFor({ state: 'attached' });
  } },
  { id: 'exhibition-entry', path: '/exhibitions/bodies-in-motion/', primary: '.v3-exhero__begin' },
  { id: 'missing', path: '/atrium-browser-check-missing/', primary: '#missing-title', status: 404 },
];
const viewports = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

function measurePage(phone) {
  const alpha = color => {
    if (color === 'transparent') return 0;
    return color.startsWith('rgba(') ? Number(color.slice(5, -1).split(',').at(-1)) : 1;
  };
  const hiddenContent = 'template, [hidden], [inert], [aria-hidden="true"]';
  const visible = element => {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 2 || bounds.height <= 2 || element.closest(hiddenContent)) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility !== 'visible' || style.opacity === '0') return false;
    }
    return true;
  };
  const name = element => (element.getAttribute('aria-label') || element.textContent || element.tagName)
    .trim().replace(/\s+/g, ' ').slice(0, 100);
  const sameColors = [];
  const smallTargets = [];
  for (const element of document.querySelectorAll('a[href], button, summary, input:not([type="hidden"]), select')) {
    if (!visible(element)) continue;
    const style = getComputedStyle(element);
    if (element.matches('a[href], button') && !element.disabled && element.textContent.trim()) {
      for (let node = element; node; node = node.parentElement) {
        const paint = getComputedStyle(node);
        if (paint.backgroundImage !== 'none') break;
        if (alpha(paint.backgroundColor) === 0) continue;
        if (alpha(paint.backgroundColor) === 1 && style.color === paint.backgroundColor) {
          sameColors.push({ label: name(element), element: element.className, color: style.color });
        }
        break;
      }
    }
    if (phone) {
      const { width, height } = element.getBoundingClientRect();
      if (width < 44 || height < 44) smallTargets.push({ label: name(element), width: Math.round(width), height: Math.round(height) });
    }
  }
  const smallText = [];
  if (phone) for (const element of document.querySelectorAll('body *')) {
    const directText = [...element.childNodes].map(node => node.nodeType === Node.TEXT_NODE ? node.textContent : '').join('').trim();
    if (!directText || !visible(element) || getComputedStyle(element).clipPath !== 'none') continue;
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    if (fontSize < 12) smallText.push({ text: directText.replace(/\s+/g, ' ').slice(0, 100), fontSize });
  }
  return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), sameColors, smallTargets, smallText };
}

const hosted = process.env.BROWSER_CHECK_ORIGIN ? null : await serveBrowserChecks();
const origin = process.env.BROWSER_CHECK_ORIGIN || hosted.origin;
const selected = routes.filter(route => !process.env.BROWSER_CHECK_ROUTE || route.id === process.env.BROWSER_CHECK_ROUTE);
if (!selected.length) throw new Error('Unknown browser check route');
await mkdir(artifacts, { recursive: true });
const results = [];

async function check(engine, viewport, route, browser) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width === 390 });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const problems = [];
  const result = { engine: engine.name(), viewport, route: route.id, problems };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const location = message.location().url;
    if (route.status === 404 && location === new URL(route.path, origin).href && /404/.test(message.text())) return;
    errors.push(`${message.text()} ${location}`.trim());
  });
  try {
    // External analytics must not make a static-site smoke check fail.
    await page.route('https://cloud.umami.is/**', route => route.fulfill({ status: 204 }));
    const response = await page.goto(new URL(route.path, origin).href, { waitUntil: 'domcontentloaded' });
    if (response?.status() !== (route.status ?? 200)) problems.push(`HTTP ${response?.status() ?? 'no response'}`);
    if (route.prepare) await route.prepare(page);
    await page.locator(route.primary).waitFor({ state: 'visible' });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]));
    await page.addScriptTag({ path: axePath });
    const axe = await page.evaluate(async () => {
      const { violations } = await window.axe.run();
      return violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({
        id: item.id, impact: item.impact,
        nodes: item.nodes.map(node => ({ target: node.target, failure: node.failureSummary })),
      }));
    });
    Object.assign(result, await page.evaluate(measurePage, viewport.width === 390), { axe });
    if (result.overflow > 1) problems.push(`Horizontal overflow ${result.overflow}px`);
    if (result.sameColors.length) problems.push(`Text matches its background: ${result.sameColors.map(item => item.label).join(', ')}`);
    if (axe.length) problems.push(`axe: ${axe.map(item => `${item.id} (${item.nodes.length})`).join(', ')}`);
    try {
      await page.screenshot({ path: join(artifacts, `${engine.name()}-${viewport.width}-${route.id}.png`), timeout: 15000 });
    } catch (error) {
      result.screenshotError = error.message;
    }
  } catch (error) {
    problems.push(error.message);
  } finally {
    if (errors.length) problems.push(...new Set(errors));
    results.push(result);
    console.log(`${result.engine} ${viewport.width} ${route.id}: ${problems.length ? problems.join(' | ') : 'pass'}${viewport.width === 390 && result.smallText ? ` (${result.smallText.length} small text, ${result.smallTargets.length} small targets)` : ''}`);
    await context.close();
  }
}

try {
  for (const engine of [chromium, webkit].filter(engine => !process.env.BROWSER_CHECK_ENGINE || engine.name() === process.env.BROWSER_CHECK_ENGINE)) {
    const browser = await engine.launch();
    try {
      for (const viewport of viewports) {
        for (const route of selected) await check(engine, viewport, route, browser);
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await hosted?.close();
  await writeFile(join(artifacts, 'report.json'), JSON.stringify(results, null, 2) + '\n');
}
if (results.some(result => result.problems.length)) process.exitCode = 1;
