import assert from 'node:assert/strict';
import fs from 'node:fs';
import { approximateDimensionsFor } from '../src/lib/approximate-dimensions.mjs';
import { spatialAccessFor } from '../src/lib/spatial-access.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const catalog = read('catalog'), records = read('physical-dimensions'), previews = read('previews');
const slug = 'neoclassical/baptismal-font-thorvaldsen-a555-plaster';
const font = catalog.find(work => work.slug === slug);
assert.ok(font);
assert.equal(font.dimensions, '');
assert.equal(records[slug].status, 'unknown');
assert.match(font.note, /77\.8/);
assert.match(font.note, /72\.5/);

// Reproduce the misleading component estimate that the scoped guard prevents.
const input = { work: font, record: records[slug], previewUrl: previews[slug].url };
const control = approximateDimensionsFor({ ...input, work: { ...font, slug: 'component-measurement-control' } });
assert.equal(control.reference.meters, 0.778);
const approximation = approximateDimensionsFor(input);
assert.equal(approximation.reference, undefined);
assert.match(approximation.unavailableReason, /individual relief panels/);
const access = spatialAccessFor({ enabled: false }, previews[slug].url, undefined, approximation);
assert.equal(access.status, 'unknown');
assert.equal(access.verified, false);
assert.equal(access.reference, undefined);
assert.equal(access.defaultMaxExtentMeters, 1);
assert.match(access.note, /chosen display size/);

const reliefs = catalog.filter(work => work.ingest_batch === font.ingest_batch && work.slug !== slug);
assert.equal(reliefs.length, 9);
for (const work of reliefs) {
  const estimate = approximateDimensionsFor({ work, record: records[work.slug], previewUrl: previews[work.slug].url });
  assert.equal(records[work.slug].status, 'documented');
  assert.ok(estimate.reference.meters > 0, work.slug);
  assert.equal(spatialAccessFor({ enabled: false }, previews[work.slug].url, undefined, estimate).status, 'approximate');
}
console.log('Thorvaldsen sizing: component measurements retained; whole font unknown with chosen 1 m display size; nine relief estimates preserved.');
