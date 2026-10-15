import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { canonical, digest, fail, assertBlob, verifyReceipt, writePrivateJson } from './storage-verify-backup.mjs';

const exec = promisify(execFile);
export const ROLES = new Set(['provider-original', 'source-archive', 'source-sidecar', 'license', 'provenance', 'derivative-web-preview', 'derivative-other', 'unknown']);
export function logicalPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.includes('\\') || path.posix.isAbsolute(value) || /^[a-z]:/i.test(value) || value.split('/').some(x => !x || x === '.' || x === '..')) fail('Unsafe source-relative logical path');
  return value;
}
export function fileId(rootId, relativePath) { return 'file-' + digest(rootId + '\0' + logicalPath(relativePath)); }
export function manifestHash(manifest) { return digest(canonical(manifest)); }
function fingerprint(stat) {
  return { device: String(stat.dev), inode: String(stat.ino), bytes: Number(stat.size), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs) };
}
export function sameFile(a, b) { return canonical(a) === canonical(b); }
export async function resolveSourcePath(sourceRoots, sourceRootId, relativePath, { missing = false } = {}) {
  logicalPath(relativePath);
  const root = sourceRoots.find(x => x.id === sourceRootId);
  if (!root || !path.isAbsolute(root.absolutePath)) fail('Unknown source root');
  const base = path.resolve(root.absolutePath);
  if (await fs.realpath(base) !== base || !(await fs.lstat(base)).isDirectory()) fail('Source root is an alias or not a directory');
  let current = base;
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment);
    try { if ((await fs.lstat(current)).isSymbolicLink()) fail('Source path contains a symlink'); }
    catch (error) { if (missing && error.code === 'ENOENT') break; throw error; }
  }
  return path.join(base, ...relativePath.split('/'));
}
export async function hashFile(filename, { chunkBytes = 100 * 1024 * 1024 } = {}) {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) fail('Invalid chunk size');
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size > BigInt(Number.MAX_SAFE_INTEGER)) fail('Source is not a supported regular file');
    const full = crypto.createHash('sha256');
    let chunk = crypto.createHash('sha256'), chunkLength = 0, offset = 0;
    const chunks = [];
    const buffer = Buffer.allocUnsafe(Math.min(chunkBytes, 1024 * 1024));
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, chunkBytes - chunkLength), null);
      if (!bytesRead) break;
      const bytes = buffer.subarray(0, bytesRead);
      full.update(bytes); chunk.update(bytes); chunkLength += bytesRead;
      if (chunkLength === chunkBytes) {
        chunks.push({ order: chunks.length, offset, bytes: chunkLength, sha256: chunk.digest('hex') });
        offset += chunkLength; chunkLength = 0; chunk = crypto.createHash('sha256');
      }
    }
    if (chunkLength || !chunks.length) chunks.push({ order: chunks.length, offset, bytes: chunkLength, sha256: chunk.digest('hex') });
    const after = await handle.stat({ bigint: true });
    if (!sameFile(fingerprint(before), fingerprint(after))) fail('File changed while hashing');
    return { sha256: full.digest('hex'), bytes: Number(after.size), localObservation: fingerprint(after), chunks };
  } finally { await handle.close(); }
}
function words(line) { return (line.match(/"[^"]*"|'[^']*'|[^\s]+/g) || []).map(x => /^["']/.test(x) ? x.slice(1, -1) : x); }
async function glbJson(filename) {
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const header = Buffer.alloc(20);
    if ((await handle.read(header, 0, 20, 0)).bytesRead !== 20 || header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2 || header.toString('ascii', 16, 20) !== 'JSON') fail('Invalid GLB header');
    if (header.readUInt32LE(8) !== Number((await handle.stat()).size)) fail('Partial GLB container');
    const length = header.readUInt32LE(12);
    if (length > 64 * 1024 * 1024 || length + 20 > header.readUInt32LE(8)) fail('Invalid GLB JSON length');
    const json = Buffer.alloc(length);
    if ((await handle.read(json, 0, length, 20)).bytesRead !== length) fail('Partial GLB JSON');
    return JSON.parse(json.toString('utf8'));
  } finally { await handle.close(); }
}
export async function sourceDependencies(filename, relativePath) {
  const extension = path.extname(filename).toLowerCase();
  const uris = [], errors = [];
  try {
    if (['.gltf', '.glb'].includes(extension)) {
      const g = extension === '.glb' ? await glbJson(filename) : JSON.parse(await fs.readFile(filename, 'utf8'));
      for (const item of [...g.buffers || [], ...g.images || []]) if (item.uri && !item.uri.startsWith('data:')) uris.push(item.uri);
    } else if (['.obj', '.mtl'].includes(extension)) {
      if ((await fs.stat(filename)).size > 128 * 1024 * 1024) fail('Text dependency inspection exceeds safe memory budget');
      for (const line of (await fs.readFile(filename, 'utf8')).split(/\r?\n/)) {
        const tokens = words(line.trim());
        const kind = tokens.shift()?.toLowerCase();
        if (extension === '.obj' && kind === 'mtllib') uris.push(...tokens);
        if (extension === '.mtl' && (kind?.startsWith('map_') || ['bump', 'disp', 'decal', 'norm', 'refl'].includes(kind))) {
          while (tokens[0]?.startsWith('-')) {
            const option = tokens.shift().toLowerCase();
            const fixed = { '-mm': 2, '-bm': 1, '-boost': 1, '-texres': 1, '-clamp': 1, '-blendu': 1, '-blendv': 1, '-imfchan': 1, '-type': 1, '-colorspace': 1 };
            if (['-o', '-s', '-t'].includes(option)) { let n = 0; while (n < 3 && /^-?(?:\d+\.?\d*|\.\d+)$/.test(tokens[0] || '')) { tokens.shift(); n++; } if (!n) fail('Unresolved MTL option'); }
            else if (fixed[option]) { if (tokens.length < fixed[option] + 1) fail('Incomplete MTL option'); tokens.splice(0, fixed[option]); }
            else fail('Unknown MTL dependency option');
          }
          if (!tokens.length) fail('Missing MTL texture path');
          uris.push(tokens.join(' '));
        }
      }
    } else if (extension === '.ply') {
      const h = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { const bytes = Buffer.alloc(1024 * 1024); const { bytesRead } = await h.read(bytes, 0, bytes.length, 0); const header = bytes.subarray(0, bytesRead).toString('utf8').split('end_header')[0]; for (const line of header.split(/\r?\n/)) { const match = line.match(/^comment\s+TextureFile\s+(.+)$/i); if (match) uris.push(match[1]); } } finally { await h.close(); }
    } else if (['.fbx', '.blend', '.dae', '.usd', '.usda', '.usdc'].includes(extension)) {
      errors.push('Compound format needs explicit external-dependency review');
    }
  } catch { errors.push('Source/container dependency inspection failed'); }
  const dependencies = [];
  for (const uri of uris) {
    try {
      if (/^[a-z][a-z0-9+.-]*:/i.test(uri) || uri.startsWith('/') || uri.includes('\\')) fail('External dependency is not a portable local file');
      const decoded = decodeURIComponent(uri.split(/[?#]/)[0]);
      const joined = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), decoded));
      dependencies.push(logicalPath(joined));
    } catch { errors.push('External dependency escapes its source root or uses a remote URI'); }
  }
  return { dependencies: [...new Set(dependencies)], errors };
}
export async function inventorySources(config) {
  if (!Array.isArray(config.sourceRoots) || !config.sourceRoots.length) fail('Inventory needs explicit source roots');
  const rootIds = new Set();
  for (const root of config.sourceRoots) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(root.id) || rootIds.has(root.id)) fail('Invalid or duplicate source root ID');
    rootIds.add(root.id);
    if (await fs.realpath(root.absolutePath) !== path.resolve(root.absolutePath)) fail('Source root contains a symlink');
  }
  const pieces = config.pieces || config.bindings || [];
  const binding = new Map(), locations = new Map(), groups = new Map(), errors = [];
  for (const piece of pieces) {
    if (!piece.slug || !Array.isArray(piece.assets)) fail('Each piece needs a slug and explicit assets');
    for (const asset of piece.assets) {
      const id = fileId(asset.sourceRootId, asset.relativePath);
      const aliases = { 'derivative-thumbnail': 'derivative-other', 'derivative-poster': 'derivative-other', 'license-provenance-metadata': 'provenance', 'catalog-release-metadata': 'provenance' };
      const role = ROLES.has(asset.assetRole) ? asset.assetRole : aliases[asset.assetRole] || 'unknown';
      locations.set(id, { sourceRootId: asset.sourceRootId, relativePath: asset.relativePath, sourceAssetRole: asset.assetRole });
      const groupId = asset.dependencyGroupId || (role.startsWith('derivative-') ? id : 'piece:' + piece.slug);
      const item = binding.get(id) || { pieces: [], roles: [], groups: [], batches: [] };
      item.pieces.push(piece.slug); item.roles.push(role); item.groups.push(groupId); if (piece.batch) item.batches.push(piece.batch);
      binding.set(id, item);
      const group = groups.get(groupId) || { id: groupId, fileIds: [], complete: true, errors: [] };
      group.fileIds.push(id);
      if (piece.missingOriginals?.length || asset.dependencyErrors?.length) { group.complete = false; group.errors.push('Piece has missing originals or unresolved source evidence'); }
      groups.set(groupId, group);
    }
  }
  const files = [], byId = new Map();
  for (const root of config.sourceRoots) {
    const visited = new Set();
    async function visit(relativePath) {
        const candidateId = fileId(root.id, relativePath);
        if (visited.has(candidateId)) return;
        visited.add(candidateId);
        if (relativePath.split('/').includes('.git') || /(?:^|\/)(?:\.env(?:\.[^/]*)?|credentials|[^/]*\.key)$/.test(relativePath)) {
          errors.push({ sourceRootId: root.id, relativePath, reason: 'Private control or credential path excluded' }); return;
        }
        const associated = binding.get(candidateId);
        try {
          const absolutePath = await resolveSourcePath(config.sourceRoots, root.id, relativePath);
          const data = await hashFile(absolutePath, { chunkBytes: config.chunkBytes || 100 * 1024 * 1024 });
          const dependency = await sourceDependencies(absolutePath, relativePath);
          const roles = [...new Set(associated?.roles || ['unknown'])];
          const file = { candidateId, sourceRootId: root.id, relativePath, ...data, assetRole: roles.length === 1 && ROLES.has(roles[0]) ? roles[0] : 'unknown',
            ...(locations.get(candidateId) ? { sourceAssetRole: locations.get(candidateId).sourceAssetRole } : {}),
            pieces: [...new Set(associated?.pieces || [])], batch: [...new Set(associated?.batches || [])],
            dependencyGroupIds: [...new Set(associated?.groups || [candidateId])],
            dependencies: dependency.dependencies.map(p => ({ sourceRootId: root.id, relativePath: p })), dependencyErrors: dependency.errors };
          files.push(file); byId.set(candidateId, file);
          for (const groupId of file.dependencyGroupIds) {
            const group = groups.get(groupId) || { id: groupId, fileIds: [], complete: true, errors: [] };
            group.fileIds.push(candidateId); groups.set(groupId, group);
          }
          for (const dependency of file.dependencies) await visit(dependency.relativePath);
        } catch { errors.push({ sourceRootId: root.id, relativePath, reason: 'File unstable or unreadable; no complete hash recorded' }); }
    }
    async function walk(directory, prefix = '') {
      for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const relativePath = prefix + entry.name;
        if (entry.name === '.git' || entry.name.startsWith('.atrium-storage-quarantine-')) continue;
        if (root.excludeRelativePaths?.some(x => relativePath === x || relativePath.startsWith(x + '/'))) continue;
        if (entry.isDirectory()) await walk(path.join(directory, entry.name), relativePath + '/');
        else await visit(relativePath);
      }
    }
    if (config.scanRoots === true) await walk(root.absolutePath);
    else for (const target of locations.values()) if (target.sourceRootId === root.id) await visit(target.relativePath);
  }
  // Resolve transitive dependencies into every owning bundle, including shared textures.
  for (const file of files) {
    const todo = [file], seen = new Set();
    while (todo.length) {
      const next = todo.pop();
      if (seen.has(next.candidateId)) continue;
      seen.add(next.candidateId);
      for (const groupId of file.dependencyGroupIds) {
        const group = groups.get(groupId); group.fileIds.push(next.candidateId);
        if (next.dependencyErrors.length) { group.complete = false; group.errors.push(...next.dependencyErrors); }
      }
      for (const dependency of next.dependencies) {
        const target = byId.get(fileId(dependency.sourceRootId, dependency.relativePath));
        if (!target) {
          for (const groupId of file.dependencyGroupIds) { const group = groups.get(groupId); group.complete = false; group.errors.push('Missing dependency: ' + dependency.relativePath); }
        } else {
          if (target.assetRole === 'unknown') target.assetRole = 'source-sidecar';
          target.pieces = [...new Set([...target.pieces, ...file.pieces])];
          target.dependencyGroupIds = [...new Set([...target.dependencyGroupIds, ...file.dependencyGroupIds])];
          todo.push(target);
        }
      }
    }
  }
  for (const [id, item] of binding) if (!byId.has(id)) for (const groupId of item.groups) { const group = groups.get(groupId); group.complete = false; group.errors.push('Bound source file is missing or unreadable'); }
  const blobs = new Map();
  for (const file of files) {
    const blob = blobs.get(file.sha256) || { sha256: file.sha256, bytes: file.bytes, fileIds: [] };
    if (blob.bytes !== file.bytes) fail('Hash collision or inconsistent byte count');
    blob.fileIds.push(file.candidateId); blobs.set(file.sha256, blob);
  }
  for (const group of groups.values()) { group.fileIds = [...new Set(group.fileIds)].sort(); group.errors = [...new Set(group.errors)]; }
  return { schema: 'atrium-storage-manifest/1', generatedAt: new Date().toISOString(),
    sourceRoots: config.sourceRoots.map(r => ({ id: r.id, label: r.label || r.id })),
    pieces: pieces.map(p => ({ slug: p.slug, identity: structuredClone(p.identity || {}), batch: p.batch || null, public: p.public !== false, assets: structuredClone(p.assets), remoteAssets: structuredClone(p.remoteAssets || []), missingOriginals: structuredClone(p.missingOriginals || []) })),
    files, blobs: [...blobs.values()], requiredBlobs: structuredClone(config.requiredBlobs || []), dependencyGroups: [...groups.values()], errors,
    summary: { files: files.length, logicalBytes: files.reduce((n, f) => n + f.bytes, 0), uniqueBlobs: blobs.size, uniqueBytes: [...blobs.values()].reduce((n, b) => n + b.bytes, 0), pieceBindings: pieces.length } };
}
export async function noOpenFiles(filename) {
  try {
    const result = await exec('lsof', ['-nP', '-Fpn', '--', filename], { maxBuffer: 2 * 1024 * 1024 });
    return { checked: true, open: Boolean(result.stdout.trim()), reason: 'lsof' };
  } catch (error) {
    if (error.code === 1 && !error.stdout && !error.stderr) return { checked: true, open: false, reason: 'lsof' };
    return { checked: false, open: true, reason: 'Open-handle inspection unavailable or incomplete' };
  }
}
export async function localLocks(filename, rootPath) {
  let current = path.dirname(filename);
  while (true) {
    for (const name of await fs.readdir(current)) if (name.endsWith('.lock') || name.endsWith('.part') || name.endsWith('.partial') || name === 'gc.pid') return true;
    if (current === rootPath) break;
    const parent = path.dirname(current);
    if (parent === current || !current.startsWith(rootPath + path.sep)) fail('Invalid lock inspection root');
    current = parent;
  }
  return false;
}
export async function createCleanupPlan({ repoRoot, sourceRoots, manifest, receipts, key, whitelist, liveProofs = [], auditDependencies, openFileCheck = noOpenFiles, now = Date.now(), maxAgeMs = 24 * 60 * 60 * 1000 }) {
  if (manifest.schema !== 'atrium-storage-manifest/1' || !Array.isArray(manifest.files) || !Array.isArray(manifest.dependencyGroups)) fail('Invalid portable source manifest');
  if (!whitelist || whitelist.schema !== 'atrium-storage-removal-whitelist/1' || whitelist.manifestSha256 !== manifestHash(manifest) || !Array.isArray(whitelist.files)) fail('An explicit per-file whitelist bound to this exact manifest is required');
  if (typeof auditDependencies !== 'function') fail('Live dependency audit is required');
  const files = new Map(manifest.files.map(f => [f.candidateId, f]));
  if (files.size !== manifest.files.length || new Set(whitelist.files.map(f => f.candidateId)).size !== whitelist.files.length) fail('Duplicate file IDs in manifest or whitelist');
  for (const file of manifest.files) {
    if (file.candidateId !== fileId(file.sourceRootId, file.relativePath) || !/^file-[a-f0-9]{64}$/.test(file.candidateId)) fail('Manifest candidate ID is not bound to its source-relative path');
  }
  const backup = new Map();
  for (const receipt of receipts || []) {
    const p = verifyReceipt(receipt, key, { now, maxAgeMs: Infinity });
    if (now - Date.parse(p.verifiedAt) <= maxAgeMs) backup.set(p.blob.sha256, p);
  }
  const globalReasons = [];
  if (!Array.isArray(manifest.requiredBlobs) || !manifest.requiredBlobs.some(b => b.assetRole === 'restore-manifest')) globalReasons.push('No immutable recovery-manifest dependency is registered');
  for (const required of manifest.requiredBlobs || []) {
    assertBlob(required);
    if (!backup.has(required.sha256) || backup.get(required.sha256).blob.bytes !== required.bytes) globalReasons.push('Required recovery-map or metadata blob lacks fresh signed full-content verification');
  }
  const observations = new Map();
  async function observe(file, allowMissing = false) {
    if (!observations.has(file.candidateId)) observations.set(file.candidateId, (async () => {
      const absolutePath = await resolveSourcePath(sourceRoots, file.sourceRootId, file.relativePath, { missing: allowMissing });
      try { const hash = await hashFile(absolutePath); if (hash.sha256 !== file.sha256 || hash.bytes !== file.bytes || !sameFile(hash.localObservation, file.localObservation)) fail('Current source differs from its inventory'); return { absolutePath, ...hash }; }
      catch (error) { if (allowMissing && error.code === 'ENOENT') return { missing: true, absolutePath }; throw error; }
    })());
    return observations.get(file.candidateId);
  }
  const candidates = [], blocked = [];
  for (const requested of whitelist.files) {
    const file = files.get(requested.candidateId), reasons = [...globalReasons];
    if (!file || requested.sourceRootId !== file.sourceRootId || requested.relativePath !== file.relativePath || requested.sha256 !== file.sha256 || requested.bytes !== file.bytes) { blocked.push({ candidateId: requested.candidateId, allowed: false, blockReasons: ['Whitelist does not exactly match this inventory file'] }); continue; }
    if (!ROLES.has(file.assetRole) || file.assetRole === 'unknown') reasons.push('Asset role is unverified');
    if (!backup.has(file.sha256) || backup.get(file.sha256).blob.bytes !== file.bytes) reasons.push('No fresh signed complete-content remote backup');
    let current;
    try {
      current = await observe(file);
      const root = sourceRoots.find(r => r.id === file.sourceRootId);
      if (await localLocks(current.absolutePath, root.absolutePath)) reasons.push('Active or partial-transfer lock detected');
    } catch { reasons.push('Current file missing, aliased, unstable or changed'); }
    if (!file.dependencyGroupIds?.length || file.dependencyErrors?.length) reasons.push('Unresolved source dependencies');
    for (const id of file.dependencyGroupIds || []) {
      const group = manifest.dependencyGroups.find(g => g.id === id);
      if (!group?.complete || !group.fileIds?.includes(file.candidateId)) { reasons.push('Dependency group is incomplete'); continue; }
      for (const memberId of group.fileIds) {
        const member = files.get(memberId);
        if (!member || !backup.has(member.sha256) || backup.get(member.sha256).blob.bytes !== member.bytes) { reasons.push('A bundle member lacks verified remote content'); continue; }
        try { await observe(member, true); } catch { reasons.push('A bundle member changed or is unsafe'); }
      }
    }
    if (reasons.length) { blocked.push({ candidateId: file.candidateId, allowed: false, blockReasons: [...new Set(reasons)] }); continue; }
    candidates.push({ ...file, absolutePath: current.absolutePath, dependenciesVerified: true });
  }
  const verifiedBackups = candidates.map(f => ({ candidateId: f.candidateId, sha256: f.sha256, bytes: f.bytes, verifiedAt: backup.get(f.sha256).verifiedAt, method: 'full-download-sha256', private: true, complete: true }));
  const dependencies = await auditDependencies({ repoRoot, sourceRoots, candidates, verifiedBackups, liveProofs, now, verificationMaxAgeMs: maxAgeMs, openFileCheck });
  if (!dependencies || !Array.isArray(dependencies.results) || dependencies.errors?.length) fail('Live dependency audit failed closed');
  const decisions = new Map(dependencies.results.map(r => [r.candidateId, r]));
  for (const candidate of candidates) if (!decisions.has(candidate.candidateId)) blocked.push({ candidateId: candidate.candidateId, allowed: false, blockReasons: ['Live dependency audit omitted this file'] });
  const allowed = candidates.filter(f => decisions.get(f.candidateId)?.allowed === true);
  return { schema: 'atrium-storage-cleanup-plan/1', generatedAt: new Date(now).toISOString(), dryRun: true, manifestSha256: manifestHash(manifest),
    allowed: allowed.map(f => ({ ...f, offlineRestoreRequired: decisions.get(f.candidateId).offlineRestoreRequired })),
    blocked: [...blocked, ...dependencies.results.filter(r => !r.allowed)], dependencies, bytesEligible: allowed.reduce((n, f) => n + f.bytes, 0) };
}
export async function executeCleanup(options) {
  options = { ...options, openFileCheck: options.openFileCheck || noOpenFiles };
  // Rebuild the entire plan immediately before any mutation; a saved dry run is never authority.
  const plan = await createCleanupPlan(options);
  if (plan.blocked.length) fail('Cleanup batch contains blocked files; no files moved or removed');
  if (!options.journalPath || !options.quarantineRoot) fail('Apply needs a private journal and same-filesystem quarantine directory');
  const journal = { schema: 'atrium-storage-deletion-journal/1', manifestSha256: plan.manifestSha256, startedAt: new Date().toISOString(), files: [] };
  await writePrivateJson(options.journalPath, journal, options.repoRoot);
  const quarantine = path.join(options.quarantineRoot, '.atrium-storage-quarantine-' + crypto.randomUUID());
  await fs.mkdir(quarantine, { recursive: false, mode: 0o700 });
  if (await fs.realpath(quarantine) !== quarantine) fail('Quarantine directory is aliased');
  for (const candidate of plan.allowed) {
    const target = path.resolve(quarantine, candidate.candidateId);
    if (path.dirname(target) !== quarantine) fail('Quarantine target escaped its private directory');
    try { await fs.lstat(target); fail('Quarantine target already exists; never overwrite it'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const row = { candidateId: candidate.candidateId, originalPath: candidate.absolutePath, quarantinedPath: target, state: 'planned' };
    journal.files.push(row);
    try {
      const resolved = await resolveSourcePath(options.sourceRoots, candidate.sourceRootId, candidate.relativePath);
      const current = await hashFile(resolved);
      if (current.sha256 !== candidate.sha256 || current.bytes !== candidate.bytes || !sameFile(current.localObservation, candidate.localObservation)) fail('Source changed after planning');
      const sourceHandles = await options.openFileCheck(resolved);
      if (sourceHandles.checked !== true || sourceHandles.open !== false) fail('Source has unknown or active handles');
      row.state = 'moving'; await writePrivateJson(options.journalPath, journal, options.repoRoot);
      await fs.rename(resolved, row.quarantinedPath);
      row.state = 'quarantined'; await writePrivateJson(options.journalPath, journal, options.repoRoot);
      const captured = await hashFile(row.quarantinedPath);
      // rename changes ctime but must retain identity, data, size and modification time.
      const prior = candidate.localObservation, actual = captured.localObservation;
      if (captured.sha256 !== candidate.sha256 || captured.bytes !== candidate.bytes || actual.device !== prior.device || actual.inode !== prior.inode || actual.mtimeNs !== prior.mtimeNs) fail('Captured file does not match the verified source');
      const handles = await options.openFileCheck(row.quarantinedPath);
      if (handles.checked !== true || handles.open !== false) fail('Quarantined file has unknown or active handles');
      const last = fingerprint(await fs.lstat(row.quarantinedPath, { bigint: true }));
      if (!sameFile(last, captured.localObservation)) fail('Captured file changed before removal');
      await fs.unlink(row.quarantinedPath);
      row.state = 'removed'; row.removedAt = new Date().toISOString();
      await writePrivateJson(options.journalPath, journal, options.repoRoot);
    } catch {
      // Never overwrite a new file at the original path during rollback.
      try { await fs.link(row.quarantinedPath, row.originalPath); await fs.unlink(row.quarantinedPath); row.state = 'restored-after-block'; }
      catch { row.state = row.state === 'quarantined' ? 'retained-in-quarantine' : 'blocked'; }
      await writePrivateJson(options.journalPath, journal, options.repoRoot);
      fail('Cleanup stopped safely; inspect the private journal before retrying');
    }
  }
  journal.completedAt = new Date().toISOString();
  await writePrivateJson(options.journalPath, journal, options.repoRoot);
  return journal;
}
