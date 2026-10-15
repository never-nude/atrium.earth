import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditLocalDeletionCandidates, collectStorageLiveDependencies } from './storage-live-dependencies.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'atrium-storage-live-test-')));
const repo = path.join(temporary, 'repo'), archive = path.join(temporary, 'archive'), old = path.join(temporary, 'old');
const now = Date.parse('2026-10-15T12:00:00Z'), verifiedAt = new Date(now).toISOString();
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
const put = async (root, name, bytes) => { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), bytes); };
const remoteBytes = Buffer.from('public optimized derivative');
const remoteHash = hash(remoteBytes), remoteUrl = `https://models.atrium.earth/models/previews/piece-remote/preview-${remoteHash.slice(0, 12)}.glb`;
const legacyUrl = 'https://models.atrium.earth/models/previews/piece-legacy/preview.glb';
const localUrl = '/models/previews/piece-local/preview.glb';
const liveProofs = [remoteUrl, legacyUrl].map(url => ({ url, sha256: remoteHash, bytes: remoteBytes.length,
  verifiedAt, status: 200, method: 'full-get-sha256', corsVerified: true }));
const sourceRoots = [{ id: 'archive', absolutePath: archive }, { id: 'repo', absolutePath: repo }, { id: 'old', absolutePath: old }];
let count = 0;
try {
  await mkdir(repo); await mkdir(archive);
  git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Storage test');
  await put(repo, '.gitignore', 'public/models/previews/\n');
  const catalog = ['piece-remote', 'piece-local', 'piece-legacy'].map(slug => ({ slug, model: { sourcePath: `${slug}/original.glb` } }));
  const previews = { 'piece-remote': { url: remoteUrl, bytes: remoteBytes.length },
    'piece-local': { url: localUrl, bytes: remoteBytes.length }, 'piece-legacy': { url: legacyUrl, bytes: remoteBytes.length } };
  await put(repo, 'src/data/catalog.json', JSON.stringify(catalog));
  await put(repo, 'src/data/previews.json', JSON.stringify(previews));
  await put(repo, `public${localUrl}`, remoteBytes);
  await put(repo, 'public/previews/renders/piece-remote/thumb.webp', 'tracked thumbnail');
  git('add', '.'); git('add', '-f', `public${localUrl}`); git('commit', '-qm', 'Synthetic site fixture');
  git('worktree', 'add', '-qb', 'old-fixture', old);
  // An untracked local route in another checkout must be protected too.
  await put(old, 'src/data/previews.json', JSON.stringify({ ...previews, 'piece-remote': { url: '/models/previews/piece-remote/preview.glb', bytes: remoteBytes.length } }));
  await put(old, 'public/models/previews/piece-remote/preview.glb', remoteBytes);
  await put(archive, 'original.glb', 'unmodified original geometry');
  const sourceBytes = await readFile(path.join(archive, 'original.glb'));
  const base = { candidateId: 'original', sourceRootId: 'archive', relativePath: 'original.glb',
    absolutePath: path.join(archive, 'original.glb'), sha256: hash(sourceBytes), bytes: sourceBytes.length,
    assetRole: 'provider-original', pieces: ['piece-remote'], dependenciesVerified: true };
  const backup = candidate => ({ candidateId: candidate.candidateId, sha256: candidate.sha256, bytes: candidate.bytes,
    verifiedAt, method: 'full-download-sha256', private: true, complete: true });
  const run = async (candidate = base, overrides = {}) => auditLocalDeletionCandidates({ repoRoot: repo, sourceRoots,
    candidates: [candidate], verifiedBackups: [backup(candidate)], liveProofs, now,
    openFileCheck: async () => ({ checked: true, open: false }), ...overrides });
  const block = async (candidate, overrides, reason) => {
    const result = await run(candidate, overrides); assert.equal(result.results[0].allowed, false);
    assert.ok(result.results[0].blockReasons.some(code => code.includes(reason)), JSON.stringify(result.results[0])); count++;
  };
  const snapshot = await collectStorageLiveDependencies({ repoRoot: repo });
  assert.equal(snapshot.worktreeRoots.length, 2);
  assert.equal(snapshot.remoteRequirements.length, 2);
  const allowed = await run(); assert.equal(allowed.allowed.length, 1); assert.equal(allowed.results[0].offlineRestoreRequired, true); count++;
  await block(base, { verifiedBackups: [] }, 'backup-full-byte');
  await block(base, { verifiedBackups: [{ ...backup(base), method: 'metadata-size' }] }, 'backup-full-byte');
  await block(base, { verifiedBackups: [{ ...backup(base), private: false }] }, 'backup-full-byte');
  await block(base, { verifiedBackups: [{ ...backup(base), complete: false }] }, 'backup-full-byte');
  await block(base, { verifiedBackups: [{ ...backup(base), verifiedAt: '2026-10-01T00:00:00Z' }] }, 'backup-full-byte');
  await block(base, { liveProofs: [] }, 'live-preview-not-verified');
  await block(base, { liveProofs: liveProofs.map(proof => ({ ...proof, method: 'HEAD' })) }, 'live-preview-not-verified');
  await block(base, { liveProofs: liveProofs.map(proof => ({ ...proof, verifiedAt: '2026-10-01T00:00:00Z' })) }, 'live-preview-not-verified');
  await block(base, { liveProofs: liveProofs.map(proof => ({ ...proof, corsVerified: false })) }, 'live-preview-not-verified');
  await block(base, { liveProofs: liveProofs.map(proof => ({ ...proof, sha256: '0'.repeat(64) })) }, 'live-preview-not-verified');
  await block({ ...base, dependenciesVerified: false }, {}, 'dependency-bundle');
  await block({ ...base, pieces: [] }, {}, 'piece-association');
  await block({ ...base, pieces: ['unknown-piece'] }, {}, 'unknown-piece');
  await block({ ...base, sourceRootId: 'unknown' }, {}, 'unknown-source-root');
  await block({ ...base, relativePath: '../archive/original.glb' }, {}, 'unsafe-relative-path');
  await block({ ...base, assetRole: 'unknown' }, {}, 'unknown-asset-role');
  await block(base, { openFileCheck: undefined }, 'open-file-check');
  await block(base, { openFileCheck: async () => ({ checked: true, open: true }) }, 'open-file-check');
  await block(base, { candidates: [base, { ...base }] }, 'duplicate-candidate');
  await block(base, { sourceRoots: [] }, 'source-root-registry');
  await block(base, { now: NaN }, 'invalid-verification-clock');
  await block(base, { openFileCheck: async () => { await put(archive, 'original.glb', 'changed during final preflight'); return { checked: true, open: false }; } }, 'local-content-changed-after');
  await block(base, {}, 'local-content-changed');
  await put(archive, 'original.glb', sourceBytes);
  await symlink(path.join(archive, 'original.glb'), path.join(archive, 'alias.glb'));
  await block({ ...base, relativePath: 'alias.glb', absolutePath: path.join(archive, 'alias.glb') }, {}, 'not-regular-file-or-symlink');
  const embedded = path.join(archive, 'embedded');
  await put(embedded, 'original.glb', sourceBytes);
  execFileSync('git', ['-C', embedded, 'init', '-q']);
  await block({ ...base, relativePath: 'embedded/original.glb', absolutePath: path.join(embedded, 'original.glb') }, {}, 'unregistered-embedded-git');
  const local = { ...base, candidateId: 'local', sourceRootId: 'repo', relativePath: `public${localUrl}`,
    absolutePath: path.join(repo, `public${localUrl}`), sha256: remoteHash, bytes: remoteBytes.length, assetRole: 'derivative-web-preview', pieces: ['piece-local'] };
  await block(local, {}, 'tracked-file');
  await block(local, {}, 'local-runtime-preview');
  const otherLocal = { ...local, candidateId: 'old-local', sourceRootId: 'old', relativePath: 'public/models/previews/piece-remote/preview.glb',
    absolutePath: path.join(old, 'public/models/previews/piece-remote/preview.glb'), pieces: ['piece-remote'] };
  await block(otherLocal, {}, 'local-runtime-preview');
  const thumb = { ...base, sourceRootId: 'repo', relativePath: 'public/previews/renders/piece-remote/thumb.webp',
    absolutePath: path.join(repo, 'public/previews/renders/piece-remote/thumb.webp'), sha256: hash('tracked thumbnail'), bytes: Buffer.byteLength('tracked thumbnail') };
  await block(thumb, {}, 'public-site-asset');
  await put(repo, 'docs/uncommitted-review.txt', sourceBytes);
  await block({ ...base, sourceRootId: 'repo', assetRole: 'provenance', relativePath: 'docs/uncommitted-review.txt',
    absolutePath: path.join(repo, 'docs/uncommitted-review.txt') }, {}, 'uncommitted-code-or-review-work');
  await put(repo, 'public/models/previews/piece-legacy/preview.glb', remoteBytes);
  const mirror = { ...local, candidateId: 'legacy-mirror', relativePath: 'public/models/previews/piece-legacy/preview.glb',
    absolutePath: path.join(repo, 'public/models/previews/piece-legacy/preview.glb'), pieces: ['piece-legacy'] };
  const mirrorResult = await run(mirror); assert.equal(mirrorResult.allowed.length, 1); count++;
  await block(mirror, { liveProofs: liveProofs.map(proof => ({ ...proof, sha256: 'f'.repeat(64) })) }, 'r2-mirror-content');
  await put(repo, 'src/data/spatial-eligibility.json', JSON.stringify({ 'piece-legacy': {
    modelUrl: legacyUrl, assetSha256: 'f'.repeat(64), enabled: true,
  } }));
  await block({ ...base, pieces: ['piece-legacy'] }, {}, 'live-preview-not-verified');
  await rm(path.join(repo, `public${localUrl}`));
  await block({ ...base, pieces: ['piece-local'] }, {}, 'missing-local-preview');
  await put(repo, 'src/data/catalog.json', '{ malformed');
  await block(base, {}, 'dependency-audit-unavailable');
  assert.deepEqual(await readFile(path.join(archive, 'original.glb')), sourceBytes, 'Preflight never changes source bytes');
  console.log(`Storage live-dependency safety: ${count} meaningful acceptance/rejection checks passed; real Git worktree protection, full-byte receipts, mutable R2 mirrors, current file/race binding, local Pages routes and no source mutation.`);
} finally {
  // Only this test's synthetic, uniquely allocated fixture is removed.
  await rm(temporary, { recursive: true, force: true });
}
