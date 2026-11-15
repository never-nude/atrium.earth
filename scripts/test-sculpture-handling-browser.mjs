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
const failures = [];

const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

async function instrumentControls(page) {
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
  await page.waitForFunction(element => {
    const pose = element.__atriumTestPose;
    const signature = JSON.stringify([pose.position, pose.target].map(vector => vector.map(value => value.toFixed(7))));
    const previous = element.__atriumTestStable;
    element.__atriumTestStable = {
      signature,
      frames: previous?.signature === signature ? previous.frames + 1 : 1,
    };
    return element.__atriumTestStable.frames >= 5;
  }, await canvas.elementHandle());
  return canvas;
}

const nextPaint = page => page.evaluate(() => new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

async function center(canvas) {
  await canvas.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await nextPaint(canvas.page());
  const point = await canvas.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const left = Math.max(0, bounds.left);
    const right = Math.min(innerWidth, bounds.right);
    const top = Math.max(100, bounds.top);
    const bottom = Math.min(innerHeight, bounds.bottom);
    const x = Math.round((left + right) / 2);
    const y = Math.round((top + bottom) / 2);
    return { x, y, visible: document.elementFromPoint(x, y) === element };
  });
  assert.ok(point.visible, 'The gesture start must land on the canvas');
  return point;
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

async function touchGesture(client, point, frames) {
  const send = (type, offsets) => client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: offsets.map(([dx, dy], id) => ({ x: point.x + dx, y: point.y + dy, id })),
  });
  await send('touchStart', frames[0]);
  try {
    for (const move of frames.slice(1)) {
      await send('touchMove', move);
    }
  } finally {
    await send('touchEnd', []);
  }
}

async function checkMobile(client, canvas, check) {
  await check('vertical swipe scrolls without nudging the sculpture', async () => {
    const point = await center(canvas);
    const before = await track(canvas);
    await touchGesture(client, point, [[[0, 0]], [[1, -14]], [[1, -37]], [[0, -68]], [[0, -104]]]);
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    const scroll = after.scroll - before.scroll;
    const drift = sample => Math.max(distance(before.position, sample.position), distance(before.target, sample.target));
    const atEnd = drift(after);
    const committed = Math.max(atEnd, ...after.trace.settled.map(drift));
    const intermediate = Math.max(committed, ...after.trace.raw.map(drift));
    assert.ok(scroll > 15 && committed < 1e-7, [
      'Vertical swipe should scroll without camera motion',
      `(scroll ${scroll}px, end drift ${atEnd.toExponential(2)},`,
      `between callbacks ${committed.toExponential(2)}, within callbacks ${intermediate.toExponential(2)})`,
    ].join(' '));
  });

  await check('sideways swipe turns and can then tilt without scrolling', async () => {
    const point = await center(canvas);
    const before = await track(canvas);
    await touchGesture(client, point, [[[0, 0]], [[-16, 0]], [[-37, 0]], [[-58, -28]], [[-75, -65]]]);
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    const moved = distance(after.position, before.position);
    const tilted = Math.abs(after.position[1] - before.position[1]);
    assert.ok(moved > 0.01 && tilted > 0.01 && Math.abs(after.scroll - before.scroll) <= 1,
      `Sideways swipe should orbit and tilt (camera travel ${moved.toFixed(4)}, vertical travel ${tilted.toFixed(4)}, scroll ${after.scroll - before.scroll}px)`);
  });

  await check('pinch zooms the sculpture without moving or zooming the page', async () => {
    const point = await center(canvas);
    const before = await track(canvas);
    await touchGesture(client, point, [
      [[-25, 0], [25, 0]], [[-38, 0], [38, 0]], [[-52, 0], [52, 0]], [[-67, 0], [67, 0]], [[-78, 0], [78, 0]],
    ]);
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    const zoom = after.distance - before.distance;
    assert.ok(Math.abs(zoom) > 0.015 && Math.abs(after.scroll - before.scroll) <= 1 && Math.abs(after.scale - before.scale) < 1e-6,
      `Pinch should zoom only the sculpture (distance change ${zoom.toFixed(4)}, scroll ${after.scroll - before.scroll}px, scale ${before.scale} → ${after.scale})`);
  });
}

async function checkDesktop(page, canvas, check) {
  await check('left-drag turns on the first interaction', async () => {
    const { x, y } = await center(canvas);
    const before = await track(canvas);
    await page.mouse.move(x, y);
    await page.mouse.down();
    try {
      await page.mouse.move(x + 90, y - 40, { steps: 6 });
    } finally {
      await page.mouse.up();
    }
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    const moved = distance(after.position, before.position);
    assert.ok(moved > 0.01, `Left-drag should move the camera without an activation click (travel ${moved.toFixed(4)})`);
  });
  await check('plain wheel scrolls without zooming the sculpture', async () => {
    const { x, y } = await center(canvas);
    const before = await readPose(canvas);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 150);
    await page.waitForFunction(scroll => scrollY > scroll + 15, before.scroll, { timeout: 4000 });
    await nextPaint(canvas.page());
    const after = await readPose(canvas);
    assert.ok(Math.abs(after.distance - before.distance) < 1e-6, 'A plain wheel should leave sculpture distance unchanged');
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
    assert.equal(await hint.textContent(), 'Drag sideways to turn · pinch to zoom');
    assert.equal(await hint.evaluate(element => getComputedStyle(element).position), 'absolute');

    const client = await context.newCDPSession(page);
    const point = await center(canvas);
    await touchGesture(client, point, [[[0, 0]], [[-20, 0]], [[-40, 0]]]);
    await page.waitForFunction(element => element.hidden || element.classList.contains('is-dismissed'), await hint.elementHandle());
    await page.waitForFunction(element => element.__atriumTestPose.rotating, await canvas.elementHandle(), { timeout: 8000 });

    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 0 }] });
    await nextPaint(page);
    const pressed = await track(canvas);
    assert.equal(pressed.rotating, false, 'Automatic rotation must hold while the finger is down');
    await page.waitForTimeout(250);
    const held = await readPose(canvas);
    assert.ok(distance(pressed.position, held.position) < 1e-7, 'The sculpture moved while the finger held still');

    await canvas.evaluate(element => {
      element.addEventListener('touchend', () => { element.__atriumTestReleasedAt = performance.now(); }, { once: true });
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(element => element.__atriumTestPose.rotating, await canvas.elementHandle(), { timeout: 8000 });
    const pausedFor = await canvas.evaluate(element =>
      element.__atriumTestTrace.settled.find(frame => frame.rotating).frameTime - element.__atriumTestReleasedAt,
    );
    assert.ok(pausedFor >= 3900 && pausedFor < 5500, `Rotation resumed after ${Math.round(pausedFor)}ms`);
    console.log(`PASS 390px homepage: one hint faded on turn; rotation held until ${Math.round(pausedFor)}ms after release`);

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
          failures.push(`${prefix}: ${name}: ${error.message}`);
        }
      };
      if (touch) await checkMobile(await context.newCDPSession(page), canvas, check);
      else await checkDesktop(page, canvas, check);
    } catch (error) {
      failures.push(`${prefix}: ${error.message}`);
    } finally {
      await context.close();
    }
  }
  if (process.env.BROWSER_CHECK_MOTION === '1') {
    try {
      await checkAutomaticRotation(browser);
    } catch (error) {
      failures.push(`390px homepage automatic rotation and hint: ${error.message}`);
    }
  }
} finally {
  if (browser) await browser.close();
  if (hosted) await hosted.close();
}

for (const failure of failures) console.error(`FAIL ${failure}`);
console.log('Automated Chromium touch does not verify native iPhone Safari scrolling.');
if (failures.length) process.exitCode = 1;
