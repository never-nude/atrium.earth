import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shortWorkTitle } from '../src/lib/work-titles.ts';
import { museumLabelFor } from '../src/lib/museum-label.mjs';
import { planTitleCasing } from './apply-title-casing.mjs';

const cases = [
  ['Apollo Belvedere (SMK Plaster Cast, KAS353)', 'Apollo Belvedere'],
  ['Apollo (cast (restored arm)) Belvedere', 'Apollo Belvedere'],
  ['  Kero\u00a0 (beaker)   ', 'Kero'],
  ['Base for a Water Pipe (Huqqa) with Poetry and Flowers', 'Base for a Water Pipe with Poetry and Flowers'],
  ['Venus (cast) (reduced copy)', 'Venus'],
  ['Venus — (plaster cast)', 'Venus'],
  ['Venus / (plaster cast)', 'Venus'],
  ['Venus(cast)and Cupid', 'Venus and Cupid'],
  ['(Sleeping Child)', 'Sleeping Child'],
  ['(Sleeping Child (study))', 'Sleeping Child'],
  ['() ( )', 'Untitled work'],
  ['', 'Untitled work'],
  ['Venus (unfinished qualifier', 'Venus (unfinished qualifier'],
  ['Venus (cast) (unfinished qualifier', 'Venus (unfinished qualifier'],
  ['Laocoön and His Sons', 'Laocoön and His Sons'],
  ['Untitled (Woman and Child)', 'Untitled'],
];

for (const [source, expected] of cases) {
  assert.equal(shortWorkTitle(source), expected, source);
}

const record = Object.freeze({ title: 'The Thinker (Copenhagen Cast)' });
assert.equal(shortWorkTitle(record.title), 'The Thinker');
assert.equal(record.title, 'The Thinker (Copenhagen Cast)');
console.log(`Thumbnail title helper passed: ${cases.length} title cases and unchanged source identification.`);

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const catalog = readJson('../src/data/catalog.json');
const corrections = readJson('../src/data/identity-corrections.json');
const dimensions = readJson('../src/data/physical-dimensions.json');
const plan = readJson('../docs/step-2b-title-casing.json');
assert.equal(plan.rows.length, 39, 'Only the approved 39-title group is in scope');
const explicitTitles = {
  'americas/shield-with-owl-figure': 'Shield with Owl Figure',
  'head-of-a-female-or-goddess-wearing-a-necklace': 'Head of a Female or Goddess Wearing a Necklace',
  'head-of-a-male-or-female-figure': 'Head of a Male or Female Figure',
  'head-of-a-ruler': 'Head of a Ruler',
  'limestone-figure-of-a-woman': 'Limestone Figure of a Woman',
  'limestone-head-of-a-bearded-man': 'Limestone Head of a Bearded Man',
  'limestone-statue-of-herakles': 'Limestone Statue of Herakles',
  'sub-saharan-africa/female-figure-with-raised-arm': 'Female Figure with Raised Arm',
};
for (const [slug, title] of Object.entries(explicitTitles)) {
  assert.equal(plan.rows.find(row => row.slug === slug)?.after, title, `Owner's explicit headline casing: ${slug}`);
}
for (const row of plan.rows) {
  const work = catalog.find(work => work.slug === row.slug);
  assert.equal(work?.title, row.after, `Approved catalog title: ${row.slug}`);
  assert.equal(shortWorkTitle(work.title), row.after, `Card caption: ${row.slug}`);
  assert.equal(museumLabelFor(work).title, row.after, `AR label: ${row.slug}`);
}

const snapshot = JSON.stringify({ catalog, corrections, dimensions, plan });
const input = { catalog, corrections, dimensions, plan };
const reversed = planTitleCasing({ ...input, reverse: true });
assert.equal(reversed.changes.length, 39);
const applied = planTitleCasing({ ...input, catalog: reversed.catalog });
assert.equal(applied.changes.length, 39);
assert.deepEqual(applied.catalog, catalog, 'Apply then revert is lossless for all records and metadata');
assert.equal(planTitleCasing(input).changes.length, 0, 'Reapplying the approved result is a no-op');
assert.equal(planTitleCasing({ ...input, catalog: reversed.catalog, reverse: true }).changes.length, 0, 'Repeated revert is a no-op');
const beforeBySlug = new Map(reversed.catalog.map(work => [work.slug, work]));
const selected = new Set(plan.rows.map(row => row.slug));
for (const work of catalog) {
  const before = beforeBySlug.get(work.slug);
  assert.deepEqual(selected.has(work.slug) ? { ...work, title: before.title } : work, before,
    `No non-title or unapproved record changes: ${work.slug}`);
}
assert.equal(JSON.stringify({ catalog, corrections, dimensions, plan }), snapshot, 'Planning cannot mutate its inputs or museum evidence');

const first = plan.rows[0];
const changed = structuredClone(reversed.catalog);
changed.find(work => work.slug === first.slug).title = 'An unrelated title';
assert.throws(() => planTitleCasing({ ...input, catalog: changed }), /Title changed since approval/);
const hidden = structuredClone(reversed.catalog);
hidden.find(work => work.slug === first.slug).hidden = true;
assert.throws(() => planTitleCasing({ ...input, catalog: hidden }), /Visibility changed/);
assert.throws(() => planTitleCasing({ ...input, catalog: reversed.catalog.filter(work => work.slug !== first.slug) }), /Missing or duplicate catalog slug/);
assert.throws(() => planTitleCasing({ ...input, catalog: [...reversed.catalog, reversed.catalog.find(work => work.slug === first.slug)] }), /Missing or duplicate catalog slug/);
assert.throws(() => planTitleCasing({ ...input, plan: { ...plan, rows: [...plan.rows, first] } }), /Duplicate or missing plan slug/);
for (const correction of [{ title: 'Corrected display title' }, { catalog: { title: 'Corrected source title' } }]) {
  assert.throws(() => planTitleCasing({ ...input, corrections: { ...corrections, [first.slug]: correction } }), /A correction controls this title/);
}
for (const after of [`${first.after}!`, first.after.replace('Shield', 'Shíeld'), first.after.replace('Shield', 'Mask')]) {
  assert.throws(() => planTitleCasing({ ...input, plan: { ...plan, rows: [{ ...first, after }] } }), /Not a casing-only edit/);
}
assert.throws(() => planTitleCasing({ ...input, plan: { ...plan, rows: [{ ...first,
  preservedSourceTitle: { ...first.preservedSourceTitle, title: 'Source title changed' } }] } }), /Source title changed/);
console.log('Approved headline casing passed: 39 catalog titles, 8 explicit choices, source preservation, reversible/no-op migration and drift guards.');
