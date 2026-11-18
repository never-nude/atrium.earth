import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import test from 'node:test';
import { checkDeliveries, readCdnAsset, createCdnAuditStartGate, CDN_AUDIT_START_INTERVAL_MS } from './lib/cdn-delivery.mjs';
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

test('staggers audit starts while retaining four concurrent workers and never retrying a failure', { timeout: 5000 }, async () => {
  let time = 0;
  const paceStart = createCdnAuditStartGate({ now: () => time, wait: async delay => { time += delay; } });
  const assets = Array.from({ length: 8 }, (_, index) => ({ url: url + '#' + index, bytes }));
  const starts = [];
  const finish = new Map();
  let active = 0, peak = 0, fourthStarted, eighthStarted;
  const fourth = new Promise(resolve => { fourthStarted = resolve; });
  const eighth = new Promise(resolve => { eighthStarted = resolve; });
  const pending = checkDeliveries(assets, asset => {
    starts.push({ url: asset.url, time });
    active++; peak = Math.max(peak, active);
    return new Promise((resolve, reject) => {
      finish.set(asset.url, () => {
        active--;
        if (asset === assets[2]) reject(new Error('HTTP 429'));
        else resolve({ status: 206 });
      });
      if (starts.length === 4) fourthStarted();
      if (starts.length === 8) eighthStarted();
    });
  }, { paceStart });
  await fourth;
  assert.equal(peak, 4);
  assert.equal(active, 4);
  assert.deepEqual(starts.map(start => start.time), [0, 100, 200, 300]);
  for (const index of [2, 0, 3, 1]) finish.get(assets[index].url)();
  await eighth;
  for (const index of [7, 5, 4, 6]) finish.get(assets[index].url)();
  const results = await pending;
  assert.equal(peak, 4);
  assert.equal(active, 0);
  assert.deepEqual(starts.map(start => start.time), [0, 100, 200, 300, 400, 500, 600, 700]);
  assert.equal(new Set(starts.map(start => start.url)).size, assets.length);
  assert.deepEqual(results.map(result => result.url), assets.map(asset => asset.url));
  assert.equal(results[2].error, 'HTTP 429');
  assert.equal(results.filter(result => result.delivery).length, 7);
  assert.equal(CDN_AUDIT_START_INTERVAL_MS, 100);
});

test('synchronous dispatch setup cannot shorten the actual request spacing', { timeout: 5000 }, async () => {
  let time = 0;
  const paceStart = createCdnAuditStartGate({ now: () => time, wait: async delay => { time += delay; } });
  const starts = [];
  await Promise.all([7, 0, 3].map(cost => paceStart(() => {
    time += cost;
    starts.push(time);
  })));
  assert.deepEqual(starts, [7, 107, 210]);
  assert.ok(starts.slice(1).every((start, index) => start - starts[index] >= 100));
});

test('late timers do not cause catch-up bursts and early wakeups are checked again', { timeout: 5000 }, async () => {
  let time = 0;
  const delays = [];
  const paceStart = createCdnAuditStartGate({
    now: () => time,
    wait: async delay => {
      delays.push(delay);
      time += delays.length === 1 ? 350 : delays.length === 2 ? 90 : delay;
    },
  });
  const starts = [];
  await Promise.all(Array.from({ length: 3 }, () => paceStart(() => { starts.push(time); })));
  assert.deepEqual(starts, [0, 350, 450]);
  assert.deepEqual(delays, [100, 100, 10]);
});

test('concurrent audit batches share their start gate without retrying synchronous errors', { timeout: 5000 }, async () => {
  let time = 0;
  const paceStart = createCdnAuditStartGate({ now: () => time, wait: async delay => { time += delay; } });
  const starts = [];
  const first = [{ url: url + '#first', bytes }, { url: url + '#second', bytes }];
  const second = [{ url: url + '#third', bytes }, { url: url + '#fourth', bytes }];
  const verify = asset => {
    starts.push({ url: asset.url, time });
    if (asset === first[0]) throw new Error('single failure');
    return { status: 206 };
  };
  const [left, right] = await Promise.all([
    checkDeliveries(first, verify, { paceStart }), checkDeliveries(second, verify, { paceStart }),
  ]);
  assert.deepEqual(starts.map(start => start.time), [0, 100, 200, 300]);
  assert.equal(new Set(starts.map(start => start.url)).size, 4);
  assert.equal(left[0].error, 'single failure');
  assert.equal([...left, ...right].filter(result => result.delivery).length, 3);
});

test('a 429 reports only bounded public response metadata, cancels the body and never retries', { timeout: 5000 }, async () => {
  let calls = 0, pulls = 0, cancellations = 0;
  const body = new ReadableStream({
    pull() { pulls++; },
    cancel() { cancellations++; },
  }, { highWaterMark: 0 });
  const response = new Response(body, { status: 429, headers: {
    'retry-after': '120', 'cf-ray': '9a0b1c2d3e4f5678-IAD', 'cf-cache-status': 'DYNAMIC', 'cf-mitigated': 'challenge',
    'set-cookie': 'secret-cookie', authorization: 'Bearer secret-token', 'x-api-key': 'secret-key',
  } });
  await assert.rejects(readCdnAsset(url, metadata, () => { calls++; return response; }), error => {
    assert.match(error.message, /^HTTP 429/);
    assert.match(error.message, /Retry-After: 120/);
    assert.match(error.message, /CF-Ray: 9a0b1c2d3e4f5678-IAD/);
    assert.match(error.message, /CF-Cache-Status: DYNAMIC/);
    assert.match(error.message, /CF-Mitigated: challenge/);
    assert.doesNotMatch(error.message, /secret|cookie|authorization|api-key/i);
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(pulls, 0);
  assert.equal(cancellations, 1);
});

test('invalid or oversized diagnostic headers never expose arbitrary contents or an error body', { timeout: 5000 }, async () => {
  let calls = 0;
  const response = new Response('secret error body', { status: 429, headers: {
    'retry-after': 'Bearer secret-token', 'cf-ray': 'secret-' + 'a'.repeat(1000), 'cf-cache-status': 'secret-status',
  } });
  await assert.rejects(readCdnAsset(url, metadata, () => { calls++; return response; }), error => {
    assert.equal(error.message, 'HTTP 429 (Retry-After: [invalid]; CF-Ray: [invalid]; CF-Cache-Status: [invalid])');
    assert(error.message.length < 300);
    assert.doesNotMatch(error.message, /secret/);
    return true;
  });
  assert.equal(calls, 1);
});

test('Retry-After HTTP dates remain useful without changing 429 into a successful or retried request', { timeout: 5000 }, async () => {
  let calls = 0;
  await assert.rejects(readCdnAsset(url, metadata, () => {
    calls++;
    return new Response(null, { status: 429, headers: { 'retry-after': 'Wed, 18 Nov 2026 12:00:00 GMT' } });
  }), /HTTP 429 \(Retry-After: Wed, 18 Nov 2026 12:00:00 GMT\)/);
  assert.equal(calls, 1);
});
