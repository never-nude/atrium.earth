import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

// Integration checks against the built site. Model URLs are fulfilled from
// local GLB fixtures, so renderer/layout checks do not depend on the CDN. This
// tests the interface and does not assert live production asset byte identity.
const root = resolve(import.meta.dirname, '..');
const mirrorRoot = process.env.EXHIBITION_MODEL_MIRRORS || join(root, 'public');
const data = JSON.parse(await fs.readFile(join(root, 'src/data/v3-content.json'), 'utf8'));
const exhibition = data.additionalExhibitions.find((entry) => entry.slug === 'michelangelo-and-rodin');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, 'dist', '.' + (path.endsWith('/') ? path + 'index.html' : path));
  if (!file.startsWith(join(root, 'dist') + '/')) { res.writeHead(403).end(); return; }
  try { const bytes = await fs.readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(bytes); }
  catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
  headless: true,
  args: ['--no-sandbox', '--no-zygote', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const failures = [];
const report = { pairings: exhibition.comparisons.length, works: exhibition.works.length, modelAssetMode: 'local GLB fixtures', layouts: [], interactiveModels: 0, regression: {} };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('response', (response) => { if (response.url().startsWith(origin) && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.route('https://models.atrium.earth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    try { await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: await fs.readFile(join(mirrorRoot, path)) }); }
    catch { failures.push(`Missing local model fixture: ${path}`); await route.abort(); }
  });
  await page.route('https://cloud.umami.is/**', (route) => route.abort());
  await page.goto(origin + '/exhibitions/michelangelo-and-rodin/');
  assert.equal(await page.locator('.comparison').count(), 6);
  assert.equal(await page.locator('.comparison [data-viewer]').count(), 12);
  assert.equal(await page.locator('.exhibition-pair-index a').count(), 6);
  const links = await page.locator('.comparison__notes a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  assert.deepEqual(new Set(links), new Set(exhibition.works.map((work) => `/works/${work.slug}/`)));

  // Exercise the opening and final pairs: two CDN models together, then a
  // locally served cast alongside a CDN model. Other pairs share this renderer.
  for (const index of [0, 5]) {
    console.log(`Checking paired models ${index + 1}/6`);
    const pair = page.locator('.comparison').nth(index);
    await pair.locator('.comparison__models').scrollIntoViewIfNeeded();
    await pair.locator('[data-stage].is-live').nth(1).waitFor({ timeout: 60000 });
    report.interactiveModels += await pair.locator('[data-stage].is-live').count();
  }
  assert.equal(report.interactiveModels, 4);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width > 650 ? 1000 : 844 });
    const pair = page.locator('#pair-1');
    await pair.locator('.comparison__models').scrollIntoViewIfNeeded();
    const bounds = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      pairs: [...document.querySelectorAll('.comparison__models')].map((row) => [...row.querySelectorAll('.comparison__viewer')].map((child) => { const r = child.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, width: r.width }; })),
    }));
    assert(bounds.document <= bounds.viewport + 1, `Page overflows at ${width}px`);
    for (const [a, b] of bounds.pairs) {
      assert(a.width > 0 && b.width > 0 && Math.abs(a.top - b.top) < 1, `Models are not side by side at ${width}px`);
      assert(a.left >= 0 && a.right <= b.left + 1 && b.right <= width + 1, `Pair overflows at ${width}px`);
    }
    for (const button of await pair.locator('.immersive-tools button:visible').all()) {
      const box = await button.boundingBox();
      assert(box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1, `Control clipped at ${width}px`);
    }
    const canvas = pair.locator('.viewer-canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .4, box.y + box.height * .4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .55, { steps: 5 });
    await page.mouse.up();
    await pair.locator('[data-tool-reset]:visible').first().click();
    await pair.locator('summary').click();
    assert(await pair.locator('details[open]').count());
    await pair.locator('summary').click();
    report.layouts.push({ width, sideBySidePairs: 6, controls: 'pass' });
    if (process.env.EXHIBITION_QA_OUTPUT) {
      await fs.mkdir(process.env.EXHIBITION_QA_OUTPUT, { recursive: true });
      await pair.screenshot({ path: join(process.env.EXHIBITION_QA_OUTPUT, `pair-${width}.png`) });
    }
  }

  // The optional comparison format must not replace the existing linear walk.
  const standardExhibition = await fs.readFile(join(root, 'dist/exhibitions/bodies-in-motion/index.html'), 'utf8');
  assert.match(standardExhibition, /class="[^"]*\bv3-stop\b/);
  assert.doesNotMatch(standardExhibition, /class="[^"]*\bcomparison-walk\b/);
  report.regression.standardExhibition = 'pass';
  const directory = await fs.readFile(join(root, 'dist/exhibitions/index.html'), 'utf8');
  assert.equal((directory.match(/href="\/exhibitions\/michelangelo-and-rodin\/"/g) || []).length, 1);
  report.regression.directory = 'pass';
  assert.deepEqual(errors, [], 'Browser errors');
  assert.deepEqual(failures, [], 'Exhibition asset failures');
  report.errors = errors;
  report.assetFailures = failures;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ errors, assetFailures: failures }, null, 2));
  throw error;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
