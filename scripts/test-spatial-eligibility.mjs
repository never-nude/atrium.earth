import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { physicalDimensionsFor } from '../src/lib/physical-dimensions.mjs';
import { canonicalFingerprint, spatialEligibilityFor } from '../src/lib/spatial-eligibility.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const records = read('physical-dimensions'), previews = read('previews'), orientations = read('orientations');
const decisions = read('spatial-eligibility');
const catalog = read('catalog').filter(row => !row.hidden);
const evaluate = (slug, overrides = {}, decision = decisions[slug]) => {
  const input = { slug, record: records[slug], previewUrl: previews[slug]?.url, orientation: orientations[slug], ...overrides };
  input.spatialReference ??= physicalDimensionsFor('', input.record, input.previewUrl, input.orientation).spatialReference;
  return spatialEligibilityFor(input, decision);
};

assert.equal(Object.keys(decisions).length, catalog.length, 'Every public work has an explicit decision');
let enabled = 0, casts = 0, unknown = 0, estimates = 0;
for (const work of catalog) {
  const record = records[work.slug], value = evaluate(work.slug);
  assert.ok(decisions[work.slug], work.slug);
  if (value.enabled) {
    enabled++;
    assert.ok(['original', 'object', 'cast'].includes(value.kind));
    assert.match(value.assetSha256, /^[a-f0-9]{64}$/);
    assert.ok(value.sizeLabel && !/exact|life.?size/i.test(value.label));
    if (value.kind === 'cast') {
      casts++;
      assert.equal(value.label, 'Documented cast size');
      assert.match(value.reason, /original artwork’s size is not verified/);
    } else assert.equal(value.label, 'Verified size reference');
  } else {
    assert.equal(value.kind, null);
    assert.equal(value.assetSha256, undefined, 'Unavailable work has no approval hash');
    assert.ok(value.reason);
  }
  if (!record.spatial) {
    unknown++;
    assert.equal(value.enabled, false, `No verified physical reference: ${work.slug}`);
  }
  if (record.spatial?.estimated || record.status === 'approximate' && record.spatial) {
    estimates++;
    assert.equal(value.enabled, false, `Approximate extent cannot launch: ${work.slug}`);
    assert.match(value.reason, /approximate/);
  }
}
assert.equal(enabled, 248);
assert.equal(casts, 21);
assert.equal(unknown, 380);
assert.equal(estimates, 22);

const slug = 'venus-de-milo';
assert.equal(evaluate(slug).enabled, true);
assert.equal(evaluate(slug).kind, 'original');
assert.equal(evaluate('michelangelo/david').enabled, true);
assert.equal(evaluate('diadoumenos-bust').kind, 'cast');
assert.equal(evaluate('not-a-catalogue-work').enabled, false);
assert.equal(evaluate(slug, {}, null).enabled, false, 'A calibrated number alone cannot authorize AR');
assert.equal(evaluate(slug, {}, { ...decisions[slug], policyVersion: 99 }).enabled, false);
assert.equal(evaluate(slug, {}, { ...decisions[slug], kind: 'cast' }).enabled, false, 'A representation label is part of the review');
assert.equal(evaluate(slug, { previewUrl: `${previews[slug].url}?new-version=1` }).enabled, false);
assert.equal(evaluate(slug, { orientation: { upAxis: '-y' } }).enabled, false);

for (const mutate of [
  r => { r.sourceUrl = 'https://example.org/different-source'; },
  r => { r.measures[r.spatial.measurementIndex].value += 1; },
  r => { r.measures.push({ axis: 'width', value: 100, unit: 'cm', sourceUrls: [r.sourceUrl] }); },
  r => { r.measures[r.spatial.measurementIndex].scope = 'Different measurement component'; },
  r => { r.spatial.assetSha256 = '0'.repeat(64); },
  r => { r.spatial.previewUrl = 'https://example.org/changed.glb'; },
  r => { r.spatial.orientation = { upAxis: '-y' }; },
  r => { r.spatial.extentFraction = 0.8; },
  r => { r.spatial.estimated = true; },
  r => { r.spatial.meters = 0; },
  r => { r.spatial.meters = NaN; },
  r => { r.spatial.meters = Infinity; },
  r => { r.measures[r.spatial.measurementIndex].axis = 'unlabelled'; },
  r => { r.measures[r.spatial.measurementIndex].sourceUrls = 'invalid'; },
]) {
  const record = structuredClone(records[slug]);
  mutate(record);
  assert.equal(evaluate(slug, { record }).enabled, false, `Changed evidence must invalidate review: ${mutate}`);
}

// A consistently edited model configuration must still fail the saved review.
const changed = structuredClone(records[slug]);
changed.spatial.orientation = { upAxis: '-y' };
assert.equal(evaluate(slug, { record: changed, orientation: changed.spatial.orientation }).enabled, false);
const objectOrder = Object.fromEntries(Object.entries(records[slug]).reverse());
assert.equal(evaluate(slug, { record: objectOrder }).enabled, true, 'Object key order is not a dimension change');
assert.equal(canonicalFingerprint({ b: 2, a: [1, 2] }), canonicalFingerprint({ a: [1, 2], b: 2 }));
assert.notEqual(canonicalFingerprint([1, 2]), canonicalFingerprint([2, 1]), 'Measurement ordering remains significant');

for (const withheld of ['laocoon', 'apollo-belvedere', 'michelangelo/pieta', 'modern/dubuffet-la-chiffonniere',
  'asia/uma-maheshvara-mia-commons', 'michelangelo/dawn', 'asia/jar-dragon-clouds-iron-cleveland']) {
  assert.equal(evaluate(withheld).enabled, false, `Known conflict or unfinished review must not get a badge: ${withheld}`);
}
assert.match(evaluate('laocoon').reason, /reconciled/);
assert.match(evaluate('asia/garuda-terminal-mia-commons').reason, /direction/);
assert.match(evaluate('athena-lemnia').reason, /further check/);
assert.equal(evaluate('sub-saharan-africa/idimu-mask-with-two-opposing-faces-yale').sizeLabel, 'Length 24.13 cm',
  'A length on world Y remains a source length, not a height');
assert.equal(evaluate('americas/diaguita-zigzag-bowl-mnhn').sizeLabel, 'Maximum diameter 240 mm');
assert.equal(evaluate('ugolino-and-his-sons').sizeLabel, 'Measured component height 197.5 cm');
assert.equal(evaluate('americas/digital-heart-rhythm-monitor-haywood-nmaahc').sizeLabel, 'Measured component width 58.4 cm');
console.log(`Spatial eligibility checks passed: ${enabled} eligible (${casts} measured casts), ${unknown} unverified and ${estimates} approximate excluded; full evidence/model/orientation bindings and scope labels verified.`);
