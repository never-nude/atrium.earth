import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requestCdnResource } from './cdn-http2-request.mjs';
export { requestCdnResource } from './cdn-http2-request.mjs';

export const site = 'https://atrium.earth';
export const cdn = 'https://models.atrium.earth';
const headerBytes = 12;
const host = /models\.atrium\.earth/gi;
const addressPrefix = /(?:^|[\s"'\x60<>,=(\[\]])(?:https:)?\/\/$/i;
const assetPath = /^\/(?:[a-z0-9_%.-]+\/)*[a-z0-9_%.-]+\.(glb|gltf|usdz|jpg)(?=$|[\s"'\x60<>,})\]])/i;
const documentTypes = /\.(?:html?|json|css|[cm]?js|xml|svg|map|txt|webmanifest)$/i;
export const CDN_AUDIT_START_INTERVAL_MS = 100;

// Share one start gate across audits in this process. Verification responses may
// overlap; the existing worker count still bounds each audit to four in flight.
// Queued pacing does not consume a request's 20-second delivery deadline.
export function createCdnAuditStartGate({
  now = () => performance.now(),
  wait = milliseconds => new Promise(resolve => setTimeout(resolve, Math.ceil(milliseconds))),
} = {}) {
  let previousStart = -Infinity;
  let turn = Promise.resolve();
  return start => {
    const started = turn.then(async () => {
      let time = now();
      if (!Number.isFinite(time)) throw new Error('Audit clock must be finite');
      while (time - previousStart < CDN_AUDIT_START_INTERVAL_MS) {
        await wait(CDN_AUDIT_START_INTERVAL_MS - (time - previousStart));
        time = now();
        if (!Number.isFinite(time)) throw new Error('Audit clock must be finite');
      }
      // An object prevents the queue from awaiting the verification response.
      // Measure after synchronous dispatch setup as well, so a slower first
      // connection cannot shorten the next actual request's spacing.
      try {
        return { pending: start() };
      } finally {
        previousStart = now();
        if (!Number.isFinite(previousStart)) throw new Error('Audit clock must be finite');
      }
    });
    turn = started.then(() => {}, () => {});
    return started.then(({ pending }) => pending);
  };
}
const paceAuditStart = createCdnAuditStartGate();

function httpFailure(response) {
  const details = [];
  const fields = [
    ['retry-after', 'Retry-After', 128, value => /^\d{1,10}$/.test(value)
      || (/^[a-z]{3}, \d{2} [a-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/i.test(value) && Number.isFinite(Date.parse(value)))],
    ['cf-ray', 'CF-Ray', 96, value => /^[a-f0-9]{8,64}(?:-[a-z0-9]{2,12})?$/i.test(value)],
    ['cf-cache-status', 'CF-Cache-Status', 32, value => /^(?:HIT|MISS|DYNAMIC|EXPIRED|STALE|BYPASS|REVALIDATED|UPDATING|NONE|UNKNOWN)$/i.test(value)],
    ['cf-mitigated', 'CF-Mitigated', 32, value => /^challenge$/i.test(value)],
  ];
  // Only public operational headers are reported, never cookies, credentials
  // or the error body. Unexpected/oversized field contents are not copied.
  for (const [name, label, maximum, valid] of fields) {
    const raw = response.headers.get(name);
    if (!raw) continue;
    const value = raw.trim();
    details.push(label + ': ' + (value.length <= maximum && valid(value) ? value : '[invalid]'));
  }
  return 'HTTP ' + response.status + (details.length ? ' (' + details.join('; ') + ')' : '');
}

async function* documents(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* documents(filename);
    else if (entry.isFile() && (documentTypes.test(entry.name) || entry.name === '_redirects')) yield filename;
  }
}

function knownTemplate(document, prefix, suffix) {
  if (!prefix.endsWith('`https://')) return false;
  if (document === 'artwork-image-recovery.js') {
    return suffix.startsWith('/previews/renders/${slug}/thumb-${hash}.jpg`');
  }
  return /^spatial-museum\/assets\/index-[\w-]+\.js$/.test(document)
    && suffix.startsWith('/models/rooms/${e.room.id}/room-${t.sha256.slice(0,12)}.usdz`');
}

export async function scanBuiltCdnReferences(directory) {
  const models = new Map();
  const jpegs = new Map();
  const unresolved = [];
  let documentCount = 0;
  for await (const filename of documents(directory)) {
    documentCount += 1;
    const document = path.relative(directory, filename).split(path.sep).join('/');
    const source = (await readFile(filename, 'utf8')).replaceAll('\\/', '/');
    for (const { index, 0: domain } of source.matchAll(host)) {
      const prefix = source.slice(Math.max(0, index - 9), index);
      const suffix = source.slice(index + domain.length);
      const match = addressPrefix.test(prefix) && suffix.match(assetPath);
      if (match) {
        const url = cdn + match[0];
        const references = match[1].toLowerCase() === 'jpg' ? jpegs : models;
        if (!references.has(url)) references.set(url, document);
      } else if (!knownTemplate(document, prefix, suffix)) {
        unresolved.push({ document, reference: prefix + domain + suffix.slice(0, 100) });
      }
    }
  }
  return { models, jpegs, unresolved, documentCount };
}

async function readHeader(body) {
  const reader = body.getReader();
  const header = Buffer.alloc(headerBytes);
  let offset = 0;
  try {
    while (offset < header.length) {
      const { done, value } = await reader.read();
      if (done) throw new Error(`Response ended before ${headerBytes} bytes`);
      const prefix = value.subarray(0, header.length - offset);
      header.set(prefix, offset);
      offset += prefix.length;
    }
    return header;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function readCdnAsset(url, { bytes, mime, varyByOrigin = false, full = false }, request = requestCdnResource) {
  const target = new URL(url);
  if (target.origin !== cdn || target.username || target.password || target.search || target.hash) {
    throw new Error('Unexpected CDN address');
  }
  if (!Number.isSafeInteger(bytes) || bytes < headerBytes) throw new Error('Invalid registered CDN asset size');
  let response;
  try {
    response = await request(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        Origin: site,
        ...(!full && { Range: `bytes=0-${headerBytes - 1}` }),
        'Accept-Encoding': 'identity',
      },
    });
  } catch (error) {
    error.deliveryPhase = 'response headers';
    throw error;
  }
  const cors = response.headers.get('access-control-allow-origin');
  const contentType = response.headers.get('content-type');
  const vary = response.headers.get('vary');
  const length = response.headers.get('content-length');
  const range = response.headers.get('content-range');
  const encoding = response.headers.get('content-encoding');
  const expectedRange = `bytes 0-${headerBytes - 1}/${bytes}`;
  let issue;
  if (!(response.status === 200 || (!full && response.status === 206))) issue = httpFailure(response);
  else if (varyByOrigin && cors !== site) issue = `Expected production CORS, received ${cors || 'no header'}`;
  else if (varyByOrigin && !vary?.split(',').some(value => value.trim().toLowerCase() === 'origin')) {
    issue = `Expected Vary: Origin, received ${vary || 'no header'}`;
  } else if (contentType?.split(';')[0].trim().toLowerCase() !== mime) {
    issue = `Expected Content-Type ${mime}, received ${contentType || 'no header'}`;
  } else if (encoding && encoding.toLowerCase() !== 'identity') issue = `Unexpected content encoding ${encoding}`;
  else if (response.status === 206 && (range !== expectedRange || length !== String(headerBytes))) {
    issue = `Expected range ${expectedRange} with length ${headerBytes}, received ${range || 'no range'} with length ${length || 'unreported'}`;
  } else if (response.status === 200 && length !== String(bytes)) {
    issue = `Expected Content-Length ${bytes}, received ${length || 'no header'}`;
  } else if (!response.body) issue = 'Missing response body';
  if (issue) {
    await response.body?.cancel().catch(() => {});
    throw new Error(issue);
  }
  // Finish the complete range body so an early stream close is a failure.
  const complete = full || response.status === 206;
  let body;
  try {
    body = complete ? Buffer.from(await response.arrayBuffer()) : await readHeader(response.body);
  } catch (error) {
    error.deliveryPhase = 'response body';
    throw error;
  }
  if (response.status === 206 && body.length !== headerBytes) {
    throw new Error(`Expected body size ${headerBytes}, received ${body.length}`);
  }
  if (full && body.length !== bytes) throw new Error(`Expected body size ${bytes}, received ${body.length}`);
  return { body, delivery: {
    status: response.status, accessControlAllowOrigin: cors, contentType, vary,
    contentLength: Number(length), contentRange: range,
  } };
}

export async function checkDeliveries(assets, verify, { paceStart = paceAuditStart } = {}) {
  let next = 0;
  const results = new Array(assets.length);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < assets.length) {
      const index = next++;
      const asset = assets[index];
      try {
        if (!asset.bytes) throw new Error('No registered size for this published URL');
        results[index] = { ...asset, delivery: await paceStart(() => verify(asset)) };
      } catch (error) {
        results[index] = { ...asset, error: [
          error.deliveryPhase && `[${error.deliveryPhase}]`, error.message, error.code || error.cause?.code,
        ].filter(Boolean).join(' ') };
      }
    }
  }));
  return results;
}

export async function writeDeliveryReport(file, summary, results, unresolved = []) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ origin: site, summary, results, unresolved }, null, 2) + '\n');
}
