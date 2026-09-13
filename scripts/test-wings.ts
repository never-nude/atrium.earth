#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assignWing } from '../src/lib/assignWing.ts';
import { wingIds, wings } from '../src/data/wings.ts';

type CatalogRecord = {
  slug: string;
  collection?: string;
  geography?: string;
  wing?: string;
  hidden?: boolean;
};

for (const wing of wings) {
  for (const region of wing.match.region ?? []) {
    assert.equal(
      assignWing({ slug: `${region}/__wing-acceptance-fixture`, collection: region }),
      wing.id,
      `${region} should route to ${wing.id} from its collection field`,
    );
    assert.equal(
      assignWing({ slug: `${region}/__wing-url-fixture` }),
      wing.id,
      `${region} should route to ${wing.id} from its URL folder`,
    );
  }
  for (const place of wing.match.place ?? []) {
    assert.equal(
      assignWing({ slug: '__wing-place-fixture', place }),
      wing.id,
      `${place} should route to ${wing.id}`,
    );
  }
}

// URL folder fallback, Place matching, override precedence, and the unfiled path.
assert.equal(assignWing({ slug: 'roman/__wing-acceptance-fixture' }), 'greece-rome');
assert.equal(assignWing({ slug: 'greek/__wing-empty-region-fixture', data: { region: '' } }), 'greece-rome');
assert.equal(
  assignWing({ slug: 'modern/__wing-override-fixture', collection: 'modern', wing: 'americas-oceania' }),
  'americas-oceania',
);
assert.equal(
  assignWing({ slug: '__wing-unfiled-fixture', place: 'Unassigned geography' }),
  'unfiled',
);
assert.equal(
  assignWing({ slug: 'egyptian/__wing-invalid-override', collection: 'egyptian', wing: 'near-eats' }),
  'unfiled',
);

const catalog = JSON.parse(
  await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'),
) as CatalogRecord[];
const corrections = JSON.parse(
  await readFile(new URL('../src/data/identity-corrections.json', import.meta.url), 'utf8'),
) as Record<string, { catalog?: Partial<CatalogRecord> }>;
// Match production: hide deferred records, then apply reviewed identity fields.
const visible = catalog
  .filter((work) => !work.hidden)
  .map((work) => ({ ...work, ...corrections[work.slug]?.catalog }));
const assignments = visible.map((work) => ({
  slug: work.slug,
  wing: assignWing(work),
}));
const unfiled = assignments.filter((work) => work.wing === 'unfiled');
assert.deepEqual(unfiled, [], `current catalog has unfiled works: ${unfiled.map((work) => work.slug).join(', ')}`);

// These works retain their historical folders while their reviewed wings win.
const reviewedAssignments = {
  'modern/torso-callender-saam': 'americas-oceania',
  'modern/venus-jim-dine-sixth-avenue': 'americas-oceania',
  'modern/puck-harriet-hosmer-walker-threedscans': 'americas-oceania',
  'medieval/birds-with-foliage-mosaic-mia': 'greece-rome',
  'asia/mamluk-door-panel-mia': 'africa',
  'ancient-near-east/stargazer-cleveland': 'near-east',
};
for (const [slug, wing] of Object.entries(reviewedAssignments)) {
  assert.equal(assignments.find((work) => work.slug === slug)?.wing, wing, slug);
}
for (const wing of wings) {
  for (const slug of wing.featured) {
    assert.equal(
      assignments.find((work) => work.slug === slug)?.wing,
      wing.id,
      `${slug} must belong to its featured wing`,
    );
  }
}

const counts = Object.fromEntries(
  [...wingIds, 'unfiled'].map((id) => [id, assignments.filter((work) => work.wing === id).length]),
);
console.table(counts);
console.log(`Wing acceptance fixtures passed; ${visible.length} public works are filed.`);
