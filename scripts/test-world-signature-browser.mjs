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
      const changesSelection = activePhase === 'keyboard, exact collection handoff, close restoration and Willendorf';
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
        assert.equal(await fullscreen.getAttribute('aria-pressed'), 'false');
        result.fullscreen = { selected, restored, exited: true };
      }, 45000);
    }
    if (specification.motion === 'no-preference') await phase('homepage globe light selection and return', async () => {
      result.homepage = await checkHomepageGlobe(context, specification.width < 700);
    }, 45000);
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
