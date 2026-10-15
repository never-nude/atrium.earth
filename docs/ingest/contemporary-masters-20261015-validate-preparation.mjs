#!/usr/bin/env node
// Runs assembly against synthetic files in a temporary repository, never the live catalog.
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { candidateIsKnown, catalogIndexes, isAllowedLicense } from '../../scripts/ingest-utils.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const batch = 'contemporary-masters-20261015';
const manifest = JSON.parse(await readFile(path.join(root, `docs/ingest/${batch}-leads.json`), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(root, 'src/data/catalog.json'), 'utf8'));
const candidates = manifest.candidates;
assert.equal(manifest.logical_batch_id, batch);
assert.equal(manifest.expected_count, 24);
assert.equal(candidates.length, 24);
assert.equal(new Set(candidates.map((candidate) => candidate.uid)).size, 24);
assert.equal(new Set(candidates.map((candidate) => candidate.slug)).size, 24);
const indexes = catalogIndexes(catalog);
for (const candidate of candidates) {
  assert.equal(candidateIsKnown(candidate, indexes), '', `${candidate.slug}: existing catalog identity`);
  assert.equal(candidate.require_measured_integrity, true);
  for (const flag of ['allow_componentized_mesh', 'max_component_count', 'min_largest_component_fraction']) {
    assert.equal(Object.hasOwn(candidate, flag), false, `${candidate.slug}: unsafe blanket exemption`);
  }
  assert.ok(isAllowedLicense(`${candidate.license} ${candidate.license_url}`));
  assert.equal(candidate.license, 'CC BY 4.0');
  assert.equal(candidate.downloadable_verified, true);
  assert.ok(Number.isSafeInteger(candidate.download_size_bytes) && candidate.download_size_bytes > 0);
  assert.equal(candidate.face_count, candidate.source_geometry_face_count);
  assert.equal(candidate.face_count, candidate.source_geometry.faces);
  assert.equal(candidate.download_size_bytes, candidate.source_geometry.bytes);
  assert.ok(['Modern', 'Contemporary'].includes(candidate.period));
  if (candidate.wing === 'unfiled') {
    assert.equal(candidate.geography, '');
    assert.equal(candidate.original_location, '');
    assert.ok(candidate.wing_unfiled_reason.trim().length >= 30);
  }
}
const byUid = new Map(candidates.map((candidate) => [candidate.uid, candidate]));
const milan = byUid.get('c07aae9f5ada4449ab140eb1d96eb5ee');
assert.equal(milan.title, 'Projet pour un monument');
assert.equal(milan.year_sort, 1981);
assert.match(milan.geography, /Verona/);
assert.equal(milan.accession, '');
assert.equal(milan.dimensions, '');
assert.ok(!Object.hasOwn(milan, 'edition'));
assert.equal(byUid.get('285acc2685af46b2ab57fe2f37aaa182').face_count, 19992);
const friend = byUid.get('7eeb0b7e07ac4573840c8822c296d938');
assert.equal(friend.current_location, '');
assert.equal(friend.displayed_at, '');
assert.match(friend.historical_displayed_at, /London.*2023/);
const sages = byUid.get('e7d28455e38242b6ab7b5d18742f340f');
assert.match(sages.museum, /Wrocław/);
assert.match(sages.current_location, /Luxembourg.*loan/);

const workflow = await readFile(path.join(root, '.github/workflows/acquire-leads.yml'), 'utf8');
const fetchEnd = workflow.indexOf('      - name: Temporary source backup (90 days)');
const verifyStart = workflow.indexOf('      - name: Verify strict source batch');
assert.ok(fetchEnd > workflow.indexOf('      - name: Fetch source meshes') && verifyStart > fetchEnd);
const backup = workflow.slice(fetchEnd, verifyStart);
assert.match(backup, /uses: actions\/upload-artifact@v4/);
assert.match(backup, /path: \.atrium-ingest\/sources\//);
assert.match(backup, /retention-days: 90/);
assert.match(backup, /compression-level: 0/);
assert.match(backup, /include-hidden-files: true/);
assert.ok(!/secrets\.|fetched\.json|\.atrium-ingest\/$/.test(backup));

const temporary = await mkdtemp(path.join(os.tmpdir(), 'atrium-prepare-test-'));
try {
  for (const dir of ['scripts', 'src/data', '.atrium-ingest/sources']) {
    await mkdir(path.join(temporary, dir), { recursive: true });
  }
  for (const script of ['assemble-piece.mjs', 'ingest-utils.mjs', 'ingest-batch.mjs']) {
    await copyFile(path.join(root, 'scripts', script), path.join(temporary, 'scripts', script));
  }
  for (const [filename, content] of [['catalog.json', []], ['orientations.json', {}], ['previews.json', {}]]) {
    await writeFile(path.join(temporary, 'src/data', filename), JSON.stringify(content));
  }
  const pythonShim = path.join(temporary, 'orientation-fixture.mjs');
  await writeFile(pythonShim, `#!/usr/bin/env node
const source = process.argv[3] || '';
const skipped = source.includes('measurement-skipped');
const integrity = skipped ? { skipped: true, faces: null, ncomp: null, bratio: null } : {
  faces: 12345, ncomp: source.includes('too-many-components') ? 51 : 1, bratio: 0, largest_frac: 1
};
console.log(JSON.stringify({ upAxis: 'y', modelRotation: [0,0,0], yaw: 0, confidence: 1, flag: 'auto', integrity }));
`, { mode: 0o755 });
  const reason = 'The exact production location is unknown; the named museum only holds this synthetic test object.';
  const testCases = [
    { slug: 'modern/explicit-unfiled', wing: 'unfiled', wing_unfiled_reason: reason, original_location: '', museum: 'Owning Museum', current_location: '', displayed_at: 'Historical display only', historical_displayed_at: 'Historical display in 2023' },
    { slug: 'modern/implicit-unfiled-origin', wing: 'unfiled', wing_unfiled_reason: reason, geography: '', museum: 'Holding Museum' },
    { slug: 'modern/filed-owner-and-loan', wing: 'europe', geography: 'Documented Making Place', original_location: 'Documented Making Place', museum: 'Owning Museum', current_location: 'Loan Museum', displayed_at: 'Loan Museum' },
    { slug: 'modern/no-origin-from-museum', wing: 'europe', museum: 'Holding Museum' },
    { slug: 'modern/unfiled-boundary-reason', wing: 'unfiled', wing_unfiled_reason: 'Exact making place is unknown.' },
    { slug: 'modern/unfiled-short-reason', wing: 'unfiled', wing_unfiled_reason: 'Unknown' },
    { slug: 'modern/unfiled-missing-reason', wing: 'unfiled' },
    { slug: 'modern/invalid-wing', wing: 'invented-wing' },
    { slug: 'modern/measurement-skipped', wing: 'unfiled', wing_unfiled_reason: reason },
    { slug: 'modern/too-many-components', wing: 'unfiled', wing_unfiled_reason: reason },
  ];
  const sourceBodies = new Map();
  const synthetic = [];
  for (const testCase of testCases) {
    const filename = `${path.basename(testCase.slug)}.glb`;
    const local = path.join('.atrium-ingest/sources', filename);
    // No real model or acquisition: these bytes are only used to test byte-for-byte copying.
    const body = Buffer.from(`synthetic authored source bytes: ${testCase.slug}`);
    await writeFile(path.join(temporary, local), body);
    sourceBodies.set(testCase.slug, body);
    synthetic.push({ source: 'test', title: testCase.slug, license: 'CC BY 4.0', require_measured_integrity: true, ...testCase,
      fetched: { local_source_path: local, filename, format: 'glb', bytes: body.length } });
  }
  await writeFile(path.join(temporary, '.atrium-ingest/fetched.json'), JSON.stringify({ candidates: synthetic }));
  const run = spawnSync(process.execPath, ['scripts/assemble-piece.mjs', '--skip-assets', `--batch=${batch}`], {
    cwd: temporary, encoding: 'utf8', env: { ...process.env, PYTHON: pythonShim },
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  const report = JSON.parse(await readFile(path.join(temporary, '.atrium-ingest/last-report.json'), 'utf8'));
  const result = JSON.parse(await readFile(path.join(temporary, 'src/data/catalog.json'), 'utf8'));
  assert.equal(result.length, 5);
  assert.equal(report.rejected.length, 5);
  const entries = new Map(result.map((entry) => [entry.slug, entry]));
  const unknown = entries.get('modern/explicit-unfiled');
  assert.equal(unknown.wing, 'unfiled');
  assert.equal(unknown.wing_unfiled_reason, reason);
  assert.equal(unknown.original_location, '');
  assert.equal(unknown.current_location, '');
  assert.equal(unknown.museum, 'Owning Museum');
  assert.equal(unknown.historical_displayed_at, 'Historical display in 2023');
  assert.equal(entries.get('modern/implicit-unfiled-origin').original_location, '');
  assert.equal(entries.get('modern/no-origin-from-museum').original_location, '');
  assert.equal(entries.get('modern/unfiled-boundary-reason').wing_unfiled_reason.length, 30);
  const loan = entries.get('modern/filed-owner-and-loan');
  assert.equal(loan.museum, 'Owning Museum');
  assert.equal(loan.current_location, 'Loan Museum');
  assert.equal(loan.original_location, 'Documented Making Place');
  assert.ok(report.rejected.filter((item) => item.reason.includes('at least 30')).length === 2);
  assert.ok(report.rejected.some((item) => item.reason.includes('unknown wing override')));
  assert.ok(report.rejected.filter((item) => item.reason === 'geometry failed integrity gate').length === 2);
  for (const entry of result) {
    const archived = await readFile(path.join(temporary, '.atrium-ingest/source-archive', entry.model.sourcePath));
    assert.deepEqual(archived, sourceBodies.get(entry.slug));
    assert.equal(entry.model.sizeBytes, archived.length);
    assert.equal(createHash('sha256').update(archived).digest('hex'), createHash('sha256').update(sourceBodies.get(entry.slug)).digest('hex'));
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.log('Validated24 candidates, source-backup scope/order, documented Unfiled assembly, ownership/loan/history fields, strict measured-integrity gates and unchanged synthetic source bytes.');
