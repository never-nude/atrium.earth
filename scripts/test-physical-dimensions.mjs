import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { physicalDimensionsFor, referenceScaleFor } from '../src/lib/physical-dimensions.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const records = read('physical-dimensions'), previews = read('previews'), orientations = read('orientations');
const catalog = new Map(read('catalog').filter(row => !row.hidden).map(row => [row.slug, row]));
for (const slug of catalog.keys()) {
  assert.ok(Object.hasOwn(records, slug), `Public work needs an explicit dimension review status: ${slug}`);
}
let calibrated = 0, estimatedReferences = 0;
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
    if (record.spatial.estimated) estimatedReferences++;
    assert.ok(value.spatialReference, `Calibration no longer matches ${slug}`);
    assert.ok(record.status === 'documented' || (record.status === 'approximate' && record.spatial.estimated === true));
    const measure = Number.isInteger(record.spatial.measurementIndex)
      ? record.measures[record.spatial.measurementIndex]
      : record.measures.find(m => m.axis === 'height' && !m.scope);
    assert.ok(measure, `Calibration must name a sourced measurement: ${slug}`);
    const meters = measure.value * { mm: 0.001, cm: 0.01, m: 1 }[measure.unit];
    assert.ok(Math.abs(record.spatial.meters - meters) < 1e-10, `Calibration must preserve source units: ${slug}`);
    if (Number.isInteger(record.spatial.measurementIndex)) {
      assert.match(record.spatial.assetSha256, /^[a-f0-9]{64}$/);
      assert.ok(record.spatial.geometryReview && record.spatial.note, `Geometry review missing: ${slug}`);
      assert.ok(measure.sourceUrls.length, `Source link missing for selected measurement: ${slug}`);
    }
    if (record.spatial.extentFraction !== undefined) {
      assert.ok(record.spatial.extentFraction > 0 && record.spatial.extentFraction <= 1, slug);
      assert.ok(record.spatial.measurementRegion?.method && record.spatial.measurementRegion?.description,
        `Component measurement needs a reproducible geometry region: ${slug}`);
    }
    assert.equal(physicalDimensionsFor('', record, 'different.glb', orientations[slug]).spatialReference, null);
    assert.equal(physicalDimensionsFor('', record, previews[slug].url, { upAxis: '-y' }).spatialReference, null);
  }
}
const venus = records['venus-de-milo'];
assert.equal(physicalDimensionsFor('H 202 cm', venus, previews['venus-de-milo'].url).dimensions, 'H 204 cm');
assert.equal(venus.basis, 'original');
assert.equal(records['egyptian/portrait-of-pharaoh-amasis-smk-cast'].status, 'approximate');
assert.equal(physicalDimensionsFor('Mesh bounds: H 130 source units', records['egyptian/portrait-of-pharaoh-amasis-smk-cast']).spatialReference, null, 'Unlabelled scholarly measurements do not authorize a scale');
assert.equal(physicalDimensionsFor('H 170 cm', records.discobolus).dimensions, '', 'Never fall back to cast dimensions for an unresolved original');
assert.equal(records['greek/crouching-aphrodite-with-eros-smk-cast'].spatial, undefined, 'Restorations need a separate geometry check');
assert.equal(records['egyptian/portrait-of-nefertiti-smk-cast'].spatial, undefined, 'Added pedestal is not part of the original height');
assert.equal(records['modern/the-panther-hunter-jerichau-smk'].basis, 'object', 'An artist’s bronze cast is an accessioned artwork');
assert.equal(physicalDimensionsFor('H 20 cm').spatialReference, null, 'Existing text is not silently promoted to verified scale');
const dubuffet = records['modern/dubuffet-la-chiffonniere'];
const estimated = physicalDimensionsFor('', dubuffet, previews['modern/dubuffet-la-chiffonniere'].url, orientations['modern/dubuffet-la-chiffonniere']);
assert.equal(estimated.spatialReference?.estimated, true, 'Dubuffet starting size remains explicitly approximate');
assert.equal(estimated.spatialReference?.meters, 6.7056);
assert.match(estimated.spatialNote, /approximate/i);
assert.equal(physicalDimensionsFor('', { ...dubuffet, spatial: { ...dubuffet.spatial, estimated: false } }, previews['modern/dubuffet-la-chiffonniere'].url, orientations['modern/dubuffet-la-chiffonniere']).spatialReference, null, 'Approximate data cannot silently authorize a reference');
const box = { min: { y: -0.25 }, max: { y: 0.25 } };
assert.equal(referenceScaleFor(box, { axis: 'y', meters: 2.04 }), 4.08);
// The sculpture occupies 80% of a scan that also contains a museum pedestal.
// Its 53.5 cm height must apply to the sculpture, not the combined scan.
const component = { ...venus, spatial: { ...venus.spatial, extentFraction: 0.8 } };
assert.equal(physicalDimensionsFor('', component, venus.spatial.previewUrl, venus.spatial.orientation).spatialReference.extentFraction, 0.8);
assert.ok(Math.abs(referenceScaleFor(box, { axis: 'y', meters: 0.535, extentFraction: 0.8 }) * 0.5 * 0.8 - 0.535) < 1e-10);
for (const extentFraction of [0, -1, 1.01, NaN, Infinity, null]) {
  assert.equal(referenceScaleFor(box, { axis: 'y', meters: 0.535, extentFraction }), 1);
  assert.equal(physicalDimensionsFor('', { ...component, spatial: { ...component.spatial, extentFraction } },
    venus.spatial.previewUrl, venus.spatial.orientation).spatialReference, null);
}
for (const meters of [NaN, Infinity, -1, 0]) assert.equal(referenceScaleFor(box, { axis: 'y', meters }), 1);
assert.equal(referenceScaleFor(box, { axis: 'height', meters: 1 }), 1);
assert.equal(referenceScaleFor({ min: { y: 0 }, max: { y: 0 } }, { axis: 'y', meters: 1 }), 1);
console.log(`Physical dimension checks passed: ${Object.keys(records).length} audited records, ${calibrated - estimatedReferences} calibrated models, ${estimatedReferences} explicitly approximate starting sizes, original-only references, evidence and stale-model protection.`);
