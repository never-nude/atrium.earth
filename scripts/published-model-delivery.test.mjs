import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { referencedModels, verifyPublishedModel } from './verify-published-model-delivery.mjs';
import { verifyPublishedJpeg } from './verify-published-jpeg-delivery.mjs';

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
      'content-type': 'model/gltf-binary',
      vary: 'Accept-Encoding, Origin',
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

test('recognizes the known CDN templates and reports unresolved uses by file', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atrium-model-references-'));
  try {
    const bundle = 'spatial-museum/assets/index-catalogue.js';
    const galleryTemplate = 'https://models.atrium.earth/models/rooms/${e.room.id}/room-${t.sha256.slice(0,12)}.usdz';
    const jpegTemplate = 'https://models.atrium.earth/previews/renders/${slug}/thumb-${hash}.jpg';
    await mkdir(path.join(directory, 'spatial-museum/assets'), { recursive: true });
    await writeFile(path.join(directory, bundle), '`' + galleryTemplate + '`');
    await writeFile(path.join(directory, 'artwork-image-recovery.js'), '`' + jpegTemplate + '`');
    await writeFile(path.join(directory, 'unresolved.js'), `const host = "https://models.atrium.earth"; const other = \`${jpegTemplate}\`;`);
    await writeFile(path.join(directory, 'unresolved.html'), `<a href="${glb}?unknown=1"></a>`);
    const { unresolved } = await referencedModels(directory);
    assert.deepEqual(unresolved.map(issue => issue.document).sort(), ['unresolved.html', 'unresolved.js', 'unresolved.js']);
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
    [rangeResponse({ headers: { 'content-type': 'text/html' } }), /Expected Content-Type model\/gltf-binary/],
    [rangeResponse({ headers: { vary: '' } }), /Expected Vary: Origin/],
    [rangeResponse({ headers: { vary: 'Accept-Encoding, X-Origin' } }), /Expected Vary: Origin/],
    [rangeResponse({ body: Buffer.alloc(12) }), /Invalid GLB header/],
  ]) {
    await assert.rejects(verifyPublishedModel(glb, modelBytes, () => response), expected);
  }
});

test('requires the room USDZ MIME and accepts case-insensitive Vary tokens', async () => {
  const body = Buffer.alloc(12);
  body.writeUInt32LE(0x04034b50);
  const response = mime => rangeResponse({ body, headers: { 'content-type': mime, vary: '  ORIGIN , Accept-Encoding' } });
  await assert.rejects(
    verifyPublishedModel(usdz, modelBytes, () => response('application/octet-stream')),
    /Expected Content-Type model\/vnd.usdz\+zip/,
  );
  await verifyPublishedModel(usdz, modelBytes, () => response('model/vnd.usdz+zip'));
});

test('downloads a first view in a single full request and verifies SHA-256', async () => {
  const contents = Buffer.alloc(modelBytes);
  glbHeader.copy(contents);
  contents.fill(1, 12);
  const sha256 = createHash('sha256').update(contents).digest('hex');
  let calls = 0;
  const response = (url, options) => {
    calls += 1;
    assert.equal(url, glb);
    assert.equal(options.headers.Range, undefined);
    assert.equal(options.headers.Origin, origin);
    return rangeResponse({ body: contents, status: 200, headers: { 'content-length': String(modelBytes) } });
  };
  const verified = await verifyPublishedModel(glb, modelBytes, response, sha256);
  assert.equal(calls, 1);
  assert.equal(verified.sha256, sha256);
  await assert.rejects(verifyPublishedModel(glb, modelBytes, response, '0'.repeat(64)), /Expected SHA-256/);
  assert.equal(calls, 2);
  await assert.rejects(
    verifyPublishedModel(glb, modelBytes, () => rangeResponse(), sha256), /HTTP 206/,
  );
});

test('checks a recovery JPEG range, MIME and start marker without retrying', async () => {
  const url = 'https://models.atrium.earth/previews/renders/discobolus/thumb-c98ab7a8763f.jpg';
  const body = Buffer.alloc(12);
  body.set([0xff, 0xd8, 0xff]);
  let calls = 0;
  const delivery = await verifyPublishedJpeg(url, modelBytes, (requested, options) => {
    calls += 1;
    assert.equal(requested, url);
    assert.equal(options.headers.Origin, origin);
    assert.equal(options.headers.Range, 'bytes=0-11');
    return rangeResponse({ body, headers: { 'content-type': 'image/jpeg' } });
  });
  assert.equal(calls, 1);
  assert.equal(delivery.contentRange, 'bytes 0-11/500');
  await assert.rejects(verifyPublishedJpeg(url, modelBytes, () => rangeResponse()), /Expected Content-Type image\/jpeg/);
  await assert.rejects(
    verifyPublishedJpeg(url, modelBytes, () => rangeResponse({ headers: { 'content-type': 'image/jpeg' } })),
    /Invalid JPEG start marker/,
  );
});
