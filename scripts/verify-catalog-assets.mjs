import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalog.json'), 'utf8'));

const seen = new Set();
const problems = [];

for (const work of catalog) {
  const slug = String(work.slug || '').replace(/^\/|\/$/g, '');
  const previewPath = path.join(root, 'public/models/previews', slug, 'preview.glb');
  const thumbPath = path.join(root, 'public/previews/renders', slug, 'thumb.webp');
  const duplicate = seen.has(slug);
  seen.add(slug);

  const row = {
    slug,
    title: work.title || '',
    material: work.material || '',
    previewExists: fs.existsSync(previewPath),
    thumbExists: fs.existsSync(thumbPath),
    duplicate,
    previewPath,
    thumbPath,
  };

  if (duplicate || !row.previewExists || !row.thumbExists) problems.push(row);
}

console.log(`catalogCount=${catalog.length}`);
if (problems.length) console.table(problems);
else console.log('All catalog slugs have preview.glb, thumb.webp, and unique slugs.');
