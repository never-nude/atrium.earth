import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serveBrowserChecks } from './serve-browser-checks.mjs';
import { readBrowserModel } from './lib/browser-model-relay.mjs';
import { requiresModelActivation } from '../src/lib/viewer-preview.mjs';
import { firstViewFor } from '../src/lib/first-view-models.mjs';
import firstViewModels from '../src/data/first-view-models.json' with { type: 'json' };
import originals from '../src/data/previews.json' with { type: 'json' };

const suppliedOrigin = process.env.BROWSER_CHECK_ORIGIN;
const hosted = suppliedOrigin ? null : await serveBrowserChecks(process.env.BROWSER_CHECK_DIST);
const origin = new URL(suppliedOrigin ?? hosted.origin);
const local = ['localhost', '127.0.0.1'].includes(origin.hostname);
const home = { name: 'homepage', path: '/', viewer: '.home-programme-hero [data-viewer]' };
const artwork = { name: 'Discobolus artwork', path: '/works/discobolus/', viewer: '#sculpture [data-viewer]', firstViewSlug: 'discobolus' };
const thinker = { name: 'The Thinker artwork', path: '/works/rodin/the-thinker/', viewer: '#sculpture [data-viewer]' };
const exhibitionStop = {
  name: 'Bodies in Motion Discobolus',
  path: '/exhibitions/bodies-in-motion/',
  viewer: '[data-exhibition-work="discobolus"] [data-viewer]',
  firstViewSlug: 'discobolus',
};
const surface = {
  name: 'Surface exhibition',
  path: '/exhibitions/the-work-of-the-surface/',
  viewer: '.v3-exhero__viewer [data-viewer]',
};
const cases = [
  { route: home, touch: true },
  { route: artwork, touch: true },
  { route: surface, touch: true },
  { route: home, touch: false },
  { route: artwork, touch: false },
];
let failures = 0;

function fail(message) {
  failures++;
  console.error(`FAIL ${message}`);
}

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const modelTransfers = new WeakMap();

function modelPath(url) {
  const path = new URL(url, origin).pathname;
  try { return decodeURIComponent(path); } catch { return path; }
}

async function instrumentControls(page) {
  const transfers = new Map();
  modelTransfers.set(page, transfers);
  page.on('request', request => {
    if (!/^\/(?:models\/(?:previews|first-views)\/|__atrium-(?:model|first-view)\/)/.test(modelPath(request.url()))) return;
    transfers.set(request, { url: request.url(), started: performance.now() });
  });
  page.on('response', response => {
    const transfer = transfers.get(response.request());
    if (transfer) Object.assign(transfer, { status: response.status(), responseMs: Math.round(performance.now() - transfer.started) });
  });
  page.on('requestfinished', request => {
    const transfer = transfers.get(request);
    if (transfer) transfer.completedMs = Math.round(performance.now() - transfer.started);
  });
  page.on('requestfailed', request => {
    const transfer = transfers.get(request);
    if (transfer) Object.assign(transfer, { failedMs: Math.round(performance.now() - transfer.started), failure: request.failure()?.errorText });
  });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, options) {
      if (type !== 'webgl' && type !== 'webgl2') return getContext.call(this, type, options);
      // Read the rendered sculpture's alpha independently of production picking.
      const gl = getContext.call(this, type, { ...options, preserveDrawingBuffer: true });
      if (gl) this.__atriumTestGL = gl;
      return gl;
    };
    const scrollFrame = () => { window.__atriumTestLastScroll = performance.now(); };
    addEventListener('scroll', scrollFrame, { passive: true });
    addEventListener('touchstart', event => {
      const canvas = event.target.closest('canvas.viewer-canvas');
      if (!canvas) return;
      canvas.__atriumTestTouchStart = {
        event,
        ageOfScroll: performance.now() - (window.__atriumTestLastScroll ?? -Infinity),
      };
    }, { capture: true, passive: true });
  });
  await page.route(/\/(?:node_modules\/.*\/)?OrbitControls[^/]*\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const source = await response.text();
    const exported = source.match(/\b([\w$]+)\s+as\s+OrbitControls\b/)?.[1] ?? 'OrbitControls';
    // Observe Three's camera between input/render callbacks. Same-callback
    // damping flushes are restored before a frame can be drawn.
    const probe = `
const controls = ${exported}.prototype;
const update = controls.update;
controls.update = function (...args) {
  const changed = update.apply(this, args);
  if (this.domElement) {
    const el = this.domElement;
    const origin = this.target;
    const pose = {
      position: this.object.position.toArray(),
      target: origin.toArray(),
      distance: this.object.position.distanceTo(origin),
      rotating: this.autoRotate,
      frameTime: performance.now()
    };
    el.__atriumTestPose = pose;
    const trace = el.__atriumTestTrace;
    if (trace) {
      trace.raw.push(pose);
      queueMicrotask(() => {
        if (el.__atriumTestPose === pose && el.__atriumTestTrace === trace) trace.settled.push(pose);
      });
    }
  }
  return changed;
};
`;
    await route.fulfill({ response, body: source + '\n' + probe });
  });
  if (local) await page.route(/^https:\/\/models\.atrium\.earth\/models\/(?:previews|first-views)\/.+\.glb$/, async route => {
    try {
      const response = await readBrowserModel(route.request().url());
      await route.fulfill({ ...response, headers: { ...response.headers, 'access-control-allow-origin': origin.origin } });
    } catch (error) {
      const transfer = transfers.get(route.request());
      if (transfer) transfer.relayFailure = error.message;
      await route.abort().catch(() => {});
    }
  });
}

async function loadRoute(page, route) {
  modelTransfers.get(page)?.clear();
  const response = await page.goto(new URL(route.path, origin).href, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200);
  return page.locator(route.viewer);
}

async function checkFirstViewTransfer(page, viewer, slug) {
  const original = originals[slug];
  const firstView = firstViewFor(slug, original, firstViewModels[slug]);
  if (!firstView) return;
  const model = modelPath(await viewer.locator('[data-stage]').getAttribute('data-glb'));
  const validPaths = [modelPath(firstView.url)];
  if (firstView.url.startsWith('https://')) validPaths.push(`/__atrium-first-view/${slug}`);
  assert.ok(validPaths.includes(model), `${slug}: expected the first-view GLB and received ${model}`);
  assert.equal(Number(await viewer.getAttribute('data-model-bytes')), firstView.bytes);
  const transfers = [...modelTransfers.get(page).values()];
  const models = transfers.filter(transfer => modelPath(transfer.url) === model);
  assert.ok(models.some(model => model.status === 200), `${slug}: a first-view transfer must finish successfully`);
  assert.ok(!transfers.some(transfer => [modelPath(original.url), `/__atrium-model/${slug}`].includes(modelPath(transfer.url))),
    `${slug}: an inline first view must never request the original model`);
}

async function waitForViewer(page, viewer, { scroll = true } = {}) {
  if (scroll) await viewer.locator('[data-stage]').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const canvas = viewer.locator('canvas.viewer-canvas');
  try {
    const terminal = await page.waitForFunction(element => {
      const state = element.dataset.viewerState;
      return state === 'error' || (state === 'ready' && element.querySelector('canvas.viewer-canvas')?.__atriumTestPose)
        ? state : false;
    }, await viewer.elementHandle(), { timeout: 45000 });
    if (await terminal.jsonValue() !== 'ready') throw new Error('Viewer reported a model error');
    await canvas.waitFor({ state: 'visible' });
  } catch (error) {
    const state = await viewer.evaluate(element => {
      const stage = element.querySelector('[data-stage]');
      const bounds = stage.getBoundingClientRect();
      return {
        model: stage.dataset.glb, bytes: element.dataset.modelBytes, state: element.dataset.viewerState,
        stillPainted: element.dataset.stillPainted, download: element.querySelector('[data-download-label]')?.textContent,
        viewport: { top: Math.round(bounds.top), bottom: Math.round(bounds.bottom), height: innerHeight },
      };
    });
    const transfers = [...modelTransfers.get(page).values()].filter(entry => modelPath(entry.url) === modelPath(state.model));
    throw new Error(`First model attempt failed. ${error.message} ${JSON.stringify({ ...state, transfers })}`);
  }
  return canvas;
}

async function ready(page, route, { steady = true } = {}) {
  const viewer = await loadRoute(page, route);
  const canvas = await waitForViewer(page, viewer, { scroll: route !== artwork });
  if (!steady) return canvas;
  const rotate = viewer.locator('[data-tool-rotate]');
  await page.waitForFunction(element => element.getAttribute('aria-pressed') === 'false', await rotate.elementHandle());
  await settlePose(canvas);
  return canvas;
}

async function settlePose(canvas) {
  await canvas.evaluate(element => { element.__atriumTestStable = undefined; });
  await canvas.page().waitForFunction(element => {
    const pose = element.__atriumTestPose;
    const signature = JSON.stringify([pose.position, pose.target].map(vector => vector.map(value => value.toFixed(7))));
    const previous = element.__atriumTestStable;
    element.__atriumTestStable = {
      signature,
      frames: previous?.signature === signature ? previous.frames + 1 : 1,
    };
    return element.__atriumTestStable.frames >= 5;
  }, await canvas.elementHandle(), { timeout: 6000 });
}

const nextPaint = page => page.evaluate(() => new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

async function settleScroll(canvas) {
  await canvas.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await nextPaint(canvas.page());
  await canvas.page().waitForFunction(() => performance.now() - (window.__atriumTestLastScroll ?? 0) >= 190);
}

async function pointOn(canvas, kind) {
  const point = await canvas.evaluate((element, kind) => {
    const gl = element.__atriumTestGL;
    const bounds = element.getBoundingClientRect();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const needsArt = kind !== 'backdrop';
    const margin = needsArt ? 8 : 20;
    const left = Math.ceil(Math.max(bounds.left, 0) + margin);
    const right = Math.floor(Math.min(bounds.right, innerWidth) - margin);
    const top = Math.ceil(Math.max(bounds.top, 110) + margin);
    const bottom = Math.floor(Math.min(bounds.bottom, innerHeight) - margin);
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;
    const alpha = (x, y) => {
      const px = Math.floor((x - bounds.x) * width / bounds.width);
      const py = height - 1 - Math.floor((y - bounds.y) * height / bounds.height);
      return pixels[(py * width + px) * 4 + 3];
    };

    const backdropOffsets = [-18, -12, -6, 0, 6, 12, 18];
    let selected;
    for (let y = top; y <= bottom; y += 4) {
      for (let x = left; x <= right; x += 4) {
        const samples = [
          [x, y], [x - 5, y], [x + 5, y], [x, y - 5], [x, y + 5],
          [x - 5, y - 5], [x - 5, y + 5], [x + 5, y - 5], [x + 5, y + 5],
        ];
        // A backdrop point must be beyond the touch tolerance rather than in
        // a small hole or just outside an anti-aliased edge of the sculpture.
        const valid = needsArt
          ? samples.every(([sx, sy]) => alpha(sx, sy) >= 192)
          : backdropOffsets.every(dx => backdropOffsets.every(dy => alpha(x + dx, y + dy) < 48));
        if (!valid) continue;
        let pinch;
        if (kind === 'midpoint') {
          // The featured sculpture changes weekly. Wide reliefs can leave
          // space above and below even when both horizontal edges are filled.
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            const room = dx ? Math.min(x - left, right - x) : Math.min(y - top, bottom - y);
            for (let spread = 40; spread <= room - 20; spread += 4) {
              const fingers = [-spread, spread].map(offset => [x + dx * offset, y + dy * offset]);
              const empty = fingers.every(([fx, fy]) => document.elementFromPoint(fx, fy) === element
                && [[0, 0], [-14, 0], [14, 0], [0, -14], [0, 14]].every(([sx, sy]) => alpha(fx + sx, fy + sy) < 48));
              if (empty) {
                pinch = { spread, dx, dy };
                break;
              }
            }
            if (pinch) break;
          }
          if (!pinch) continue;
        }
        const preferredX = needsArt ? midX : left + margin;
        const score = Math.abs(x - preferredX) * (needsArt ? 1 : 3) + Math.abs(y - midY) * 1.5;
        if (!selected || score < selected.score) selected = { x, y, score, pinch };
      }
    }
    if (!selected || document.elementFromPoint(selected.x, selected.y) !== element) return null;
    return {
      x: selected.x,
      y: selected.y,
      offsetY: selected.y - bounds.y,
      pinch: selected.pinch,
    };
  }, kind);
  assert.ok(point, `Could not place a gesture on the rendered ${kind}`);
  return point;
}

function readTouchStart(canvas) {
  return canvas.evaluate(element => {
    const start = element.__atriumTestTouchStart;
    delete element.__atriumTestTouchStart;
    if (!start) return null;
    // The browser input command returned after dispatch. Read the original
    // event now so target and bubbling listeners have finished handling it.
    return {
      trusted: start.event.isTrusted,
      prevented: start.event.defaultPrevented,
      ageOfScroll: start.ageOfScroll,
    };
  });
}

function assertTouchOwnership(start, claimed, message) {
  assert.ok(start?.trusted, 'Expected a trusted touchstart on the canvas');
  assert.equal(start.prevented, claimed, message);
}

const readPose = canvas => canvas.evaluate(element => ({
  ...element.__atriumTestPose,
  trace: element.__atriumTestTrace,
  scroll: scrollY,
  scale: visualViewport.scale,
}));

async function track(canvas) {
  return canvas.evaluate(element => {
    element.__atriumTestTrace = { raw: [], settled: [] };
    return { ...element.__atriumTestPose, scroll: scrollY, scale: visualViewport.scale };
  });
}

function touchEvent(client, point, type, offsets = []) {
  return client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: offsets.map(([dx, dy], id) => ({ x: point.x + dx, y: point.y + dy, id })),
  });
}

async function touchGesture(client, canvas, point, frames) {
  await touchEvent(client, point, 'touchStart', frames[0]);
  try {
    const touchStart = await readTouchStart(canvas);
    for (const move of frames.slice(1)) await touchEvent(client, point, 'touchMove', move);
    return touchStart;
  } finally {
    await touchEvent(client, point, 'touchEnd');
  }
}

function assertStill(before, after) {
  const drift = sample => Math.max(distance(before.position, sample.position), distance(before.target, sample.target));
  const atEnd = drift(after);
  const committed = Math.max(atEnd, ...after.trace.settled.map(drift));
  const intermediate = Math.max(committed, ...after.trace.raw.map(drift));
  assert.ok(committed < 1e-7, [
    'The sculpture should remain still',
    `(end drift ${atEnd.toExponential(2)}, between callbacks ${committed.toExponential(2)},`,
    `within callbacks ${intermediate.toExponential(2)})`,
  ].join(' '));
}

async function checkMobile(client, canvas, check) {
  await check('touching backdrop scrolls without moving the sculpture', async () => {
    await settleScroll(canvas);
    const point = await pointOn(canvas, 'backdrop');
    await settlePose(canvas);
    const before = await track(canvas);
    const touchStart = await touchGesture(client, canvas, point, [[[0, 0]], [[1, -14]], [[1, -37]], [[0, -68]], [[0, -104]]]);
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    assertTouchOwnership(touchStart, false, 'Backdrop touch must stay with the page');
    assert.ok(after.scroll - before.scroll > 15, `Backdrop scroll moved ${after.scroll - before.scroll}px`);
    assertStill(before, after);
  });

  for (const kind of ['midpoint', 'art']) {
    const location = kind === 'art' ? 'starting on the sculpture' : 'with a midpoint on the sculpture';
    await check(`pinching ${location} zooms without moving or zooming the page`, async () => {
      await settleScroll(canvas);
      const point = await pointOn(canvas, kind);
      const { spread, dx, dy } = point.pinch ?? { spread: 0, dx: 1, dy: 0 };
      const initial = spread ? [-spread, spread] : [0, 32];
      // Close the wider pinch, so the next gesture still has accessible backdrop.
      const direction = kind === 'midpoint' ? -1 : 1;
      const frames = [0, 6, 12, 19].map(step => {
        const delta = direction * step;
        return [initial[0] - delta, initial[1] + delta].map(offset => [offset * dx, offset * dy]);
      });
      const before = await track(canvas);
      const touchStart = await touchGesture(client, canvas, point, frames);
      await nextPaint(canvas.page());
      const after = await readPose(canvas);
      const zoom = after.distance - before.distance;
      assert.ok(Math.abs(zoom) > 0.015 && Math.abs(after.scroll - before.scroll) <= 1 && Math.abs(after.scale - before.scale) < 1e-6,
        `Pinch should zoom only the sculpture (distance change ${zoom.toFixed(4)}, scroll ${after.scroll - before.scroll}px, scale ${before.scale} → ${after.scale})`);
      assertTouchOwnership(touchStart, true, 'The sculpture should claim the pinch before any movement');
    });
  }

  await check('touching the sculpture claims immediately, turns vertically and keeps the page still', async () => {
    await settleScroll(canvas);
    const point = await pointOn(canvas, 'art');
    const before = await track(canvas);
    const touchStart = await touchGesture(client, canvas, point, [[[0, 0]], [[0, -14]], [[0, -35]], [[31, -60]], [[78, -72]]]);
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    const moved = distance(after.position, before.position);
    const tilted = Math.abs(after.position[1] - before.position[1]);
    assert.ok(moved > 0.01 && tilted > 0.01 && Math.abs(after.scroll - before.scroll) <= 1,
      `Sculpture drag should orbit and tilt (camera travel ${moved.toFixed(4)}, vertical travel ${tilted.toFixed(4)}, scroll ${after.scroll - before.scroll}px)`);
    assertTouchOwnership(touchStart, true, 'The sculpture should claim touch-down before movement');
  });

  await check('a second touch on the sculpture during native scrolling stays with the page', async () => {
    await settleScroll(canvas);
    const art = await pointOn(canvas, 'art');
    // Prefer surrounding content for the initial swipe. A full-bleed stage
    // can instead use its own independently identified backdrop.
    const outside = await canvas.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const lower = Math.floor(Math.min(innerHeight - 16, bounds.bottom + 36));
      const upper = Math.floor(Math.max(130, bounds.top - 24));
      for (const [x, y] of [[8, lower], [innerWidth / 2, lower], [8, upper], [innerWidth / 2, upper]]) {
        const hit = document.elementFromPoint(x, y);
        if (hit && !hit.closest('[data-stage], button, a, summary, input, header')) return { x, y };
      }
      return null;
    });
    const start = outside ?? await pointOn(canvas, 'backdrop');
    const before = await track(canvas);
    await touchEvent(client, start, 'touchStart', [[0, 0]]);
    try {
      for (const dy of [-14, -28, -55, -80]) await touchEvent(client, start, 'touchMove', [[0, dy]]);
      await canvas.page().waitForFunction(scroll => scrollY > scroll + 12, before.scroll, { timeout: 3000 });
    } finally {
      await touchEvent(client, start, 'touchEnd');
    }

    const point = await canvas.evaluate((element, art) => {
      delete element.__atriumTestTouchStart;
      const x = art.x;
      const y = Math.round(element.getBoundingClientRect().top + art.offsetY);
      return document.elementFromPoint(x, y) === element ? { x, y } : null;
    }, art);
    assert.ok(point, 'The sculpture should remain in reach after the native swipe');
    const touchStart = await touchGesture(client, canvas, point, [[[0, 0]], [[0, -18]], [[12, -44]], [[36, -82]]]);
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    assertTouchOwnership(touchStart, false, 'The recent native scroll must prevent sculpture capture');
    assert.ok(touchStart.ageOfScroll < 150,
      `The second touch must land within the scroll guard (age ${Math.round(touchStart.ageOfScroll)}ms)`);
    assert.ok(after.scroll - before.scroll > 40, `Native scrolling moved ${after.scroll - before.scroll}px`);
    assertStill(before, after);
  });

  await check('dragging two fingers on the sculpture pans the view', async () => {
    await settleScroll(canvas);
    const point = await pointOn(canvas, 'art');
    const frames = [0, 6, 12, 18].map(step => [[step, -step], [32 + step, -step]]);
    const before = await track(canvas);
    const touchStart = await touchGesture(client, canvas, point, frames);
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    assertTouchOwnership(touchStart, true, 'The sculpture should claim the two-finger drag');
    assert.ok(distance(before.target, after.target) > 0.01, 'The two-finger drag should move the camera target');
    assert.ok(Math.abs(after.distance - before.distance) < 1e-6, 'A parallel two-finger drag should not zoom');
    assert.ok(Math.abs(after.scroll - before.scroll) <= 1 && Math.abs(after.scale - before.scale) < 1e-6,
      'The two-finger drag should leave page scrolling and zoom alone');
  });
}

async function checkDesktop(page, canvas, check) {
  await check('backdrop hover shows arrow and dragging is inert', async () => {
    await settleScroll(canvas);
    await settlePose(canvas);
    const { x, y } = await pointOn(canvas, 'backdrop');
    await page.mouse.move(x, y);
    const cursor = await canvas.evaluate(element => getComputedStyle(element).cursor);
    const before = await track(canvas);
    await page.mouse.down();
    try {
      await page.mouse.move(x + 90, y - 40, { steps: 6 });
    } finally {
      await page.mouse.up();
    }
    await nextPaint(page);
    assert.ok(cursor === 'auto' || cursor === 'default', `Expected arrow over backdrop, got ${cursor}`);
    assertStill(before, await readPose(canvas));
  });
  await check('sculpture hover shows grab, and left-drag turns on first interaction', async () => {
    await settleScroll(canvas);
    const { x, y } = await pointOn(canvas, 'art');
    const before = await track(canvas);
    await page.mouse.move(x, y);
    const cursor = await canvas.evaluate(element => getComputedStyle(element).cursor);
    await page.mouse.down();
    let scrollingCursor;
    try {
      scrollingCursor = await canvas.evaluate(element => getComputedStyle(element).cursor);
      await page.mouse.move(x + 90, y - 40, { steps: 6 });
    } finally {
      await page.mouse.up();
    }
    await nextPaint(page);
    const moved = distance((await readPose(canvas)).position, before.position);
    assert.ok(moved > 0.01, `Left-drag should move the camera without an activation click (travel ${moved.toFixed(4)})`);
    assert.equal(cursor, 'grab');
    assert.equal(scrollingCursor, 'grabbing');
  });
  await check('trackpad scroll over the backdrop scrolls the page', async () => {
    await settleScroll(canvas);
    const { x, y } = await pointOn(canvas, 'backdrop');
    const before = await readPose(canvas);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 150);
    await page.waitForFunction(scroll => scrollY > scroll + 15, before.scroll, { timeout: 4000 });
    await nextPaint(page);
    const after = await readPose(canvas);
    assert.ok(Math.abs(after.distance - before.distance) < 1e-6, 'A plain wheel should leave sculpture distance unchanged');
  });
  await check('two-finger trackpad scroll over the sculpture zooms without scrolling the page', async () => {
    await settleScroll(canvas);
    const { x, y } = await pointOn(canvas, 'art');
    const before = await readPose(canvas);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -150);
    await nextPaint(page);
    const after = await readPose(canvas);
    assert.ok(Math.abs(after.distance - before.distance) > 0.015, 'Trackpad scroll should zoom the sculpture');
    assert.ok(Math.abs(after.scroll - before.scroll) <= 1, 'Trackpad zoom should leave the page in place');
    assert.ok(Math.abs(after.scale - before.scale) < 1e-6, 'Trackpad zoom should leave the page scale unchanged');
  });
}

async function checkAutoOpeningAndRotation(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    await instrumentControls(page);
    for (const route of [{ ...home, viewer: 'main [data-viewer]' }, artwork, exhibitionStop, thinker]) {
      const viewers = (await loadRoute(page, route)).filter({
        has: page.locator('[data-stage][data-glb]:not([data-glb=""])'),
      });
      assert.ok(await viewers.count(), `${route.name}: expected at least one sculpture viewer`);
      for (const viewer of await viewers.all()) {
        const stage = viewer.locator('[data-stage]');
        const label = await stage.getAttribute('aria-label');
        const description = `${route.name}: ${label?.replace('Interactive 3D view of ', '') ?? 'sculpture'}`;
        try {
          const bytes = Number(await viewer.getAttribute('data-model-bytes'));
          if (requiresModelActivation(bytes)) {
            assert.equal(route.viewer, 'main [data-viewer]', 'This fixture should still open automatically');
            await stage.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await viewer.locator('[data-load-model]').waitFor({ state: 'visible' });
            assert.equal(await viewer.getAttribute('data-viewer-state'), 'idle', 'Large model must wait for a tap');
            console.log(`PASS 390px ${description} waits for a tap`);
            continue;
          }
          const canvas = await waitForViewer(page, viewer, { scroll: route !== thinker });
          if (route.firstViewSlug) await checkFirstViewTransfer(page, viewer, route.firstViewSlug);
          const initial = (await readPose(canvas)).position;
          await page.waitForFunction(({ element, initial }) => {
            const pose = element.__atriumTestPose;
            return pose?.rotating && Math.hypot(...pose.position.map((coordinate, axis) => coordinate - initial[axis])) > 0.01;
          }, { element: await canvas.elementHandle(), initial }, { timeout: 8000 });
          console.log(`PASS 390px ${description} opens untouched and actually rotates`);
        } catch (error) {
          fail(`390px ${description}: ${error.message}`);
        }
      }
    }
  } finally {
    await context.close();
  }
}

// Opt in to elapsed-time checks when validating a release locally.
async function checkAutomaticRotation(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    await instrumentControls(page);
    const canvas = await ready(page, home, { steady: false });
    const hint = page.locator(`${home.viewer} [data-hint]`);
    assert.equal(await hint.textContent(), 'Touch the sculpture to turn it · pinch to zoom');
    assert.equal(await hint.evaluate(element => getComputedStyle(element).position), 'absolute');

    const client = await context.newCDPSession(page);
    await settleScroll(canvas);
    const point = await pointOn(canvas, 'art');
    await touchGesture(client, canvas, point, [[[0, 0]], [[-20, 0]], [[-40, 0]]]);
    await page.waitForFunction(element => element.hidden || element.classList.contains('is-dismissed'), await hint.elementHandle());
    await page.waitForFunction(element => element.__atriumTestPose.rotating, await canvas.elementHandle(), { timeout: 8000 });

    const holdPoint = await pointOn(canvas, 'art');
    await touchEvent(client, holdPoint, 'touchStart', [[0, 0]]);
    assertTouchOwnership(await readTouchStart(canvas), true, 'The sculpture should claim touch-down before movement');
    await nextPaint(page);
    const pressed = await track(canvas);
    assert.equal(pressed.rotating, false, 'Automatic rotation must hold while the finger is down');
    await page.waitForTimeout(250);
    const held = await readPose(canvas);
    assert.ok(distance(pressed.position, held.position) < 1e-7, 'The sculpture moved while the finger held still');

    await canvas.evaluate(element => {
      element.addEventListener('touchend', () => { element.__atriumTestReleasedAt = performance.now(); }, { once: true });
    });
    await touchEvent(client, holdPoint, 'touchEnd');
    await page.waitForFunction(element => element.__atriumTestPose.rotating, await canvas.elementHandle(), { timeout: 8000 });
    const pausedFor = await canvas.evaluate(element =>
      element.__atriumTestTrace.settled.find(frame => frame.rotating).frameTime - element.__atriumTestReleasedAt,
    );
    assert.ok(pausedFor >= 3900 && pausedFor < 5500, `Rotation resumed after ${Math.round(pausedFor)}ms`);
    console.log(`PASS 390px homepage: hint dismissed on turn, rotation resumed after ${Math.round(pausedFor)}ms`);

    await ready(page, home, { steady: false });
    assert.equal(await hint.isVisible(), false, 'The gesture hint returned after turning a sculpture in this session');
  } finally {
    await context.close();
  }
}

let browser;
try {
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const gestureCases = process.env.BROWSER_CHECK_HANDLING_AUTO_ONLY === '1' ? [] : cases;
  for (const { route, touch } of gestureCases) {
    const width = touch ? 390 : 1440;
    const prefix = `${width}px ${route.name}`;
    const context = await browser.newContext({
      viewport: { width, height: touch ? 844 : 900 },
      hasTouch: touch,
      isMobile: touch,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await instrumentControls(page);
      const canvas = await ready(page, route);
      const check = async (name, run) => {
        try {
          await run();
          console.log(`PASS ${prefix}: ${name}`);
        } catch (error) {
          fail(`${prefix}: ${name}: ${error.message}`);
        }
      };
      if (touch) await checkMobile(await context.newCDPSession(page), canvas, check);
      else await checkDesktop(page, canvas, check);
    } catch (error) {
      fail(`${prefix}: ${error.message}`);
    } finally {
      await context.close();
    }
  }
  try {
    await checkAutoOpeningAndRotation(browser);
  } catch (error) {
    fail(`automatic sculpture opening and rotation: ${error.message}`);
  }
  if (process.env.BROWSER_CHECK_MOTION === '1') {
    try {
      await checkAutomaticRotation(browser);
    } catch (error) {
      fail(`390px homepage automatic rotation and hint: ${error.message}`);
    }
  }
} finally {
  if (browser) await browser.close();
  if (hosted) await hosted.close();
}

console.log('Automated Chromium touch does not verify native iPhone Safari scrolling.');
if (failures) process.exitCode = 1;
