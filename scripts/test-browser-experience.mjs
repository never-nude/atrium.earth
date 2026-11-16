import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import sharp from 'sharp';
import { serveBrowserChecks } from './serve-browser-checks.mjs';
import { AUTO_START_MODEL_LIMIT, INLINE_AUTO_LOAD_LIMIT, requiresModelActivation } from '../src/lib/viewer-preview.mjs';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const artifacts = process.env.BROWSER_REPORT_DIR || 'test-results/browser';
const routes = [
  { id: 'homepage', path: '/', primary: '#v3-home-title', viewers: 'main [data-viewer]' },
  { id: 'collection', path: '/collection/', primary: 'main h1' },
  { id: 'artwork', path: '/works/discobolus/', primary: '#v3-object-title', viewers: '#sculpture [data-viewer]' },
  { id: 'large-artwork', path: '/works/renaissance/piero-medici-mino-smk-cast/#ar-vr', primary: '#v3-object-title', largeModel: true },
  { id: 'exhibition', path: '/exhibitions/the-work-of-the-surface/', primary: 'main h1' },
  { id: 'guided-visit', path: '/exhibitions/the-work-of-the-surface/#curated-visit', primary: '[data-visit-active] [data-visit-stop-heading]' },
  { id: 'world', path: '/world/', primary: '#world-title', prepare: async page => {
    await page.locator('[data-world-place] option').nth(1).waitFor({ state: 'attached' });
    await page.locator('[data-world-state="ready"] button[data-world-place]:visible').first().waitFor();
  } },
  {
    id: 'exhibition-entry', path: '/exhibitions/bodies-in-motion/', primary: '.v3-exhero__begin',
    viewers: '[data-exhibition-work="discobolus"] [data-viewer]',
  },
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

const dist = process.env.BROWSER_CHECK_DIST || 'dist';
const hosted = process.env.BROWSER_CHECK_ORIGIN ? null : await serveBrowserChecks(dist);
const origin = process.env.BROWSER_CHECK_ORIGIN || hosted.origin;
const localOrigin = ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname);
const selected = routes.filter(route => !process.env.BROWSER_CHECK_ROUTE || route.id === process.env.BROWSER_CHECK_ROUTE);
if (!selected.length) throw new Error('Unknown browser check route');
await mkdir(artifacts, { recursive: true });
const results = [];
const largeArtworkSlug = 'renaissance/piero-medici-mino-smk-cast';

function modelPath(url) {
  const path = new URL(url, origin).pathname;
  try { return decodeURIComponent(path); } catch { return path; }
}

function observeModelRequests(page, requests) {
  const seen = new Map();
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  page.on('request', request => {
    if (!/^\/(?:models\/previews\/|__atrium-model\/)/.test(modelPath(request.url()))) return;
    const entry = { url: request.url(), requestedMs: elapsed() };
    seen.set(request, entry);
    requests.push(entry);
  });
  page.on('response', response => {
    const entry = seen.get(response.request());
    if (entry) Object.assign(entry, { status: response.status(), responseMs: elapsed() });
  });
  page.on('requestfinished', request => {
    const entry = seen.get(request);
    if (entry) entry.finishedMs = elapsed();
  });
  page.on('requestfailed', request => {
    const entry = seen.get(request);
    if (entry) Object.assign(entry, { failure: request.failure()?.errorText, failedMs: elapsed() });
  });
}

async function viewerState(viewer, modelRequests) {
  const state = await viewer.evaluate(element => {
    const stage = element.querySelector('[data-stage]');
    const bounds = stage.getBoundingClientRect();
    return {
      model: stage.dataset.glb, bytes: element.dataset.modelBytes, state: element.dataset.viewerState,
      stillPainted: element.dataset.stillPainted, download: element.querySelector('[data-download-label]')?.textContent,
      viewport: { top: Math.round(bounds.top), bottom: Math.round(bounds.bottom), height: innerHeight },
    };
  });
  return { ...state, requests: modelRequests.filter(request => modelPath(request.url) === modelPath(state.model)) };
}

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
  const viewers = page.locator(route.viewers).filter({
    has: page.locator('[data-stage][data-glb]:not([data-glb=""])'),
  });
  const count = await viewers.count();
  if (!count) throw new Error('Expected a sculpture viewer to open automatically');
  for (let i = 0; i < count; i++) {
    const viewer = viewers.nth(i);
    if (route.id !== 'artwork') {
      await viewer.locator('[data-stage]').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    }
    const modelBytes = Number(await viewer.getAttribute('data-model-bytes'));
    const budgeted = route.id === 'homepage' && await viewer.evaluate(element =>
      Boolean(element.closest('.home-programme-hero, .featured-exhibition__viewer')),
    );
    if (budgeted && (!Number.isSafeInteger(modelBytes) || modelBytes <= 0 || modelBytes > AUTO_START_MODEL_LIMIT)) {
      throw new Error('A featured homepage sculpture exceeded its selection budget');
    }
    if (requiresModelActivation(modelBytes)) {
      await checkModelGate(page, viewer, result.modelRequests);
      continue;
    }
    try {
      const terminal = await page.waitForFunction(element => {
        const state = element.dataset.viewerState;
        return ['ready', 'error'].includes(state) ? state : false;
      }, await viewer.elementHandle(), { timeout: 45000 });
      if (await terminal.jsonValue() !== 'ready') throw new Error('Viewer reported a model error');
    } catch (error) {
      throw new Error(`First model attempt failed. ${error.message} ${JSON.stringify(await viewerState(viewer, result.modelRequests))}`);
    }
    if (await viewer.getAttribute('data-still-painted') !== 'true') throw new Error('The viewer started before its still painted');
    const canvas = viewer.locator('.viewer-canvas');
    const frame = await captureCanvas(canvas, `${prefix}-viewer-${i + 1}.png`);
    result.readyCanvases.push({ ...frame, modelBytes, ...await measure() });
    if (route.id === 'artwork') {
      const rotate = viewer.locator('[data-tool-rotate]');
      if (await rotate.getAttribute('aria-pressed') !== 'true') throw new Error('Artwork auto-rotation should be on by default');
      await checkArtworkFullscreen(page, viewer, canvas);
    }
  }
}

async function checkModelGate(page, viewer, modelRequests) {
  if (await viewer.getAttribute('data-model-activation') !== 'tap') throw new Error('A large model is missing the tap requirement');
  const stage = viewer.locator('[data-stage]');
  await stage.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await viewer.locator('[data-poster]').waitFor({ state: 'visible' });
  const button = viewer.locator('[data-load-model]');
  await button.waitFor({ state: 'visible' });
  const title = await button.textContent();
  const bytes = Number(await viewer.getAttribute('data-model-bytes'));
  if (Number.isSafeInteger(bytes) && bytes > 0 && !title?.includes(`${(bytes / 1e6).toFixed(1)} MB`)) {
    throw new Error(`The tap control does not disclose its ${bytes}-byte model size`);
  }
  // Let the hydrated in-view layout reach the same paint point as automatic starts.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await viewerState(viewer, modelRequests);
  if (state.state !== 'idle' || state.requests.length || await viewer.locator('canvas.viewer-canvas').count()) {
    throw new Error(`Model started without a tap. ${JSON.stringify(state)}`);
  }
  return button;
}

async function checkHeavyArtwork(page, result) {
  const viewer = page.locator('#sculpture [data-viewer]');
  const bytes = Number(await viewer.getAttribute('data-model-bytes'));
  if (!(bytes > INLINE_AUTO_LOAD_LIMIT)) throw new Error('Piero no longer exercises the large-model threshold');
  const button = await checkModelGate(page, viewer, result.modelRequests);
  result.manualCheck = { modelBytes: bytes, label: (await button.textContent()).trim(), beforeTapRequests: 0 };
  if (result.motion !== 'no-preference') return;
  const request = page.waitForRequest(req => modelPath(req.url()).includes(largeArtworkSlug));
  // The intercepted response is empty on purpose, so this proves the tap
  // reached the loader without transferring or allocating the 274 MB original.
  try {
    await Promise.all([request, result.viewport.width === 390 ? button.tap() : button.click()]);
    await page.waitForFunction(element => element.dataset.viewerState === 'error', await viewer.elementHandle());
  } catch (error) {
    throw new Error(`First tapped load did not reach the expected recovery state. ${error.message} ${JSON.stringify(await viewerState(viewer, result.modelRequests))}`);
  }
  await viewer.locator('[data-retry]').waitFor({ state: 'visible' });
  await viewer.locator('[data-poster]').waitFor({ state: 'visible' });
  result.manualCheck.requestsAfterTap = (await viewerState(viewer, result.modelRequests)).requests.length;
  if (result.manualCheck.requestsAfterTap !== 1) throw new Error('A single tap should issue one model request');
}

async function checkArtworkFullscreen(page, viewer, canvas) {
  const fullscreen = viewer.getByRole('button', { name: 'Full screen', exact: true });
  await fullscreen.click();
  const root = await viewer.elementHandle();
  await page.waitForFunction(element => (
    (document.fullscreenElement === element || element.hasAttribute('data-viewer-expanded'))
    && element.querySelector('[data-tool-fullscreen]').getAttribute('aria-pressed') === 'true'
  ), root);
  if (await canvas.evaluate(element => getComputedStyle(element).touchAction) !== 'none') {
    throw new Error('Artwork full screen is missing free sculpture handling');
  }
  await viewer.getByRole('button', { name: 'Exit full screen', exact: true }).click();
  await page.waitForFunction(element => (
    document.fullscreenElement !== element && !element.hasAttribute('data-viewer-expanded')
    && element.querySelector('[data-tool-fullscreen]').getAttribute('aria-pressed') === 'false'
  ), root);
  if (await canvas.evaluate(element => getComputedStyle(element).touchAction) !== 'auto') {
    throw new Error('Artwork full screen did not restore normal inline scrolling on exit');
  }
}

async function check(engine, viewport, route, browser, motion = 'reduce') {
  const context = await browser.newContext({ viewport, reducedMotion: motion, hasTouch: viewport.width === 390 });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const problems = [];
  const result = { engine: engine.name(), viewport, route: route.id, motion, problems, modelRequests: [] };
  observeModelRequests(page, result.modelRequests);
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
        errors.push(`First model delivery attempt failed for ${route.request().url()}: ${error.message}`);
        await route.abort().catch(() => {});
      }
    });
    if (route.largeModel) {
      await page.route(
        url => /^\/(?:models\/previews\/|__atrium-model\/)/.test(modelPath(url.href)) && modelPath(url.href).includes(largeArtworkSlug),
        route => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': new URL(origin).origin } }),
      );
    }
    const response = await page.goto(new URL(route.path, origin).href, { waitUntil: 'domcontentloaded' });
    if (response?.status() !== (route.status ?? 200)) problems.push(`HTTP ${response?.status() ?? 'no response'}`);
    if (route.prepare) await route.prepare(page);
    await page.locator(route.primary).waitFor({ state: 'visible' });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]));
    await page.addScriptTag({ path: axePath });
    Object.assign(result, await page.evaluate(measurePage, viewport.width === 390));
    if (route.largeModel) {
      await checkHeavyArtwork(page, result);
    } else if (route.id === 'exhibition' && viewport.width === 390) {
      const offscreen = page.locator('main [data-viewer][data-model-activation="tap"]').last();
      if (!await offscreen.count()) throw new Error('The Surface exhibition no longer exercises an offscreen large sculpture');
      const initial = await viewerState(offscreen, result.modelRequests);
      if (initial.viewport.top < initial.viewport.height || initial.requests.length) throw new Error(`Large offscreen model has an unexpected initial state. ${JSON.stringify(initial)}`);
      await checkModelGate(page, offscreen, result.modelRequests);
    } else if (motion === 'no-preference') {
      result.readyCanvases = [];
      await inspectMotion(page, route, prefix, result);
    }
    result.axe = await page.evaluate(async selector => {
      const { violations } = await window.axe.run(selector || document);
      return violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({
        id: item.id, impact: item.impact,
        nodes: item.nodes.map(node => ({ target: node.target, failure: node.failureSummary })),
      }));
    }, route.largeModel ? '#sculpture [data-viewer]' : null);
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

async function checkPublishedViewerMarkup() {
  const paths = await readdir(dist, { recursive: true });
  let stages = 0, routes = 0, manualStages = 0;
  for (const file of paths.filter(path => path.endsWith('.html'))) {
    const html = await readFile(join(dist, file), 'utf8');
    const viewers = html.match(/<[^>]+\bdata-stage\s[^>]*\bdata-glb="[^"]+"[^>]*>/g);
    if (!viewers) continue;
    const roots = [...html.matchAll(/<div[^>]*\bdata-viewer(?=[=\s>])[^>]*>/g)];
    let checked = 0;
    for (let i = 0; i < roots.length; i++) {
      const [tag] = roots[i];
      const fragment = html.slice(roots[i].index + tag.length, roots[i + 1]?.index ?? html.length);
      if (!/<[^>]+\bdata-stage\s[^>]*\bdata-glb="[^"]+"/.test(fragment)) continue;
      checked++;
      const bytes = Number(tag.match(/\bdata-model-bytes="([^"]+)"/)?.[1]);
      const needsTap = requiresModelActivation(bytes);
      const buttons = [...fragment.matchAll(/<button[^>]*\bdata-load-model(?=[=\s>])[^>]*>([\s\S]*?)<\/button>/g)];
      const retries = fragment.match(/<button[^>]*\bdata-retry\s[^>]*\bhidden(?:[=\s>])/g);
      if (/\bdata-model-activation="tap"/.test(tag) !== needsTap || buttons.length !== Number(needsTap)) {
        throw new Error(`Incorrect activation gate for a ${bytes}-byte model in ${file}`);
      }
      if (needsTap && Number.isSafeInteger(bytes) && bytes > 0 && !buttons[0][1].includes(`${(bytes / 1e6).toFixed(1)} MB`)) {
        throw new Error(`A gated model does not disclose its ${bytes}-byte size in ${file}`);
      }
      if (retries?.length !== 1) throw new Error(`An inline model is missing a hidden retry button in ${file}`);
      if (needsTap) manualStages++;
    }
    if (checked !== viewers.length) throw new Error(`Could not audit every inline model in ${file}`);
    stages += viewers.length;
    routes++;
  }
  if (!stages) throw new Error('The build contains no inspectable sculpture stages');
  console.log(`Checked ${stages} model stages across ${routes} built pages. ${manualStages} require a tap and ${stages - manualStages} open automatically.`);
}

try {
  if (hosted) await checkPublishedViewerMarkup();
  for (const engine of [chromium, webkit].filter(engine => !process.env.BROWSER_CHECK_ENGINE || engine.name() === process.env.BROWSER_CHECK_ENGINE)) {
    const browser = await engine.launch();
    try {
      for (const viewport of viewports) {
        for (const route of selected) await check(engine, viewport, route, browser);
        for (const route of selected.filter(item => item.viewers || item.largeModel || item.id === 'world')) await check(engine, viewport, route, browser, 'no-preference');
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
