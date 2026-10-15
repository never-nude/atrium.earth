#!/usr/bin/env node
// Publish only public provenance and exact incoming-file bindings. Never copy
// arbitrary fetched candidate fields or a provider's short-lived download URL.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PUBLIC_FIELDS = ['source', 'uid', 'slug', 'collection', 'wing', 'wing_unfiled_reason', 'title', 'artist', 'culture',
  'geography', 'subject', 'year', 'year_sort', 'period', 'material', 'dimensions', 'measures', 'museum', 'current_location',
  'displayed_at', 'historical_displayed_at', 'original_location', 'source_institution', 'source_url', 'source_record_url',
  'related_source_record_urls', 'download_api_url', 'download_format', 'download_size_bytes', 'face_count', 'face_count_scope',
  'accession', 'object_identity', 'license', 'license_url', 'license_tier', 'license_slug', 'license_uid', 'license_evidence_url',
  'scan_author', 'attribution', 'scan_source', 'representation', 'note', 'source_description', 'reference_image_url',
  'publisher', 'published_at', 'downloadable_verified', 'downloadable_verified_at', 'require_measured_integrity',
  'logical_batch_id', 'batch_sequence', 'batch_chunk', 'texture_count', 'evidence', 'visual_qa'];
const FETCHED_FIELDS = ['downloaded_path', 'local_source_path', 'filename', 'format', 'bytes', 'original_download_bytes',
  'sha256', 'content_type', 'decoded', 'extracted_from', 'fetched_at'];
const GEOMETRY_FIELDS = ['format', 'bytes', 'faces', 'vertices', 'textures', 'texture_max_resolution', 'api_detail_faces', 'api_detail_textures'];
const PRIVATE_KEY = /^(?:download_url|downloadUrl|authorization|headers|token|access_token|api_token|secret|password|driveId|file_uri|absolutePath)$/i;
const SECRET_QUERY = /^(?:token|access_token|refresh_token|api_key|key|signature|sig|credential|authorization|expires|x-amz-.+|x-goog-.+)$/i;
const safeSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };

function publicValue(value) {
  if (Array.isArray(value)) return value.map(publicValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [name, child] of Object.entries(value)) {
      if (PRIVATE_KEY.test(name)) fail('Private field found inside public lead metadata');
      out[name] = publicValue(child);
    }
    return out;
  }
  if (typeof value === 'string') {
    if (/\bBearer\s+\S+|(?:sediment|file):\/\/|(?:^|\s)\/Users\//i.test(value)) fail('Private reference found inside public lead metadata');
    for (const match of value.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      let parsed;
      try { parsed = new URL(match[0].replaceAll('&amp;', '&')); } catch { fail('Malformed public metadata URL'); }
      if (parsed.username || parsed.password || [...parsed.searchParams.keys()].some(name => SECRET_QUERY.test(name))) fail('Signed or authenticated URL found inside public lead metadata');
    }
  }
  if (!['string', 'number', 'boolean', 'undefined'].includes(typeof value) && value !== null) fail('Unsupported public metadata type');
  return value;
}

function sourcePath(value, slug, { optional = false } = {}) {
  if (optional && value === '') return '';
  const prefix = `.atrium-ingest/sources/${slug}/`;
  if (typeof value !== 'string' || !value.startsWith(prefix) || value.includes('\\') || value.includes('\0')
    || value.split('/').some(part => !part || part === '.' || part === '..') || /[?#]/.test(value)) fail('Fetched source path escapes the exact piece staging directory');
  return value;
}

export function createSourceBackupIndex(leads, fetched, { batch, runId, attempt, workflowHeadSha, checkoutHeadSha, leadsSha256, now = new Date() } = {}) {
  if (leads?.schema !== 'atrium-auto-ingest-candidates/1' || !Array.isArray(leads.candidates)
    || fetched?.schema !== 'atrium-auto-ingest-fetched/1' || !Array.isArray(fetched.candidates)) fail('Expected lead and fetched schemas');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(batch || '') || !/^\d+$/.test(runId || '') || !/^\d+$/.test(attempt || '')
    || !/^[a-f0-9]{40}$/.test(workflowHeadSha || '') || !/^[a-f0-9]{40}$/.test(checkoutHeadSha || '') || !/^[a-f0-9]{64}$/.test(leadsSha256 || '')) fail('Exact batch/run/head/lead hash bindings required');
  const expected = new Map(), uids = new Set();
  for (const lead of leads.candidates) {
    if (!safeSlug(lead?.slug) || typeof lead.uid !== 'string' || !lead.uid || expected.has(lead.slug) || uids.has(lead.uid)) fail('Lead UID/slug identities must be unique');
    expected.set(lead.slug, lead); uids.add(lead.uid);
  }
  const candidates = [], actual = new Set();
  for (const incoming of fetched.candidates) {
    const lead = expected.get(incoming.slug);
    if (!lead || incoming.uid !== lead.uid || actual.has(lead.slug)) fail('Fetched candidate UID/slug does not match a unique public lead');
    actual.add(lead.slug);
    const file = incoming.fetched || {};
    if (!/^[a-f0-9]{64}$/.test(file.sha256 || '') || !positive(file.bytes) || !positive(file.original_download_bytes)) fail('Missing complete incoming SHA/byte binding');
    if (positive(lead.download_size_bytes) && file.original_download_bytes !== lead.download_size_bytes) fail('Incoming original byte count differs from selected source metadata');
    if (lead.expected_sha256 && file.sha256 !== lead.expected_sha256) fail('Incoming original hash differs from pinned source metadata');
    sourcePath(file.downloaded_path, lead.slug); sourcePath(file.local_source_path, lead.slug); sourcePath(file.extracted_from, lead.slug, { optional: true });
    if (file.filename !== path.posix.basename(file.local_source_path) || !/^[a-z0-9]+$/i.test(file.format || '')
      || typeof file.decoded !== 'boolean' || !Number.isFinite(Date.parse(file.fetched_at))
      || typeof file.content_type !== 'string' || file.content_type && !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:;[ a-z0-9=._-]+)?$/i.test(file.content_type)) fail('Malformed fetched file metadata');
    const candidate = {};
    for (const field of PUBLIC_FIELDS) if (Object.hasOwn(lead, field)) candidate[field] = publicValue(lead[field]);
    if (lead.source_geometry) candidate.source_geometry = Object.fromEntries(GEOMETRY_FIELDS.filter(field => Object.hasOwn(lead.source_geometry, field)).map(field => [field, publicValue(lead.source_geometry[field])]));
    candidate.fetched = Object.fromEntries(FETCHED_FIELDS.map(field => [field, file[field]]));
    candidates.push(candidate);
  }
  return { schema: 'atrium-source-backup-index/1', generated_at: now.toISOString(), logical_batch_id: batch,
    acquisition: { repo: 'never-nude/atrium.earth', run_id: runId, run_attempt: attempt, workflow_head_sha: workflowHeadSha,
      checkout_head_sha: checkoutHeadSha, public_stage_leads_sha256: leadsSha256 },
    expected_source_count: expected.size, fetched_source_count: candidates.length,
    missing_slugs: [...expected.keys()].filter(slug => !actual.has(slug)), candidates,
    scope: 'Sanitized early source-backup index only. Provider download URLs, tokens, headers, arbitrary fetched fields and raw errors are omitted. Archive entries still require actual full SHA/byte verification; assembly/visual holds do not remove incoming sources from this backup index.' };
}

async function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (!/^--[a-z-]+$/.test(process.argv[i]) || !process.argv[i + 1]) fail('Expected named arguments with values');
    args[process.argv[i].slice(2)] = process.argv[++i];
  }
  const body = await readFile(args.leads);
  const index = createSourceBackupIndex(JSON.parse(body), JSON.parse(await readFile(args.fetched, 'utf8')), {
    batch: args.batch, runId: args['run-id'], attempt: args.attempt, workflowHeadSha: args['workflow-head-sha'],
    checkoutHeadSha: args['checkout-head-sha'], leadsSha256: sha(body),
  });
  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(index, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ expectedSources: index.expected_source_count, indexedSources: index.fetched_source_count, missingCount: index.missing_slugs.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Source backup index validation failed; no unsafe metadata was published.'); process.exitCode = 1; });
}
