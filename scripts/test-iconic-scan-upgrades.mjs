import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { physicalDimensionsFor } from '../src/lib/physical-dimensions.mjs';
import { canonicalFingerprint, spatialEligibilityFor } from '../src/lib/spatial-eligibility.mjs';

const BATCH = 'iconic-scan-upgrades-20261006';
const TARGET_SLUGS = Object.freeze([
  'michelangelo/david',
  'michelangelo/pieta',
  'michelangelo/moses',
  'venus-de-milo',
  'discobolus',
  'laocoon',
  'dying-gaul',
  'belvedere-torso',
]);
const CAST_SLUGS = new Set(TARGET_SLUGS.filter(slug => slug !== 'michelangelo/david'));
const EXPECTED = Object.freeze({
  'michelangelo/david': Object.freeze({ dimensions: 'H 517 cm', meters: 5.17, sourceBytes: 59997484, sourceFaces: 1199948 }),
  'michelangelo/pieta': Object.freeze({ dimensions: 'H 176 cm × W 170 cm × D 89 cm', meters: 1.76, sourceBytes: 74905984, sourceFaces: 1498118 }),
  'michelangelo/moses': Object.freeze({ dimensions: 'H 249 cm × W 110 cm × D 107 cm', meters: 2.49, sourceBytes: 100004584, sourceFaces: 2000090 }),
  'venus-de-milo': Object.freeze({ dimensions: 'H 213.5 cm × W 66.5 cm × D 63 cm', meters: 2.135, sourceBytes: 137129384, sourceFaces: 2742586 }),
  discobolus: Object.freeze({ dimensions: 'H 170 cm × W 115 cm × D 50 cm', meters: 1.7, sourceBytes: 100849784, sourceFaces: 2016994 }),
  laocoon: Object.freeze({ dimensions: 'H 242 cm × W 162.5 cm × D 103 cm', meters: 2.42, sourceBytes: 50000084, sourceFaces: 1000000 }),
  'dying-gaul': Object.freeze({ dimensions: 'H 96 cm × W 185 cm × D 89 cm', meters: 0.96, sourceBytes: 200001084, sourceFaces: 4000020 }),
  'belvedere-torso': Object.freeze({ dimensions: 'H 122 cm × W 79 cm × D 90 cm', meters: 1.22, sourceBytes: 51021584, sourceFaces: 1020430 }),
});
const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const metersFor = measure => measure.value * { mm: 0.001, cm: 0.01, m: 1 }[measure.unit];

const before = readJson(`docs/ingest/${BATCH}-before.json`);
const leadsDocument = readJson(`docs/ingest/${BATCH}-leads.json`);
const selectionDocument = readJson(`docs/ingest/${BATCH}-selected-orientations.json`);
const catalog = readJson('src/data/catalog.json');
const previews = readJson('src/data/previews.json');
const renders = readJson('src/data/renders.json');
const orientations = readJson('src/data/orientations.json');
const physical = readJson('src/data/physical-dimensions.json');
const eligibility = readJson('src/data/spatial-eligibility.json');
const appearances = readJson('src/data/appearance-overrides.json');
const spatialDefaults = readJson('src/data/spatial-display-defaults.json');

assert.equal(before.schema, 'atrium-iconic-scan-replacement-before/1');
assert.equal(before.batch, BATCH);
assert.deepEqual(new Set(before.slugs), new Set(TARGET_SLUGS));
assert.equal(leadsDocument.schema, 'atrium-acquisition-leads/1');
assert.equal(leadsDocument.expected_count, TARGET_SLUGS.length);
assert.equal(leadsDocument.strict_acquisition, true);
assert.equal(selectionDocument.schema, 'atrium-iconic-orientation-selection/1');
assert.equal(selectionDocument.batch, BATCH);
assert.match(selectionDocument.review_commit, /^[a-f0-9]{40}$/);
assert.match(selectionDocument.reviewed, /^\d{4}-\d{2}-\d{2}$/);

const leads = new Map((leadsDocument.candidates || []).map(lead => [lead.slug, lead]));
assert.equal(leads.size, TARGET_SLUGS.length, 'The strict lead manifest must contain exactly eight unique works');
assert.deepEqual(new Set(leads.keys()), new Set(TARGET_SLUGS));
assert.deepEqual(new Set(Object.keys(selectionDocument.selections || {})), new Set(TARGET_SLUGS));

const directVariants = Object.freeze({
  B: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([0, 0, 0]), yaw: 0 }),
  C: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([180, 0, 0]), yaw: 0 }),
  D: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([-90, 0, 0]), yaw: 0 }),
  E: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([90, 0, 0]), yaw: 0 }),
  F: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([0, 0, 90]), yaw: 0 }),
  G: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([0, 0, -90]), yaw: 0 }),
});
const yawVariants = Object.freeze({ H: 90, I: 180, J: 270 });

function assertSelectedOrientation(selection, current, slug) {
  assert.ok(selection && typeof selection === 'object' && !Array.isArray(selection), `${slug}: missing orientation selection`);
  assert.match(selection.variant || '', /^[A-J]$/, `${slug}: orientation variant must be A-J`);
  assert.equal(typeof selection.note, 'string', `${slug}: orientation review note is required`);
  assert.ok(selection.note.trim(), `${slug}: orientation review note is empty`);
  if (hasOwn(directVariants, selection.variant)) {
    assert.deepEqual(
      current,
      { ...structuredClone(directVariants[selection.variant]), status: 'review', note: selection.note },
      `${slug}: current orientation differs from retained variant ${selection.variant}`,
    );
    return;
  }
  if (selection.variant === 'A' && current === null) return;
  assert.ok(current && typeof current === 'object' && !Array.isArray(current), `${slug}: selected orientation is missing`);
  assert.equal(current.status, 'review', `${slug}: selected orientation is not marked reviewed`);
  assert.equal(current.note, selection.note, `${slug}: current orientation note differs from the retained selection`);
  if (selection.variant === 'A') {
    assert.equal(current.yaw || 0, 0, `${slug}: retained variant A must keep the acquisition yaw`);
    return;
  }
  assert.equal(current.yaw, yawVariants[selection.variant], `${slug}: retained yaw variant changed`);
}

for (const slug of TARGET_SLUGS) {
  const lead = leads.get(slug);
  const prior = before.catalog[slug];
  const selection = selectionDocument.selections[slug];
  const currentOrientation = orientations[slug] ?? null;
  const record = physical[slug];
  const preview = previews[slug];
  const decision = eligibility[slug];
  const isCast = CAST_SLUGS.has(slug);
  const expectedWork = EXPECTED[slug];

  assert.ok(lead, `${slug}: strict source lead missing`);
  assert.ok(prior, `${slug}: canonical before-state missing`);
  assert.equal(lead.require_measured_integrity, true, `${slug}: strict source integrity must remain required`);
  assert.match(lead.expected_sha256, /^[a-f0-9]{64}$/, `${slug}: source SHA-256 is not pinned`);
  assert.equal(lead.dimensions, expectedWork.dimensions, `${slug}: strict lead dimensions changed`);
  assert.equal(lead.download_size_bytes, expectedWork.sourceBytes, `${slug}: strict lead source byte count changed`);
  assert.equal(lead.face_count, expectedWork.sourceFaces, `${slug}: strict lead source face count changed`);
  assert.ok(Array.isArray(lead.measures) && lead.measures.length >= 1, `${slug}: exact source measurements missing`);
  assert.equal(lead.measures[0].axis, 'height', `${slug}: first exact measurement must be height`);
  assert.equal(metersFor(lead.measures[0]), expectedWork.meters, `${slug}: strict lead height changed`);

  const matches = catalog.flatMap((work, index) => work.slug === slug ? [{ work, index }] : []);
  assert.equal(matches.length, 1, `${slug}: catalog must contain exactly one record`);
  const { work, index } = matches[0];
  assert.equal(index + 1, prior.index, `${slug}: canonical catalog position changed`);
  assert.equal(work.index, prior.index, `${slug}: stored catalog index changed`);
  assert.equal(work.total, catalog.length, `${slug}: stored catalog total is stale`);
  assert.equal(work.tier, prior.tier, `${slug}: canonical tier changed`);
  assert.equal(work.dimensions, expectedWork.dimensions, `${slug}: catalog dimensions do not describe the digitized object`);
  assert.equal(work.material, lead.material, `${slug}: catalog material does not describe the digitized object`);
  assert.equal(work.accession, lead.accession, `${slug}: catalog accession differs from the strict source`);
  assert.equal(work.source_record_url, lead.source_record_url, `${slug}: catalog source record differs from the strict lead`);
  assert.equal(work.model?.format, lead.download_format, `${slug}: catalog source format differs from the strict lead`);
  assert.equal(work.model?.sizeBytes, lead.download_size_bytes, `${slug}: catalog source byte count differs from the strict lead`);
  if (isCast) assert.equal(hasOwn(work, 'wikidata'), false, `${slug}: a cast must not carry the underlying original's Wikidata ID`);

  assert.ok(record && typeof record === 'object', `${slug}: physical record missing`);
  assert.equal(record.status, 'documented', `${slug}: exact physical record must be documented`);
  assert.equal(record.basis, isCast ? 'object' : 'original', `${slug}: physical basis does not match the scanned object`);
  assert.equal(record.dimensions, expectedWork.dimensions, `${slug}: top-level dimensions differ from the exact scanned-object dimensions`);
  assert.equal(record.sourceUrl, lead.source_record_url, `${slug}: physical evidence is not bound to the strict source record`);
  assert.equal(record.checked, selectionDocument.reviewed, `${slug}: physical review date differs from the retained selection`);
  assert.equal(record.reviewed, selectionDocument.reviewed, `${slug}: physical review date differs from the retained selection`);
  assert.equal(record.calibrationReady, true, `${slug}: exact calibration is not marked ready`);
  assert.equal(record.geometryStatus, 'calibrated', `${slug}: exact geometry is not marked calibrated`);
  assert.equal(record.measures.length, lead.measures.length, `${slug}: top-level measurement count changed`);
  for (let measurementIndex = 0; measurementIndex < lead.measures.length; measurementIndex++) {
    const expected = lead.measures[measurementIndex];
    const actual = record.measures[measurementIndex];
    assert.deepEqual(
      { axis: actual.axis, value: actual.value, unit: actual.unit, scope: actual.scope },
      { axis: expected.axis, value: expected.value, unit: expected.unit, scope: expected.scope },
      `${slug}: exact measurement ${measurementIndex} changed`,
    );
    assert.equal(actual.meters, metersFor(expected), `${slug}: measurement ${measurementIndex} metric conversion changed`);
    assert.deepEqual(actual.sourceUrls, [lead.source_record_url], `${slug}: measurement ${measurementIndex} source binding changed`);
  }

  const expectedHeightMeters = expectedWork.meters;
  assert.equal(record.spatial?.axis, 'y', `${slug}: reviewed height must map to world Y`);
  assert.equal(record.spatial?.meters, expectedHeightMeters, `${slug}: exact reference scale changed`);
  assert.equal(record.spatial?.measurementIndex, 0, `${slug}: exact height must be the scale measurement`);
  assert.equal(record.spatial?.previewUrl, preview?.url, `${slug}: physical record points at a different preview`);
  assert.match(record.spatial?.assetSha256 || '', /^[a-f0-9]{64}$/, `${slug}: physical asset hash missing`);

  if (isCast) {
    assert.ok(record.scannedObject && typeof record.scannedObject === 'object', `${slug}: exact cast identity must be stored as scannedObject`);
    assert.equal(record.scannedObject.accession, lead.accession, `${slug}: scanned cast accession changed`);
    assert.equal(hasOwn(record, 'identifiedObject'), false, `${slug}: the scanned cast must not be presented as the underlying original`);
    assert.equal(hasOwn(record, 'originalDimensions'), true, `${slug}: prior original dimensions/research status was not preserved`);
    assert.equal(typeof record.originalDimensions, 'string', `${slug}: originalDimensions must preserve the prior text, including an empty unresolved value`);
    assert.ok(record.originalSizeResearch && typeof record.originalSizeResearch === 'object', `${slug}: prior original-size research was not preserved separately`);
    assert.equal(record.originalSizeResearch.basis, 'original', `${slug}: preserved original research must retain original basis`);
    assert.equal(hasOwn(record.originalSizeResearch, 'spatial'), false, `${slug}: superseded asset calibration leaked into original research`);
  } else {
    assert.ok(record.identifiedObject && typeof record.identifiedObject === 'object', `${slug}: original artwork identity must be stored as identifiedObject`);
    assert.equal(record.identifiedObject.accession, lead.accession, `${slug}: original artwork accession changed`);
    assert.equal(hasOwn(record, 'scannedObject'), false, `${slug}: original David must not be labelled as a cast scan`);
  }

  assert.ok(preview && typeof preview === 'object', `${slug}: preview binding missing`);
  assert.equal(preview.sourceBytes, expectedWork.sourceBytes, `${slug}: preview source byte count changed`);
  assert.equal(preview.sourceFaces, expectedWork.sourceFaces, `${slug}: preview source face count changed`);
  assert.equal(preview.sourceFormat, lead.download_format, `${slug}: preview source format changed`);
  assert.ok(Number.isInteger(preview.bytes) && preview.bytes > 0, `${slug}: optimized preview byte count missing`);
  assert.ok(Number.isInteger(preview.faces) && preview.faces >= 100000, `${slug}: full-quality preview face count is unexpectedly low`);
  assert.ok(preview.faces <= leadsDocument.expected_preview_faces, `${slug}: preview exceeds the reviewed face ceiling`);
  assert.match(preview.url, /^https:\/\/models\.atrium\.earth\/models\/previews\//, `${slug}: preview is not served from Atrium's model origin`);
  assert.ok(preview.url.endsWith(`/preview-${record.spatial.assetSha256.slice(0, 12)}.glb`), `${slug}: preview URL is not content-addressed to the reviewed asset`);

  assert.equal(decision?.enabled, true, `${slug}: exact-size presentation is not enabled`);
  assert.equal(decision.kind, isCast ? 'cast' : 'original', `${slug}: eligibility representation kind is wrong`);
  assert.equal(decision.modelUrl, preview.url, `${slug}: eligibility points at a different preview`);
  assert.equal(decision.assetSha256, record.spatial.assetSha256, `${slug}: eligibility points at a different asset hash`);
  const spatialReference = physicalDimensionsFor('', record, preview.url, currentOrientation ?? undefined).spatialReference;
  assert.deepEqual(spatialReference, { axis: 'y', meters: expectedHeightMeters }, `${slug}: exact physical reference no longer resolves`);
  const evaluated = spatialEligibilityFor({
    slug,
    record,
    previewUrl: preview.url,
    orientation: currentOrientation ?? undefined,
    spatialReference,
  }, decision);
  assert.equal(evaluated.enabled, true, `${slug}: saved evidence/model/orientation binding no longer validates`);
  assert.equal(evaluated.kind, isCast ? 'cast' : 'original', `${slug}: evaluated representation kind is wrong`);

  assertSelectedOrientation(selection, currentOrientation, slug);
  assert.deepEqual(record.spatial.orientation ?? null, currentOrientation, `${slug}: physical calibration uses a different orientation`);
  assert.equal(decision.orientationFingerprint, canonicalFingerprint(currentOrientation), `${slug}: eligibility orientation fingerprint is stale`);
  assert.equal(selection.asset_sha256, record.spatial.assetSha256, `${slug}: selection is bound to a different optimized asset`);
  const sheetPath = `docs/ingest/${BATCH}-orientation-review/${slug.replaceAll('/', '__')}.webp`;
  const sheet = readFileSync(new URL(`../${sheetPath}`, import.meta.url));
  assert.ok(sheet.length > 0, `${slug}: retained orientation sheet is empty`);
  assert.equal(selection.sheet_sha256, sha256(sheet), `${slug}: retained orientation sheet differs from the selection record`);

  assert.equal(appearances[slug]?.profile, isCast ? 'plaster' : 'marble', `${slug}: material appearance profile is wrong`);
  assert.equal(hasOwn(spatialDefaults, slug), false, `${slug}: approximate display preset survived exact calibration`);

  assert.equal(renders.filter(renderedSlug => renderedSlug === slug).length, 1, `${slug}: render manifest must contain exactly one entry`);
  const thumb = readFileSync(new URL(`../public/previews/renders/${slug}/thumb.webp`, import.meta.url));
  const poster = readFileSync(new URL(`../public/previews/posters/${slug}/poster.svg`, import.meta.url), 'utf8');
  assert.ok(thumb.length > 0, `${slug}: thumbnail is empty`);
  assert.ok(poster.length > 0, `${slug}: poster is empty`);
  const embedded = poster.match(/(?:href|xlink:href)=["']data:image\/webp;base64,([^"']+)["']/)?.[1];
  assert.ok(embedded, `${slug}: poster does not embed a WebP thumbnail`);
  assert.deepEqual(Buffer.from(embedded.replace(/\s/g, ''), 'base64'), thumb, `${slug}: poster embeds a different thumbnail`);
}

console.log(`Iconic scan upgrade checks passed: ${TARGET_SLUGS.length} exact full-quality sources, 1 original and ${CAST_SLUGS.size} measured casts, with retained orientations, appearance, size, assets and card renders.`);
