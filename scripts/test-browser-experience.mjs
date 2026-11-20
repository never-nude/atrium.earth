import { mkdir, readFile, readdir } from 'node:fs/promises';
import { renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import sharp from 'sharp';
import { serveBrowserChecks } from './serve-browser-checks.mjs';
import { readBrowserModel } from './lib/browser-model-relay.mjs';
import { requestCdnResource } from './lib/cdn-http2-request.mjs';
import { browserDeadline, runBoundedBrowserCase, BROWSER_CLEANUP_TIMEOUT_MS, BROWSER_SUITE_TIMEOUT_MS } from './lib/browser-check-runner.mjs';
import { AUTO_START_MODEL_LIMIT, INLINE_AUTO_LOAD_LIMIT, isWithinInitialPreviewBudget, requiresModelActivation } from '../src/lib/viewer-preview.mjs';
import { firstViewFor } from '../src/lib/first-view-models.mjs';
import catalog from '../src/data/catalog.json' with { type: 'json' };
import recentAdditionPicks from '../src/data/recent-addition-picks.json' with { type: 'json' };
import firstViewModels from '../src/data/first-view-models.json' with { type: 'json' };
import originals from '../src/data/previews.json' with { type: 'json' };
import spatialCollection from '../public/spatial-museum/collection-manifest.json' with { type: 'json' };

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const artifacts = process.env.BROWSER_REPORT_DIR || 'test-results/browser';
const detailOriginal = originals.discobolus;
const rodinRoom = spatialCollection.rooms.find(room => room.id === 'rodin-marble');
const largeArtworkSlug = 'renaissance/piero-medici-mino-smk-cast';
const largeOriginal = originals[largeArtworkSlug];
const largeFirstView = firstViewFor(largeArtworkSlug, largeOriginal, firstViewModels[largeArtworkSlug]);
const largeDetailPath = `/detail/${largeArtworkSlug}/`;
const routes = [
  { id: 'homepage', path: '/', primary: '#v3-home-title', viewers: 'main [data-viewer]' },
  { id: 'collection', path: '/collection/', primary: 'main h1', prepare: page => page.locator('[data-studio-sort]').waitFor() },
  { id: 'ar-vr', path: '/ar-vr/', primary: 'main h1' },
  { id: 'newest', path: '/newest/', primary: '[data-additions-sort] select' },
  { id: 'wings', path: '/wings/', primary: 'main h1' },
  { id: 'artwork', path: '/works/discobolus/', primary: '#v3-object-title', viewers: '#sculpture [data-viewer]' },
  { id: 'photograph', path: '/works/americas/clytie-rinehart-met/', primary: '#v3-object-title', photograph: true },
  { id: 'full-detail', path: '/detail/discobolus/', primary: '#detail-title', expectedModels: [detailOriginal] },
  {
    id: 'spatial-museum', path: '/spatial-museum/?room=rodin-marble',
    primary: '.museum-shell.is-entered .gallery-canvas canvas',
    axeScope: '.gallery-canvas',
    expectedModels: rodinRoom.slugs.map(slug => originals[slug]),
  },
  { id: 'large-artwork', path: `/works/${largeArtworkSlug}/${largeFirstView ? '' : '#ar-vr'}`, primary: '#v3-object-title', largeModel: true },
  { id: 'exhibition', path: '/exhibitions/the-work-of-the-surface/', primary: 'main h1' },
  { id: 'what-survives', path: '/exhibitions/what-survives/', primary: 'main h1' },
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
  if (phone) {
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = texts.nextNode(); node; node = texts.nextNode()) {
      const element = node.parentElement;
      const text = node.textContent.trim();
      if (!text || element.closest('script,style,noscript,template,[hidden]')) continue;
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
      if (fontSize >= 12) continue;
      range.selectNode(node);
      if (![...range.getClientRects()].some(rect => rect.width > 1 && rect.height > 1)) continue;
      let visibleText = true;
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.visibility !== 'visible' || style.opacity === '0' || style.display === 'none'
          || (style.clipPath !== 'none' && ancestor.getBoundingClientRect().width <= 2)) {
          visibleText = false;
          break;
        }
      }
      if (visibleText) smallText.push({ text: text.replace(/\s+/g, ' ').slice(0, 100), fontSize });
    }
  }
  return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), sameColors, toggleContrast, smallTargets, smallText };
}

const dist = process.env.BROWSER_CHECK_DIST || 'dist';
let hosted, origin, localOrigin;
const selected = routes.filter(route => !process.env.BROWSER_CHECK_ROUTE || route.id === process.env.BROWSER_CHECK_ROUTE);
if (!selected.length) throw new Error('Unknown browser check route');
await mkdir(artifacts, { recursive: true });
const results = [];
const browserServers = new Set();
const specifications = [chromium, webkit]
  .filter(engine => !process.env.BROWSER_CHECK_ENGINE || engine.name() === process.env.BROWSER_CHECK_ENGINE)
  .flatMap(engine => viewports.flatMap(viewport => [
    ...selected.map(route => ({ engine, viewport, route, motion: 'reduce' })),
    ...selected.filter(route => route.viewers || route.largeModel || route.id === 'world')
      .map(route => ({ engine, viewport, route, motion: 'no-preference' })),
  ]));
const caseId = ({ engine, viewport, route, motion }) => `${engine.name()}-${viewport.width}-${route.id}-${motion}`;
function saveReport() {
  const file = join(artifacts, 'report.json');
  writeFileSync(file + '.tmp', JSON.stringify(results, null, 2) + '\n');
  renameSync(file + '.tmp', file);
}
function killBrowser(server) {
  const child = server?.process();
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  // Playwright launches detached process groups on POSIX. Kill only this
  // owned browser's group, including its renderer children, as its launcher does.
  if (process.platform !== 'win32') {
    try { process.kill(-child.pid, 'SIGKILL'); return; }
    catch (error) { if (error.code === 'ESRCH') return; }
  }
  child.kill('SIGKILL');
}
// A hard outer watchdog also covers stalled browser cleanup or protocol calls.
// Persist the active failure and every unrun case before terminating this run.
const suiteTimer = setTimeout(() => {
  const message = `Whole browser suite timed out after ${BROWSER_SUITE_TIMEOUT_MS} ms (no retry)`;
  for (const result of results.filter(result => result.status !== 'passed' && result.status !== 'failed')) {
    result.problems.push(message);
    result.failures ||= [];
    result.failures.push({ phase: result.phase, message, code: 'BROWSER_SUITE_TIMEOUT' });
    result.status = 'failed';
  }
  for (const specification of specifications) if (!results.some(result => result.id === caseId(specification))) {
    results.push({ id: caseId(specification), engine: specification.engine.name(), viewport: specification.viewport,
      route: specification.route.id, motion: specification.motion, status: 'not-run', phase: 'suite-timeout', problems: [message] });
  }
  if (!results.some(result => result.problems.includes(message))) {
    results.push({ id: 'suite', status: 'failed', phase: 'suite-timeout', problems: [message] });
  }
  console.error(message);
  try { saveReport(); }
  finally {
    for (const server of browserServers) {
      try { killBrowser(server); } catch (error) { console.error(`Browser hard kill failed: ${error.message}`); }
    }
    try { requestCdnResource.close(); } catch (error) { console.error(`CDN transport close failed: ${error.message}`); }
    process.exit(1);
  }
}, BROWSER_SUITE_TIMEOUT_MS);
function modelPath(url) {
  const path = new URL(url, origin).pathname;
  try { return decodeURIComponent(path); } catch { return path; }
}

function isLargeOriginal(url) {
  const requested = new URL(url, origin);
  const canonical = new URL(largeOriginal.url, origin);
  return requested.href === canonical.href
    || (requested.origin === new URL(origin).origin && modelPath(requested.href) === `/__atrium-model/${largeArtworkSlug}`);
}

function observeModelRequests(page, requests) {
  const seen = new Map();
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  page.on('request', request => {
    if (!/^\/(?:models\/(?:previews|first-views)\/|__atrium-(?:model|first-view)\/)/.test(modelPath(request.url()))) return;
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

function waitForExpectedModels(page, records) {
  const pending = new Map();
  const outcomes = records.map(({ url }) => new Promise((resolve, reject) => {
    pending.set(new URL(url, origin).href, { resolve, reject });
  }));
  let timer;
  function cleanup() {
    clearTimeout(timer);
    page.off('request', requested);
    page.off('requestfinished', finished);
    page.off('requestfailed', failed);
    page.off('close', closed);
  }
  function stop(reason) {
    for (const waiting of pending.values()) waiting.reject(new Error(reason));
    pending.clear();
    cleanup();
  }
  function arm() {
    clearTimeout(timer);
    timer = setTimeout(() => stop(`No expected model delivery activity for 45 seconds. Pending: ${[...pending.keys()].join(', ')}`), 45000);
  }
  function requested(request) {
    if (pending.has(request.url())) arm();
  }
  function finished(request) {
    const waiting = pending.get(request.url());
    if (!waiting) return;
    waiting.resolve(request);
    pending.delete(request.url());
    if (pending.size) arm();
    else cleanup();
  }
  function failed(request) {
    if (pending.has(request.url())) stop(`First model request failed: ${request.url()} ${request.failure()?.errorText}`);
  }
  function closed() {
    stop('Page closed before all expected models were delivered');
  }
  page.on('request', requested);
  page.on('requestfinished', finished);
  page.on('requestfailed', failed);
  page.on('close', closed);
  arm();
  return Promise.allSettled(outcomes);
}

async function checkExpectedModels(deliveries, records, requests) {
  const outcomes = await deliveries;
  return Promise.all(outcomes.map(async (outcome, index) => {
    const { url, bytes } = records[index];
    if (outcome.status === 'rejected') throw outcome.reason;
    const matching = requests.filter(request => request.url === new URL(url, origin).href);
    const response = outcome.status === 'fulfilled' ? await outcome.value.response() : null;
    const length = Number(response?.headers()['content-length']);
    if (matching.length !== 1 || response?.status() !== 200 || length !== bytes) {
      throw new Error(`First model delivery attempt failed for ${url}. Expected one HTTP 200 response and ${bytes} bytes; received ${JSON.stringify(matching)} with Content-Length ${length}.`);
    }
    return { url, bytes, status: response.status() };
  }));
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

async function waitForReadyModel(page, viewer, modelRequests) {
  try {
    const terminal = await page.waitForFunction(element => {
      const state = element.dataset.viewerState;
      return ['ready', 'error'].includes(state) ? state : false;
    }, await viewer.elementHandle(), { timeout: 45000 });
    if (await terminal.jsonValue() !== 'ready') throw new Error('Viewer reported a model error');
  } catch (error) {
    throw new Error(`First model attempt failed. ${error.message} ${JSON.stringify(await viewerState(viewer, modelRequests))}`);
  }
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
    await waitForReadyModel(page, viewer, result.modelRequests);
    const earlyStart = await viewer.getAttribute('data-start-before-still') !== null;
    if (earlyStart ? route.id !== 'artwork' || !isWithinInitialPreviewBudget(modelBytes)
      : await viewer.getAttribute('data-still-painted') !== 'true') {
      throw new Error('The viewer violated its still-image loading policy');
    }
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
  try {
    await page.waitForFunction(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))),
    ), undefined, { polling: 100, timeout: 15000 });
  } catch (error) {
    throw new Error(`First gate paint timed out. ${error.message} ${JSON.stringify(await viewerState(viewer, modelRequests))}`);
  }
  const state = await viewerState(viewer, modelRequests);
  if (state.state !== 'idle' || state.requests.length || await viewer.locator('canvas.viewer-canvas').count()) {
    throw new Error(`Model started without a tap. ${JSON.stringify(state)}`);
  }
  return button;
}

async function checkHeavyArtwork(page, result) {
  const viewer = page.locator('#sculpture [data-viewer]');
  if (largeFirstView) {
    const initial = await viewerState(viewer, result.modelRequests);
    const expectedPaths = [modelPath(largeFirstView.url)];
    if (largeFirstView.url.startsWith('https://')) expectedPaths.push(`/__atrium-first-view/${largeArtworkSlug}`);
    if (!expectedPaths.includes(modelPath(initial.model)) || Number(initial.bytes) !== largeFirstView.bytes
      || await viewer.getAttribute('data-model-activation') === 'tap'
      || await viewer.locator('[data-load-model]').count()) {
      throw new Error(`The work page must open the verified first view automatically. ${JSON.stringify(initial)}`);
    }
    if (await viewer.locator('[data-spatial]').count()) throw new Error('The lightweight geometry must not be used for AR / VR');
    const link = page.locator('[data-full-detail]');
    const label = (await link.textContent()).trim();
    const detail = new URL(await link.getAttribute('href'), origin);
    if (detail.origin !== new URL(origin).origin || detail.pathname !== largeDetailPath || !label.includes(`${(largeOriginal.bytes / 1e6).toFixed(1)} MB`)) {
      throw new Error(`Full detail must link to the original route and disclose the original size: ${label} ${detail.href}`);
    }
    await viewer.locator('[data-stage]').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await waitForReadyModel(page, viewer, result.modelRequests);
    const state = await viewerState(viewer, result.modelRequests);
    if (state.requests.length !== 1 || state.requests[0].status !== 200 || result.modelRequests.some(request => isLargeOriginal(request.url))) {
      throw new Error(`The work page must fetch only its first view once. ${JSON.stringify(result.modelRequests)}`);
    }
    result.firstView = { modelBytes: largeFirstView.bytes, transfer: state.requests[0] };
    detail.hash = 'ar-vr';
    const response = await page.goto(detail.href, { waitUntil: 'domcontentloaded' });
    if (response?.status() !== 200) throw new Error(`Original detail route returned HTTP ${response?.status() ?? 'no response'}`);
    await page.locator('#detail-title').waitFor({ state: 'visible' });
    await page.addScriptTag({ path: axePath });
  }
  const bytes = Number(await viewer.getAttribute('data-model-bytes'));
  if (bytes !== largeOriginal.bytes || bytes <= INLINE_AUTO_LOAD_LIMIT
    || !isLargeOriginal(await viewer.locator('[data-stage]').getAttribute('data-glb'))) {
    throw new Error('Piero no longer exercises the canonical large-model threshold');
  }
  const button = await checkModelGate(page, viewer, result.modelRequests);
  const spatial = viewer.locator('[data-spatial-open]');
  await spatial.waitFor({ state: 'visible' });
  if (!(await spatial.textContent())?.includes(`${(bytes / 1e6).toFixed(1)} MB`)
    || await viewer.locator('[data-spatial-dialog][open]').count()
    || result.modelRequests.some(request => isLargeOriginal(request.url))) {
    throw new Error('An AR / VR deep link must keep the original tap-gated and disclose its size');
  }
  result.manualCheck = { modelBytes: bytes, label: (await button.textContent()).trim(), beforeTapRequests: 0 };
  if (result.motion !== 'no-preference') return;
  const request = page.waitForRequest(req => isLargeOriginal(req.url()));
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
  const phone = page.viewportSize().width === 390;
  if (phone) await viewer.evaluate(element => { element.requestFullscreen = undefined; });
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
  if (phone && !await viewer.evaluate(element => {
    const background = [...document.querySelectorAll('[data-viewer-background]')];
    return element.hasAttribute('data-viewer-expanded') && background.some(node => node.matches('header'))
      && background.every(node => node.inert && getComputedStyle(node).opacity === '0');
  })) {
    throw new Error('Mobile full screen must hide the surrounding page layers');
  }
  await viewer.getByRole('button', { name: 'Exit full screen', exact: true }).click();
  await page.waitForFunction(element => (
    document.fullscreenElement !== element && !element.hasAttribute('data-viewer-expanded')
    && element.querySelector('[data-tool-fullscreen]').getAttribute('aria-pressed') === 'false'
  ), root);
  if (await canvas.evaluate(element => getComputedStyle(element).touchAction) !== 'auto') {
    throw new Error('Artwork full screen did not restore normal inline scrolling on exit');
  }
  if (phone && await page.locator('[data-viewer-background]').count()) {
    throw new Error('Leaving mobile full screen must restore the surrounding page layers');
  }
}

async function check(engine, viewport, route, motion = 'reduce') {
  let browserServer, browser, context, page;
  const errors = [];
  const problems = [];
  const id = caseId({ engine, viewport, route, motion });
  const result = { id, engine: engine.name(), viewport, route: route.id, motion, problems, modelRequests: [] };
  const resultIndex = results.push(result) - 1;
  const prefix = join(artifacts, `${engine.name()}-${viewport.width}-${route.id}${motion === 'reduce' ? '' : '-motion'}`);
  const checkpoint = () => {
    if (errors.length) problems.push(...new Set(errors));
    problems.splice(0, problems.length, ...new Set(problems));
    // Timed-out promise losers can settle later. Keep completed reports detached
    // from their page listeners and mutable in-flight measurement objects.
    if (result.phase === 'complete') {
      result.status = problems.length ? 'failed' : 'passed';
      results[resultIndex] = structuredClone(result);
    }
    saveReport();
  };
  await runBoundedBrowserCase({
    id, result, checkpoint,
    run: async (phase, isRunning) => {
      await phase('launch browser server', async () => {
        const launched = await engine.launchServer();
        if (!isRunning()) {
          void browserDeadline(() => launched.kill(), 2000, 'Late browser launch cleanup').catch(() => killBrowser(launched));
          throw new Error('Browser launched after its case stopped');
        }
        browserServer = launched;
        browserServers.add(launched);
      });
      await phase('connect browser', async () => { browser = await engine.connect(browserServer.wsEndpoint(), { timeout: 30000 }); });
      await phase('create context', async () => {
        context = await browser.newContext({ viewport, reducedMotion: motion, hasTouch: viewport.width === 390 });
      });
      await phase('create page', async () => { page = await context.newPage(); });
      page.setDefaultTimeout(20000);
      observeModelRequests(page, result.modelRequests);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() !== 'error') return;
        const location = message.location().url;
        if (route.status === 404 && location === new URL(route.path, origin).href && /404/.test(message.text())) return;
        errors.push(`${message.text()} ${location}`.trim());
      });
      await phase('page checks', async () => {
        // External analytics must not make a static-site smoke check fail.
        await page.route('https://cloud.umami.is/**', route => route.fulfill({ status: 204 }));
        // The model CDN permits Atrium's origin. Serve its original bytes to loopback QA.
        if (localOrigin) await page.route(/^https:\/\/models\.atrium\.earth\/models\/(?:previews|first-views)\/.+\.glb$/, async route => {
          try {
            const response = await readBrowserModel(route.request().url(), { timeout: 15000 });
            await route.fulfill({ ...response, headers: { ...response.headers, 'access-control-allow-origin': new URL(origin).origin } });
          } catch (error) {
            errors.push(`First model delivery attempt failed for ${route.request().url()}: ${error.message}`);
            await route.abort().catch(() => {});
          }
        });
        if (route.largeModel) {
          await page.route(
            url => isLargeOriginal(url.href),
            route => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': new URL(origin).origin } }),
          );
        }
        const expectedDeliveries = route.expectedModels && waitForExpectedModels(page, route.expectedModels);
        const response = await phase('navigation', () => page.goto(new URL(route.path, origin).href, { waitUntil: 'domcontentloaded' }));
        if (response?.status() !== (route.status ?? 200)) problems.push(`HTTP ${response?.status() ?? 'no response'}`);
        if (route.prepare) await phase('route preparation', () => route.prepare(page));
        await page.locator(route.primary).waitFor({ state: 'visible' });
        await phase('font readiness', () => page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))])));
        await phase('install axe', () => page.addScriptTag({ path: axePath }));
        Object.assign(result, await phase('page measurements', () => page.evaluate(measurePage, viewport.width === 390)));
        await phase('route behaviour', async () => {
          if (route.id === 'collection') {
            const search = page.locator('[data-v3-search]');
            const count = page.locator('[data-v3-count]');
            await search.fill('roman discobolus');
            await page.locator('[data-v3-filter-form] button[type="submit"]').click();
            await page.waitForFunction(() => {
              const grid = document.querySelector('[data-v3-grid]');
              return grid?.getAttribute('aria-busy') !== 'true'
                && document.querySelector('[data-v3-count]')?.textContent.includes('for “roman discobolus”');
            });
            if (!await page.locator('[data-v3-card] a[href*="/works/discobolus/"]').count()) {
              throw new Error('Roman Discobolus search must show the matching work');
            }
            if (new URL(page.url()).searchParams.get('q') !== 'roman discobolus') {
              throw new Error('Submitting search must preserve the query in the address');
            }
            await search.fill('no-matching-atrium-work-992');
            await search.press('Enter');
            await page.locator('[data-v3-empty]').waitFor({ state: 'visible' });
            if (!(await count.textContent()).includes('no-matching-atrium-work-992')) {
              throw new Error('An empty result must identify the submitted query');
            }
            await page.locator('[data-v3-empty-reset]').click();
            await page.waitForFunction(() => {
              const input = document.querySelector('[data-v3-search]');
              return input?.value === '' && !document.querySelector('[data-v3-grid]')?.hidden
                && !new URL(location.href).searchParams.has('q');
            });
          } else if (route.id === 'newest') {
            const expectedPicks = recentAdditionPicks.filter(slug => catalog.some(work => work.slug === slug && !work.hidden) && originals[slug]);
            const actualPicks = await page.locator('[aria-labelledby="recent-picks-title"] [data-v3-card] > a:first-child')
              .evaluateAll(links => links.map(link => new URL(link.href).pathname.slice('/works/'.length).replace(/\/$/, '')));
            if (JSON.stringify([...actualPicks].sort()) !== JSON.stringify([...expectedPicks].sort())) {
              throw new Error('Newest Additions must retain every public pinned pick as new imports arrive');
            }
            const sort = page.locator('[data-additions-sort] select');
            if (await sort.inputValue() !== 'newest') throw new Error('Newest Additions must open in date-added order');
            await sort.selectOption('date-latest');
            const sorted = await page.locator('[data-additions-grid]').evaluateAll(grids => grids.length > 0 && grids.every(grid => {
              const years = [...grid.querySelectorAll('[data-year]')].map(card => card.dataset.year === '' ? -Infinity : Number(card.dataset.year));
              return years.every((year, index) => index === 0 || years[index - 1] >= year);
            }));
            if (!sorted || new URL(page.url()).searchParams.get('sort') !== 'date-latest') {
              throw new Error('Newest Additions must sort each section by artwork date and preserve the choice in the address');
            }
          } else if (route.id === 'full-detail') {
            const viewer = page.locator('#sculpture [data-viewer]');
            const state = await viewerState(viewer, result.modelRequests);
            if (new URL(state.model, origin).href !== new URL(detailOriginal.url, origin).href
              || Number(state.bytes) !== detailOriginal.bytes) {
              throw new Error(`Full detail must load the original Discobolus scan. ${JSON.stringify(state)}`);
            }
            await viewer.locator('[data-stage]').scrollIntoViewIfNeeded();
            await waitForReadyModel(page, viewer, result.modelRequests);
          } else if (route.id === 'spatial-museum') {
            const room = await page.locator('.route-current').textContent();
            if (!room.includes(rodinRoom.title)) throw new Error(`The museum did not open the Rodin room. ${room}`);
          } else if (route.photograph) {
            await page.waitForFunction(() => {
              const image = document.querySelector('#sculpture [data-poster]');
              return image?.complete && image.naturalWidth > 1 && image.naturalHeight > 1;
            });
            const image = page.locator('#sculpture [data-poster]');
            if (!(await image.getAttribute('src')).includes('/images/artworks/americas/clytie-rinehart-met/image.jpg')) {
              throw new Error('Photograph artwork must display its full image, not a model poster or thumbnail');
            }
            if (result.modelRequests.length || await page.locator('#sculpture [data-glb]:not([data-glb=""]), #sculpture [data-load-model], #sculpture [data-immersive-tools], #sculpture [data-spatial], #sculpture [data-spatial-unavailable]').count()) {
              throw new Error('Photograph artwork must not request a model or offer 3D/AR controls');
            }
            await page.locator('#object-record').evaluate(element => { element.open = true; });
            if (!await page.locator('#object-record a[rel="license"]').count()
              || !await page.locator('.work-context a[href]').count()) {
              throw new Error('Photograph artwork must retain image rights and researched sources');
            }
          } else if (route.largeModel) {
            await phase('large artwork behaviour', () => checkHeavyArtwork(page, result));
          } else if (route.id === 'exhibition' && viewport.width === 390) {
            const offscreen = page.locator('main [data-viewer][data-model-activation="tap"]').last();
            if (!await offscreen.count()) throw new Error('The Surface exhibition no longer exercises an offscreen large sculpture');
            const initial = await viewerState(offscreen, result.modelRequests);
            if (initial.viewport.top < initial.viewport.height || initial.requests.length) throw new Error(`Large offscreen model has an unexpected initial state. ${JSON.stringify(initial)}`);
            await checkModelGate(page, offscreen, result.modelRequests);
          } else if (motion === 'no-preference') {
            result.readyCanvases = [];
            await phase('motion and canvas checks', () => inspectMotion(page, route, prefix, result));
          }
        });
        if (expectedDeliveries) {
          result.verifiedModels = await phase('expected model deliveries', () => checkExpectedModels(expectedDeliveries, route.expectedModels, result.modelRequests));
        }
        result.axe = await phase('axe audit', () => page.evaluate(async selector => {
          const { violations } = await window.axe.run(selector || document);
          return violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({
            id: item.id, impact: item.impact,
            nodes: item.nodes.map(node => ({ target: node.target, failure: node.failureSummary })),
          }));
        }, route.largeModel ? '#sculpture [data-viewer]' : route.axeScope ?? null));
        if (result.overflow > 1) problems.push(`Horizontal overflow ${result.overflow}px`);
        if (result.sameColors.length) problems.push(`Text matches its background: ${result.sameColors.map(item => item.label).join(', ')}`);
        if (result.axe.length) problems.push(`axe: ${result.axe.map(item => `${item.id} (${item.nodes.length})`).join(', ')}`);
        for (const measurement of [result, ...(result.readyCanvases ?? [])]) {
          if (measurement.smallText.length) {
            const examples = measurement.smallText.slice(0, 4).map(({ text, fontSize }) => `“${text}” ${fontSize}px`);
            problems.push(`${measurement.smallText.length} visible text runs below 12px (${examples.join(', ')})`);
          }
          for (const item of measurement.toggleContrast.filter(item => item.ratio < 4.5)) {
            problems.push(`${item.label} pressed contrast ${item.ratio.toFixed(2)}:1 (< 4.5:1)`);
          }
          if (measurement === result) continue;
          if (measurement.overflow > 1) problems.push(`Ready canvas page overflow ${measurement.overflow}px`);
          if (measurement.sameColors.length) problems.push(`Ready canvas text matches its background: ${measurement.sameColors.map(item => item.label).join(', ')}`);
        }
        try {
          await phase('page screenshot', () => page.screenshot({ path: `${prefix}.png`, timeout: 15000 }));
        } catch (error) {
          result.screenshotError = error.message;
          problems.push(`Screenshot failed: ${error.message}`);
        }
      });
    },
    cleanup: async phase => {
      await phase('route cleanup', () => page?.unrouteAll({ behavior: 'wait' }));
      await phase('context close', () => context?.close());
      await phase('browser connection close', () => browser?.close());
      await phase('browser process close', () => browserServer?.close());
    },
    forceKill: () => browserServer?.kill(),
    hardKill: () => killBrowser(browserServer),
  });
  const deliveries = result.verifiedModels?.length
    ? ` | ${result.verifiedModels.length} model deliveries verified` : '';
  console.log(`${result.engine} ${viewport.width} ${route.id} ${motion}: ${problems.length ? problems.join(' | ') : 'pass'}${viewport.width === 390 && result.smallText ? ` (${result.smallText.length} small text, ${result.smallTargets.length} small targets)` : ''}${deliveries}`);
}

async function checkPublishedJpegCatalog() {
  const hashes = JSON.parse(await readFile(join(dist, 'previews/cdn-jpegs.json'), 'utf8'));
  const publicSlugs = new Set(catalog.filter(work => !work.hidden).map(work => work.slug));
  const slugs = Object.keys(hashes);
  const unpublished = slugs.filter(slug => !publicSlugs.has(slug));
  if (unpublished.length) throw new Error(`Unpublished work slugs in the built CDN JPEG map: ${unpublished.join(', ')}`);
  if (!slugs.length) throw new Error('No public work slugs in the built CDN JPEG map');
  console.log(`Verified the built CDN JPEG map contains ${slugs.length.toLocaleString('en')} public work slugs.`);
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
  console.log('START suite: static server and built preflight');
  hosted = process.env.BROWSER_CHECK_ORIGIN ? null : await serveBrowserChecks(dist);
  origin = process.env.BROWSER_CHECK_ORIGIN || hosted.origin;
  localOrigin = ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname);
  saveReport();
  if (hosted) {
    await checkPublishedJpegCatalog();
    await checkPublishedViewerMarkup();
  }
  for (const { engine, viewport, route, motion } of specifications) await check(engine, viewport, route, motion);
} finally {
  saveReport();
  try { requestCdnResource.close(); }
  catch (error) { results.push({ id: 'suite-transport-cleanup', status: 'failed', phase: 'transport close', problems: [error.message] }); }
  try {
    console.log('START suite: static server cleanup');
    await browserDeadline(() => hosted?.close(), BROWSER_CLEANUP_TIMEOUT_MS, 'Static server cleanup');
  } catch (error) {
    results.push({ id: 'suite-cleanup', status: 'failed', phase: 'static server cleanup', problems: [error.message] });
  } finally {
    for (const server of browserServers) {
      try { killBrowser(server); }
      catch (error) { results.push({ id: 'suite-browser-cleanup', status: 'failed', phase: 'hard kill', problems: [error.message] }); }
    }
    saveReport();
    clearTimeout(suiteTimer);
  }
}
if (results.length !== specifications.length || results.some(result => result.status !== 'passed' || result.problems.length)) process.exitCode = 1;
