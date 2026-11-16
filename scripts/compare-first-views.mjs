// Usage: node scripts/compare-first-views.mjs manifest.json output-directory
// The manifest contains {works:[{slug, orientation, original, candidate, views?}]}
// Each asset contains {path, bytes, sha256}; texture exposure comes from original.largestTexture.
// Additional fixed views take {id, azimuth, elevation, crop?: {x, y, size}} in degrees
// and normalized coordinates. All paths resolve from the manifest directory.
// Call this after conversion, before registering the candidate in the site.
// An exceeded threshold exits 1; a capture/identity error exits 2. Both hold the candidate.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { measureVisualDifference, visualThresholds } from './lib/first-view-visual-metrics.mjs';

const repository = fileURLToPath(new URL('..', import.meta.url));
const width = 720;
const defaultViews = [
  { id: 'opening', azimuth: 0, elevation: 0 },
  { id: 'left', azimuth: -45, elevation: 6 },
  { id: 'right', azimuth: 45, elevation: 6 },
  { id: 'back', azimuth: 180, elevation: 8 },
  { id: 'upper-detail', azimuth: -24, elevation: 0, crop: { x: .29, y: .10, size: .42 } },
  { id: 'lower-detail', azimuth: 24, elevation: 0, crop: { x: .29, y: .46, size: .42 } },
];
const slugs = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/;
const viewNames = /^[a-z0-9_-]+$/;
const mime = {
  '.glb': 'model/gltf-binary', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>First-view render</title>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module" src="/render.mjs"></script></html>`;

function sha256(file) {
  const hash = createHash('sha256');
  return new Promise((resolveHash, reject) => {
    createReadStream(file).on('data', bytes => hash.update(bytes)).on('error', reject)
      .on('end', () => resolveHash(hash.digest('hex')));
  });
}

async function verifiedAsset(asset, directory) {
  if (typeof asset?.path !== 'string' || extname(asset.path).toLowerCase() !== '.glb' ||
      !Number.isSafeInteger(asset.bytes) || asset.bytes < 20 || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
    throw new Error('Each asset must declare a GLB path, byte count and lowercase SHA-256');
  }
  const path = resolve(directory, asset.path);
  const info = await stat(path);
  if (!info.isFile() || info.size !== asset.bytes || await sha256(path) !== asset.sha256) {
    throw new Error(`GLB size or SHA-256 mismatch for ${path}`);
  }
  return { path, bytes: asset.bytes, sha256: asset.sha256 };
}

function matchedViews(additional = []) {
  const views = [...defaultViews, ...additional];
  const ids = new Set();
  for (const { id, azimuth, elevation, crop } of views) {
    if (!viewNames.test(id) || ids.has(id) || !Number.isFinite(azimuth) || !Number.isFinite(elevation) ||
        (crop && (![crop.x, crop.y, crop.size].every(Number.isFinite) || crop.x < 0 || crop.y < 0 ||
        crop.size <= 0 || crop.x + crop.size > 1 || crop.y + crop.size > 1))) {
      throw new Error('A matched view has an invalid or duplicate id, angle or crop');
    }
    ids.add(id);
  }
  return views;
}

function captureServer(files) {
  const roots = new Map([
    ['/three/', join(repository, 'node_modules', 'three')],
    ['/draco/', join(repository, 'public', 'vendor', 'draco')],
  ]);
  const paths = new Map([
    ['/render.mjs', fileURLToPath(new URL('./lib/first-view-render.mjs', import.meta.url))],
    ['/model-render-utils.js', join(repository, 'public', 'model-render-utils.js')],
  ]);
  return createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (request.method !== 'GET') {
        response.writeHead(405).end();
        return;
      }
      if (path === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
        return;
      }
      let file = files.get(path) || paths.get(path);
      if (!file) {
        for (const [prefix, root] of roots) {
          if (!path.startsWith(prefix)) continue;
          const local = resolve(root, decodeURIComponent(path.slice(prefix.length)));
          if (local.startsWith(root + sep)) file = local;
          break;
        }
      }
      if (!file) {
        response.writeHead(404).end();
        return;
      }
      const { size } = await stat(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Content-Length': size, 'Cache-Control': 'no-store' });
      const stream = createReadStream(file);
      stream.on('error', error => response.destroy(error));
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(404).end();
      else response.destroy();
    }
  });
}

async function capture(page, input) {
  let timer;
  try {
    return await Promise.race([
      page.evaluate(args => window.captureFirstView(args), input),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`First-attempt rendering timed out for ${input.url}`)), 120_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function saveComparison(directory, id, original, candidate, heatmap) {
  const source = Buffer.from(original.png, 'base64');
  const delivery = Buffer.from(candidate.png, 'base64');
  const background = { r: 25, g: 36, b: 58 };
  const panels = await Promise.all([source, delivery].map(buffer => sharp(buffer).flatten({ background }).png().toBuffer()));
  const comparison = `${id}-original-candidate-difference.png`;
  await sharp({ create: { width: width * 3, height: width, channels: 3, background } })
    .composite([...panels, heatmap].map((input, index) => ({ input, top: 0, left: width * index })))
    .png().toFile(join(directory, comparison));
  return comparison;
}

async function probeWork(browser, origin, files, work, directory, outputDirectory) {
  const [original, candidate] = await Promise.all(['original', 'candidate'].map(key => verifiedAsset(work[key], directory)));
  const views = matchedViews(work.views);
  const result = { slug: work.slug, original, candidate, views: [], hold: false, elapsedMs: 0 };
  const started = Date.now();
  const folder = join(outputDirectory, work.slug);
  await mkdir(folder, { recursive: true });
  files.set('/original.glb', original.path);
  files.set('/candidate.glb', candidate.path);
  const page = await browser.newPage();
  try {
    await page.route('**/*', route => route.request().url().startsWith(origin + '/')
      ? route.continue() : route.abort());
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.captureFirstView === 'function', {}, { timeout: 10_000 });
    const common = { orientation: work.orientation, views, width, exposure: work.original.largestTexture ? 1 : .52 };
    const from = await capture(page, { ...common, url: '/original.glb' });
    const to = await capture(page, { ...common, url: '/candidate.glb', placement: from.placement });
    for (let index = 0; index < views.length; index += 1) {
      const originalRender = from.views[index];
      const candidateRender = to.views[index];
      const { scores, exceeded, patch, heatmap } = await measureVisualDifference(
        Buffer.from(originalRender.png, 'base64'), Buffer.from(candidateRender.png, 'base64'));
      const id = views[index].id;
      const comparison = await saveComparison(folder, id, originalRender, candidateRender, heatmap);
      result.views.push({ ...views[index], scores, exceeded, patch, comparison,
        originalTriangles: originalRender.triangles, candidateTriangles: candidateRender.triangles });
    }
    result.hold = result.views.some(({ exceeded }) => exceeded.length > 0);
  } finally {
    await page.close();
    files.clear();
  }
  result.elapsedMs = Date.now() - started;
  return result;
}

async function run() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node scripts/compare-first-views.mjs manifest.json output-directory');
  const manifest = JSON.parse(await readFile(input, 'utf8'));
  const directory = dirname(resolve(input));
  const outputDirectory = resolve(output);
  const keys = manifest.works?.map(work => work.slug);
  if (!keys?.length || keys.some(key => typeof key !== 'string' || !slugs.test(key)) || new Set(keys).size !== keys.length) {
    throw new Error('Manifest needs a non-empty works list with unique slugs');
  }
  await mkdir(outputDirectory, { recursive: true });
  const files = new Map();
  const server = captureServer(files);
  await new Promise((ready, reject) => server.once('error', reject).listen(0, '127.0.0.1', ready));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const report = { schema: 'atrium-first-view-visual/1', width, thresholds: visualThresholds, works: [] };
  let browser;
  try {
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    for (const work of manifest.works) {
      const result = await probeWork(browser, origin, files, work, directory, outputDirectory)
        .catch(error => ({ slug: work.slug, hold: true, error: error.message }));
      report.works.push(result);
      console.log(result.error ? 'ERROR' : result.hold ? 'HOLD' : 'PASS', result.slug, result.error || '');
      await writeFile(join(outputDirectory, 'visual-report.json'), JSON.stringify(report, null, 2) + '\n');
    }
  } finally {
    await browser?.close();
    await new Promise(ready => server.close(ready));
  }
  process.exitCode = report.works.some(work => work.error) ? 2 : report.works.some(work => work.hold) ? 1 : 0;
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 2;
});
