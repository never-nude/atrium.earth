import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { referencedModels, verifyPublishedModel } from './verify-published-model-delivery.mjs';

const origin = 'https://atrium.earth';
const glb = 'https://models.atrium.earth/models/previews/discobolus/preview-18e77773563d.glb';
const usdz = 'https://models.atrium.earth/models/rooms/ancient-egypt/room-0defb2adcccb.usdz';
const modelBytes = 500;
const glbHeader = Buffer.alloc(12);
glbHeader.write('glTF');
glbHeader.writeUInt32LE(2, 4);
glbHeader.writeUInt32LE(modelBytes, 8);

function rangeResponse({ headers, status = 206, body = glbHeader } = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-length': '12',
      'content-range': 'bytes 0-11/500',
      'access-control-allow-origin': origin,
      ...headers,
    },
  });
}

test('finds unique GLB and USDZ CDN addresses across built pages and bundles', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atrium-model-references-'));
  try {
    await mkdir(path.join(directory, '_astro'));
    await writeFile(path.join(directory, 'index.html'), `<div data-glb="${glb}"></div>`);
    await writeFile(path.join(directory, '_astro', 'entry.js'),
      JSON.stringify([glb, usdz]).replaceAll('/', '\\/'));
    await writeFile(path.join(directory, 'unpublished.glb'), 'https://models.atrium.earth/unpublished.glb');
    const { references, documentCount } = await referencedModels(directory);
    assert.equal(documentCount, 2);
    assert.deepEqual([...references.keys()].sort(), [glb, usdz]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('requests the exact address once with production Origin and validates the range total', async () => {
  let calls = 0;
  const delivery = await verifyPublishedModel(glb, modelBytes, (url, options) => {
    calls += 1;
    assert.equal(url, glb);
    assert.equal(options.headers.Origin, origin);
    assert.equal(options.headers.Range, 'bytes=0-11');
    assert.equal(options.headers['Accept-Encoding'], 'identity');
    assert.equal(options.redirect, 'error');
    return rangeResponse();
  });
  assert.equal(calls, 1);
  assert.equal(delivery.contentRange, 'bytes 0-11/500');
});

test('rejects a missing object, mismatched length, missing production CORS or altered GLB header', async () => {
  for (const [response, expected] of [
    [rangeResponse({ status: 404 }), /HTTP 404/],
    [rangeResponse({ headers: { 'content-range': 'bytes 0-11/501' } }), /Expected range/],
    [rangeResponse({ headers: { 'access-control-allow-origin': '' } }), /Expected production CORS/],
    [rangeResponse({ headers: { 'access-control-allow-origin': '*' } }), /Expected production CORS/],
    [rangeResponse({ body: Buffer.alloc(12) }), /Invalid GLB header/],
  ]) {
    await assert.rejects(verifyPublishedModel(glb, modelBytes, () => response), expected);
  }
});
