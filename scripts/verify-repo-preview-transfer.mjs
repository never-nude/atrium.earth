#!/usr/bin/env node
// Verify the exact reviewed repository-to-R2 delivery transfer. No credentials,
// uploads, catalogue mutations or partial verification receipts belong here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PRODUCTION_ORIGIN = 'https://atrium.earth';
export const PUBLIC_MODEL_ORIGIN = 'https://models.atrium.earth';
export const TRANSFER_COUNT = 20;
const slugPattern = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitPattern = /^[a-f0-9]{40}$/u;
const sha256 = body => createHash('sha256').update(body).digest('hex');

export function transferPublicUrl(model) {
  return `${PUBLIC_MODEL_ORIGIN}/models/previews/${model.slug}/preview-${model.sha256.slice(0, 12)}.glb`;
}

export function validateTransferManifest(manifest) {
  assert.equal(manifest?.schema, 'atrium-repo-preview-transfer/1', 'Unexpected transfer manifest schema');
  assert.match(manifest.sourceCommit || '', gitPattern, 'A pinned source commit is required');
  assert.ok(Number.isSafeInteger(manifest.max_total_bytes) && manifest.max_total_bytes > 0
    && manifest.max_total_bytes <= 160_000_000, 'Invalid total-byte ceiling (maximum160,000,000)');
  assert.ok(Array.isArray(manifest.models) && manifest.models.length === TRANSFER_COUNT, 'Transfer must contain exactly20 models');
  const slugs = new Set(), paths = new Set();
  let total = 0;
  for (const model of manifest.models) {
    assert.match(model.slug || '', slugPattern, 'Invalid transfer slug');
    assert.ok(!slugs.has(model.slug), `${model.slug}: duplicate manifest identity`);
    assert.match(model.gitBlob || '', gitPattern, `${model.slug}: missing pinned Git blob`);
    assert.match(model.sha256 || '', sha256Pattern, `${model.slug}: invalid SHA-256`);
    assert.ok(Number.isSafeInteger(model.bytes) && model.bytes >= 20 && model.bytes <= 20_000_000, `${model.slug}: invalid byte count (20..20,000,000)`);
    const prefix = `/models/previews/${model.slug}/`;
    assert.ok(typeof model.currentUrl === 'string'
      && model.currentUrl.startsWith(prefix)
      && /^preview(?:-[a-f0-9]+)?\.glb$/u.test(model.currentUrl.slice(prefix.length)), `${model.slug}: invalid original public URL`);
    assert.equal(model.sourcePath, `public${model.currentUrl}`, `${model.slug}: source/public path mismatch`);
    assert.ok(!paths.has(model.sourcePath), `${model.slug}: duplicate source path`);
    slugs.add(model.slug); paths.add(model.sourcePath); total += model.bytes;
    assert.ok(Number.isSafeInteger(total) && total <= manifest.max_total_bytes, 'Transfer exceeds its reviewed total-byte ceiling');
  }
  return manifest.models;
}

/** Pure one-to-one validation of the reviewed identities and uploader outputs. */
export function validateTransferMetadata(manifest, previewMap, uploadReport) {
  const models = validateTransferManifest(manifest);
  assert.ok(previewMap && typeof previewMap === 'object' && !Array.isArray(previewMap), 'Invalid upload preview map');
  assert.deepEqual(Object.keys(previewMap).sort(), models.map(model => model.slug).sort(), 'Preview map must contain exactly the reviewed20 identities');
  assert.ok(Array.isArray(uploadReport?.failed) && uploadReport.failed.length === 0, 'Upload report has failures or no failure record');
  assert.ok(Array.isArray(uploadReport.uploaded) && uploadReport.uploaded.length === TRANSFER_COUNT, 'Upload report must contain exactly20 uploaded records');
  assert.ok(!uploadReport.unchanged || (Array.isArray(uploadReport.unchanged) && uploadReport.unchanged.length === 0), 'Unchanged records cannot replace complete upload evidence');
  assert.ok(!uploadReport.public_base || uploadReport.public_base === PUBLIC_MODEL_ORIGIN, 'Unexpected public model origin');
  const uploads = new Map();
  for (const entry of uploadReport.uploaded) {
    assert.ok(entry && typeof entry.slug === 'string' && !uploads.has(entry.slug), 'Duplicate or invalid upload identity');
    assert.ok(!entry.dry_run, `${entry.slug}: dry-run output is not delivery evidence`);
    uploads.set(entry.slug, entry);
  }
  assert.deepEqual([...uploads.keys()].sort(), models.map(model => model.slug).sort(), 'Upload report identities differ from the reviewed transfer');
  return models.map(model => {
    const url = transferPublicUrl(model);
    const preview = previewMap[model.slug], uploaded = uploads.get(model.slug);
    assert.equal(preview?.url, url, `${model.slug}: unexpected preview URL`);
    assert.equal(preview.bytes, model.bytes, `${model.slug}: preview size mismatch`);
    assert.equal(uploaded.url, url, `${model.slug}: unexpected uploaded URL`);
    assert.equal(uploaded.bytes, model.bytes, `${model.slug}: uploaded size mismatch`);
    assert.equal(uploaded.sha256, model.sha256, `${model.slug}: uploaded SHA-256 mismatch`);
    return { slug: model.slug, sourcePath: model.sourcePath, gitBlob: model.gitBlob,
      currentUrl: model.currentUrl, bytes: model.bytes, sha256: model.sha256, url };
  });
}

function header(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name) || '';
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name);
  return entry ? String(entry[1]) : '';
}

/** Pure response validation; body is the entire freshly downloaded GLB. */
export function validateDeliveryResponse(model, { status, url, headers, body }) {
  assert.equal(url, transferPublicUrl(model), `${model.slug}: response URL changed`);
  assert.equal(status, 200, `${model.slug}: full GET must return200`);
  const contentType = header(headers, 'content-type').split(';')[0].trim().toLowerCase();
  assert.equal(contentType, 'model/gltf-binary', `${model.slug}: invalid public MIME type`);
  const cors = header(headers, 'access-control-allow-origin').trim();
  assert.ok(cors === '*' || cors === PRODUCTION_ORIGIN, `${model.slug}: production CORS is not allowed`);
  const encoding = header(headers, 'content-encoding').trim().toLowerCase();
  assert.ok(!encoding || encoding === 'identity', `${model.slug}: public response must preserve raw GLB bytes`);
  const contentLength = header(headers, 'content-length');
  if (contentLength) assert.equal(contentLength, String(model.bytes), `${model.slug}: public Content-Length mismatch`);
  assert.ok(body instanceof Uint8Array, `${model.slug}: complete response bytes are required`);
  const bytes = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  assert.equal(bytes.length, model.bytes, `${model.slug}: complete body size mismatch`);
  assert.equal(sha256(bytes), model.sha256, `${model.slug}: complete body SHA-256 mismatch`);
  assert.ok(bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'glTF'
    && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, `${model.slug}: invalid GLB2 header or declared length`);
  return { slug: model.slug, sourcePath: model.sourcePath, gitBlob: model.gitBlob,
    currentUrl: model.currentUrl, url, status, bytes: bytes.length, sha256: model.sha256,
    contentType, productionOrigin: PRODUCTION_ORIGIN, accessControlAllowOrigin: cors, glbVersion: 2 };
}

async function download(model) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(model.url, {
        method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(45_000),
        headers: { Origin: PRODUCTION_ORIGIN, 'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity' },
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error(`${model.slug}: public GET returned${response.status}`);
      }
      assert.ok(response.body, `${model.slug}: public GET returned no body`);
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > model.bytes) throw new Error(`${model.slug}: public body exceeds reviewed size`);
          chunks.push(Buffer.from(value));
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      const receipt = validateDeliveryResponse(model, {
        status: response.status, url: response.url, headers: response.headers, body: Buffer.concat(chunks, length),
      });
      return { ...receipt, verifiedAt: new Date().toISOString(), attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

export async function main() {
  const repoRoot = fileURLToPath(new URL('../', import.meta.url));
  assert.ok(process.env.MANIFEST, 'MANIFEST must name one reviewed repo-preview-transfer JSON file');
  const manifestPath = path.resolve(repoRoot, process.env.MANIFEST);
  const uploadDir = path.resolve(repoRoot, process.env.UPLOAD_DIR || '.atrium-ingest/reviewed-preview-upload');
  const proofPath = path.join(uploadDir, 'delivery-proof.json');
  // A failed rerun must not leave an older success receipt in the handoff folder.
  await rm(proofPath, { force: true });
  const [manifestBytes, previewBytes, reportBytes] = await Promise.all([
    readFile(manifestPath), readFile(path.join(uploadDir, 'previews.json')), readFile(path.join(uploadDir, 'report.json')),
  ]);
  const manifest = JSON.parse(manifestBytes);
  const models = validateTransferMetadata(manifest, JSON.parse(previewBytes), JSON.parse(reportBytes));
  const receipts = new Array(models.length);
  let next = 0;
  const failures = [];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < models.length) {
      const index = next++, model = models[index];
      try {
        receipts[index] = await download(model);
        console.log(`Verified ${model.slug}: ${model.bytes} bytes, SHA-256, MIME, production CORS and GLB2`);
      } catch (error) {
        failures.push(model.slug);
        console.error(`${model.slug}: public verification failed (${error.message})`);
      }
    }
  }));
  assert.equal(failures.length, 0, `Delivery verification failed for: ${failures.join(', ')}`);
  assert.equal(receipts.filter(Boolean).length, TRANSFER_COUNT, 'Incomplete delivery proof');
  const proof = {
    schema: 'atrium-repo-preview-delivery-proof/1', complete: true, generatedAt: new Date().toISOString(),
    sourceCommit: manifest.sourceCommit, manifestSha256: sha256(manifestBytes), productionOrigin: PRODUCTION_ORIGIN,
    totalCount: receipts.length, totalBytes: receipts.reduce((sum, model) => sum + model.bytes, 0), models: receipts,
  };
  const temporary = `${proofPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(proof, null, 2)}\n`);
  await rename(temporary, proofPath);
  console.log(`Delivery proof complete: ${proof.totalCount} models, ${proof.totalBytes} bytes.`);
  return proof;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(`Repository preview delivery verification failed: ${error.message}`); process.exitCode = 1; });
}
