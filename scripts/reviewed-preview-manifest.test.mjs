import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReviewedPreviewManifest as validate} from './reviewed-preview-manifest.mjs';

const model = bytes => ({slug: 'modern/test', url: 'https://github.com/never-nude/atrium.earth/releases/download/reviewed/test.glb', sha256: 'a'.repeat(64), bytes});
const request = (bytes, extra = {}) => ({schema: 'atrium-reviewed-preview-upload/1', models: [model(bytes)], ...extra});

test('existing manifests retain the 100 MB default', () => {
  assert.equal(validate(request(100_000_000)).totalBytes, 100_000_000);
  assert.throws(() => validate(request(100_000_001)), /binding/);
});
test('reviewed native exception requires both declarations and explicit budgets', () => {
  const r = request(129_231_964, {max_model_bytes: 200_000_000, max_total_bytes: 500_000_000});
  assert.throws(() => validate(r), /completed review/);
  r.models[0].nativeAndPairedReviewApproved = true;
  assert.throws(() => validate(r), /unfeatured/);
  r.models[0].unfeatured = true;
  assert.equal(validate(r).totalBytes, 129_231_964);
  delete r.max_total_bytes;
  assert.throws(() => validate(r), /budget/);
});
test('per-file and aggregate limits remain bounded', () => {
  assert.throws(() => validate(request(1, {max_model_bytes: 250_000_001, max_total_bytes: 1})), /budget/);
  assert.throws(() => validate(request(1, {max_total_bytes: 2_000_000_001})), /budget/);
  const r = request(60, {max_total_bytes: 100});
  r.models.push({...model(60), slug: 'modern/second'});
  assert.throws(() => validate(r), /aggregate/);
});
test('duplicate, unpinned and foreign bindings fail before downloads', () => {
  const r = request(1); r.models.push({...r.models[0]});
  assert.throws(() => validate(r), /binding/);
  for (const change of [{bytes: '12'}, {bytes: -1}, {sha256: 'bad'}, {slug: '../escape'}, {url: 'https://example.com/model.glb'}]) {
    const r = request(1); Object.assign(r.models[0], change);
    assert.throws(() => validate(r), /binding/);
  }
});
