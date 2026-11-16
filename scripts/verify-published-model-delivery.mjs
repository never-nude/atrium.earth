// Verify the model URLs that the completed package exposes to visitors.
// A 12-byte range checks the whole file's recorded size without repeatedly
// downloading the model catalogue.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { firstViewFor } from '../src/lib/first-view-models.mjs';

const site = 'https://atrium.earth';
const cdn = 'https://models.atrium.earth';
const modelReference = /(?:https?:)?\/\/models\.atrium\.earth(?::\d+)?\/[^\s"'<>),}]+?\.(?:glb|gltf|usdz)\b[^\s"'<>),}\]]*/gi;
const buildDocument = /\.(?:html|json|css|js|mjs|xml)$/i;
const headerBytes = 12;
const reportFile = 'test-results/published-model-delivery.json';

async function* documents(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* documents(filename);
    else if (entry.isFile() && buildDocument.test(entry.name)) yield filename;
  }
}

export async function referencedModels(directory) {
  const references = new Map();
  let documentCount = 0;
  for await (const filename of documents(directory)) {
    documentCount += 1;
    const document = await readFile(filename, 'utf8');
    for (const [reference] of document.replaceAll('\\/', '/').matchAll(modelReference)) {
      const url = new URL(reference, site).href;
      if (!references.has(url)) references.set(url, path.relative(directory, filename));
    }
  }
  return { references, documentCount };
}

async function registeredModels() {
  const [previews, bindings, museum] = await Promise.all([
    '../src/data/previews.json',
    '../src/data/first-view-models.json',
    '../public/spatial-museum/collection-manifest.json',
  ].map(async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'))));
  const metadata = new Map();
  const records = [
    ...Object.values(previews),
    ...Object.entries(bindings).map(([slug, binding]) => firstViewFor(slug, previews[slug], binding)),
    ...museum.rooms.map(room => room.appleAR),
  ];
  for (const record of records) {
    if (!record?.url?.startsWith(cdn + '/')) continue;
    if (!Number.isSafeInteger(record.bytes) || record.bytes < headerBytes) {
      throw new Error(`Invalid registered size for ${record.url}`);
    }
    if (metadata.has(record.url) && metadata.get(record.url) !== record.bytes) {
      throw new Error(`Conflicting registered sizes for ${record.url}`);
    }
    metadata.set(record.url, record.bytes);
  }
  return metadata;
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

export async function verifyPublishedModel(url, bytes, request = fetch) {
  const target = new URL(url);
  if (target.origin !== cdn || target.username || target.password || target.search || target.hash) {
    throw new Error('Unexpected model CDN address');
  }
  const response = await request(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    headers: {
      Origin: site,
      Range: `bytes=0-${headerBytes - 1}`,
      'Accept-Encoding': 'identity',
    },
  });
  const cors = response.headers.get('access-control-allow-origin');
  const length = response.headers.get('content-length');
  const range = response.headers.get('content-range');
  const encoding = response.headers.get('content-encoding');
  let issue;
  if (![200, 206].includes(response.status)) issue = `HTTP ${response.status}`;
  else if (cors !== site) issue = `Expected production CORS, received ${cors || 'no header'}`;
  else if (encoding && encoding !== 'identity') issue = `Unexpected content encoding ${encoding}`;
  else if (response.status === 206 && (range !== `bytes 0-11/${bytes}` || length !== String(headerBytes))) {
    issue = `Expected range bytes 0-11/${bytes} with length ${headerBytes}, received ${range || 'no range'} with length ${length || 'unreported'}`;
  } else if (response.status === 200 && length !== String(bytes)) {
    issue = `Expected Content-Length ${bytes}, received ${length || 'no header'}`;
  } else if (!response.body) issue = 'Missing response body';
  if (issue) {
    await response.body?.cancel().catch(() => {});
    throw new Error(issue);
  }

  const header = await readHeader(response.body);
  if (target.pathname.endsWith('.glb') && (
    header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2 || header.readUInt32LE(8) !== bytes
  )) throw new Error('Invalid GLB header or declared file size');
  if (target.pathname.endsWith('.usdz') && header.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Invalid USDZ ZIP header');
  }
  return { status: response.status, accessControlAllowOrigin: cors, contentLength: Number(length), contentRange: range };
}

export async function verifyModelDelivery(directory = 'dist') {
  await rm(reportFile, { force: true });
  const { references, documentCount } = await referencedModels(directory);
  const metadata = await registeredModels();
  const models = [...references].map(([url, document]) => ({ url, bytes: metadata.get(url), document }));
  if (!models.length) throw new Error('No CDN model addresses were found in the built package');

  let next = 0;
  const results = new Array(models.length);
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (next < models.length) {
      const index = next++;
      const model = models[index];
      try {
        if (!model.bytes) throw new Error('No registered model size for this published URL');
        const delivery = await verifyPublishedModel(model.url, model.bytes);
        results[index] = { ...model, delivery };
      } catch (error) {
        const details = [error.message, error.cause?.code].filter(Boolean).join(' ');
        results[index] = { ...model, error: details };
      }
    }
  }));

  const failures = results.filter(result => result.error);
  const summary = { models: models.length, documentCount, passed: models.length - failures.length, failed: failures.length };
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, JSON.stringify({ origin: site, summary, results }, null, 2) + '\n');
  console.log(`Model CDN first-attempt delivery: ${summary.passed}/${summary.models} passed across ${documentCount} build documents.`);
  if (failures.length) {
    for (const { url, document, error } of failures) console.error(`${url} (${document}): ${error}`);
    throw new Error(`${summary.failed} model CDN checks failed. See ${reportFile}.`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  verifyModelDelivery(process.argv[2]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
