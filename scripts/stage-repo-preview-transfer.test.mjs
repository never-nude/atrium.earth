import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { stageRepoPreviewTransfer, validateRepoPreviewTransfer } from './stage-repo-preview-transfer.mjs';

const hash = body => createHash('sha256').update(body).digest('hex');
const manifestPath = 'docs/ingest/test-repo-preview-transfer.json';
const stagingPath = '.atrium-ingest/reviewed-preview-upload';
function glb() {
  const body = Buffer.alloc(24);
  body.write('glTF'); body.writeUInt32LE(2, 4); body.writeUInt32LE(body.length, 8);
  body.writeUInt32LE(4, 12); body.writeUInt32LE(0x4e4f534a, 16); body.write('{}  ', 20);
  return body;
}

async function fixture(t, { count = 1, hashed = false, binding = null, invalidGlb = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atrium-preview-transfer-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '--quiet']);
  async function write(relative, body) {
    await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await fs.writeFile(path.join(root, relative), typeof body === 'object' && !Buffer.isBuffer(body) ? JSON.stringify(body) : body);
  }
  function commit() { git(['add', '.']); git(['-c', 'user.name=Transfer test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'fixture']); return git(['rev-parse', 'HEAD']); }
  const models = [];
  const previews = {};
  const body = glb();
  if (invalidGlb) body.write('nope');
  for (let index = 0; index < count; index++) {
    const slug = `test/work-${index}`;
    const sourcePath = `public/models/previews/${slug}/preview${hashed ? '-abcdef012345' : ''}.glb`;
    const currentUrl = `/${sourcePath.slice('public/'.length)}`;
    await write(sourcePath, body);
    previews[slug] = { url: currentUrl, bytes: body.length, triangles: 1234, preserved: { material: 'source' } };
    models.push({ slug, sourcePath, currentUrl, gitBlob: git(['hash-object', sourcePath]), bytes: body.length, sha256: hash(body) });
  }
  await write('src/data/previews.json', previews);
  await write('src/data/physical-dimensions.json', binding === 'dimensions' ? { unrelated: { nested: [{ url: models[0].currentUrl }] } } : {});
  await write('src/data/spatial-eligibility.json', binding === 'spatial' ? { unrelated: { nested: [{ url: models[0].currentUrl }] } } : {});
  const sourceCommit = commit();
  const manifest = { schema: 'atrium-repo-preview-transfer/1', sourceCommit, max_total_bytes: 160_000_000, models };
  const saveManifest = () => write(manifestPath, manifest);
  await saveManifest();
  return { root, git, write, commit, manifest, previews, body, saveManifest,
    run: (options = {}) => stageRepoPreviewTransfer({ repoRoot: root, manifestPath, allowFetch: false, ...options }),
    async noStaging() { await assert.rejects(fs.lstat(path.join(root, stagingPath)), { code: 'ENOENT' }); },
  };
}

test('valid pinned bytes stage canonically, retain metadata and leave Git sources unchanged', async t => {
  const f = await fixture(t, { count: 2, hashed: true });
  const before = f.git(['status', '--porcelain']);
  const proof = await f.run();
  assert.equal(proof.totalBytes, f.body.length * 2);
  assert.equal(proof.sourceCommit, f.manifest.sourceCommit);
  assert.equal(proof.currentCommit, f.manifest.sourceCommit);
  assert.equal(proof.noLocalOffload, true);
  assert.equal(proof.mode, 'stage');
  assert.equal(proof.status, 'pass');
  assert.equal(proof.manifestSha256, hash(await fs.readFile(path.join(f.root, manifestPath))));
  const output = path.join(f.root, stagingPath);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(output, 'previews.json'))), f.previews);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(output, 'source-proof.json'))), proof);
  assert.equal(await fs.readFile(path.join(output, 'slugs.txt'), 'utf8'), 'test/work-0\ntest/work-1\n');
  for (const model of f.manifest.models) {
    assert.deepEqual(await fs.readFile(path.join(output, 'models', model.slug, 'preview.glb')), f.body);
    assert.deepEqual(await fs.readFile(path.join(f.root, model.sourcePath)), f.body);
  }
  assert.equal(f.git(['diff', '--stat']), '');
  assert.ok(before.includes('docs/'));
});

test('verify-only checks the complete selection without writing staging or source files', async t => {
  const f = await fixture(t, { count: 2 });
  const before = f.git(['status', '--porcelain']);
  const proof = await f.run({ verifyOnly: true });
  assert.equal(proof.mode, 'verify-only');
  assert.equal(proof.totalBytes, f.body.length * 2);
  assert.equal(f.git(['status', '--porcelain']), before);
  await assert.rejects(fs.lstat(path.join(f.root, '.atrium-ingest')), { code: 'ENOENT' });
});

test('manifest rejects traversal, mismatched URLs, duplicate slugs and invalid pins', async t => {
  const f = await fixture(t);
  for (const mutate of [
    value => { value.models[0].slug = '../escape'; },
    value => { value.models[0].sourcePath = 'public/models/previews/test/work-0/../../escape.glb'; },
    value => { value.models[0].sourcePath = 'public/models/previews/test/work-0/other.glb'; },
    value => { value.models[0].currentUrl = 'https://other.invalid/model.glb'; },
    value => { value.models[0].gitBlob = '-invalid'; },
    value => { value.models[0].sha256 = 'a'.repeat(63); },
    value => { value.sourceCommit = 'HEAD'; },
    value => { value.models.push({ ...value.models[0] }); },
  ]) {
    const input = structuredClone(f.manifest); mutate(input);
    assert.throws(() => validateRepoPreviewTransfer(input));
  }
  await assert.rejects(f.run({ manifestPath: '../test-repo-preview-transfer.json' }), /manifest path/);
  await f.noStaging();
});

test('manifest enforces count, per-file and aggregate byte budgets', async t => {
  const f = await fixture(t);
  for (const mutate of [
    value => { value.models = []; },
    value => { value.models = Array.from({ length: 21 }, (_, index) => ({ ...value.models[0], slug: `test/${index}` })); },
    value => { value.max_total_bytes = 160_000_001; },
    value => { value.max_total_bytes = 1.5; },
    value => { value.models[0].bytes = 20_000_001; },
    value => { value.max_total_bytes = value.models[0].bytes - 1; },
  ]) {
    const input = structuredClone(f.manifest); mutate(input);
    assert.throws(() => validateRepoPreviewTransfer(input));
  }
});

test('rejects a stale current HEAD preview URL or byte count', async t => {
  for (const key of ['url', 'bytes']) {
    const f = await fixture(t);
    f.previews['test/work-0'][key] = key === 'url' ? '/changed.glb' : 25;
    await f.write('src/data/previews.json', f.previews); f.commit();
    await assert.rejects(f.run(), /Current HEAD preview record changed/);
    await f.noStaging();
  }
});

test('rejects uncommitted selected metadata changes and missing sparse binding maps', async t => {
  const f = await fixture(t);
  f.previews['test/work-0'].triangles++;
  await f.write('src/data/previews.json', f.previews);
  await assert.rejects(f.run(), /Working preview record changed/);
  await f.write('src/data/previews.json', { ...f.previews, 'test/work-0': { ...f.previews['test/work-0'], triangles: 1234 } });
  await fs.unlink(path.join(f.root, 'src/data/physical-dimensions.json'));
  await assert.rejects(f.run(), /Required regular file is missing or unsafe/);
  await f.noStaging();
});

for (const binding of ['dimensions', 'spatial']) {
  test(`rejects recursively nested ${binding} URL bindings, including another record`, async t => {
    const f = await fixture(t, { binding });
    await assert.rejects(f.run(), /requires deliberate rebind/);
    await f.noStaging();
  });
}

test('rejects newly added uncommitted spatial bindings', async t => {
  const f = await fixture(t);
  await f.write('src/data/spatial-eligibility.json', { nested: [{ modelUrl: f.manifest.models[0].currentUrl }] });
  await assert.rejects(f.run(), /requires deliberate rebind/);
  await f.noStaging();
});

test('rejects stale HEAD blob and a different blob at the pinned source commit', async t => {
  for (const repinCurrent of [false, true]) {
    const f = await fixture(t);
    const changed = Buffer.from(f.body); changed.write('{ } ', 20);
    await f.write(f.manifest.models[0].sourcePath, changed); f.commit();
    if (repinCurrent) {
      f.manifest.models[0].gitBlob = f.git(['hash-object', f.manifest.models[0].sourcePath]);
      f.manifest.models[0].sha256 = hash(changed); await f.saveManifest();
    }
    await assert.rejects(f.run(), /Pinned Git blob or bytes changed/);
    await f.noStaging();
  }
});

test('rejects a symlink source even if its target is a valid GLB', async t => {
  const f = await fixture(t);
  await fs.unlink(path.join(f.root, f.manifest.models[0].sourcePath));
  await fs.symlink('elsewhere.glb', path.join(f.root, f.manifest.models[0].sourcePath));
  f.commit();
  await assert.rejects(f.run(), /not a regular Git file/);
  await f.noStaging();
});

test('checks full SHA-256 and GLB header before creating any staging files', async t => {
  const badHash = await fixture(t, { count: 2 });
  badHash.manifest.models[1].sha256 = 'f'.repeat(64); await badHash.saveManifest();
  await assert.rejects(badHash.run(), /Complete SHA-256 or bytes mismatch/);
  await badHash.noStaging();
  await assert.rejects(fs.lstat(path.join(badHash.root, '.atrium-ingest')), { code: 'ENOENT' });
  const badGlb = await fixture(t, { invalidGlb: true });
  await assert.rejects(badGlb.run(), /Invalid GLB header/);
  await badGlb.noStaging();
});

test('rejects missing source commits without a network fetch when disabled', async t => {
  const f = await fixture(t);
  f.manifest.sourceCommit = 'f'.repeat(40); await f.saveManifest();
  await assert.rejects(f.run(), /Pinned source commit is unavailable/);
  await f.noStaging();
});

test('refuses existing staging destinations and symlinked parents or map files', async t => {
  const existing = await fixture(t);
  await existing.write(`${stagingPath}/keep.txt`, 'keep');
  await assert.rejects(existing.run(), /Staging destination already exists/);
  assert.equal(await fs.readFile(path.join(existing.root, stagingPath, 'keep.txt'), 'utf8'), 'keep');
  const linked = await fixture(t);
  await fs.mkdir(path.join(linked.root, 'outside'));
  await fs.symlink('outside', path.join(linked.root, '.atrium-ingest'));
  await assert.rejects(linked.run(), /Unsafe staging parent/);
  assert.deepEqual(await fs.readdir(path.join(linked.root, 'outside')), []);
  const map = await fixture(t);
  await map.write('elsewhere.json', {});
  await fs.unlink(path.join(map.root, 'src/data/spatial-eligibility.json'));
  await fs.symlink('../../elsewhere.json', path.join(map.root, 'src/data/spatial-eligibility.json'));
  await assert.rejects(map.run(), /Required regular file is missing or unsafe/);
  await map.noStaging();
});
