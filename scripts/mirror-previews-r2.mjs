#!/usr/bin/env node
// Download R2-hosted previews back to public/models/previews/<slug>/preview.glb
// so render-thumbnails.mjs and the orientation tools can read them locally.
// The content-hashed filename (preview-<sha256:12>.glb) is checked on arrival.
//
//   node scripts/mirror-previews-r2.mjs --input=slugs.txt
//   node scripts/mirror-previews-r2.mjs --slugs=africa/foo,africa/bar
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, previewsPath, readJson, repoRoot } from './ingest-utils.mjs';
import { sha256Hex } from './r2-sigv4.mjs';

const args = parseArgs();
const previewsFile = args.previews ? path.resolve(repoRoot, args.previews) : previewsPath;
const previewsDir = path.resolve(repoRoot, args['previews-dir'] || 'public/models/previews');
const slugPattern = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;

const listed = args.slugs ? String(args.slugs).split(',') : [];
if (args.input) listed.push(...(await readFile(path.resolve(repoRoot, args.input), 'utf8')).split(/\r?\n/));
const slugs = [...new Set(listed.map((slug) => slug.trim()).filter(Boolean))];
const previews = await readJson(previewsFile, {});
let mirrored = 0;
const failed = [];

for (const slug of slugs) {
  try {
    if (!slugPattern.test(slug)) throw new Error('invalid slug');
    const url = previews[slug]?.url || '';
    const file = path.join(previewsDir, slug, 'preview.glb');
    const expected = url.match(/\/preview-([a-f0-9]{12})\.glb$/)?.[1];
    if (!/^https?:\/\//.test(url)) {
      if (existsSync(file)) continue;
      throw new Error(`no remote URL and no local file (${url || 'no preview record'})`);
    }
    if (existsSync(file) && expected && sha256Hex(await readFile(file)).startsWith(expected)) continue;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GET ${response.status} ${response.statusText}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (expected && !sha256Hex(body).startsWith(expected)) throw new Error('downloaded bytes do not match the content-hashed filename');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    mirrored += 1;
    console.log(`+ ${slug} (${body.length} bytes)`);
  } catch (error) {
    failed.push(slug);
    console.error(`! ${slug}: ${error.message}`);
  }
}

console.log(`Mirrored ${mirrored} preview(s); ${failed.length} failed.`);
if (failed.length) process.exitCode = 1;
