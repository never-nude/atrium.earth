import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import sharp from 'sharp';
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
    await page.locator('[data-world-state="ready"] button[data-world-place]:visible').first().waitFor();
  } },
  { id: 'exhibition-entry', path: '/exhibitions/bodies-in-motion/', primary: '.v3-exhero__begin' },
  { id: 'missing', path: '/atrium-browser-check-missing/', primary: '#missing-title', status: 404 },
];
const viewports = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
const motionRoutes = new Set(['homepage', 'artwork', 'world']);

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
  const toggleContrast = [];
  const luminance = channels => channels.slice(0, 3).reduce((sum, value, index) => {
    const s = value / 255;
    return sum + [0.2126, 0.7152, 0.0722][index] * (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
  }, 0);
  const channels = value => /^rgba?\(/.test(value) ? value.match(/[\d.]+/g).map(Number) : [];
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
        if (alpha(paint.backgroundColor) === 1 && element.matches('.immersive-tools button[aria-pressed="true"]')) {
          const background = channels(paint.backgroundColor);
          const text = channels(style.color);
          if (background.length >= 3 && text.length >= 3) {
            const opacity = text[3] ?? 1;
            const [dark, light] = [luminance(text.slice(0, 3).map((color, i) => color * opacity + background[i] * (1 - opacity))), luminance(background)].sort((a, b) => a - b);
            const ratio = (light + 0.05) / (dark + 0.05);
            toggleContrast.push({ label: name(element), ratio, foreground: style.color, background: paint.backgroundColor });
          }
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
  return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), sameColors, toggleContrast, smallTargets, smallText };
}

const hosted = process.env.BROWSER_CHECK_ORIGIN ? null : await serveBrowserChecks();
const origin = process.env.BROWSER_CHECK_ORIGIN || hosted.origin;
const localOrigin = ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname);
const selected = routes.filter(route => !process.env.BROWSER_CHECK_ROUTE || route.id === process.env.BROWSER_CHECK_ROUTE);
if (!selected.length) throw new Error('Unknown browser check route');
await mkdir(artifacts, { recursive: true });
const results = [];

async function captureCanvas(canvas, file) {
  await canvas.waitFor({ state: 'visible' });
  await canvas.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const bounds = await canvas.boundingBox();
  const viewport = canvas.page().viewportSize();
  const x = Math.max(0, Math.ceil(bounds.x));
  const y = Math.max(0, Math.ceil(bounds.y));
  const clip = {
    x, y,
    width: Math.floor(Math.min(viewport.width, bounds.x + bounds.width)) - x,
    height: Math.floor(Math.min(viewport.height, bounds.y + bounds.height)) - y,
  };
  if (clip.width < 10 || clip.height < 10) throw new Error(`Canvas has no visible area: ${file}`);
  // Hide sibling overlays (including map markers) so they cannot make a
  // uniformly broken canvas look detailed. Retain the stage's own backdrop.
  const savedStyles = await canvas.evaluateHandle(element => {
    const siblings = [...element.parentElement.children].filter(node => node !== element);
    const saved = [...siblings, element].map(node => [node, node.getAttribute('style')]);
    for (const node of siblings) node.style.setProperty('visibility', 'hidden', 'important');
    return saved;
  });
  let frame, backdrop;
  try {
    frame = await canvas.page().screenshot({ clip, path: file, timeout: 30000 });
    await canvas.evaluate(element => element.style.setProperty('opacity', '0', 'important'));
    backdrop = await canvas.page().screenshot({ clip, timeout: 30000 });
  } finally {
    await savedStyles.evaluate(saved => {
      for (const [node, style] of saved) {
        if (style === null) node.removeAttribute('style');
        else node.setAttribute('style', style);
      }
    });
    await savedStyles.dispose();
  }
  const decode = image => sharp(image).resize(96, 96, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const [pixels, blank] = await Promise.all([decode(frame), decode(backdrop)]);
  let differentPixels = 0;
  let variedPixels = 0;
  for (let index = 0; index < pixels.length; index += 3) {
    if ([0, 1, 2].some(channel => Math.abs(pixels[index + channel] - blank[index + channel]) > 8)) differentPixels++;
    if ([0, 1, 2].some(channel => Math.abs(pixels[index + channel] - pixels[channel]) > 8)) variedPixels++;
  }
  if (differentPixels < 20 || variedPixels < 20) throw new Error(`Canvas is blank or uniform (${differentPixels} pixels differ from backdrop): ${file}`);
  return { file, differentPixels, variedPixels };
}

async function inspectMotion(page, route, prefix, result) {
  const measure = () => page.evaluate(measurePage, result.viewport.width === 390);
  if (route.id === 'world') {
    const frame = await captureCanvas(page.locator('.world-globe canvas').first(), `${prefix}-globe.png`);
    result.readyCanvases.push({ ...frame, ...await measure() });
    return;
  }
  const viewers = route.id === 'homepage'
    ? page.locator('main [data-viewer][data-auto-start="preview"]')
    : page.locator('main [data-viewer][data-auto-start="false"]').first();
  const count = await viewers.count();
  if (!count) throw new Error('Expected inspectable 3D previews');
  for (let i = 0; i < count; i++) {
    const viewer = viewers.nth(i);
    await viewer.locator('[data-stage]').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (route.id === 'artwork') await viewer.getByRole('button', { name: /^Examine in 3D/ }).click();
    await page.waitForFunction(element => element.dataset.viewerState === 'ready', await viewer.elementHandle(), { timeout: 45000 });
    const frame = await captureCanvas(viewer.locator('.viewer-canvas'), `${prefix}-viewer-${i + 1}.png`);
    result.readyCanvases.push({ ...frame, ...await measure() });
  }
}

async function check(engine, viewport, route, browser, motion = 'reduce') {
  const context = await browser.newContext({ viewport, reducedMotion: motion, hasTouch: viewport.width === 390 });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const problems = [];
  const result = { engine: engine.name(), viewport, route: route.id, motion, problems };
  const prefix = join(artifacts, `${engine.name()}-${viewport.width}-${route.id}${motion === 'reduce' ? '' : '-motion'}`);
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
    // The model CDN permits Atrium's origin. Serve its original bytes to loopback QA.
    if (localOrigin) await page.route('https://models.atrium.earth/models/previews/**/*.glb', async route => {
      try {
        const response = await route.fetch({
          headers: { ...route.request().headers(), origin: 'https://atrium.earth' },
          timeout: 15000,
        });
        if (!response.ok()) errors.push(`Model preview returned HTTP ${response.status()}: ${route.request().url()}`);
        await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': new URL(origin).origin } });
      } catch (error) {
        errors.push(error.message);
        await route.abort().catch(() => {});
      }
    });
    const response = await page.goto(new URL(route.path, origin).href, { waitUntil: 'domcontentloaded' });
    if (response?.status() !== (route.status ?? 200)) problems.push(`HTTP ${response?.status() ?? 'no response'}`);
    if (route.prepare) await route.prepare(page);
    await page.locator(route.primary).waitFor({ state: 'visible' });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]));
    await page.addScriptTag({ path: axePath });
    Object.assign(result, await page.evaluate(measurePage, viewport.width === 390));
    if (motion === 'no-preference') {
      result.readyCanvases = [];
      await inspectMotion(page, route, prefix, result);
    }
    result.axe = await page.evaluate(async () => {
      const { violations } = await window.axe.run();
      return violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({
        id: item.id, impact: item.impact,
        nodes: item.nodes.map(node => ({ target: node.target, failure: node.failureSummary })),
      }));
    });
    if (result.overflow > 1) problems.push(`Horizontal overflow ${result.overflow}px`);
    if (result.sameColors.length) problems.push(`Text matches its background: ${result.sameColors.map(item => item.label).join(', ')}`);
    if (result.axe.length) problems.push(`axe: ${result.axe.map(item => `${item.id} (${item.nodes.length})`).join(', ')}`);
    for (const measurement of [result, ...(result.readyCanvases ?? [])]) {
      for (const item of measurement.toggleContrast.filter(item => item.ratio < 4.5)) {
        problems.push(`${item.label} pressed contrast ${item.ratio.toFixed(2)}:1 (< 4.5:1)`);
      }
      if (measurement === result) continue;
      if (measurement.overflow > 1) problems.push(`Ready canvas page overflow ${measurement.overflow}px`);
      if (measurement.sameColors.length) problems.push(`Ready canvas text matches its background: ${measurement.sameColors.map(item => item.label).join(', ')}`);
    }
    try {
      await page.screenshot({ path: `${prefix}.png`, timeout: 15000 });
    } catch (error) {
      result.screenshotError = error.message;
    }
  } catch (error) {
    problems.push(error.message);
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    if (errors.length) problems.push(...new Set(errors));
    problems.splice(0, problems.length, ...new Set(problems));
    results.push(result);
    console.log(`${result.engine} ${viewport.width} ${route.id} ${motion}: ${problems.length ? problems.join(' | ') : 'pass'}${viewport.width === 390 && result.smallText ? ` (${result.smallText.length} small text, ${result.smallTargets.length} small targets)` : ''}`);
    await context.close();
  }
}

try {
  for (const engine of [chromium, webkit].filter(engine => !process.env.BROWSER_CHECK_ENGINE || engine.name() === process.env.BROWSER_CHECK_ENGINE)) {
    const browser = await engine.launch();
    try {
      for (const viewport of viewports) {
        for (const route of selected) await check(engine, viewport, route, browser);
        for (const route of selected.filter(item => motionRoutes.has(item.id))) await check(engine, viewport, route, browser, 'no-preference');
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
