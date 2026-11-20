import { copyFile, mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { removeStudioMatte } from './lib/artwork-preview-matte.mjs';
import viewerStills from '../src/data/viewer-stills.json' with { type: 'json' };
import imagePreviews from '../src/data/image-previews.json' with { type: 'json' };

const source = resolve(process.argv[2] ?? 'dist');
const output = resolve(process.argv[3] ?? source);
const renders = 'previews/renders';
const exactStills = new Set(viewerStills);
const files = (await readdir(join(source, renders), { recursive: true }))
  .filter(path => path.endsWith('/thumb.webp')).sort();
if (!files.length) throw new Error('No rendered artwork previews found');
let next = 0;
let exact = 0;
let processed = 0;
let bytes = 0;
const retained = [];
await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
  while (next < files.length) {
    const relative = files[next++];
    const slug = dirname(relative);
    const original = join(source, renders, relative);
    const destination = join(output, renders, relative);
    const temporary = destination + '.tmp';
    await mkdir(dirname(destination), { recursive: true });

    if (Object.hasOwn(imagePreviews, slug)) {
      // Museum/photographer images retain their original background and framing.
      if (original !== destination) await copyFile(original, destination);
      bytes += (await stat(destination)).size;
      continue;
    } else if (exactStills.has(slug)) {
      await copyFile(resolve('public/images/viewer-stills', slug + '.webp'), temporary);
      exact += 1;
    } else {
      const image = sharp(original);
      const metadata = await image.metadata();
      if (metadata.hasAlpha) {
        if (original !== destination) await copyFile(original, destination);
        bytes += (await stat(original)).size;
        continue;
      }
      const { data, info } = await image.resize({ width: 720, withoutEnlargement: true })
        .toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
      const alpha = removeStudioMatte(data, info.width, info.height);
      if (alpha) {
        const rendered = await sharp(alpha, { raw: { width: info.width, height: info.height, channels: 4 } })
          .webp({ quality: 88, alphaQuality: 100, effort: 3 }).toBuffer();
        await writeFile(temporary, rendered);
        processed += 1;
      } else {
        retained.push(relative);
        if (original === destination) {
          bytes += (await stat(original)).size;
          continue;
        }
        await copyFile(original, temporary);
      }
    }
    await rename(temporary, destination);
    bytes += (await stat(destination)).size;
  }
}));
console.log(`Prepared ${exact} cast-shadow stills and ${processed} transparent previews across ${files.length} works (${bytes.toLocaleString()} bytes).`);

if (retained.length) {
  console.warn(`Kept ${retained.length} source previews outside the studio backdrop checks:\n${retained.sort().join('\n')}`);
}
