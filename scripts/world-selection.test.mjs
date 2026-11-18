import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankWorldWorks, selectWorldWorks, worldCollectionHref, readWorldCollectionFilter,
  clearWorldCollectionFilter, WORLD_SELECTION_LIMIT } from '../src/lib/world-selection.mjs';
import { worldDateSpan, resolveWorldOrigin } from '../src/lib/world-collection.mjs';
import { timeStops, yearToPosition, positionToYear } from '../src/lib/world-time.mjs';

const places = [{ id: 'egypt', label: 'Egypt' }, { id: 'greece', label: 'Greece' }];
const works = [
  { slug: 'egypt/late', title: 'Zebra', placeId: 'egypt', start: 1500, end: 1600 },
  { slug: 'egypt/early', title: 'Early', placeId: 'egypt', start: -3000, end: -2000 },
  { slug: 'egypt/undated', title: 'Undated', placeId: 'egypt', start: null, end: null },
  { slug: 'greece/one', title: 'Alpha', placeId: 'greece', start: -500, end: -300 },
  { slug: 'unplaced', title: 'Unplaced', placeId: null, start: 1500, end: 1600 },
];
const data = { places, works, dateMin: -3000, dateMax: 2026 };

test('curated rank is preserved before unfeatured titles without changing the payload', () => {
  const before = structuredClone(works);
  const result = rankWorldWorks(works, ['egypt/late', 'greece/one']);
  assert.deepEqual(result.slice(0, 2).map(work => work.slug), ['egypt/late', 'greece/one']);
  assert.deepEqual(works, before);
  assert.equal(WORLD_SELECTION_LIMIT, 12);
});

test('the same date/origin projection drives counts and the uncapped selected result set', () => {
  const selected = selectWorldWorks(works, places, { place: 'egypt', from: -2500, to: -2000, all: false });
  assert.deepEqual(selected.counts, { egypt: 1, greece: 0 });
  assert.deepEqual(selected.results.map(work => work.slug), ['egypt/early']);
  assert.equal(selectWorldWorks(works, places, { place: 'egypt', all: true }).results.length, 3);
  const many = Array.from({ length: 153 }, (_, index) => ({ ...works[0], slug: `work-${index}` }));
  assert.equal(selectWorldWorks(many, places, { place: 'egypt', all: true }).counts.egypt, 153);
});

test('See all preserves the exact documented origin and BCE period rather than broad geography', () => {
  const href = worldCollectionHref('/collection/', { place: 'egypt', from: -2500, to: -2000, all: false });
  assert.equal(href, '/collection/?origin=egypt&from=-2500&to=-2000');
  const state = readWorldCollectionFilter(new URL(href, 'https://atrium.earth').search, data);
  assert.deepEqual([...state.slugs], ['egypt/early']);
  assert.equal(state.label, 'Egypt');
  assert.equal(state.all, false);
});

test('all-time and uncertain-origin filters include the same records as the globe', () => {
  assert.equal(worldCollectionHref('/collection/', { place: 'egypt', all: true }), '/collection/?origin=egypt');
  assert.equal(readWorldCollectionFilter('?origin=egypt', data).slugs.size, 3);
  assert.deepEqual([...readWorldCollectionFilter('?origin=__unplaced__', data).slugs], ['unplaced']);
  assert.equal(readWorldCollectionFilter('?q=roman', data), null);
});

test('malformed or missing origin metadata and malformed date filters fail closed', () => {
  for (const search of ['?origin=unknown', '?origin=egypt&origin=greece', '?origin=egypt&from=-2500',
    '?origin=egypt&from=0&to=2', '?origin=egypt&from=-3001&to=1', '?origin=egypt&from=1&to=-1',
    '?origin=egypt&from=1&to=2027', '?origin=egypt&from=1e3&to=2026']) {
    assert.throws(() => readWorldCollectionFilter(search, data), search);
  }
  assert.throws(() => readWorldCollectionFilter('?origin=egypt', null));
  assert.throws(() => readWorldCollectionFilter('?origin=__unplaced__', { ...data, places: [] }));
  assert.throws(() => readWorldCollectionFilter('?origin=egypt', { ...data, works: [works[0], works[0]] }));
  assert.throws(() => readWorldCollectionFilter('?origin=egypt', { ...data, works: [{ ...works[0], placeId: 'imagined' }] }));
});

test('origin removal preserves unrelated filters and outgoing links cannot change origin', () => {
  assert.equal(clearWorldCollectionFilter('?origin=egypt&from=-2500&to=-2000&q=clay&saved=1').toString(), 'q=clay&saved=1');
  assert.equal(worldCollectionHref('https://outside.example/', { place: 'egypt', all: true }), '/collection/?origin=egypt');
});

test('the actual Willendorf record remains reachable through prehistoric time, Austria and See all', () => {
  const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
  const record = read('catalog.json').find(work => work.slug === 'europe/venus-of-willendorf-nhmw-44-686');
  const before = structuredClone(record);
  const placeId = resolveWorldOrigin(record, read('world-places.json')).placeId;
  const span = worldDateSpan(record);
  assert.equal(placeId, 'austria');
  assert.deepEqual(span, { start: -27500, end: -27500 });
  const work = { slug: record.slug, title: record.title, placeId, ...span };
  const prehistoric = { place: 'austria', from: -30000, to: -25000, all: false };
  const projection = { places: [{ id: 'austria', label: 'Austria' }], works: [work], dateMin: -40000, dateMax: 2026 };
  assert.equal(selectWorldWorks(projection.works, projection.places, prehistoric).counts.austria, 1);
  const href = worldCollectionHref('/collection/', prehistoric);
  assert(readWorldCollectionFilter(new URL(href, 'https://atrium.earth').search, projection).slugs.has(record.slug));
  const stops = timeStops(projection.dateMin, projection.dateMax);
  assert.equal(positionToYear(yearToPosition(span.start, stops), stops), span.start);
  assert.deepEqual(record, before, 'The source record and its written age remain unchanged.');
  assert.deepEqual(worldDateSpan({ ...record, slug: 'another-work' }), { start: null, end: null });
  assert.deepEqual(worldDateSpan({ ...record, year_sort: -28000 }), { start: null, end: null });
});
