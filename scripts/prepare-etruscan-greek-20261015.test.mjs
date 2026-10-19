import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { BATCH, checkCandidate, prepareLeads, auditAcquisition, recordKey, preflightMetadata, applyDownloadMetadata } from './prepare-etruscan-greek-20261015.mjs';

const now = new Date('2026-10-15T12:00:00Z');
function candidate(index = 1, changes = {}) {
  const uid = index.toString(16).padStart(32, '0');
  return {
    source: 'sketchfab', uid, slug: `greek/test-vessel-${index}`, collection: 'greek', wing: 'greece-rome',
    title: `Attic Red-Figure Vessel ${index}`, artist: 'Unknown Attic potter', culture: 'Greek, Attic',
    geography: 'Attica, Greece', original_location: 'Attica, Greece', museum: 'Fixture Museum',
    year: 'c. 450 BCE', year_sort: -450, period: 'Ancient', material: 'Terracotta; red-figure',
    accession: `Test ${index}`, source_institution: 'Fixture Museum', source_url: `https://sketchfab.com/3d-models/${uid}`,
    source_record_url: `https://museum.example/art/${index}`, reference_image_url: `https://media.sketchfab.com/models/${uid}/thumb.jpg`,
    license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', license_tier: 2,
    license_evidence_url: `https://api.sketchfab.com/v3/models/${uid}`,
    download_api_url: `https://api.sketchfab.com/v3/models/${uid}/download`, download_format: 'glb',
    downloadable_verified: true, downloadable_verified_at: '2026-10-15', download_size_bytes: 1000,
    face_count: 70712, face_count_scope: 'api-detail-only-unmeasured',
    source_geometry: { format: 'glb', bytes: 1000, faces: null, api_detail_faces: 70712 },
    require_measured_integrity: true, scan_author: 'Fixture Museum', attribution: 'Fixture Museum, CC BY 4.0',
    scan_source: 'Photogrammetric scan of the museum object', note: 'Complete physical vessel, metadata fixture only.',
    evidence: ['Exact museum record and publisher identify the same accession.'], ...changes,
  };
}
const document = candidates => ({ schema: 'atrium-auto-ingest-candidates/1', candidates });
const prepare = (candidates, catalog = [], options = {}) => prepareLeads([document(candidates)], catalog, { expectedCount: candidates.length, now, ...options });
const reasons = audit => JSON.stringify(audit.issues);

test('merges exactly 60 without mutating discovery inputs or assigning featured membership', () => {
  const original = document(Array.from({ length: 60 }, (_, i) => candidate(i + 1)));
  const before = JSON.stringify(original);
  const { manifest, audit } = prepareLeads([original], [], { now });
  assert.equal(audit.ready, true, reasons(audit));
  assert.equal(manifest.expected_count, 60);
  assert.equal(manifest.strict_acquisition, false);
  assert.equal(manifest.logical_batch_id, BATCH);
  assert.deepEqual(manifest.candidates.map(item => item.batch_sequence), Array.from({ length: 60 }, (_, i) => i + 1));
  assert.ok(manifest.candidates.every(item => item.require_measured_integrity && item.logical_batch_id === BATCH));
  assert.ok(manifest.candidates.every(item => !('tier' in item) && !('featured' in item) && !('ingested_at' in item)));
  assert.equal(JSON.stringify(original), before);
});

test('coalesces only identical source entries and blocks ambiguous UID/object collisions', () => {
  const first = candidate();
  const same = prepareLeads([document([first]), document([structuredClone(first)])], [], { expectedCount: 1, now });
  assert.equal(same.audit.ready, true);
  assert.equal(same.audit.duplicate_entries.length, 1);
  assert.match(reasons(prepareLeads([document([first, { ...first, material: 'Bronze' }])], [], { expectedCount: 1, now }).audit), /conflicting duplicate source UID/);
  const otherUid = candidate(2, { source_record_url: first.source_record_url });
  assert.match(reasons(prepare([first, otherUid]).audit), /duplicate physical object identity/);
});

test('rejects existing source UID even when source URL title and slug change', () => {
  const first = candidate();
  const catalog = [{ slug: 'old/other', title: 'Old title', source_url: `https://sketchfab.com/3d-models/old-title-${first.uid}` }];
  assert.match(reasons(prepare([first], catalog).audit), /catalog source UID already exists/);
});

test('rejects exact museum object aliases and institution-scoped accession duplicates', () => {
  assert.equal(recordKey('https://www.museum.example/en/art/2/'), recordKey('https://museum.example/art/2'));
  const existing = [{ slug: 'old/other', title: 'Old title', source_record_url: 'https://www.museum.example/en/art/1/' }];
  assert.match(reasons(prepare([candidate()], existing).audit), /catalog object identity already exists/);
  const accession = [{ slug: 'old/another', title: 'Another title', museum: 'Fixture Museum', accession: 'Test-1' }];
  assert.match(reasons(prepare([candidate()], accession).audit), /catalog object identity already exists/);
  // Same number at another museum is not treated as the same object identity.
  assert.doesNotMatch(reasons(prepare([candidate()], [{ ...accession[0], museum: 'Different Museum' }]).audit), /catalog object identity already exists/);
});

test('honors production identity correction fields during duplicate detection', () => {
  const result = prepare([candidate()], [{ slug: 'old/other', title: 'Old title' }], {
    corrections: { 'old/other': { catalog: { source_record_url: 'https://museum.example/art/1' } } },
  });
  assert.match(reasons(result.audit), /catalog object identity already exists/);
});

test('reports generic current assembler title/accession collisions before downloads', () => {
  assert.match(reasons(prepare([candidate()], [{ slug: 'old/other', title: candidate().title }]).audit), /current fetch\/assembler would skip by title/);
  assert.match(reasons(prepare([candidate()], [{ slug: 'old/other', title: 'Unrelated', accession: 'Test 1' }]).audit), /current fetch\/assembler would skip by accession/);
});

test('selection is explicit and exact; no silent top-60 truncation or padding', () => {
  const items = [candidate(), candidate(2)];
  assert.equal(prepare(items, [], { selection: [items[1].slug], expectedCount: 1 }).audit.ready, true);
  assert.match(reasons(prepare(items, [], { selection: ['greek/missing'], expectedCount: 1 }).audit), /selected slug missing/);
  assert.match(reasons(prepare(items, [], { selection: [items[0].slug, items[0].slug] }).audit), /unique slug/);
  assert.match(reasons(prepare(items, [], { expectedCount: 60 }).audit), /exactly 60/);
});

test('unavailable archive bytes and falsely labeled detail counts are preparation holds', () => {
  assert.match(checkCandidate(candidate(1, { download_size_bytes: null }), { now }).join(';'), /archive byte count unresolved/);
  assert.match(checkCandidate(candidate(1, { source_geometry: { format: 'glb', bytes: 1000, faces: 70712 } }), { now }).join(';'), /face count scope/);
  assert.deepEqual(checkCandidate(candidate(1, { face_count_scope: 'selected-download-archive', source_geometry: { format: 'glb', bytes: 1000, faces: 70712 } }), { now }), []);
});

test('blocks all integrity exemptions and expired/unverified download claims', () => {
  for (const flag of ['allow_componentized_mesh', 'max_component_count', 'min_largest_component_fraction', 'skip_integrity', 'alternate_downloads']) {
    assert.match(checkCandidate(candidate(1, { [flag]: false }), { now }).join(';'), /override forbidden/);
  }
  assert.match(checkCandidate(candidate(1, { downloadable_verified: false }), { now }).join(';'), /eligibility must be checked/);
  assert.match(checkCandidate(candidate(1, { downloadable_verified_at: '2025-01-01' }), { now }).join(';'), /missing or stale/);
});

test('rejects restrictive/mismatched licensing, wrong source identity and private material', () => {
  for (const license of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'All rights reserved']) assert.match(checkCandidate(candidate(1, { license }), { now }).join(';'), /license label/);
  assert.match(checkCandidate(candidate(1, { license_url: 'https://creativecommons.org/licenses/by-nc/4.0/' }), { now }).join(';'), /license label/);
  assert.match(checkCandidate(candidate(1, { download_api_url: 'https://api.sketchfab.com/v3/models/wrong/download' }), { now }).join(';'), /exact UID/);
  for (const changes of [{ download_url: 'https://example.org/source.glb' }, { metadata: { token: 'fixture-not-a-secret' } },
    { reference_image_url: 'https://example.org/image?X-Amz-Signature=fixture' }, { privatePath: '/Users/fixture/source.glb' }]) {
    assert.match(checkCandidate(candidate(1, changes), { now }).join(';'), /private\/ephemeral/);
  }
});

test('holding/scan location cannot fill an undocumented manufacture origin', () => {
  const unfiled = candidate(1, { wing: 'unfiled', geography: '', original_location: '', wing_unfiled_reason: 'The exact production origin remains unknown; the museum is only the holding collection.' });
  assert.deepEqual(checkCandidate(unfiled, { now }), []);
  assert.match(checkCandidate({ ...unfiled, geography: 'Fixture Museum address' }, { now }).join(';'), /museum-derived origin/);
  assert.match(checkCandidate(candidate(1, { geography: '', original_location: '' }), { now }).join(';'), /origin separately/);
  assert.deepEqual(checkCandidate(candidate(1, { wing: 'near-east', geography: 'Egypt (documented production in synthetic evidence)', original_location: 'Egypt' }), { now }), []);
  assert.match(checkCandidate(candidate(1, { wing: 'invented-wing' }), { now }).join(';'), /existing origin-based wing/);
});

test('unknown ancient makers and safe raw HTTP license evidence are preserved honestly', () => {
  const unknown = candidate(1, { artist: '', raw_api_evidence: { license: { url: 'http://creativecommons.org/licenses/by/4.0/' } } });
  assert.deepEqual(checkCandidate(unknown, { now }), []);
  assert.match(checkCandidate({ ...unknown, raw_api_evidence: { url: 'http://example.org?token=fixture' } }, { now }).join(';'), /private\/ephemeral/);
  assert.deepEqual(checkCandidate(candidate(1, { year: 'Unknown (ancient Apulian)', year_sort: null }), { now }), []);
  assert.match(checkCandidate(candidate(1, { year: 'c. 450 BCE', year_sort: null }), { now }).join(';'), /chronology/);
});

function runFixture() {
  const manifest = prepare([candidate()]).manifest;
  const fetched = { candidates: [{ ...manifest.candidates[0], fetched: { sha256: 'a'.repeat(64), original_download_bytes: 1000, bytes: 2000, format: 'glb', decoded: true } }], report: { errors: [] } };
  const report = { accepted: [{ slug: candidate().slug, integrity_data: { faces: 60000, ncomp: 1, bratio: 0.01, largest_frac: 1 } }], rejected: [] };
  return { manifest, fetched, report };
}

test('post-run audit accepts measured geometry without pretending detail faces equal archive faces', () => {
  const { manifest, fetched, report } = runFixture();
  const result = auditAcquisition(manifest, fetched, report);
  assert.equal(result.passed, true, reasons(result));
  assert.match(result.limits, /appearance/);
});

test('post-run audit rejects missing sources, wrong bytes/hash, skipped geometry and exemptions', () => {
  for (const change of [
    ({ fetched }) => { fetched.candidates = []; },
    ({ fetched }) => { fetched.candidates[0].fetched.original_download_bytes = 999; },
    ({ fetched }) => { fetched.candidates[0].fetched.sha256 = 'prefix-only'; },
    ({ fetched }) => { fetched.candidates[0].allow_componentized_mesh = true; },
    ({ report }) => { report.accepted[0].integrity_data.skipped = true; },
    ({ report }) => { report.accepted[0].integrity_data.ncomp = 51; },
    ({ report }) => { report.accepted[0].integrity_data.largest_frac = 0.49; },
  ]) {
    const fixture = runFixture(); change(fixture);
    assert.equal(auditAcquisition(fixture.manifest, fixture.fetched, fixture.report).passed, false);
  }
});

test('post-run audit enforces actual archived face counts and exact accepted set', () => {
  const fixture = runFixture();
  fixture.manifest.candidates[0].face_count_scope = 'selected-download-archive';
  assert.match(reasons(auditAcquisition(fixture.manifest, fixture.fetched, fixture.report)), /faces differ/);
  fixture.report.accepted.push(structuredClone(fixture.report.accepted[0]));
  assert.match(reasons(auditAcquisition(fixture.manifest, fixture.fetched, fixture.report)), /duplicate accepted/);
});

test('preparation aligns with actual workflow source-only artifact and strict-integrity assembly', async () => {
  const workflow = await readFile(new URL('../.github/workflows/acquire-leads.yml', import.meta.url), 'utf8');
  const backupStart = workflow.indexOf('      - name: Temporary source backup (90 days)');
  const verifyStart = workflow.indexOf('      - name: Verify strict source batch');
  const backup = workflow.slice(backupStart, verifyStart);
  assert.ok(backupStart > workflow.indexOf('      - name: Fetch source meshes'));
  assert.match(backup, /path: \.atrium-ingest\/sources\//);
  assert.match(backup, /compression-level: 0/);
  assert.match(backup, /retention-days: 90/);
  assert.doesNotMatch(backup, /path: \.atrium-ingest\/$/m);
  const assemble = await readFile(new URL('./assemble-piece.mjs', import.meta.url), 'utf8');
  assert.match(assemble, /if \(integrity\.skipped\) return Boolean\(candidate\.require_measured_integrity\)/);
  assert.match(assemble, /if \(Number\(integrity\.ncomp\) > 50\) return true/);
});

test('metadata preflight spaces sequential calls and never requests or retains signed payload URLs', async () => {
  let time = now.getTime();
  const calls = [];
  const result = await preflightMetadata([document([candidate(), candidate(2)])], {
    token: 'fixture-secret', clock: () => time, sleep: async ms => { time += ms; },
    fetchImpl: async (endpoint, options) => {
      calls.push({ endpoint, time, options });
      assert.match(endpoint, /^https:\/\/api\.sketchfab\.com\/v3\/models\/[a-f0-9]{32}(?:\/download)?$/);
      const uid = endpoint.match(/[a-f0-9]{32}/)[0];
      return new Response(JSON.stringify(endpoint.endsWith('/download')
        ? { glb: { size: 1000, url: 'https://private.example/model.glb?token=do-not-retain', expires: 123 } }
        : { uid, isDownloadable: true, faceCount: 70712, vertexCount: 35000,
          license: { slug: 'by', label: 'CC Attribution', uid: 'fixture', url: 'http://creativecommons.org/licenses/by/4.0/' },
          user: { email: 'do-not-retain@example.org' } }));
    },
  });
  assert.equal(result.complete, true);
  assert.equal(calls.length, 4);
  assert.ok(calls.slice(1).every((call, i) => call.time - calls[i].time >= 5000));
  assert.equal(result.models[0].selected_download.faces, null);
  assert.equal(result.models[0].api_detail.faces, 70712);
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret|private\.example|do-not-retain|expires|email|download_url/);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers.Authorization, 'Token fixture-secret');
});

test('metadata preflight honors 429 Retry-After and fails bounded retries without leaking response', async () => {
  let time = now.getTime(), calls = 0;
  const result = await preflightMetadata([document([candidate()])], {
    token: 'fixture', clock: () => time, sleep: async ms => { time += ms; }, retryBudgetMs: 10000,
    fetchImpl: async () => { calls++; return new Response('private failure body never retained', { status: 429, headers: { 'retry-after': '10' } }); },
  });
  assert.equal(calls, 2);
  assert.equal(time - now.getTime(), 10000);
  assert.equal(result.complete, false);
  assert.match(result.errors[0].reason, /retry budget exhausted/);
  assert.doesNotMatch(JSON.stringify(result), /private failure/);
  await assert.rejects(preflightMetadata([document([candidate()])], { token: 'fixture', intervalMs: 4999 }), /5000/);
});

test('metadata supports the reviewed expansion batch and rejects crossed or unsupported identities', async () => {
  const batch = 'beautiful-expansion-20261019';
  let time = now.getTime();
  const input = { ...document([candidate()]), logical_batch_id: batch };
  const options = { token: 'fixture', batch, clock: () => time, sleep: async ms => { time += ms; },
    fetchImpl: async endpoint => new Response(JSON.stringify(endpoint.endsWith('/download')
      ? { glb: { size: 1000 } }
      : { uid: candidate().uid, isDownloadable: true, license: { url: candidate().license_url } })) };
  const result = await preflightMetadata([input], options);
  assert.equal(result.batch, batch);
  assert.equal(result.complete, true);
  await assert.rejects(preflightMetadata([input], { ...options, batch: BATCH }), /batch mismatch/);
  await assert.rejects(preflightMetadata([input], { ...options, batch: 'unreviewed-batch' }), /Unsupported/);
});

test('metadata preflight checks eligibility, UID, GLB presence and network errors before any source acquisition', async () => {
  for (const detail of [{ uid: 'f'.repeat(32), isDownloadable: true }, { uid: candidate().uid, isDownloadable: false }]) {
    let calls = 0;
    const result = await preflightMetadata([document([candidate()])], { token: 'fixture', fetchImpl: async () => { calls++; return new Response(JSON.stringify(detail)); } });
    assert.equal(result.complete, false); assert.equal(calls, 1);
  }
  const result = await preflightMetadata([document([candidate()])], { token: 'fixture', fetchImpl: async () => { throw new Error('secret signed URL https://example.org?secret'); } });
  assert.equal(result.complete, false); assert.doesNotMatch(JSON.stringify(result), /signed URL|example\.org/);
});

test('metadata adapter preserves discovery records, accepts null archive faces and rejects license/size conflicts', () => {
  const original = document([candidate(1, { download_size_bytes: null, source_geometry: { format: 'glb', bytes: null, faces: null, api_detail_faces: 70712 } })]);
  const metadata = { schema: 'atrium-selected-download-metadata/1', batch: BATCH, models: [{ uid: candidate().uid, checked_at: now.toISOString(), downloadable: true,
    license: { url: candidate().license_url }, selected_download: { format: 'glb', bytes: 1000, faces: null }, api_detail: { faces: 70712 } }] };
  const applied = applyDownloadMetadata([original], metadata);
  assert.equal(original.candidates[0].download_size_bytes, null);
  assert.deepEqual(checkCandidate(applied[0].candidates[0], { now }), []);
  assert.equal(applied[0].candidates[0].source_geometry.faces, null);
  const badLicense = structuredClone(metadata); badLicense.models[0].license.url = 'https://creativecommons.org/licenses/by-nc/4.0/';
  assert.throws(() => applyDownloadMetadata([original], badLicense), /license disagrees/);
  assert.throws(() => applyDownloadMetadata([document([candidate(1, { download_size_bytes: 999 })])], metadata), /size changed/);
});

test('expansion permits later art with unchanged identity, license and measured-integrity gates', () => {
  const batch = 'beautiful-expansion-20261019';
  const work = candidate(1, { slug: 'modern/test-sculpture-1', collection: 'modern', wing: 'europe', year: '1960s', year_sort: 1960, period: 'Modern', logical_batch_id: batch });
  assert.deepEqual(checkCandidate(work, { now, batch }), []);
  assert.match(checkCandidate(work, { now }).join(';'), /unsupported slug|ancient date/);
  const input = { ...document([work]), logical_batch_id: batch };
  const result = prepareLeads([input], [], { now, batch, expectedCount: 1, chunk: 2, sequenceOffset: 60 });
  assert.equal(result.audit.ready, true, reasons(result.audit));
  assert.equal(result.manifest.logical_batch_id, batch);
  assert.equal(result.manifest.chunk, 2);
  assert.equal(result.manifest.candidates[0].batch_sequence, 61);
  assert.equal(result.manifest.candidates[0].batch_chunk, 2);
  assert.equal(result.manifest.candidates[0].require_measured_integrity, true);
  assert.match(checkCandidate({ ...work, skip_integrity: true }, { now, batch }).join(';'), /override forbidden/);
  assert.match(checkCandidate({ ...work, slug: 'modern/../test' }, { now, batch }).join(';'), /unsupported slug/);
  assert.match(checkCandidate({ ...work, wing: 'americas' }, { now, batch }).join(';'), /wing must/);
  assert.throws(() => prepareLeads([input], [], { batch: 'other' }), /Unsupported preparation batch/);
  assert.match(reasons(prepareLeads([{ ...input, logical_batch_id: BATCH }], [], { now, batch, expectedCount: 1 }).audit), /batch mismatch/);
});

test('expansion download adapter rejects crossed batch and changed licenses', () => {
  const batch = 'beautiful-expansion-20261019';
  const work = candidate(1, { logical_batch_id: batch });
  const input = { ...document([work]), logical_batch_id: batch };
  const metadata = { schema: 'atrium-selected-download-metadata/1', batch, models: [{ uid: work.uid, checked_at: now.toISOString(), downloadable: true, license: { url: work.license_url }, selected_download: { format: 'glb', bytes: 1000, faces: null }, api_detail: { faces: 70712 } }] };
  assert.equal(applyDownloadMetadata([input], metadata, { batch })[0].candidates[0].source_geometry.api_detail_faces, 70712);
  assert.throws(() => applyDownloadMetadata([input], { ...metadata, batch: BATCH }, { batch }), /schema\/batch/);
  assert.throws(() => applyDownloadMetadata([input], metadata), /batch mismatch/);
  metadata.models[0].license.url = 'https://creativecommons.org/licenses/by-nc/4.0/';
  assert.throws(() => applyDownloadMetadata([input], metadata, { batch }), /license disagrees/);
});
