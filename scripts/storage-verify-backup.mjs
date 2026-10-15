import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
export const SHA256 = /^[a-f0-9]{64}$/;
const DRIVE_ID = /^[A-Za-z0-9_-]+$/;
export function verificationTimeout(value = '120000') {
  const parsed = typeof value === 'number' ? value : /^[1-9][0-9]*$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 1800000) fail('Verification timeout must be a positive safe integer no greater than1800000ms');
  return parsed;
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
export function fail(message) { throw new Error(message); }
export function assertBlob(blob) {
  if (!blob || !SHA256.test(blob.sha256) || !Number.isSafeInteger(blob.bytes) || blob.bytes < 0) fail('Invalid full SHA256 or exact byte count');
}
export async function privatePath(filename, repoRoot) {
  const absolute = path.resolve(filename);
  const repo = await fs.realpath(path.resolve(repoRoot));
  const repositories = new Set([repo]);
  try {
    const listed = (await exec('git', ['-C', repo, 'worktree', 'list', '--porcelain', '-z'], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } })).stdout;
    for (const item of listed.split('\0')) if (item.startsWith('worktree ')) repositories.add(path.resolve(item.slice(9)));
  } catch { fail('Cannot establish the private storage boundary across Git worktrees'); }
  // Git-ignore is not a deployment boundary: Astro copies ignored public files.
  for (const repository of repositories) if (['public', 'dist', '.git'].some(directory => absolute === path.join(repository, directory) || absolute.startsWith(path.join(repository, directory) + path.sep))) fail('Private storage state must never be placed in public, dist or Git internals');
  // Resolve every existing parent: an ignored ledger must not alias a public path.
  let parent = path.dirname(absolute);
  while (true) {
    try {
      if (await fs.realpath(parent) !== parent) fail('Ledger parent contains a symlink');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const next = path.dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
  try { if ((await fs.lstat(absolute)).isSymbolicLink()) fail('Ledger is a symlink'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const repository of repositories) {
    const relative = path.relative(repository, absolute);
    if (relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) {
      if (relative.split(path.sep).includes('.git')) fail('Never write storage ledgers inside Git internals');
      try { await exec('git', ['-C', repository, 'check-ignore', '-q', '--', relative], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }); }
      catch { fail('Storage ledgers and keys must be ignored or outside every registered worktree'); }
    }
  }
  return absolute;
}
export async function writePrivateJson(filename, data, repoRoot, { mergeExisting } = {}) {
  const target = await privatePath(filename, repoRoot);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const lock = target + '.storage-write.lock';
  let owner;
  for (let attempt = 0; !owner; attempt++) {
    try { owner = await fs.open(lock, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST' || attempt >= 40) throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  const temporary = target + '.tmp-' + crypto.randomUUID();
  try {
    let prior;
    try {
      prior = await fs.lstat(target, { bigint: true });
      if (!prior.isFile() || prior.isSymbolicLink() || prior.size > 128n * 1024n * 1024n) fail('Existing output is not a supported storage ledger');
      let existing;
      try { existing = JSON.parse(await fs.readFile(target, 'utf8')); } catch { fail('Never overwrite unrelated existing output content'); }
      const schemas = new Set(['atrium-storage-manifest/1', 'atrium-storage-cleanup-plan/1', 'atrium-storage-deletion-journal/1', 'atrium-storage-backup-ledger/1', 'atrium-storage-live-ledger/1', 'atrium-storage-live-dependencies/1']);
      if (!schemas.has(data?.schema) || existing.schema !== data.schema) fail('Never overwrite a different or unrelated storage document');
      if (mergeExisting) {
        data = await mergeExisting(existing, data);
        if (data.schema !== existing.schema) fail('Storage merge changed document schema');
      }
      if (data.schema === 'atrium-storage-manifest/1' && canonical(existing.sourceRoots) !== canonical(data.sourceRoots)) fail('Changed source scope needs a new output file');
      if (data.schema === 'atrium-storage-cleanup-plan/1' && existing.manifestSha256 !== data.manifestSha256) fail('Changed plan identity needs a new output file');
      if (data.schema === 'atrium-storage-deletion-journal/1' && (existing.startedAt !== data.startedAt || existing.manifestSha256 !== data.manifestSha256)) fail('Existing deletion journal must be preserved; use a new journal');
      if (data.schema === 'atrium-storage-live-dependencies/1' && existing.repoRoot !== data.repoRoot) fail('Changed repository scope needs a new output file');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    if (!prior) {
      // Hard-link publication is atomic and cannot clobber a concurrently created file.
      await fs.link(temporary, target); await fs.unlink(temporary);
    } else {
      const current = await fs.lstat(target, { bigint: true });
      if (current.dev !== prior.dev || current.ino !== prior.ino || current.size !== prior.size || current.mtimeNs !== prior.mtimeNs || current.ctimeNs !== prior.ctimeNs) fail('Storage output changed during update');
      await fs.rename(temporary, target);
    }
  } finally {
    await owner.close();
    await fs.unlink(lock);
    try { await fs.unlink(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
export async function appendVerifiedReceipt(filename, receipt, key, repoRoot) {
  const live = receipt.payload?.schema === 'atrium-storage-live-receipt/1';
  const schema = live ? 'atrium-storage-live-ledger/1' : 'atrium-storage-backup-ledger/1';
  const validate = r => live
    ? verifyLiveReceipt(r, key, { now: Date.parse(r.payload?.verifiedAt), maxAgeMs: Infinity })
    : verifyReceipt(r, key, { now: Date.parse(r.payload?.verifiedAt), maxAgeMs: Infinity });
  validate(receipt);
  await writePrivateJson(filename, { schema, receipts: [receipt] }, repoRoot, {
    mergeExisting(existing, incoming) {
      if (!Array.isArray(existing.receipts)) fail('Invalid receipt ledger');
      for (const old of existing.receipts) validate(old);
      const identity = r => live ? r.payload.url : r.payload.blob.sha256;
      const merged = new Map(existing.receipts.map(r => [identity(r), r]));
      for (const next of incoming.receipts) {
        const old = merged.get(identity(next));
        if (!old || Date.parse(next.payload.verifiedAt) >= Date.parse(old.payload.verifiedAt)) merged.set(identity(next), next);
      }
      return { schema, receipts: [...merged.values()] };
    },
  });
}
export async function loadKey(filename, { create = false, repoRoot = process.cwd() } = {}) {
  const target = await privatePath(filename, repoRoot);
  if (create) {
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    try { await fs.writeFile(target, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const stat = await fs.lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) fail('Signing key must be a regular owner-only file');
  const key = await fs.readFile(target);
  if (key.length !== 32) fail('Invalid signing key');
  return key;
}
export function signReceipt(payload, key) {
  return { payload, signature: crypto.createHmac('sha256', key).update(canonical(payload)).digest('hex') };
}
function authenticatedPayload(receipt, key) {
  if (!receipt?.payload || !SHA256.test(receipt.signature || '')) fail('Unsigned or malformed receipt');
  const expected = crypto.createHmac('sha256', key).update(canonical(receipt.payload)).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(receipt.signature, 'hex'))) fail('Receipt signature mismatch');
  return receipt.payload;
}
export function verifyReceipt(receipt, key, { now = Date.now(), maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
  const p = authenticatedPayload(receipt, key);
  assertBlob(p.blob);
  if (p.schema !== 'atrium-storage-backup-receipt/1' || p.method !== 'full-download-sha256' || p.complete !== true || p.private !== true) fail('Incomplete or unsafe backup receipt');
  const age = now - Date.parse(p.verifiedAt);
  if (!Number.isFinite(age) || age < -60000 || age > maxAgeMs) fail('Backup content verification is stale or future-dated');
  if (!Array.isArray(p.objects) || !p.objects.length) fail('Receipt has no remote objects');
  let offset = 0;
  for (const [i, object] of p.objects.entries()) {
    if (object.order !== i || object.offset !== offset || typeof object.fileId !== 'string' || !DRIVE_ID.test(object.fileId) || !object.version && !object.modifiedTime || object.private !== true || !SHA256.test(object.sha256 || '') || !Number.isSafeInteger(object.bytes) || object.bytes < 0) fail('Receipt has incomplete remote binding');
    offset += object.bytes;
  }
  if (offset !== p.blob.bytes) fail('Receipt object bytes do not reconstruct the full blob');
  return p;
}
export function verifyLiveReceipt(receipt, key, { now = Date.now(), maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
  const p = authenticatedPayload(receipt, key);
  assertBlob(p);
  const age = now - Date.parse(p.verifiedAt);
  if (p.schema !== 'atrium-storage-live-receipt/1' || p.method !== 'full-get-sha256' || p.status !== 200 || p.corsVerified !== true || p.origin !== 'https://atrium.earth' || !Number.isFinite(age) || age < -60000 || age > maxAgeMs) fail('Missing fresh complete live-delivery verification');
  const url = new URL(p.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('Live delivery receipt must use a public unsigned HTTPS URL');
  return p;
}
function safeMetadata(object, order, offset, bytes, sha256) {
  const d = object.drive;
  if (!d || d.provider !== 'google-drive' || typeof d.fileId !== 'string' || !DRIVE_ID.test(d.fileId) || !d.version && !d.modifiedTime || d.private !== true || d.size !== bytes || !Number.isFinite(Date.parse(d.sharingCheckedAt))) fail('Missing exact Drive identity/version/size/private-sharing evidence');
  return { order, offset, bytes, sha256, provider: 'google-drive', fileId: d.fileId,
    ...(d.version ? { version: String(d.version) } : {}),
    ...(d.modifiedTime ? { modifiedTime: d.modifiedTime } : {}),
    private: true, sharingCheckedAt: d.sharingCheckedAt, size: d.size };
}
async function download(url, fetchImpl, timeoutMs, headers = {}) {
  let current;
  try { current = new URL(url); } catch { fail('Invalid ephemeral download URL'); }
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (current.protocol !== 'https:' || current.username || current.password) fail('Download requires HTTPS without embedded user credentials');
    let response;
    try { response = await fetchImpl(current, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers }); }
    catch { fail('Remote content download failed; refresh the ephemeral request'); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel?.().catch(() => {});
      if (!location) fail('Remote redirect omitted its destination');
      try { current = new URL(location, current); } catch { fail('Invalid remote redirect'); }
      continue;
    }
    if (response.status !== 200 || !response.body) {
      await response.body?.cancel?.().catch(() => {});
      fail('Remote content download did not return a complete HTTP200 body');
    }
    return response;
  }
  fail('Too many remote download redirects');
}
export async function verifyLiveContent(request, { key, fetchImpl = globalThis.fetch, now = Date.now(), timeoutMs = 120000 } = {}) {
  timeoutMs = verificationTimeout(timeoutMs);
  const expected = request?.blob || { bytes: request?.bytes, sha256: request?.expectedSha256 };
  if (!Number.isSafeInteger(expected.bytes) || expected.bytes <= 0 || expected.sha256 && !SHA256.test(expected.sha256)) fail('Live proof needs the exact expected byte count and a valid optional full SHA256');
  if (!key || key.length !== 32) fail('Live verification requires a private key');
  let url;
  try { url = new URL(request.url); } catch { fail('Invalid public model URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('Public live proof cannot persist an authenticated or signed URL');
  const origin = 'https://atrium.earth';
  const response = await download(url.href, fetchImpl, timeoutMs, { Origin: origin });
  const cors = response.headers.get('access-control-allow-origin');
  if (cors !== origin && cors !== '*') { await response.body.cancel().catch(() => {}); fail('Live model does not permit the production origin'); }
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > expected.bytes) fail('Live model exceeds its expected size');
      hash.update(chunk);
    }
  } catch { fail('Live model stream failed or exceeded its expected length'); }
  const sha256 = hash.digest('hex');
  const prefix = url.pathname.match(/\/preview-([a-f0-9]{12,64})\.glb$/)?.[1];
  if (bytes !== expected.bytes || expected.sha256 && sha256 !== expected.sha256 || prefix && !sha256.startsWith(prefix)) fail('Live model content does not match the expected hash/bytes');
  return signReceipt({ schema: 'atrium-storage-live-receipt/1', url: url.href, sha256, bytes,
    verifiedAt: new Date(now).toISOString(), method: 'full-get-sha256', status: 200, corsVerified: true, origin }, key);
}
export async function verifyRemoteContent(request, { key, fetchImpl = globalThis.fetch, now = Date.now(), timeoutMs = 120000 } = {}) {
  timeoutMs = verificationTimeout(timeoutMs);
  assertBlob(request?.blob);
  if (!key || key.length !== 32 || !Array.isArray(request.objects) || !request.objects.length) fail('Verification needs a private key and ordered remote objects');
  const full = crypto.createHash('sha256');
  let offset = 0;
  const objects = [];
  for (const [i, object] of request.objects.entries()) {
    if (object.order !== i || object.offset !== offset || !Number.isSafeInteger(object.bytes) || object.bytes < 0) fail('Remote chunks must be contiguous and explicitly ordered');
    const expected = object.sha256 || (request.objects.length === 1 ? request.blob.sha256 : null);
    if (!SHA256.test(expected || '')) fail('Each remote chunk needs a full expected SHA256');
    // Check metadata before downloading, but never treat metadata as content verification.
    safeMetadata(object, i, offset, object.bytes, expected);
    const response = await download(object.downloadUrl, fetchImpl, timeoutMs);
    const part = crypto.createHash('sha256');
    let bytes = 0;
    try {
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > object.bytes) fail('Remote content exceeds its expected byte count');
        part.update(chunk); full.update(chunk);
      }
    } catch {
      fail('Remote stream failed or exceeded its expected length; no receipt issued');
    }
    const hash = part.digest('hex');
    if (bytes !== object.bytes || hash !== expected) fail('Remote content SHA256/byte count mismatch; no receipt issued');
    objects.push(safeMetadata(object, i, offset, bytes, hash));
    offset += bytes;
  }
  const hash = full.digest('hex');
  if (offset !== request.blob.bytes || hash !== request.blob.sha256) fail('Full reassembled remote content does not match the manifest blob');
  const payload = { schema: 'atrium-storage-backup-receipt/1', blob: { sha256: request.blob.sha256, bytes: request.blob.bytes },
    verifiedAt: new Date(now).toISOString(), method: 'full-download-sha256', complete: true, private: true,
    objects, ...(request.manifestSha256 && SHA256.test(request.manifestSha256) ? { manifestSha256: request.manifestSha256 } : {}) };
  return signReceipt(payload, key);
}
export function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith('--')) { result._.push(value); continue; }
    const name = value.slice(2);
    if (['apply', 'create-key', 'help'].includes(name)) result[name] = true;
    else { if (!argv[i + 1] || argv[i + 1].startsWith('--')) fail('Missing argument for --' + name); result[name] = argv[++i]; }
  }
  return result;
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.request && !args['create-key'] && args._[0] !== 'merge') {
    console.log('node scripts/storage-verify-backup.mjs --request PRIVATE_REQUEST.json --key PRIVATE_KEY --receipts PRIVATE_LEDGER.json [--repo PATH] [--create-key] [--timeout-ms 120000]\nnode scripts/storage-verify-backup.mjs merge --inputs PRIVATE_LEDGER_PATH_LIST.json --key PRIVATE_KEY --receipts PRIVATE_UNION_LEDGER.json');
    return;
  }
  const repoRoot = path.resolve(args.repo || process.cwd());
  const key = await loadKey(args.key || fail('--key is required'), { create: Boolean(args['create-key']), repoRoot });
  if (args._[0] === 'merge') {
    const inputsPath = await privatePath(args.inputs || fail('--inputs is required'), repoRoot);
    const inputs = JSON.parse(await fs.readFile(inputsPath, 'utf8'));
    if (!Array.isArray(inputs) || !inputs.length || inputs.some(x => typeof x !== 'string')) fail('Merge requires an explicit list of private receipt-ledger paths');
    const output = await privatePath(args.receipts || fail('--receipts is required'), repoRoot);
    let count = 0, schema;
    for (const filename of inputs) {
      const ledger = JSON.parse(await fs.readFile(await privatePath(filename, repoRoot), 'utf8'));
      if (!['atrium-storage-backup-ledger/1', 'atrium-storage-live-ledger/1'].includes(ledger.schema) || !Array.isArray(ledger.receipts) || schema && schema !== ledger.schema) fail('Merge inputs must be authenticated ledgers of one kind');
      schema = ledger.schema;
      for (const receipt of ledger.receipts) { await appendVerifiedReceipt(output, receipt, key, repoRoot); count++; }
    }
    console.log(JSON.stringify({ mergedReceiptEntries: count, kind: schema }));
    return;
  }
  if (!args.request) { console.log('Private signing key ready.'); return; }
  const requestPath = await privatePath(args.request, repoRoot);
  const ledgerPath = await privatePath(args.receipts || fail('--receipts is required'), repoRoot);
  const request = JSON.parse(await fs.readFile(requestPath, 'utf8'));
  const live = request.kind === 'live-delivery';
  const timeoutMs = verificationTimeout(args['timeout-ms']);
  const receipt = live ? await verifyLiveContent(request, { key, timeoutMs }) : await verifyRemoteContent(request, { key, timeoutMs });
  await appendVerifiedReceipt(ledgerPath, receipt, key, repoRoot);
  console.log(JSON.stringify({ verified: true, sha256: live ? receipt.payload.sha256 : receipt.payload.blob.sha256, bytes: live ? receipt.payload.bytes : receipt.payload.blob.bytes, remoteObjects: live ? 1 : receipt.payload.objects.length }));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { console.error('Storage verification failed; no complete-content receipt was added. Check the private request and retry.'); process.exitCode = 1; });
}
