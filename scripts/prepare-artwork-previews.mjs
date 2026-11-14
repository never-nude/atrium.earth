import { copyFile, mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import viewerStills from '../src/data/viewer-stills.json' with { type: 'json' };

const source = resolve(process.argv[2] ?? 'dist');
const output = resolve(process.argv[3] ?? source);
const renders = 'previews/renders';
const exactStills = new Set(viewerStills);
const mattes = new Map();
const tolerance = 4;

function studioMatte(width, height) {
  const key = `${width}×${height}`;
  if (mattes.has(key)) return mattes.get(key);
  const pixels = new Uint8Array(width * height * 3);
  const horizontal = Array.from({ length: width }, (_, x) => ((x + 0.5 - width / 2) / (0.7 * width)) ** 2);
  for (let y = 0, byte = 0; y < height; y += 1) {
    const vertical = ((y + 0.5 - height * 0.2) / (0.52 * height)) ** 2;
    for (let x = 0; x < width; x += 1, byte += 3) {
      // The fixed gallery backdrop in public/__render.html.
      const glow = 0.07 * Math.max(0, 1 - Math.sqrt(horizontal[x] + vertical) / 0.72);
      pixels[byte] = Math.round(21 + 194 * glow);
      pixels[byte + 1] = Math.round(36 + 186 * glow);
      pixels[byte + 2] = Math.round(58 + 174 * glow);
    }
  }
  mattes.set(key, pixels);
  return pixels;
}

function removeMatte(rgb, width, height) {
  const count = width * height;
  const matte = studioMatte(width, height);
  const candidate = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let tail = 0;
  let matchingTop = 0;
  let matchingLeft = 0;
  let matchingRight = 0;
  for (let i = 0, byte = 0; i < count; i += 1, byte += 3) {
    const x = i % width;
    const edge = i < width || i >= count - width || x === 0 || x === width - 1;
    const difference = Math.max(
      Math.abs(rgb[byte] - matte[byte]),
      Math.abs(rgb[byte + 1] - matte[byte + 1]),
      Math.abs(rgb[byte + 2] - matte[byte + 2]),
    );
    if (difference <= tolerance) candidate[i] = 1;
    if (edge && candidate[i]) {
      if (i < width) matchingTop += 1;
      if (x === 0) matchingLeft += 1;
      if (x === width - 1) matchingRight += 1;
      queue[tail++] = i;
      candidate[i] = 2;
    }
  }

  // Only erase matte connected to the outside. Isolated dark marks and enclosed
  // areas cannot be recovered reliably from a flattened thumbnail.
  // Tall sculptures and pedestals can touch the bottom or one side.
  if (matchingTop < 0.98 * width || Math.max(matchingLeft, matchingRight) < 0.98 * height) return null;
  function visit(i) {
    if (candidate[i] !== 1) return;
    candidate[i] = 2;
    queue[tail++] = i;
  }
  for (let head = 0; head < tail; head += 1) {
    const i = queue[head];
    const x = i % width;
    if (x > 0) visit(i - 1);
    if (x + 1 < width) visit(i + 1);
    if (i >= width) visit(i - width);
    if (i + width < count) visit(i + width);
  }

  if (tail < 0.12 * count || tail > 0.99 * count) return null;
  const rgba = new Uint8Array(count * 4);
  for (let i = 0, from = 0, to = 0; i < count; i += 1, from += 3, to += 4) {
    if (candidate[i] === 2) continue;
    rgba[to] = rgb[from];
    rgba[to + 1] = rgb[from + 1];
    rgba[to + 2] = rgb[from + 2];
    rgba[to + 3] = 255;
  }
  return rgba;
}

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

    if (exactStills.has(slug)) {
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
      const alpha = removeMatte(data, info.width, info.height);
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
