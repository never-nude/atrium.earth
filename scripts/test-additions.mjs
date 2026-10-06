import assert from 'node:assert/strict';
import { buildAdditionBatches, buildNewestWorks } from '../src/lib/addition-batches.mjs';
const visible = ['a', 'b', 'c', 'd', 'e'].map((slug) => ({ slug, title: slug }));
const records = [
  { slug: 'a', ingested: '2026-09-19', ingest_batch: 'morning', ingested_at: '2026-09-19T10:00:00.000Z' },
  { slug: 'b', ingested: '2026-09-19', ingest_batch: 'evening', ingested_at: '2026-09-19T18:00:00.000Z' },
  { slug: 'c', ingested: '2026-09-18' },
  { slug: 'd', ingested: '2026-09-18' },
  { slug: 'hidden', ingested: '2026-09-20', ingest_batch: 'hidden-batch' },
  { slug: 'e' },
];
const result = buildAdditionBatches(records, visible, { morning: { title: 'First arrival', highlightSlugs: ['hidden', 'b', 'a', 'a'] }, empty: { title: 'Never published' } });
assert.deepEqual(result.map((batch) => batch.id), ['evening', 'morning', 'added-2026-09-18']);
assert.deepEqual(result[2].works.map((work) => work.slug), ['c', 'd']);
assert.equal(result[1].title, 'First arrival');
assert.deepEqual(result[1].highlights.map((work) => work.slug), ['a']);
assert.equal(result[2].title, 'Added September 18, 2026');
assert.deepEqual(buildAdditionBatches([], visible, { empty: {} }), []);
assert.equal(buildAdditionBatches([...records, records[0]], visible).flatMap((batch) => batch.works).length, 4);
assert.deepEqual(buildAdditionBatches([{ slug: 'a', ingested: '2026-02-30' }], visible), []);
assert.equal(buildAdditionBatches([{ slug: 'a', hidden: true, ingested: '2026-09-19' }], visible).length, 0);
// A published work can opt out of the additions archive and the Newest rail while staying in the catalog.
assert.equal(buildAdditionBatches([{ slug: 'a', exclude_from_additions: true, ingested: '2026-09-19' }], visible).length, 0);
assert.deepEqual(buildNewestWorks([{ slug: 'a', exclude_from_additions: true, ingested: '2026-09-21' }, { slug: 'b', ingested: '2026-09-19' }], visible).map((work) => work.slug), ['b']);
assert.equal(buildAdditionBatches([{ slug: 'a', ingest_batch: '../bad', ingested: '2026-09-19' }], visible)[0].id, 'added-2026-09-19');
// Continuing an existing batch adds members without creating a new release or changing its original date.
const continued = buildAdditionBatches([...records, { slug: 'e', ingest_batch: 'morning', ingested: '2026-09-20', ingested_at: '2026-09-20T10:00:00.000Z' }], visible);
assert.equal(continued[1].id, 'morning');
assert.equal(continued[1].date, '2026-09-19');
assert.deepEqual(continued[1].works.map((work) => work.slug), ['a', 'e']);
console.log('Addition grouping: same-day imports, public membership, legacy history, highlights, invalid dates and continuation passed.');

// A later continuation leads Newest even though its archive batch keeps its original date.
const continuedRecords = [...records, { slug: 'e', ingest_batch: 'morning', ingested_at: '2026-09-20T10:00:00.000Z' }];
assert.deepEqual(buildNewestWorks(continuedRecords, visible).map(work => work.slug), ['e', 'b', 'a', 'd', 'c']);

// Compare actual instants; invalid timestamps fall back to a valid ingestion day.
const dated = [
  { slug: 'a', ingested_at: '2026-09-20T01:30:00+02:00' },
  { slug: 'b', ingested_at: '2026-09-20T00:00:00Z' },
  { slug: 'c', ingested_at: '2030-02-30T10:00:00Z', ingested: '2026-09-21' },
  { slug: 'd', ingested_at: '2030-01-01Tinvalid', ingested: '2026-09-18' },
  { slug: 'e', ingested: '2026-02-30' },
];
assert.deepEqual(buildNewestWorks(dated, visible).map(work => work.slug), ['c', 'b', 'a', 'd', 'e']);

// Public, unique works fill all 40 positions, with catalog index breaking equal-date ties.
const many = Array.from({ length: 50 }, (_, i) => ({
  slug: `work-${i + 1}`, index: i + 1, ingested: '2026-09-20', ingest_batch: `batch-${i + 1}`,
})).reverse();
const manyPublic = [...many.map(({ slug }) => ({ slug })), { slug: 'hidden' }];
many.push(
  { slug: 'hidden', hidden: true, index: 100, ingested: '2026-09-22' },
  { slug: 'excluded', index: 101, ingested: '2026-09-22' },
  { ...many[0] },
);
assert.deepEqual(buildNewestWorks(many, manyPublic).map(work => work.slug),
  Array.from({ length: 40 }, (_, i) => `work-${50 - i}`));
assert.deepEqual(buildNewestWorks([], visible), []);

// The newest rail has a 40-work floor and keeps every public member of the latest batch.
const batchOf = (name, count, day, offset = 0) => Array.from({ length: count }, (_, i) => ({
  slug: `${name}-${i + 1}`, index: offset + i + 1, ingest_batch: name, ingested_at: `${day}T12:00:00.000Z`,
}));
const bigLatest = [...batchOf('older', 10, '2026-09-30'), ...batchOf('big', 45, '2026-10-02', 10)];
const bigPublic = bigLatest.map(({ slug }) => ({ slug }));
assert.deepEqual(buildNewestWorks(bigLatest, bigPublic).map(work => work.slug),
  Array.from({ length: 45 }, (_, i) => `big-${45 - i}`));
const smallLatest = [...batchOf('huge', 40, '2026-09-30'), ...batchOf('small', 3, '2026-10-02', 40)];
const smallPublic = smallLatest.map(({ slug }) => ({ slug }));
const smallNewest = buildNewestWorks(smallLatest, smallPublic).map(work => work.slug);
assert.equal(smallNewest.length, 40);
assert.deepEqual(smallNewest.slice(0, 4), ['small-3', 'small-2', 'small-1', 'huge-40']);
// Hidden or excluded members are skipped, and the page still fills all 40 positions.
const hiddenMembers = batchOf('big', 50, '2026-10-02').map((record, i) => (i < 10 ? { ...record, exclude_from_additions: true } : record));
assert.equal(buildNewestWorks([...batchOf('older', 30, '2026-09-30', 100), ...hiddenMembers],
  [...batchOf('older', 30, '2026-09-30', 100), ...hiddenMembers].map(({ slug }) => ({ slug }))).length, 40);

// A continuation promotes its whole latest batch, including earlier members beyond the floor.
const continuedBatch = [
  ...batchOf('continued', 45, '2026-09-01'),
  ...batchOf('intervening', 40, '2026-09-30', 45),
  { slug: 'continued-new', index: 86, ingest_batch: 'continued', ingested_at: '2026-10-02T12:00:00.000Z' },
];
const continuedPublic = continuedBatch.map(({ slug }) => ({ slug }));
const continuedNewest = buildNewestWorks(continuedBatch, continuedPublic).map((work) => work.slug);
assert.equal(continuedNewest.length, 85);
assert(continuedNewest.includes('continued-1'));
assert(continuedNewest.includes('continued-new'));

// Four sequential write chunks can form one 240-work logical batch without
// truncating Newest or splitting the internal batch record.
const largeLogicalBatch = Array.from({ length: 4 }, (_, chunk) => Array.from({ length: 60 }, (_, item) => ({
  slug: `large-${chunk * 60 + item + 1}`,
  index: chunk * 60 + item + 1,
  ingest_batch: 'large-logical-batch',
  ingested_at: `2026-10-0${chunk + 1}T12:00:00.000Z`,
}))).flat();
const largeLogicalPublic = largeLogicalBatch.map(({ slug }) => ({ slug }));
assert.equal(buildNewestWorks(largeLogicalBatch, largeLogicalPublic).length, 240);
const groupedLargeLogical = buildAdditionBatches(largeLogicalBatch, largeLogicalPublic);
assert.equal(groupedLargeLogical.length, 1);
assert.equal(groupedLargeLogical[0].works.length, 240);
console.log('Newest works: cross-batch continuations, timestamps, date fallback, catalog tie-breaks, exclusions, uniqueness, 40-work floor and complete 240-work logical batches passed.');
