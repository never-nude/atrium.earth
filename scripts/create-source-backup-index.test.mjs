import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSourceBackupIndex } from './create-source-backup-index.mjs';

const uid = 'a'.repeat(32), slug = 'greek/fixture-vessel';
const options = { batch: 'etruscan-greek-20261015', runId: '1', attempt: '1', workflowHeadSha: 'a'.repeat(40), checkoutHeadSha: 'b'.repeat(40), leadsSha256: 'c'.repeat(64), now: new Date('2026-10-15T00:00:00Z') };
const leads = { schema: 'atrium-auto-ingest-candidates/1', candidates: [{ source: 'sketchfab', uid, slug, title: 'Fixture Vessel', license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', download_size_bytes: 123, require_measured_integrity: true, attribution: 'Fixture Author', source_url: `https://sketchfab.com/3d-models/${uid}` }] };
function fetched() { return { schema: 'atrium-auto-ingest-fetched/1', candidates: [{ uid, slug,
  title: 'Untrusted fetched title', authorization: 'never copy this', source_description: 'https://private.example?token=never',
  fetched: { downloaded_path: `.atrium-ingest/sources/${slug}/incoming.glb`, local_source_path: `.atrium-ingest/sources/${slug}/decoded.glb`, filename: 'decoded.glb', format: 'glb', bytes: 456, original_download_bytes: 123, sha256: 'd'.repeat(64), content_type: 'model/gltf-binary', decoded: true, extracted_from: '', fetched_at: '2026-10-15T00:00:00Z',
    download_url: 'https://private.example/asset?X-Amz-Signature=never', token: 'never', headers: { Authorization: 'never' }, raw_error: 'never' } }], report: { errors: [{ reason: 'https://private.example?token=never' }] } }; }

test('allowlists public lead metadata and exact fetched source fields without signed URL, credentials or raw errors', () => {
  const result = createSourceBackupIndex(leads, fetched(), options);
  assert.equal(result.schema, 'atrium-source-backup-index/1');
  assert.equal(result.candidates[0].title, 'Fixture Vessel');
  assert.equal(result.candidates[0].fetched.sha256, 'd'.repeat(64));
  assert.equal(result.candidates[0].fetched.original_download_bytes, 123);
  assert.equal(result.candidates[0].fetched.bytes, 456);
  assert.equal(result.acquisition.public_stage_leads_sha256, options.leadsSha256);
  assert.doesNotMatch(JSON.stringify(result), /private\.example|"download_url"|"authorization"|"headers"|"raw_error"|never copy this/);
});

test('rejects identity collisions, unknown fetched objects and wrong exact hashes/bytes', () => {
  for (const mutate of [
    data => { data.candidates[0].uid = 'e'.repeat(32); },
    data => { data.candidates.push(structuredClone(data.candidates[0])); },
    data => { data.candidates[0].slug = 'greek/unknown'; },
    data => { data.candidates[0].fetched.original_download_bytes = 122; },
    data => { data.candidates[0].fetched.sha256 = 'prefix-only'; },
  ]) { const data = fetched(); mutate(data); assert.throws(() => createSourceBackupIndex(leads, data, options)); }
  const pinned = structuredClone(leads); pinned.candidates[0].expected_sha256 = 'e'.repeat(64);
  assert.throws(() => createSourceBackupIndex(pinned, fetched(), options), /pinned source/);
});

test('rejects source path escape, filename mismatch and malformed downloaded metadata', () => {
  for (const mutate of [
    data => { data.candidates[0].fetched.downloaded_path = `.atrium-ingest/sources/${slug}/../other.glb`; },
    data => { data.candidates[0].fetched.local_source_path = '/Users/private/source.glb'; },
    data => { data.candidates[0].fetched.filename = 'different.glb'; },
    data => { data.candidates[0].fetched.content_type = 'Bearer never'; },
  ]) { const data = fetched(); mutate(data); assert.throws(() => createSourceBackupIndex(leads, data, options)); }
});

test('rejects signed or token-bearing material even inside otherwise public lead fields', () => {
  for (const unsafe of [
    { note: 'reference https://private.example/asset?X-Amz-Credential=never' },
    { evidence: ['https://private.example/asset?signature=never'] },
    { measures: [{ axis: 'height', token: 'never' }] },
    { source_url: 'https://user:password@example.org/' },
  ]) { const data = structuredClone(leads); Object.assign(data.candidates[0], unsafe); assert.throws(() => createSourceBackupIndex(data, fetched(), options)); }
});

test('retains geometry-hold incoming sources and marks truly missing sources without copying raw fetch errors', () => {
  const data = fetched(); data.candidates[0].quality_hold = true;
  assert.equal(createSourceBackupIndex(leads, data, options).fetched_source_count, 1);
  const missing = createSourceBackupIndex(leads, { ...data, candidates: [] }, options);
  assert.deepEqual(missing.missing_slugs, [slug]);
  assert.equal(missing.fetched_source_count, 0);
  assert.doesNotMatch(JSON.stringify(missing), /private\.example|never copy this/);
});
