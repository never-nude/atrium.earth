import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { cdn, checkDeliveries, requestCdnResource, site } from './lib/cdn-delivery.mjs';
import { verifyPublishedModel } from './verify-published-model-delivery.mjs';

const [network, output] = process.argv.slice(2);
assert.ok(['github-actions', 'local-mac'].includes(network) && output);
const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [assets, previews] = await Promise.all([
  readJson('./cdn-diagnostic-targets.json'),
  readJson('../src/data/previews.json'),
]);
const sizes = new Map(Object.values(previews).map(({ url, bytes }) => [url, bytes]));
assert.equal(assets.length, 11);
assert.equal(new Set(assets.map(({ url }) => url)).size, 11);
for (const { url, bytes } of assets) {
  assert.ok(url.startsWith(`${cdn}/models/previews/`) && url.endsWith('.glb'));
  assert.equal(sizes.get(url), bytes);
}

const observations = new Map();
async function request(url, options) {
  assert.ok(!observations.has(url), `Duplicate request for ${url}`);
  assert.equal(options.headers.Origin, site);
  assert.equal(options.headers.Range, 'bytes=0-11');
  const observed = { startedAt: new Date().toISOString() };
  observations.set(url, observed);
  const start = performance.now();
  const response = await requestCdnResource(url, options);
  observed.headersMs = Math.round(performance.now() - start);
  observed.status = response.status;
  observed.cfRay = response.headers.get('cf-ray');
  observed.cfCacheStatus = response.headers.get('cf-cache-status');
  return response;
}

try {
  const results = await checkDeliveries(assets, ({ url, bytes }) => verifyPublishedModel(url, bytes, request));
  assert.equal(observations.size, 11);
  const rows = results.map(row => ({ ...row, ...observations.get(row.url) }));
  const passed = rows.filter(row => row.delivery).length;
  await writeFile(output, JSON.stringify({ network, node: process.version, platform: process.platform, passed, rows }, null, 2) + '\n');
  for (const row of rows) console.log(row.url, row.delivery?.status ?? row.error, row.cfRay ?? '', row.headersMs ?? '');
  console.log(`${network}: ${passed}/${rows.length} validated on the first request`);
  if (passed !== rows.length) process.exitCode = 1;
} finally {
  requestCdnResource.close();
}
