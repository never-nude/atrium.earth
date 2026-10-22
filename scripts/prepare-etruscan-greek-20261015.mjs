#!/usr/bin/env node
// Preparation and metadata audit only. This module never fetches model payloads,
// runs assembly, changes the catalog, or dispatches a workflow.
import { createHash } from 'node:crypto';
import { readFile, writeFile, realpath, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { candidateIsKnown, catalogIndexes } from './ingest-utils.mjs';

export const BATCH = 'etruscan-greek-20261015';
export const EXPECTED_COUNT = 60;
const SUPPORTED_BATCHES = new Set([BATCH, 'beautiful-expansion-20261019', 'crowd-pleasers-20261021', 'crowd-pleasers-20261022', 'artist-trios-20261022']);
const ROOT = path.resolve(import.meta.dirname, '..');
const UID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{64}$/;
const WINGS = new Set(['near-east', 'greece-rome', 'europe', 'asia', 'africa', 'americas-oceania', 'unfiled']);
const EXEMPTIONS = new Set(['allow_componentized_mesh', 'max_component_count', 'min_largest_component_fraction',
  'skip_integrity', 'skip_measured_integrity', 'integrity_exemption', 'alternate_downloads']);
const PRIVATE_FIELDS = /^(?:fetched|download_url|downloadUrl|authorization|headers|access_token|api_token|token|secret|password|driveId|file_uri|absolutePath)$/i;
const LICENSES = new Map([
  ['CC0 1.0', ['https://creativecommons.org/publicdomain/zero/1.0/', 1]],
  ...['2.0', '2.5', '3.0', '4.0'].flatMap(version => [
    [`CC BY ${version}`, [`https://creativecommons.org/licenses/by/${version}/`, 2]],
    [`CC BY-SA ${version}`, [`https://creativecommons.org/licenses/by-sa/${version}/`, 2]],
  ]),
]);
const text = value => typeof value === 'string' ? value.trim() : '';
const key = value => text(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
const sha = value => createHash('sha256').update(value).digest('hex');
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;

function url(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    if ([...parsed.searchParams.keys()].some(name => /token|sig(?:nature)?|credential|secret|key|auth|x-amz|expires/i.test(name))) return null;
    return parsed;
  } catch { return null; }
}

export function recordKey(value) {
  const parsed = url(value);
  if (!parsed) return '';
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  parsed.pathname = parsed.pathname.replace(/\/(?:en|fr)(?=\/)/, '').replace(/\/+$/, '');
  parsed.searchParams.sort();
  return parsed.href;
}

function sourceUids(record) {
  const result = new Set();
  if (UID.test(record.uid || '')) result.add(record.uid);
  const fields = [record.source_url, record.license_evidence_url, record.download_api_url,
    record.model?.sourcePath, ...(record.related_source_record_urls || [])];
  for (const field of fields) for (const match of String(field || '').matchAll(/\b[a-f0-9]{32}\b/g)) result.add(match[0]);
  return result;
}

export function objectKeys(record) {
  const values = [];
  if (text(record.object_identity)) values.push(`identity:${key(record.object_identity)}`);
  const primary = url(record.source_record_url);
  if (primary && !/(?:^|\.)sketchfab\.com$/.test(primary.hostname)) values.push(`record:${recordKey(record.source_record_url)}`);
  // Accession numbers are scoped to the holding collection, never the scanner.
  const institution = key(record.museum);
  if (institution && text(record.accession)) {
    for (const accession of record.accession.split(/\s*[;|]\s*/).filter(Boolean)) values.push(`accession:${institution}:${key(accession)}`);
  }
  return values;
}

function findPrivate(value, at = '') {
  const problems = [];
  if (Array.isArray(value)) return value.flatMap((item, i) => findPrivate(item, `${at}[${i}]`));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && (/(?:^|\s)(?:\/Users\/|\/private\/|\/tmp\/|[A-Z]:\\)/.test(value) || /(?:sediment|file):\/\//i.test(value))) problems.push(at);
    return problems;
  }
  for (const [name, item] of Object.entries(value)) {
    const next = at ? `${at}.${name}` : name;
    if (PRIVATE_FIELDS.test(name)) problems.push(next);
    else if (typeof item === 'string' && /^https?:\/\//i.test(item) && !url(item.replace(/^http:/i, 'https:'))) problems.push(next);
    else problems.push(...findPrivate(item, next));
  }
  return problems;
}

export function checkCandidate(candidate, { now = new Date(), maxAgeDays = 7, batch = BATCH } = {}) {
  if (!SUPPORTED_BATCHES.has(batch)) throw new Error('Unsupported preparation batch');
  const issues = [];
  const require = (condition, reason) => { if (!condition) issues.push(reason); };
  require(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'candidate must be an object');
  if (issues.length) return issues;
  for (const name of ['slug', 'collection', 'title', 'culture', 'year', 'period', 'material', 'museum',
    'source_institution', 'source_url', 'source_record_url', 'license', 'license_url', 'license_evidence_url',
    'scan_author', 'attribution', 'scan_source', 'note', 'reference_image_url']) require(text(candidate[name]), `missing ${name}`);
  require(typeof candidate.artist === 'string', 'artist must be a string; an unknown maker may remain empty');
  require(candidate.source === 'sketchfab', 'this batch requires direct Sketchfab model identities');
  require(UID.test(candidate.uid || ''), 'invalid Sketchfab UID');
  require((batch === BATCH ? /^(?:greek|roman)\/[a-z0-9]+(?:-[a-z0-9]+)*$/ : /^[a-z][a-z0-9-]*\/[a-z0-9]+(?:-[a-z0-9]+)*$/).test(candidate.slug || ''), 'unsafe or unsupported slug');
  require(candidate.collection === candidate.slug?.split('/')[0], 'collection differs from slug prefix');
  require(WINGS.has(candidate.wing), 'wing must be an existing origin-based wing or explicitly unfiled');
  if (candidate.wing === 'unfiled') require(text(candidate.wing_unfiled_reason).length >= 30 && !text(candidate.geography) && !text(candidate.original_location), 'Unfiled requires a documented unknown origin, without a museum-derived origin');
  else require(text(candidate.geography) || text(candidate.original_location), 'document the object origin separately from its holding museum');
  require(batch !== BATCH || (candidate.period === 'Ancient' && ((Number.isFinite(candidate.year_sort) && candidate.year_sort < 500)
    || (candidate.year_sort === null && /^unknown\b/i.test(text(candidate.year))))), 'explicit ancient date or honestly unknown chronology required');
  require(url(candidate.source_url)?.hostname === 'sketchfab.com' && sourceUids({ source_url: candidate.source_url }).has(candidate.uid), 'source page must identify this exact UID');
  require(candidate.download_api_url === `https://api.sketchfab.com/v3/models/${candidate.uid}/download`, 'download API must identify this exact UID');
  require(candidate.license_evidence_url === `https://api.sketchfab.com/v3/models/${candidate.uid}`, 'license evidence must be the exact live model detail');
  const license = LICENSES.get(candidate.license);
  require(license && candidate.license_url === license[0] && candidate.license_tier === license[1], 'license label/URL/tier must consistently permit derivatives and commercial reuse');
  require(candidate.downloadable_verified === true, 'download eligibility must be checked');
  const checked = Date.parse(candidate.downloadable_verified_at);
  require(Number.isFinite(checked) && checked <= now.getTime() + 86400000 && checked >= now.getTime() - maxAgeDays * 86400000, 'download eligibility evidence is missing or stale');
  require(candidate.download_format === 'glb', 'selected downloadable GLB required; no implicit format fallback');
  require(positiveInteger(candidate.download_size_bytes), 'selected archive byte count unresolved');
  require(positiveInteger(candidate.face_count), 'declared model face count unresolved');
  const geometry = candidate.source_geometry;
  require(geometry && geometry.format === 'glb' && geometry.bytes === candidate.download_size_bytes, 'selected GLB archive metadata must agree with selected bytes');
  require(geometry && ((candidate.face_count_scope === 'selected-download-archive' && geometry.faces === candidate.face_count)
    || (candidate.face_count_scope === 'api-detail-only-unmeasured' && geometry.faces === null && geometry.api_detail_faces === candidate.face_count)), 'face count scope must distinguish selected archive counts from unmeasured API detail counts');
  require(candidate.require_measured_integrity === true, 'measured integrity must be required');
  for (const flag of EXEMPTIONS) require(!Object.hasOwn(candidate, flag), `integrity/source override forbidden: ${flag}`);
  require(Array.isArray(candidate.evidence) && candidate.evidence.length > 0 && candidate.evidence.every(item => text(item)), 'source evidence is required');
  require(objectKeys(candidate).length > 0, 'exact object record, institution/accession or explicit object_identity required');
  for (const field of ['source_record_url', 'reference_image_url']) require(url(candidate[field]), `invalid public ${field}`);
  if (candidate.expected_sha256 !== undefined) require(SHA.test(candidate.expected_sha256), 'invalid optional pinned source hash');
  require(!Object.hasOwn(candidate, 'ingested_at') && !Object.hasOwn(candidate, 'ingest_batch'), 'assembly owns ingest timestamps and catalog batch fields');
  const privateFields = findPrivate(candidate);
  require(!privateFields.length, `private/ephemeral fields forbidden${privateFields.length ? `: ${privateFields.join(', ')}` : ''}`);
  return issues;
}

export function prepareLeads(documents, catalog, { expectedCount = EXPECTED_COUNT, selection, now = new Date(), corrections = {}, batch = BATCH, chunk = 1, sequenceOffset = 0 } = {}) {
  if (!SUPPORTED_BATCHES.has(batch)) throw new Error('Unsupported preparation batch');
  if (!positiveInteger(chunk) || !Number.isSafeInteger(sequenceOffset) || sequenceOffset < 0) throw new Error('Invalid cumulative chunk/sequence offset');
  const issues = [], candidates = [], duplicates = [], byUid = new Map(), seenSlug = new Map(), seenObject = new Map();
  const existing = catalog.map(item => ({ ...item, ...(corrections[item.slug]?.catalog || {}), ...(corrections[item.slug]?.title ? { title: corrections[item.slug].title } : {}) }));
  const indexes = catalogIndexes(existing);
  const existingUids = new Map(existing.flatMap(item => [...sourceUids(item)].map(uid => [uid, item.slug])));
  const existingObjects = new Map(existing.flatMap(item => objectKeys(item).map(identity => [identity, item.slug])));
  const selected = selection ? new Set(selection) : null;
  if (selection && (selected.size !== selection.length || selection.some(slug => typeof slug !== 'string'))) issues.push({ reason: 'selection must contain unique slug strings' });
  const found = new Set();
  for (const document of documents) {
    if (document?.schema !== 'atrium-auto-ingest-candidates/1' || !Array.isArray(document.candidates)) { issues.push({ reason: 'discovery input must use atrium-auto-ingest-candidates/1 and candidates[]' }); continue; }
    if (document.logical_batch_id && document.logical_batch_id !== batch) { issues.push({ reason: 'Discovery document batch mismatch' }); continue; }
    for (const input of document.candidates) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) { issues.push({ reason: 'candidate must be an object' }); continue; }
      if (selected && !selected.has(input.slug)) continue;
      found.add(input.slug);
      const candidate = structuredClone(input);
      const problems = checkCandidate(candidate, { now, batch });
      if (candidate.logical_batch_id && candidate.logical_batch_id !== batch) problems.push('Candidate batch mismatch');
      if (problems.length) issues.push({ slug: candidate.slug, reasons: problems });
      if (byUid.has(candidate.uid)) {
        const previous = byUid.get(candidate.uid);
        if (JSON.stringify(previous) === JSON.stringify(candidate)) { duplicates.push({ uid: candidate.uid, slug: candidate.slug, reason: 'identical discovery entry' }); continue; }
        issues.push({ slug: candidate.slug, reason: `conflicting duplicate source UID: ${previous.slug}` });
      }
      byUid.set(candidate.uid, candidate);
      if (seenSlug.has(candidate.slug)) issues.push({ slug: candidate.slug, reason: 'duplicate slug' });
      seenSlug.set(candidate.slug, candidate);
      if (existingUids.has(candidate.uid)) issues.push({ slug: candidate.slug, reason: `catalog source UID already exists: ${existingUids.get(candidate.uid)}` });
      for (const identity of objectKeys(candidate)) {
        if (existingObjects.has(identity)) issues.push({ slug: candidate.slug, reason: `catalog object identity already exists: ${existingObjects.get(identity)}` });
        if (seenObject.has(identity)) issues.push({ slug: candidate.slug, reason: `duplicate physical object identity: ${seenObject.get(identity)}` });
        seenObject.set(identity, candidate.slug);
      }
      const core = candidateIsKnown(candidate, indexes);
      if (core) issues.push({ slug: candidate.slug, reason: `current fetch/assembler would skip by ${core}; resolve identity/title before dispatch` });
      candidates.push(candidate);
    }
  }
  if (selected) for (const slug of selected) if (!found.has(slug)) issues.push({ slug, reason: 'selected slug missing from discovery inputs' });
  if (candidates.length !== expectedCount) issues.push({ reason: `expected exactly ${expectedCount} unique selected leads; found ${candidates.length}` });
  const manifest = {
    schema: 'atrium-auto-ingest-candidates/1', generated_at: now.toISOString(), logical_batch_id: batch,
    chunk, expected_count: expectedCount, strict_acquisition: false,
    note: 'Preparation only. All selected sources require measured integrity without exemptions, unchanged provider archive preservation, native material and full capture review, final orientation, size review and rendered thumbnails. No automatic featured membership. Selected archive metadata is separate from API detail counts; source hashes are recorded after actual acquisition.',
    candidates: candidates.map((candidate, index) => ({ ...candidate, logical_batch_id: batch, batch_sequence: sequenceOffset + index + 1, batch_chunk: chunk })),
  };
  return { manifest, audit: { schema: 'atrium-source-leads-preparation/1', batch, generated_at: now.toISOString(),
    ready: issues.length === 0, catalog_count: catalog.length, selected_count: candidates.length, duplicate_entries: duplicates,
    selected_archive_bytes: candidates.reduce((sum, candidate) => sum + (positiveInteger(candidate.download_size_bytes) ? candidate.download_size_bytes : 0), 0), issues } };
}

export function auditAcquisition(manifest, fetched, report) {
  const issues = [], expected = new Map(manifest.candidates.map(candidate => [candidate.slug, candidate]));
  const actual = new Map();
  for (const candidate of fetched.candidates || []) {
    if (actual.has(candidate.slug)) issues.push({ slug: candidate.slug, reason: 'duplicate fetched slug' });
    actual.set(candidate.slug, candidate);
    const lead = expected.get(candidate.slug);
    if (!lead) { issues.push({ slug: candidate.slug, reason: 'unexpected fetched slug' }); continue; }
    const item = candidate.fetched || {};
    if (candidate.uid !== lead.uid || candidate.license !== lead.license) issues.push({ slug: candidate.slug, reason: 'fetched identity/license changed' });
    if (!SHA.test(item.sha256 || '') || item.original_download_bytes !== lead.download_size_bytes) issues.push({ slug: candidate.slug, reason: 'actual provider SHA/byte count missing or differs from selected archive' });
    if (lead.expected_sha256 && item.sha256 !== lead.expected_sha256) issues.push({ slug: candidate.slug, reason: 'pinned provider hash mismatch' });
    if (!positiveInteger(item.bytes) || item.format !== 'glb') issues.push({ slug: candidate.slug, reason: 'usable fetched GLB missing' });
    if (candidate.require_measured_integrity !== true || [...EXEMPTIONS].some(flag => Object.hasOwn(candidate, flag))) issues.push({ slug: candidate.slug, reason: 'measured-integrity flag lost or integrity/source override introduced' });
  }
  for (const slug of expected.keys()) if (!actual.has(slug)) issues.push({ slug, reason: 'source was not fetched; never publish a silent partial batch' });
  for (const error of fetched.report?.errors || []) issues.push({ slug: error.slug, reason: `fetch error: ${error.reason || 'unspecified'}` });
  const accepted = new Set();
  for (const item of report.accepted || []) {
    if (accepted.has(item.slug) || !expected.has(item.slug)) issues.push({ slug: item.slug, reason: 'unexpected/duplicate accepted slug' });
    accepted.add(item.slug);
    const integrity = item.integrity_data;
    if (!integrity || integrity.skipped || !positiveInteger(integrity.faces) || !Number.isFinite(integrity.ncomp) || integrity.ncomp < 1 || integrity.ncomp > 50 || !Number.isFinite(integrity.bratio) || integrity.bratio > 0.3 || !Number.isFinite(integrity.largest_frac) || integrity.largest_frac < 0.5) issues.push({ slug: item.slug, reason: 'measured geometry integrity is missing or fails the unchanged gate' });
    const lead = expected.get(item.slug);
    if (lead?.face_count_scope === 'selected-download-archive' && integrity?.faces !== lead.face_count) issues.push({ slug: item.slug, reason: 'measured source faces differ from selected archive metadata' });
  }
  for (const slug of expected.keys()) if (!accepted.has(slug)) issues.push({ slug, reason: 'not accepted; replace/review holds before claiming all 60 acquired' });
  for (const item of report.rejected || []) issues.push({ slug: item.slug, reason: `assembly hold: ${item.reason || 'unspecified'}` });
  return { schema: 'atrium-etruscan-greek-run-audit/1', batch: BATCH, expected: expected.size, fetched: actual.size, accepted: accepted.size, passed: !issues.length, issues,
    limits: 'Metadata and measured-integrity report audit only; source byte rehash, source/derivative appearance, full scope, final pose, calibrated dimensions, thumbnails, permanent archive readback and live delivery remain separate required checks.' };
}

/** Authenticated API metadata only: returned download URLs never leave memory. */
export async function preflightMetadata(documents, { token, batch = BATCH, fetchImpl = fetch, clock = () => Date.now(),
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)), intervalMs = 5000,
  retryBudgetMs = 600000, requestTimeoutMs = 60000 } = {}) {
  if (!text(token)) throw new Error('SKETCHFAB_TOKEN is required for metadata preflight');
  if (!SUPPORTED_BATCHES.has(batch)) throw new Error('Unsupported metadata batch');
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 5000) throw new Error('Metadata requests must be spaced at least 5000 ms apart');
  const leads = new Map();
  for (const document of documents) {
    if (document?.schema !== 'atrium-auto-ingest-candidates/1' || !Array.isArray(document.candidates)) throw new Error('Invalid discovery manifest schema');
    if (document.logical_batch_id && document.logical_batch_id !== batch) throw new Error('Discovery manifest metadata batch mismatch');
    for (const candidate of document.candidates) {
      if (!UID.test(candidate?.uid || '')) throw new Error('Metadata preflight requires exact model UIDs');
      if (candidate.source !== 'sketchfab') throw new Error('Metadata preflight supports only Sketchfab');
      leads.set(candidate.uid, candidate.slug || '');
    }
  }
  if (!leads.size || leads.size > 90) throw new Error('Metadata preflight requires 1–90 distinct models');
  let lastRequest = -Infinity, waited = 0;
  async function request(uid, download) {
    for (let attempt = 0; ; attempt++) {
      const gap = lastRequest + intervalMs - clock();
      if (gap > 0) await sleep(gap);
      lastRequest = clock();
      let response;
      try {
        response = await fetchImpl(`https://api.sketchfab.com/v3/models/${uid}${download ? '/download' : ''}`, {
          headers: { accept: 'application/json', ...(download ? { Authorization: `Token ${token}` } : {}) },
          signal: AbortSignal.timeout(requestTimeoutMs), redirect: 'error',
        });
      } catch { throw new Error('Metadata network request failed or timed out'); }
      if (response.status === 429) {
        const retry = response.headers.get('retry-after');
        const seconds = retry !== null && retry.trim() !== '' ? Number(retry) : NaN;
        const date = Number.isFinite(seconds) ? NaN : Date.parse(retry || '');
        const delay = Number.isFinite(seconds) ? Math.max(5000, seconds * 1000)
          : Number.isFinite(date) ? Math.max(5000, date - clock()) : Math.min(300000, 30000 * 2 ** attempt);
        if (!Number.isFinite(delay) || waited + delay > retryBudgetMs) throw new Error('Metadata HTTP 429 retry budget exhausted');
        waited += delay; await sleep(delay); continue;
      }
      if (!response.ok) throw new Error(`Metadata API HTTP ${response.status}`);
      try { return await response.json(); } catch { throw new Error('Metadata response was not valid JSON'); }
    }
  }
  const models = [], errors = [];
  for (const [uid, slug] of leads) {
    try {
      const detail = await request(uid, false);
      if (detail.uid !== uid) throw new Error('Detail API UID mismatch');
      if (!(detail.isDownloadable === true || detail.downloadType === 'free')) throw new Error('Model is not currently freely downloadable');
      const download = await request(uid, true);
      const glb = download.glb;
      if (!glb || !positiveInteger(glb.size)) throw new Error('Selected GLB size was not reported by download API');
      const license = detail.license || {};
      const licenseUrl = typeof license.url === 'string' ? license.url.replace(/^http:/, 'https:') : '';
      const faces = positiveInteger(glb.faceCount) ? glb.faceCount : null;
      models.push({ uid, slug, checked_at: new Date(clock()).toISOString(),
        license: { uid: text(license.uid), slug: text(license.slug), label: text(license.label), url: url(licenseUrl) ? licenseUrl : '' },
        downloadable: true, selected_download: { format: 'glb', bytes: glb.size, faces,
          face_count_scope: faces === null ? 'unreported' : 'download-api-archive' },
        api_detail: { faces: positiveInteger(detail.faceCount) ? detail.faceCount : null,
          vertices: positiveInteger(detail.vertexCount) ? detail.vertexCount : null,
          textures: Number.isSafeInteger(detail.textureCount) && detail.textureCount >= 0 ? detail.textureCount : null },
      });
    } catch (error) { errors.push({ uid, slug, reason: error.message }); }
  }
  return { schema: 'atrium-selected-download-metadata/1', batch, generated_at: new Date(clock()).toISOString(),
    expected: leads.size, checked: models.length, complete: models.length === leads.size && !errors.length, models, errors,
    scope: 'Live detail and authenticated download API metadata only. No source payload fetched; no returned download URL, token or account metadata retained. Null archive faces require actual post-fetch measured integrity.' };
}

export function applyDownloadMetadata(documents, metadata, { batch = BATCH } = {}) {
  if (!SUPPORTED_BATCHES.has(batch)) throw new Error('Unsupported metadata batch');
  if (documents.some(document => document.logical_batch_id && document.logical_batch_id !== batch)) throw new Error('Discovery document batch mismatch');
  if (metadata?.schema !== 'atrium-selected-download-metadata/1' || metadata.batch !== batch || !Array.isArray(metadata.models)) throw new Error('Wrong selected-download metadata schema/batch');
  const models = new Map();
  for (const row of metadata.models) {
    if (!UID.test(row.uid || '') || models.has(row.uid)) throw new Error('Metadata UIDs must be valid and unique');
    models.set(row.uid, row);
  }
  return documents.map(document => ({ ...document, candidates: (document.candidates || []).map(candidate => {
    const row = models.get(candidate.uid);
    if (!row) return structuredClone(candidate);
    if (row.downloadable !== true || row.selected_download?.format !== 'glb' || !positiveInteger(row.selected_download.bytes)) throw new Error(`${candidate.slug}: selected metadata does not establish a downloadable GLB`);
    if (row.license?.url !== candidate.license_url) throw new Error(`${candidate.slug}: live metadata license disagrees with discovery`);
    if (positiveInteger(candidate.download_size_bytes) && candidate.download_size_bytes !== row.selected_download.bytes) throw new Error(`${candidate.slug}: selected archive size changed since discovery`);
    const archiveFaces = row.selected_download.faces;
    const detailFaces = row.api_detail?.faces;
    const measuredMetadata = positiveInteger(archiveFaces);
    return { ...structuredClone(candidate), download_size_bytes: row.selected_download.bytes,
      downloadable_verified: true, downloadable_verified_at: row.checked_at,
      face_count: measuredMetadata ? archiveFaces : detailFaces,
      face_count_scope: measuredMetadata ? 'selected-download-archive' : 'api-detail-only-unmeasured',
      source_geometry_face_count: measuredMetadata ? archiveFaces : null,
      source_geometry: { ...(candidate.source_geometry || {}), format: 'glb', bytes: row.selected_download.bytes,
        faces: measuredMetadata ? archiveFaces : null, api_detail_faces: detailFaces },
    };
  }) }));
}

function argsFrom(argv) {
  const args = { input: [] };
  for (let i = 0; i < argv.length; i++) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!match) throw new Error(`Unexpected argument: ${argv[i]}`);
    const name = match[1];
    if (name === 'help' || name === 'metadata-preflight') { args[name] = true; continue; }
    if (!['input', 'input-list', 'metadata', 'metadata-out', 'catalog', 'corrections', 'selection', 'out', 'audit-run', 'leads'].includes(name)) throw new Error(`Unknown option: --${name}`);
    const value = match[2] ?? argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value`);
    if (name === 'input') args.input.push(value); else args[name] = value;
  }
  return args;
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  if (args.help) { console.log('Validate only by default. Merge exactly 60 selected source leads: --input FILE [--input FILE] [--selection SLUGS.txt] [--out docs/ingest/etruscan-greek-20261015-leads.json]. Metadata-only API preflight: --metadata-preflight --input-list FILE --metadata-out FILE (SKETCHFAB_TOKEN required; no model payload fetched). Audit cloud reports: --audit-run docs/ingest/BATCH-run-ID --leads docs/ingest/BATCH-leads.json. No catalog writes or dispatch.'); return; }
  const read = async file => JSON.parse(await readFile(path.resolve(ROOT, file), 'utf8'));
  let result;
  if (args['metadata-preflight']) {
    if (!args['metadata-out'] || args.out || args['audit-run']) throw new Error('Metadata mode requires --metadata-out, with no merge/run audit');
    if (args['input-list']) {
      const list = await read(args['input-list']);
      if (!Array.isArray(list) || !list.every(item => typeof item === 'string')) throw new Error('Input list must be an array of manifest paths');
      args.input.push(...list);
    }
    result = await preflightMetadata(await Promise.all(args.input.map(read)), { token: process.env.SKETCHFAB_TOKEN });
    const target = path.resolve(ROOT, args['metadata-out']);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ schema: result.schema, expected: result.expected, checked: result.checked, complete: result.complete, errors: result.errors }, null, 2));
    if (!result.complete) process.exitCode = 1;
    return;
  } else if (args['audit-run']) {
    if (!args.leads || args.out || args.input.length) throw new Error('--audit-run requires --leads and cannot write merged output');
    const run = path.resolve(ROOT, args['audit-run']);
    result = auditAcquisition(await read(args.leads), await read(path.join(run, 'fetched.json')), await read(path.join(run, 'last-report.json')));
  } else {
    if (!args.input.length) throw new Error('Provide at least one --input discovery manifest');
    const selection = args.selection ? (await readFile(path.resolve(ROOT, args.selection), 'utf8')).split(/\r?\n/).map(line => line.trim()).filter(Boolean) : undefined;
    let documents = await Promise.all(args.input.map(read));
    if (args.metadata) documents = applyDownloadMetadata(documents, await read(args.metadata));
    const prepared = prepareLeads(documents, await read(args.catalog || 'src/data/catalog.json'), {
      selection, corrections: await read(args.corrections || 'src/data/identity-corrections.json'),
    });
    result = prepared.audit;
    if (args.out && result.ready) {
      const ingest = await realpath(path.join(ROOT, 'docs/ingest'));
      const target = path.resolve(ROOT, args.out);
      if (path.dirname(target) !== ingest || path.basename(target) !== `${BATCH}-leads.json`) throw new Error('Output must be the dedicated docs/ingest batch leads file');
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, `${JSON.stringify(prepared.manifest, null, 2)}\n`, { flag: 'wx' });
      result.output = path.relative(ROOT, target);
      result.output_sha256 = sha(await readFile(target));
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.ready === false || result.passed === false) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
