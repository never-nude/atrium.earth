// Bounded private upload staging and restore. No upload or source removal occurs.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { fileId, hashFile, logicalPath, resolveSourcePath, sameFile } from './storage-core.mjs';
import { assertBlob, fail, parseArgs, privatePath } from './storage-verify-backup.mjs';

export const MAX_STAGED_CHUNK_BYTES = 90 * 1024 * 1024;
const BUFFER_BYTES = 1024 * 1024;
const inside = (root, filename) => filename.startsWith(root + path.sep);
const fingerprint = stat => ({ device: String(stat.dev), inode: String(stat.ino),
  bytes: Number(stat.size), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs) });

async function canonicalPrivateFile(repoRoot, filename, { absent = false } = {}) {
  const repo = path.resolve(repoRoot);
  if (await fs.realpath(repo) !== repo) fail('Repository path must be canonical');
  if (typeof filename !== 'string' || !filename || filename.includes('\0')) fail('A private staging filename is required');
  const target = path.resolve(repo, filename);
  const privateRoot = path.join(repo, '.atrium-ingest');
  if (!inside(privateRoot, target)) fail('Staging and restore files must be inside .atrium-ingest');
  await privatePath(target, repo);
  // privatePath checks the nearest existing parent; walk each existing component
  // here as well so the staging boundary itself cannot be a symlink or file.
  let current = repo;
  for (const part of path.relative(repo, target).split(path.sep)) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) fail('Private staging path contains a symlink');
      if (current !== target && !stat.isDirectory()) fail('Private staging parent is not a directory');
      if (current === target && absent) fail('Destination already exists; never overwrite it');
      if (current === target && !stat.isFile()) fail('Private input is not a regular file');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!absent && await fs.realpath(target) !== target) fail('Private input path is aliased');
  return target;
}

function checkedChunks(blob, chunks) {
  assertBlob(blob);
  if (!Array.isArray(chunks) || !chunks.length) fail('An ordered inventory chunk map is required');
  let offset = 0;
  for (const [order, chunk] of chunks.entries()) {
    assertBlob(chunk);
    if (chunk.order !== order || chunk.offset !== offset ||
      (!chunk.bytes && (blob.bytes !== 0 || chunks.length !== 1))) fail('Chunk map must be ordered, contiguous and nonempty');
    offset += chunk.bytes;
    if (!Number.isSafeInteger(offset) || offset > blob.bytes) fail('Chunk map exceeds the complete source');
  }
  if (offset !== blob.bytes) fail('Chunk map does not cover the complete source');
  return chunks;
}

function inventoryFile(manifest, candidateId) {
  if (manifest?.schema !== 'atrium-storage-manifest/1' || !Array.isArray(manifest.files)) fail('A portable source inventory is required');
  const matches = manifest.files.filter(file => file.candidateId === candidateId);
  if (matches.length !== 1) fail('Select exactly one inventory file');
  const file = matches[0];
  logicalPath(file.relativePath);
  if (file.candidateId !== fileId(file.sourceRootId, file.relativePath)) fail('Inventory identity does not match its source path');
  if (!file.localObservation || !['device', 'inode', 'mtimeNs', 'ctimeNs'].every(key => typeof file.localObservation[key] === 'string') ||
    file.localObservation.bytes !== file.bytes) fail('Inventory needs a complete source stat binding');
  checkedChunks(file, file.chunks);
  return file;
}

async function sameSource(sourceRoots, file) {
  const filename = await resolveSourcePath(sourceRoots, file.sourceRootId, file.relativePath);
  const current = await hashFile(filename);
  if (current.sha256 !== file.sha256 || current.bytes !== file.bytes || !sameFile(current.localObservation, file.localObservation)) fail('Complete source differs from its immutable inventory');
  return { filename, ...current };
}

async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset, null);
    if (!bytesWritten) fail('Incomplete private staging write');
    offset += bytesWritten;
  }
}

async function readInto(source, output, { offset, bytes, sha256 }, before) {
  const handle = await fs.open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const initial = await handle.stat({ bigint: true });
    if (!initial.isFile() || !sameFile(fingerprint(initial), before)) fail('Input identity changed before streaming');
    const hash = crypto.createHash('sha256'), buffer = Buffer.allocUnsafe(BUFFER_BYTES);
    let copied = 0;
    while (copied < bytes) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, bytes - copied), offset + copied);
      if (!bytesRead) fail('Source ended before the complete chunk');
      const data = buffer.subarray(0, bytesRead);
      hash.update(data); await writeAll(output, data); copied += bytesRead;
    }
    if (hash.digest('hex') !== sha256) fail('Streamed chunk SHA256 mismatch');
    if (!sameFile(fingerprint(await handle.stat({ bigint: true })), before)) fail('Input changed during streaming');
  } finally { await handle.close(); }
}

async function absentPrivateOutput(repoRoot, targetPath, produce, expected) {
  const target = await canonicalPrivateFile(repoRoot, targetPath, { absent: true });
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await canonicalPrivateFile(repoRoot, target, { absent: true });
  const parent = await fs.lstat(path.dirname(target), { bigint: true });
  const temporary = path.join(path.dirname(target), '.atrium-stage-' + crypto.randomUUID() + '.part');
  let handle, owned;
  try {
    handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    owned = fingerprint(await handle.stat({ bigint: true }));
    await produce(handle);
    await handle.sync(); await handle.close(); handle = null;
    const complete = await hashFile(temporary);
    if (complete.sha256 !== expected.sha256 || complete.bytes !== expected.bytes) fail('Complete staged output SHA256 or size mismatch');
    await canonicalPrivateFile(repoRoot, target, { absent: true });
    const finalParent = await fs.lstat(path.dirname(target), { bigint: true });
    if (finalParent.dev !== parent.dev || finalParent.ino !== parent.ino) fail('Staging parent changed');
    // Hard-link publication, unlike rename, cannot replace a destination created
    // by another process. The input and source geometry are never moved.
    await fs.link(temporary, target);
    return { sha256: complete.sha256, bytes: complete.bytes };
  } finally {
    if (handle) await handle.close();
    // Remove only the temporary file created by this invocation, never an input.
    if (owned) {
      try {
        const stat = await fs.lstat(temporary, { bigint: true });
        if (!stat.isSymbolicLink() && String(stat.dev) === owned.device && String(stat.ino) === owned.inode) await fs.unlink(temporary);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
}

/** Stage exactly one recorded chunk. Both full-source hashes and every observed
 * stat must match the inventory; memory and the new local copy are bounded. */
export async function stageSourceChunk({ repoRoot, sourceRoots, manifest, candidateId, chunkOrder, targetPath }) {
  const file = inventoryFile(manifest, candidateId);
  if (!Number.isSafeInteger(chunkOrder) || chunkOrder < 0 || chunkOrder >= file.chunks.length) fail('Select a valid zero-based chunk order');
  const chunk = file.chunks[chunkOrder];
  if (chunk.bytes > MAX_STAGED_CHUNK_BYTES) fail('Selected chunk exceeds 90MiB; inventory with chunkBytes 94371840');
  if (!Array.isArray(sourceRoots) || !sourceRoots.length || sourceRoots.some(root => !/^[a-z0-9][a-z0-9-]*$/.test(root.id)) ||
    new Set(sourceRoots.map(root => root.id)).size !== sourceRoots.length) fail('An explicit unique source-root registry is required');
  // Check the absent destination before expensive reads or creating temp files.
  await canonicalPrivateFile(repoRoot, targetPath, { absent: true });
  const before = await sameSource(sourceRoots, file);
  const staged = await absentPrivateOutput(repoRoot, targetPath, async output => {
    await readInto(before.filename, output, chunk, before.localObservation);
    const after = await sameSource(sourceRoots, file);
    if (after.filename !== before.filename || !sameFile(after.localObservation, before.localObservation)) fail('Complete source changed after staging');
  }, chunk);
  return { schema: 'atrium-storage-staged-chunk/1', candidateId: file.candidateId,
    sourceSha256: file.sha256, sourceBytes: file.bytes,
    chunk: { order: chunk.order, offset: chunk.offset, bytes: chunk.bytes, sha256: chunk.sha256 }, ...staged };
}

/** Restore only into an absent private staging path. Every part and the complete
 * reconstructed original must match; no existing original is ever overwritten. */
export async function restoreSourceParts({ repoRoot, blob, parts, targetPath }) {
  checkedChunks(blob, parts);
  await canonicalPrivateFile(repoRoot, targetPath, { absent: true });
  const inputs = [];
  for (const part of parts) {
    const filename = await canonicalPrivateFile(repoRoot, part.path);
    const current = await hashFile(filename);
    if (current.sha256 !== part.sha256 || current.bytes !== part.bytes) fail('Restore part differs from its recorded SHA256 or size');
    inputs.push({ part, filename, current });
  }
  const restored = await absentPrivateOutput(repoRoot, targetPath, async output => {
    for (const { part, filename, current } of inputs) {
      await canonicalPrivateFile(repoRoot, filename);
      await readInto(filename, output, { ...part, offset: 0 }, current.localObservation);
      const after = await hashFile(filename);
      if (after.sha256 !== part.sha256 || after.bytes !== part.bytes || !sameFile(after.localObservation, current.localObservation)) fail('Restore part changed after streaming');
    }
  }, blob);
  return { schema: 'atrium-storage-restored-source/1', ...restored, parts: parts.length };
}

async function privateJson(filename, repoRoot) {
  return JSON.parse(await fs.readFile(await privatePath(filename, repoRoot), 'utf8'));
}

export async function runChunkCli(argv) {
  const args = parseArgs(argv), command = args._[0] || 'help';
  const repoRoot = path.resolve(args.repo || process.cwd());
  if (args.help || command === 'help') {
    console.log('Private bounded source staging (no upload or original removal):\n' +
      '  stage --manifest PRIVATE_MANIFEST.json --roots PRIVATE_ROOTS.json --candidate file-FULL_ID --order 0 --output .atrium-ingest/chunks/PART\n' +
      '  restore --request PRIVATE_RESTORE_REQUEST.json --output .atrium-ingest/restored/ORIGINAL\n' +
      'Stage uses inventory chunks of at most 90MiB. Outputs must be absent ignored .atrium-ingest files.');
    return;
  }
  let result;
  if (command === 'stage') {
    const manifest = await privateJson(args.manifest || fail('--manifest is required'), repoRoot);
    const roots = await privateJson(args.roots || fail('--roots is required'), repoRoot);
    if (!/^(0|[1-9][0-9]*)$/.test(args.order || '')) fail('--order must be a zero-based integer');
    result = await stageSourceChunk({ repoRoot, manifest, sourceRoots: roots.sourceRoots || roots,
      candidateId: args.candidate || fail('--candidate is required'), chunkOrder: Number(args.order), targetPath: args.output || fail('--output is required') });
  } else if (command === 'restore') {
    const request = await privateJson(args.request || fail('--request is required'), repoRoot);
    if (request.schema !== 'atrium-storage-restore-request/1') fail('Invalid private restore request');
    result = await restoreSourceParts({ repoRoot, blob: request.blob, parts: request.parts, targetPath: args.output || fail('--output is required') });
  } else fail('Unknown chunk command');
  // Deliberately omit paths, source names, remote IDs and download credentials.
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runChunkCli(process.argv.slice(2)).catch(() => {
    console.error('Private staging stopped safely; no original was uploaded, moved or removed.');
    process.exitCode = 1;
  });
}
