import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inventorySources, createCleanupPlan, executeCleanup, hashFile, manifestHash, sourceDependencies } from './storage-core.mjs';
import { verifyRemoteContent, verifyReceipt, verifyLiveContent, verifyLiveReceipt, digest, loadKey, privatePath, writePrivateJson, appendVerifiedReceipt, verificationTimeout } from './storage-verify-backup.mjs';
import { auditLocalDeletionCandidates } from './storage-live-dependencies.mjs';
import { runStorageCli } from './storage-archive.mjs';

const key = Buffer.alloc(32, 7), now = Date.parse('2026-10-15T20:00:00Z');
const clear = async () => ({ checked: true, open: false });
const response = (bytes, status = 200, headers = {}) => new Response(bytes, { status, headers });
function requestFor(bytes, overrides = {}) {
  return { blob: { sha256: digest(bytes), bytes: bytes.length }, objects: [{
    order: 0, offset: 0, bytes: bytes.length, sha256: digest(bytes), downloadUrl: 'https://download.invalid/raw?token=NEVER-PERSIST-THIS',
    drive: { provider: 'google-drive', fileId: 'fixture-drive-object', version: '1', size: bytes.length, private: true, sharingCheckedAt: new Date(now).toISOString() },
  }], ...overrides };
}
const receiptFor = async bytes => verifyRemoteContent(requestFor(bytes), { key, now, fetchImpl: async () => response(bytes) });
async function fixture(callback) {
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'atrium-storage-safety-')));
  try {
    const repoRoot = path.join(temporary, 'repo'), archive = path.join(temporary, 'archive');
    await fs.mkdir(repoRoot); await fs.mkdir(archive);
    execFileSync('git', ['init', '-q', repoRoot]);
    await fs.mkdir(path.join(repoRoot, 'src/data'), { recursive: true });
    await fs.writeFile(path.join(repoRoot, 'src/data/catalog.json'), JSON.stringify([{ slug: 'fixture', hidden: true, model: { sourcePath: 'mesh.obj' } }]));
    await fs.writeFile(path.join(repoRoot, 'src/data/previews.json'), '{}');
    await fs.writeFile(path.join(repoRoot, '.gitignore'), '.private/\n');
    await fs.writeFile(path.join(archive, 'mesh.obj'), 'mtllib surface.mtl\nv 0 0 0\n');
    await fs.writeFile(path.join(archive, 'surface.mtl'), 'newmtl surface\nmap_Kd -s 1 1 1 tex.png\n');
    await fs.writeFile(path.join(archive, 'tex.png'), 'authored texture pixels');
    await fs.writeFile(path.join(archive, 'LICENSE.txt'), 'CC BY4.0 and source attribution');
    const sourceRoots = [{ id: 'source', absolutePath: archive }];
    const recoveryBytes = Buffer.from('{"restorePaths":["mesh.obj","surface.mtl","tex.png","LICENSE.txt"]}');
    const config = { sourceRoots, requiredBlobs: [{ sha256: digest(recoveryBytes), bytes: recoveryBytes.length, assetRole: 'restore-manifest' }], pieces: [{ slug: 'fixture', public: false, identity: { title: 'Fixture', sourceUid: 'provider-exact-id' }, batch: 'test', assets: [
      { sourceRootId: 'source', relativePath: 'mesh.obj', assetRole: 'provider-original' },
      { sourceRootId: 'source', relativePath: 'LICENSE.txt', assetRole: 'license' },
    ] }] };
    const manifest = await inventorySources(config);
    const receipts = await Promise.all(manifest.blobs.map(async blob => receiptFor(await fs.readFile(path.join(archive, manifest.files.find(f => f.sha256 === blob.sha256).relativePath)))));
    receipts.push(await receiptFor(recoveryBytes));
    const original = manifest.files.find(f => f.relativePath === 'mesh.obj');
    const whitelist = { schema: 'atrium-storage-removal-whitelist/1', manifestSha256: manifestHash(manifest), files: [((f) => ({ candidateId: f.candidateId, sourceRootId: f.sourceRootId, relativePath: f.relativePath, sha256: f.sha256, bytes: f.bytes }))(original)] };
    const options = { repoRoot, sourceRoots, manifest, receipts, key, whitelist, auditDependencies: auditLocalDeletionCandidates, openFileCheck: clear, now };
    await callback({ temporary, repoRoot, archive, sourceRoots, config, manifest, receipts, original, whitelist, options });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

test('actual streamed bytes produce a signed token-free content receipt', async () => {
  const bytes = Buffer.from('original bytes, including texture');
  const signed = await receiptFor(bytes);
  assert.equal(verifyReceipt(signed, key, { now }).blob.sha256, digest(bytes));
  assert.equal(JSON.stringify(signed).includes('NEVER-PERSIST'), false);
  assert.equal(JSON.stringify(signed).includes('downloadUrl'), false);
  assert.equal(signed.payload.objects[0].fileId, 'fixture-drive-object');
});
test('network verification timeout is bounded and a timed-out stream creates no receipt', async () => {
  assert.equal(verificationTimeout(), 120000);
  assert.equal(verificationTimeout('1800000'), 1800000);
  for (const value of ['0', '-1', 'Infinity', '1.5', '1800001', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => verificationTimeout(value), /timeout/);
  await assert.rejects(verifyRemoteContent(requestFor(Buffer.from('original')), { key, timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('fixture delayed response')), 100);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
  }) }), /download failed/);
});
test('metadata, incomplete HTTP responses, short bodies and corrupt bytes cannot produce receipts', async () => {
  const bytes = Buffer.from('expected provider original'), request = requestFor(bytes);
  await assert.rejects(verifyRemoteContent({ blob: request.blob }, { key }), /ordered remote objects/);
  await assert.rejects(verifyRemoteContent(request, { key, fetchImpl: async () => response(bytes, 206) }), /HTTP200/);
  await assert.rejects(verifyRemoteContent(request, { key, fetchImpl: async () => response(bytes.subarray(1)) }), /mismatch/);
  await assert.rejects(verifyRemoteContent(request, { key, fetchImpl: async () => response(Buffer.from('different same byte data')) }), /receipt|stream/);
  const publicCopy = structuredClone(request); publicCopy.objects[0].drive.private = false;
  await assert.rejects(verifyRemoteContent(publicCopy, { key }), /private-sharing/);
  const noVersion = structuredClone(request); delete noVersion.objects[0].drive.version;
  await assert.rejects(verifyRemoteContent(noVersion, { key }), /identity/);
  const signedUrl = structuredClone(request); signedUrl.objects[0].downloadUrl = 'http://insecure.invalid/secret';
  await assert.rejects(verifyRemoteContent(signedUrl, { key }), /HTTPS/);
});
test('ordered chunks reconstruct a full original without intermediate files', async () => {
  const parts = [Buffer.from('first-'), Buffer.from('second-'), Buffer.from('third')];
  const complete = Buffer.concat(parts), request = requestFor(complete);
  let offset = 0;
  request.objects = parts.map((bytes, i) => {
    const object = requestFor(bytes).objects[0];
    object.order = i; object.offset = offset; object.drive.fileId = 'chunk-' + i;
    offset += bytes.length; return object;
  });
  let next = 0;
  const receipt = await verifyRemoteContent(request, { key, now, fetchImpl: async () => response(parts[next++]) });
  assert.equal(receipt.payload.blob.sha256, digest(complete));
  assert.equal(receipt.payload.objects.length, 3);
  const reversed = structuredClone(request); reversed.objects.reverse();
  await assert.rejects(verifyRemoteContent(reversed, { key }), /ordered/);
  const gap = structuredClone(request); gap.objects[1].offset++;
  next = 0;
  await assert.rejects(verifyRemoteContent(gap, { key, fetchImpl: async () => response(parts[next++]) }), /contiguous/);
});
test('receipt tampering, unsigned flags and stale content verification are rejected', async () => {
  const receipt = await receiptFor(Buffer.from('signed original'));
  const tampered = structuredClone(receipt); tampered.payload.blob.bytes++;
  assert.throws(() => verifyReceipt(tampered, key, { now }), /signature/);
  assert.throws(() => verifyReceipt(receipt.payload, key, { now }), /Unsigned/);
  assert.throws(() => verifyReceipt(receipt, key, { now: now + 2 * 86400000 }), /stale/);
});
test('live proofs require complete bytes, correct production CORS and signed public URLs', async () => {
  const bytes = Buffer.from('public optimized preview'), request = { kind: 'live-delivery', url: 'https://models.atrium.earth/models/previews/fixture/preview.glb', blob: { bytes: bytes.length, sha256: digest(bytes) } };
  const receipt = await verifyLiveContent(request, { key, now, fetchImpl: async (_url, options) => {
    assert.equal(options.headers.Origin, 'https://atrium.earth');
    return response(bytes, 200, { 'access-control-allow-origin': 'https://atrium.earth' });
  } });
  assert.equal(verifyLiveReceipt(receipt, key, { now }).corsVerified, true);
  await assert.rejects(verifyLiveContent(request, { key, fetchImpl: async () => response(bytes) }), /production origin/);
  await assert.rejects(verifyLiveContent({ ...request, url: request.url + '?token=secret' }, { key }), /signed URL/);
  const discovered = await verifyLiveContent({ kind: 'live-delivery', url: request.url, bytes: bytes.length }, { key, now, fetchImpl: async () => response(bytes, 200, { 'access-control-allow-origin': '*' }) });
  assert.equal(verifyLiveReceipt(discovered, key, { now }).sha256, digest(bytes));
});
test('bound-only inventory never scans unrelated files or signing material', async () => fixture(async f => {
  await fs.writeFile(path.join(f.archive, 'unrelated-owner-file.txt'), 'private unrelated data');
  await fs.writeFile(path.join(f.archive, 'receipt.key'), crypto.randomBytes(32));
  const inventory = await inventorySources(f.config);
  assert.deepEqual(inventory.files.map(x => x.relativePath).sort(), ['LICENSE.txt', 'mesh.obj', 'surface.mtl', 'tex.png']);
  assert.equal(inventory.files.find(x => x.relativePath === 'tex.png').assetRole, 'source-sidecar');
  assert.ok(inventory.dependencyGroups.find(x => x.id === 'piece:fixture').fileIds.length === 4);
}));
test('content dedup does not erase original/derivative roles or restore paths', async () => fixture(async f => {
  await fs.writeFile(path.join(f.archive, 'original.stl'), 'same full content');
  await fs.writeFile(path.join(f.archive, 'preview.stl'), 'same full content');
  f.config.pieces[0].assets.push(
    { sourceRootId: 'source', relativePath: 'original.stl', assetRole: 'provider-original' },
    { sourceRootId: 'source', relativePath: 'preview.stl', assetRole: 'derivative-web-preview' });
  const inventory = await inventorySources(f.config), same = inventory.files.filter(x => x.relativePath.endsWith('.stl'));
  assert.equal(same[0].sha256, same[1].sha256);
  assert.notEqual(same[0].assetRole, same[1].assetRole);
  assert.equal(inventory.blobs.find(b => b.sha256 === same[0].sha256).fileIds.length, 2);
}));
test('missing MTL/texture and escaping/remote dependencies fail bundle closure', async () => fixture(async f => {
  await fs.rm(path.join(f.archive, 'tex.png'));
  const manifest = await inventorySources(f.config);
  assert.equal(manifest.dependencyGroups.find(g => g.id === 'piece:fixture').complete, false);
  await fs.writeFile(path.join(f.archive, 'mesh.obj'), 'mtllib ../../outside.mtl\n');
  assert.ok((await sourceDependencies(path.join(f.archive, 'mesh.obj'), 'mesh.obj')).errors.length);
  await fs.writeFile(path.join(f.archive, 'model.gltf'), JSON.stringify({ buffers: [{ uri: 'https://remote.invalid/mesh.bin' }] }));
  assert.ok((await sourceDependencies(path.join(f.archive, 'model.gltf'), 'model.gltf')).errors.length);
}));
test('symlink inputs and parent aliases cannot become cleanup candidates', async () => fixture(async f => {
  await fs.symlink(path.join(f.archive, 'mesh.obj'), path.join(f.archive, 'alias.obj'));
  f.config.pieces[0].assets.push({ sourceRootId: 'source', relativePath: 'alias.obj', assetRole: 'provider-original' });
  const inventory = await inventorySources(f.config);
  assert.equal(inventory.files.some(x => x.relativePath === 'alias.obj'), false);
  assert.ok(inventory.errors.length);
  await fs.rename(path.join(f.archive, 'mesh.obj'), path.join(f.archive, 'real.obj'));
  await fs.symlink(path.join(f.archive, 'real.obj'), path.join(f.archive, 'mesh.obj'));
  assert.ok((await createCleanupPlan(f.options)).blocked.length);
}));
test('a fully verified complete source bundle can be planned without deletion', async () => fixture(async f => {
  const plan = await createCleanupPlan(f.options);
  assert.equal(plan.allowed.length, 1); assert.equal(plan.blocked.length, 0);
  assert.equal(plan.allowed[0].offlineRestoreRequired, true);
  assert.ok(await fs.stat(path.join(f.archive, 'mesh.obj')));
}));
test('one unverified bundle member blocks removing an otherwise backed-up original', async () => fixture(async f => {
  const texture = f.manifest.files.find(x => x.relativePath === 'tex.png');
  const receipts = f.receipts.filter(r => r.payload.blob.sha256 !== texture.sha256);
  const plan = await createCleanupPlan({ ...f.options, receipts });
  assert.equal(plan.allowed.length, 0); assert.ok(plan.blocked[0].blockReasons.some(x => x.includes('bundle member')));
}));
test('changed originals and changed sidecars block the entire apply batch', async () => fixture(async f => {
  await fs.writeFile(path.join(f.archive, 'tex.png'), 'changed texture content');
  assert.equal((await createCleanupPlan(f.options)).allowed.length, 0);
  await assert.rejects(executeCleanup({ ...f.options, journalPath: path.join(f.temporary, 'journal.json'), quarantineRoot: f.temporary }), /blocked files/);
  assert.ok(await fs.stat(path.join(f.archive, 'mesh.obj')));
}));
test('exact whitelist, fresh signed proofs, locks and known handle state are mandatory', async () => fixture(async f => {
  await assert.rejects(createCleanupPlan({ ...f.options, whitelist: undefined }), /explicit per-file/);
  const wrong = structuredClone(f.whitelist); wrong.files[0].sha256 = '0'.repeat(64);
  assert.equal((await createCleanupPlan({ ...f.options, whitelist: wrong })).allowed.length, 0);
  assert.equal((await createCleanupPlan({ ...f.options, now: now + 2 * 86400000 })).allowed.length, 0);
  assert.equal((await createCleanupPlan({ ...f.options, openFileCheck: async () => ({ checked: false, open: false }) })).allowed.length, 0);
  assert.equal((await createCleanupPlan({ ...f.options, openFileCheck: async () => ({ checked: true, open: true }) })).allowed.length, 0);
  await fs.writeFile(path.join(f.archive, 'upload.partial'), 'in progress');
  assert.equal((await createCleanupPlan(f.options)).allowed.length, 0);
}));
test('Git-tracked originals remain protected even with complete remote backups', async () => fixture(async f => {
  const target = path.join(f.repoRoot, 'tracked.obj');
  await fs.copyFile(path.join(f.archive, 'mesh.obj'), target);
  execFileSync('git', ['-C', f.repoRoot, 'add', 'tracked.obj']);
    const config = { sourceRoots: [{ id: 'repo', absolutePath: f.repoRoot }], requiredBlobs: f.manifest.requiredBlobs, pieces: [{ slug: 'fixture', public: false, assets: [{ sourceRootId: 'repo', relativePath: 'tracked.obj', assetRole: 'provider-original' }] }] };
  await fs.copyFile(path.join(f.archive, 'surface.mtl'), path.join(f.repoRoot, 'surface.mtl'));
  await fs.copyFile(path.join(f.archive, 'tex.png'), path.join(f.repoRoot, 'tex.png'));
  const manifest = await inventorySources(config);
    const receipts = await Promise.all(manifest.files.map(async x => receiptFor(await fs.readFile(path.join(f.repoRoot, x.relativePath)))));
    receipts.push(f.receipts.at(-1));
  const file = manifest.files.find(x => x.relativePath === 'tracked.obj');
  const whitelist = { schema: 'atrium-storage-removal-whitelist/1', manifestSha256: manifestHash(manifest), files: [{ candidateId: file.candidateId, sourceRootId: file.sourceRootId, relativePath: file.relativePath, sha256: file.sha256, bytes: file.bytes }] };
  assert.equal((await createCleanupPlan({ ...f.options, manifest, receipts, sourceRoots: config.sourceRoots, whitelist })).allowed.length, 0);
}));
test('only exact verified fixture files are removed; sidecars and journals survive', async () => fixture(async f => {
  const journalPath = path.join(f.temporary, 'journal.json');
  const journal = await executeCleanup({ ...f.options, journalPath, quarantineRoot: f.temporary });
  assert.equal(journal.files[0].state, 'removed');
  await assert.rejects(fs.stat(path.join(f.archive, 'mesh.obj')), { code: 'ENOENT' });
  assert.ok(await fs.stat(path.join(f.archive, 'tex.png')));
  assert.ok(await fs.stat(path.join(f.archive, 'LICENSE.txt')));
  assert.equal(JSON.parse(await fs.readFile(journalPath, 'utf8')).files[0].state, 'removed');
}));
test('last-moment mutation cannot delete changed data and is journaled', async () => fixture(async f => {
  let calls = 0;
  const openFileCheck = async filename => {
    calls++;
    // Module preflight calls once. The execute check follows its own hash.
    if (calls === 2) await fs.writeFile(filename, 'changed immediately before rename');
    return { checked: true, open: false };
  };
  const journalPath = path.join(f.temporary, 'journal.json');
  await assert.rejects(executeCleanup({ ...f.options, openFileCheck, journalPath, quarantineRoot: f.temporary }), /stopped safely|blocked/);
  const original = await fs.readFile(path.join(f.archive, 'mesh.obj'), 'utf8');
  assert.ok(original.includes('changed') || original.includes('mtllib'));
}));
test('private ledgers reject public output, unsafe key modes and unsigned live metadata', async () => fixture(async f => {
  await assert.rejects(privatePath(path.join(f.repoRoot, 'public-ledger.json'), f.repoRoot), /ignored/);
  const keyPath = path.join(f.temporary, 'receipt-key');
  assert.equal((await loadKey(keyPath, { create: true, repoRoot: f.repoRoot })).length, 32);
  await fs.chmod(keyPath, 0o644);
  await assert.rejects(loadKey(keyPath, { repoRoot: f.repoRoot }), /owner-only/);
  await fs.chmod(keyPath, 0o600);
  const privateDir = path.join(f.temporary, 'ledger'); await fs.mkdir(privateDir);
  for (const [name, value] of [['manifest.json', f.manifest], ['roots.json', f.sourceRoots], ['whitelist.json', f.whitelist], ['receipts.json', { schema: 'atrium-storage-backup-ledger/1', receipts: f.receipts }], ['live.json', [{ method: 'full-get-sha256', verified: true }]]]) await writePrivateJson(path.join(privateDir, name), value, f.repoRoot);
  await fs.writeFile(keyPath, key, { mode: 0o600 });
  await assert.rejects(runStorageCli(['plan', '--repo', f.repoRoot, '--manifest', path.join(privateDir, 'manifest.json'), '--roots', path.join(privateDir, 'roots.json'), '--receipts', path.join(privateDir, 'receipts.json'), '--key', keyPath, '--whitelist', path.join(privateDir, 'whitelist.json'), '--live-proofs', path.join(privateDir, 'live.json')]), /signed content ledger/);
}));
test('ignored public/dist output cannot expose private keys or ledgers', async () => fixture(async f => {
  await fs.writeFile(path.join(f.repoRoot, '.gitignore'), 'public/\ndist/\n.private/\n');
  await assert.rejects(privatePath(path.join(f.repoRoot, 'public/models/previews/private.json'), f.repoRoot), /never be placed/);
  await assert.rejects(loadKey(path.join(f.repoRoot, 'dist/private-key'), { create: true, repoRoot: f.repoRoot }), /never be placed/);
}));
test('private ledger boundaries protect every registered worktree', async () => fixture(async f => {
  execFileSync('git', ['-C', f.repoRoot, 'add', '.']);
  execFileSync('git', ['-C', f.repoRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  const other = path.join(f.temporary, 'other-worktree');
  execFileSync('git', ['-C', f.repoRoot, 'worktree', 'add', '--detach', other], { stdio: 'pipe' });
  await assert.rejects(privatePath(path.join(other, 'public/ignored-key.json'), f.repoRoot), /never be placed/);
  await assert.rejects(privatePath(path.join(other, 'unignored-ledger.json'), f.repoRoot), /outside every/);
}));
test('private JSON output cannot overwrite an unrelated original or provenance record', async () => fixture(async f => {
  const original = path.join(f.archive, 'provider.json');
  const bytes = Buffer.from('{"provider":"original provenance"}');
  await fs.writeFile(original, bytes);
  await assert.rejects(writePrivateJson(original, { schema: 'atrium-storage-manifest/1', sourceRoots: [] }, f.repoRoot), /unrelated/);
  assert.deepEqual(await fs.readFile(original), bytes);
}));
test('forged traversal file IDs cannot escape quarantine or reach mutation', async () => fixture(async f => {
  const manifest = structuredClone(f.manifest), file = manifest.files.find(x => x.candidateId === f.original.candidateId);
  file.candidateId = '../victim';
  const whitelist = structuredClone(f.whitelist); whitelist.files[0].candidateId = '../victim'; whitelist.manifestSha256 = manifestHash(manifest);
  await assert.rejects(executeCleanup({ ...f.options, manifest, whitelist, journalPath: path.join(f.temporary, 'journal.json'), quarantineRoot: f.temporary }), /candidate ID/);
  assert.ok(await fs.stat(path.join(f.archive, 'mesh.obj')));
}));
test('concurrent receipt writers merge under lock without losing successful verifications', async () => fixture(async f => {
  const receipts = await Promise.all(Array.from({ length: 8 }, (_, i) => receiptFor(Buffer.from('unique original ' + i))));
  const ledgerPath = path.join(f.temporary, 'concurrent-ledger.json');
  await Promise.all(receipts.map(receipt => appendVerifiedReceipt(ledgerPath, receipt, key, f.repoRoot)));
  const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
  assert.equal(ledger.receipts.length, 8);
  for (const receipt of ledger.receipts) verifyReceipt(receipt, key, { now });
}));
test('verified originals cannot be removed without their remotely verified immutable recovery map', async () => fixture(async f => {
  const recoveryHash = f.manifest.requiredBlobs[0].sha256;
  const receipts = f.receipts.filter(r => r.payload.blob.sha256 !== recoveryHash);
  const plan = await createCleanupPlan({ ...f.options, receipts });
  assert.equal(plan.allowed.length, 0);
  assert.ok(plan.blocked.some(x => x.blockReasons.some(r => r.includes('recovery-map'))));
  const manifest = structuredClone(f.manifest); manifest.requiredBlobs = [];
  const whitelist = { ...f.whitelist, manifestSha256: manifestHash(manifest) };
  assert.equal((await createCleanupPlan({ ...f.options, manifest, whitelist })).allowed.length, 0);
}));
test('merge CLI authenticates shard ledgers and content-deduplicates repeated receipts', async () => fixture(async f => {
  const keyPath = path.join(f.temporary, 'merge-key');
  await fs.writeFile(keyPath, key, { mode: 0o600 });
  const a = path.join(f.temporary, 'a.json'), b = path.join(f.temporary, 'b.json'), list = path.join(f.temporary, 'inputs.json'), output = path.join(f.temporary, 'merged.json');
  await writePrivateJson(a, { schema: 'atrium-storage-backup-ledger/1', receipts: f.receipts.slice(0, 2) }, f.repoRoot);
  await writePrivateJson(b, { schema: 'atrium-storage-backup-ledger/1', receipts: [f.receipts[0], f.receipts[2]] }, f.repoRoot);
  await writePrivateJson(list, [a, b], f.repoRoot);
  execFileSync(process.execPath, [path.resolve('scripts/storage-verify-backup.mjs'), 'merge', '--repo', f.repoRoot, '--key', keyPath, '--inputs', list, '--receipts', output], { stdio: 'pipe' });
  const merged = JSON.parse(await fs.readFile(output, 'utf8'));
  assert.equal(merged.receipts.length, 3);
  for (const receipt of merged.receipts) verifyReceipt(receipt, key, { now });
}));
