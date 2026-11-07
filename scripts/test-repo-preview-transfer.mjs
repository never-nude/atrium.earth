#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  PRODUCTION_ORIGIN, TRANSFER_COUNT, transferPublicUrl,
  validateTransferManifest, validateTransferMetadata, validateDeliveryResponse,
} from './verify-repo-preview-transfer.mjs';

const hash = body => createHash('sha256').update(body).digest('hex');
const bodies = [];
const models = Array.from({ length: TRANSFER_COUNT }, (_, index) => {
  const json = JSON.stringify({ asset: { version: '2.0' }, extras: index });
  const payload = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
  const body = Buffer.alloc(20 + payload.length);
  body.write('glTF'); body.writeUInt32LE(2, 4); body.writeUInt32LE(body.length, 8);
  body.writeUInt32LE(payload.length, 12); body.writeUInt32LE(0x4e4f534a, 16); payload.copy(body, 20);
  bodies.push(body);
  const slug = `test/model-${index}`, currentUrl = `/models/previews/${slug}/preview.glb`;
  return { slug, sourcePath: `public${currentUrl}`, gitBlob: index.toString(16).padStart(40, '0'),
    currentUrl, bytes: body.length, sha256: hash(body) };
});
const fixture = {
  manifest: { schema: 'atrium-repo-preview-transfer/1', sourceCommit: 'a'.repeat(40),
    max_total_bytes: models.reduce((sum, model) => sum + model.bytes, 0), models },
  previewMap: Object.fromEntries(models.map(model => [model.slug, { url: transferPublicUrl(model), bytes: model.bytes }])),
  report: { public_base: 'https://models.atrium.earth', uploaded: models.map(model => ({
    slug: model.slug, url: transferPublicUrl(model), bytes: model.bytes, sha256: model.sha256,
  })), failed: [], unchanged: [] },
};
const before = JSON.stringify(fixture);
const validated = validateTransferMetadata(fixture.manifest, fixture.previewMap, fixture.report);
assert.equal(validated.length, 20);
assert.equal(JSON.stringify(fixture), before, 'Metadata validation does not mutate its inputs');

let checks = 0;
function rejectsMetadata(change) {
  const data = structuredClone(fixture); change(data);
  assert.throws(() => validateTransferMetadata(data.manifest, data.previewMap, data.report)); checks += 1;
}
rejectsMetadata(data => data.manifest.models.pop());
rejectsMetadata(data => data.manifest.models.push(structuredClone(data.manifest.models[0])));
rejectsMetadata(data => { data.manifest.models[1] = structuredClone(data.manifest.models[0]); });
rejectsMetadata(data => { data.manifest.sourceCommit = 'main'; });
rejectsMetadata(data => { data.manifest.models[0].gitBlob = 'not-pinned'; });
rejectsMetadata(data => { data.manifest.models[0].sha256 = 'a'.repeat(12); });
rejectsMetadata(data => { data.manifest.models[0].sourcePath = '../private-file'; });
rejectsMetadata(data => { data.manifest.models[0].currentUrl = '/models/previews/test/model-0/../../private.glb'; });
rejectsMetadata(data => {
  data.manifest.models[0].currentUrl = '/models/previews/test/model-0/extra/preview.glb';
  data.manifest.models[0].sourcePath = `public${data.manifest.models[0].currentUrl}`;
});
rejectsMetadata(data => { data.manifest.max_total_bytes = 160_000_001; });
rejectsMetadata(data => { data.manifest.models[0].bytes = 19; });
rejectsMetadata(data => { data.manifest.models[0].bytes = 20_000_001; });
rejectsMetadata(data => { data.manifest.max_total_bytes -= 1; });
rejectsMetadata(data => { data.previewMap.extra = data.previewMap[models[0].slug]; });
rejectsMetadata(data => { delete data.previewMap[models[0].slug]; });
rejectsMetadata(data => { data.previewMap[models[0].slug].url = 'https://other.example/model.glb'; });
rejectsMetadata(data => { data.previewMap[models[0].slug].url += '?replacement=1'; });
rejectsMetadata(data => { data.previewMap[models[0].slug].bytes += 1; });
rejectsMetadata(data => { data.report.failed.push({ slug: models[0].slug }); });
rejectsMetadata(data => { delete data.report.failed; });
rejectsMetadata(data => { data.report.uploaded.pop(); });
rejectsMetadata(data => { data.report.uploaded[1] = structuredClone(data.report.uploaded[0]); });
rejectsMetadata(data => { data.report.uploaded[0].slug = 'unexpected-model'; });
rejectsMetadata(data => { data.report.uploaded[0].url = data.report.uploaded[0].url.replace(models[0].sha256.slice(0, 12), 'f'.repeat(12)); });
rejectsMetadata(data => { data.report.uploaded[0].bytes += 1; });
rejectsMetadata(data => { data.report.uploaded[0].sha256 = 'f'.repeat(64); });
rejectsMetadata(data => { data.report.uploaded[0].dry_run = true; });
rejectsMetadata(data => { data.report.unchanged.push(data.report.uploaded[0]); });
rejectsMetadata(data => { data.report.public_base = 'https://other.example'; });

function response(index = 0) {
  return { status: 200, url: validated[index].url, body: bodies[index], headers: {
    'Content-Type': 'model/gltf-binary', 'Access-Control-Allow-Origin': PRODUCTION_ORIGIN,
    'Content-Length': String(bodies[index].length),
  } };
}
for (let index = 0; index < 20; index += 1) {
  const receipt = validateDeliveryResponse(validated[index], response(index));
  assert.equal(receipt.sha256, models[index].sha256);
  assert.equal(receipt.bytes, bodies[index].length);
  assert.equal(receipt.glbVersion, 2);
}
const wildcard = response(); wildcard.headers['Access-Control-Allow-Origin'] = '*';
assert.equal(validateDeliveryResponse(validated[0], wildcard).accessControlAllowOrigin, '*');
const standardHeaders = response(); standardHeaders.headers = new Headers(standardHeaders.headers);
assert.equal(validateDeliveryResponse(validated[0], standardHeaders).contentType, 'model/gltf-binary');

function rejectsResponse(change) {
  const data = response(); data.body = Buffer.from(data.body); change(data);
  assert.throws(() => validateDeliveryResponse(validated[0], data)); checks += 1;
}
rejectsResponse(data => { data.status = 206; });
rejectsResponse(data => { data.url += '?changed=1'; });
rejectsResponse(data => { data.headers['Content-Type'] = 'text/html'; });
rejectsResponse(data => { delete data.headers['Access-Control-Allow-Origin']; });
rejectsResponse(data => { data.headers['Access-Control-Allow-Origin'] = 'https://other.example'; });
rejectsResponse(data => { data.headers['Content-Encoding'] = 'gzip'; });
rejectsResponse(data => { data.headers['Content-Length'] = '1'; });
rejectsResponse(data => { data.body = data.body.subarray(0, data.body.length - 1); });
rejectsResponse(data => { data.body[data.body.length - 1] ^= 1; });
for (const corrupt of [body => body.write('html'), body => body.writeUInt32LE(1, 4), body => body.writeUInt32LE(body.length + 4, 8)]) {
  const data = response(); data.body = Buffer.from(data.body); corrupt(data.body);
  const expected = { ...validated[0], sha256: hash(data.body) };
  data.url = transferPublicUrl(expected);
  assert.throws(() => validateDeliveryResponse(expected, data), 'Bad GLB header must fail even when its bytes and SHA-256 match'); checks += 1;
}
assert.equal(validateTransferManifest(fixture.manifest).length, TRANSFER_COUNT);
const boundary = structuredClone(fixture.manifest);
boundary.max_total_bytes = 160_000_000;
boundary.models[0].bytes = 20_000_000;
boundary.models[1].bytes = 20;
assert.equal(validateTransferManifest(boundary).length, TRANSFER_COUNT, 'Exact reviewed per-model and total ceilings remain valid');
console.log(`Repository preview transfer passed:20 one-to-one identities,20 full response fixtures and ${checks} rejection cases; no network used.`);
