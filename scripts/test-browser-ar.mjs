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
    model.add(new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .08), new THREE.MeshStandardMaterial({ color: 0xf7f5ef, alphaTest: .5 })));
    const box = new THREE.Box3().setFromObject(model);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: .15 }));
    const grid = new THREE.GridHelper(2, 10);
    scene.add(model, ground, grid, new THREE.HemisphereLight(0xffffff, 0x888888, 3));
    const saved = { parent: model.parent, canvasParent: renderer.domElement.parentNode, camera: camera.clone(), material: model.children[0].material, exposure: renderer.toneMappingExposure };
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
    // The engine's setHitResult populates position and distance, leaving the
    // rotation unset (all four components default to zero in Quaternion32f).
    // An identity quaternion here concealed the real iPhone placement failure.
    window.fixtureHits = [{ type: 'FEATURE_POINT', distance: 1, position: { x: 0, y: 0, z: -1 }, rotation: { x: 0, y: 0, z: 0, w: 0 } }];
    const fake = {
      initialize: async () => {}, clearCameraPipelineModules: () => { modules = []; },
      addCameraPipelineModules: value => { modules = value; },
      XrConfig: { device: () => ({ MOBILE: 'mobile' }), camera: () => ({ BACK: 'back' }) },
      XrController: { configure: config => { window.trackingConfig = config; }, updateCameraProjectionMatrix() {},
        pipelineModule: () => ({ name: 'reality' }), hitTest: () => window.fixtureHits },
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
    window.readArtworkPixel = () => new Promise((resolve, reject) => {
      const { THREE, scene, model, camera, renderer } = window.fixture;
      const previous = scene.onAfterRender;
      const timer = setTimeout(() => { scene.onAfterRender = previous; reject(new Error('Sculpture did not render')); }, 2000);
      scene.onAfterRender = () => {
        clearTimeout(timer); scene.onAfterRender = previous;
        const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()).project(camera);
        const canvas = renderer.domElement, gl = renderer.getContext(), pixel = new Uint8Array(4);
        gl.readPixels(Math.floor((center.x + 1) * canvas.width / 2), Math.floor((center.y + 1) * canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        resolve([...pixel]);
      };
    });
  });
  for (const [width, height] of [[390, 844], [844, 390], [568, 320], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.locator('[data-spatial-ar]').click();
    await page.waitForFunction(() => document.querySelector('[data-spatial-instructions]').textContent.includes('Surface found'), null, { timeout: 5000 });
    const label = page.locator('[data-spatial-screen-label]');
    const place = page.locator('[data-spatial-confirm-placement]');
    assert.equal(await label.isVisible(), false, 'The five-field label is hidden before placement');
    assert.equal(await place.isEnabled(), true, 'A tracked feature point with a zero rotation enables Place work');
    assert.equal(await page.locator('[data-spatial-proposed-size]').isVisible(), true);
    assert.match(await page.locator('[data-spatial-dimensions]').textContent(), /^11 × 5.5 × 4.4 cm$/, 'Proposed H × W × D follows the actual model bounds and physical reference');
    assert.ok(await place.evaluate(element => getComputedStyle(element).backgroundColor === 'rgb(236, 207, 122)'), 'Ready button lights up in Atrium gold');
    assert.ok(await page.evaluate(() => window.fixture.model.children[0].material.opacity < .5 && window.fixture.renderer.toneMappingExposure === window.fixtureSaved.exposure), 'Preview is faint without changing camera or renderer exposure');
    assert.ok(await page.evaluate(() => window.fixture.model.children[0].material.alphaTest < window.fixture.model.children[0].material.opacity), 'Cutout materials remain visible in the faint preview');
    const previewPixel = await page.evaluate(() => window.readArtworkPixel());
    assert.ok(previewPixel[0] > 75, 'The faint sculpture is actually drawn over the camera pixels');
    if (width === 390) {
      await page.evaluate(() => { window.savedHits = window.fixtureHits; window.fixtureHits = []; });
      await page.waitForFunction(() => document.querySelector('[data-spatial-confirm-placement]').disabled);
      assert.equal(await page.locator('[data-spatial-proposed-size]').isVisible(), false, 'No dimensions are shown without a suitable surface');
      assert.equal(await page.evaluate(() => window.fixture.model.parent.parent.visible), false);
      await page.screenshot({ path: `${output}/scanning.png` });
      await page.evaluate(() => { window.fixtureHits = [{ ...window.savedHits[0], rotation: undefined }]; });
      await page.waitForFunction(() => !document.querySelector('[data-spatial-confirm-placement]').disabled);
      assert.equal(await page.evaluate(() => window.fixture.model.parent.parent.visible), true, 'Missing orientation also permits a valid feature-point preview');
      await page.evaluate(() => { window.fixtureHits = [{ ...window.savedHits[0], position: { x: 0, y: .5, z: -1 } }]; });
      await page.waitForFunction(() => document.querySelector('[data-spatial-confirm-placement]').disabled);
      assert.equal(await page.evaluate(() => window.fixture.model.parent.parent.visible), false, 'Points above the phone do not enable floor/table placement');
      await page.evaluate(() => { window.fixtureHits = [{ ...window.savedHits[0], rotation: { x: NaN, y: 0, z: 0, w: 1 } }]; });
      await page.waitForTimeout(100);
      assert.equal(await place.isEnabled(), false, 'Malformed orientation is rejected instead of silently treated as unknown');
      await page.evaluate(() => { window.fixtureHits = [{ ...window.savedHits[0], rotation: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } }]; });
      await page.waitForTimeout(100);
      assert.equal(await place.isEnabled(), false, 'A wall estimate cannot enable placement');
      await page.evaluate(() => { window.fixtureHits = window.savedHits; window.fixturePose.trackingStatus = 'LIMITED'; });
      await page.waitForTimeout(100);
      assert.equal(await place.isEnabled(), false, 'Tracking must be normal before placement');
      await page.evaluate(() => { window.fixturePose.trackingStatus = 'NORMAL'; });
      await page.waitForFunction(() => !document.querySelector('[data-spatial-confirm-placement]').disabled);
      await page.evaluate(() => { window.fixtureHits = []; document.querySelector('[data-spatial-confirm-placement]').click(); });
      assert.equal(await label.isVisible(), false, 'A stale enabled button rechecks the surface at the tap');
      assert.equal(await place.isEnabled(), false);
      await page.evaluate(() => { window.fixtureHits = window.savedHits; });
      await page.waitForFunction(() => !document.querySelector('[data-spatial-confirm-placement]').disabled);
    }
    await page.screenshot({ path: `${output}/ready-${width}.png` });
    await page.locator('[data-browser-ar-canvas]').tap({ position: { x: width / 2, y: height * .58 } });
    assert.equal(await label.isVisible(), false, 'Incidental camera taps never commit placement');
    await place.tap();
    await page.waitForFunction(() => !document.querySelector('[data-spatial-photo-capture]').disabled);
    assert.equal(await page.locator('[data-spatial-proposed-size]').isVisible(), false, 'Dimensions clear once the work is placed');
    assert.equal(await place.isVisible(), false);
    assert.ok(await page.evaluate(() => window.fixture.model.children[0].material === window.fixtureSaved.material && window.fixture.renderer.toneMappingExposure === window.fixtureSaved.exposure), 'Placement restores the exact original material and normal exposure');
    const placedPixel = await page.evaluate(() => window.readArtworkPixel());
    assert.ok(placedPixel[0] > previewPixel[0] + 30, 'The placed sculpture is visibly restored to normal brightness');
    const before = await label.boundingBox();
    const footer = await page.locator('[data-spatial-photo-capture]').boundingBox();
    assert.ok(before.y > 0 && before.y + before.height <= footer.y - 12, 'Bottom label stays above and clear of the shutter row');
    assert.ok((await page.locator('[data-spatial-exit]').boundingBox()).y >= height - 78, 'Exit is in the bottom row; no HUD control remains at the top');
    if (width === 844) {
      const adaptive = await page.evaluate(async () => {
        const { createScreenArtworkLabel } = await import('/src/lib/spatial-screen-label.mjs');
        const overlay = document.querySelector('[data-spatial-overlay]');
        const metadata = JSON.parse(document.querySelector('[data-spatial]').dataset.artworkLabelJson);
        const hud = createScreenArtworkLabel(overlay, metadata), canvas = overlay.lastElementChild;
        const read = () => ({ side: canvas.dataset.labelPosition, ...canvas.getBoundingClientRect().toJSON() });
        const rightWork = { left: 550, right: 700, top: 110, bottom: 270 };
        const leftWork = { left: 100, right: 250, top: 110, bottom: 270 };
        const wideWork = { left: 160, right: 684, top: 85, bottom: 145 };
        hud.updatePlacement(rightWork, 0); const left = read();
        hud.updatePlacement(leftWork, 100); hud.updatePlacement(leftWork, 300); const pending = read();
        hud.updatePlacement(leftWork, 500); const right = read();
        hud.updatePlacement({ ...leftWork, left: 104, right: 254 }, 900); const steady = read();
        hud.updatePlacement(wideWork, 1000); hud.updatePlacement(wideWork, 1400); const below = read();
        const crowdedWork = { left: 0, right: 844, top: 0, bottom: 390 };
        hud.updatePlacement(crowdedWork, 1500); hud.updatePlacement(crowdedWork, 1900); const crowded = read();
        const lowWork = { left: 550, right: 700, top: 260, bottom: 290 };
        hud.updatePlacement(lowWork, 2000); hud.updatePlacement(lowWork, 2800); const low = read();
        hud.dispose();
        return { left, pending, right, steady, below, crowded, low };
      });
      assert.equal(adaptive.left.side, 'left'); assert.ok(adaptive.left.right <= 550 - 24);
      assert.deepEqual(adaptive.pending, adaptive.left, 'Brief changes do not make the label jump');
      assert.equal(adaptive.right.side, 'right'); assert.ok(adaptive.right.left >= 250 + 24);
      assert.deepEqual(adaptive.steady, adaptive.right, 'Minor camera motion preserves a clear label position');
      assert.equal(adaptive.below.side, 'below'); assert.ok(adaptive.below.top >= 145 + 24);
      assert.ok(adaptive.crowded.top > 100 && adaptive.crowded.bottom <= footer.y - 12, 'Crowded views use the bottom, never a top banner or the shutter row');
      assert.equal(adaptive.low.side, 'left'); assert.ok(adaptive.low.right <= 550 - 24 && adaptive.low.bottom >= 260, 'Side space remains usable when the sculpture is low in a landscape view');
    }
    await page.evaluate(() => { window.fixturePose.position.x = .1; window.fixturePose.rotation.y = .1; window.fixturePose.rotation.w = Math.sqrt(.99); });
    await page.locator('.spatial-overlay-controls').evaluate(element => { element.open = true; });
    await page.locator('[data-spatial-turn]').click();
    await page.locator('.spatial-overlay-controls').evaluate(element => { element.open = false; });
    const moved = await label.boundingBox();
    assert.equal(moved.width, before.width); assert.equal(moved.height, before.height);
    assert.equal(await label.evaluate(element => getComputedStyle(element).transform), 'none', 'Adaptive label stays upright while the camera and sculpture move');
    await page.waitForTimeout(800);
    const shutter = page.locator('[data-spatial-photo-capture]');
    assert.ok(await shutter.evaluate(element => { const rect = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); }), 'Shutter is touchable');
    await shutter.tap();
    await page.locator('[data-spatial-photo-review]:not([hidden])').waitFor();
    for (const control of ['[data-spatial-photo-review]', '[data-spatial-exit]']) assert.ok(await page.locator(control).evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), 'Photo review and exit are independently touchable in the bottom row');
    const result = await page.evaluate(async () => {
      const image = document.querySelector('[data-spatial-photo-preview]'); await image.decode();
      const photo = document.createElement('canvas'); photo.width = image.naturalWidth; photo.height = image.naturalHeight;
      const ctx = photo.getContext('2d'); ctx.drawImage(image, 0, 0);
      const rect = document.querySelector('[data-spatial-screen-label]').getBoundingClientRect();
      const view = document.querySelector('[data-browser-ar-canvas]').getBoundingClientRect();
      const scale = photo.width / view.width;
      return { width: photo.width, height: photo.height, label: [...ctx.getImageData((rect.x + 4) * scale, (rect.y + 4) * scale, 1, 1).data], camera: [...ctx.getImageData(5, photo.height / 2, 1, 1).data], data: photo.toDataURL() };
    });
    assert.equal(Math.round(result.width / result.height * 100), Math.round(width / height * 100), 'Photo follows the current phone orientation');
    assert.ok(result.camera[1] > 100 && result.camera[1] - result.label[1] > 30, 'Camera pixels and fixed-position HUD are both captured');
    await writeFile(`${output}/photo-${width}.png`, Buffer.from(result.data.split(',')[1], 'base64'));
    await page.screenshot({ path: `${output}/hud-${width}.png` });
    if (width === 568) {
      const catalogue = await page.evaluate(async (labels) => {
        const { createScreenArtworkLabel } = await import('/src/lib/spatial-screen-label.mjs');
        const overlay = document.querySelector('[data-spatial-overlay]');
        const decoder = document.createElement('textarea');
        const failures = [];
        const maxBottom = document.querySelector('[data-spatial-photo-capture]').getBoundingClientRect().top - 12;
        for (const encoded of labels) {
          decoder.innerHTML = encoded;
          const label = JSON.parse(decoder.value);
          const hud = createScreenArtworkLabel(overlay, label);
          const canvas = overlay.lastElementChild;
          const rect = canvas.getBoundingClientRect();
          if (rect.top < 0 || rect.bottom > maxBottom || rect.left < 0 || rect.right > innerWidth) failures.push(label.title);
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
      await page.evaluate(() => { document.querySelector('.spatial-overlay-controls').open = true; });
      await page.locator('[data-spatial-place]').tap();
      await page.waitForFunction(() => !document.querySelector('[data-spatial-confirm-placement]').disabled);
      assert.equal(await label.isVisible(), false, 'Reposition returns to the preview state');
      assert.ok(await page.evaluate(() => window.fixture.model.children[0].material.opacity < .5));
      await place.tap();
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
