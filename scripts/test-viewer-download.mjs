import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchViewerModel } from '../src/lib/viewer-download.mjs';

const modelUrl = 'https://models.atrium.earth/test.glb';

function streamResponse(chunks, headers = {}, cancel) {
  const stream = new ReadableStream({
    pull(controller) {
      if (chunks.length) controller.enqueue(chunks.shift());
      else controller.close();
    },
    cancel,
  }, { highWaterMark: 0 });
  return new Response(stream, { headers });
}

function captureProgress(callback) {
  const updates = [];
  return { updates, onProgress(progress) {
    updates.push([progress.loadedBytes, progress.totalBytes]);
    callback?.(progress);
  } };
}

test('reports streamed progress using catalog bytes and preserves every received byte', async t => {
  const response = streamResponse([
    new Uint8Array([9, 1, 2, 9]).subarray(1, 3),
    new Uint8Array([]),
    new Uint8Array([3, 4, 5]),
  ], { 'content-length': '12' });
  const { signal } = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async () => response);
  t.mock.method(response, 'arrayBuffer', () => assert.fail('Progress must read the stream only once'));
  const { updates, onProgress } = captureProgress();

  const buffer = await fetchViewerModel(modelUrl, { signal, expectedBytes: 5, onProgress });

  assert.deepEqual(fetch.mock.calls[0].arguments, [modelUrl, { signal }]);
  assert.ok(buffer instanceof ArrayBuffer);
  assert.deepEqual([...new Uint8Array(buffer)], [1, 2, 3, 4, 5]);
  assert.deepEqual(updates, [[0, 5], [2, 5], [5, 5]]);
  assert.equal(response.body.locked, false);
});

test('uses a visible Content-Length, and handles absent or compressed lengths', async t => {
  const cases = [
    { headers: { 'content-length': '3' }, updates: [[0, 3], [2, 3], [3, 3]] },
    { headers: {}, updates: [[0, null], [2, null], [3, null], [3, 3]] },
    { headers: { 'content-length': '20', 'content-encoding': 'gzip' }, updates: [[0, null], [2, null], [3, null], [3, 3]] },
  ];
  let headers;
  t.mock.method(globalThis, 'fetch', async () => streamResponse([
    new Uint8Array([1, 2]), new Uint8Array([3]),
  ], headers));

  for (const fixture of cases) {
    headers = fixture.headers;
    const { updates, onProgress } = captureProgress();
    const buffer = await fetchViewerModel(modelUrl, { onProgress });
    assert.deepEqual([...new Uint8Array(buffer)], [1, 2, 3]);
    assert.deepEqual(updates, fixture.updates);
  }
});

test('corrects a stale catalog length in either direction without dropping bytes or fetching again', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => streamResponse([
    new Uint8Array([1, 2]), new Uint8Array([3, 4]),
  ]));
  const cases = [
    { expectedBytes: 3, updates: [[0, 3], [2, 3], [4, null], [4, 4]] },
    { expectedBytes: 6, updates: [[0, 6], [2, 6], [4, 6], [4, 4]] },
  ];

  for (const fixture of cases) {
    const { updates, onProgress } = captureProgress();
    const buffer = await fetchViewerModel(modelUrl, { expectedBytes: fixture.expectedBytes, onProgress });
    assert.deepEqual([...new Uint8Array(buffer)], [1, 2, 3, 4]);
    assert.deepEqual(updates, fixture.updates);
  }
  assert.equal(fetch.mock.callCount(), cases.length);
});

test('retains the ArrayBuffer fallback when streams or progress are unavailable', async t => {
  const body = new Uint8Array([7, 8, 9]).buffer;
  const response = { ok: true, headers: new Headers(), body: null, arrayBuffer: async () => body };
  const arrayBuffer = t.mock.method(response, 'arrayBuffer');
  t.mock.method(globalThis, 'fetch', async () => response);
  const { updates, onProgress } = captureProgress();

  assert.equal(await fetchViewerModel(modelUrl, { onProgress }), body);
  assert.deepEqual(updates, [[0, null], [3, 3]]);
  assert.equal(await fetchViewerModel(modelUrl), body);
  assert.equal(arrayBuffer.mock.callCount(), 2);
});

test('retains the HTTP error text and never reports progress for a failed request', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('missing', { status: 404 }));
  await assert.rejects(fetchViewerModel(modelUrl, {
    onProgress: () => assert.fail('A failed response should not report downloaded bytes'),
  }), { message: 'Model request failed: 404' });
});

test('cancels an aborted stream and leaves no reader lock or extra progress updates', async t => {
  const controller = new AbortController();
  const reason = new DOMException('Viewer left the page', 'AbortError');
  let cancelledWith;
  const response = streamResponse([new Uint8Array([1, 2]), new Uint8Array([3, 4])], {}, value => { cancelledWith = value; });
  const fetch = t.mock.method(globalThis, 'fetch', async () => response);
  const { updates, onProgress } = captureProgress(({ loadedBytes }) => {
    if (loadedBytes > 0) controller.abort(reason);
  });

  await assert.rejects(fetchViewerModel(modelUrl, { signal: controller.signal, onProgress }), error => error === reason);
  assert.equal(cancelledWith, reason);
  assert.equal(response.body.locked, false);
  assert.deepEqual(updates, [[0, null], [2, null]]);
  await assert.rejects(fetchViewerModel(modelUrl, { signal: controller.signal }), error => error === reason);
  assert.equal(fetch.mock.callCount(), 1, 'An already aborted load must not send another request');
});

test('propagates a response stream failure without reporting completion', async t => {
  const reason = new Error('Connection closed while downloading');
  const response = new Response(new ReadableStream({ pull(controller) { controller.error(reason); } }));
  t.mock.method(globalThis, 'fetch', async () => response);
  const { updates, onProgress } = captureProgress();

  await assert.rejects(fetchViewerModel(modelUrl, { expectedBytes: 24, onProgress }), error => error === reason);
  assert.deepEqual(updates, [[0, 24]]);
  assert.equal(response.body.locked, false);
});
