import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalog.json'), 'utf8'));
const previews = JSON.parse(fs.readFileSync(path.join(root, 'src/data/previews.json'), 'utf8'));

const seen = new Set();
const problems = [];

for (const work of catalog) {
  const slug = String(work.slug || '').replace(/^\/|\/$/g, '');
  const previewPath = path.join(root, 'public/models/previews', slug, 'preview.glb');
  const thumbPath = path.join(root, 'public/previews/renders', slug, 'thumb.webp');
  const duplicate = seen.has(slug);
  const url = previews[slug]?.url;
  const remoteConfigured = typeof url === 'string'
    && url.startsWith(`https://models.atrium.earth/models/previews/${slug}/`)
    && /^preview(?:-[a-f0-9]+)?\.glb$/.test(url.split('/').at(-1));
  const localConfigured = url === `/models/previews/${slug}/preview.glb`;
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
