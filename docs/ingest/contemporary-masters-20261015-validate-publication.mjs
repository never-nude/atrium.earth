import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { physicalDimensionsFor } from '../../src/lib/physical-dimensions.mjs';
import { spatialEligibilityFor } from '../../src/lib/spatial-eligibility.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const gitRead = path => JSON.parse(execFileSync('git', ['show', `6309312c:${path}`], { maxBuffer: 40_000_000 }));
const batch = 'contemporary-masters-20261015';
const catalog = read('src/data/catalog.json'), previous = gitRead('src/data/catalog.json');
const previews = read('src/data/previews.json'), orientations = read('src/data/orientations.json');
const dimensions = read('src/data/physical-dimensions.json'), decisions = read('src/data/spatial-eligibility.json');
const report = read(`docs/ingest/${batch}-run-38781260868/last-report.json`);
const fetched = read(`docs/ingest/${batch}-run-38781260868/fetched.json`).candidates;
const leads = read(`docs/ingest/${batch}-leads.json`).candidates;
const poseReview = read(`docs/ingest/${batch}-pose-review.json`);
const selected = catalog.filter(work => work.ingest_batch === batch);
const visible = selected.filter(work => !work.hidden);
const priorFields = record => Object.fromEntries(Object.entries(record).filter(([key]) => !['index', 'total'].includes(key)));
for (const work of previous) {
  assert.deepEqual(priorFields(catalog.find(row => row.slug === work.slug)), priorFields(work), `Prior work preserved: ${work.slug}`);
}
for (const file of ['previews', 'orientations', 'physical-dimensions', 'spatial-eligibility']) {
  const before = gitRead(`src/data/${file}.json`), after = read(`src/data/${file}.json`);
  for (const [slug, value] of Object.entries(before)) assert.deepEqual(after[slug], value, `Prior ${file}: ${slug}`);
}
assert.deepEqual(read('src/data/featured-works.json'), gitRead('src/data/featured-works.json'), 'Featured selection preserved');
assert.equal(previous.length, 1929);
assert.equal(catalog.length, 1951);
assert.equal(fetched.length, 24);
assert.equal(report.accepted.length, 22);
assert.equal(report.rejected.length, 2);
assert.equal(selected.length, 22);
assert.equal(visible.length, 20);
assert.equal(selected.filter(work => work.hidden && work.exclude_from_additions && work.quality_hold_reason).length, 2);
assert.deepEqual([...report.accepted, ...report.rejected].map(row => row.slug).sort(), leads.map(row => row.slug).sort());

for (const lead of leads) {
  assert.equal(lead.require_measured_integrity, true);
  assert.equal(lead.allow_componentized_mesh, undefined);
  const source = fetched.find(row => row.slug === lead.slug);
  assert.equal(source.uid, lead.uid);
  assert.equal(source.license, 'CC BY 4.0');
  assert.equal(source.license_url, 'https://creativecommons.org/licenses/by/4.0/');
  assert.match(source.fetched.sha256, /^[a-f0-9]{64}$/);
  assert.equal(source.fetched.bytes, source.fetched.original_download_bytes);
  assert.equal(source.fetched.decoded, false);
}
for (const work of visible) {
  assert.doesNotMatch(work.artist, /Turrell|Do Ho Suh|Carlos Cruz.Diez/i);
  const source = fetched.find(row => row.slug === work.slug);
  assert.equal(work.model.sizeBytes, source.fetched.bytes, work.slug);
  if (work.wing === 'unfiled') {
    assert.ok(work.wing_unfiled_reason.length >= 30, work.slug);
    assert.equal(work.original_location, '', work.slug);
  }
  const integrity = report.accepted.find(row => row.slug === work.slug).integrity_data;
  assert.ok(integrity.faces > 0 && integrity.ncomp <= 50 && integrity.bratio <= 0.3 && integrity.largest_frac >= 0.5, work.slug);
  assert.equal(orientations[work.slug]?.status, 'reviewed', `Reviewed pose: ${work.slug}`);
  const reviewed = poseReview.works.find(row => row.slug === work.slug);
  assert.ok(reviewed, `Pose evidence: ${work.slug}`);
  assert.deepEqual(orientations[work.slug], reviewed.orientation, work.slug);
  const bytes = readFileSync(`public/models/previews/${work.slug}/preview.glb`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, reviewed.preview_sha256, work.slug);
  assert.ok(previews[work.slug].url.includes(`preview-${hash.slice(0, 12)}.glb`), work.slug);
  assert.ok(existsSync(`public/previews/renders/${work.slug}/thumb.webp`), work.slug);
  assert.ok(existsSync(`public/previews/posters/${work.slug}/poster.svg`), work.slug);
  assert.ok(dimensions[work.slug]?.checked && dimensions[work.slug].basis === 'object', work.slug);
  assert.ok(!dimensions[work.slug].spatial, `No invented size calibration: ${work.slug}`);
  const physical = physicalDimensionsFor(work.dimensions, dimensions[work.slug], previews[work.slug].url, orientations[work.slug]);
  assert.equal(physical.spatialReference, null, work.slug);
  assert.equal(decisions[work.slug]?.enabled, false, work.slug);
  assert.equal(spatialEligibilityFor({ slug: work.slug, record: dimensions[work.slug], previewUrl: previews[work.slug].url,
    orientation: orientations[work.slug], spatialReference: physical.spatialReference }, decisions[work.slug]).enabled, false, work.slug);
}
const friend = visible.find(work => work.slug === 'modern/josh-smith-friend');
assert.equal(friend.current_location, '');
assert.equal(friend.displayed_at, '');
assert.ok(friend.historical_displayed_at.includes('2023'));
const milan = visible.find(work => work.slug === 'modern/joan-miro-projet-pour-un-monument-c07aae');
assert.equal(milan.title, 'Projet pour un monument');
assert.equal(milan.year, '1981');
assert.equal(milan.accession, '');
assert.equal(milan.dimensions, '');
const featured = read('src/data/featured-works.json');
assert.ok(!JSON.stringify(featured).includes('c07aae'), 'No unreviewed featured promotion');
console.log('Contemporary publication subset: 24 sources, 22 measured outcomes, 20 public works, 2 visual holds, preserved 1,929 earlier records and featured selection, exact asset/pose bindings and no false verified size.');
