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

// Public, unique works fill all 24 positions, with catalog index breaking equal-date ties.
const many = Array.from({ length: 30 }, (_, i) => ({
  slug: `work-${i + 1}`, index: i + 1, ingested: '2026-09-20', ingest_batch: `batch-${i % 3}`,
})).reverse();
const manyPublic = [...many.map(({ slug }) => ({ slug })), { slug: 'hidden' }];
many.push(
  { slug: 'hidden', hidden: true, index: 100, ingested: '2026-09-22' },
  { slug: 'excluded', index: 101, ingested: '2026-09-22' },
  { ...many[0] },
);
assert.deepEqual(buildNewestWorks(many, manyPublic).map(work => work.slug),
  Array.from({ length: 24 }, (_, i) => `work-${30 - i}`));
assert.deepEqual(buildNewestWorks([], visible), []);
console.log('Newest works: cross-batch continuations, timestamps, date fallback, catalog tie-breaks, exclusions, uniqueness and 24-work limit passed.');
