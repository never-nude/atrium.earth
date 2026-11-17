#!/usr/bin/env node
// Prune verified copies from dist. Source assets remain available for builds.
import { lstat, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import pagesAssets from '../src/data/pages-cdn-assets.json' with { type: 'json' };
import { matchesPagesAsset } from '../src/lib/pages-asset-digest.mjs';

const previews = JSON.parse(await readFile('src/data/previews.json', 'utf8'));
const dist = await realpath('dist');
const root = path.join(dist, 'models/previews');
const verifiedPreviewDirs = new Set(Object.keys(pagesAssets)
  .filter(pathname => pathname.startsWith('/models/previews/'))
  .map(pathname => path.dirname(pathname)));
const verifiedCopies = [];
let changedJpegs = 0;
for (const [pathname, asset] of Object.entries(pagesAssets)) {
  const filename = path.resolve(dist, `.${pathname}`);
  if (!pathname.startsWith('/') || !filename.startsWith(`${dist}${path.sep}`)) {
    throw new Error(`Invalid Pages asset path: ${pathname}`);
  }
  if (!(await lstat(filename)).isFile() || await realpath(filename) !== filename) {
    throw new Error(`Pages copy is not a regular file beneath dist: ${pathname}`);
  }
  const copy = await readFile(filename);
  if (!matchesPagesAsset(copy, asset)) {
    const slug = /^\/previews\/renders\/(.+)\/thumb\.jpg$/.exec(pathname)?.[1];
    if (!slug) throw new Error(`Pages model copy changed: ${pathname}`);
    console.warn(`Kept changed JPEG for ${slug}.`);
    changedJpegs += 1;
    continue;
  }
  verifiedCopies.push({ filename, bytes: asset.bytes });
}

let remoteCount = 0;
for (const [slug, preview] of Object.entries(previews)) {
  if (typeof preview.url !== 'string'
    || !preview.url.startsWith(`https://models.atrium.earth/models/previews/${slug}/`)
    || !/^preview(?:-[a-f0-9]+)?\.glb$/.test(preview.url.split('/').at(-1))) continue;
  const target = path.resolve(root, slug);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Invalid model slug: ${slug}`);
  const relative = `/models/previews/${slug}`;
  if (verifiedPreviewDirs.has(relative)) continue;
  await rm(target, { recursive: true, force: true });
  remoteCount += 1;
}
console.log(`Excluded mirrors of ${remoteCount} R2 models; retained locally served previews.`);

let removedBytes = 0;
for (const { filename, bytes } of verifiedCopies) {
  await rm(filename);
  removedBytes += bytes;
}
console.log(`Removed ${verifiedCopies.length.toLocaleString('en')} verified Pages copies (${removedBytes.toLocaleString('en')} bytes). Kept ${changedJpegs.toLocaleString('en')} changed JPEGs.`);
