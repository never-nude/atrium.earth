import assert from 'node:assert/strict';
import test from 'node:test';
import { firstViewFor } from '../src/lib/first-view-models.mjs';

const slug = 'renaissance/test-work';
const originalHash = 'a'.repeat(64);
const firstHash = 'b'.repeat(64);
const oldUrl = `https://models.atrium.earth/models/previews/${slug}/preview-${originalHash.slice(0, 12)}.glb`;
const firstUrl = `/models/first-views/${slug}/first-${firstHash.slice(0, 12)}.glb`;
const original = { url: oldUrl, bytes: 273_799_496 };
const binding = {
  original: { ...original, sha256: originalHash },
  firstView: {
    url: firstUrl,
    bytes: 3_000_000,
    triangles: 220_000,
    sha256: firstHash,
    largestTexture: { width: 2048, height: 1024 },
  },
};

test('accepts an exact 3 MB first view with measured geometry on either supported host', () => {
  assert.equal(firstViewFor(slug, original, binding), binding.firstView);
  const remote = { ...binding.firstView, url: `https://models.atrium.earth${firstUrl}`, largestTexture: null };
  assert.equal(firstViewFor(slug, original, { ...binding, firstView: remote }), remote);
  assert.deepEqual(original, { url: oldUrl, bytes: 273_799_496 });
});

test('stale or unverified bindings leave the existing serving record in use', () => {
  assert.equal(firstViewFor(slug, undefined, binding), undefined);
  assert.equal(firstViewFor(slug, original, undefined), undefined);
  assert.equal(firstViewFor(slug, { ...original, url: oldUrl.replace('preview-', 'revised-') }, binding), undefined);
  assert.equal(firstViewFor(slug, { ...original, bytes: original.bytes + 1 }, binding), undefined);
  assert.equal(firstViewFor(slug, { ...original, sha256: 'c'.repeat(64) }, binding), undefined);
  assert.equal(firstViewFor(slug, original, { ...binding, original: { ...binding.original, sha256: 'c'.repeat(64) } }), undefined);
});

test('rejects invalid derivative metrics and a URL that does not exactly name its verified artifact', () => {
  for (const invalid of [
    { bytes: 3_000_001 },
    { bytes: 11 },
    { triangles: 0 },
    { largestTexture: undefined },
    { largestTexture: { width: 2049, height: 512 } },
    { largestTexture: { width: 512, height: 0 } },
    { sha256: 'c'.repeat(64) },
    { url: firstUrl + '?version=2' },
    { url: firstUrl.replace(slug, 'different-work') },
    { url: `https://external.example${firstUrl}` },
  ]) {
    const firstView = { ...binding.firstView, ...invalid };
    assert.equal(firstViewFor(slug, original, { ...binding, firstView }), undefined);
  }
});
