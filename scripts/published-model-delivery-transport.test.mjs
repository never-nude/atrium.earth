import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import test from 'node:test';
import { checkDeliveries, readCdnAsset } from './lib/cdn-delivery.mjs';
import { requestWithFreshConnection } from './lib/fresh-https-request.mjs';

const url = 'https://models.atrium.earth/models/previews/fixture/preview.glb';
const bytes = 500;
const header = Buffer.alloc(12);
header.write('glTF');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(bytes, 8);
const metadata = { bytes, mime: 'model/gltf-binary', varyByOrigin: true };

function headers(status = 206) {
  return {
    'content-type': metadata.mime,
    'content-length': String(status === 206 ? 12 : bytes),
    ...(status === 206 && { 'content-range': `bytes 0-11/${bytes}` }),
    'access-control-allow-origin': 'https://atrium.earth',
    vary: 'Origin',
  };
}

async function fixture(t, handle) {
  const requests = [];
  const connections = [];
  const options = [];
  const server = createServer((request, response) => {
    requests.push(request);
    handle(request, response);
  });
  server.on('connection', socket => connections.push(socket));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  // Only the native transport is substituted. Production always uses HTTPS;
  // loopback HTTP exercises the same one-use agent and streaming lifecycle.
  const nativeRequest = (target, requestOptions, callback) => {
    options.push(requestOptions);
    return httpRequest(new URL(new URL(target).pathname, origin), requestOptions, callback);
  };
  return {
    requests, connections, options,
    request: (target, requestOptions) => requestWithFreshConnection(target, requestOptions, nativeRequest),
  };
}

test('finishes each range on a separate connection and sends the exact validation headers', { timeout: 5000 }, async t => {
  const local = await fixture(t, (_request, response) => response.writeHead(206, headers()).end(header));
  for (let index = 0; index < 2; index += 1) {
    const result = await readCdnAsset(url, metadata, local.request);
    assert.deepEqual(result.body, header);
  }
  assert.equal(local.requests.length, 2);
  assert.equal(local.connections.length, 2);
  for (const request of local.requests) {
    assert.equal(request.headers.origin, 'https://atrium.earth');
    assert.equal(request.headers.range, 'bytes=0-11');
    assert.equal(request.headers['accept-encoding'], 'identity');
  }
  for (const options of local.options) {
    assert.equal(options.agent, false);
    assert.equal(options.method, 'GET');
    assert.ok(options.signal instanceof AbortSignal);
  }
});

test('does not follow a redirect or issue a second request', { timeout: 5000 }, async t => {
  const local = await fixture(t, (_request, response) => {
    response.writeHead(302, { location: '/other.glb' }).end('redirect');
  });
  await assert.rejects(readCdnAsset(url, metadata, local.request), /HTTP 302/);
  assert.equal(local.requests.length, 1);
});

test('a reset before headers fails once with its phase and native code', { timeout: 5000 }, async t => {
  const local = await fixture(t, request => request.socket.destroy());
  const [result] = await checkDeliveries([{ url, bytes }], () => readCdnAsset(url, metadata, local.request));
  assert.match(result.error, /^\[response headers\].*ECONNRESET/);
  assert.equal(local.requests.length, 1);
});

test('an abort destroys an outstanding request instead of retrying it', { timeout: 5000 }, async t => {
  let started;
  let closed;
  const observed = new Promise(resolve => { started = resolve; });
  const disconnected = new Promise(resolve => { closed = resolve; });
  const local = await fixture(t, request => {
    request.socket.once('close', closed);
    started();
  });
  const controller = new AbortController();
  const pending = local.request(url, { signal: controller.signal });
  await observed;
  controller.abort();
  await assert.rejects(pending, error => error.code === 'ABORT_ERR');
  await disconnected;
  assert.equal(local.requests.length, 1);
});

test('a truncated range fails while reading its body, without a retry', { timeout: 5000 }, async t => {
  let outgoing;
  const local = await fixture(t, (_request, response) => {
    outgoing = response;
    response.writeHead(206, headers());
    response.write(header.subarray(0, 6));
  });
  const request = async (target, options) => {
    const response = await local.request(target, options);
    outgoing.destroy();
    return response;
  };
  await assert.rejects(readCdnAsset(url, metadata, request), error => {
    assert.equal(error.deliveryPhase, 'response body');
    assert.equal(error.code, 'ECONNRESET');
    return true;
  });
  assert.equal(local.requests.length, 1);
});

test('cancels an ignored-range response after the header and closes its socket', { timeout: 5000 }, async t => {
  let closed;
  const disconnected = new Promise(resolve => { closed = resolve; });
  const local = await fixture(t, (request, response) => {
    request.socket.once('close', closed);
    response.writeHead(200, headers(200));
    response.write(header);
  });
  const result = await readCdnAsset(url, metadata, local.request);
  assert.deepEqual(result.body, header);
  await disconnected;
  assert.equal(local.requests.length, 1);
});

test('reports a body-forbidden HTTP error without leaking the response', { timeout: 5000 }, async t => {
  const local = await fixture(t, (_request, response) => response.writeHead(204).end());
  await assert.rejects(readCdnAsset(url, metadata, local.request), /HTTP 204/);
  assert.equal(local.requests.length, 1);
});

test('fully reads a non-range response when complete verification is requested', { timeout: 5000 }, async t => {
  const contents = Buffer.alloc(bytes);
  header.copy(contents);
  const local = await fixture(t, (_request, response) => response.writeHead(200, headers(200)).end(contents));
  const result = await readCdnAsset(url, { ...metadata, full: true }, local.request);
  assert.deepEqual(result.body, contents);
  assert.equal(local.requests[0].headers.range, undefined);
  assert.equal(local.requests.length, 1);
});
