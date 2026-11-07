#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assignWing, type WingAssignmentInput } from '../src/lib/assignWing.ts';
import { wingIds, wings } from '../src/data/wings.ts';
import { legacyWingRoutes } from '../src/data/wing-legacy-routes.ts';

assert.deepEqual(wingIds, ['europe', 'asia', 'africa', 'americas', 'oceania']);
assert.deepEqual(wings.map((wing) => wing.name), ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']);
for (const wing of wings) {
  for (const region of wing.match.region ?? []) {
    assert.equal(assignWing({ collection: region }), wing.id, region);
    assert.equal(assignWing({ slug: `${region}/fixture` }), wing.id, region);
  }
  for (const place of wing.match.place ?? []) assert.equal(assignWing({ place }), wing.id, place);
}

const fixtures: [WingAssignmentInput, string][] = [
  [{ geography: 'Italy' }, 'europe'],
  [{ geography: 'Smyrna, Roman Asia Minor' }, 'asia'],
  [{ geography: 'Egypt' }, 'africa'],
  [{ geography: 'Gabon / Equatorial Guinea / Cameroon (Fang region)' }, 'africa'],
  [{ origin_country: 'Turkey or Syria' }, 'asia'],
  [{ origin_country: 'Central Asia (Sogdiana) or Tibet' }, 'asia'],
  [{ geography: 'Rapa Nui (Chile)' }, 'oceania'],
  [{ geography: 'French Guiana' }, 'americas'],
  [{ geography: 'Greenland' }, 'americas'],
  [{ geography: 'Papua New Guinea' }, 'oceania'],
  [{ geography: 'Niger' }, 'africa'],
  [{ geography: 'Nigeria' }, 'africa'],
  [{ culture: 'Yoruba' }, 'africa'],
  [{ culture: 'Etruscan' }, 'europe'],
  [{ culture: 'Khmer' }, 'asia'],
  [{ culture: 'Japanese; Edo period' }, 'asia'],
  [{ culture: 'Edo period' }, 'unfiled'],
  [{ culture: 'Edo (Kingdom of Benin)' }, 'africa'],
  [{ culture: 'Moche' }, 'americas'],
  [{ culture: 'Rapa Nui' }, 'oceania'],
  [{ culture: 'Eastern European Jewish' }, 'europe'],
  [{ culture: 'Islamic' }, 'unfiled'],
  [{ culture: 'Roman' }, 'unfiled'],
  [{ culture: 'Greek' }, 'unfiled'],
  [{ culture: 'Greek composition; historic plaster cast' }, 'unfiled'],
  [{ geography: 'Mediterranean' }, 'unfiled'],
  [{ geography: 'Roman world' }, 'unfiled'],
  [{ geography: 'Ancient Near East' }, 'unfiled'],
  [{ geography: 'Ancient Near East and Egypt' }, 'unfiled'],
  [{ geography: 'Egypt or Syria' }, 'unfiled'],
  [{ geography: 'France or Japan' }, 'unfiled'],
  [{ geography: 'Russia' }, 'unfiled'],
  [{ geography: 'Georgia' }, 'unfiled'],
  [{ geography: 'British Museum, London, England' }, 'unfiled'],
  [{ geography: 'Artist nationality: French' }, 'unfiled'],
  [{ geography: 'New York, United States', museum: 'New York, United States' }, 'unfiled'],
  [{ original_location: 'Italy', current_location: 'United States' }, 'europe'],
  [{ slug: 'modern/fixture' }, 'unfiled'],
  [{ slug: 'roman/fixture' }, 'unfiled'],
  [{ slug: 'greek/fixture' }, 'unfiled'],
  [{ slug: 'near-east/fixture' }, 'unfiled'],
  [{ slug: 'michelangelo/fixture' }, 'unfiled'],
  [{ slug: 'americas-oceania/fixture' }, 'unfiled'],
  [{ collection: 'asia', geography: 'Egypt' }, 'africa'],
  [{ wing: 'europe', geography: 'New York, United States' }, 'europe'],
  [{ wing: 'asia', geography: 'Sakhalin, Russia' }, 'asia'],
  [{ wing: 'unfiled', geography: 'France' }, 'unfiled'],
  [{ wing: 'europe', wing_unfiled_reason: 'Reviewed record retains unresolved manufacture.', geography: 'Italy' }, 'unfiled'],
  [{ wing: 'near-eats', geography: 'Egypt' }, 'unfiled'],
  [{ wing: 'greece-rome', geography: 'Turkey' }, 'asia'],
  [{ wing: 'near-east', geography: 'Egypt' }, 'africa'],
  [{ wing: 'americas-oceania', geography: 'Rapa Nui (Chile)' }, 'oceania'],
  [{ data: { wing: 'africa', geography: 'France' } }, 'africa'],
  [{ slug: 'modern/fixture', ...{ title: 'Egyptian head', artist: 'French sculptor', search: 'Italy', note: 'Made in Japan' } }, 'unfiled'],
];
for (const [work, expected] of fixtures) {
  const before = JSON.stringify(work);
  assert.equal(assignWing(work), expected, JSON.stringify(work));
  assert.equal(assignWing(work), expected, 'Repeated assignment must be deterministic');
  assert.equal(JSON.stringify(work), before, 'Assignment must not mutate source fields');
}

// Legacy entrances explain the split; they cannot create extra primary homes.
assert.deepEqual(legacyWingRoutes['near-east'].destinations, ['africa', 'asia']);
assert.deepEqual(legacyWingRoutes['greece-rome'].destinations, ['europe', 'africa', 'asia']);
assert.deepEqual(legacyWingRoutes['americas-oceania'].destinations, ['americas', 'oceania']);
assert.ok(Object.keys(legacyWingRoutes).every((id) => !wingIds.includes(id as typeof wingIds[number])));

type CatalogRecord = WingAssignmentInput & { slug: string; hidden?: boolean };
const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as CatalogRecord[];
const corrections = JSON.parse(await readFile(new URL('../src/data/identity-corrections.json', import.meta.url), 'utf8')) as Record<string, { catalog?: Partial<CatalogRecord> }>;
const featured = JSON.parse(await readFile(new URL('../src/data/featured-works.json', import.meta.url), 'utf8')) as { works: { slug: string }[] };
const sourceBefore = JSON.stringify(catalog);
// This is the same order as production: public source records, then reviewed
// identity corrections, then the raw-field assigner (no display fallbacks).
const visible = catalog.filter((work) => !work.hidden).map((work) => ({ ...work, ...corrections[work.slug]?.catalog }));
const assignments = visible.map((work) => ({ slug: work.slug, wing: assignWing(work) }));
assert.equal(new Set(assignments.map((work) => work.slug)).size, visible.length);
assert.ok(assignments.every((work) => [...wingIds, 'unfiled'].includes(work.wing)));
assert.ok(catalog.filter((work) => work.hidden).every((work) => !assignments.some((entry) => entry.slug === work.slug)), 'Hidden duplicates must not enter public wings');
for (const record of visible.filter((work) => work.wing === 'unfiled' || work.wing_unfiled_reason)) {
  assert.equal(assignWing(record), 'unfiled', `${record.slug}: preserve reviewed unknown-origin decision`);
}
const reviewedAssignments = {
  'modern/torso-callender-saam': 'americas',
  'modern/venus-jim-dine-sixth-avenue': 'americas',
  // American maker and Liverpool holding institution do not establish an origin.
  'modern/puck-harriet-hosmer-walker-threedscans': 'unfiled',
  'medieval/birds-with-foliage-mosaic-mia': 'asia',
  'asia/mamluk-door-panel-mia': 'africa',
  'ancient-near-east/stargazer-cleveland': 'asia',
  'europe/benjamin-franklin-houdon-met': 'europe',
  'prehistoric/shigir-idol-head-sverdlovsk': 'asia',
};
for (const [slug, expected] of Object.entries(reviewedAssignments)) assert.equal(assignments.find((work) => work.slug === slug)?.wing, expected, slug);
for (const wing of wings) {
  for (const slug of wing.featured) assert.equal(assignments.find((work) => work.slug === slug)?.wing, wing.id, `${slug}: featured wing`);
}
assert.equal(featured.works.length, 250, 'The existing reviewed pool remains 250 works');
assert.equal(new Set(featured.works.map((work) => work.slug)).size, 250);
assert.ok(featured.works.every((work) => visible.some((entry) => entry.slug === work.slug)));
assert.equal(JSON.stringify(catalog), sourceBefore, 'Source catalog facts remain unchanged');
const counts = Object.fromEntries([...wingIds, 'unfiled'].map((id) => [id, assignments.filter((work) => work.wing === id).length]));
assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), visible.length, 'Every public work has exactly one primary result');
console.table(counts);
console.log(`Wing tests passed: ${visible.length} public works; 250 reviewed features preserved; ${counts.unfiled} accessible without an asserted continent.`);
