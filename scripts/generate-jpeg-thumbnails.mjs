import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../public/previews/renders/', import.meta.url));

async function thumbnails(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await thumbnails(file));
    else if (entry.isFile() && entry.name === 'thumb.webp') files.push(file);
  }
  return files;
}

const files = (await thumbnails(root)).sort();
let next = 0;
let bytes = 0;
await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
  while (next < files.length) {
    const source = files[next++];
    const destination = path.join(path.dirname(source), 'thumb.jpg');
    // No resize or rotation: keep the source thumbnail's pixel dimensions.
    const result = await sharp(source).jpeg({ quality: 82 }).toFile(destination);
    bytes += result.size;
  }
}));
console.log(`Generated ${files.length} JPEG thumbnail siblings at quality 82 (${bytes.toLocaleString('en')} bytes).`);
