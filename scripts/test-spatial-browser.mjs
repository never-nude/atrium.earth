import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.ATRIUM_TEST_URL || 'http://127.0.0.1:4332';
const output = process.env.ATRIUM_TEST_OUTPUT || '/private/tmp/atrium-spatial-tests';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await allowLocalModelPreview(context);
  await context.addInitScript(() => { Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined }); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/works/egyptian/green-painted-ushebti-smvk/`);
  await page.locator('[data-stage].is-live').waitFor({ timeout: 90000 });
  await page.locator('[data-spatial-open]').click();
  await page.getByRole('button', { name: 'Open on an AR phone', exact: true }).waitFor();
  assert.equal(await page.locator('[data-spatial-ar]').isEnabled(), true);
  assert.equal(await page.locator('[data-spatial-vr]').isDisabled(), true);
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
  await page.waitForFunction(() => document.querySelector('[data-spatial-status]').textContent.includes('Link copied'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://atrium.earth/works/egyptian/green-painted-ushebti-smvk/');
  await page.screenshot({ path: `${output}/desktop.png` });
  await page.locator('[data-spatial-share]').click();
  await page.waitForFunction(() => document.querySelector('[data-spatial-status]').textContent.includes('Link copied'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://atrium.earth/works/egyptian/green-painted-ushebti-smvk/');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-spatial-dialog]').isVisible(), false);
  await page.locator('[data-tool-rotate]').click();
  assert.equal(await page.locator('[data-stage].is-live canvas').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-spatial-open]').click();
  await page.screenshot({ path: `${output}/mobile.png` });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow on mobile');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${output}/mobile-screen.png` });
  assert.deepEqual(errors, []);
  await context.close();

  const capable = await browser.newContext();
  await allowLocalModelPreview(capable);
  await capable.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { configurable: true, value: {
      isSessionSupported: async () => true,
      requestSession: async () => { throw new DOMException('User declined', 'NotAllowedError'); },
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
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function(token) { return token === 'ar' || supports.call(this, token); };
  });
  const quick = await apple.newPage();
  await quick.goto(`${base}/works/asia/sutra-container-cleveland/`);
  await quick.locator('[data-stage].is-live').waitFor({ timeout: 90000 });
  await quick.locator('[data-spatial-open]').click();
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
  console.log(`Browser checks passed: screen viewing, desktop/mobile fallback, canonical sharing, and permission denial. Screenshots: ${output}`);
} finally { await browser.close(); }
