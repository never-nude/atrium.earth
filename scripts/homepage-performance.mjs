import { AUTO_START_MODEL_LIMIT } from '../src/lib/viewer-preview.mjs';

export const STILL_PAINT_MARK = 'atrium-homepage-still-painted';
export const STILL_ELEMENT_IDENTIFIER = 'atrium-homepage-still';
export const HOMEPAGE_PERFORMANCE_BUDGETS = Object.freeze({
  lcpMs: 2500,
  bytesBeforeStill: 1_500_000,
  autoStartedModelBytes: AUTO_START_MODEL_LIMIT,
  autoStartedModelCount: 1,
});

const positive = value => Number.isFinite(value) && value >= 0 ? value : 0;
const isModel = url => /\/models\/previews\/.*\.glb(?:\?|$)/.test(url);
const displayUrl = url => {
  try { return new URL(url).pathname.replace(/^\/__performance-model/, ''); }
  catch { return url; }
};

// CDP reports compressed body chunks as they arrive, rather than just the
// eventual size of a request. Keep those samples so a response crossing the
// still-paint boundary contributes only the bytes already received.
export function networkTransfers(devtoolsLog) {
  const active = new Map();
  const requests = [];
  for (const message of devtoolsLog) {
    const p = message.params || {};
    const id = `${message.sessionId || ''}:${p.requestId}`;
    const timestamp = p.timestamp;
    if (message.method === 'Network.requestWillBeSent') {
      const previous = active.get(id);
      if (previous && p.redirectResponse) {
        previous.completed = true;
        previous.finalBytes = positive(p.redirectResponse.encodedDataLength);
        previous.samples.push({ timestamp, bytes: previous.finalBytes });
      }
      const request = {
        url: p.request.url, start: timestamp, samples: [], received: 0,
        bodyBytes: 0, completed: false, status: null, failure: null,
      };
      requests.push(request);
      active.set(id, request);
      continue;
    }
    const request = active.get(id);
    if (!request) continue;
    if (message.method === 'Network.responseReceived') {
      request.status = p.response.status;
      request.received = positive(p.response.encodedDataLength);
      request.samples.push({ timestamp, bytes: request.received });
    } else if (message.method === 'Network.dataReceived') {
      request.received += positive(p.encodedDataLength);
      request.bodyBytes += positive(p.dataLength);
      request.samples.push({ timestamp, bytes: request.received });
    } else if (message.method === 'Network.loadingFinished') {
      request.completed = true;
      request.finalBytes = positive(p.encodedDataLength);
      request.samples.push({ timestamp, bytes: request.finalBytes });
    } else if (message.method === 'Network.loadingFailed') {
      request.failure = p.errorText || 'Network request failed';
    }
  }
  return requests;
}

export function transferredAt(request, timestamp = Infinity) {
  const sample = request.samples.filter(s => s.timestamp <= timestamp).at(-1);
  // Final CDP totals are authoritative, including cached responses whose
  // decoded resource size is nonzero but network transfer size is zero.
  return Math.min(sample?.bytes || 0, request.finalBytes ?? Infinity);
}

export function summarizeHomepagePerformance({ lighthouse, trace, devtoolsLog }) {
  const events = trace.traceEvents || trace;
  const finalUrl = lighthouse.finalDisplayedUrl || lighthouse.finalUrl || lighthouse.requestedUrl;
  const navigation = events.find(event => event.name === 'navigationStart'
    && event.args?.data?.isOutermostMainFrame !== false
    && event.args?.data?.documentLoaderURL === finalUrl);
  if (!navigation) throw new Error('Missing main-frame navigation timing in Lighthouse trace');
  const navigationId = navigation.args.data.navigationId;
  const frame = navigation.args.frame;
  const marks = events.filter(event => event.name === STILL_PAINT_MARK
    && event.cat?.includes('blink.user_timing') && event.ts >= navigation.ts
    && (!event.args?.data?.navigationId || event.args.data.navigationId === navigationId));
  if (marks.length !== 1) throw new Error(`Expected one ${STILL_PAINT_MARK} mark; found ${marks.length}`);
  const gate = marks[0];
  const element = events.filter(event => event.name === 'PerformanceElementTiming'
    && event.args?.frame === frame
    && event.args?.data?.identifier === STILL_ELEMENT_IDENTIFIER
    && event.args.data.renderTime > 0
    && event.args.data.rectWidth > 0 && event.args.data.rectHeight > 0)
    .sort((a, b) => a.args.data.renderTime - b.args.data.renderTime)[0];
  const gateMs = (gate.ts - navigation.ts) / 1000;
  const stillMs = element?.args.data.renderTime ?? gateMs;
  const stillTimestamp = navigation.ts / 1e6 + stillMs / 1000;
  const gateTimestamp = gate.ts / 1e6;
  const requests = networkTransfers(devtoolsLog);
  if (!requests.length) throw new Error('Lighthouse did not capture network transfers');
  const sumAt = timestamp => requests.reduce((sum, request) => sum + transferredAt(request, timestamp), 0);
  const networkAudits = lighthouse.audits['network-requests']?.details?.items || [];
  const modelTransfers = requests.filter(request => isModel(request.url)).map(request => ({
    url: displayUrl(request.url),
    startTimeMs: Math.round((request.start - navigation.ts / 1e6) * 1000),
    statusCode: request.status,
    completed: request.completed,
    failure: request.failure,
    transferSize: transferredAt(request),
    resourceSize: Math.max(request.bodyBytes,
      positive(networkAudits.find(item => item.url === request.url)?.resourceSize)),
    requestedAfterStillGate: request.start >= gateTimestamp,
    requestedAfterStillPaint: request.start >= stillTimestamp,
  }));
  const measured = {
    lcpMs: Math.round(lighthouse.audits['largest-contentful-paint']?.numericValue),
    bytesBeforeStill: sumAt(stillTimestamp),
    bytesBeforeInteraction: sumAt(Infinity),
  };
  if (!Number.isFinite(measured.lcpMs)) throw new Error('Lighthouse did not report LCP');
  const budgets = HOMEPAGE_PERFORMANCE_BUDGETS;
  const underBudget = {
    lcpMs: measured.lcpMs <= budgets.lcpMs,
    bytesBeforeStill: measured.bytesBeforeStill <= budgets.bytesBeforeStill,
    autoStartedModels: modelTransfers.length <= budgets.autoStartedModelCount
      && modelTransfers.every(model => model.completed && model.statusCode === 200
        && !model.failure && model.requestedAfterStillGate && model.requestedAfterStillPaint
        && model.resourceSize > 0 && model.resourceSize <= budgets.autoStartedModelBytes),
  };
  const lastTimestamp = Math.max(...requests.flatMap(request => request.samples.map(sample => sample.timestamp)));
  return {
    status: 'measured', measured, budgets, underBudget, modelTransfers,
    stillPaint: {
      source: element ? 'Chromium Element Timing' : 'Conservative post-paint gate mark',
      timeMs: stillMs, gateTimeMs: gateMs,
      bytesBeforeGate: sumAt(gateTimestamp),
      identifier: STILL_ELEMENT_IDENTIFIER, mark: STILL_PAINT_MARK,
    },
    observation: {
      lighthouseThrottlingMethod: lighthouse.configSettings?.throttlingMethod || null,
      noInteractionWindowMs: Math.round((lastTimestamp - navigation.ts / 1e6) * 1000),
      incompleteRequests: requests.filter(request => !request.completed).map(request => ({
        url: displayUrl(request.url), receivedBytes: transferredAt(request), failure: request.failure,
      })),
      method: 'Actual CDP encoded transfer bytes, including headers and partial responses at the still boundary. The full Lighthouse navigation has no user interaction; its end is the observation cutoff. LCP is Lighthouse’s separate reported metric and may use simulated throttling; byte boundaries use observed trace timestamps. Only bytesBeforeStill uses the 1.5 MB budget. One completed model within the shared auto-start size limit may be requested after both the still gate and actual still presentation when available.',
    },
  };
}
