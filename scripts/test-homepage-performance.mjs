import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { networkTransfers, summarizeHomepagePerformance, transferredAt } from './homepage-performance.mjs';
import { AUTO_START_MODEL_LIMIT } from '../src/lib/viewer-preview.mjs';

const url = 'http://127.0.0.1:12345/';
const event = (method, requestId, timestamp, extra = {}) => ({
  method: `Network.${method}`, params: { requestId, timestamp, ...extra },
});
const request = (id, path, time) => event('requestWillBeSent', id, time, { request: { url: url + path } });
const response = (id, time, bytes) => event('responseReceived', id, time, { response: { status: 200, encodedDataLength: bytes } });
const data = (id, time, bytes, decoded = bytes) => event('dataReceived', id, time, { encodedDataLength: bytes, dataLength: decoded });
const finish = (id, time, bytes) => event('loadingFinished', id, time, { encodedDataLength: bytes });

function fixture() {
  return {
    lighthouse: { finalDisplayedUrl: url, audits: { 'largest-contentful-paint': { numericValue: 1234.4 } } },
    trace: { traceEvents: [
      { name: 'navigationStart', ts: 100e6, args: { frame: 'main', data: { documentLoaderURL: url, navigationId: 'nav' } } },
      { name: 'PerformanceElementTiming', ts: 100.45e6, args: { frame: 'main', data: { identifier: 'atrium-homepage-still', renderTime: 400, rectWidth: 200, rectHeight: 200 } } },
      { name: 'atrium-homepage-still-painted', cat: 'blink.user_timing', ts: 100.5e6, args: { data: { navigationId: 'nav' } } },
    ] },
    devtoolsLog: [
      request('html', '', 100), response('html', 100.1, 200), data('html', 100.15, 400), finish('html', 100.2, 600),
      request('stream', 'stream.bin', 100.1), response('stream', 100.2, 50), data('stream', 100.3, 1000),
      request('model', '__performance-model/models/previews/test/preview.glb', 100.51),
      response('model', 100.55, 50), data('stream', 100.6, 500), finish('stream', 100.7, 1550),
      data('model', 101, 2_650_000), finish('model', 101.1, 2_650_050),
    ],
  };
}

test('counts partial responses at actual still paint and keeps post-paint model bytes separate', () => {
  const result = summarizeHomepagePerformance(fixture());
  assert.deepEqual(result.measured, { lcpMs: 1234, bytesBeforeStill: 1650, bytesBeforeInteraction: 2_652_200 });
  assert.equal(result.stillPaint.source, 'Chromium Element Timing');
  assert.equal(result.stillPaint.timeMs, 400);
  assert.equal(result.stillPaint.gateTimeMs, 500);
  assert.equal(result.underBudget.bytesBeforeStill, true);
  assert.equal(result.underBudget.autoStartedModels, true);
  assert.equal(result.modelTransfers[0].resourceSize, 2_650_000);
  assert.equal(result.budgets.autoStartedModelBytes, AUTO_START_MODEL_LIMIT);
  assert.equal('bytesBeforeInteraction' in result.underBudget, false);
});

test('a model requested after the gate but before actual presentation fails the allowance', () => {
  const f = fixture();
  f.trace.traceEvents.find(e => e.name === 'PerformanceElementTiming').args.data.renderTime = 550;
  const result = summarizeHomepagePerformance(f);
  assert.equal(result.modelTransfers[0].requestedAfterStillGate, true);
  assert.equal(result.modelTransfers[0].requestedAfterStillPaint, false);
  assert.equal(result.underBudget.autoStartedModels, false);
});

test('a CDN first view counts against the homepage model allowance', () => {
  const f = fixture();
  const model = f.devtoolsLog.find(event => event.method === 'Network.requestWillBeSent' && event.params.requestId === 'model');
  model.params.request.url = url + '__performance-model/models/first-views/test/first-f4c7f1cad9bc.glb';
  const result = summarizeHomepagePerformance(f);
  assert.equal(result.modelTransfers[0].url, '/models/first-views/test/first-f4c7f1cad9bc.glb');
  assert.equal(result.modelTransfers[0].resourceSize, 2_650_000);
});

test('a 1.5 MB still budget cannot hide an expensive pre-paint response', () => {
  const f = fixture();
  f.devtoolsLog.splice(4, 0, request('heavy', 'heavy.bin', 100.2), response('heavy', 100.21, 50),
    data('heavy', 100.22, 1_600_000), finish('heavy', 100.23, 1_600_050));
  assert.equal(summarizeHomepagePerformance(f).underBudget.bytesBeforeStill, false);
});

test('model allowance rejects oversize decoded models, early requests, failures and multiple models', () => {
  const oversize = fixture();
  oversize.devtoolsLog.find(e => e.method === 'Network.dataReceived' && e.params.requestId === 'model').params.dataLength = 3_000_001;
  assert.equal(summarizeHomepagePerformance(oversize).underBudget.autoStartedModels, false);
  const early = fixture();
  early.devtoolsLog.find(e => e.method === 'Network.requestWillBeSent' && e.params.requestId === 'model').params.timestamp = 100.49;
  assert.equal(summarizeHomepagePerformance(early).underBudget.autoStartedModels, false);
  const failed = fixture();
  failed.devtoolsLog = failed.devtoolsLog.filter(e => !(e.method === 'Network.loadingFinished' && e.params.requestId === 'model'));
  failed.devtoolsLog.push(event('loadingFailed', 'model', 101.2, { errorText: 'net::ERR_FAILED' }));
  assert.equal(summarizeHomepagePerformance(failed).underBudget.autoStartedModels, false);
  const multiple = fixture();
  multiple.devtoolsLog.push(request('second', 'models/previews/another/preview.glb', 102), response('second', 102.1, 50),
    data('second', 102.2, 1000), finish('second', 102.3, 1050));
  assert.equal(summarizeHomepagePerformance(multiple).underBudget.autoStartedModels, false);
});

test('manual-only hero is allowed, and absent Element Timing uses a clearly labeled gate boundary', () => {
  const f = fixture();
  f.trace.traceEvents = f.trace.traceEvents.filter(e => e.name !== 'PerformanceElementTiming');
  f.devtoolsLog = f.devtoolsLog.filter(e => e.params.requestId !== 'model');
  const result = summarizeHomepagePerformance(f);
  assert.equal(result.stillPaint.source, 'Conservative post-paint gate mark');
  assert.equal(result.stillPaint.timeMs, 500);
  assert.equal(result.underBudget.autoStartedModels, true);
  assert.equal(result.modelTransfers.length, 0);
});

test('missing or duplicated gate telemetry is an error, never a zero-byte pass', () => {
  const missing = fixture();
  missing.trace.traceEvents.pop();
  assert.throws(() => summarizeHomepagePerformance(missing), /Expected one/);
  const duplicate = fixture();
  duplicate.trace.traceEvents.push(duplicate.trace.traceEvents.at(-1));
  assert.throws(() => summarizeHomepagePerformance(duplicate), /Expected one/);
});

test('redirect transfers remain counted and decoded cache hits do not become network bytes', () => {
  const log = [request('redirect', 'old', 100), response('redirect', 100.1, 100),
    event('requestWillBeSent', 'redirect', 100.2, { request: { url: url + 'new' }, redirectResponse: { encodedDataLength: 100 } }),
    response('redirect', 100.3, 50), data('redirect', 100.4, 100), finish('redirect', 100.5, 150),
    request('cached', 'cached', 100.6), response('cached', 100.7, 0), data('cached', 100.8, 0, 5000), finish('cached', 100.9, 0)];
  assert.equal(networkTransfers(log).reduce((sum, r) => sum + transferredAt(r), 0), 250);
});

test('real Chromium trace identifies image presentation and accounts for a response spanning it', {
  timeout: 20000,
  skip: existsSync(chromium.executablePath()) ? false : 'Playwright Chromium is not installed; deterministic trace tests still run',
}, async () => {
  const png = await sharp({ create: { width: 200, height: 200, channels: 3, background: 'orange' } }).png().toBuffer();
  let pendingStream;
  const server = createServer((req, res) => {
    if (req.url === '/still.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length }); res.end(png);
    } else if (req.url === '/stream.bin') {
      pendingStream = res;
      res.writeHead(200, { 'Content-Length': 4000 }); res.write(Buffer.alloc(1000));
    } else if (req.url === '/finish-stream') {
      // The browser releases the rest only after presentation and model delivery.
      pendingStream.end(Buffer.alloc(3000));
      res.writeHead(204); res.end();
    } else if (req.url === '/models/previews/test/preview.glb') {
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': 2000 }); res.end(Buffer.alloc(2000));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<img elementtiming="atrium-homepage-still"><script>
        (async () => {
        const response = await fetch('/stream.bin');
        const reader = response.body.getReader();
        await reader.read();
        const painted = new Promise(resolve => {
          const observer = new PerformanceObserver(list => {
            if (list.getEntries().some(entry => entry.identifier === 'atrium-homepage-still')) {
              observer.disconnect(); resolve();
            }
          });
          observer.observe({ type: 'element', buffered: true });
        });
        document.querySelector('img').src = '/still.png';
        document.querySelector('img').decode().then(() => requestAnimationFrame(() => requestAnimationFrame(async () => {
          await painted;
          // Keep the success fixture beyond presentation-time quantization;
          // the gate-before-presentation failure is covered separately above.
          await new Promise(resolve => setTimeout(resolve, 16));
          performance.mark('atrium-homepage-still-painted');
          await fetch('/models/previews/test/preview.glb').then(r => r.arrayBuffer());
          await fetch('/finish-stream');
          while (!(await reader.read()).done) {}
          window.finished = true;
        })));
        })();
      </script>`);
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const session = await page.context().newCDPSession(page);
    const devtoolsLog = [], traceEvents = [];
    for (const method of ['requestWillBeSent', 'responseReceived', 'dataReceived', 'loadingFinished', 'loadingFailed']) {
      session.on(`Network.${method}`, params => devtoolsLog.push({ method: `Network.${method}`, params }));
    }
    session.on('Tracing.dataCollected', event => traceEvents.push(...event.value));
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,loading', transferMode: 'ReportEvents' });
    const finalDisplayedUrl = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(finalDisplayedUrl);
    await page.waitForFunction(() => window.finished === true);
    const complete = new Promise(resolve => session.once('Tracing.tracingComplete', resolve));
    await session.send('Tracing.end'); await complete;
    const result = summarizeHomepagePerformance({
      lighthouse: { finalDisplayedUrl, audits: { 'largest-contentful-paint': { numericValue: 100 } } },
      trace: { traceEvents }, devtoolsLog,
    });
    assert.equal(result.stillPaint.source, 'Chromium Element Timing');
    assert.equal(result.modelTransfers.length, 1);
    assert.equal(result.modelTransfers[0].resourceSize, 2000);
    assert.equal(result.underBudget.autoStartedModels, true);
    const stream = networkTransfers(devtoolsLog).find(r => r.url.endsWith('/stream.bin'));
    const nav = traceEvents.find(e => e.name === 'navigationStart' && e.args?.data?.documentLoaderURL === finalDisplayedUrl);
    const partial = transferredAt(stream, nav.ts / 1e6 + result.stillPaint.timeMs / 1000);
    assert(partial >= 1000 && partial < transferredAt(stream), 'Count only the early stream chunk, not its eventual complete size');
    assert(result.measured.bytesBeforeInteraction > result.measured.bytesBeforeStill);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
