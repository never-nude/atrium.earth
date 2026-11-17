// Verify each serving model once. First views require a complete hash check;
// ranges keep delivery verification bounded for the full-size catalogue models.
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { firstViewFor } from '../src/lib/first-view-models.mjs';
import { cdn, checkDeliveries, readCdnAsset, scanBuiltCdnReferences, writeDeliveryReport } from './lib/cdn-delivery.mjs';

const reportFile = 'test-results/published-model-delivery.json';
const modelTypes = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.usdz': 'model/vnd.usdz+zip',
};

export async function referencedModels(directory) {
  const { models, documentCount, unresolved } = await scanBuiltCdnReferences(directory);
  return { references: models, documentCount, unresolved };
}

async function registeredModels() {
  const [previews, bindings, museum] = await Promise.all([
    '../src/data/previews.json',
    '../src/data/first-view-models.json',
    '../public/spatial-museum/collection-manifest.json',
  ].map(async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'))));
  const metadata = new Map();
  function register(record, sha256) {
    if (!record?.url?.startsWith(cdn + '/')) return;
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 12) {
      throw new Error(`Invalid registered size for ${record.url}`);
    }
    if (metadata.has(record.url) && metadata.get(record.url).bytes !== record.bytes) {
      throw new Error(`Conflicting registered sizes for ${record.url}`);
    }
    metadata.set(record.url, { bytes: record.bytes, ...(sha256 && { sha256 }) });
  }
  for (const record of [...Object.values(previews), ...museum.rooms.map(room => room.appleAR)]) register(record);
  for (const [slug, binding] of Object.entries(bindings)) {
    const firstView = firstViewFor(slug, previews[slug], binding);
    if (!firstView) throw new Error(`Invalid first-view binding: ${slug}`);
    register(firstView, firstView.sha256);
  }
  return metadata;
}

export async function verifyPublishedModel(url, bytes, request = fetch, sha256) {
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  const mime = modelTypes[extension];
  if (!mime) throw new Error(`Unsupported model extension: ${extension}`);
  const { body, delivery } = await readCdnAsset(
    url, { bytes, mime, varyByOrigin: true, full: Boolean(sha256) }, request,
  );
  if (extension === '.glb' && (
    body.toString('ascii', 0, 4) !== 'glTF' || body.readUInt32LE(4) !== 2 || body.readUInt32LE(8) !== bytes
  )) throw new Error('Invalid GLB header or declared file size');
  if (extension === '.usdz' && body.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Invalid USDZ ZIP header');
  }
  if (sha256) {
    const measured = createHash('sha256').update(body).digest('hex');
    if (measured !== sha256) throw new Error(`Expected SHA-256 ${sha256}, received ${measured}`);
    delivery.sha256 = measured;
  }
  return delivery;
}

export async function verifyModelDelivery(directory = 'dist') {
  await rm(reportFile, { force: true });
  const { references, documentCount, unresolved } = await referencedModels(directory);
  const metadata = await registeredModels();
  // A first view must still pass its hash check if a redesign drops its last
  // page reference while leaving its binding in the catalogue.
  for (const [url, { sha256 }] of metadata) {
    if (sha256 && !references.has(url)) references.set(url, 'src/data/first-view-models.json');
  }
  const models = [...references].map(([url, document]) => ({ url, document, ...metadata.get(url) }));
  if (!models.length) throw new Error('No CDN model addresses were found in the built package');

  const results = await checkDeliveries(models, ({ url, bytes, sha256 }) => verifyPublishedModel(url, bytes, fetch, sha256));
  const failures = results.filter(result => result.error);
  const firstViews = results.filter(result => result.sha256);
  const verifiedFirstViews = firstViews.filter(result => result.delivery);
  const firstViewBytes = verifiedFirstViews.reduce((sum, result) => sum + result.bytes, 0);
  const summary = {
    models: models.length, documentCount, passed: models.length - failures.length,
    failed: failures.length, unresolvedReferences: unresolved.length,
    firstViews: firstViews.length, firstViewsVerified: verifiedFirstViews.length, firstViewBytes,
  };
  await writeDeliveryReport(reportFile, summary, results, unresolved);
  console.log(`Model CDN first-attempt delivery: ${summary.passed}/${summary.models} passed across ${documentCount} build documents.`);
  console.log(`First-view SHA-256 first-attempt delivery: ${summary.firstViewsVerified}/${summary.firstViews} passed (${summary.firstViewBytes} bytes).`);
  console.log(`Unresolved CDN host mentions: ${summary.unresolvedReferences}.`);
  if (failures.length || unresolved.length) {
    for (const { url, document, error } of failures) console.error(`${url} (${document}): ${error}`);
    for (const { document, reference } of unresolved) console.error(`${document}: Unresolved CDN reference ${reference}`);
    throw new Error(`${failures.length} model CDN checks failed and ${unresolved.length} CDN mentions were unresolved. See ${reportFile}.`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  verifyModelDelivery(process.argv[2]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
