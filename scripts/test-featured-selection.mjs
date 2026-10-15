import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildFeaturedSelection, featuredForDate, homepageHeroForDate,
  FEATURED_WORK_COUNT, HOMEPAGE_PREVIEW_LIMIT,
} from '../src/lib/featured-selection.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const review = read('featured-works');
const previews = read('previews');
const renders = new Set(read('renders'));
const visible = read('catalog').filter(work => !work.hidden)
  .map(work => ({ ...work, hasPreview: Boolean(previews[work.slug]?.url) }));
const selected = buildFeaturedSelection(review, visible, renders);
const allowed = new Set(selected.map(work => work.slug));
const homepageApproved = new Set(review.works.filter(entry => entry.homepage).map(entry => entry.slug));
const homepagePool = selected.filter(work => homepageApproved.has(work.slug));
assert.equal(selected.length, FEATURED_WORK_COUNT);
assert.equal(allowed.size, FEATURED_WORK_COUNT);
const allowedLicenses = new Set(['CC BY 4.0', 'CC BY-SA 4.0', 'CC0 1.0', 'CC0 1.0 Universal', 'Public Domain Mark 1.0', 'cc-zero', 'cc-by-4.0']);
for (const work of selected) assert.ok(allowedLicenses.has(work.license), `${work.slug}: an explicit reuse grant is required`);
for (const entry of review.works) {
  assert.ok(entry.reason.trim().length >= 30, `${entry.slug}: explain the actual curatorial choice`);
  assert.ok(fs.existsSync(new URL(`../public/previews/renders/${entry.slug}/thumb.webp`, import.meta.url)), entry.slug);
}
assert.equal(new Set(selected.map(work => previews[work.slug].url)).size, FEATURED_WORK_COUNT, 'Do not feature one delivered model under multiple records');

// Walk complete rotations, including dates before the original launch. Neither
// scheduled rotation, an old spotlight window nor a fallback can escape review.
const heroes = new Set();
const weekly = new Set();
const eligible = homepagePool.filter(work => previews[work.slug].bytes > 0 && previews[work.slug].bytes <= HOMEPAGE_PREVIEW_LIMIT);
assert.ok(eligible.length > 0);
for (let slot = -FEATURED_WORK_COUNT; slot < FEATURED_WORK_COUNT; slot++) {
  const heroDate = new Date(Date.UTC(2026, 8, 4) + slot * 3 * 86400000);
  const hero = homepageHeroForDate(homepagePool, previews, heroDate);
  assert.ok(allowed.has(hero.slug), hero.slug);
  assert.ok(homepageApproved.has(hero.slug), 'The hero must also pass its presentation review');
  assert.ok(previews[hero.slug].bytes <= HOMEPAGE_PREVIEW_LIMIT, hero.slug);
  assert.equal(homepageHeroForDate(homepagePool, previews, heroDate).slug, hero.slug, 'Builds at the same date are stable');
  heroes.add(hero.slug);
  const weekDate = new Date(Date.UTC(2026, 5, 3) + slot * 7 * 86400000);
  const weeklyWork = featuredForDate(selected, weekDate);
  assert.ok(allowed.has(weeklyWork.slug));
  weekly.add(weeklyWork.slug);
}
assert.equal(heroes.size, eligible.length, 'Every loading-budget eligible selection participates in the hero rotation');
assert.equal(weekly.size, FEATURED_WORK_COUNT);

// Future acquisitions remain outside the pool until an explicit replacement.
const newImport = { slug: 'fixture/unreviewed-new-import', hasPreview: true };
assert.deepEqual(buildFeaturedSelection(review, [...visible, newImport], new Set([...renders, newImport.slug])), selected);
const copy = () => structuredClone(review);
const duplicate = copy(); duplicate.works[1] = duplicate.works[0];
assert.throws(() => buildFeaturedSelection(duplicate, visible, renders), /Duplicate/);
assert.throws(() => buildFeaturedSelection({ ...review, works: review.works.slice(1) }, visible, renders), /exactly 250/);
const noReason = copy(); noReason.works[0].reason = '';
assert.throws(() => buildFeaturedSelection(noReason, visible, renders), /curatorial reason/);
const noHomepage = copy(); delete noHomepage.works[0].homepage;
assert.throws(() => buildFeaturedSelection(noHomepage, visible, renders), /homepage decision/);
const unknown = copy(); unknown.works[0].slug = 'fixture/missing';
assert.throws(() => buildFeaturedSelection(unknown, visible, renders), /public model/);
const hidden = visible.map(work => work.slug === selected[0].slug ? { ...work, hidden: true } : work);
assert.throws(() => buildFeaturedSelection(review, hidden, renders), /public model/);
const noRender = new Set(renders); noRender.delete(selected[0].slug);
assert.throws(() => buildFeaturedSelection(review, visible, noRender), /rendered thumbnail/);
const noModel = visible.map(work => work.slug === selected[0].slug ? { ...work, hasPreview: false } : work);
assert.throws(() => buildFeaturedSelection(review, noModel, renders), /public model/);
assert.throws(() => homepageHeroForDate(selected, {}), /loading budget/);
assert.throws(() => featuredForDate([]), /reviewed featured/);
console.log(`Featured collection: ${selected.length} reviewed works; ${heroes.size} homepage models; full weekly/three-day rotations, future imports, public/model/render gates and failure paths passed.`);
