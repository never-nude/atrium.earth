// Prepare one explicitly selected work in a new local output directory.
// node scripts/prepare-first-view.mjs request.json output-directory
// Request: {slug, material, maxTriangles, original: {path, bytes, sha256}, views?}.
// Use material "painted", "plain" (including plaster, marble and bronze), or
// "other" (preserve its texture by default). Paths resolve from request.json.
// An eligible.json receipt exists only after the matched-view gate passes.
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import orientations from '../src/data/orientations.json' with { type: 'json' };
import previews from '../src/data/previews.json' with { type: 'json' };
import { FIRST_VIEW_MAX_TEXTURE_EDGE, firstViewFor, firstViewMaxBytes } from '../src/lib/first-view-models.mjs';
import { AUTO_START_MODEL_LIMIT } from '../src/lib/viewer-preview.mjs';
import { measureGlb } from './lib/measure-first-view-glb.mjs';

const optimizer = fileURLToPath(new URL('../node_modules/.bin/gltf-transform', import.meta.url));
const visualGate = fileURLToPath(new URL('./compare-first-views.mjs', import.meta.url));
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
const run = promisify(execFile);

function plansFor(material, source, maxTriangles) {
  const textureEdge = Math.max(source.largestTexture?.width ?? 0, source.largestTexture?.height ?? 0);
  const reduceTextures = material === 'plain' && textureEdge > 0;
  if (!reduceTextures && textureEdge > FIRST_VIEW_MAX_TEXTURE_EDGE) {
    throw new Error('Preserving the source texture exceeds the existing texture budget. Hold for review.');
  }
  const resizedEdges = reduceTextures
    ? [FIRST_VIEW_MAX_TEXTURE_EDGE, 1536, 1024].filter(edge => edge < textureEdge)
    : [];
  const texturePlans = resizedEdges.map(edge => ({ edge, format: 'webp' }));
  if (textureEdge <= FIRST_VIEW_MAX_TEXTURE_EDGE) {
    texturePlans.unshift({ edge: FIRST_VIEW_MAX_TEXTURE_EDGE, format: 'false' });
  }
  const isPlain = material === 'plain';
  const tolerance = isPlain ? .005 : .001;
  const startingRatio = Math.min(1, maxTriangles / source.triangles);
  const initial = texturePlans.map(texture => ({ ...texture, ratio: startingRatio, tolerance }));
  const factors = isPlain ? [.8, .6, .45, .3, .2, .12] : [.9, .8, .65, .5];
  const simplify = factors.map(factor => ({
    ...texturePlans.at(-1), ratio: startingRatio * factor, tolerance,
  }));
  return [...initial, ...simplify];
}

function assertPreserved(source, candidate, material, plan) {
  const contains = (original, prepared) => original.every(value => prepared.includes(value));
  if (!contains(source.attributes, candidate.attributes) || !contains(source.textureSlots, candidate.textureSlots) ||
      source.materialCount !== candidate.materialCount || source.primitives !== candidate.primitives ||
      (plan.ratio === 1 && source.triangles !== candidate.triangles)) {
    throw new Error('Prepared file changed the expected scene, geometry or material inventory. Hold for review.');
  }
  if (material !== 'plain' && !contains(source.textures.map(texture => texture.sha256),
      candidate.textures.map(texture => texture.sha256))) {
    throw new Error('Prepared file changed an original texture. Hold for review.');
  }
  if ([candidate.largestTexture?.width, candidate.largestTexture?.height]
    .some(edge => edge > FIRST_VIEW_MAX_TEXTURE_EDGE)) throw new Error('Prepared texture exceeds the size budget');
}

function runVisualGate(manifest, output) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [visualGate, manifest, output], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`Visual gate exited with ${signal}`));
      else resolveExit(code);
    });
  });
}

async function prepare(input, output) {
  if (!input || !output) throw new Error('Usage: node scripts/prepare-first-view.mjs request.json output-directory');
  const request = JSON.parse(await readFile(input, 'utf8'));
  const { slug, material, maxTriangles } = request;
  const original = Object.hasOwn(previews, slug) ? previews[slug] : null;
  if (!original || !['painted', 'plain', 'other'].includes(material) || typeof request.original?.path !== 'string' ||
      !/^[a-f0-9]{64}$/.test(request.original.sha256 || '')) {
    throw new Error('Request must specify one catalogued slug, reviewed material category and original asset identity');
  }
  if (!Number.isSafeInteger(maxTriangles) || maxTriangles < 1) {
    throw new Error('Request must specify a positive whole-number triangle budget');
  }
  const sourcePath = resolve(dirname(resolve(input)), request.original.path);
  const source = await measureGlb(sourcePath);
  const urlHash = original.url.match(/\/preview-([a-f0-9]{12,64})\.glb$/)?.[1];
  if (source.bytes !== original.bytes || source.bytes !== request.original.bytes ||
      source.sha256 !== request.original.sha256 || (urlHash && !source.sha256.startsWith(urlHash)) ||
      (original.sha256 && source.sha256 !== original.sha256)) throw new Error('Source does not match its current serving record');
  if (original.url.startsWith('/models/previews/')) {
    const publishedPath = resolve(publicDirectory, original.url.slice(1));
    const published = sourcePath === publishedPath ? source : await measureGlb(publishedPath);
    if (published.sha256 !== source.sha256) throw new Error('Source hash differs from the repository preview file');
  }
  const plans = plansFor(material, source, maxTriangles);
  const outputDir = resolve(output);
  await mkdir(dirname(outputDir), { recursive: true });
  await mkdir(outputDir);
  const sizeLimit = firstViewMaxBytes(slug);
  const reportFile = join(outputDir, 'preparation.json');
  const budgets = { targetBytes: AUTO_START_MODEL_LIMIT, maxBytes: sizeLimit,
    maxTextureEdge: FIRST_VIEW_MAX_TEXTURE_EDGE, maxTriangles };
  const report = { slug, material, budgets, source, attempts: [] };
  const saveReport = async () => writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');

  try {
    for (const [index, plan] of plans.entries()) {
      const path = join(outputDir, `candidate-${index + 1}.glb`);
      const attempt = { ...plan, path, targetTriangles: Math.round(source.triangles * plan.ratio) };
      report.attempts.push(attempt);
      await saveReport();
      const simplify = plan.ratio < 1;
      await run(optimizer, ['optimize', sourcePath, path, '--compress', 'meshopt',
        '--flatten', 'false', '--join', 'false', '--instance', 'false', '--palette', 'false', '--sparse', 'false',
        '--prune-attributes', 'false', '--prune-solid-textures', 'false',
        '--weld', String(simplify), '--simplify', String(simplify), '--simplify-ratio', String(plan.ratio),
        '--simplify-error', String(plan.tolerance), '--simplify-lock-border', String(material !== 'plain'),
        '--texture-size', String(plan.edge), '--texture-compress', plan.format,
      ], { timeout: 300_000, maxBuffer: 1_000_000 });
      const candidate = await measureGlb(path);
      attempt.metrics = candidate;
      assertPreserved(source, candidate, material, plan);
      const exceeded = [
        ...(candidate.bytes > sizeLimit ? ['bytes'] : []),
        ...(candidate.triangles > maxTriangles ? ['triangles'] : []),
      ];
      if (exceeded.length) {
        attempt.status = 'over-budget';
        attempt.exceeded = exceeded;
        await saveReport();
        continue;
      }
      const manifest = join(outputDir, 'visual-manifest.json');
      await writeFile(manifest, JSON.stringify({ works: [{
        slug, orientation: orientations[slug] || 'auto', views: request.views,
        original: { path: sourcePath, ...source }, candidate: { path, ...candidate },
      }] }, null, 2) + '\n');
      const checked = await runVisualGate(manifest, join(outputDir, 'visual'));
      attempt.status = checked === 0 ? 'eligible' : checked === 1 ? 'visual-hold' : 'gate-error';
      await saveReport();
      if (checked !== 0) return checked;
      const { bytes, sha256, triangles, largestTexture } = candidate;
      const binding = {
        original: { url: original.url, bytes: original.bytes, sha256: source.sha256 },
        firstView: {
          url: `https://models.atrium.earth/models/first-views/${slug}/first-${sha256.slice(0, 12)}.glb`,
          bytes, sha256, triangles, largestTexture,
        },
      };
      if (!firstViewFor(slug, original, binding)) throw new Error('Candidate does not satisfy the serving contract');
      await writeFile(join(outputDir, 'eligible.json'), JSON.stringify({
        slug, candidatePath: path, binding, budgets, visualReport: 'visual/visual-report.json',
      }, null, 2) + '\n');
      return 0;
    }
    throw new Error('No prepared file fits the byte and triangle budgets with this material policy. Hold for review.');
  } catch (error) {
    report.error = error.killed ? 'First-attempt conversion timed out' : error.message;
    await saveReport();
    throw error;
  }
}

prepare(...process.argv.slice(2)).then(code => {
  process.exitCode = code;
}).catch(error => {
  console.error(error.killed ? 'First-attempt conversion timed out' : error.message);
  process.exitCode = 2;
});
