import assert from 'node:assert/strict';
import test from 'node:test';
import { readBrowserModel } from './lib/browser-model-relay.mjs';

const url = 'https://models.atrium.earth/models/previews/fixture/preview.glb';
const contents = Buffer.alloc(32);
contents.write('glTF');
contents.writeUInt32LE(2, 4);
contents.writeUInt32LE(contents.length, 8);
const headers = {
  'content-type': 'model/gltf-binary',
  'content-length': String(contents.length),
  'access-control-allow-origin': 'https://atrium.earth',
  vary: 'Accept-Encoding, Origin',
};
const response = (options = {}) => new Response(options.body ?? contents, {
  status: options.status ?? 200,
  headers: { ...headers, ...options.headers },
});

test('relays full GLB bytes with one production request and no inherited headers', async () => {
  let calls = 0;
  const request = (requested, options) => {
    calls++;
    assert.equal(requested, url);
    assert.deepEqual(options.headers, { Origin: 'https://atrium.earth', 'Accept-Encoding': 'identity' });
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return response();
  };
  const result = await readBrowserModel(url, { timeout: 15000, request });
  assert.equal(calls, 1);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, contents);
  assert.equal(result.headers['content-length'], String(contents.length));
  assert.equal(result.headers['access-control-allow-origin'], 'https://atrium.earth');
});

test('allows first-view paths but rejects unrelated, credentialled and stateful addresses before requesting', async () => {
  let calls = 0;
  const request = () => { calls++; return response(); };
  await readBrowserModel('https://models.atrium.earth/models/first-views/fixture/first-deadbeef.glb', { request });
  assert.equal(calls, 1);
  for (const address of [
    'http://models.atrium.earth/models/previews/a.glb',
    'https://other.example/models/previews/a.glb',
    'https://user:password@models.atrium.earth/models/previews/a.glb',
    `${url}?unknown=1`, `${url}#fragment`, `${url}?`,
    'https://models.atrium.earth/previews/a.glb',
    'https://models.atrium.earth/models/previews/a.jpg',
    'https://models.atrium.earth/models/previews/%252e%252e/a.glb',
  ]) await assert.rejects(readBrowserModel(address, { request }), /Unexpected browser model address/);
  assert.equal(calls, 1);
});

test('an HTTP 500 retains status, URL, type and a bounded text excerpt, without retry', async () => {
  let calls = 0;
  const request = () => {
    calls++;
    return response({ status: 500, headers: { 'content-type': 'text/html' }, body: `upstream failure ${'x'.repeat(2000)}` });
  };
  await assert.rejects(readBrowserModel(url, { request }), error => {
    assert.match(error.message, /HTTP 500/);
    assert.match(error.message, /models\.atrium\.earth/);
    assert.match(error.message, /Content-Type text\/html; upstream failure/);
    assert(error.message.length < 800);
    return true;
  });
  assert.equal(calls, 1);
});

test('redirects and transport failures remain failures with one request', async () => {
  for (const failure of [response({ status: 302 }), new Error('ECONNRESET')]) {
    let calls = 0;
    const request = () => { calls++; if (failure instanceof Error) throw failure; return failure; };
    await assert.rejects(readBrowserModel(url, { request }), failure instanceof Error ? /ECONNRESET/ : /HTTP 302/);
    assert.equal(calls, 1);
  }
});

test('rejects missing CORS, MIME/Vary/encoding/length errors and corrupt or truncated GLBs', async () => {
  for (const [options, expected] of [
    [{ headers: { 'access-control-allow-origin': '' } }, /production CORS/],
    [{ headers: { 'access-control-allow-origin': '*' } }, /production CORS/],
    [{ headers: { vary: 'Accept-Encoding' } }, /Vary: Origin/],
    [{ headers: { 'content-type': 'text/html' } }, /Content-Type/],
    [{ headers: { 'content-encoding': 'gzip' } }, /content encoding/],
    [{ headers: { 'content-length': '' } }, /Content-Length/],
    [{ headers: { 'content-length': '40' } }, /Expected 40 body bytes/],
    [{ body: contents.subarray(0, 20) }, /Expected 32 body bytes/],
    [{ body: Buffer.alloc(contents.length) }, /Invalid GLB header/],
  ]) {
    let calls = 0;
    await assert.rejects(readBrowserModel(url, { request: () => { calls++; return response(options); } }), expected);
    assert.equal(calls, 1);
  }
  const declaredWrong = Buffer.from(contents);
  declaredWrong.writeUInt32LE(50, 8);
  await assert.rejects(readBrowserModel(url, { request: () => response({ body: declaredWrong }) }), /declared size/);
});
