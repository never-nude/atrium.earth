import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dev } from 'astro';
import { chromium } from 'playwright';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';

// Exercise the real page and restored AR handler with a local model. Native
// Quick Look and iPhone tracking cannot run in this desktop browser fixture.
const output = process.env.ATRIUM_TEST_OUTPUT || '/tmp/atrium-spatial-restoration';
await mkdir(output, { recursive: true });
const server = await dev({ root: new URL('../', import.meta.url), devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4337 }, vite: { server: { watch: null, hmr: false } }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: process.env.ATRIUM_TEST_EXECUTABLE,
  headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1' });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined });
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (token) { return token === 'ar' || supports.call(this, token); };
    window.orientationLocks = 0;
    if (screen.orientation) screen.orientation.lock = async () => { window.orientationLocks++; };
  });
  const page = await context.newPage();
  const errors = [], cameraRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/external\/xr|8thwall|spatial-browser-ar/.test(request.url())) cameraRequests.push(request.url()); });
  await page.goto('http://127.0.0.1:4337/works/europe/venus-of-willendorf-nhmw-44-686/');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-spatial-url]')?.value));
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('[data-artwork-label], [data-spatial-browser-setup], [data-spatial-photo-panel], [data-browser-ar-canvas]').count(), 0);

  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { bindSpatialViewing } = await import('/src/lib/spatial-viewer.mjs');
    const original = document.querySelector('[data-spatial]');
    const element = original.cloneNode(true); original.replaceWith(element);
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .08), new THREE.MeshStandardMaterial({ color: 0xf7f5ef }));
    mesh.name = 'SculptureFixture'; model.add(mesh);
    window.modelFixture = { THREE, model, box: new THREE.Box3().setFromObject(model), verifiedAsset: true };
    bindSpatialViewing(element, () => window.modelFixture, () => {});
  });
  await page.locator('[data-spatial-open]').tap();
  const prepare = page.getByRole('button', { name: 'Prepare AR view', exact: true });
  await prepare.waitFor();
  assert.ok(await prepare.isEnabled(), 'Portrait entry needs no orientation/setup step');
  await prepare.tap();
  const link = page.locator('[data-quick-look]:not([hidden])');
  await link.waitFor().catch(async error => {
    console.error('Native preparation state:', await page.locator('[data-spatial-status]').textContent(), errors);
    throw error;
  });
  const href = await link.getAttribute('href');
  const parameters = new URLSearchParams(href.split('#')[1]);
  assert.deepEqual([...parameters.keys()].sort(), ['allowsContentScaling', 'canonicalWebPageURL']);
  assert.equal(parameters.get('allowsContentScaling'), '0', 'Documented physical size remains intact');
  assert.equal(await link.getAttribute('rel'), 'ar');
  assert.equal(await link.getAttribute('download'), 'artwork.usdz');
  assert.equal(await link.evaluate(el => el.firstElementChild.tagName), 'IMG');
  const bytes = Buffer.from(await page.evaluate(async () => [...new Uint8Array(await (await fetch(document.querySelector('[data-quick-look]').href.split('#')[0])).arrayBuffer())]));
  const archive = unzipSync(bytes);
  const usd = strFromU8(archive['model.usda']);
  assert.match(usd, /def Xform "Artwork"/);
  assert.match(usd, /def Xform "SculptureFixture"/);
  assert.match(usd, /def Xform "AtriumMuseumLabel"/);
  assert.match(usd, /def Xform "MuseumLabelFront"/);
  assert.match(usd, /def Xform "MuseumLabelBack"/);
  assert.doesNotMatch(usd, /LookAtCamera|Preliminary_Behavior|Displayfurniture/);
  assert.equal(Object.keys(archive).filter(name => name.startsWith('textures/')).length, 1, 'The native scene includes one shared label texture');
  assert.equal(await page.locator('[data-museum-photo-actions]').isVisible(), false, 'Native photography needs no separate label-import step');
  await writeFile(`${output}/sculpture-with-upright-label.usdz`, bytes);

  for (const [width, height, angle] of [[390,844,0],[844,390,90],[568,320,-90],[320,568,0],[390,844,0]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(angle => {
      Object.defineProperty(window, 'orientation', { configurable: true, value: angle });
      window.dispatchEvent(new Event('orientationchange'));
      screen.orientation?.dispatchEvent(new Event('change'));
    }, angle);
    await link.scrollIntoViewIfNeeded();
    assert.equal(await link.getAttribute('href'), href, 'Rotation retains the same prepared sculpture');
    assert.equal(await page.locator('[data-spatial-overlay]').isVisible(), false, 'Page does not replace the native camera');
    assert.ok(await page.locator('[data-spatial-dialog]').evaluate(el => el.scrollWidth <= el.clientWidth));
    assert.ok(await link.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
        && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'Native AR launch remains reachable after rotation');
    await page.screenshot({ path: `${output}/native-entry-${width}.png` });
  }
  assert.equal(await page.evaluate(() => window.orientationLocks), 0);
  assert.equal(await page.evaluate(() => Boolean(window.XR8)), false);
  assert.deepEqual(cameraRequests, []);
  await page.locator('[data-spatial-close]').tap();
  await page.waitForFunction(() => !document.querySelector('[data-spatial-dialog]').open);
  await page.locator('[data-spatial-open]').tap();
  assert.equal(await link.getAttribute('href'), href, 'Closing/reopening options preserves the prepared export');
  assert.equal(await page.locator('[data-spatial-museum-hud]').isVisible(), false, 'Native AR cannot show the browser-only HUD');
  assert.deepEqual(errors, []);
  console.log('Native AR checks passed: portrait/landscape entry, unchanged USDZ through rotation, upright scene label, no banner, no photo-import step, and no replacement camera runtime.');
  console.log('Native iPhone rotation, tracking and shutter use still require physical-device validation.');
} finally { await browser.close(); await server.stop(); }
