import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { physicalDimensionsFor, referenceScaleFor } from '../src/lib/physical-dimensions.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const records = read('physical-dimensions'), previews = read('previews'), orientations = read('orientations');
const catalog = new Map(read('catalog').filter(row => !row.hidden).map(row => [row.slug, row]));
let calibrated = 0;
for (const [slug, record] of Object.entries(records)) {
  assert.ok(catalog.has(slug), `Unknown/hidden work: ${slug}`);
  assert.ok(['documented', 'approximate', 'unresolved', 'variable'].includes(record.status), slug);
  assert.ok(['original', 'object'].includes(record.basis), slug);
  if (record.status === 'documented') {
    assert.ok(record.dimensions && /^https?:/.test(record.sourceUrl), `Missing evidence: ${slug}`);
  }
  for (const m of record.measures || []) {
    assert.ok(Number.isFinite(m.value) && m.value > 0, slug);
    assert.ok(['mm', 'cm', 'm'].includes(m.unit), slug);
  }
  const value = physicalDimensionsFor(catalog.get(slug).dimensions, record, previews[slug]?.url, orientations[slug]);
  if (!record.spatial) assert.equal(value.spatialReference, null, `Text alone cannot calibrate: ${slug}`);
  else {
    calibrated++;
    assert.ok(value.spatialReference, `Calibration no longer matches ${slug}`);
    assert.equal(record.status, 'documented');
    const height = record.measures.find(m => m.axis === 'height' && !m.scope);
    assert.equal(record.spatial.meters, height.value / 100);
    assert.equal(physicalDimensionsFor('', record, 'different.glb', orientations[slug]).spatialReference, null);
    assert.equal(physicalDimensionsFor('', record, previews[slug].url, { upAxis: '-y' }).spatialReference, null);
  }
}
const venus = records['venus-de-milo'];
assert.equal(physicalDimensionsFor('H 202 cm', venus, previews['venus-de-milo'].url).dimensions, 'H 204 cm');
assert.equal(venus.basis, 'original');
assert.equal(physicalDimensionsFor('Mesh bounds: H 130 source units', records['egyptian/portrait-of-pharaoh-amasis-smk-cast']).dimensions, '');
assert.equal(physicalDimensionsFor('H 170 cm', records.discobolus).dimensions, '', 'Never fall back to cast dimensions for an unresolved original');
assert.equal(records['greek/crouching-aphrodite-with-eros-smk-cast'].spatial, undefined, 'Restorations need a separate geometry check');
assert.equal(records['egyptian/portrait-of-nefertiti-smk-cast'].spatial, undefined, 'Added pedestal is not part of the original height');
assert.equal(records['modern/the-panther-hunter-jerichau-smk'].basis, 'object', 'An artist’s bronze cast is an accessioned artwork');
assert.equal(physicalDimensionsFor('H 20 cm').spatialReference, null, 'Existing text is not silently promoted to verified scale');
const box = { min: { y: -0.25 }, max: { y: 0.25 } };
assert.equal(referenceScaleFor(box, { axis: 'y', meters: 2.04 }), 4.08);
for (const meters of [NaN, Infinity, -1, 0]) assert.equal(referenceScaleFor(box, { axis: 'y', meters }), 1);
assert.equal(referenceScaleFor(box, { axis: 'height', meters: 1 }), 1);
assert.equal(referenceScaleFor({ min: { y: 0 }, max: { y: 0 } }, { axis: 'y', meters: 1 }), 1);
console.log(`Physical dimension checks passed: ${Object.keys(records).length} audited records, ${calibrated} calibrated models, original-only references, evidence and stale-model protection.`);
