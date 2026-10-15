import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileId, hashFile } from './storage-core.mjs';
import { digest } from './storage-verify-backup.mjs';
import { MAX_STAGED_CHUNK_BYTES, stageSourceChunk, restoreSourceParts } from './storage-stage-chunk.mjs';

async function fixture(callback, bytes = Buffer.from('authored original bytes, including geometry and textures')) {
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'atrium-chunk-safety-')));
  try {
    const repoRoot = path.join(temporary, 'repo'), archive = path.join(temporary, 'originals');
    await fs.mkdir(repoRoot); await fs.mkdir(archive);
    execFileSync('git', ['init', '-q', repoRoot]);
    await fs.writeFile(path.join(repoRoot, '.gitignore'), '.atrium-ingest/\n');
    const relativePath = 'SECRET-SOURCE-TOKEN.bin', source = path.join(archive, relativePath);
    await fs.writeFile(source, bytes);
    const sourceRoots = [{ id: 'source', absolutePath: archive }];
    const file = { candidateId: fileId('source', relativePath), sourceRootId: 'source', relativePath,
      ...await hashFile(source, { chunkBytes: 16 }), assetRole: 'provider-original' };
    const manifest = { schema: 'atrium-storage-manifest/1', files: [file] };
    const targetPath = path.join(repoRoot, '.atrium-ingest/chunks/selected.part');
    const options = { repoRoot, sourceRoots, manifest, candidateId: file.candidateId, chunkOrder: 1, targetPath };
    const before = await hashFile(source);
    await callback({ temporary, repoRoot, archive, source, bytes, sourceRoots, file, manifest, targetPath, options, before });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
const absent = async filename => assert.rejects(fs.lstat(filename), { code: 'ENOENT' });
async function noPartialFiles(repoRoot) {
  const root = path.join(repoRoot, '.atrium-ingest');
  async function walk(directory) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      assert.equal(entry.name.startsWith('.atrium-stage-'), false, 'owned interrupted staging file must be removed');
      if (entry.isDirectory()) await walk(path.join(directory, entry.name));
    }
  }
  await walk(root);
}
async function stagedParts(f) {
  const parts = [];
  for (const chunk of f.file.chunks) {
    const filename = path.join(f.repoRoot, '.atrium-ingest/chunks', chunk.order + '.part');
    await stageSourceChunk({ ...f.options, chunkOrder: chunk.order, targetPath: filename });
    parts.push({ ...chunk, path: filename });
  }
  return parts;
}

test('one selected chunk stages exact authored bytes and leaves complete original/stat unchanged', async () => fixture(async f => {
  const result = await stageSourceChunk(f.options);
  assert.deepEqual(await fs.readFile(f.targetPath), f.bytes.subarray(16, 32));
  assert.equal(result.sourceSha256, digest(f.bytes));
  assert.equal(result.sha256, f.file.chunks[1].sha256);
  assert.equal(result.bytes, 16);
  assert.deepEqual((await hashFile(f.source)).localObservation, f.before.localObservation);
  assert.equal((await fs.stat(f.targetPath)).mode & 0o077, 0);
  await noPartialFiles(f.repoRoot);
}));
test('ordered first/middle/final parts restore exact full original into absent private output', async () => fixture(async f => {
  const parts = await stagedParts(f), targetPath = path.join(f.repoRoot, '.atrium-ingest/restored/original.bin');
  const restored = await restoreSourceParts({ repoRoot: f.repoRoot, blob: f.file, parts, targetPath });
  assert.deepEqual(await fs.readFile(targetPath), f.bytes);
  assert.equal(restored.sha256, f.file.sha256);
  assert.equal(restored.bytes, f.bytes.length);
  for (const part of parts) assert.equal((await hashFile(part.path)).sha256, part.sha256);
  assert.deepEqual((await hashFile(f.source)).localObservation, f.before.localObservation);
  await noPartialFiles(f.repoRoot);
}));
test('empty source has one checked empty part and restores without inventing bytes', async () => fixture(async f => {
  const result = await stageSourceChunk({ ...f.options, chunkOrder: 0 });
  assert.equal(result.bytes, 0);
  const targetPath = path.join(f.repoRoot, '.atrium-ingest/restored/empty.bin');
  await restoreSourceParts({ repoRoot: f.repoRoot, blob: f.file, parts: [{ ...f.file.chunks[0], path: f.targetPath }], targetPath });
  assert.equal((await fs.stat(targetPath)).size, 0);
}, Buffer.alloc(0)));
test('existing stage destination is never overwritten, even with identical bytes', async () => fixture(async f => {
  await fs.mkdir(path.dirname(f.targetPath), { recursive: true });
  const kept = Buffer.from('existing owner file');
  await fs.writeFile(f.targetPath, kept);
  await assert.rejects(stageSourceChunk(f.options), /already exists/);
  assert.deepEqual(await fs.readFile(f.targetPath), kept);
  await fs.writeFile(f.targetPath, f.bytes.subarray(16, 32));
  await assert.rejects(stageSourceChunk(f.options), /already exists/);
}));
test('atomic publication cannot clobber a destination created after preflight', async () => fixture(async f => {
  const originalLink = fs.link, owner = Buffer.from('concurrently created owner data');
  fs.link = async (from, to) => { if (to === f.targetPath) await fs.writeFile(to, owner, { flag: 'wx' }); return originalLink(from, to); };
  try { await assert.rejects(stageSourceChunk(f.options), { code: 'EEXIST' }); }
  finally { fs.link = originalLink; }
  assert.deepEqual(await fs.readFile(f.targetPath), owner);
  assert.deepEqual(await fs.readFile(f.source), f.bytes);
  await noPartialFiles(f.repoRoot);
}));
test('changed complete source blocks staging even when selected chunk and current stat appear valid', async () => fixture(async f => {
  const changed = Buffer.from(f.bytes); changed[0] ^= 1;
  await fs.writeFile(f.source, changed);
  const manifest = structuredClone(f.manifest);
  manifest.files[0].localObservation = (await hashFile(f.source)).localObservation;
  await assert.rejects(stageSourceChunk({ ...f.options, manifest }), /Complete source differs/);
  await absent(f.targetPath);
}));
test('source change after chunk read is caught by final full-source verification; original is retained', async () => fixture(async f => {
  const originalOpen = fs.open; let opens = 0;
  const changed = Buffer.from(f.bytes); changed[0] ^= 1;
  fs.open = async (filename, ...args) => {
    if (filename === f.source && ++opens === 3) await fs.writeFile(f.source, changed);
    return originalOpen(filename, ...args);
  };
  try { await assert.rejects(stageSourceChunk(f.options), /Complete source differs/); }
  finally { fs.open = originalOpen; }
  assert.deepEqual(await fs.readFile(f.source), changed);
  await absent(f.targetPath); await noPartialFiles(f.repoRoot);
}));
test('same bytes with changed inventory timestamps still block staging', async () => fixture(async f => {
  await fs.utimes(f.source, new Date(1), new Date(2));
  await assert.rejects(stageSourceChunk(f.options), /Complete source differs/);
  await absent(f.targetPath);
}));
test('corrupt selected chunk hash leaves no output or partial file', async () => fixture(async f => {
  const manifest = structuredClone(f.manifest); manifest.files[0].chunks[1].sha256 = 'a'.repeat(64);
  await assert.rejects(stageSourceChunk({ ...f.options, manifest }), /chunk SHA256 mismatch/);
  await absent(f.targetPath); await noPartialFiles(f.repoRoot);
  assert.deepEqual(await fs.readFile(f.source), f.bytes);
}));
test('staging metadata omits private fields accidentally attached to inventory chunks', async () => fixture(async f => {
  const manifest = structuredClone(f.manifest);
  manifest.files[0].chunks[1].downloadUrl = 'https://private.invalid/raw?token=NEVER-REPORT';
  manifest.files[0].chunks[1].fileId = 'PRIVATE-REMOTE-ID';
  const result = await stageSourceChunk({ ...f.options, manifest });
  assert.equal(JSON.stringify(result).includes('NEVER-REPORT'), false);
  assert.equal(JSON.stringify(result).includes('PRIVATE-REMOTE-ID'), false);
  assert.deepEqual(Object.keys(result.chunk).sort(), ['bytes', 'offset', 'order', 'sha256']);
}));
test('90MiB staging cap rejects oversized inventory chunks before creating a local copy', async () => fixture(async f => {
  const manifest = structuredClone(f.manifest), file = manifest.files[0];
  file.bytes = MAX_STAGED_CHUNK_BYTES + 1; file.localObservation.bytes = file.bytes;
  file.chunks = [{ order: 0, offset: 0, bytes: file.bytes, sha256: file.sha256 }];
  await assert.rejects(stageSourceChunk({ ...f.options, manifest, chunkOrder: 0 }), /exceeds 90MiB/);
  await absent(f.targetPath);
}));
test('invalid, duplicate or traversal inventory identities and incomplete chunk maps are held', async () => fixture(async f => {
  await assert.rejects(stageSourceChunk({ ...f.options, candidateId: 'file-unknown' }), /exactly one/);
  const duplicate = structuredClone(f.manifest); duplicate.files.push(duplicate.files[0]);
  await assert.rejects(stageSourceChunk({ ...f.options, manifest: duplicate }), /exactly one/);
  const traversal = structuredClone(f.manifest); traversal.files[0].relativePath = '../other.bin';
  await assert.rejects(stageSourceChunk({ ...f.options, manifest: traversal }), /Unsafe source-relative/);
  for (const change of [file => file.chunks.reverse(), file => file.chunks[1].offset++, file => file.chunks.pop()]) {
    const manifest = structuredClone(f.manifest); change(manifest.files[0]);
    await assert.rejects(stageSourceChunk({ ...f.options, manifest }), /Chunk map/);
  }
  for (const chunkOrder of [-1, 0.5, f.file.chunks.length, NaN]) await assert.rejects(stageSourceChunk({ ...f.options, chunkOrder }), /valid zero-based/);
  await absent(f.targetPath);
}));
test('symlink source file, ancestor and source root are refused', async () => fixture(async f => {
  await fs.rename(f.source, f.source + '.real'); await fs.symlink(f.source + '.real', f.source);
  await assert.rejects(stageSourceChunk(f.options), /symlink/);
  await fs.unlink(f.source); await fs.rename(f.source + '.real', f.source);
  const alias = path.join(f.temporary, 'alias'); await fs.symlink(f.archive, alias);
  await assert.rejects(stageSourceChunk({ ...f.options, sourceRoots: [{ id: 'source', absolutePath: alias }] }), /alias/);
  const parent = path.join(f.archive, 'nested'); await fs.symlink(f.archive, parent);
  const manifest = structuredClone(f.manifest); manifest.files[0].relativePath = 'nested/' + f.file.relativePath;
  manifest.files[0].candidateId = fileId('source', manifest.files[0].relativePath);
  await assert.rejects(stageSourceChunk({ ...f.options, manifest, candidateId: manifest.files[0].candidateId }), /symlink/);
  await absent(f.targetPath);
}));
test('public, outside, unignored or symlink staging paths cannot receive copies', async () => fixture(async f => {
  for (const targetPath of [path.join(f.repoRoot, 'public/private.bin'), path.join(f.temporary, 'outside.bin'), path.join(f.repoRoot, '.atrium-ingest')]) {
    await assert.rejects(stageSourceChunk({ ...f.options, targetPath }), /inside .atrium-ingest/);
  }
  await fs.mkdir(path.join(f.repoRoot, '.atrium-ingest'), { recursive: true });
  await fs.symlink(f.archive, path.join(f.repoRoot, '.atrium-ingest/alias'));
  await assert.rejects(stageSourceChunk({ ...f.options, targetPath: path.join(f.repoRoot, '.atrium-ingest/alias/new.part') }), /symlink/);
  await fs.symlink(f.source, path.join(f.repoRoot, '.atrium-ingest/existing-link'));
  await assert.rejects(stageSourceChunk({ ...f.options, targetPath: path.join(f.repoRoot, '.atrium-ingest/existing-link') }), /symlink/);
  await fs.writeFile(path.join(f.repoRoot, '.gitignore'), '');
  await assert.rejects(stageSourceChunk(f.options), /ignored/);
  assert.deepEqual(await fs.readFile(f.source), f.bytes);
}));
test('interrupted partial write removes only the helper-owned temp and retains original', async () => fixture(async f => {
  const originalOpen = fs.open;
  fs.open = async (filename, ...args) => {
    const handle = await originalOpen(filename, ...args);
    if (path.basename(filename).startsWith('.atrium-stage-')) {
      const originalWrite = handle.write.bind(handle); let calls = 0;
      handle.write = async (...writeArgs) => { if (++calls === 2) throw new Error('fixture disk interruption'); return originalWrite(writeArgs[0], writeArgs[1], Math.min(4, writeArgs[2]), writeArgs[3]); };
    }
    return handle;
  };
  try { await assert.rejects(stageSourceChunk(f.options), /fixture disk interruption/); }
  finally { fs.open = originalOpen; }
  await absent(f.targetPath); await noPartialFiles(f.repoRoot);
  assert.deepEqual(await fs.readFile(f.source), f.bytes);
}));
test('restore checks each part and complete final SHA, and never replaces existing original', async () => fixture(async f => {
  const parts = await stagedParts(f), targetPath = path.join(f.repoRoot, '.atrium-ingest/restored/original.bin');
  const blob = { sha256: 'a'.repeat(64), bytes: f.bytes.length };
  await assert.rejects(restoreSourceParts({ repoRoot: f.repoRoot, blob, parts, targetPath }), /Complete staged output/);
  await absent(targetPath); await noPartialFiles(f.repoRoot);
  await fs.writeFile(parts[0].path, Buffer.alloc(parts[0].bytes, 1));
  await assert.rejects(restoreSourceParts({ repoRoot: f.repoRoot, blob: f.file, parts, targetPath }), /Restore part differs/);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, 'existing restored owner original');
  await assert.rejects(restoreSourceParts({ repoRoot: f.repoRoot, blob: f.file, parts, targetPath }), /already exists/);
  assert.equal(await fs.readFile(targetPath, 'utf8'), 'existing restored owner original');
  assert.deepEqual(await fs.readFile(f.source), f.bytes);
}));
test('restore rejects missing/reordered parts, gaps, symlinks and nonprivate input paths', async () => fixture(async f => {
  const parts = await stagedParts(f), targetPath = path.join(f.repoRoot, '.atrium-ingest/restored/original.bin');
  for (const bad of [parts.slice().reverse(), parts.slice(1), parts.map((part, i) => ({ ...part, offset: part.offset + (i === 1 ? 1 : 0) }))]) {
    await assert.rejects(restoreSourceParts({ repoRoot: f.repoRoot, blob: f.file, parts: bad, targetPath }), /Chunk map/);
  }
  const outside = parts.map(part => ({ ...part, path: f.source }));
  await assert.rejects(restoreSourceParts({ repoRoot: f.repoRoot, blob: f.file, parts: outside, targetPath }), /inside .atrium-ingest/);
  await fs.unlink(parts[0].path); await fs.symlink(parts[1].path, parts[0].path);
  await assert.rejects(restoreSourceParts({ repoRoot: f.repoRoot, blob: f.file, parts, targetPath }), /symlink/);
  await absent(targetPath);
}));
test('restore catches a part changed after initial verification and retains all source files', async () => fixture(async f => {
  const parts = await stagedParts(f), targetPath = path.join(f.repoRoot, '.atrium-ingest/restored/original.bin');
  const originalOpen = fs.open; let opens = 0;
  const changed = Buffer.alloc(parts[0].bytes, 9);
  fs.open = async (filename, ...args) => {
    if (filename === parts[0].path && ++opens === 3) await fs.writeFile(parts[0].path, changed);
    return originalOpen(filename, ...args);
  };
  try { await assert.rejects(restoreSourceParts({ repoRoot: f.repoRoot, blob: f.file, parts, targetPath }), /Restore part changed/); }
  finally { fs.open = originalOpen; }
  await absent(targetPath); await noPartialFiles(f.repoRoot);
  assert.deepEqual(await fs.readFile(parts[0].path), changed);
  assert.deepEqual(await fs.readFile(f.source), f.bytes);
}));
test('actual stage/restore CLI emits token-free hashes and preserves input files', async () => fixture(async f => {
  const privateDir = path.join(f.repoRoot, '.atrium-ingest'); await fs.mkdir(privateDir);
  const manifestPath = path.join(privateDir, 'manifest.private.json'), rootsPath = path.join(privateDir, 'roots.private.json');
  await fs.writeFile(manifestPath, JSON.stringify(f.manifest)); await fs.writeFile(rootsPath, JSON.stringify(f.sourceRoots));
  const script = path.resolve('scripts/storage-stage-chunk.mjs');
  const stdout = execFileSync(process.execPath, [script, 'stage', '--repo', f.repoRoot, '--manifest', manifestPath, '--roots', rootsPath,
    '--candidate', f.file.candidateId, '--order', '0', '--output', f.targetPath], { encoding: 'utf8' });
  assert.equal(JSON.parse(stdout).sha256, f.file.chunks[0].sha256);
  assert.equal(stdout.includes('SECRET-SOURCE-TOKEN'), false);
  assert.equal(stdout.includes(f.repoRoot), false);
  const tiny = { sha256: f.file.chunks[0].sha256, bytes: f.file.chunks[0].bytes };
  const request = path.join(privateDir, 'restore.private.json'), restored = path.join(privateDir, 'restored.bin');
  await fs.writeFile(request, JSON.stringify({ schema: 'atrium-storage-restore-request/1', blob: tiny, parts: [{ ...f.file.chunks[0], path: f.targetPath }] }));
  const output = execFileSync(process.execPath, [script, 'restore', '--repo', f.repoRoot, '--request', request, '--output', restored], { encoding: 'utf8' });
  assert.equal(JSON.parse(output).sha256, tiny.sha256);
  assert.deepEqual(await fs.readFile(restored), f.bytes.subarray(0, 16));
  assert.deepEqual(await fs.readFile(f.source), f.bytes);
}));
