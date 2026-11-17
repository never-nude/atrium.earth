import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const site = 'https://atrium.earth';
export const cdn = 'https://models.atrium.earth';
const headerBytes = 12;
const host = /models\.atrium\.earth/gi;
const addressPrefix = /(?:^|[\s"'\x60<>,=(\[\]])(?:https:)?\/\/$/i;
const assetPath = /^\/(?:[a-z0-9_%.-]+\/)*[a-z0-9_%.-]+\.(glb|gltf|usdz|jpg)(?=$|[\s"'\x60<>,})\]])/i;
const documentTypes = /\.(?:html?|json|css|[cm]?js|xml|svg|map|txt|webmanifest)$/i;

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

export async function readCdnAsset(url, { bytes, mime, varyByOrigin = false, full = false }, request = fetch) {
  const target = new URL(url);
  if (target.origin !== cdn || target.username || target.password || target.search || target.hash) {
    throw new Error('Unexpected CDN address');
  }
  if (!Number.isSafeInteger(bytes) || bytes < headerBytes) throw new Error('Invalid registered CDN asset size');
  const response = await request(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Origin: site,
      ...(!full && { Range: `bytes=0-${headerBytes - 1}` }),
      'Accept-Encoding': 'identity',
    },
  });
  const cors = response.headers.get('access-control-allow-origin');
  const contentType = response.headers.get('content-type');
  const vary = response.headers.get('vary');
  const length = response.headers.get('content-length');
  const range = response.headers.get('content-range');
  const encoding = response.headers.get('content-encoding');
  const expectedRange = `bytes 0-${headerBytes - 1}/${bytes}`;
  let issue;
  if (!(response.status === 200 || (!full && response.status === 206))) issue = `HTTP ${response.status}`;
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
  // A validated range is only 12 bytes; finish it without aborting its connection.
  const body = full || response.status === 206
    ? Buffer.from(await response.arrayBuffer()) : await readHeader(response.body);
  if (response.status === 206 && body.length !== headerBytes) {
    throw new Error(`Expected body size ${headerBytes}, received ${body.length}`);
  }
  if (full && body.length !== bytes) throw new Error(`Expected body size ${bytes}, received ${body.length}`);
  return { body, delivery: {
    status: response.status, accessControlAllowOrigin: cors, contentType, vary,
    contentLength: Number(length), contentRange: range,
  } };
}

export async function checkDeliveries(assets, verify) {
  let next = 0;
  const results = new Array(assets.length);
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (next < assets.length) {
      const index = next++;
      const asset = assets[index];
      try {
        if (!asset.bytes) throw new Error('No registered size for this published URL');
        results[index] = { ...asset, delivery: await verify(asset) };
      } catch (error) {
        results[index] = { ...asset, error: [error.message, error.cause?.code].filter(Boolean).join(' ') };
      }
    }
  }));
  return results;
}

export async function writeDeliveryReport(file, summary, results, unresolved = []) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ origin: site, summary, results, unresolved }, null, 2) + '\n');
}
