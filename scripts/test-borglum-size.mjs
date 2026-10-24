import assert from 'node:assert/strict';
import fs from 'node:fs';
import { approximateDimensionsFor } from '../src/lib/approximate-dimensions.mjs';
import { physicalDimensionsFor } from '../src/lib/physical-dimensions.mjs';
import { spatialEligibilityFor } from '../src/lib/spatial-eligibility.mjs';
import { spatialAccessFor } from '../src/lib/spatial-access.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const catalog = read('catalog'), records = read('physical-dimensions'), previews = read('previews');
const orientations = read('orientations'), eligibilityRecords = read('spatial-eligibility');
const displayDefaults = read('spatial-display-defaults');
const leads = JSON.parse(fs.readFileSync(new URL('../docs/ingest/gutzon-borglum-20261024-leads.json', import.meta.url)));
const batch = 'gutzon-borglum-20261024';
const lincolnSlug = 'americas-oceania/borglum-abraham-lincoln-kentucky';
const aviatorSlug = 'americas-oceania/borglum-aviator-uva';

function accessFor(work, record, previewUrl, orientation, decision, displayDefault) {
  const physical = physicalDimensionsFor(work.dimensions, record, previewUrl, orientation);
  const eligibility = spatialEligibilityFor({ slug: work.slug, record, previewUrl, orientation,
    spatialReference: physical.spatialReference }, decision);
  const approximation = eligibility.enabled ? null : approximateDimensionsFor({ work, record,
    previewUrl, orientation, spatialReference: physical.spatialReference });
  return { physical, eligibility, approximation,
    access: spatialAccessFor(eligibility, previewUrl, displayDefault, approximation, physical.spatialReference) };
}

// The published batch contains the exact Kentucky object, with its size unknown.
const selected = catalog.filter(work => work.ingest_batch === batch);
assert.deepEqual(selected.map(work => work.slug), [lincolnSlug]);
const lincoln = selected[0], record = records[lincolnSlug];
assert.equal(lincoln.dimensions, '');
assert.equal(record.status, 'unknown');
assert.equal(record.basis, 'object');
assert.equal(record.calibrationReady, false);
assert.deepEqual(record.measures, []);
assert.equal(eligibilityRecords[lincolnSlug].enabled, false);
assert.match(lincoln.note, /dimensions.*unconfirmed|dimensions.*unknown/i);
const result = accessFor(lincoln, record, previews[lincolnSlug].url, orientations[lincolnSlug],
  eligibilityRecords[lincolnSlug], displayDefaults[lincolnSlug]);
assert.equal(result.physical.spatialReference, null);
assert.equal(result.eligibility.enabled, false);
assert.equal(result.approximation?.reference, undefined);
assert.equal(result.access.status, 'unknown');
assert.equal(result.access.verified, false);
assert.equal(result.access.reference, undefined);
assert.equal(result.access.defaultMaxExtentMeters, 1);
assert.match(result.access.sizeLabel, /Default: 1 m on longest side/);
assert.match(result.access.note, /chosen display size/);

// Aviator remains a held source. Its public source evidence retains component
// measurements so this prospective check exercises the real parser mismatch.
assert.ok(!catalog.some(work => work.slug === aviatorSlug));
for (const map of [previews, records, orientations, eligibilityRecords]) assert.ok(!Object.hasOwn(map, aviatorSlug));
const aviator = leads.candidates.find(work => work.slug === aviatorSlug);
assert.ok(aviator);
assert.equal(aviator.dimensions, '');
assert.match(aviator.note, /12 feet high/);
assert.match(aviator.note, /365\.76/);
assert.match(aviator.note, /component measurements/);
const prospectiveRecord = { status: 'unknown', basis: 'object', dimensions: '', measures: [],
  sourceUrl: aviator.source_record_url, calibrationReady: false };
const prospectiveUrl = `https://models.atrium.earth/models/previews/${aviatorSlug}/preview-prospective.glb`;
const control = approximateDimensionsFor({ work: { ...aviator, slug: 'borglum-component-measurement-control' },
  record: prospectiveRecord, previewUrl: prospectiveUrl });
assert.ok(Math.abs(control.reference.meters - 3.6576) < 1e-10);
assert.equal(control.method, 'work-description');
const prospective = accessFor(aviator, prospectiveRecord, prospectiveUrl, undefined,
  { enabled: false, policyVersion: 1, reason: 'review' }, undefined);
assert.equal(prospective.approximation.reference, undefined);
assert.match(prospective.approximation.unavailableReason, /bronze figure.*stone pedestal/i);
assert.equal(prospective.access.status, 'unknown');
assert.equal(prospective.access.reference, undefined);
assert.equal(prospective.access.defaultMaxExtentMeters, 1);
console.log('Borglum sizing: accepted Lincoln remains unknown with a chosen 1 m display size; held Aviator stays unpublished and its figure-only measurements cannot size the assembly.');
