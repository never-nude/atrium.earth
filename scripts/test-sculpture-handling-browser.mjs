import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serveBrowserChecks } from './serve-browser-checks.mjs';

const suppliedOrigin = process.env.BROWSER_CHECK_ORIGIN;
const hosted = suppliedOrigin ? null : await serveBrowserChecks(process.env.BROWSER_CHECK_DIST);
const origin = new URL(suppliedOrigin ?? hosted.origin);
const local = ['localhost', '127.0.0.1'].includes(origin.hostname);
const home = { name: 'homepage', path: '/', viewer: '.home-programme-hero [data-viewer]' };
const surface = {
  name: 'Surface exhibition',
  path: '/exhibitions/the-work-of-the-surface/',
  viewer: '.v3-exhero__viewer [data-viewer]',
};
const cases = [
  { route: home, touch: true },
  { route: surface, touch: true },
  { route: home, touch: false },
];
let failures = 0;

function fail(message) {
  failures++;
  console.error(`FAIL ${message}`);
}

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

async function instrumentControls(page) {
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
  if (local) await page.route('https://models.atrium.earth/models/previews/**/*.glb', async route => {
    const response = await route.fetch({
      headers: { ...route.request().headers(), origin: 'https://atrium.earth' },
      timeout: 20000,
    });
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': origin.origin } });
  });
}

async function ready(page, route, { steady = true } = {}) {
  const response = await page.goto(new URL(route.path, origin).href, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200);
  const viewer = page.locator(route.viewer);
  await viewer.locator('[data-stage]').scrollIntoViewIfNeeded();
  // A manual asset may legitimately need to be fetched first. Once the canvas
  // opens, all checks start a gesture without any click to enable handling.
  if (await viewer.getAttribute('data-auto-start') === 'false') {
    await viewer.getByRole('button', { name: /^Examine in 3D/ }).click();
  }
  const canvas = viewer.locator('canvas.viewer-canvas');
  await canvas.waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(
    element => element.closest('[data-viewer]').dataset.viewerState === 'ready' && element.__atriumTestPose,
    await canvas.elementHandle(),
    { timeout: 45000 },
  );
  if (!steady) return canvas;
  // Previews open only under the ordinary motion preference. Once live, turn
  // automatic rotation off through the browser so gesture changes can be isolated.
  if (route === home) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(element => {
    const rotate = element.closest('[data-viewer]').querySelector('[data-tool-rotate]');
    return rotate?.disabled === true;
  }, await canvas.elementHandle());
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
        let spread;
        if (kind === 'midpoint') {
          for (let step = 40; x - step >= left + 20 && x + step <= right - 20; step += 4) {
            const fingerLocations = [x - step, x + step];
            const empty = fingerLocations.every(fingerX => [
              [fingerX, y], [fingerX - 14, y], [fingerX + 14, y], [fingerX, y - 14], [fingerX, y + 14],
            ].every(([sx, sy]) => alpha(sx, sy) < 48));
            if (!empty) continue;
            if (document.elementFromPoint(x - step, y) !== element || document.elementFromPoint(x + step, y) !== element) continue;
            spread = step;
            break;
          }
          if (!spread) continue;
        }
        const preferredX = needsArt ? midX : left + margin;
        const score = Math.abs(x - preferredX) * (needsArt ? 1 : 3) + Math.abs(y - midY) * 1.5;
        if (!selected || score < selected.score) selected = { x, y, score, spread };
      }
    }
    if (!selected || document.elementFromPoint(selected.x, selected.y) !== element) return null;
    return {
      x: selected.x,
      y: selected.y,
      offsetY: selected.y - bounds.y,
      spread: selected.spread,
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
      const initial = point.spread ? [[-point.spread, 0], [point.spread, 0]] : [[0, 0], [32, 0]];
      // Close the wider pinch, so the next gesture still has accessible backdrop.
      const direction = kind === 'midpoint' ? -1 : 1;
      const frames = [0, 6, 12, 19].map(step => {
        const delta = direction * step;
        return [[initial[0][0] - delta, 0], [initial[1][0] + delta, 0]];
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
  await check('plain wheel scrolls without zooming the sculpture', async () => {
    await settleScroll(canvas);
    const { x, y } = await pointOn(canvas, 'art');
    const before = await readPose(canvas);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 150);
    await page.waitForFunction(scroll => scrollY > scroll + 15, before.scroll, { timeout: 4000 });
    await nextPaint(page);
    const after = await readPose(canvas);
    assert.ok(Math.abs(after.distance - before.distance) < 1e-6, 'A plain wheel should leave sculpture distance unchanged');
  });
  await check('Ctrl-wheel zooms the sculpture without scrolling the page', async () => {
    await settleScroll(canvas);
    const { x, y } = await pointOn(canvas, 'art');
    const before = await readPose(canvas);
    await page.mouse.move(x, y);
    await page.keyboard.down('Control');
    try {
      await page.mouse.wheel(0, -150);
    } finally {
      await page.keyboard.up('Control');
    }
    await nextPaint(page);
    const after = await readPose(canvas);
    assert.ok(Math.abs(after.distance - before.distance) > 0.015, 'Ctrl-wheel should zoom the sculpture');
    assert.ok(Math.abs(after.scroll - before.scroll) <= 1, 'Ctrl-wheel should leave the page in place');
    assert.ok(Math.abs(after.scale - before.scale) < 1e-6, 'Ctrl-wheel should leave the page scale unchanged');
  });
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
  for (const { route, touch } of cases) {
    const width = touch ? 390 : 1440;
    const prefix = `${width}px ${route.name}`;
    const context = await browser.newContext({
      viewport: { width, height: touch ? 844 : 900 },
      hasTouch: touch,
      isMobile: touch,
      reducedMotion: route === home ? 'no-preference' : 'reduce',
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
