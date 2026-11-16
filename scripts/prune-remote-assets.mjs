#!/usr/bin/env node
// Remove local mirrors of models already served from R2. New acquisitions can
// still use local URLs. Keep the Pages copies listed for the Stage 2 switch.
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import retainedAssets from '../src/data/pages-cdn-assets.json' with { type: 'json' };

const previews = JSON.parse(await readFile('src/data/previews.json', 'utf8'));
const dist = path.resolve('dist');
const root = path.join(dist, 'models/previews');
const retainedPreviewDirs = new Set(Object.keys(retainedAssets)
  .filter(pathname => pathname.startsWith('/models/previews/'))
  .map(pathname => path.dirname(pathname)));
let remoteCount = 0;
for (const [slug, preview] of Object.entries(previews)) {
  if (typeof preview.url !== 'string'
    || !preview.url.startsWith(`https://models.atrium.earth/models/previews/${slug}/`)
    || !/^preview(?:-[a-f0-9]+)?\.glb$/.test(preview.url.split('/').at(-1))) continue;
  const target = path.resolve(root, slug);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Invalid model slug: ${slug}`);
  const relative = `/models/previews/${slug}`;
  if (retainedPreviewDirs.has(relative)) continue;
  await rm(target, { recursive: true, force: true });
  remoteCount += 1;
}
console.log(`Excluded mirrors of ${remoteCount} R2 models; retained locally served previews.`);

let retainedBytes = 0;
for (const [pathname, asset] of Object.entries(retainedAssets)) {
  const filename = path.resolve(dist, `.${pathname}`);
  if (!pathname.startsWith('/') || !filename.startsWith(`${dist}${path.sep}`)) {
    throw new Error(`Invalid retained asset path: ${pathname}`);
  }
  const copy = await readFile(filename);
  const hash = createHash('sha256').update(copy).digest('hex');
  if (copy.length !== asset.bytes || hash !== asset.sha256) throw new Error(`Retained Pages copy changed: ${pathname}`);
  retainedBytes += copy.length;
}
console.log(`Verified ${Object.keys(retainedAssets).length.toLocaleString('en')} retained Pages copies (${retainedBytes.toLocaleString('en')} bytes).`);
