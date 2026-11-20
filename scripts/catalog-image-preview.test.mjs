import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyCatalogImagePreview } from './lib/catalog-image-preview.mjs';

test('image-only records require exact local bytes and explicit source/permission credits', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'atrium-image-binding-'));
  const slug = 'fixture/sculpture';
  const url = `/images/artworks/${slug}/image.jpg`;
  const body = readFileSync(new URL('../public/previews/renders/discobolus/thumb.jpg', import.meta.url));
  const file = path.join(root, 'public', url);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
  const image = { url, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') };
  const work = { source_url: 'https://example.org/photo', source_record_url: 'https://example.org/object', license_url: 'https://creativecommons.org/licenses/by/4.0/', scan_author: 'Photographer', license: 'CC BY 4.0', attribution: 'Collection; photograph by Photographer' };
  try {
    assert.equal(await verifyCatalogImagePreview(slug, image, { root, work }), true);
    await assert.rejects(() => verifyCatalogImagePreview(slug, image, { root, work, model: { url: '/missing.glb' } }), /Both model and image/);
    await assert.rejects(() => verifyCatalogImagePreview(slug, image, { root, work, model: null }), /Both model and image/);
    for (const field of ['source_url', 'source_record_url', 'license_url', 'scan_author', 'license', 'attribution']) {
      await assert.rejects(() => verifyCatalogImagePreview(slug, image, { root, work: { ...work, [field]: '' } }), /Missing image/);
    }
    await assert.rejects(() => verifyCatalogImagePreview(slug, { ...image, bytes: image.bytes + 1 }, { root, work }), /bytes or SHA/);
    await assert.rejects(() => verifyCatalogImagePreview(slug, { ...image, sha256: '0'.repeat(64) }, { root, work }), /bytes or SHA/);
    await assert.rejects(() => verifyCatalogImagePreview(slug, { ...image, url: '/images/artworks/other/image.jpg' }, { root, work }), /Invalid image binding/);
    await assert.rejects(() => verifyCatalogImagePreview(slug, { ...image, url: `/images/artworks/${slug}/../image.jpg` }, { root, work }), /Invalid image binding/);
    const truncated = Buffer.from([0xff, 0xd8, 0xff]);
    writeFileSync(file, truncated);
    await assert.rejects(() => verifyCatalogImagePreview(slug, { ...image, bytes: truncated.length, sha256: createHash('sha256').update(truncated).digest('hex') }, { root, work }));
    const html = Buffer.from('<html>Provider error</html>');
    writeFileSync(file, html);
    await assert.rejects(() => verifyCatalogImagePreview(slug, { ...image, bytes: html.length, sha256: createHash('sha256').update(html).digest('hex') }, { root, work }), /Invalid image file signature/);
  } finally {
    rmSync(root, { recursive: true });
  }
});
