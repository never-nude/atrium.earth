#!/usr/bin/env node
// Promote the eight reviewed iconic-scan replacements from a disposable review
// ref into their existing canonical catalogue slots.
//
// This script is intentionally strict and is a no-op unless --apply is passed.
// It must be run while the canonical integration branch is checked out:
//
//   node scripts/integrate-iconic-scan-review.mjs \
//     --review-ref=origin/codex/iconic-scan-upgrades-20261006-review-RUN-1 \
//     --orientation-overrides=docs/ingest/iconic-scan-upgrades-20261006-selected-orientations.json \
//     --apply
//
// The orientation file records one reviewed A-J sheet variant per work and
// binds each choice to the exact review-sheet and preview hashes.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, repoRoot, searchText } from './ingest-utils.mjs';
import { canonicalFingerprint, spatialEligibilityBindingFor } from '../src/lib/spatial-eligibility.mjs';

const BATCH = 'iconic-scan-upgrades-20261006';
const LEADS_PATH = `docs/ingest/${BATCH}-leads.json`;
const DEFAULT_CANONICAL_BRANCH = 'codex/iconic-scan-upgrades-20261006';
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
const TARGET_SET = new Set(TARGET_SLUGS);
const APPROVED_SOURCES = Object.freeze({
  'michelangelo/david': Object.freeze({
    accession: 'Inv. Scult. n. 1076',
    format: 'stl',
    bytes: 59997484,
    sha256: 'b41ad68e2b7a7377251f11201b6f9ba9569fa16422bec3719223f205d001c6f9',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:David_(Michelangelo).stl',
    sourceRecordUrl: 'https://www.galleriaaccademiafirenze.it/en/artworks/david-michelangelo/',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/David_%28Michelangelo%29.stl',
  }),
  'michelangelo/pieta': Object.freeze({
    accession: 'KAS115',
    format: 'stl',
    bytes: 74905984,
    sha256: '845ceb2f7b28430b1d73c3f77b494f2908edcff4690d86ab812beb0507a3394f',
    sourceUrl: 'https://open.smk.dk/artwork/image/KAS115',
    sourceRecordUrl: 'https://api.smk.dk/api/v1/art?object_number=KAS115&lang=en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Michelangelo_Buonarroti%2C_Maria_med_den_d%C3%B8de_Jesus%2C_Peterskirkepiet%C3%A0%2C_%2C_KAS115%2C_Statens_Museum_for_Kunst%2C_3D_model.stl',
  }),
  'michelangelo/moses': Object.freeze({
    accession: 'KAS243',
    format: 'stl',
    bytes: 100004584,
    sha256: 'a208c49a59bd5ca5083cdc00708a138e54ef02b318370b7dc626d7d7a11b9df5',
    sourceUrl: 'https://open.smk.dk/artwork/image/KAS243',
    sourceRecordUrl: 'https://api.smk.dk/api/v1/art?object_number=KAS243&lang=en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Michelangelo_Buonarroti%2C_Moses%2C_%2C_KAS243%2C_Statens_Museum_for_Kunst%2C_3D_model.stl',
  }),
  'venus-de-milo': Object.freeze({
    accession: 'KAS434/1',
    format: 'stl',
    bytes: 137129384,
    sha256: '3b2fdc98971894812a24ff7d3675bb352ccd113a7f0609b2c8cfed6bacfab177',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Venus_(Afrodite)_fra_Milo_-_KAS434_1.stl',
    sourceRecordUrl: 'https://api.smk.dk/api/v1/art?object_number=KAS434%2F1&lang=en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Venus_%28Afrodite%29_fra_Milo_-_KAS434_1.stl',
  }),
  discobolus: Object.freeze({
    accession: 'KAS1549',
    format: 'stl',
    bytes: 100849784,
    sha256: 'f1c9457f52590725ec6159cc9646f1a4517fa3d5360694ea9f7f1c7e8561ebd8',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Diskoskasteren_(Discobolos)_-_KAS1549.stl',
    sourceRecordUrl: 'https://api.smk.dk/api/v1/art?object_number=KAS1549&lang=en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Diskoskasteren_%28Discobolos%29_-_KAS1549.stl',
  }),
  laocoon: Object.freeze({
    accession: 'KAS385',
    format: 'stl',
    bytes: 50000084,
    sha256: '288aba62cd966aebc67d8b62edc79d6467766c2f794c1c7f354bf3eac2c7d707',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ubekendt,_Laokoon_og_hans_to_s%C3%B8nner_dr%C3%A6bes_af_slanger,_,_KAS385,_Statens_Museum_for_Kunst,_3D_model.stl',
    sourceRecordUrl: 'https://api.smk.dk/api/v1/art?object_number=KAS385&lang=en',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Ubekendt%2C_Laokoon_og_hans_to_s%C3%B8nner_dr%C3%A6bes_af_slanger%2C_%2C_KAS385%2C_Statens_Museum_for_Kunst%2C_3D_model.stl',
  }),
  'dying-gaul': Object.freeze({
    accession: 'KAS1312',
    format: 'stl',
    bytes: 200001084,
    sha256: '4246ebd08faad0d3a83adf9d77e1117a509e98cfe93afe5e3ca36abc1ef7c2b2',
    sourceUrl: 'https://open.smk.dk/artwork/image/KAS1312',
    sourceRecordUrl: 'https://api.smk.dk/api/v1/art?object_number=KAS1312&lang=en',
    downloadUrl: 'https://api.smk.dk/api/v1/download-3d/4f16c782s_smk-190-inv-dying-gladiator.stl',
  }),
  'belvedere-torso': Object.freeze({
    accession: 'KAS402',
    format: 'stl',
    bytes: 51021584,
    sha256: '63899e19bf2526b3dc95a4d6781d5a7aea6f5e8d9ed480e8006994d10019b085',
    sourceUrl: 'https://open.smk.dk/artwork/image/KAS402',
    sourceRecordUrl: 'https://api.smk.dk/api/v1/art?object_number=KAS402&lang=en',
    downloadUrl: 'https://api.smk.dk/api/v1/download-3d/gq67jw94x_smk1-kas402-belvedere-torso.stl',
  }),
});
const PRESERVED_CATALOGUE_FIELDS = Object.freeze([
  'tier',
  'ingest_batch',
  'ingested_at',
  'ingested',
  'exclude_from_additions',
  'additions_note',
  'hidden',
]);
const DATA_PATHS = Object.freeze({
  catalog: 'src/data/catalog.json',
  previews: 'src/data/previews.json',
  renders: 'src/data/renders.json',
  orientations: 'src/data/orientations.json',
  physical: 'src/data/physical-dimensions.json',
  eligibility: 'src/data/spatial-eligibility.json',
  spatialDefaults: 'src/data/spatial-display-defaults.json',
  appearances: 'src/data/appearance-overrides.json',
  recommendations: 'src/data/display-recommendations.json',
});

function usage() {
  return `Usage:
  node scripts/integrate-iconic-scan-review.mjs --review-ref=REF [--orientation-overrides=FILE] [--reviewed=YYYY-MM-DD] [--run-report=REF_PATH] [--canonical-branch=BRANCH] [--apply]

Without --apply, all inputs are validated and an integration plan is printed without changing files.
The orientation file must use schema atrium-iconic-orientation-selection/1 and explicitly select an A-J review-sheet variant for all eight works.`;
}

function fail(message) {
  throw new Error(message);
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });
}

function resolveCommit(ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || !/^[A-Za-z0-9._/-]+$/.test(ref)) {
    fail(`Unsafe or empty review ref: ${JSON.stringify(ref)}`);
  }
  try {
    return git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  } catch {
    fail(`Review ref does not resolve to a commit: ${ref}`);
  }
}

function gitText(commit, file) {
  try {
    return git(['show', `${commit}:${file}`]);
  } catch {
    fail(`Review ref is missing ${file}`);
  }
}

function gitJson(commit, file) {
  try {
    return JSON.parse(gitText(commit, file));
  } catch (error) {
    if (/Review ref is missing/.test(error.message)) throw error;
    fail(`Review ref contains invalid JSON at ${file}: ${error.message}`);
  }
}

function gitBlob(commit, file) {
  try {
    return git(['show', `${commit}:${file}`], { encoding: null });
  } catch {
    fail(`Review ref is missing ${file}`);
  }
}

function exactMembers(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((value) => !actualSet.has(value));
  const extra = [...actualSet].filter((value) => !expectedSet.has(value));
  if (actual.length !== actualSet.size || missing.length || extra.length) {
    fail(`${label} must contain exactly ${expected.length} unique target slugs; missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'}`);
  }
}

function byUniqueSlug(items, label) {
  const result = new Map();
  for (const item of items || []) {
    if (!item?.slug) fail(`${label} contains an item without a slug`);
    if (result.has(item.slug)) fail(`${label} contains duplicate slug ${item.slug}`);
    result.set(item.slug, item);
  }
  return result;
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ''));
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertExact(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} differs: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function validateOrientation(value, slug) {
  if (value === null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${slug}: orientation must be an object or null`);
  if (value.status !== 'review') fail(`${slug}: selected orientation must have status "review"`);
  const allowedFields = new Set(['upAxis', 'axis', 'modelRotation', 'rotation', 'viewDirection', 'cameraDirection', 'fit', 'yaw', 'status', 'note']);
  const unknownFields = Object.keys(value).filter((field) => !allowedFields.has(field));
  if (unknownFields.length) fail(`${slug}: orientation has unknown fields: ${unknownFields.join(', ')}`);
  if (value.modelRotation !== undefined && value.rotation !== undefined) fail(`${slug}: orientation cannot define both modelRotation and rotation`);
  for (const field of ['upAxis', 'axis']) {
    if (value[field] !== undefined && !['auto', 'x', 'y', 'z'].includes(value[field])) {
      fail(`${slug}: orientation ${field} must be auto, x, y or z`);
    }
  }
  const vectorFields = ['modelRotation', 'rotation', 'viewDirection', 'cameraDirection'];
  for (const field of vectorFields) {
    if (value[field] === undefined) continue;
    if (!Array.isArray(value[field]) || value[field].length !== 3 || value[field].some((number) => !Number.isFinite(number))) {
      fail(`${slug}: orientation ${field} must be a three-number vector`);
    }
  }
  for (const field of ['fit', 'yaw']) {
    if (value[field] !== undefined && !Number.isFinite(value[field])) fail(`${slug}: orientation ${field} must be finite`);
  }
  if (value.fit !== undefined && value.fit <= 0) fail(`${slug}: orientation fit must be positive`);
  if (!value.upAxis && !value.axis && !value.modelRotation && !value.rotation) {
    fail(`${slug}: reviewed orientation has no transform fields; use null for the identity transform`);
  }
}

const STATIC_ORIENTATION_VARIANTS = Object.freeze({
  B: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([0, 0, 0]), yaw: 0 }),
  C: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([180, 0, 0]), yaw: 0 }),
  D: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([-90, 0, 0]), yaw: 0 }),
  E: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([90, 0, 0]), yaw: 0 }),
  F: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([0, 0, 90]), yaw: 0 }),
  G: Object.freeze({ upAxis: 'y', modelRotation: Object.freeze([0, 0, -90]), yaw: 0 }),
});

function currentReviewTransform(reviewOrientations, slug) {
  const current = reviewOrientations[slug];
  if (!current || typeof current === 'string') return null;
  if (typeof current !== 'object' || Array.isArray(current)) fail(`${slug}: review orientation has an unexpected shape`);
  const allowed = new Set(['upAxis', 'axis', 'modelRotation', 'rotation', 'viewDirection', 'cameraDirection', 'fit', 'yaw']);
  const transform = {};
  for (const [field, value] of Object.entries(current)) {
    if (allowed.has(field)) transform[field] = structuredClone(value);
  }
  return Object.keys(transform).length ? transform : null;
}

function orientationForVariant({ slug, variant, note, reviewOrientations }) {
  if (!/^[A-J]$/.test(variant)) fail(`${slug}: orientation variant must be A-J`);
  let transform;
  if (variant === 'A') {
    transform = currentReviewTransform(reviewOrientations, slug);
  } else if (STATIC_ORIENTATION_VARIANTS[variant]) {
    transform = structuredClone(STATIC_ORIENTATION_VARIANTS[variant]);
  } else {
    const turn = { H: 90, I: 180, J: 270 }[variant];
    transform = currentReviewTransform(reviewOrientations, slug) || { upAxis: 'auto' };
    transform.yaw = (Number(transform.yaw) || 0) + turn;
  }
  if (transform === null) return null;
  const reviewed = {
    ...transform,
    status: 'review',
    note: note || `Selected variant ${variant} from the retained orientation review sheet.`,
  };
  validateOrientation(reviewed, slug);
  return reviewed;
}

function preservedReplacement(canonical, reviewed, position, total) {
  const replacement = structuredClone(reviewed);
  for (const field of PRESERVED_CATALOGUE_FIELDS) {
    if (Object.hasOwn(canonical, field)) replacement[field] = structuredClone(canonical[field]);
    else delete replacement[field];
  }
  replacement.slug = canonical.slug;
  replacement.tier = canonical.tier;
  if (canonical.slug === 'michelangelo/david' && Object.hasOwn(canonical, 'wikidata')) {
    replacement.wikidata = structuredClone(canonical.wikidata);
  } else {
    // These seven records describe exact SMK casts. A Wikidata identifier for
    // the underlying original would silently misidentify the published object.
    delete replacement.wikidata;
  }
  replacement.index = position + 1;
  replacement.total = total;
  replacement.search = searchText(replacement);
  return replacement;
}

function reviewNoteFor(slug, lead) {
  const scope = {
    'michelangelo/david': 'the complete original marble from the underside of its integral carved base to the top of the head',
    'michelangelo/pieta': 'the complete KAS115 plaster group and its documented net height',
    'michelangelo/moses': 'the complete KAS243 seated plaster cast, including the modeled lower figure and base',
    'venus-de-milo': 'the complete KAS434/1 plaster-cast component in its documented state',
    discobolus: 'the complete KAS1549 plaster cast with its documented modern restored head',
    laocoon: 'the complete KAS385 historical straight-arm plaster group and integral base',
    'dying-gaul': 'the complete reclining KAS1312 plaster cast from its lowest to highest modeled point',
    'belvedere-torso': 'the complete KAS402 plaster cast in its documented state, which lacks the lower inscribed base',
  }[slug];
  return `The full-quality replacement and selected orientation were reviewed across the batch orientation views. The scan shows ${scope}; the published ${lead.measures[0].scope.toLowerCase()} maps to the full world-Y extent after the selected orientation. Uniform scale preserves the scan's proportions.`;
}

function physicalRecordFor({ slug, lead, preview, assetSha256, orientation, reviewed }) {
  const isOriginal = slug === 'michelangelo/david';
  const sourceUrl = lead.source_record_url;
  const geometryReview = reviewNoteFor(slug, lead);
  const measures = lead.measures.map((measure, index) => ({
    ...structuredClone(measure),
    meters: measure.value * { mm: 0.001, cm: 0.01, m: 1 }[measure.unit],
    qualifier: 'exact',
    sourcePosition: index + 1,
    sourceUrls: [sourceUrl],
  }));
  const heightIndex = measures.findIndex((measure) => measure.axis === 'height');
  if (heightIndex < 0) fail(`${slug}: lead has no height measurement`);
  const height = measures[heightIndex];
  const objectIdentity = {
    title: lead.title,
    accession: lead.accession,
    institution: lead.current_location || lead.museum,
    record_url: sourceUrl,
    identity_confidence: 'high',
    match_explanation: isOriginal
      ? 'The approved source is a scan of Michelangelo’s original marble and the accession, institution and measurements agree with the Galleria dell’Accademia record.'
      : `The approved source is the maximum-resolution scan of the exact SMK plaster cast ${lead.accession}; its accession, material and measurements agree with the SMK object record.`,
  };
  const record = {
    dimensions: lead.dimensions,
    status: 'documented',
    basis: isOriginal ? 'original' : 'object',
    note: isOriginal
      ? 'Dimensions describe Michelangelo’s original marble and its integral carved base; the gallery display pedestal is excluded.'
      : `Dimensions describe the exact scanned SMK plaster cast ${lead.accession}, rather than the underlying ancient or Renaissance original.`,
    checked: reviewed,
    reviewed,
    researchStatus: 'verified',
    sourceUrl,
    sourceTitle: lead.source_institution,
    measures,
    ...(isOriginal
      ? { identifiedObject: objectIdentity }
      : { scannedObject: objectIdentity }),
    evidence: (lead.evidence || []).map((excerpt) => ({ sourceUrl, excerpt, retrieved: reviewed })),
    geometryStatus: 'calibrated',
    geometryReviewNote: geometryReview,
    calibrationReady: true,
    spatial: {
      axis: 'y',
      meters: height.meters,
      measurementIndex: heightIndex,
      previewUrl: preview.url,
      assetSha256,
      reviewed,
      geometryReview,
      note: geometryReview,
      ...(orientation === null ? {} : { orientation: structuredClone(orientation) }),
    },
    spatialNote: isOriginal
      ? 'Physical scale is calibrated to the documented original marble height. Proportions are preserved.'
      : `Physical scale is calibrated to the documented dimensions of SMK plaster cast ${lead.accession}. Proportions are preserved.`,
  };
  return record;
}

function sanitizedOriginalSizeResearch(research) {
  if (!research || typeof research !== 'object' || Array.isArray(research)) return null;
  const sanitized = {};
  // Preserve source research only. Geometry review, scale, preview and
  // calibration fields describe the superseded asset and must not survive.
  for (const field of [
    'dimensions', 'status', 'basis', 'note', 'checked', 'reviewed', 'researchStatus',
    'identifiedObject', 'measures', 'sourceUrl', 'sourceTitle', 'evidence',
  ]) {
    if (Object.hasOwn(research, field)) sanitized[field] = structuredClone(research[field]);
  }
  if (sanitized.identifiedObject) {
    // The former match explanation can include visual conclusions about the
    // superseded mesh. Retain the independently useful object identity only.
    delete sanitized.identifiedObject.match_explanation;
  }
  sanitized.basis = 'original';
  return Object.keys(sanitized).length === 1 ? null : sanitized;
}

function originalResearchFor(slug, currentRecord) {
  if (slug === 'michelangelo/david' || !currentRecord) return {};

  const originalDimensions = currentRecord.originalDimensions
    || (currentRecord.basis === 'original' ? currentRecord.dimensions : '');
  if (currentRecord.originalSizeResearch) {
    const originalSizeResearch = sanitizedOriginalSizeResearch(currentRecord.originalSizeResearch);
    return {
      originalDimensions,
      ...(originalSizeResearch ? { originalSizeResearch } : {}),
    };
  }

  if (slug === 'laocoon') {
    const measures = (currentRecord.measures || []).filter((measure) => /current Vatican marble|bent Pollak/i.test(measure.scope || ''));
    const originalSizeResearch = sanitizedOriginalSizeResearch({
      dimensions: 'H 208 cm × W 163 cm × D 112 cm (current Vatican marble group with bent Pollak arm)',
      status: 'documented',
      basis: 'original',
      note: 'These dimensions describe the current Vatican marble group with the bent Pollak arm, separate from the scanned KAS385 historical straight-arm cast.',
      checked: currentRecord.checked,
      researchStatus: currentRecord.researchStatus,
      identifiedObject: structuredClone(currentRecord.identifiedObject),
      measures: structuredClone(measures),
      sourceUrl: measures[0]?.sourceUrls?.[0] || currentRecord.identifiedObject?.record_url || '',
    });
    return {
      originalDimensions: originalSizeResearch.dimensions,
      originalSizeResearch,
    };
  }

  if (currentRecord.basis !== 'original') {
    return originalDimensions ? { originalDimensions } : {};
  }
  return {
    originalDimensions,
    originalSizeResearch: sanitizedOriginalSizeResearch(currentRecord),
  };
}

function eligibilityFor({ slug, record, preview, orientation, kind }) {
  const binding = spatialEligibilityBindingFor({
    slug,
    record,
    previewUrl: preview.url,
    orientation: orientation === null ? undefined : orientation,
  }, kind);
  return {
    enabled: true,
    ...binding,
    bindingFingerprint: canonicalFingerprint(binding),
  };
}

async function readJson(file) {
  return JSON.parse(await readFile(path.join(repoRoot, file), 'utf8'));
}

async function atomicWrite(file, body) {
  const destination = path.join(repoRoot, file);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.iconic-integration-${process.pid}.tmp`;
  await writeFile(temporary, body);
  await rename(temporary, destination);
}

async function atomicWriteJson(file, value) {
  await atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`);
}

const args = parseArgs();
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const reviewRef = args['review-ref'];
if (!reviewRef) fail(`--review-ref is required\n\n${usage()}`);
const canonicalBranch = String(args['canonical-branch'] || DEFAULT_CANONICAL_BRANCH);
const currentBranch = git(['branch', '--show-current']).trim();
if (currentBranch !== canonicalBranch) {
  fail(`Refusing to integrate on ${currentBranch || 'detached HEAD'}; check out ${canonicalBranch} first`);
}
const trackedChanges = git(['status', '--porcelain=v1', '--untracked-files=no']).trim();
if (trackedChanges) fail(`Refusing to integrate with tracked changes:\n${trackedChanges}`);

const reviewCommit = resolveCommit(reviewRef);
const reviewed = String(args.reviewed || new Date().toISOString().slice(0, 10));
if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewed)) fail('--reviewed must be YYYY-MM-DD');

const leadsDocument = gitJson(reviewCommit, LEADS_PATH);
const leads = leadsDocument.candidates || [];
if (leadsDocument.batch && leadsDocument.batch !== BATCH) fail(`Lead batch is ${leadsDocument.batch}, expected ${BATCH}`);
if (Number(leadsDocument.expected_count) !== TARGET_SLUGS.length) fail('Lead manifest does not require exactly eight pieces');
exactMembers(Object.keys(APPROVED_SOURCES), TARGET_SLUGS, 'Approved source map');
exactMembers(leads.map((lead) => lead.slug), TARGET_SLUGS, 'Lead manifest');
const leadsBySlug = byUniqueSlug(leads, 'Lead manifest');
for (const slug of TARGET_SLUGS) {
  const lead = leadsBySlug.get(slug);
  const approved = APPROVED_SOURCES[slug];
  assertExact(lead.accession, approved.accession, `${slug}: lead accession`);
  assertExact(lead.download_format, approved.format, `${slug}: lead source format`);
  assertExact(Number(lead.download_size_bytes), approved.bytes, `${slug}: lead source bytes`);
  assertExact(lead.expected_sha256, approved.sha256, `${slug}: lead source SHA-256`);
  assertExact(lead.source_url, approved.sourceUrl, `${slug}: lead source URL`);
  assertExact(lead.source_record_url, approved.sourceRecordUrl, `${slug}: lead source record URL`);
  assertExact(lead.download_url, approved.downloadUrl, `${slug}: lead download URL`);
}

const reviewCatalog = gitJson(reviewCommit, DATA_PATHS.catalog);
const reviewPreviews = gitJson(reviewCommit, DATA_PATHS.previews);
const reviewRenders = gitJson(reviewCommit, DATA_PATHS.renders);
const reviewOrientations = gitJson(reviewCommit, DATA_PATHS.orientations);
if (!Array.isArray(reviewCatalog) || !Array.isArray(reviewRenders)) fail('Review catalog/renders have unexpected shapes');
const reviewCatalogBySlug = byUniqueSlug(reviewCatalog.filter((record) => TARGET_SET.has(record.slug)), 'Review catalog targets');
exactMembers([...reviewCatalogBySlug.keys()], TARGET_SLUGS, 'Review catalog targets');
for (const slug of TARGET_SLUGS) {
  if (!reviewPreviews[slug]) fail(`Review previews are missing ${slug}`);
  const renderCount = reviewRenders.filter((renderedSlug) => renderedSlug === slug).length;
  if (renderCount !== 1) fail(`Review renders must include ${slug} exactly once; found ${renderCount}`);
}

const refPaths = git(['ls-tree', '-r', '--name-only', reviewCommit, '--', 'docs/ingest'])
  .split(/\r?\n/).filter(Boolean);
for (const slug of TARGET_SLUGS) {
  const sheet = `docs/ingest/${BATCH}-orientation-review/${slug.replaceAll('/', '__')}.webp`;
  if (!refPaths.includes(sheet)) fail(`Review ref is missing orientation review sheet ${sheet}`);
}
const automaticReportPaths = refPaths.filter((file) => new RegExp(`^docs/ingest/${BATCH}-run-[0-9]+/r2-upload\\.json$`).test(file));
const reportPath = args['run-report'] ? String(args['run-report']) : automaticReportPaths.length === 1 ? automaticReportPaths[0] : '';
if (!reportPath) {
  fail(`Expected exactly one ${BATCH} R2 report in the review ref; found ${automaticReportPaths.length}. Pass --run-report=REF_PATH to disambiguate.`);
}
if (!refPaths.includes(reportPath)) fail(`R2 report is not present in the review ref: ${reportPath}`);
const reportDirectory = path.posix.dirname(reportPath);
const fetchedPath = `${reportDirectory}/fetched.json`;
if (!refPaths.includes(fetchedPath)) fail(`Review ref is missing source-fetch evidence ${fetchedPath}`);
const fetchedDocument = gitJson(reviewCommit, fetchedPath);
const fetchedCandidates = fetchedDocument.candidates || [];
exactMembers(fetchedCandidates.map((candidate) => candidate.slug), TARGET_SLUGS, 'Fetched source evidence');
const fetchedBySlug = byUniqueSlug(fetchedCandidates, 'Fetched source evidence');
if ((fetchedDocument.report?.errors || []).length) {
  fail(`Fetched source evidence contains errors: ${JSON.stringify(fetchedDocument.report.errors)}`);
}
for (const slug of TARGET_SLUGS) {
  const approved = APPROVED_SOURCES[slug];
  const lead = leadsBySlug.get(slug);
  const candidate = fetchedBySlug.get(slug);
  const fetched = candidate.fetched;
  if (!fetched || typeof fetched !== 'object') fail(`${slug}: fetched source evidence has no fetched result`);
  assertExact(candidate.accession, approved.accession, `${slug}: fetched accession`);
  assertExact(candidate.download_format, approved.format, `${slug}: fetched candidate format`);
  assertExact(Number(candidate.download_size_bytes), approved.bytes, `${slug}: fetched candidate pinned bytes`);
  assertExact(candidate.expected_sha256, approved.sha256, `${slug}: fetched candidate pinned SHA-256`);
  assertExact(candidate.require_measured_integrity, true, `${slug}: fetched candidate strict-integrity flag`);
  assertExact(candidate.source_url, lead.source_url, `${slug}: fetched source URL`);
  assertExact(candidate.source_record_url, lead.source_record_url, `${slug}: fetched source record URL`);
  assertExact(candidate.download_url, approved.downloadUrl, `${slug}: fetched candidate download URL`);
  assertExact(fetched.download_url, approved.downloadUrl, `${slug}: resolved download URL`);
  assertExact(fetched.format, approved.format, `${slug}: fetched file format`);
  assertExact(Number(fetched.bytes), approved.bytes, `${slug}: fetched bytes`);
  assertExact(Number(fetched.original_download_bytes), approved.bytes, `${slug}: original download bytes`);
  assertExact(fetched.sha256, approved.sha256, `${slug}: fetched SHA-256`);
}
const r2Report = gitJson(reviewCommit, reportPath);
if ((r2Report.failed || []).length) fail(`R2 report contains failures: ${JSON.stringify(r2Report.failed)}`);
const completedUploads = [...(r2Report.uploaded || []), ...(r2Report.unchanged || [])];
exactMembers(completedUploads.map((item) => item.slug), TARGET_SLUGS, 'Completed R2 uploads');
const uploadBySlug = byUniqueSlug(completedUploads, 'Completed R2 uploads');

if (!args['orientation-overrides']) fail('--orientation-overrides is required for the retained human review record');
const orientationPath = path.resolve(repoRoot, String(args['orientation-overrides']));
const orientationDocument = JSON.parse(await readFile(orientationPath, 'utf8'));
if (!orientationDocument || typeof orientationDocument !== 'object' || Array.isArray(orientationDocument)) {
  fail('Orientation selection must be a JSON object');
}
assertExact(orientationDocument.schema, 'atrium-iconic-orientation-selection/1', 'Orientation selection schema');
assertExact(orientationDocument.batch, BATCH, 'Orientation selection batch');
assertExact(orientationDocument.review_commit, reviewCommit, 'Orientation selection review commit');
assertExact(orientationDocument.reviewed, reviewed, 'Orientation selection review date');
const orientationSelections = orientationDocument.selections;
if (!orientationSelections || typeof orientationSelections !== 'object' || Array.isArray(orientationSelections)) {
  fail('Orientation selection must contain a selections object');
}
exactMembers(Object.keys(orientationSelections), TARGET_SLUGS, 'Orientation selections');
const selectedOrientations = {};
for (const slug of TARGET_SLUGS) {
  const selection = orientationSelections[slug];
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    fail(`${slug}: orientation selection must be an object`);
  }
  const allowedSelectionFields = new Set(['variant', 'sheet_sha256', 'asset_sha256', 'note']);
  const unknownSelectionFields = Object.keys(selection).filter((field) => !allowedSelectionFields.has(field));
  if (unknownSelectionFields.length) fail(`${slug}: orientation selection has unknown fields: ${unknownSelectionFields.join(', ')}`);
  if (!selection.note || typeof selection.note !== 'string') fail(`${slug}: orientation selection requires a review note`);
  const sheetPath = `docs/ingest/${BATCH}-orientation-review/${slug.replaceAll('/', '__')}.webp`;
  assertExact(selection.sheet_sha256, sha256Buffer(gitBlob(reviewCommit, sheetPath)), `${slug}: orientation sheet SHA-256`);
  assertExact(selection.asset_sha256, uploadBySlug.get(slug).sha256, `${slug}: orientation preview SHA-256`);
  selectedOrientations[slug] = orientationForVariant({
    slug,
    variant: selection.variant,
    note: selection.note,
    reviewOrientations,
  });
}

for (const slug of TARGET_SLUGS) {
  const lead = leadsBySlug.get(slug);
  const record = reviewCatalogBySlug.get(slug);
  const preview = reviewPreviews[slug];
  const upload = uploadBySlug.get(slug);
  const fetchedCandidate = fetchedBySlug.get(slug);
  const approved = APPROVED_SOURCES[slug];
  if (!lead.require_measured_integrity || !isSha256(lead.expected_sha256)) fail(`${slug}: strict source integrity is not pinned`);
  if (!/^https?:/.test(lead.source_record_url || '') || !Array.isArray(lead.measures) || !lead.measures.length) {
    fail(`${slug}: lead lacks a source record or measurements`);
  }
  for (const measure of lead.measures) {
    if (!['height', 'width', 'depth'].includes(measure.axis)
      || !Number.isFinite(measure.value) || measure.value <= 0
      || !['mm', 'cm', 'm'].includes(measure.unit) || !measure.scope) {
      fail(`${slug}: invalid lead measurement ${JSON.stringify(measure)}`);
    }
  }
  if (record.ingest_batch !== BATCH) fail(`${slug}: review catalog ingest_batch is ${record.ingest_batch}, expected ${BATCH}`);
  const expectedCatalogFields = {
    slug: lead.slug,
    collection: lead.collection || lead.slug.split('/')[0],
    ...(lead.wing ? { wing: lead.wing } : {}),
    title: lead.title,
    artist: lead.artist || '',
    year: lead.year || '',
    year_sort: lead.year_sort ?? null,
    material: lead.material || '',
    museum: lead.displayed_at || lead.current_location || lead.museum || '',
    original_location: lead.original_location || lead.geography || lead.museum || '',
    current_location: lead.current_location || lead.displayed_at || '',
    displayed_at: lead.displayed_at || '',
    geography: lead.geography || '',
    culture: lead.culture || '',
    source_institution: lead.source_institution || '',
    source_url: lead.source_url || '',
    source_record_url: lead.source_record_url || '',
    related_source_record_urls: lead.related_source_record_urls || [],
    license: lead.license || '',
    license_url: lead.license_url || '',
    license_evidence_url: lead.license_evidence_url || '',
    attribution: lead.attribution || lead.scan_author || '',
    accession: lead.accession || '',
    scan_author: lead.scan_author || '',
    scan_source: lead.scan_source || '',
    note: lead.note || '',
    dimensions: lead.dimensions || '',
    license_tier: lead.license_tier,
    period: lead.period,
  };
  for (const [field, expected] of Object.entries(expectedCatalogFields)) {
    assertExact(record[field], expected, `${slug}: review catalog ${field}`);
  }
  assertExact(record.model?.format, approved.format, `${slug}: review catalog model format`);
  assertExact(Number(record.model?.sizeBytes), approved.bytes, `${slug}: review catalog model bytes`);
  assertExact(record.model?.sourcePath, `${slug}/${fetchedCandidate.fetched.filename}`, `${slug}: review catalog model source path`);
  if (preview.url !== upload.url || Number(preview.bytes) !== Number(upload.bytes)) fail(`${slug}: preview entry differs from the R2 report`);
  if (!isSha256(upload.sha256) || upload.content_type !== 'model/gltf-binary') fail(`${slug}: invalid R2 hash or content type`);
  let previewUrl;
  try {
    previewUrl = new URL(upload.url);
  } catch {
    fail(`${slug}: invalid R2 public URL`);
  }
  if (previewUrl.protocol !== 'https:' || previewUrl.hostname !== 'models.atrium.earth') fail(`${slug}: unexpected R2 public origin`);
  if (!upload.url.endsWith(`/preview-${upload.sha256.slice(0, 12)}.glb`)) fail(`${slug}: R2 URL is not bound to its hash`);
  if (Number(preview.sourceBytes) !== Number(lead.download_size_bytes)
    || Number(preview.sourceFaces) !== Number(lead.face_count)
    || preview.sourceFormat !== approved.format
    || Number(preview.faces) < 100000
    || Number(preview.faces) > Number(leadsDocument.expected_preview_faces || 400000)) {
    fail(`${slug}: preview/source metrics do not satisfy the strict lead manifest`);
  }
}

const current = {
  catalog: await readJson(DATA_PATHS.catalog),
  previews: await readJson(DATA_PATHS.previews),
  renders: await readJson(DATA_PATHS.renders),
  orientations: await readJson(DATA_PATHS.orientations),
  physical: await readJson(DATA_PATHS.physical),
  eligibility: await readJson(DATA_PATHS.eligibility),
  spatialDefaults: await readJson(DATA_PATHS.spatialDefaults),
  appearances: await readJson(DATA_PATHS.appearances),
  recommendations: await readJson(DATA_PATHS.recommendations),
};
if (!Array.isArray(current.catalog) || !Array.isArray(current.renders)) fail('Canonical catalog/renders have unexpected shapes');
const canonicalPositions = new Map();
for (const slug of TARGET_SLUGS) {
  const positions = current.catalog.flatMap((record, index) => record.slug === slug ? [index] : []);
  if (positions.length !== 1) fail(`Canonical catalog must contain ${slug} exactly once; found ${positions.length}`);
  const position = positions[0];
  const record = current.catalog[position];
  if (record.index !== position + 1 || !Number.isInteger(record.tier)) fail(`${slug}: canonical index/tier identity is inconsistent`);
  canonicalPositions.set(slug, position);
}

const next = {
  catalog: structuredClone(current.catalog),
  previews: structuredClone(current.previews),
  renders: structuredClone(current.renders),
  orientations: structuredClone(current.orientations),
  physical: structuredClone(current.physical),
  eligibility: structuredClone(current.eligibility),
  spatialDefaults: structuredClone(current.spatialDefaults),
  appearances: structuredClone(current.appearances),
  recommendations: structuredClone(current.recommendations),
};

for (const slug of TARGET_SLUGS) {
  const position = canonicalPositions.get(slug);
  const canonicalRecord = current.catalog[position];
  const reviewedRecord = reviewCatalogBySlug.get(slug);
  next.catalog[position] = preservedReplacement(canonicalRecord, reviewedRecord, position, current.catalog.length);
  next.previews[slug] = structuredClone(reviewPreviews[slug]);

  delete next.orientations[slug];
  const orientation = selectedOrientations[slug];
  if (orientation !== null) next.orientations[slug] = structuredClone(orientation);

  const upload = uploadBySlug.get(slug);
  const physical = physicalRecordFor({
    slug,
    lead: leadsBySlug.get(slug),
    preview: next.previews[slug],
    assetSha256: upload.sha256,
    orientation,
    reviewed,
  });
  Object.assign(physical, originalResearchFor(slug, current.physical[slug]));
  next.physical[slug] = physical;
  next.eligibility[slug] = eligibilityFor({
    slug,
    record: physical,
    preview: next.previews[slug],
    orientation,
    kind: slug === 'michelangelo/david' ? 'original' : 'cast',
  });

  // These presets existed only while exact scale was unavailable. Each target
  // now has an asset-bound, eligibility-enabled physical reference.
  delete next.spatialDefaults[slug];

  next.appearances[slug] = {
    ...(current.appearances[slug] || {}),
    profile: slug === 'michelangelo/david' ? 'marble' : 'plaster',
  };
  if (Object.hasOwn(current.recommendations, slug)) {
    next.recommendations[slug] = structuredClone(current.recommendations[slug]);
    next.recommendations[slug].assetSha256 = upload.sha256;
    next.recommendations[slug].reviewed = reviewed;
    next.recommendations[slug].reviewNote = physical.geometryReviewNote;
  } else {
    delete next.recommendations[slug];
  }
}

const canonicalRenderSet = new Set(next.renders);
for (const slug of TARGET_SLUGS) {
  if (!canonicalRenderSet.has(slug)) {
    next.renders.push(slug);
    canonicalRenderSet.add(slug);
  }
}
if (next.renders.length !== new Set(next.renders).size) fail('Canonical renders contains duplicate slugs; resolve before integration');

const reviewFiles = new Map();
for (const slug of TARGET_SLUGS) {
  const thumbPath = `public/previews/renders/${slug}/thumb.webp`;
  const posterPath = `public/previews/posters/${slug}/poster.svg`;
  const thumb = gitBlob(reviewCommit, thumbPath);
  const poster = gitBlob(reviewCommit, posterPath);
  if (!thumb.length || !poster.length) fail(`${slug}: empty thumbnail or poster`);
  const encoded = poster.toString('utf8').match(/href="data:image\/webp;base64,([^"]+)"/)?.[1];
  if (!encoded || !Buffer.from(encoded, 'base64').equals(thumb)) fail(`${slug}: poster is not derived from the reviewed thumbnail`);
  reviewFiles.set(thumbPath, thumb);
  reviewFiles.set(posterPath, poster);
  const sheetPath = `docs/ingest/${BATCH}-orientation-review/${slug.replaceAll('/', '__')}.webp`;
  const sheet = gitBlob(reviewCommit, sheetPath);
  if (!sheet.length) fail(`${slug}: empty orientation review sheet`);
  reviewFiles.set(sheetPath, sheet);
}
const reportFiles = refPaths.filter((file) => file.startsWith(`${reportDirectory}/`));
if (!reportFiles.length) fail(`Review ref contains no acquisition evidence under ${reportDirectory}`);
for (const file of reportFiles) {
  const body = gitBlob(reviewCommit, file);
  if (!body.length) fail(`Review evidence file is empty: ${file}`);
  reviewFiles.set(file, body);
}

console.log(`Validated review ${reviewRef} (${reviewCommit.slice(0, 12)}).`);
console.log(`R2 report: ${reportPath}`);
for (const slug of TARGET_SLUGS) {
  const canonical = current.catalog[canonicalPositions.get(slug)];
  const upload = uploadBySlug.get(slug);
  console.log(`  ${String(canonical.index).padStart(4)} ${slug}: tier ${canonical.tier}, ${upload.bytes} bytes, ${upload.sha256.slice(0, 12)}, orientation=${selectedOrientations[slug] === null ? 'reviewed identity' : 'reviewed transform'}`);
}

if (!args.apply) {
  console.log('Dry run only; pass --apply to write the validated integration.');
  console.log('After applying, regenerate the eight thumbnails/posters if the selected transform or preserved appearance override differs from the review render.');
  process.exit(0);
}

await atomicWriteJson(DATA_PATHS.catalog, next.catalog);
await atomicWriteJson(DATA_PATHS.previews, next.previews);
await atomicWriteJson(DATA_PATHS.renders, next.renders);
await atomicWriteJson(DATA_PATHS.orientations, next.orientations);
await atomicWriteJson(DATA_PATHS.physical, next.physical);
await atomicWriteJson(DATA_PATHS.eligibility, next.eligibility);
await atomicWriteJson(DATA_PATHS.spatialDefaults, next.spatialDefaults);
await atomicWriteJson(DATA_PATHS.appearances, next.appearances);
await atomicWriteJson(DATA_PATHS.recommendations, next.recommendations);
for (const [file, body] of reviewFiles) await atomicWrite(file, body);

console.log(`Integrated exactly ${TARGET_SLUGS.length} iconic scan replacements on ${canonicalBranch}.`);
console.log('Regenerate the eight thumbnails/posters when a selected transform or preserved appearance override differs from the review render.');
console.log('Run the focused catalog, asset, dimension, spatial-eligibility, spatial-access, appearance and display-support checks before committing.');
