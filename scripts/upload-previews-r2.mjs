#!/usr/bin/env node
// Upload locally generated preview GLBs to Cloudflare R2 under content-hashed
// names, verify the public copy byte-for-byte, then point src/data/previews.json
// at https://models.atrium.earth/models/previews/<slug>/preview-<hash>.glb.
//
//   node scripts/upload-previews-r2.mjs --input=.atrium-ingest/new-slugs.txt
//   node scripts/upload-previews-r2.mjs --slugs=africa/foo,africa/bar --dry-run
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
// Optional: R2_PUBLIC_BASE (default https://models.atrium.earth), R2_ENDPOINT.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, previewsPath, readJson, repoRoot, writeJson } from './ingest-utils.mjs';
import { sha256Hex, signRequest } from './r2-sigv4.mjs';

const args = parseArgs();
const dryRun = Boolean(args['dry-run']);
const skipVerify = Boolean(args['skip-verify']);
const reportPath = args.report ? path.resolve(repoRoot, args.report) : '';
const previewsFile = args.previews ? path.resolve(repoRoot, args.previews) : previewsPath;
const previewsDir = path.resolve(repoRoot, args['previews-dir'] || 'public/models/previews');
const bindingFiles = [
  path.resolve(repoRoot, args['physical-dimensions'] || 'src/data/physical-dimensions.json'),
  path.resolve(repoRoot, args['spatial-eligibility'] || 'src/data/spatial-eligibility.json'),
];
const publicBase = (process.env.R2_PUBLIC_BASE || 'https://models.atrium.earth').replace(/\/+$/, '');
const slugPattern = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;

async function slugList() {
  const listed = args.slugs ? String(args.slugs).split(',') : [];
  if (args.input) listed.push(...(await readFile(path.resolve(repoRoot, args.input), 'utf8')).split(/\r?\n/));
  return [...new Set(listed.map((slug) => slug.trim()).filter(Boolean))];
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (Cloudflare R2 credentials)`);
  return value;
}

async function withRetry(label, attempts, fn) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error.retryable === false) break;
      if (attempt < attempts) {
        console.warn(`  ${label} attempt ${attempt} failed: ${error.message}; retrying`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError;
}

async function putObject({ endpoint, bucket, key, body, hash, credentials }) {
  const url = `${endpoint}/${bucket}/${key}`;
  const { headers } = signRequest({
    method: 'PUT',
    url,
    headers: {
      'content-type': 'model/gltf-binary',
      'cache-control': 'public, max-age=31536000, immutable',
    },
    payloadHash: hash,
    ...credentials,
  });
  const response = await fetch(url, { method: 'PUT', headers, body });
  if (!response.ok) {
    const text = (await response.text()).slice(0, 400);
    const error = new Error(`R2 PUT ${response.status} ${response.statusText}: ${text}`);
    error.retryable = response.status >= 500 || response.status === 429;
    throw error;
  }
}

async function verifyPublic(url, hash, bytes) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`public GET ${response.status} ${response.statusText}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length !== bytes) throw new Error(`public size ${body.length} != ${bytes}`);
  if (sha256Hex(body) !== hash) throw new Error('public SHA-256 mismatch');
  return response.headers.get('content-type') || '';
}

const slugs = await slugList();
if (!slugs.length) {
  console.log('No slugs to upload.');
  process.exit(0);
}

const credentials = dryRun ? {} : {
  accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
  secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
};
const bucket = dryRun ? process.env.R2_BUCKET || '<bucket>' : requireEnv('R2_BUCKET');
const endpoint = (process.env.R2_ENDPOINT
  || `https://${dryRun ? process.env.R2_ACCOUNT_ID || '<account>' : requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`).replace(/\/+$/, '');

const previews = await readJson(previewsFile, {});
const bindings = await Promise.all(bindingFiles.map(async (file) => ({ file, data: await readJson(file, {}) })));

function containsValue(value, needle) {
  if (value === needle) return true;
  if (value && typeof value === 'object') return Object.values(value).some((child) => containsValue(child, needle));
  return false;
}

// Dimension and AR records are bound to the exact preview URL; moving it would
// silently drop the verified scale, so those works need a deliberate rebind.
function boundRecordFor(slug, url) {
  if (!url) return '';
  const hit = bindings.find(({ data }) => containsValue(data?.[slug], url));
  return hit ? path.relative(repoRoot, hit.file) : '';
}
const report = { generated_at: new Date().toISOString(), public_base: publicBase, uploaded: [], unchanged: [], failed: [] };

for (const slug of slugs) {
  try {
    if (!slugPattern.test(slug)) throw new Error('invalid slug');
    const file = path.join(previewsDir, slug, 'preview.glb');
    if (!existsSync(file)) throw new Error(`missing ${path.relative(repoRoot, file)}`);
    const body = await readFile(file);
    const hash = sha256Hex(body);
    const key = `models/previews/${slug}/preview-${hash.slice(0, 12)}.glb`;
    const publicUrl = `${publicBase}/${key}`;
    const entry = { slug, url: publicUrl, bytes: body.length, sha256: hash };

    if (previews[slug]?.url === publicUrl) {
      report.unchanged.push(entry);
      console.log(`= ${slug} already points at ${publicUrl}`);
      continue;
    }
    const bound = boundRecordFor(slug, previews[slug]?.url);
    if (bound) throw new Error(`${bound} is bound to ${previews[slug].url}; rebind that record before moving the preview`);
    if (dryRun) {
      report.uploaded.push({ ...entry, dry_run: true });
      console.log(`~ ${slug} -> ${key} (${body.length} bytes, dry run)`);
      continue;
    }

    await withRetry(`${slug} upload`, 4, () => putObject({ endpoint, bucket, key, body, hash, credentials }));
    if (!skipVerify) {
      entry.content_type = await withRetry(`${slug} verify`, 5, () => verifyPublic(publicUrl, hash, body.length));
      if (entry.content_type !== 'model/gltf-binary') console.warn(`  ${slug}: public content-type is ${entry.content_type || 'missing'}`);
    }

    previews[slug] = { ...(previews[slug] || {}), url: publicUrl, bytes: body.length };
    await writeJson(previewsFile, previews);
    report.uploaded.push(entry);
    console.log(`+ ${slug} -> ${publicUrl}`);
  } catch (error) {
    report.failed.push({ slug, reason: error.message });
    console.error(`! ${slug}: ${error.message}`);
  }
}

if (reportPath) await writeJson(reportPath, report);
console.log(`R2 previews: ${report.uploaded.length} uploaded, ${report.unchanged.length} unchanged, ${report.failed.length} failed${dryRun ? ' (dry run)' : ''}.`);
if (report.failed.length) process.exitCode = 1;
