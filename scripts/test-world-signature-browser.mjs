// A first-attempt browser audit of the finished /world/ page. No scripted retries.
// Each invocation preserves its own reports; viewport emulation is not an iPhone test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import { serveBrowserChecks } from './serve-browser-checks.mjs';

const reportRoot = process.env.BROWSER_REPORT_DIR || 'test-results/world-signature';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const directory = join(reportRoot, runId);
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const hosted = process.env.BROWSER_CHECK_ORIGIN ? null : await serveBrowserChecks(process.env.BROWSER_CHECK_DIST || 'dist');
const origin = new URL(process.env.BROWSER_CHECK_ORIGIN || hosted.origin);
const worldPath = new URL('/world/', origin).href;
const rootSelector = '[data-world-signature]';
const modelPath = /\.(?:glb|gltf|usdz)(?:$|[?#])|\/__atrium-(?:model|first-view)\//i;
const cases = [
  { engine: webkit, width: 390, height: 844, motion: 'no-preference', functional: true },
  { engine: webkit, width: 320, height: 640, motion: 'reduce' },
  { engine: chromium, width: 1440, height: 900, motion: 'no-preference' },
  { engine: chromium, width: 1440, height: 900, motion: 'reduce' },
];
const report = {
  schema: 'atrium-world-signature-browser/1', runId, origin: origin.origin,
  environment: 'Headless desktop Playwright, fresh browser and context per case. Phone widths emulate viewport, touch and devicePixelRatio 3; no physical iPhone, CPU or network performance is implied.',
  policy: 'One navigation and one first point selection per case; no scripted retries. Earlier invocation reports are retained.',
  analytics: 'External cloud.umami.is requests are fulfilled with HTTP 204, as in the main browser suite. Models and artwork assets are never intercepted.',
  cases: [], status: 'running',
};
await mkdir(directory, { recursive: true });

async function saveReport() {
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(join(reportRoot, 'latest.json'), JSON.stringify({ runId, report: join(runId, 'report.json'), status: report.status }, null, 2) + '\n');
}

function frontPoint(lights) {
  return lights.evaluateAll(buttons => {
    const positions = buttons.map(button => {
      const box = button.getBoundingClientRect();
      return { id: button.dataset.worldPlace, x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }).filter(point => point.x >= 0 && point.x <= innerWidth && point.y >= 0 && point.y <= innerHeight);
    return positions.find(point => point.id === 'egypt') || positions.sort((a, b) =>
      Math.hypot(a.x - innerWidth / 2, a.y - innerHeight / 2) - Math.hypot(b.x - innerWidth / 2, b.y - innerHeight / 2))[0];
  });
}

// Centres of the lights on show, keyed by place. Read in one step inside the page: a light
// can pass behind the turning globe between a locator's visibility test and the reading of
// its box, and would then seem to have leapt to the corner of the page.
const lightCentres = page => page.locator(rootSelector).evaluate(root => Object.fromEntries(
  [...root.querySelectorAll('button[data-world-light]:not([hidden])')].map(button => [button.dataset.worldPlace, button.getBoundingClientRect()])
    .filter(([, box]) => box.width > 0).map(([id, box]) => [id, { x: box.left + box.width / 2, y: box.top + box.height / 2 }])));
// The furthest any light on show in both readings has travelled between them.
const furthestTravel = (before, after) => Math.max(0, ...Object.keys(before).filter(id => after[id])
  .map(id => Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y)));

// The shown light furthest from every other, with nothing lying over its centre: a touch
// there can only mean that light.
function isolatedLight(lights) {
  return lights.evaluateAll(buttons => {
    const points = buttons.filter(button => !button.hidden && button.getBoundingClientRect().width > 0).map(button => {
      const box = button.getBoundingClientRect();
      return { id: button.dataset.worldPlace, x: box.left + box.width / 2, y: box.top + box.height / 2, button };
    });
    return points.filter(point => point.x >= 0 && point.x <= innerWidth && point.y >= 0 && point.y <= innerHeight
      && point.button.contains(document.elementFromPoint(point.x, point.y)))
      .map(({ button, ...point }) => ({ ...point, nearestNeighbourPx: Math.round(Math.min(...points
        .filter(other => other.id !== point.id).map(other => Math.hypot(other.x - point.x, other.y - point.y)))) }))
      .sort((a, b) => b.nearestNeighbourPx - a.nearestNeighbourPx)[0] || null;
  });
}

const selectedPlace = page => page.locator(rootSelector).getAttribute('data-selected-place');
const waitForPlace = (page, id, timeout = 4000) => page.waitForFunction(([selector, place]) =>
  document.querySelector(selector).dataset.selectedPlace === place, [rootSelector, id], { timeout }).then(() => true, () => false);

async function resetExploration(page) {
  await page.locator(rootSelector).locator('[data-world-reset]').click();
  await page.waitForFunction(selector => {
    const root = document.querySelector(selector);
    return root.dataset.selectedPlace === '' && root.dataset.worldMode === 'globe' && root.querySelector('[data-world-selection]').hidden;
  }, rootSelector);
}

async function showFlatMap(page) {
  const root = page.locator(rootSelector);
  await root.locator('[data-world-mode="map"]').click();
  await page.waitForFunction(selector => document.querySelector(selector).dataset.worldMode === 'map', rootSelector);
  await root.locator('[data-world-globe]').scrollIntoViewIfNeeded();
  // Functional settlement, not a measurement: a touch that lands on a page still moving is
  // rightly not a tap.
  await page.waitForTimeout(700);
}

// No touch can turn the flat map, so every touch on it is the page's and its lights are
// chosen by the click the browser sends after a tap. Starts and ends as "Reset exploration"
// leaves the page: on the globe, all periods, no place chosen.
async function checkFlatMapTap(page) {
  await resetExploration(page);
  await showFlatMap(page);
  const point = await isolatedLight(page.locator('button[data-world-light]:visible'));
  assert(point, 'No flat-map light is in view to tap');
  await page.touchscreen.tap(point.x, point.y);
  const selected = await waitForPlace(page, point.id);
  const outcome = { light: point.id, nearestNeighbourPx: point.nearestNeighbourPx, selected, selectedPlace: await selectedPlace(page) };
  await resetExploration(page);
  return outcome;
}

// Chromium only: several fingers, and fingers that travel, need the browser's own input
// pipeline. A phone-sized touch page of its own, so that the case's page is left as it was.
async function checkStageTouches(browser, observe) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 });
  try {
    await context.route('https://cloud.umami.is/**', route => route.fulfill({ status: 204 }));
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    observe(page, 'touch');
    const response = await page.goto(worldPath, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(selector => {
      const root = document.querySelector(selector);
      return root?.dataset.worldState === 'ready' && root.dataset.worldMode === 'globe'
        && root.querySelector('[data-world-globe]')?.hasAttribute('data-world-first-frame-ms');
    }, rootSelector, { timeout: 20000 });
    const root = page.locator(rootSelector);
    const client = await context.newCDPSession(page);
    // touchStart and touchMove list every finger that is down; touchEnd the fingers lifting.
    const touch = (type, ...fingers) => client.send('Input.dispatchTouchEvent', { type, touchPoints: fingers.map(([x, y, id]) => ({ x, y, id })) });
    const zoomLimits = () => root.evaluate(element => ['in', 'out'].map(direction => element.querySelector(`[data-world-zoom-${direction}]`).disabled));
    const nextFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    // 1. A finger rests on the page heading while another drags the globe 120 px towards it.
    const geometry = await root.evaluate(element => {
      const host = element.querySelector('[data-world-globe]'), stage = host.getBoundingClientRect();
      const title = element.querySelector('[data-world-title]').getBoundingClientRect();
      const resting = { x: stage.left + stage.width / 2, y: title.top + title.height / 2 };
      return { globe: { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 + 30 }, resting,
        restingOnScreen: resting.y > 0 && resting.y < innerHeight, restingOnStage: host.contains(document.elementFromPoint(resting.x, resting.y)) };
    });
    assert(geometry.restingOnScreen && !geometry.restingOnStage, 'The resting finger needs a place on screen outside the stage: ' + JSON.stringify(geometry));
    const { globe, resting } = geometry;
    const lightsBefore = await lightCentres(page);
    const tracked = Object.entries(lightsBefore).sort(([, a], [, b]) =>
      Math.hypot(a.x - globe.x, a.y - globe.y) - Math.hypot(b.x - globe.x, b.y - globe.y))[0][0];
    const zoomBefore = await zoomLimits();
    await touch('touchStart', [globe.x, globe.y, 0]);
    await touch('touchStart', [globe.x, globe.y, 0], [resting.x, resting.y, 1]);
    for (let step = 1; step <= 12; step++) await touch('touchMove', [globe.x, globe.y - step * 10, 0], [resting.x, resting.y, 1]);
    await nextFrames();
    const zoomDuring = await zoomLimits();
    const dragged = (await lightCentres(page))[tracked];
    await touch('touchEnd', [globe.x, globe.y - 120, 0]);
    await touch('touchEnd', [resting.x, resting.y, 1]);
    // Functional settlement: the coast after the drag ends, and the globe waits three seconds
    // after a hand lets go before it turns again.
    await page.waitForTimeout(3700);
    const atRest = await lightCentres(page);
    await page.waitForTimeout(1200);
    const resumedTravelPx = furthestTravel(atRest, await lightCentres(page));
    const point = await frontPoint(root.locator('button[data-world-light]:visible'));
    assert(point, 'No light is in view to tap after the resting finger lifted');
    await page.touchscreen.tap(point.x, point.y);
    const tapLanded = await waitForPlace(page, point.id);
    const restingFinger = {
      trackedLight: tracked, trackedLightTravelPx: dragged ? Math.round(Math.hypot(dragged.x - lightsBefore[tracked].x, dragged.y - lightsBefore[tracked].y)) : null,
      zoomLimitsBefore: zoomBefore, zoomLimitsDuring: zoomDuring, readAsPinch: zoomDuring.some((limit, index) => limit !== zoomBefore[index]),
      resumedTravelPx: Math.round(resumedTravelPx * 10) / 10, nextTap: { light: point.id, selected: tapLanded, selectedPlace: await selectedPlace(page) },
    };

    // 2. A tap on a flat-map light.
    const flatMapTap = await checkFlatMapTap(page);

    // 3. What the flat map still refuses. A slide too short to scroll the page, after which
    // browsers send a click all the same; then a scroll that begins on a light.
    await showFlatMap(page);
    const slid = await isolatedLight(root.locator('button[data-world-light]:visible'));
    assert(slid, 'No flat-map light is in view to slide on');
    await touch('touchStart', [slid.x, slid.y, 0]);
    await touch('touchMove', [slid.x + 12, slid.y, 0]);
    await touch('touchEnd', [slid.x + 12, slid.y, 0]);
    await page.waitForTimeout(600);
    const afterSlide = await selectedPlace(page);
    const scrollBefore = await page.evaluate(() => scrollY);
    await touch('touchStart', [slid.x, slid.y, 0]);
    for (let step = 1; step <= 8; step++) { await touch('touchMove', [slid.x, slid.y - step * 20, 0]); await page.waitForTimeout(16); }
    await touch('touchEnd', [slid.x, slid.y - 160, 0]);
    await page.waitForTimeout(600);
    const flatMapRefusals = { light: slid.id, selectedAfterShortSlide: afterSlide,
      scrolledPx: await page.evaluate(before => scrollY - before, scrollBefore), selectedAfterScroll: await selectedPlace(page) };
    await resetExploration(page);

    // 4. At this width Globe/Map and Reset float over the top of the stage, where the
    // northernmost lights are. No light's label may open underneath them.
    // Functional settlement: the turn home after the reset.
    await page.waitForTimeout(1200);
    const labels = await root.evaluate(async element => {
      const host = element.querySelector('[data-world-globe]').getBoundingClientRect();
      const controls = [...element.querySelectorAll('.world-map-toolbar > *')].map(control => control.getBoundingClientRect());
      const northern = [...element.querySelectorAll('button[data-world-light]:not([hidden])')]
        .filter(button => button.getBoundingClientRect().top + 22 - host.top < 140);
      const under = [];
      for (const button of northern) {
        button.focus({ preventScroll: true });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const label = button.firstElementChild.getBoundingClientRect();
        if (controls.some(box => Math.min(label.right, box.right) - Math.max(label.left, box.left) > 0.5
          && Math.min(label.bottom, box.bottom) - Math.max(label.top, box.top) > 0.5)) under.push(button.dataset.worldPlace);
      }
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      return { controlsFloatOverStage: controls.some(box => box.bottom > host.top + 1 && box.top < host.bottom - 1), northernLights: northern.length, under };
    });
    return { restingFinger, flatMapTap, flatMapRefusals, labels };
  } finally {
    await context.close();
  }
}

// Two things a mouse shows on the desktop page. Leaves the page as "Reset exploration" does.
async function checkPointerAndReset(page) {
  const root = page.locator(rootSelector);
  const lights = root.locator('button[data-world-light]:visible');
  await resetExploration(page);
  // Functional settlement: the turn home. The globe is then held still to be measured.
  await page.waitForTimeout(1200);
  const rotate = root.locator('[data-world-rotate]');
  if (await rotate.getAttribute('aria-pressed') === 'true') await rotate.click();
  const stage = await root.locator('[data-world-globe]').boundingBox();
  const centre = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
  const outside = { x: stage.x - 20, y: centre.y };
  assert(await root.evaluate((element, point) => point.x > 0 && !element.querySelector('[data-world-globe]')
    .contains(document.elementFromPoint(point.x, point.y)), outside), 'The pointer needs a place on screen beside the stage');
  await page.mouse.move(outside.x, outside.y);
  await page.waitForTimeout(400);

  // 1. Among overlapping lights the pointer is over one light's target while a neighbour is
  // nearest and shows its label. Leaving the stage from there in one step must take the label away.
  const clustered = await lights.evaluateAll(buttons => buttons.filter(button => !button.hidden && button.getBoundingClientRect().width > 0).map(button => {
    const box = button.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
    return { nearest: button.dataset.worldPlace, x, y, pointerOver: document.elementFromPoint(x, y)?.dataset?.worldPlace };
  }).filter(light => light.pointerOver && light.pointerOver !== light.nearest && light.y > 0 && light.y < innerHeight).slice(0, 3));
  assert(clustered.length, 'No overlapping lights are in view to leave from');
  const labelsLeftBehind = [];
  for (const light of clustered) {
    await page.mouse.move(light.x, light.y, { steps: 1 });
    await page.mouse.move(outside.x, outside.y, { steps: 1 });
    // Functional settlement: the label's own fade.
    await page.waitForTimeout(250);
    const shown = await lights.evaluateAll(buttons => buttons
      .filter(button => !button.hidden && Number(getComputedStyle(button.firstElementChild).opacity) > 0.5).map(button => button.dataset.worldPlace));
    if (shown.length) labelsLeftBehind.push({ ...light, shown });
  }

  // 2. "Reset exploration" turns the globe home; it does not jump there.
  const home = await lightCentres(page);
  await page.mouse.move(centre.x - 150, centre.y);
  await page.mouse.down();
  for (let step = 1; step <= 15; step++) await page.mouse.move(centre.x - 150 + step * 20, centre.y);
  // Rest before letting go, so that the globe does not coast.
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.mouse.move(outside.x, outside.y);
  await page.waitForTimeout(600);
  const turnedAwayPx = furthestTravel(home, await lightCentres(page));
  // The globe times each animated turn it makes, as the centering-turn phase reads. The drag's
  // own timing is cleared first, so that only a turn made by the reset can be found afterwards.
  // The reset also starts the unattended rotation again, which is why how far the lights have
  // travelled soon after the click is recorded but not judged.
  const turn = await root.evaluate(element => new Promise(resolve => {
    const host = element.querySelector('[data-world-globe]');
    const read = () => Object.fromEntries([...element.querySelectorAll('button[data-world-light]:not([hidden])')].map(button => [button.dataset.worldPlace, button.getBoundingClientRect()])
      .filter(([, box]) => box.width > 0).map(([id, box]) => [id, { x: box.left + box.width / 2, y: box.top + box.height / 2 }]));
    delete host.dataset.worldTurnDurationMs; delete host.dataset.worldTurnFps;
    element.querySelector('[data-world-reset]').click();
    const clicked = performance.now();
    let early = null;
    const tick = now => {
      early ||= now - clicked >= 100 ? { afterMs: Math.round(now - clicked), lights: read() } : null;
      if (now - clicked >= 1500) resolve({ early, late: { afterMs: Math.round(now - clicked), lights: read() },
        turnDurationMs: Number(host.dataset.worldTurnDurationMs) || 0, turnFps: Number(host.dataset.worldTurnFps) || 0 });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  return { labelsLeftBehind, clusteredLightsTried: clustered.length, reset: { turnedAwayPx: Math.round(turnedAwayPx),
    turnDurationMs: turn.turnDurationMs, turnFps: turn.turnFps,
    earlySampleMs: turn.early.afterMs, earlySampleFromHomePx: Math.round(furthestTravel(home, turn.early.lights)),
    lateSampleMs: turn.late.afterMs, fromHomePx: Math.round(furthestTravel(home, turn.late.lights)) } };
}

async function checkHomepageGlobe(context, touch) {
  const homepage = await context.newPage();
  try {
    // The homepage has its own artwork viewers. Keep this globe test on the built site's local assets.
    await homepage.route(url => url.origin !== origin.origin, route => route.abort());
    const response = await homepage.goto(new URL('/', origin).href, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    const root = homepage.locator('#explore-the-world[data-world-signature][data-world-compact]');
    assert.equal(await root.getAttribute('data-world-state'), null, 'The homepage globe must wait until it is near the viewport');
    await root.locator('[data-world-globe]').scrollIntoViewIfNeeded();
    await root.and(homepage.locator('[data-world-state="ready"][data-world-mode="globe"]')).waitFor();
    const rotate = root.locator('[data-world-rotate]');
    if (await rotate.getAttribute('aria-pressed') === 'true') await rotate.click();
    const point = await frontPoint(root.locator('button[data-world-light]:visible'));
    assert(point, 'The homepage must show selectable globe lights');
    const overviewScroll = await homepage.evaluate(() => scrollY);
    if (touch) await homepage.touchscreen.tap(point.x, point.y);
    else await homepage.mouse.click(point.x, point.y);
    const selection = root.locator('[data-world-selection]');
    await selection.waitFor({ state: 'visible' });
    assert.equal(await root.getAttribute('data-selected-place'), point.id);
    const cards = selection.locator('[data-world-works] a');
    const count = await cards.count();
    assert(count > 0 && count <= 12, 'The homepage must use the shared artwork selection');
    assert.match(await cards.first().locator('img').getAttribute('src'), /^\/world\/stills\/.+\.webp$/);
    assert.equal(new URL(await selection.locator('[data-world-see-all]').getAttribute('href'), origin).searchParams.get('origin'), point.id);
    assert.equal(await root.getByRole('link', { name: 'Open full globe' }).getAttribute('href'), '/world/');

    await root.getByRole('button', { name: 'Map', exact: true }).click();
    const back = selection.getByRole('button', { name: 'Back to globe' });
    assert((await back.boundingBox())?.height >= 44, 'The return button must have a phone-sized touch target');
    if (touch) await back.tap();
    else await back.click();
    await selection.waitFor({ state: 'hidden' });
    await homepage.waitForFunction(y => {
      const root = document.querySelector('#explore-the-world');
      return root.dataset.selectedPlace === '' && root.dataset.worldMode === 'globe' && Math.abs(scrollY - y) < 3;
    }, overviewScroll);
    return { selectedPlace: point.id, cards: count, restoredOverview: true };
  } finally {
    await homepage.close();
  }
}

async function deadline(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('First-attempt timeout: ' + message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function pageAudit(phone) {
  const shown = element => {
    const box = element.getBoundingClientRect();
    if (box.width <= 2 || box.height <= 2 || element.closest('[hidden], [inert], template')) return false;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
      // WebKit can retain a native select's nonzero rectangle inside closed
      // details. Only the summary subtree is actually painted or interactive.
      if (node instanceof HTMLDetailsElement && !node.open && node !== element
        && !node.querySelector(':scope > summary')?.contains(element)) return false;
    }
    return true;
  };
  const label = element => (element.getAttribute('aria-label') || element.textContent || element.tagName)
    .trim().replace(/\s+/g, ' ').slice(0, 100);
  const smallTargets = [];
  for (const element of document.querySelectorAll('a[href], button, summary, input:not([type="hidden"]), select')) {
    if (!shown(element)) continue;
    const box = element.getBoundingClientRect();
    if (box.width < 43.9 || box.height < 43.9) {
      const style = getComputedStyle(element);
      smallTargets.push({ label: label(element), tag: element.tagName, width: box.width, height: box.height,
        minWidth: style.minWidth, minHeight: style.minHeight, appearance: style.getPropertyValue('appearance') });
    }
  }
  const smallText = [];
  const cyan = [];
  function cyanColour(colour) {
    const values = colour.match(/[\d.]+/g)?.map(Number);
    if (!values || values.length < 3 || (values[3] !== undefined && values[3] < .05)) return false;
    const [r, g, b] = values.slice(0, 3).map(value => value / 255);
    const high = Math.max(r, g, b), low = Math.min(r, g, b), difference = high - low;
    if (difference === 0 || high < .35 || difference / high < .45) return false;
    let hue = high === r ? (g - b) / difference : high === g ? 2 + (b - r) / difference : 4 + (r - g) / difference;
    hue = (hue * 60 + 360) % 360;
    return hue >= 160 && hue <= 200;
  }
  for (const element of document.querySelectorAll('body *')) {
    if (!shown(element)) continue;
    const style = getComputedStyle(element);
    const direct = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent).join('').trim();
    if (phone && direct && style.clipPath === 'none' && Number.parseFloat(style.fontSize) < 12) {
      smallText.push({ label: direct.replace(/\s+/g, ' ').slice(0, 100), fontSize: Number.parseFloat(style.fontSize) });
    }
    const properties = ['color', 'backgroundColor', 'backgroundImage', 'boxShadow', 'textShadow', 'fill', 'stroke'];
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (style['border' + side + 'Style'] !== 'none') properties.push('border' + side + 'Color');
    if (style.outlineStyle !== 'none') properties.push('outlineColor');
    for (const property of properties) {
      for (const colour of style[property]?.match(/rgba?\([^)]*\)/g) || []) {
        if (cyanColour(colour)) cyan.push({ label: label(element), property, colour });
      }
    }
  }
  return {
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    smallTargets, smallText, cyan,
  };
}

async function runCase(specification) {
  const id = specification.engine.name() + '-' + specification.width + '-' + specification.motion;
  const result = { id, engine: specification.engine.name(), viewport: { width: specification.width, height: specification.height },
    motion: specification.motion, requestedDeviceScaleFactor: specification.width < 700 ? 3 : 1,
    status: 'running', phase: 'launch', timings: {}, failures: [],
    consoleErrors: [], pageErrors: [], failedRequests: [], assetErrors: [], modelRequests: [], screenshots: [] };
  report.cases.push(result);
  let browserServer, browser, context, page;
  let activePhase = 'launch';
  const noteFailure = (message, details) => {
    const failure = { phase: activePhase, message, ...(details === undefined ? {} : { details }) };
    result.failures.push(failure);
    result.firstFailure ||= failure;
  };
  const phase = async (name, operation, timeout = 30000) => {
    activePhase = name; result.phase = name;
    console.log('START ' + id + ': ' + name);
    await saveReport();
    return deadline(Promise.resolve().then(operation), timeout, id + ' / ' + name + ' (' + timeout + ' ms)');
  };
  const expect = (condition, message, details) => { if (!condition) noteFailure(message, details); };
  function observe(observedPage, label) {
    observedPage.on('pageerror', error => result.pageErrors.push({ page: label, error: error.message }));
    observedPage.on('crash', () => result.pageErrors.push({ page: label, error: 'The browser page crashed' }));
    observedPage.on('console', message => {
      if (message.type() === 'error') result.consoleErrors.push({ page: label, error: message.text(), location: message.location().url });
    });
    observedPage.on('request', request => {
      if (modelPath.test(request.url())) result.modelRequests.push({ page: label, url: request.url() });
    });
    observedPage.on('requestfailed', request => {
      const failure = request.failure()?.errorText || '';
      const cancelled = /abort|cancel/i.test(failure);
      const changesSelection = ['keyboard, exact collection handoff, close restoration and Willendorf',
        'a tap on a flat-map light selects it', 'touches on the stage at phone size: a finger beside it, the flat map, and labels',
        'stage resize never paints an empty globe'].includes(activePhase);
      const expectedCancellation = cancelled && (activePhase === 'cleanup'
        || (changesSelection && request.resourceType() === 'image' && Number.isFinite(result.timings.firstPointToVisibleLoadedStillMs)));
      result.failedRequests.push({ page: label, url: request.url(), failure,
        ...(expectedCancellation ? { expectedCancellation: activePhase === 'cleanup' ? 'Test cleanup' : 'Selection changes can cancel no-longer-visible lazy images' } : {}) });
    });
    observedPage.on('response', response => {
      if (response.status() >= 400) result.assetErrors.push({ page: label, url: response.url(), status: response.status() });
    });
  }
  async function audit(label) {
    const measurement = await page.evaluate(pageAudit, specification.width < 700);
    result.audits ||= [];
    result.audits.push({ label, ...measurement });
    expect(measurement.overflow <= 1, label + ': horizontal overflow', measurement.overflow);
    expect(!measurement.smallText.length, label + ': visible phone text below 12 px', measurement.smallText);
    expect(!measurement.smallTargets.length, label + ': visible control below 44 px', measurement.smallTargets);
    expect(!measurement.cyan.length, label + ': cyan remains in the DOM presentation', measurement.cyan);
  }
  async function screenshot(label) {
    const filename = id + '-' + label + '.png';
    await page.screenshot({ path: join(directory, filename), timeout: 15000 });
    result.screenshots.push(filename);
  }
  try {
    await phase('launch', async () => {
      browserServer = await specification.engine.launchServer();
      browser = await specification.engine.connect(browserServer.wsEndpoint());
      context = await browser.newContext({
        viewport: result.viewport, hasTouch: specification.width < 700, reducedMotion: specification.motion,
        deviceScaleFactor: result.requestedDeviceScaleFactor,
      });
      await context.route('https://cloud.umami.is/**', route => route.fulfill({ status: 204 }));
      page = await context.newPage();
      page.setDefaultTimeout(15000);
      observe(page, 'world');
    });
    await phase('navigation and first actual land frame', async () => {
      const response = await page.goto(worldPath, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200, 'The finished world route must return HTTP 200');
      await page.waitForFunction(selector => {
        const root = document.querySelector(selector);
        return root?.dataset.worldState === 'ready' && root.querySelector('[data-world-globe]')?.hasAttribute('data-world-first-frame-ms');
      }, rootSelector, { timeout: 20000 });
      result.timings.firstLandFrameNavigationMs = await page.evaluate(selector => {
        const frame = Number(document.querySelector(selector).querySelector('[data-world-globe]').dataset.worldFirstFrameMs);
        return frame - (performance.getEntriesByType('navigation')[0]?.startTime || 0);
      }, rootSelector);
      result.renderingEnvironment = await page.locator('[data-world-globe]').evaluate(host => {
        const canvas = host.querySelector('canvas');
        const box = canvas.getBoundingClientRect();
        return { devicePixelRatio, canvasWidth: canvas.width, canvasHeight: canvas.height,
          canvasCssWidth: box.width, canvasCssHeight: box.height,
          canvasPixelRatio: box.width > 0 ? canvas.width / box.width : null };
      });
      assert(Number.isFinite(result.timings.firstLandFrameNavigationMs), 'First land-frame timing is unavailable');
      assert.equal(await page.locator(rootSelector).getAttribute('data-world-mode'), 'globe', 'First view must be the actual globe');
      if (specification.width === 1440 && specification.height === 900) {
        const position = await page.locator('[data-world-globe] canvas[role="img"]').evaluate(canvas => {
          const { top, bottom } = canvas.getBoundingClientRect();
          return { top, bottom, viewport: innerHeight, scroll: scrollY };
        });
        assert(position.scroll === 0 && position.top >= 0 && position.bottom <= position.viewport,
          'The whole globe must fit at 1440 × 900 before scrolling: ' + JSON.stringify(position));
        result.initialGlobePosition = position;
      }
    });
    await phase('initial page audit and screenshot', async () => { await audit('initial'); await screenshot('initial'); });
    await phase('first front-point selection and loaded still', async () => {
      const point = await frontPoint(page.locator('button[data-world-light]:visible'));
      assert(point, 'No visible front-side point can be selected in the viewport');
      result.firstPoint = point;
      if (specification.width < 700) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await page.waitForFunction(selector => {
        const root = document.querySelector(selector);
        return root.hasAttribute('data-world-first-selection-ms') || root.hasAttribute('data-world-selection-visible-error');
      }, rootSelector, { timeout: 7000 });
      const first = await page.locator(rootSelector).evaluate(root => ({
        place: root.dataset.selectedPlace,
        visibleMs: Number(root.dataset.worldFirstSelectionMs),
        error: root.dataset.worldSelectionVisibleError || null,
      }));
      assert(!first.error, first.error || 'First selected row failed');
      assert(Number.isFinite(first.visibleMs), 'First loaded-still timing is unavailable');
      assert.equal(first.place, point.id, 'The real point gesture selected another origin');
      result.timings.firstPointToVisibleLoadedStillMs = first.visibleMs;
      const cards = page.locator('[data-world-works] > a');
      const count = await cards.count();
      expect(count > 0 && count <= 12, 'Selected row must contain 1–12 works', count);
      const layout = await page.locator(rootSelector).evaluate(root => {
        const stage = root.querySelector('[data-world-globe]').getBoundingClientRect();
        const panel = root.querySelector('[data-world-selection]').getBoundingClientRect();
        const animations = [...root.querySelectorAll('[data-world-works] a')].map(card => {
          const style = getComputedStyle(card);
          return { name: style.animationName, delay: Number.parseFloat(style.animationDelay) * 1000 };
        });
        return { beside: panel.left >= stage.right - 1, below: panel.top >= stage.bottom - 1, animations };
      });
      expect(specification.width >= 1024 ? layout.beside : layout.below, 'The selection panel must sit beside the globe on desktop and below it on phones', layout);
      expect(layout.animations.every(({ name, delay }, index) => specification.motion === 'reduce' ? name === 'none'
        : name !== 'none' && Math.abs(delay - index * 60) < 2), 'The per-work stagger must respect reduced motion', layout.animations);
      const images = await cards.locator('img').evaluateAll(elements => elements.map(image => {
        const box = image.getBoundingClientRect();
        return { url: new URL(image.src).pathname, loading: image.loading, width: image.naturalWidth,
          complete: image.complete, visibleFraction: box.height > 0
            ? Math.max(0, Math.min(innerHeight, box.bottom) - Math.max(0, box.top)) / box.height : 0 };
      }));
      result.firstSelection = { place: first.place, cards: count, images };
      expect(images.every(image => image.url.startsWith('/world/stills/') && image.loading === 'lazy'), 'Place row must use lazy small real stills', images);
      expect(images[0]?.complete && images[0]?.width === 320 && images[0]?.visibleFraction >= .5,
        'First 320 px still must be loaded with at least half its image visible', images[0]);
    });
    await phase('first centering-turn frame rate', async () => {
      if (specification.motion === 'reduce') {
        result.timings.centeringTurn = { fps: null, reason: 'Not applicable: reduced motion jumps without an animated turn.' };
        return;
      }
      await page.waitForFunction(selector => {
        const host = document.querySelector(selector).querySelector('[data-world-globe]');
        return Number(host.dataset.worldTurnDurationMs) >= 600 && Number(host.dataset.worldTurnFps) > 0;
      }, rootSelector, { timeout: 5000 });
      result.timings.centeringTurn = await page.locator('[data-world-globe]').evaluate(host => ({
        fps: Number(host.dataset.worldTurnFps), sampledDurationMs: Number(host.dataset.worldTurnDurationMs),
      }));
    });
    await phase('selected page audit, reduced-motion behavior and screenshot', async () => {
      await audit('selected');
      if (specification.motion === 'reduce') {
        const motion = await page.evaluate(() => {
          const row = document.querySelector('[data-world-works] a');
          const light = document.querySelector('[data-world-light] > span:last-child');
          return { rowAnimation: getComputedStyle(row).animationName, lightTransition: getComputedStyle(light).transitionDuration };
        });
        expect(motion.rowAnimation === 'none', 'Reduced motion still animates the work row', motion);
        expect(motion.lightTransition.split(',').every(value => Number.parseFloat(value) === 0), 'Reduced motion still animates point size/opacity', motion);
      }
      await screenshot('selected');
    });
    await phase('serious and critical accessibility audit', async () => {
      await page.addScriptTag({ path: axePath });
      result.axe = await page.evaluate(async () => {
        const { violations } = await window.axe.run(document);
        return violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({
          id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
        }));
      });
      expect(!result.axe.length, 'Serious or critical accessibility violations', result.axe);
    }, 45000);
    if (specification.functional) await phase('keyboard, exact collection handoff, close restoration and Willendorf', async () => {
      const data = await page.evaluate(async selector => {
        const root = document.querySelector(selector);
        const response = await fetch(root.dataset.worldDataUrl);
        if (!response.ok) throw new Error('World metadata could not be read for the reference set');
        return response.json();
      }, rootSelector);
      assert(data.dateMin <= -27500, 'Prehistory must include Willendorf’s stable coordinate');
      await page.locator('[data-world-selection-close]').click();
      await page.waitForFunction(() => document.querySelector('[data-world-selection]').hidden);
      const directoryControl = page.locator('[data-world-list-view]');
      if (!await directoryControl.evaluate(element => element.open)) await directoryControl.locator('summary').click();
      await audit('place directory open');
      await screenshot('place-directory-open');
      assert.equal(await page.locator('[data-world-list-place]').count(), data.places.length, 'Every documented origin needs a keyboard/list entry');
      const egypt = page.locator('[data-world-list-place="egypt"]');
      await egypt.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement === document.querySelector('[data-world-selection-title]'), undefined, { timeout: 10000 });
      const expected = data.works.filter(work => work.placeId === 'egypt').map(work => work.slug).sort();
      assert.equal(Number(await page.locator(rootSelector).getAttribute('data-result-count')), expected.length);
      const featuredEgypt = data.featured.filter(slug => expected.includes(slug)).slice(0, 12);
      const rowSlugs = await page.locator('[data-world-works] > a').evaluateAll(links =>
        links.map(link => new URL(link.href).pathname.replace(/^\/works\//, '').replace(/\/$/, '')));
      assert.deepEqual(rowSlugs.slice(0, featuredEgypt.length), featuredEgypt, 'The row must preserve the curator’s featured order');
      const href = await page.locator('[data-world-see-all]').getAttribute('href');
      assert.equal(new URL(href, origin).searchParams.get('origin'), 'egypt');
      assert((await page.locator('[data-world-see-all]').textContent()).includes(expected.length.toLocaleString('en-US')));
      async function checkCollection(destination, expectedSlugs, place, clear = false) {
        const collection = await context.newPage();
        observe(collection, 'collection');
        collection.setDefaultTimeout(15000);
        try {
          const response = await collection.goto(new URL(destination, origin).href, { waitUntil: 'domcontentloaded' });
          assert.equal(response?.status(), 200);
          await collection.waitForFunction(id => {
            const root = document.querySelector('[data-studio-explorer]');
            return root?.dataset.studioOrigin === id && !root.hasAttribute('data-studio-origin-pending')
              && !root.querySelector('[data-v3-grid]').hasAttribute('aria-busy');
          }, place, { timeout: 20000 });
          assert.equal(Number(await collection.locator('[data-studio-explorer]').getAttribute('data-studio-origin-count')), expectedSlugs.length);
          const cards = collection.locator('[data-v3-grid] [data-v3-card]');
          for (let batch = 0; await cards.count() < expectedSlugs.length; batch++) {
            assert(batch <= Math.ceil(expectedSlugs.length / 60), 'The collection failed to finish its bounded result set');
            const before = await cards.count();
            await collection.locator('[data-studio-load-more]').click();
            await collection.waitForFunction(previous => document.querySelectorAll('[data-v3-grid] [data-v3-card]').length > previous, before);
          }
          const actual = await cards.evaluateAll(elements => elements.map(card =>
            new URL(card.querySelector('a[href]').href).pathname.replace(/^\/works\//, '').replace(/\/$/, '')).sort());
          assert.deepEqual(actual, expectedSlugs, 'See all must preserve every exact-origin/date slug, without broader geography or duplicates');
          if (clear) {
            await collection.locator('[data-studio-origin-clear]').click();
            await collection.waitForFunction(() => !new URLSearchParams(location.search).has('origin') && !document.querySelector('[data-studio-explorer]').dataset.studioOrigin);
            assert.equal(await collection.locator('[data-studio-origin-filter]').isVisible(), false);
          }
        } finally { await collection.close(); }
      }
      await checkCollection(href, expected, 'egypt', true);
      await page.locator('[data-world-mode="map"]').click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('[data-world-selection]').hidden
        && document.activeElement?.dataset.worldListPlace === 'egypt'
        && document.querySelector('[data-world-explorer]').dataset.worldMode === 'globe');
      await page.locator('select[data-world-place]').selectOption('austria');
      await page.locator('.world-exact > summary').click();
      await page.locator('[data-world-date-from]').fill('27500 BCE');
      await page.locator('[data-world-date-to]').fill('25000 BCE');
      await page.locator('[data-world-date-form] button').click();
      await page.waitForFunction(() => document.querySelector('[data-world-explorer]').dataset.periodFrom === '-27500'
        && document.querySelector('[data-world-explorer]').dataset.periodTo === '-25000');
      assert(await page.locator('[data-world-works] a[href*="venus-of-willendorf"]').count(), 'Willendorf is absent from its Austrian prehistoric selection');
      const datedHref = new URL(await page.locator('[data-world-see-all]').getAttribute('href'), origin);
      assert.equal(datedHref.searchParams.get('origin'), 'austria');
      assert.equal(datedHref.searchParams.get('from'), '-27500');
      assert.equal(datedHref.searchParams.get('to'), '-25000');
      const prehistoric = data.works.filter(work => work.placeId === 'austria'
        && Number.isFinite(work.start) && Number.isFinite(work.end) && work.start <= -25000 && work.end >= -27500)
        .map(work => work.slug).sort();
      assert(prehistoric.includes('europe/venus-of-willendorf-nhmw-44-686'));
      await checkCollection(datedHref.href, prehistoric, 'austria');
      result.functional = { exactEgyptWorks: expected.length, exactEgyptSlugs: expected,
        keyboardSelectionFocus: true, closeRestoredOriginalModeAndFocus: true,
        willendorfPeriodHref: datedHref.pathname + datedHref.search, exactPrehistoricAustriaSlugs: prehistoric };
    }, 120000);
    if (specification.engine === chromium && specification.motion === 'no-preference') {
      await phase('whole-world fullscreen selection and internal-scroll restoration', async () => {
        const root = page.locator(rootSelector);
        await root.locator('[data-world-selection-close]').click();
        await page.waitForFunction(() => document.querySelector('[data-world-selection]').hidden);
        // This is functional animation settlement, after all first metrics were
        // recorded; it does not contribute to a performance measurement.
        await page.waitForTimeout(900);
        // The functional phase ends on a prehistoric date filter, under which Egypt has
        // no works and therefore no still for this phase to wait for. Clear any filter an
        // earlier phase left, so that this phase does not depend on the order of the suite.
        const period = root.locator('[data-world-period]');
        if ((await period.textContent())?.trim() !== 'All periods') {
          await root.locator('[data-world-reset]').click();
          await page.waitForFunction(selector => document.querySelector(selector)
            .querySelector('[data-world-period]').textContent.trim() === 'All periods', rootSelector);
          await page.waitForTimeout(900);
        }
        assert.equal(await page.evaluate(() => document.fullscreenEnabled), true, 'Desktop fullscreen must be available');
        const fullscreen = root.locator('[data-world-fullscreen]');
        await fullscreen.click();
        await page.waitForFunction(selector => document.fullscreenElement === document.querySelector(selector), rootSelector);
        const externalY = await page.evaluate(() => scrollY);
        const directoryControl = root.locator('[data-world-list-view]');
        if (!await directoryControl.evaluate(element => element.open)) await directoryControl.locator('summary').click();
        await root.evaluate(element => {
          element.addEventListener('change', event => {
            if (event.target.matches('select[data-world-place]')) element.__worldAuditBeforeChooseScroll = element.scrollTop;
          }, { capture: true, once: true });
          element.addEventListener('atrium:world-selection-visible', event => {
            element.__worldAuditFullscreenVisibility = event.detail;
          }, { once: true });
        });
        await root.locator('select[data-world-place]').selectOption('egypt');
        await page.waitForFunction(selector => {
          const root = document.querySelector(selector);
          const image = root.querySelector('[data-world-works] img');
          if (document.fullscreenElement !== root || root.querySelector('[data-world-selection]').hidden
            || root.dataset.selectedPlace !== 'egypt' || root.__worldAuditFullscreenVisibility?.place !== 'egypt'
            || !image?.complete || image.naturalWidth !== 320) return false;
          const box = image.getBoundingClientRect();
          return box.height > 0 && Math.max(0, Math.min(innerHeight, box.bottom) - Math.max(0, box.top)) / box.height >= .5;
        }, rootSelector, { timeout: 7000 });
        const selected = await root.evaluate(element => ({
          insideFullscreen: document.fullscreenElement === element,
          firstStill: element.querySelector('[data-world-works] img').getAttribute('src'),
          scrollTop: element.scrollTop, beforeChooseScrollTop: element.__worldAuditBeforeChooseScroll,
          externalY: scrollY, visibleMs: element.__worldAuditFullscreenVisibility.elapsedMs,
        }));
        assert.equal(selected.externalY, externalY, 'Fullscreen selection must scroll its own root, not the outer page');
        assert(Number.isFinite(selected.beforeChooseScrollTop), 'Fullscreen scroll snapshot was not captured');
        await screenshot('fullscreen-selected');
        await root.locator('[data-world-selection-close]').click();
        await page.waitForFunction(selector => {
          const root = document.querySelector(selector);
          return root.querySelector('[data-world-selection]').hidden
            && Math.abs(root.scrollTop - root.__worldAuditBeforeChooseScroll) < 2;
        }, rootSelector, { timeout: 8000 });
        const restored = await root.evaluate(element => ({
          scrollTop: element.scrollTop, externalY: scrollY, mode: element.dataset.worldMode,
        }));
        assert.equal(restored.externalY, externalY);
        assert.equal(restored.mode, 'globe');
        await fullscreen.click();
        await page.waitForFunction(() => !document.fullscreenElement);
        // The button follows the fullscreenchange event, which the browser sends a frame after
        // the page has left full screen. Give it that frame: reading it at once is a race.
        await page.waitForFunction(selector => document.querySelector(selector).querySelector('[data-world-fullscreen]')
          .getAttribute('aria-pressed') === 'false', rootSelector, { timeout: 3000 }).catch(() => {});
        assert.equal(await fullscreen.getAttribute('aria-pressed'), 'false');
        result.fullscreen = { selected, restored, exited: true };
      }, 45000);
    }
    if (specification.motion === 'no-preference') await phase('homepage globe light selection and return', async () => {
      result.homepage = await checkHomepageGlobe(context, specification.width < 700);
    }, 45000);
    const expectFlatMapTap = (tap, where) => expect(tap.selected, where + ': a tap on a flat-map light did not select it', tap);
    if (specification.width < 700) await phase('a tap on a flat-map light selects it', async () => {
      result.flatMapTap = await checkFlatMapTap(page);
      expectFlatMapTap(result.flatMapTap, 'This page');
    }, 30000);
    if (specification.engine === chromium && specification.motion === 'no-preference') {
      await phase('touches on the stage at phone size: a finger beside it, the flat map, and labels', async () => {
        const touches = result.stageTouches = await checkStageTouches(browser, observe);
        const { restingFinger, flatMapRefusals } = touches;
        expect(!restingFinger.readAsPinch, 'A finger resting beside the stage turned a one-finger drag into a pinch', restingFinger);
        expect(restingFinger.trackedLightTravelPx >= 40, 'With a finger resting beside the stage, a drag did not turn the globe', restingFinger);
        expect(restingFinger.resumedTravelPx > 1, 'The globe stayed held after the dragging finger and the resting finger had both lifted', restingFinger);
        expect(restingFinger.nextTap.selected, 'The tap after a resting finger lifted did not select its light', restingFinger);
        expectFlatMapTap(touches.flatMapTap, 'Chromium touch page');
        expect(flatMapRefusals.selectedAfterShortSlide === '', 'A slide on a flat-map light selected it', flatMapRefusals);
        expect(flatMapRefusals.scrolledPx > 40 && flatMapRefusals.selectedAfterScroll === '',
          'A touch that began on a flat-map light must scroll the page and select nothing', flatMapRefusals);
        expect(touches.labels.controlsFloatOverStage && touches.labels.northernLights > 0,
          'The label check needs the floating controls and lights beneath them', touches.labels);
        expect(!touches.labels.under.length, 'A light’s label opened under the floating Globe/Map or Reset control', touches.labels);
      }, 90000);
      await phase('a hover label goes with the pointer, and Reset exploration turns the globe home', async () => {
        const pointer = result.pointerAndReset = await checkPointerAndReset(page);
        expect(!pointer.labelsLeftBehind.length, 'A hover label stayed after the pointer left the stage', pointer.labelsLeftBehind);
        expect(pointer.reset.turnedAwayPx > 100, 'The globe was not turned away before the reset', pointer.reset);
        expect(pointer.reset.turnDurationMs >= 600, 'Reset exploration jumped to the opening view instead of turning to it', pointer.reset);
        expect(pointer.reset.fromHomePx < 40, 'Reset exploration did not bring the globe back to its opening view', pointer.reset);
      }, 45000);
    }
    await phase('stage resize never paints an empty globe', async () => {
      // Runs last: every timing above is already recorded, and this reads pixels.
      // Choosing a place changes the stage's height. A canvas is cleared when it is
      // resized, and resize observers run after that frame's animation callbacks, so
      // the globe must draw again in the same frame or it is painted empty.
      const root = page.locator(rootSelector);
      if (!await root.locator('[data-world-selection]').evaluate(element => element.hidden)) {
        await root.locator('[data-world-selection-close]').click();
        await page.waitForFunction(() => document.querySelector('[data-world-selection]').hidden);
      }
      // Functional settlement of the closing layout and scroll, not a measurement.
      await page.waitForTimeout(1000);
      assert.equal(await root.getAttribute('data-world-mode'), 'globe', 'The resize check needs the globe, not the flat map');
      result.resizeFrames = await page.evaluate(selector => new Promise((resolve, reject) => {
        const root = document.querySelector(selector);
        const host = root.querySelector('[data-world-globe]');
        const canvas = host.querySelector('canvas[role="img"]');
        const gl = canvas.getContext('webgl2');
        if (!gl) { reject(new Error('The globe canvas has no WebGL 2 context to inspect')); return; }
        const pixel = new Uint8Array(4);
        const firstHeight = host.clientHeight;
        let resizes = 0, blank = 0;
        // Created after the globe's own observer, so it runs after it within each frame:
        // what the centre of the drawing buffer holds here is what that frame will paint.
        // With reduced motion the height changes at once and there is a single callback.
        const probe = new ResizeObserver(() => {
          resizes++;
          gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          if (pixel[3] === 0) blank++;
        });
        probe.observe(host);
        const select = root.querySelector('select[data-world-place]');
        select.value = 'egypt';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        setTimeout(() => {
          probe.disconnect();
          resolve({ resizes, blank, firstHeight, lastHeight: host.clientHeight });
        }, 1500);
      }), rootSelector);
      assert(result.resizeFrames.resizes >= 1 && result.resizeFrames.lastHeight < result.resizeFrames.firstHeight,
        'Choosing a place did not change the stage height: ' + JSON.stringify(result.resizeFrames));
      expect(result.resizeFrames.blank === 0, 'The globe was painted empty while its stage changed size', result.resizeFrames);
    }, 20000);
    expect(!result.modelRequests.filter(request => request.page === 'world').length, 'The world page downloaded a sculpture model', result.modelRequests);
    expect(!result.pageErrors.length, 'Page errors were observed', result.pageErrors);
    expect(!result.consoleErrors.length, 'Console errors were observed', result.consoleErrors);
    expect(!result.assetErrors.length, 'HTTP errors were observed', result.assetErrors);
    const failedAssets = result.failedRequests.filter(request => !request.expectedCancellation);
    expect(!failedAssets.length, 'A first asset request failed', failedAssets);
  } catch (error) {
    noteFailure(error.message);
  } finally {
    activePhase = 'cleanup'; result.phase = 'cleanup';
    for (const [label, close] of [
      ['context', () => context?.close()], ['browser connection', () => browser?.close()], ['browser server', () => browserServer?.close()],
    ]) {
      try { await deadline(Promise.resolve().then(close), 10000, id + ' / closing ' + label); }
      catch (error) { noteFailure(error.message); browserServer?.process()?.kill('SIGKILL'); }
    }
    result.status = result.failures.length ? 'failed' : 'passed';
    result.phase = 'complete';
    await saveReport();
    console.log((result.status === 'passed' ? 'PASS ' : 'FAIL ') + id + (result.firstFailure ? ': ' + result.firstFailure.message : ''));
  }
}

try {
  for (const specification of cases) await runCase(specification);
  report.status = report.cases.every(result => result.status === 'passed') ? 'passed' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = error.message;
} finally {
  await hosted?.close();
  await saveReport();
}
console.log('World signature report: ' + join(directory, 'report.json'));
process.exitCode = report.status === 'passed' ? 0 : 1;
