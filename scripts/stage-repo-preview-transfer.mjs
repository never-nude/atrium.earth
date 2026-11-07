// Stage byte-identical, already public serving previews from pinned Git blobs.
// This transfers delivery to the existing model host; it never offloads sources.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const SOURCE_REPOSITORY = 'https://github.com/never-nude/atrium.earth.git';
const STAGING_PATH = '.atrium-ingest/reviewed-preview-upload';
const MAX_MODEL_BYTES = 20_000_000;
const MAX_TOTAL_BYTES = 160_000_000;
const MAP_PATHS = ['src/data/previews.json', 'src/data/physical-dimensions.json', 'src/data/spatial-eligibility.json'];
const sha256 = body => createHash('sha256').update(body).digest('hex');
const check = (condition, message) => { if (!condition) throw new Error(message); };

export function validateRepoPreviewTransfer(input) {
  check(input?.schema === 'atrium-repo-preview-transfer/1', 'Invalid transfer schema');
  check(/^[a-f0-9]{40}$/.test(input.sourceCommit || ''), 'Invalid pinned source commit');
  check(Number.isSafeInteger(input.max_total_bytes) && input.max_total_bytes > 0 && input.max_total_bytes <= MAX_TOTAL_BYTES, 'Invalid aggregate byte budget');
  check(Array.isArray(input.models) && input.models.length > 0 && input.models.length <= 20, 'Invalid bounded model selection');
  const seen = new Set();
  let total = 0;
  for (const model of input.models) {
    check(/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(model?.slug || '') && !seen.has(model.slug), 'Invalid or duplicate slug');
    const prefix = `public/models/previews/${model.slug}/`;
    check(typeof model.sourcePath === 'string' && model.sourcePath.startsWith(prefix)
      && /^preview(?:-[a-f0-9]+)?\.glb$/.test(model.sourcePath.slice(prefix.length)), 'Invalid source path');
    check(model.currentUrl === `/${model.sourcePath.slice('public/'.length)}`, 'Current URL does not match source path');
    check(/^[a-f0-9]{40}$/.test(model.gitBlob || ''), 'Invalid pinned Git blob');
    check(/^[a-f0-9]{64}$/.test(model.sha256 || ''), 'Invalid pinned SHA-256');
    check(Number.isSafeInteger(model.bytes) && model.bytes >= 20 && model.bytes <= MAX_MODEL_BYTES, 'Invalid model byte budget');
    total += model.bytes;
    check(total <= input.max_total_bytes, 'Aggregate byte budget exceeded');
    seen.add(model.slug);
  }
  return { models: input.models, totalBytes: total };
}

function containsUrl(value, url) {
  if (value === url) return true;
  return value && typeof value === 'object' && Object.values(value).some(child => containsUrl(child, url));
}

async function absent(file) {
  try { await fs.lstat(file); return false; } catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}

export async function stageRepoPreviewTransfer({ repoRoot = process.cwd(), manifestPath = process.env.MANIFEST, allowFetch = true, verifyOnly = false } = {}) {
  check(/^docs\/ingest\/[a-z0-9-]+-repo-preview-transfer\.json$/.test(manifestPath || ''), 'Invalid manifest path');
  const root = await fs.realpath(repoRoot);
  async function readRegular(relative) {
    const file = path.join(root, relative);
    const stat = await fs.lstat(file).catch(() => null);
    check(stat?.isFile() && !stat.isSymbolicLink() && await fs.realpath(file) === file, `Required regular file is missing or unsafe: ${relative}`);
    return fs.readFile(file);
  }
  const manifestBody = await readRegular(manifestPath);
  const input = JSON.parse(manifestBody);
  const { models, totalBytes } = validateRepoPreviewTransfer(input);
  const destination = path.join(root, STAGING_PATH);
  check(await absent(destination), 'Staging destination already exists');
  const parent = path.dirname(destination);
  if (!await absent(parent)) {
    const stat = await fs.lstat(parent);
    check(stat.isDirectory() && !stat.isSymbolicLink() && await fs.realpath(parent) === parent, 'Unsafe staging parent');
  }
  function git(args, maxBuffer = 20_000_001) {
    try {
      return execFileSync('git', args, { cwd: root, maxBuffer, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    } catch { throw new Error(`Git ${args[0]} failed`); }
  }
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}']).toString().trim();
  let sourceExists = false;
  try { sourceExists = git(['cat-file', '-t', input.sourceCommit]).toString().trim() === 'commit'; } catch { /* Fetch only this immutable public commit when shallow checkout omits it. */ }
  if (!sourceExists && allowFetch) {
    git(['-c', 'credential.helper=', '-c', 'core.askPass=', '-c', 'http.extraHeader=', 'fetch', '--no-tags', '--no-write-fetch-head', '--filter=blob:none', '--depth=1', SOURCE_REPOSITORY, input.sourceCommit]);
    sourceExists = git(['cat-file', '-t', input.sourceCommit]).toString().trim() === 'commit';
  }
  check(sourceExists, 'Pinned source commit is unavailable or not a commit');
  function treeEntry(commit, sourcePath) {
    const entries = git(['ls-tree', '--full-tree', '-l', '-z', commit, '--', sourcePath]).toString().split('\0').filter(Boolean);
    check(entries.length === 1, `Missing exact Git path: ${sourcePath}`);
    const match = /^(100644|100755) blob ([a-f0-9]{40})\s+(\d+)\t(.+)$/.exec(entries[0]);
    check(match && match[4] === sourcePath, `Source is not a regular Git file: ${sourcePath}`);
    return { blob: match[2], bytes: Number(match[3]) };
  }
  const workingMaps = [];
  const committedMaps = [];
  for (const relative of MAP_PATHS) {
    workingMaps.push(JSON.parse(await readRegular(relative)));
    const entry = treeEntry(head, relative);
    committedMaps.push(JSON.parse(git(['cat-file', 'blob', entry.blob], 16_000_000)));
  }
  const staged = [];
  const selectedPreviews = Object.create(null);
  for (const model of models) {
    const current = committedMaps[0][model.slug];
    check(Object.hasOwn(committedMaps[0], model.slug) && current?.url === model.currentUrl && current.bytes === model.bytes, `Current HEAD preview record changed: ${model.slug}`);
    check(Object.hasOwn(workingMaps[0], model.slug) && isDeepStrictEqual(workingMaps[0][model.slug], current), `Working preview record changed: ${model.slug}`);
    for (let index = 1; index < MAP_PATHS.length; index++) {
      check(!containsUrl(committedMaps[index], model.currentUrl) && !containsUrl(workingMaps[index], model.currentUrl), `URL-bound dimension or spatial record requires deliberate rebind: ${model.slug}`);
    }
    for (const commit of [head, input.sourceCommit]) {
      const entry = treeEntry(commit, model.sourcePath);
      check(entry.blob === model.gitBlob && entry.bytes === model.bytes, `Pinned Git blob or bytes changed: ${model.slug}`);
    }
    const body = git(['cat-file', 'blob', model.gitBlob]);
    check(body.length === model.bytes && sha256(body) === model.sha256, `Complete SHA-256 or bytes mismatch: ${model.slug}`);
    check(body.toString('ascii', 0, 4) === 'glTF' && body.readUInt32LE(4) === 2 && body.readUInt32LE(8) === body.length, `Invalid GLB header: ${model.slug}`);
    if (!verifyOnly) staged.push({ model, body });
    selectedPreviews[model.slug] = current;
  }
  check(git(['rev-parse', '--verify', 'HEAD^{commit}']).toString().trim() === head, 'HEAD changed during preflight');
  const proof = {
    schema: input.schema,
    manifestSha256: sha256(manifestBody),
    sourceCommit: input.sourceCommit,
    currentCommit: head,
    purpose: 'byte-identical public serving transfer',
    mode: verifyOnly ? 'verify-only' : 'stage',
    noLocalOffload: true,
    totalBytes,
    models: models.map(({ slug, sourcePath, gitBlob, bytes, sha256, currentUrl }) => ({ slug, sourcePath, gitBlob, bytes, sha256, currentUrl })),
    status: 'pass',
  };
  if (verifyOnly) return proof;
  // No staging files are created until the complete bounded selection passes.
  await fs.mkdir(parent, { recursive: true });
  check(await fs.realpath(parent) === parent, 'Unsafe staging parent');
  const temporary = await fs.mkdtemp(path.join(parent, '.repo-preview-transfer-'));
  try {
    for (const { model, body } of staged) {
      const dir = path.join(temporary, 'models', model.slug);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'preview.glb'), body, { flag: 'wx' });
    }
    await fs.writeFile(path.join(temporary, 'slugs.txt'), models.map(model => model.slug).join('\n') + '\n', { flag: 'wx' });
    await fs.writeFile(path.join(temporary, 'previews.json'), JSON.stringify(selectedPreviews, null, 2) + '\n', { flag: 'wx' });
    await fs.writeFile(path.join(temporary, 'source-proof.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
    check(await absent(destination), 'Staging destination appeared during preflight');
    await fs.rename(temporary, destination);
    return proof;
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = process.argv.slice(2);
  Promise.resolve().then(() => {
    check(flags.every(flag => flag === '--verify-only'), 'Unknown command-line flag');
    return stageRepoPreviewTransfer({ verifyOnly: flags.includes('--verify-only') });
  }).then(proof => {
    console.log(`Verified ${proof.models.length} existing public previews (${proof.totalBytes} bytes; ${proof.mode}); source files remain in Git, no local offload.`);
  }).catch(error => {
    console.error(`Repo preview transfer failed: ${error.message}`);
    process.exitCode = 1;
  });
}
