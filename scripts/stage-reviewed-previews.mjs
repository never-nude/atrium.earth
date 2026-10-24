// Stage only serving derivatives explicitly pinned by a reviewed public manifest.
// Original packages, private archive maps and credentials never enter this path.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const manifest = process.env.MANIFEST;
if (!/^docs\/ingest\/[a-z0-9-]+-preview-upload\.json$/.test(manifest || '')) throw Error('Invalid manifest path');
const input = JSON.parse(await fs.readFile(manifest, 'utf8'));
if (input.schema !== 'atrium-reviewed-preview-upload/1' || !Array.isArray(input.models) || !input.models.length || input.models.length > 20) throw Error('Invalid bounded model manifest');
const release = /^https:\/\/github\.com\/never-nude\/atrium\.earth\/releases\/download\/[a-z0-9-]+\/[a-z0-9-]+\.glb$/;
const root = '.atrium-ingest/reviewed-preview-upload';
await fs.mkdir(root, {recursive: true});
const seen = new Set();
for (const model of input.models) {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(model.slug || '') || seen.has(model.slug)
      || !release.test(model.url || '') || !/^[a-f0-9]{64}$/.test(model.sha256 || '')
      || !Number.isSafeInteger(model.bytes) || model.bytes <= 0 || model.bytes > 100_000_000) throw Error('Invalid model binding');
  seen.add(model.slug);
  const response = await fetch(model.url, {signal: AbortSignal.timeout(120000)});
  if (!response.ok) throw Error(`Serving file download failed: ${response.status}`);
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) !== model.bytes) {
    await response.body?.cancel();
    throw Error('Serving file Content-Length mismatch');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > model.bytes) throw Error('Serving file exceeds pinned byte count');
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks, bytes);
  if (body.length !== model.bytes || createHash('sha256').update(body).digest('hex') !== model.sha256
      || body.toString('ascii', 0, 4) !== 'glTF' || body.readUInt32LE(4) !== 2 || body.readUInt32LE(8) !== body.length) throw Error('Serving file integrity mismatch');
  const dir = path.join(root, 'models', model.slug);
  await fs.mkdir(dir, {recursive: true});
  await fs.writeFile(path.join(dir, 'preview.glb'), body);
}
await fs.writeFile(path.join(root, 'slugs.txt'), [...seen].join('\n') + '\n');
await fs.writeFile(path.join(root, 'previews.json'), '{}\n');
console.log(`Verified ${seen.size} reviewed serving files.`);
