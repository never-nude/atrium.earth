import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const base = process.env.ATRIUM_TEST_URL || 'http://127.0.0.1:4332';
const engine = process.env.ATRIUM_TEST_BROWSER || 'chromium';
const output = `${process.env.ATRIUM_TEST_OUTPUT || '/private/tmp/atrium-spatial-tests'}/${engine}`;
await mkdir(output, { recursive: true });
const browser = await ({ chromium, firefox, webkit })[engine].launch(engine === 'chromium'
  ? { channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] } : { headless: true });
async function allowLocalModelPreview(context) {
  if (process.env.ATRIUM_LOCAL_MODEL_CORS !== '1') return;
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'CORS accommodation is local QA only');
  await context.route('https://models.atrium.earth/**', async (route) => {
    const response = await route.fetch({ timeout: 60000 });
    assert.equal(response.status(), 200, 'Public model must be available without changing its contents');
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': new URL(base).origin } });
  });
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, ...(engine === 'chromium' ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}) });
  await allowLocalModelPreview(context);
  await context.addInitScript(() => { Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined }); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
  if (engine !== 'chromium') await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.__atriumClipboard = value; }, readText: async () => window.__atriumClipboard } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/works/egyptian/green-painted-ushebti-smvk/`);
  await page.locator('[data-stage].is-live').waitFor({ timeout: 90000 });
  await page.locator('[data-spatial-open]').click();
  await page.getByRole('button', { name: 'Use an AR phone', exact: true }).waitFor();
  assert.equal(await page.locator('[data-spatial-ar]').isEnabled(), true);
  assert.equal(await page.locator('[data-spatial-vr]').isEnabled(), true);
  await page.locator('.spatial-display > summary').click();
  assert.equal(await page.locator('[data-support-mode]').inputValue(), 'auto');
  await page.locator('[data-support-mode]').selectOption('surface');
  assert.equal(await page.locator('[data-support-height-control]').isVisible(), false);
  await page.locator('[data-support-mode]').selectOption('plinth');
  assert.equal(await page.locator('[data-support-height-control]').isVisible(), true);
  await page.locator('[data-support-height]').evaluate((input) => {
    input.value = '0.65'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await page.locator('[data-support-height-value]').textContent(), '65 cm');
  await page.locator('[data-spatial-ar]').click();
  assert.equal(await page.locator('[data-spatial-handoff]').getAttribute('open'), '');
  await page.locator('[data-spatial-copy]').click();
  await page.waitForFunction(() => document.querySelector('[data-spatial-link-status]').textContent.includes('Link copied'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://atrium.earth/works/egyptian/green-painted-ushebti-smvk/');
  const theme = await page.locator('[data-spatial-dialog]').evaluate(el => ({
    background: getComputedStyle(el).backgroundColor, font: getComputedStyle(el).fontFamily,
  }));
  assert.equal(theme.background, 'rgb(14, 22, 38)');
  assert.match(theme.font, /Inter/);
  await page.locator('.spatial-display > summary').click();
  await page.locator('[data-spatial-handoff] > summary').click();
  await page.screenshot({ path: `${output}/desktop.png` });
  await page.locator('[data-spatial-vr]').click();
  assert.match(await page.locator('[data-device-help]').textContent(), /headset/);
  await page.locator('[data-spatial-copy]').click();
  await page.waitForFunction(() => document.querySelector('[data-spatial-link-status]').textContent.includes('Link copied'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://atrium.earth/works/egyptian/green-painted-ushebti-smvk/');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); });
  await page.locator('[data-spatial-copy]').click();
  await page.waitForFunction(() => document.querySelector('[data-spatial-link-status]').textContent.includes('Select and copy'));
  assert.equal(await page.locator('[data-spatial-url]').inputValue(), 'https://atrium.earth/works/egyptian/green-painted-ushebti-smvk/');
  assert.equal(await page.locator('[data-spatial-url]').evaluate(el => el.selectionEnd - el.selectionStart), (await page.locator('[data-spatial-url]').inputValue()).length);
  await page.locator('[data-spatial-handoff] > summary').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-spatial-dialog]').isVisible(), false);
  await page.locator('[data-tool-rotate]').click();
  assert.equal(await page.locator('[data-stage].is-live canvas').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-spatial-open]').click();
  assert.equal(await page.locator('[data-spatial-dialog]').evaluate(el => el.scrollTop), 0);
  await page.screenshot({ path: `${output}/mobile.png` });
  await page.setViewportSize({ width: 320, height: 640 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow on a narrow mobile screen');
  assert.ok(await page.locator('[data-spatial-dialog]').evaluate(el => el.scrollWidth <= el.clientWidth), 'Dialog contents fit narrow mobile screens');
  await page.locator('[data-spatial-screen]').click();
  assert.equal(await page.locator('[data-spatial-dialog]').isVisible(), false);
  await page.waitForFunction(() => !document.body.classList.contains('spatial-modal-open')); // Native dialog close is queued.
  assert.equal(await page.locator('[data-spatial-open]').evaluate(el => el === document.activeElement), true, 'Focus returns to the viewer opener');
  await page.screenshot({ path: `${output}/mobile-screen.png` });
  assert.deepEqual(errors, []);
  await context.close();

  const capable = await browser.newContext();
  await allowLocalModelPreview(capable);
  await capable.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { configurable: true, value: {
      isSessionSupported: async () => true,
      requestSession: async () => { window.__xrUserGesture = navigator.userActivation.isActive; throw new DOMException('User declined', 'NotAllowedError'); },
      addEventListener() {},
    } });
  });
  const device = await capable.newPage();
  await device.goto(`${base}/works/asia/sutra-container-cleveland/`);
  await device.locator('[data-stage].is-live').waitFor({ timeout: 90000 });
  await device.locator('[data-spatial-open]').click();
  await device.getByRole('button', { name: 'Place in your room', exact: true }).waitFor();
  await device.locator('[data-spatial-ar]').click();
  await device.waitForFunction(() => document.querySelector('[data-spatial-status]').textContent.includes('Permission was not granted'));
  assert.equal(await device.evaluate(() => window.__xrUserGesture), true, 'XR starts inside the user gesture');
  assert.equal(await device.locator('[data-spatial-ar]').isEnabled(), true);
  assert.equal(await device.locator('[data-spatial-overlay]').isVisible(), false);
  await device.locator('[data-spatial-vr]').click();
  await device.waitForFunction(() => document.querySelector('[data-spatial-status]').textContent.includes('Permission was not granted'));
  await device.locator('[data-spatial-close]').click();
  assert.equal(await device.locator('[data-stage].is-live canvas').count(), 1);
  await capable.close();

  const apple = await browser.newContext();
  await allowLocalModelPreview(apple);
  await apple.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/147.0 Mobile/15E148 Safari/604.1' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Blocked', 'NotAllowedError'); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function(token) { return token === 'ar' ? false : supports.call(this, token); };
  });
  const quick = await apple.newPage();
  await quick.goto(`${base}/works/asia/sutra-container-cleveland/`);
  await quick.locator('[data-stage].is-live').waitFor({ timeout: 90000 });
  await quick.locator('[data-spatial-open]').click();
  await quick.locator('[data-spatial-handoff] > summary').click();
  await quick.locator('[data-spatial-share]').click();
  await quick.waitForFunction(() => document.querySelector('[data-spatial-link-status]').textContent.includes('Select and copy'));
  await quick.locator('[data-spatial-handoff] > summary').click();
  await quick.getByRole('button', { name: 'Prepare AR view', exact: true }).click();
  await quick.locator('[data-quick-look]:not([hidden])').waitFor({ timeout: 90000 });
  const exported = await quick.evaluate(async () => {
    const link = document.querySelector('[data-quick-look]');
    const blob = await (await fetch(link.href.split('#')[0])).blob();
    return { type: blob.type, size: blob.size, header: Array.from(new Uint8Array(await blob.slice(0, 2).arrayBuffer())), firstChild: link.firstElementChild.tagName };
  });
  assert.equal(exported.type, 'model/vnd.usdz+zip');
  assert.deepEqual(exported.header, [80, 75]);
  assert.ok(exported.size > 100000);
  assert.equal(exported.firstChild, 'IMG');
  assert.ok((await quick.locator('[data-quick-look]').getAttribute('href')).includes('allowsContentScaling=1'));
  assert.equal(await quick.locator('[data-quick-look]').getAttribute('download'), 'artwork.usdz');
  await quick.locator('.spatial-display > summary').click();
  await quick.locator('[data-support-mode]').selectOption('plinth');
  assert.equal(await quick.locator('[data-quick-look]').isVisible(), false, 'Changed furniture invalidates prepared Apple export');
  assert.equal(await quick.locator('[data-spatial-ar]').isVisible(), true);
  await quick.locator('[data-spatial-ar]').click();
  await quick.locator('[data-quick-look]:not([hidden])').waitFor({ timeout: 90000 });
  assert.ok((await quick.locator('[data-quick-look]').getAttribute('href')).includes('allowsContentScaling=0'), 'Apple cannot resize artwork and furniture together');
  await quick.locator('[data-support-height]').evaluate((input) => {
    input.value = '0.65'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal(await quick.locator('[data-quick-look]').isVisible(), false, 'Changing stand height invalidates prepared Apple export');
  assert.equal(await quick.locator('[data-support-height-value]').textContent(), '65 cm');
  console.log('Apple AR export prepared successfully:', exported.size, 'bytes');
  await quick.screenshot({ path: `${output}/quick-look.png` });
  await quick.locator('[data-spatial-close]').click();
  assert.equal(await quick.locator('[data-stage].is-live canvas').count(), 1);
  await apple.close();
  if (engine === 'chromium') {
    const recovery = await browser.newContext();
    await allowLocalModelPreview(recovery);
    await recovery.addInitScript(() => {
      Object.defineProperty(navigator, 'xr', { configurable: true, value: { isSessionSupported() { throw new Error('Unavailable API'); }, requestSession() {}, addEventListener() {} } });
    });
    let failModel = true;
    await recovery.route('**/*.glb', route => failModel ? route.abort() : route.fallback());
    const retryPage = await recovery.newPage();
    await retryPage.goto(`${base}/works/modern/dubuffet-la-chiffonniere/`);
    await retryPage.locator('[data-spatial-open]').click();
    await retryPage.locator('[data-spatial-retry]').waitFor({ timeout: 60000 });
    assert.equal(await retryPage.locator('[data-spatial-ar]').isEnabled(), true, 'Failed model and XR checks do not block device handoff');
    failModel = false;
    await retryPage.locator('[data-spatial-retry]').click();
    await retryPage.locator('[data-stage].is-live').waitFor({ timeout: 90000 });
    assert.equal(await retryPage.locator('[data-spatial-retry]').isVisible(), false);
    await retryPage.screenshot({ path: `${output}/dubuffet.png` });
    await recovery.close();
  }
  console.log(`${engine} browser checks passed: screen viewing, desktop/mobile fallback, canonical sharing, and permission denial. Screenshots: ${output}`);
} finally { await browser.close(); }
