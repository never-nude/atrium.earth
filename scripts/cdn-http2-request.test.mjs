import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { connect, constants, createServer } from 'node:http2';
import test from 'node:test';
import { promisify } from 'node:util';
import { createCdnHttp2Request } from './lib/cdn-http2-request.mjs';

const address = name => `https://models.atrium.earth/models/previews/${name}/preview.glb`;
const timeout = { timeout: 5000 };

async function fixture(t, handle, options = {}) {
  const requests = [];
  const clients = [];
  const serverSessions = new Set();
  const server = createServer();
  server.on('session', session => {
    serverSessions.add(session);
    session.on('error', () => {});
    session.once('close', () => serverSessions.delete(session));
  });
  server.on('stream', (stream, headers) => {
    stream.on('error', () => {});
    requests.push(headers);
    handle(stream, headers);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const transport = createCdnHttp2Request({
    ...options,
    connect: authority => {
      assert.equal(authority, 'https://models.atrium.earth');
      const client = connect(`http://127.0.0.1:${server.address().port}`);
      clients.push(client);
      return client;
    },
  });
  t.after(async () => {
    transport.close();
    for (const session of serverSessions) session.destroy();
    await new Promise(resolve => server.close(resolve));
  });
  return { transport, requests, clients, origin: `http://127.0.0.1:${server.address().port}` };
}

const success = stream => {
  stream.respond({ ':status': 200, 'content-type': 'model/gltf-binary', 'content-length': '4' });
  stream.end('glTF');
};

test('multiplexes two first requests on one session with exact paths and headers', timeout, async t => {
  const local = await fixture(t, success);
  const responses = await Promise.all(['one', 'two'].map(name => local.transport(address(name), {
    headers: { Origin: 'https://atrium.earth', Range: 'bytes=0-11', 'Accept-Encoding': 'identity' },
  })));
  assert.deepEqual(await Promise.all(responses.map(response => response.text())), ['glTF', 'glTF']);
  assert.equal(local.clients.length, 1);
  assert.equal(local.requests.length, 2);
  assert.deepEqual(local.requests.map(headers => headers[':path']).sort(), ['/models/previews/one/preview.glb', '/models/previews/two/preview.glb']);
  for (const headers of local.requests) {
    assert.equal(headers[':method'], 'GET');
    assert.equal(headers[':authority'], 'models.atrium.earth');
    assert.equal(headers.origin, 'https://atrium.earth');
    assert.equal(headers.range, 'bytes=0-11');
    assert.equal(headers['accept-encoding'], 'identity');
  }
});

test('retires a session after its configured request count without repeating URLs', timeout, async t => {
  const local = await fixture(t, success, { maxRequests: 2 });
  for (const name of ['one', 'two', 'three']) await (await local.transport(address(name))).arrayBuffer();
  assert.equal(local.clients.length, 2);
  assert.equal(local.requests.length, 3);
  assert.equal(new Set(local.requests.map(headers => headers[':path'])).size, 3);
});

test('returns redirect and HTTP 500 responses without following or retrying', timeout, async t => {
  const local = await fixture(t, (stream, headers) => {
    const status = headers[':path'].includes('redirect') ? 302 : 500;
    stream.respond({ ':status': status, location: '/other.glb' });
    stream.end('failure');
  });
  const redirected = await local.transport(address('redirect'));
  assert.equal(redirected.status, 302);
  assert.equal(await redirected.text(), 'failure');
  const failed = await local.transport(address('failure'));
  assert.equal(failed.status, 500);
  assert.equal(await failed.text(), 'failure');
  assert.equal(local.requests.length, 2);
});

test('a reset before headers is one failed request', timeout, async t => {
  const local = await fixture(t, stream => stream.close(constants.NGHTTP2_INTERNAL_ERROR));
  await assert.rejects(local.transport(address('reset')), /Stream closed|HTTP\/2/);
  assert.equal(local.requests.length, 1);
});

test('a graceful stream close before headers rejects instead of leaving a pending promise', timeout, async t => {
  const local = await fixture(t, stream => stream.close(constants.NGHTTP2_NO_ERROR));
  await assert.rejects(local.transport(address('closed')), /closed before response headers/);
  assert.equal(local.requests.length, 1);
});

test('aborting a pending request closes its stream without retry', timeout, async t => {
  let started;
  const observed = new Promise(resolve => { started = resolve; });
  const local = await fixture(t, () => started());
  const controller = new AbortController();
  const pending = local.transport(address('abort'), { signal: controller.signal });
  await observed;
  controller.abort();
  await assert.rejects(pending, error => error.code === 'ABORT_ERR');
  assert.equal(local.requests.length, 1);
});

test('aborting after headers errors the response body without retry', timeout, async t => {
  const local = await fixture(t, stream => {
    stream.respond({ ':status': 200, 'content-length': '20' });
    stream.write('start');
  });
  const controller = new AbortController();
  const response = await local.transport(address('body-abort'), { signal: controller.signal });
  const pending = response.arrayBuffer();
  controller.abort();
  await assert.rejects(pending, error => error.code === 'ABORT_ERR');
  assert.equal(local.requests.length, 1);
});

test('GOAWAY retires only the session and subsequent URLs use a new one', timeout, async t => {
  let served = 0;
  const local = await fixture(t, stream => {
    success(stream);
    if (++served === 1) stream.session.goaway(constants.NGHTTP2_NO_ERROR, stream.id);
  });
  const first = local.transport(address('one'));
  const goaway = once(local.clients[0], 'goaway');
  assert.equal(await (await first).text(), 'glTF');
  await goaway;
  assert.equal(await (await local.transport(address('two'))).text(), 'glTF');
  assert.equal(local.clients.length, 2);
  assert.equal(local.requests.length, 2);
});

test('a truncated response body fails instead of returning a complete buffer', timeout, async t => {
  const local = await fixture(t, stream => {
    stream.respond({ ':status': 200, 'content-length': '20' });
    stream.end('short');
  });
  await assert.rejects(async () => (await local.transport(address('truncated'))).arrayBuffer());
  assert.equal(local.requests.length, 1);
});

test('invalid or already-aborted requests open no session', timeout, async t => {
  const local = await fixture(t, success);
  for (const url of ['http://models.atrium.earth/a.glb', 'https://other.example/a.glb', `${address('one')}?`, `${address('one')}#fragment`]) {
    await assert.rejects(local.transport(url), /Unexpected CDN HTTP\/2 address/);
  }
  await assert.rejects(local.transport(address('one'), { signal: AbortSignal.abort() }));
  assert.equal(local.clients.length, 0);
  assert.equal(local.requests.length, 0);
});

test('idle and retired sessions do not keep a completed CLI alive', timeout, async t => {
  const local = await fixture(t, success);
  const module = new URL('./lib/cdn-http2-request.mjs', import.meta.url).href;
  for (const maxRequests of [128, 1]) {
    const source = `
      import { connect } from 'node:http2';
      import { createCdnHttp2Request } from ${JSON.stringify(module)};
      const request = createCdnHttp2Request({
        connect: () => connect(${JSON.stringify(local.origin)}), maxRequests: ${maxRequests}, idleTimeout: 30000
      });
      const response = await request(${JSON.stringify(address('exit'))});
      console.log(await response.text());
    `;
    const result = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], { timeout: 3000 });
    assert.equal(result.stdout.trim(), 'glTF');
  }
});
