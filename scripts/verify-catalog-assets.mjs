import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { firstViewFor } from '../src/lib/first-view-models.mjs';

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalog.json'), 'utf8'));
const previews = JSON.parse(fs.readFileSync(path.join(root, 'src/data/previews.json'), 'utf8'));

const firstViews = JSON.parse(fs.readFileSync(path.join(root, 'src/data/first-view-models.json'), 'utf8'));
const seen = new Set();
const problems = [];

for (const work of catalog) {
  const slug = String(work.slug || '').replace(/^\/|\/$/g, '');
  const url = previews[slug]?.url;
  const localPrefix = `/models/previews/${slug}/`;
  const localConfigured = typeof url === 'string'
    && url.startsWith(localPrefix)
    && /^preview(?:-[a-f0-9]+)?\.glb$/.test(url.slice(localPrefix.length));
  const previewPath = localConfigured
    ? path.join(root, 'public', url)
    : path.join(root, 'public/models/previews', slug, 'preview.glb');
  const thumbPath = path.join(root, 'public/previews/renders', slug, 'thumb.webp');
  const duplicate = seen.has(slug);
  const remoteConfigured = typeof url === 'string'
    && url.startsWith(`https://models.atrium.earth/models/previews/${slug}/`)
    && /^preview(?:-[a-f0-9]+)?\.glb$/.test(url.split('/').at(-1));
  seen.add(slug);

  const row = {
    slug,
    title: work.title || '',
    material: work.material || '',
    previewExists: fs.existsSync(previewPath),
    remoteConfigured,
    thumbExists: fs.existsSync(thumbPath),
    duplicate,
    previewPath,
    thumbPath,
  };

  if (duplicate || !(remoteConfigured || (localConfigured && row.previewExists)) || !row.thumbExists) problems.push(row);
}

console.log(`catalogCount=${catalog.length}`);
if (problems.length) {
  console.table(problems);
  process.exitCode = 1;
} else {
  console.log('All catalog slugs have a local preview or configured R2 URL, a local thumbnail, and unique slugs. Remote availability is not checked by this command.');
}
const firstViewProblems = [];
let localFirstViews = 0;
let cdnFirstViews = 0;
for (const [slug, binding] of Object.entries(firstViews)) {
  const firstView = firstViewFor(slug, previews[slug], binding);
  if (!seen.has(slug) || !firstView) {
    firstViewProblems.push(`${slug}: invalid first-view binding`);
    continue;
  }
  if (!firstView.url.startsWith('/')) {
    cdnFirstViews++;
    continue;
  }
  try {
    const file = path.join(root, 'public', firstView.url);
    if (fs.statSync(file).size !== firstView.bytes) throw new Error('incorrect file size');
    const glb = fs.readFileSync(file);
    if (glb.toString('ascii', 0, 4) !== 'glTF' || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.length) {
      throw new Error('invalid GLB header');
    }
    if (createHash('sha256').update(glb).digest('hex') !== firstView.sha256) throw new Error('incorrect SHA-256');
    localFirstViews++;
  } catch (error) {
    firstViewProblems.push(`${slug}: ${error.message}`);
  }
}
if (firstViewProblems.length) {
  console.error(firstViewProblems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${Object.keys(firstViews).length} first-view bindings, including ${localFirstViews} local SHA-256 checks. ${cdnFirstViews} CDN first views have separate delivery checks.`);
}
