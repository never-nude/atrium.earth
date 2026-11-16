import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256Hex, signRequest } from './r2-sigv4.mjs';

const publicHost = 'https://models.atrium.earth';
const productionOrigin = 'https://atrium.earth';
const timeout = 60_000;
const [directory, receiptPath] = process.argv.slice(2);
const inventory = JSON.parse(await readFile(join(directory, 'inventory.json'), 'utf8'));
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

const receipt = {
  source: inventory.release,
  origin: productionOrigin,
  retainedJpegs: inventory.retainedJpegs,
  objectCount: inventory.objectCount,
  objectBytes: inventory.objectBytes,
  results: inventory.entries.map(entry => ({ ...entry, status: 'pending', retryFailures: [] })),
};

function retryableError(message, retryable) {
  return Object.assign(new Error(message), { retryable });
}

async function fetchAsset(url, method, headers, body) {
  try {
    return await fetch(url, { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    throw new Error(`${method} failed (${error.name})`);
  }
}

async function retry(row, step, operation) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      row.retryFailures.push({ step, attempt, reason: error.message });
      if (attempt === 3 || error.retryable === false) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
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
    throw retryableError(`R2 PUT returned HTTP ${response.status}`, response.status === 429 || response.status >= 500);
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
    throw retryableError(message, [404, 429].includes(response.status) || response.status >= 500);
  }
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > row.bytes) throw retryableError('Public body exceeds source size', false);
    hash.update(chunk);
  }
  const sha256 = hash.digest('hex');
  if (bytes !== row.bytes || sha256 !== row.sha256) {
    throw retryableError('Public bytes or SHA-256 differ from the pinned source', false);
  }
  return { url, bytes, sha256, contentType: mime, accessControlAllowOrigin: cors, contentLength: length };
}

async function transfer(row) {
  try {
    const body = await readFile(join(directory, row.pagesPath));
    if (body.length !== row.bytes || sha256Hex(body) !== row.sha256) throw new Error('Staged source changed');
    const contentType = row.kind === 'jpeg' ? 'image/jpeg' : 'model/gltf-binary';
    row.put = await retry(row, 'upload', () => put(row, body, contentType));
    row.public = await retry(row, 'readback', () => verify(row, contentType));
    row.status = 'verified';
  } catch (error) {
    row.status = 'failed';
    row.error = error.message;
    console.error(`${row.key}: ${row.error}`);
  }
}

// Prove each path and type against the production CDN before copying the batch.
const canaries = ['firstView', 'jpeg', 'preview'].map(kind => receipt.results.find(row => row.kind === kind));
await Promise.all(canaries.map(transfer));
if (canaries.every(row => row.status === 'verified')) {
  const remaining = receipt.results.filter(row => row.status === 'pending');
  let cursor = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    for (let row; (row = remaining[cursor++]);) await transfer(row);
  }));
}

receipt.summary = {
  copied: receipt.results.filter(row => row.status === 'verified' && row.put === 'copied').length,
  reused: receipt.results.filter(row => row.status === 'verified' && row.put === 'existing').length,
  verified: receipt.results.filter(row => row.status === 'verified').length,
  firstAttemptFailures: receipt.results.filter(row => row.retryFailures.length > 0).length,
  failures: receipt.results.filter(row => row.status === 'failed').length,
  pending: receipt.results.filter(row => row.status === 'pending').length,
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt.summary));
if (receipt.summary.verified !== receipt.objectCount) process.exitCode = 1;
