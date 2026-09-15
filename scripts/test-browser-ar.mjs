import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dev } from 'astro';
import { chromium } from 'playwright';

const output = '/tmp/atrium-browser-ar-tests';
await mkdir(output, { recursive: true });
// Read the actual build's server-rendered metadata. The catalogue deliberately
// uses Node's crypto for provenance checks and must not be imported in a browser.
const worksDir = new URL('../dist/works/', import.meta.url);
const catalogueLabels = (await Promise.all((await readdir(worksDir, { recursive: true }))
  .filter(path => path.endsWith('/index.html'))
  .map(async path => (await readFile(new URL(path, worksDir), 'utf8')).match(/data-artwork-label-json="([^"]*)"/)?.[1])))
  .filter(Boolean);
const server = await dev({ root: new URL('../', import.meta.url), devToolbar: { enabled: false }, server: { host: '127.0.0.1', port: 4336 }, vite: { server: { watch: null, hmr: false } }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: process.env.ATRIUM_TEST_EXECUTABLE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const base = 'http://127.0.0.1:4336';
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1' });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined });
    // Chromium has no Quick Look integration. Emulate Safari's rel=ar probe.
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function(token) { return token === 'ar' || supports.call(this, token); };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('Page error:', error.message); });
  page.on('console', message => { if (message.type() === 'error') console.error('Console:', message.text()); });
  await page.goto(`${base}/works/europe/venus-of-willendorf-nhmw-44-686/`);
  await page.waitForFunction(() => Boolean(document.querySelector('[data-spatial-url]')?.value));
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { bindSpatialViewing } = await import('/src/lib/spatial-viewer.mjs');
    const original = document.querySelector('[data-spatial]');
    const fixture = original.cloneNode(true); original.replaceWith(fixture);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(390, 400); fixture.closest('[data-viewer]').append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 390 / 400, .01, 100);
    camera.position.set(0, .4, 1);
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.SphereGeometry(.1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xf7f5ef })));
    const box = new THREE.Box3().setFromObject(model);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: .15 }));
    const grid = new THREE.GridHelper(2, 10);
    scene.add(model, ground, grid, new THREE.HemisphereLight(0xffffff, 0x888888, 3));
    const saved = { parent: model.parent, canvasParent: renderer.domElement.parentNode, camera: camera.clone() };
    window.fixture = { THREE, renderer, scene, camera, model, box, ground, grid, verifiedAsset: true, suspend() { window.suspended = true; return () => { window.suspended = false; }; } };
    window.fixtureSaved = saved;
    bindSpatialViewing(fixture, () => window.fixture, () => {});
  });
  await page.locator('[data-spatial-open]').click();
  assert.match(await page.locator('[data-spatial-ar]').textContent(), /Place in your room/);
  // Load the REAL pinned engine and compile its SLAM WebAssembly locally.
  const version = await page.evaluate(async () => {
    const { loadBrowserAREngine } = await import('/src/lib/spatial-browser-ar-loader.mjs');
    const engine = await loadBrowserAREngine();
    return { version: engine.version(), initialized: engine.isInitialized() };
  });
  console.log('Real engine:', version);
  assert.equal(version.initialized, true);
  await page.locator('[data-spatial-ar]').click();
  await page.waitForFunction(() => document.querySelector('[data-spatial-instructions]').textContent !== 'Loading the camera…', { timeout: 30000 });
  await page.waitForTimeout(1200);
  const real = await page.evaluate(() => ({ status: document.querySelector('[data-spatial-status]').textContent, instruction: document.querySelector('[data-spatial-instructions]').textContent, overlay: !document.querySelector('[data-spatial-overlay]').hidden, camera: Boolean(document.querySelector('[data-browser-ar-canvas]')), suspended: window.suspended }));
  console.log('Real camera:', real);
  await page.screenshot({ path: `${output}/real-engine-camera.png` });
  assert.ok(real.overlay && real.camera && real.suspended, 'Real engine starts the camera pipeline');
  await page.locator('[data-spatial-exit]').click();
  assert.equal(await page.evaluate(() => window.suspended), false);

  // Deterministic pose/hit fixtures verify app behavior that needs a moving
  // phone. The real-engine smoke test above is separate; this is not an ARKit test.
  await page.evaluate(() => {
    const engine = window.XR8;
    window.realEngine = engine;
    let modules = [], running = false, raf;
    const camera = new window.fixture.THREE.PerspectiveCamera(60, 390 / 844, .01, 1000);
    const rotation = { x: 0, y: 0, z: 0, w: 1 };
    const position = { x: 0, y: .25, z: 0 };
    window.fixturePose = { rotation, position, trackingStatus: 'NORMAL' };
    const fake = {
      initialize: async () => {}, clearCameraPipelineModules: () => { modules = []; },
      addCameraPipelineModules: value => { modules = value; },
      XrConfig: { device: () => ({ MOBILE: 'mobile' }), camera: () => ({ BACK: 'back' }) },
      XrController: { configure: config => { window.trackingConfig = config; }, updateCameraProjectionMatrix() {},
        pipelineModule: () => ({ name: 'reality' }), hitTest: () => [{ type: 'FEATURE_POINT', distance: 1, position: { x: 0, y: 0, z: -1 }, rotation }] },
      GlTextureRenderer: { pipelineModule: () => ({ name: 'camera', onRender() {
        const gl = window.fixture.renderer.getContext();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
        gl.clearColor(.25, .55, .6, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      } }) },
      run({ canvas }) {
        running = true; modules.forEach(module => module.onStart?.({ canvas }));
        const tick = () => {
          if (!running) return;
          camera.aspect = canvas.width / canvas.height; camera.updateProjectionMatrix();
          modules.forEach(module => module.onUpdate?.({ processCpuResult: { reality: { ...window.fixturePose, intrinsics: camera.projectionMatrix.toArray() } } }));
          modules.forEach(module => module.onRender?.());
          raf = requestAnimationFrame(tick);
        }; tick();
      },
      stop() { running = false; cancelAnimationFrame(raf); },
    };
    // The loader caches the already verified engine object. Replace just its
    // public pipeline methods for deterministic frame and lifecycle testing.
    for (const key of Object.keys(fake)) engine[key] = fake[key];
  });
  for (const [width, height] of [[390, 844], [844, 390], [568, 320], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.locator('[data-spatial-ar]').click();
    await page.waitForFunction(() => document.querySelector('[data-spatial-instructions]').textContent.includes('Surface found'));
    const label = page.locator('[data-spatial-screen-label]');
    const before = await label.boundingBox();
    await page.locator('[data-browser-ar-canvas]').tap({ position: { x: width / 2, y: height * .58 } });
    await page.waitForFunction(() => !document.querySelector('[data-spatial-photo-capture]').disabled);
    await page.evaluate(() => { window.fixturePose.position.x = .1; window.fixturePose.rotation.y = .1; window.fixturePose.rotation.w = Math.sqrt(.99); });
    await page.locator('.spatial-overlay-controls').evaluate(element => { element.open = true; });
    await page.locator('[data-spatial-turn]').click();
    await page.locator('.spatial-overlay-controls').evaluate(element => { element.open = false; });
    assert.deepEqual(await label.boundingBox(), before, 'HUD stays at a fixed screen position as the camera and sculpture move');
    const shutter = page.locator('[data-spatial-photo-capture]');
    assert.ok(await shutter.evaluate(element => { const rect = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); }), 'Shutter is touchable');
    await shutter.tap();
    await page.locator('[data-spatial-photo-review]:not([hidden])').waitFor();
    const result = await page.evaluate(async () => {
      const image = document.querySelector('[data-spatial-photo-preview]'); await image.decode();
      const photo = document.createElement('canvas'); photo.width = image.naturalWidth; photo.height = image.naturalHeight;
      const ctx = photo.getContext('2d'); ctx.drawImage(image, 0, 0);
      const rect = document.querySelector('[data-spatial-screen-label]').getBoundingClientRect();
      const view = document.querySelector('[data-browser-ar-canvas]').getBoundingClientRect();
      const scale = photo.width / view.width;
      return { width: photo.width, height: photo.height, label: [...ctx.getImageData((rect.x + 8) * scale, (rect.y + 8) * scale, 1, 1).data], camera: [...ctx.getImageData(5, photo.height / 2, 1, 1).data], data: photo.toDataURL() };
    });
    assert.equal(Math.round(result.width / result.height * 100), Math.round(width / height * 100), 'Photo follows the current phone orientation');
    assert.ok(result.camera[1] > 100 && result.label[1] < 80, 'Camera pixels and fixed-position HUD are both captured');
    await writeFile(`${output}/photo-${width}.png`, Buffer.from(result.data.split(',')[1], 'base64'));
    await page.screenshot({ path: `${output}/hud-${width}.png` });
    if (width === 568) {
      const catalogue = await page.evaluate(async (labels) => {
        const { createScreenArtworkLabel } = await import('/src/lib/spatial-screen-label.mjs');
        const overlay = document.querySelector('[data-spatial-overlay]');
        const decoder = document.createElement('textarea');
        const failures = [];
        const maxBottom = document.querySelector('.spatial-capture-status').getBoundingClientRect().top;
        for (const encoded of labels) {
          decoder.innerHTML = encoded;
          const label = JSON.parse(decoder.value);
          const hud = createScreenArtworkLabel(overlay, label);
          const canvas = overlay.lastElementChild;
          const rect = canvas.getBoundingClientRect();
          if (rect.bottom > maxBottom || rect.left < 0 || rect.right > innerWidth) failures.push(label.title);
          hud.dispose();
        }
        return { count: labels.length, failures };
      }, catalogueLabels);
      assert.ok(catalogue.count > 1000);
      assert.deepEqual(catalogue.failures, [], 'Every enabled artwork label fits the small landscape viewport above the controls');
      console.log('Catalogue HUDs checked:', catalogue.count);
    }
    if (width === 390) {
      const anchor = await page.evaluate(() => window.fixture.model.parent.parent.position.toArray());
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForFunction(() => { const c = document.querySelector('[data-browser-ar-canvas]'); return c.width > c.height; });
      assert.deepEqual(await page.evaluate(() => window.fixture.model.parent.parent.position.toArray()), anchor, 'Live phone rotation preserves the placed world anchor');
      await page.locator('[data-spatial-photo-capture]').tap();
      await page.waitForFunction(() => { const img = document.querySelector('[data-spatial-photo-preview]'); return !document.querySelector('[data-spatial-photo-result]').hidden && img.naturalWidth > img.naturalHeight; });
      await page.screenshot({ path: `${output}/live-rotation.png` });
    }
    await page.locator('[data-spatial-exit]').tap();
    assert.ok(await page.evaluate(() => !window.suspended && window.fixture.model.parent === window.fixtureSaved.parent && window.fixture.renderer.domElement.parentNode === window.fixtureSaved.canvasParent), 'Exit restores model and canvas to the ordinary viewer');
  }
  await page.evaluate(() => { window.XR8.run = () => { throw new DOMException('Camera denied.', 'NotAllowedError'); }; });
  await page.locator('[data-spatial-ar]').click();
  await page.waitForFunction(() => !document.querySelector('.spatial-panel').hidden && document.querySelector('[data-spatial-status]').textContent.includes('Permission'));
  assert.equal(await page.evaluate(() => window.suspended), false, 'Camera startup failure restores the normal viewer');
  assert.ok(await page.locator('[data-quick-look-prepare]').isVisible(), 'Apple AR fallback remains available after a camera failure');
  assert.deepEqual(errors, []);
  console.log('Browser AR HUD, capture, placement and cleanup checks passed. Physical iPhone tracking still requires device validation.');
} finally { await browser.close(); await server.stop(); }
