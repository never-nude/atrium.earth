import { createHash } from 'node:crypto';
import { open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex, signRequest } from './r2-sigv4.mjs';

const publicHost = 'https://models.atrium.earth';
const productionOrigin = 'https://atrium.earth';
const timeout = 60_000;
const [input, output] = process.argv.slice(2);
const {
  R2_ACCOUNT_ID: account,
  R2_BUCKET: bucket,
  R2_ACCESS_KEY_ID: accessKeyId,
  R2_SECRET_ACCESS_KEY: secretAccessKey,
} = process.env;
if (!/^[a-f0-9]{32}$/.test(account) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)
    || !accessKeyId || !secretAccessKey) {
  throw new Error('The configured R2 upload credentials are incomplete');
}

async function fetchAsset(url, method, headers, body) {
  try {
    return await fetch(url, { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    throw new Error(`${method} failed (${error.name})`);
  }
}

async function put(row, body, contentType) {
  const target = `https://${account}.r2.cloudflarestorage.com/${bucket}/${row.key}`;
  const { headers } = signRequest({
    method: 'PUT', url: target, accessKeyId, secretAccessKey, payloadHash: row.sha256,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      'if-none-match': '*',
    },
  });
  const response = await fetchAsset(target, 'PUT', headers, body);
  await response.body?.cancel();
  if (response.status === 412) return 'existing';
  if (!response.ok) {
    throw new Error(`R2 PUT returned HTTP ${response.status}`);
  }
  return 'copied';
}

async function verify(row, contentType) {
  const url = `${publicHost}/${row.key}`;
  const response = await fetchAsset(url, 'GET', { origin: productionOrigin, 'accept-encoding': 'identity' });
  const cors = response.headers.get('access-control-allow-origin');
  const mime = response.headers.get('content-type')?.split(';')[0].trim();
  const length = response.headers.get('content-length');
  if (response.status !== 200 || cors !== productionOrigin || mime !== contentType
      || (length !== null && Number(length) !== row.bytes)) {
    await response.body?.cancel();
    const message = `Public GET returned HTTP ${response.status}, CORS ${cors}, type ${mime}, length ${length}`;
    throw new Error(message);
  }
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > row.bytes) throw new Error('Public body exceeds source size');
    hash.update(chunk);
  }
  const sha256 = hash.digest('hex');
  if (bytes !== row.bytes || sha256 !== row.sha256) {
    throw new Error('Public bytes or SHA-256 differ from the pinned source');
  }
  return { url, bytes, sha256, contentType: mime, accessControlAllowOrigin: cors, contentLength: length };
}

async function transfer(directory, row) {
  try {
    const body = await readFile(join(directory, row.pagesPath));
    if (body.length !== row.bytes || sha256Hex(body) !== row.sha256) throw new Error('Staged source changed');
    const contentType = row.kind === 'jpeg' ? 'image/jpeg' : 'model/gltf-binary';
    row.put = await put(row, body, contentType);
    row.public = await verify(row, contentType);
    row.status = 'verified';
  } catch (error) {
    row.status = 'failed';
    row.error = error.message;
    console.error(`${row.key}: ${row.error}`);
  }
}

async function copyBatch(directory, receiptPath) {
  const inventory = JSON.parse(await readFile(join(directory, 'inventory.json'), 'utf8'));
  const receipt = {
    source: inventory.release,
    origin: productionOrigin,
    retainedJpegs: inventory.retainedJpegs,
    objectCount: inventory.objectCount,
    objectBytes: inventory.objectBytes,
    results: inventory.entries.map(entry => ({ ...entry, status: 'pending' })),
  };
  // Prove each path and type against the production CDN before copying the batch.
  const canaries = ['firstView', 'jpeg', 'preview'].map(kind => receipt.results.find(row => row.kind === kind));
  await Promise.all(canaries.map(row => transfer(directory, row)));
  if (canaries.every(row => row.status === 'verified')) {
    const remaining = receipt.results.filter(row => row.status === 'pending');
    let cursor = 0;
    await Promise.all(Array.from({ length: 12 }, async () => {
      for (let row; (row = remaining[cursor++]);) await transfer(directory, row);
    }));
  }
  const verified = receipt.results.filter(row => row.status === 'verified');
  const failed = receipt.results.filter(row => row.status === 'failed');
  receipt.summary = {
    copied: verified.filter(row => row.put === 'copied').length,
    reused: verified.filter(row => row.put === 'existing').length,
    verified: verified.length,
    firstAttemptFailures: failed.length,
    failures: failed.length,
    pending: receipt.results.length - verified.length - failed.length,
  };
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt.summary));
  if (receipt.summary.verified !== receipt.objectCount) process.exitCode = 1;
}

async function refreshJpeg(slug) {
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/.test(slug)) throw new Error('Invalid artwork slug');
  const path = `previews/renders/${slug}/thumb.jpg`;
  const manifest = fileURLToPath(new URL('../src/data/pages-cdn-assets.json', import.meta.url));
  const lockPath = `${manifest}.lock`;
  const temporary = `${manifest}.${process.pid}.tmp`;
  const lock = await open(lockPath, 'wx');
  try {
    const assets = JSON.parse(await readFile(manifest, 'utf8'));
    if (!Object.hasOwn(assets, `/${path}`)) throw new Error('Expected an existing Stage 1 JPEG binding');
    const body = await readFile(new URL(`../public/${path}`, import.meta.url));
    if (body.length < 5 || body.subarray(0, 3).toString('hex') !== 'ffd8ff'
        || body.subarray(-2).toString('hex') !== 'ffd9') throw new Error('Invalid generated JPEG');
    const sha256 = sha256Hex(body);
    const row = { key: `previews/renders/${slug}/thumb-${sha256.slice(0, 12)}.jpg`, bytes: body.length, sha256 };
    const uploaded = await put(row, body, 'image/jpeg');
    const publicReceipt = await verify(row, 'image/jpeg');
    assets[`/${path}`] = row;
    await writeFile(temporary, JSON.stringify(assets, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, manifest);
    console.log(JSON.stringify({ path, uploaded, ...publicReceipt }));
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
    await rm(temporary, { force: true });
  }
}

if (!input || !output) throw new Error('Provide an inventory directory and receipt path, or --refresh-jpeg <slug>');
if (input === '--refresh-jpeg') await refreshJpeg(output);
else await copyBatch(input, output);
