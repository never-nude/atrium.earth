// Read-only deletion preflight. This module never removes files or fetches cloud
// objects. Receipts must come from the workflow's full-byte verification steps.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const hashPattern = /^[a-f0-9]{64}$/;
const roles = new Set(['provider-original', 'source-archive', 'source-sidecar',
  'license', 'provenance', 'derivative-web-preview', 'derivative-other']);
const inside = (root, file) => file === root || (!path.relative(root, file).startsWith(`..${path.sep}`)
  && path.relative(root, file) !== '..' && !path.isAbsolute(path.relative(root, file)));
const git = async (root, args) => (await exec('git', ['--no-optional-locks', '-C', root, ...args],
  { encoding: 'utf8', maxBuffer: 40_000_000 })).stdout;
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const exists = async file => { try { await stat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const sha256 = async file => {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
};

function remotePreview(slug, preview) {
  if (!preview || typeof preview.url !== 'string') return null;
  const prefix = `https://models.atrium.earth/models/previews/${slug}/`;
  if (!preview.url.startsWith(prefix)) return null;
  const filename = preview.url.slice(prefix.length);
  const match = /^preview(?:-([a-f0-9]{12,64}))?\.glb$/.exec(filename);
  return match ? { ...preview, slug, filename, hashPrefix: match[1] || '' } : null;
}

function localPreview(root, url) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || /[?#\0]/.test(url)) return null;
  const decoded = decodeURIComponent(url);
  if (decoded.includes('\\') || decoded.split('/').some(part => part === '..' || part === '.')) return null;
  const file = path.resolve(root, 'public', `.${decoded}`);
  return inside(path.join(root, 'public'), file) ? file : null;
}

/** Discover every registered checkout. Missing prunable registrations have no
 * filesystem dependencies; an explicitly supplied missing checkout is an error.
 * No Git refresh/index write, fetch, branch change, or build is performed. */
export async function collectStorageLiveDependencies({ repoRoot, worktreeRoots = [] }) {
  repoRoot = await realpath(path.resolve(repoRoot));
  const listed = await git(repoRoot, ['worktree', 'list', '--porcelain', '-z']);
  const registered = listed.split('\0').filter(value => value.startsWith('worktree ')).map(value => value.slice(9));
  const roots = new Set([repoRoot]);
  const skippedMissingRegistrations = [];
  for (const root of registered) {
    if (await exists(root)) roots.add(await realpath(root));
    else skippedMissingRegistrations.push(root);
  }
  for (const root of worktreeRoots) roots.add(await realpath(path.resolve(root)));
  const protectedDependencies = [], pieces = [], remoteRequirements = [];
  for (const root of roots) {
    const tracked = (await git(root, ['ls-files', '-z'])).split('\0').filter(Boolean);
    for (const name of tracked) {
      const file = path.resolve(root, name);
      protectedDependencies.push({ path: file, kind: 'tracked', repoRoot: root });
      try {
        const canonical = await realpath(file);
        if (canonical !== file) protectedDependencies.push({ path: canonical, kind: 'tracked-alias', repoRoot: root });
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const catalog = await json(path.join(root, 'src/data/catalog.json'));
    const previews = await json(path.join(root, 'src/data/previews.json'));
    const bindingData = {};
    if (root === repoRoot) {
      for (const name of ['physical-dimensions', 'spatial-eligibility']) {
        const file = path.join(root, `src/data/${name}.json`);
        bindingData[name] = await exists(file) ? await json(file) : {};
      }
    }
    if (!Array.isArray(catalog) || !previews || Array.isArray(previews) || typeof previews !== 'object') throw new Error(`Invalid catalog/preview data: ${root}`);
    const seen = new Set();
    for (const work of catalog) {
      if (!/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(work.slug) || seen.has(work.slug)) throw new Error(`Invalid/duplicate catalog slug: ${root}`);
      seen.add(work.slug);
      let preview = previews[work.slug];
      if (root === repoRoot && preview) {
        const spatial = bindingData['physical-dimensions']?.[work.slug]?.spatial;
        const eligibility = bindingData['spatial-eligibility']?.[work.slug];
        const expected = [preview.sha256,
          spatial?.previewUrl === preview.url ? spatial.assetSha256 : null,
          eligibility?.modelUrl === preview.url ? eligibility.assetSha256 : null].filter(hash => hashPattern.test(hash || ''));
        preview = { ...preview, expectedSha256s: [...new Set(expected)] };
      }
      const local = localPreview(root, preview?.url), remote = remotePreview(work.slug, preview);
      pieces.push({ repoRoot: root, slug: work.slug, hidden: Boolean(work.hidden), sourcePath: work.model?.sourcePath || '', preview, localPath: local });
      if (local) {
        protectedDependencies.push({ path: local, kind: 'local-preview', repoRoot: root, slug: work.slug });
        if (await exists(local)) {
          const canonical = await realpath(local);
          if (canonical !== local) protectedDependencies.push({ path: canonical, kind: 'local-preview-alias', repoRoot: root, slug: work.slug });
        }
      }
      if (root === repoRoot && !work.hidden) {
        if (!local && !remote) throw new Error(`Unsupported/missing live preview: ${work.slug}`);
        if (remote) remoteRequirements.push(remote);
      }
    }
    protectedDependencies.push({ path: path.join(root, 'public'), kind: 'public-asset-root', repoRoot: root });
  }
  return { schema: 'atrium-storage-live-dependencies/1', repoRoot, worktreeRoots: [...roots],
    skippedMissingRegistrations, protectedDependencies, pieces, remoteRequirements };
}

function fresh(value, now, maxAge) {
  const date = Date.parse(value);
  return Number.isFinite(date) && date <= now + 300_000 && now - date <= maxAge;
}

function liveProofFor(preview, proofs, now, maxAge) {
  return proofs.find(proof => proof.url === preview.url && proof.status === 200
    && proof.method === 'full-get-sha256' && proof.corsVerified === true
    && hashPattern.test(proof.sha256) && Number.isSafeInteger(proof.bytes) && proof.bytes > 0
    && proof.bytes === preview.bytes && (!preview.hashPrefix || proof.sha256.startsWith(preview.hashPrefix))
    && (preview.expectedSha256s || []).every(expected => proof.sha256 === expected)
    && fresh(proof.verifiedAt, now, maxAge));
}

function registryMap(sourceRoots) {
  if (Array.isArray(sourceRoots)) return new Map(sourceRoots.map(root => [root.id, root.absolutePath]));
  return new Map(Object.entries(sourceRoots || {}));
}

async function noSymlinks(file, root) {
  const relative = path.relative(root, file);
  let current = root;
  for (const segment of ['', ...relative.split(path.sep)]) {
    if (segment) current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) return false;
  }
  return await realpath(file) === file && await realpath(root) === root;
}

/** Candidate and receipt schemas are deliberately explicit. A backup receipt is
 * {candidateId,sha256,bytes,verifiedAt,method:'full-download-sha256',private:true,
 * complete:true}. A live receipt is {url,sha256,bytes,verifiedAt,status:200,
 * method:'full-get-sha256',corsVerified:true}. Drive identifiers are never copied
 * to results. Dependency-group/sidecar completeness is verified by the caller.
 *
 * sourceRoots: [{id,absolutePath}] or an id -> absolute path object.
 * openFileCheck(path): {checked:true,open:false}; unavailable/uncertain blocks.
 */
export async function auditLocalDeletionCandidates({ repoRoot, candidates = [], sourceRoots,
  verifiedBackups = [], liveProofs = [], worktreeRoots = [], now = Date.now(),
  verificationMaxAgeMs = 86_400_000, openFileCheck }) {
  let snapshot;
  const errors = [];
  try { snapshot = await collectStorageLiveDependencies({ repoRoot, worktreeRoots }); }
  catch (error) { errors.push(`dependency-audit-unavailable: ${error.message}`); }
  const roots = registryMap(sourceRoots);
  if (!roots.size) errors.push('source-root-registry-required');
  if (Array.isArray(sourceRoots) && roots.size !== sourceRoots.length) errors.push('duplicate-source-root-id');
  const ids = candidates.map(candidate => candidate.candidateId);
  if (new Set(ids).size !== ids.length) errors.push('duplicate-candidate-id');
  const paths = candidates.map(candidate => candidate.absolutePath).filter(Boolean);
  if (new Set(paths).size !== paths.length) errors.push('duplicate-candidate-path');
  if (!Number.isFinite(now) || !Number.isFinite(verificationMaxAgeMs) || verificationMaxAgeMs <= 0) errors.push('invalid-verification-clock');
  const results = [];
  for (const candidate of candidates) {
    const blockReasons = [...errors], referencedBy = [];
    const result = { candidateId: candidate.candidateId, allowed: false, blockReasons, referencedBy,
      offlineRestoreRequired: candidate.assetRole !== 'derivative-web-preview' };
    results.push(result);
    if (errors.length) continue;
    if (!candidate.candidateId || !roles.has(candidate.assetRole)) blockReasons.push('unknown-asset-role-or-id');
    if (candidate.dependenciesVerified !== true) blockReasons.push('dependency-bundle-not-verified');
    if (!hashPattern.test(candidate.sha256) || !Number.isSafeInteger(candidate.bytes) || candidate.bytes <= 0) blockReasons.push('invalid-content-binding');
    const registeredRoot = roots.get(candidate.sourceRootId);
    if (typeof registeredRoot !== 'string' || !path.isAbsolute(registeredRoot)) { blockReasons.push('unknown-source-root'); continue; }
    const root = path.resolve(registeredRoot);
    if (typeof candidate.relativePath !== 'string' || !candidate.relativePath || candidate.relativePath.includes('\\') || path.isAbsolute(candidate.relativePath)
      || candidate.relativePath.split(/[\\/]/).some(part => part === '..' || part === '.')) { blockReasons.push('unsafe-relative-path'); continue; }
    const file = path.resolve(root, candidate.relativePath);
    if (!inside(root, file) || file === root || candidate.absolutePath !== file || /[\0\r\n]/.test(file)) { blockReasons.push('source-root-path-mismatch'); continue; }
    if (file.split(path.sep).some(part => part === '.git' || part === 'node_modules' || part === '.venv'
      || /^\.env(?:\.|$)/.test(part))) { blockReasons.push('protected-code-credentials-or-dependency-path'); continue; }
    try {
      if (!(await lstat(file)).isFile() || !await noSymlinks(file, root)) { blockReasons.push('not-regular-file-or-symlink'); continue; }
      for (let parent = path.dirname(file); inside(root, parent); parent = path.dirname(parent)) {
        if (await exists(path.join(parent, '.git')) && !snapshot.worktreeRoots.includes(parent)) { blockReasons.push('unregistered-embedded-git-repository'); break; }
        if (parent === root) break;
      }
      const exact = snapshot.protectedDependencies.filter(dependency => dependency.path === file && dependency.kind !== 'public-asset-root');
      if (snapshot.worktreeRoots.some(checkout => ['src', 'scripts', 'docs', '.github'].some(directory => inside(path.join(checkout, directory), file)))) {
        blockReasons.push('uncommitted-code-or-review-work-protected');
      }
      if (exact.some(dependency => dependency.kind.startsWith('tracked'))) blockReasons.push('tracked-file');
      if (exact.some(dependency => dependency.kind.startsWith('local-preview'))) blockReasons.push('local-runtime-preview');
      referencedBy.push(...exact);
      const publicRoot = snapshot.protectedDependencies.find(dependency => dependency.kind === 'public-asset-root' && inside(dependency.path, file));
      let mirror;
      if (publicRoot) {
        mirror = snapshot.pieces.filter(piece => piece.repoRoot === publicRoot.repoRoot).map(piece => remotePreview(piece.slug, piece.preview)).filter(Boolean)
          .find(preview => [path.join(publicRoot.path, 'models/previews', preview.slug, 'preview.glb'),
            path.join(publicRoot.path, 'models/previews', preview.slug, preview.filename)].includes(file));
        if (candidate.assetRole !== 'derivative-web-preview' || !mirror) blockReasons.push('public-site-asset');
      }
      const pieceIds = Array.isArray(candidate.pieces) ? candidate.pieces.map(piece => typeof piece === 'string' ? piece : piece.slug) : [];
      if (!pieceIds.length) blockReasons.push('piece-association-required');
      for (const slug of pieceIds) {
        const matching = snapshot.pieces.filter(piece => piece.slug === slug);
        if (!matching.length) { blockReasons.push(`unknown-piece:${slug}`); continue; }
        for (const piece of matching) {
          if (piece.localPath) {
            if (!await exists(piece.localPath)) blockReasons.push(`missing-local-preview:${slug}`);
            else {
              const local = await stat(piece.localPath);
              if (!local.isFile() || local.size !== piece.preview.bytes || local.size <= 0) blockReasons.push(`invalid-local-preview:${slug}`);
            }
          }
          if (piece.repoRoot !== snapshot.repoRoot || piece.hidden) continue;
          const remote = remotePreview(slug, piece.preview);
          if (remote && !liveProofFor(remote, liveProofs, now, verificationMaxAgeMs)) blockReasons.push(`live-preview-not-verified:${slug}`);
        }
      }
      const before = await stat(file), currentBytes = before.size, currentHash = await sha256(file), after = await stat(file);
      const sameFile = (left, right) => ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'].every(key => left[key] === right[key]);
      if (!sameFile(before, after)) blockReasons.push('local-content-changed-during-read');
      if (currentBytes !== candidate.bytes || currentHash !== candidate.sha256) blockReasons.push('local-content-changed');
      const receipt = verifiedBackups.find(proof => proof.candidateId === candidate.candidateId
        && proof.sha256 === currentHash && proof.bytes === currentBytes && proof.method === 'full-download-sha256'
        && proof.private === true && proof.complete === true && fresh(proof.verifiedAt, now, verificationMaxAgeMs));
      if (!receipt) blockReasons.push('backup-full-byte-verification-required');
      if (mirror) {
        const proof = liveProofFor(mirror, liveProofs, now, verificationMaxAgeMs);
        if (!proof || proof.sha256 !== currentHash || proof.bytes !== currentBytes) blockReasons.push('r2-mirror-content-not-verified');
      }
      if (!blockReasons.length) {
        const handles = typeof openFileCheck === 'function' ? await openFileCheck(file) : null;
        if (handles?.checked !== true || handles?.open !== false) blockReasons.push('open-file-check-unavailable-or-in-use');
        if (!sameFile(after, await stat(file))) blockReasons.push('local-content-changed-after-verification');
      }
      result.contentBinding = { sha256: currentHash, bytes: currentBytes, dev: after.dev, ino: after.ino,
        mtimeMs: after.mtimeMs, ctimeMs: after.ctimeMs };
    } catch (error) { blockReasons.push(`filesystem-audit-failed:${error.code || error.message}`); }
    result.blockReasons = [...new Set(blockReasons)];
    result.allowed = result.blockReasons.length === 0;
  }
  return { schema: 'atrium-storage-deletion-preflight/1', checkedAt: Number.isFinite(now) ? new Date(now).toISOString() : null,
    results, allowed: results.filter(row => row.allowed), blocked: results.filter(row => !row.allowed),
    protectedDependencies: snapshot?.protectedDependencies || [], remoteRequirements: snapshot?.remoteRequirements || [], errors };
}
