import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dev } from 'astro';
import { chromium } from 'playwright';
import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { spatialPaletteColor } from '../src/lib/spatial-materials.mjs';

// Use the real Viewer and AR button, not a replacement context. Archived source
// meshes must match the page's SHA-256 integrity check. This checks the actual
// handoff file, but does not emulate Apple's renderer or environmental lighting.
const modelRoot = process.env.ATRIUM_REVIEW_MODELS || '/tmp/atrium-model-review';
const output = process.env.ATRIUM_NATIVE_OUTPUT || '/tmp/atrium-native-material-transfer';
const cases = [
  { slug: 'rodin/the-thinker', generated: true },
  { slug: 'europe/venus-of-willendorf-nhmw-44-686', generated: true },
  { slug: 'michelangelo/david', generated: true },
  { slug: 'egyptian/seated-scribe-e3023-louvre', generated: false },
];
function primBody(text, type, name) {
  const start = text.indexOf(`def ${type} "${name}"`);
  assert.ok(start >= 0, `Export includes ${name}`);
  const opening = text.indexOf('{', start);
  let end = opening + 1, depth = 1;
  while (end < text.length && depth) {
    if (text[end] === '{') depth++;
    if (text[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return text.slice(start, end);
}
await mkdir(output, { recursive: true });
const server = await dev({ root: new URL('../', import.meta.url), devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4337 }, vite: { server: { watch: null, hmr: false } }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: process.env.ATRIUM_TEST_EXECUTABLE,
  headless: true, args: ['--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const record of cases) {
    const source = await readFile(join(modelRoot, record.slug, 'preview.glb'));
    const sha256 = createHash('sha256').update(source).digest('hex');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1' });
    try {
      await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async route => {
        const path = new URL(route.request().url()).pathname;
        if (path === `/models/previews/${record.slug}/preview.glb`) {
          await route.fulfill({ body: source, contentType: 'model/gltf-binary', headers: { 'access-control-allow-origin': '*' } });
        } else await route.abort();
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined });
        const supports = DOMTokenList.prototype.supports;
        DOMTokenList.prototype.supports = function (token) { return token === 'ar' || supports.call(this, token); };
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', async message => {
        if (message.type() === 'warning' && message.text().includes('Quick Look')) console.error(message.text());
      });
      await page.goto(`http://127.0.0.1:4337/works/${record.slug}/`);
      const stage = page.locator('[data-stage]').first();
      assert.equal(await stage.getAttribute('data-spatial-asset-sha256'), sha256, 'Test source is the exact catalogued asset');
      const appearance = JSON.parse(await stage.getAttribute('data-material-appearance'));
      await page.waitForFunction(() => Boolean(document.querySelector('[data-spatial-url]')?.value));
      await page.locator('[data-spatial-open]').tap();
      const prepare = page.getByRole('button', { name: 'Prepare AR view', exact: true });
      await prepare.waitFor({ timeout: 60000 }).catch(async error => {
        console.error('AR entry failed:', record.slug, await page.locator('[data-spatial-status]').textContent(),
          await page.locator('[data-spatial-ar]').textContent(), errors);
        await page.screenshot({ path: join(output, 'entry-failure.png') });
        throw error;
      });
      await page.waitForFunction(() => !document.querySelector('[data-spatial-ar]')?.disabled, null, { timeout: 60000 });
      await prepare.tap();
      const link = page.locator('[data-quick-look]:not([hidden])');
      await link.waitFor({ timeout: 60000 });
      const href = await link.getAttribute('href');
      const filename = `${record.slug.replaceAll('/', '__')}.usdz`;
      const downloading = page.waitForEvent('download');
      await page.evaluate(({ href, filename }) => {
        const download = document.createElement('a');
        download.href = href.split('#')[0]; download.download = filename;
        document.body.append(download); download.click(); download.remove();
      }, { href, filename });
      await (await downloading).saveAs(join(output, filename));
      const archive = unzipSync(await readFile(join(output, filename)));
      const usd = strFromU8(archive['model.usda']);
      const artwork = primBody(usd, 'Xform', 'Artwork');
      const ids = [...artwork.matchAll(/rel material:binding = <\/Materials\/([^>]+)>/g)].map(match => match[1]);
      assert.ok(ids.length, 'Actual sculpture meshes have material bindings');
      const surfaces = [];
      for (const id of new Set(ids)) {
        const material = primBody(usd, 'Material', id);
        if (record.generated) {
          assert.doesNotMatch(material, /diffuseColor.connect|AtriumVertexColor|UsdPrimvarReader_float3/);
          const diffuse = material.match(/color3f inputs:diffuseColor = \(([^)]+)\)/)[1].split(',').map(Number);
          const expected = spatialPaletteColor(THREE, appearance).toArray();
          diffuse.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${record.slug}: native material has intended color`));
          const metallic = Number(material.match(/float inputs:metallic = ([^\n]+)/)[1]);
          const roughness = Number(material.match(/float inputs:roughness = ([^\n]+)/)[1]);
          assert.equal(metallic, appearance.metalness);
          assert.equal(roughness, Math.max(.48, Math.min(.85, appearance.roughness)));
          surfaces.push({ diffuse, metallic, roughness });
        } else {
          assert.match(material, /inputs:diffuseColor.connect = <[^>]+Texture_[^>]+_diffuse.outputs:rgb>/, 'Authored scan still uses its original color texture');
          surfaces.push({ textured: true });
        }
      }
      assert.match(usd, /int preferredIblVersion = 2/);
      assert.match(usd, /def Xform "MuseumLabelFront"/);
      assert.match(usd, /def Xform "MuseumLabelBack"/);
      const textures = Object.keys(archive).filter(name => name.startsWith('textures/')).length;
      assert.ok(textures >= (record.generated ? 1 : 2), 'Label and original scan textures are included');
      if (record.generated) {
        for (const [name, bytes] of Object.entries(archive)) if (name.startsWith('geometries/')) {
          assert.doesNotMatch(strFromU8(bytes), /primvars:displayColor/, 'No alternate generated color channel');
        }
      }
      await page.setViewportSize({ width: 844, height: 390 });
      await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
      assert.equal(await link.getAttribute('href'), href, 'Landscape reuses the same handoff file');
      assert.deepEqual(errors, []);
      results.push({ slug: record.slug, sourceSha256: sha256, surfaces, textures, rotationKeepsFile: true });
      console.log(`Verified actual AR handoff: ${record.slug}`);
    } finally { await context.close(); }
  }
  await writeFile(join(output, 'results.json'), JSON.stringify({ scope: 'Actual page/Viewer/AR handoff using byte-verified archived models. Serialized material checks, not native Apple rendering.', results }, null, 2) + '\n');
} finally { await browser.close(); await server.stop(); }
