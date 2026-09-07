#!/usr/bin/env node
// Remove local mirrors of models already served from R2. New acquisitions can
// still use local URLs, so keep those files in the build until they are uploaded.
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const previews = JSON.parse(await readFile('src/data/previews.json', 'utf8'));
const root = path.resolve('dist/models/previews');
let remoteCount = 0;
for (const [slug, preview] of Object.entries(previews)) {
  if (typeof preview.url !== 'string'
    || !preview.url.startsWith(`https://models.atrium.earth/models/previews/${slug}/`)
    || !/^preview(?:-[a-f0-9]+)?\.glb$/.test(preview.url.split('/').at(-1))) continue;
  const target = path.resolve(root, slug);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Invalid model slug: ${slug}`);
  await rm(target, { recursive: true, force: true });
  remoteCount += 1;
}
console.log(`Excluded mirrors of ${remoteCount} R2 models; retained locally served previews.`);
