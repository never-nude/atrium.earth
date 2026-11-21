import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildWorldCollection, worldDateSpan } from '../src/lib/world-collection.mjs';
import { workOverlapsPeriod } from '../src/lib/world-time.mjs';

const read = path => JSON.parse(readFileSync(new URL(`../src/data/${path}`, import.meta.url), 'utf8'));
const bySlug = new Map(read('catalog.json').map(record => [record.slug, record]));
const unknown = { start: null, end: null };
const reviewedSpans = [
  ['egyptian/false-door-irienakhet-mia', -2400, -2400],
  ['europe/sappho-epinay-met', 1895, 1895],
  ['europe/kilnasaggart-inscribed-pillar-stone-c6e5c1', 700, 700],
  ['roman/torso-apollo-cleveland-1924-1017-368499', 100, 200],
  ['europe/cockatoo-ddebac', 1734, 1734],
  ['europe/descending-macaw-42b038', 1732, 1732],
  ['europe/vase-with-chinoiserie-decoration-92f402', 1726, 1726],
  ['europe/half-of-a-twin-capital-with-a-motif-of-hearts-0cadda', 1000, 1099],
  ['asia/kundika-water-ewer-cleveland', 1100, 1199],
];

test('nine reviewed catalogue labels participate in bounded filters with their original wording', () => {
  const records = reviewedSpans.map(([slug]) => bySlug.get(slug));
  const publicWorks = records.map(({ slug, title, year }) => ({ slug, title, displayDate: year }));
  const projection = buildWorldCollection({ records, publicWorks, placesData: read('world-places.json') });
  assert.equal(projection.works.length, reviewedSpans.length);
  for (const [slug, start, end] of reviewedSpans) {
    const work = projection.works.find(row => row.slug === slug);
    assert.deepEqual({ start: work.start, end: work.end }, { start, end }, slug);
    assert.equal(work.dateLabel, bySlug.get(slug).year, slug);
    assert.equal(workOverlapsPeriod(work, start, end), true, slug);
    assert.equal(workOverlapsPeriod(work, end + 1, end + 2), false, slug);
  }
});

test('reviewed bounds do not carry across a changed source, accession, record or label', () => {
  for (const [slug] of reviewedSpans) {
    const record = bySlug.get(slug);
    for (const change of [
      { slug: 'unreviewed-object' },
      { source_record_url: 'https://example.test/other-object' },
      { accession: 'Different accession' },
      { year: `Date uncertain: ${record.year}` },
    ]) assert.deepEqual(worldDateSpan({ ...record, ...change }), unknown, slug);
  }
  const cockatoo = bySlug.get('europe/cockatoo-ddebac');
  assert.deepEqual(worldDateSpan({ ...cockatoo, year: 'September 1734' }), unknown);
});

test('protected cast dates, the prehistoric bound and conservative unknown dates retain their meaning', () => {
  const willendorf = bySlug.get('europe/venus-of-willendorf-nhmw-44-686');
  assert.deepEqual(worldDateSpan(willendorf), { start: -27500, end: -27500 });
  assert.deepEqual(worldDateSpan(bySlug.get('michelangelo/bearded-captive-smk-cast')), unknown);
  assert.deepEqual(worldDateSpan({ ...bySlug.get('europe/cockatoo-ddebac'), title: 'Plaster cast of Cockatoo' }), unknown);
  for (const year of ['About 2400 BCE', '17 August 1726', '4th quarter of the 11th century', '1100s', 'August 1734 (acquired)', 'Date not yet recorded']) {
    assert.deepEqual(worldDateSpan({ year, year_sort: 1734 }), unknown, year);
  }
  assert.equal(workOverlapsPeriod(unknown, 1700, 1800, true), true);
  assert.equal(workOverlapsPeriod(unknown, 1700, 1800), false);
});
