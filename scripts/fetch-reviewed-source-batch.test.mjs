import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest, aggregateTriplet, safeReason, DEFAULT_BUDGET} from './fetch-reviewed-source-batch.mjs';

const model = n => ({uid: n.toString(16).padStart(32, '0'), slug: `europe/work-${n}`, publisher: 'museum'});
const request = models => ({schema: 'atrium-reviewed-source-request/1', batch: 'test-batch', models});
const manifest = 'docs/ingest/test-batch-source-request.json';
const receipt = m => ({uid: m.uid, slug: m.slug, publisher: m.publisher, originalUnchanged: true,
  source: {file: `${m.uid}/source.glb`, format: 'glb', bytes: 123, sha256: 'a'.repeat(64)}, authenticatedMetadata: {bytes: 123}});

test('one to sixty models split into unchanged bounded triplets', () => {
  const models = Array.from({length: 60}, (_, n) => model(n + 1));
  const checked = validateRequest(request(models), manifest);
  assert.equal(checked.budget, DEFAULT_BUDGET);
  assert.equal(checked.triplets.length, 20);
  assert.deepEqual(checked.triplets.flat(), models);
  assert.deepEqual(validateRequest(request(models.slice(0, 4)), manifest).triplets.map(x => x.length), [3, 1]);
});
test('reject traversal, duplicate UID/slug, oversized counts and invalid byte budgets', () => {
  for (const [input, location] of [[request([]), manifest], [request(Array.from({length: 61}, (_, n) => model(n))), manifest],
    [request([model(1), model(1)]), manifest], [request([model(1), {...model(2), slug: model(1).slug}]), manifest],
    [request([model(1)]), 'docs/ingest/../bad-source-request.json'],
    [{...request([model(1)]), max_total_bytes: 2_000_000_001}, manifest],
    [{...request([model(1)]), max_total_bytes: 1.5}, manifest]]) assert.throws(() => validateRequest(input, location));
});
test('failed triplet preserves acquired byte pins and holds every missing model', () => {
  const models = [model(1), model(2), model(3)];
  const work = receipt(models[0]);
  const combined = aggregateTriplet(models, {status: 'fail', works: [work], error: 'Sketchfab metadata HTTP 404'}, false);
  assert.deepEqual(combined.works, [work]);
  assert.equal(combined.sourceBytes, 123);
  assert.equal(combined.complete, false);
  assert.equal(combined.holds.length, 2);
  assert.equal(combined.holds[0].reason, 'provider-http-404');
});
test('invalid or duplicate child pins never produce a complete acquisition', () => {
  const m = model(1), work = receipt(m);
  assert.equal(aggregateTriplet([m], {status: 'pass', works: [work, work]}, true).complete, false);
  assert.equal(aggregateTriplet([m], {status: 'pass', works: [{...work, originalUnchanged: false}]}, true).works.length, 0);
  assert.equal(aggregateTriplet([m], {status: 'pass', works: [{...work, authenticatedMetadata: {bytes: 124}}]}, true).holds.length, 1);
  assert.equal(aggregateTriplet([m], {status: 'pass', works: [work]}, true).complete, true);
});
test('arbitrary provider errors cannot expose credentials through summary reasons', () => {
  assert.equal(safeReason('fetch failed https://host/?signature=secret'), 'source-triplet-failed');
  assert.equal(safeReason('Credential-bearing metadata cannot enter the source artifact'), 'unsafe-provider-metadata');
});
