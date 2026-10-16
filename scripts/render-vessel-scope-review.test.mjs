import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import * as THREE from 'three';
import { Document } from '@gltf-transform/core';
import { chromium } from 'playwright';
import { cameraViews, bindRequest, inspectGlb, productionAppearanceFactory, reviewHtml, transformFingerprint, createLegacyMaterialReference, documentGeometryFingerprint, preserveReferenceNodeTransforms } from './render-vessel-scope-review.mjs';
import { frameCameraToBox } from '../public/model-render-utils.js';

const root = resolve('.');
const productionHtml = readFileSync('public/__render.html', 'utf8');
const html = reviewHtml(productionHtml);
const script = readFileSync('scripts/render-thumbnails.mjs', 'utf8');
const data = (file) => JSON.parse(readFileSync(file, 'utf8'));
const appearance = productionAppearanceFactory(script, data('src/data/material-appearances.json'), data('src/data/appearance-overrides.json'), new Map([['greek/test', { slug: 'greek/test', collection: 'greek', title: 'Test vase', material: 'Ceramic' }]]));
assert.equal(appearance('greek/test').baseColor, data('src/data/material-appearances.json').profiles.ceramic.baseColor);
assert.throws(() => productionAppearanceFactory(script.replace('function clean(value)', 'function renamed(value)'), {}, {}, new Map()), /boundaries/);
assert.throws(() => reviewHtml(productionHtml.replace('scene.add(m); current=m;', 'scene.add(m);')), /hook changed/);
assert.equal(productionHtml, readFileSync('public/__render.html', 'utf8'), 'Adapter does not rewrite production HTML');

for (const transform of ['auto', { viewDirection: [3, 9, -4], yaw: 63 }, { viewDirection: [0, 1, 0] }]) {
  const views = cameraViews(transform), vectors = views.map((v) => new THREE.Vector3(...v.direction));
  assert.deepEqual(views.map((v) => v.key), ['FRONT', 'REVERSE', 'ABOVE', 'UNDERSIDE']);
  assert(Math.abs(vectors[0].dot(vectors[1]) + 1) < 1e-12);
  assert(Math.abs(vectors[2].dot(vectors[3]) + 1) < 1e-12);
  assert(Math.abs(vectors[0].dot(vectors[2])) < 1e-12);
  for (const view of views) {
    const camera = new THREE.PerspectiveCamera(32, 0.8, 0.01, 100);
    camera.up.set(...view.up);
    const box = new THREE.Box3(new THREE.Vector3(-0.4, -0.5, -0.2), new THREE.Vector3(0.4, 0.5, 0.2));
    const frame = frameCameraToBox(THREE, camera, box, { direction: view.direction, padding: 1.16 });
    assert(Math.abs(camera.position.clone().sub(frame.target).normalize().dot(new THREE.Vector3(...view.direction)) - 1) < 1e-10);
    for (const x of [-0.4, 0.4]) for (const y of [-0.5, 0.5]) for (const z of [-0.2, 0.2]) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      assert(Math.abs(p.x) <= 1 / 1.16 + 1e-8 && Math.abs(p.y) <= 1 / 1.16 + 1e-8, 'Every bound corner is visible even for polar cameras');
      assert(p.z >= -1 && p.z <= 1, 'No near/far clipping');
    }
  }
}
const uid = 'a'.repeat(32), slug = 'greek/test';
const preview = { url: `https://models.atrium.earth/models/previews/${slug}/preview-${'b'.repeat(12)}.glb`, bytes: 100 };
const config = { catalog: [{ slug, title: 'Test', ingest_batch: 'etruscan-greek-20261015', source_url: `https://sketchfab.com/3d-models/${uid}` }], previews: { [slug]: preview }, orientations: { [slug]: { upAxis: 'y', yaw: 30 } } };
const request = { schema: 'atrium-vessel-scope-review/1', batch: 'etruscan-greek-20261015', works: [{ slug, sourceUid: uid, previewUrl: preview.url, previewBytes: preview.bytes, previewSha256: 'b'.repeat(64) }] };
assert.equal(bindRequest(request, config)[0].transform.yaw, 30);
assert.equal(transformFingerprint({ yaw: 30, upAxis: 'y' }), transformFingerprint({ upAxis: 'y', yaw: 30 }));
assert.notEqual(transformFingerprint({ yaw: 30, upAxis: 'y' }), transformFingerprint({ yaw: 31, upAxis: 'y' }));
const sourceArtifact = { repository: 'never-nude/atrium.earth', runId: 12345, artifactId: 67890, workflowHeadSha: 'e'.repeat(40), name: 'atrium-temporary-sources-etruscan-greek-20261015-12345-1' };
const withSource = { ...request, sourceArtifacts: [sourceArtifact], works: [{ ...request.works[0], source: { path: 'one/UID/source.glb', sha256: 'd'.repeat(64), bytes: 1000 } }] };
assert.equal(bindRequest(withSource, config)[0].source.bytes, 1000);
const milestoneBatch = 'beautiful-2000-20261015';
const milestoneRequest = { ...withSource, batch: milestoneBatch, sourceArtifacts: [{ ...sourceArtifact, name: `atrium-temporary-sources-${milestoneBatch}-12345-1` }] };
const milestoneConfig = { ...config, catalog: [{ ...config.catalog[0], ingest_batch: milestoneBatch }] };
assert.equal(bindRequest(milestoneRequest, milestoneConfig)[0].source.bytes, 1000);
assert.throws(() => bindRequest(milestoneRequest, config), /outside/);
assert.throws(() => bindRequest({ ...milestoneRequest, sourceArtifacts: [sourceArtifact] }, milestoneConfig), /binding/);
assert.throws(() => bindRequest({ ...request, batch: 'unreviewed-batch' }, config), /schema or batch/);
for (const patch of [{ repository: 'another/repo' }, { runId: 12346 }, { artifactId: null }, { workflowHeadSha: '' }]) {
  assert.throws(() => bindRequest({ ...withSource, sourceArtifacts: [{ ...sourceArtifact, ...patch }] }, config));
}
assert.throws(() => bindRequest({ ...withSource, sourceArtifacts: [] }, config), /supplied artifact/);
for (const patch of [{ sourceUid: 'c'.repeat(32) }, { previewBytes: 101 }, { previewSha256: undefined }, { previewUrl: preview.url.replace('models.atrium.earth', 'example.org') }, { source: { path: '../source.glb', sha256: 'd'.repeat(64), bytes: 12 } }]) {
  assert.throws(() => bindRequest({ ...request, works: [{ ...request.works[0], ...patch }] }, config));
}
assert.throws(() => bindRequest({ ...request, works: [request.works[0], request.works[0]] }, config), /duplicate/);
assert.throws(() => bindRequest(request, { ...config, catalog: [{ ...config.catalog[0], ingest_batch: 'another-batch' }] }), /outside/);

function glb(document, binary = Buffer.alloc(0)) {
  let j = Buffer.from(JSON.stringify(document)); j = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 0x20)]);
  const b = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const result = Buffer.alloc(12 + 8 + j.length + (b.length ? 8 + b.length : 0));
  result.write('glTF'); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(j.length, 12); result.writeUInt32LE(0x4e4f534a, 16); j.copy(result, 20);
  if (b.length) { result.writeUInt32LE(b.length, 20 + j.length); result.writeUInt32LE(0x004e4942, 24 + j.length); b.copy(result, 28 + j.length); }
  return result;
}
assert.throws(() => inspectGlb(glb({ asset: { version: '2.0' }, images: [{ uri: 'texture.jpg' }] })), /External/);
assert.throws(() => inspectGlb(Buffer.from('glTF')), /complete/);

function accessorOrderFixture(reverse = false) {
  const doc = new Document(), accessors = {};
  for (const name of (reverse ? ['normal', 'position'] : ['position', 'normal'])) {
    accessors[name] = doc.createAccessor(name).setType('VEC3').setArray(new Float32Array(name === 'position' ? [0, 0, 0, 1, 0, 0, 0, 1, 0] : [0, 0, 1, 0, 0, 1, 0, 0, 1]));
  }
  const primitive = doc.createPrimitive().setAttribute('POSITION', accessors.position).setAttribute('NORMAL', accessors.normal);
  const mesh = doc.createMesh().addPrimitive(primitive), node = doc.createNode().setMesh(mesh);
  doc.createScene().addChild(node);
  return { doc, accessors, node, primitive };
}
const ordered = accessorOrderFixture(), reordered = accessorOrderFixture(true);
assert.equal(documentGeometryFingerprint(ordered.doc), documentGeometryFingerprint(reordered.doc), 'Accessor registration reorder preserves full signature multiset and semantic bindings');
reordered.accessors.normal.getArray()[0] = 0.25;
assert.notEqual(documentGeometryFingerprint(ordered.doc), documentGeometryFingerprint(reordered.doc), 'Mutated accessor value is still rejected');
const rebound = accessorOrderFixture(true);
rebound.primitive.setAttribute('POSITION', rebound.accessors.normal).setAttribute('NORMAL', rebound.accessors.position);
assert.notEqual(documentGeometryFingerprint(ordered.doc), documentGeometryFingerprint(rebound.doc), 'Equal accessor multiset cannot conceal changed semantic bindings');
const duplicate = accessorOrderFixture();
duplicate.doc.createAccessor().setType('VEC3').setArray(duplicate.accessors.position.getArray().slice());
assert.notEqual(documentGeometryFingerprint(ordered.doc), documentGeometryFingerprint(duplicate.doc), 'Full accessor signature multiplicity is preserved');
const moved = accessorOrderFixture(); moved.node.setScale([0.9999999867535835, 1, 1]);
assert.notEqual(documentGeometryFingerprint(ordered.doc), documentGeometryFingerprint(moved.doc), 'Near-unit transform changes are rejected without a numerical tolerance');

// Tiny generated fixture only: six differently colored faces. No actual model
// is fetched, mirrored, copied, or mutated by this integration test.
const geometry = new THREE.BoxGeometry(1, 2, 0.6).toNonIndexed(); geometry.computeBoundingBox();
const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
const color = new Float32Array(position.count * 3), faceColors = [[0.9, 0.1, 0.1], [0.1, 0.9, 0.1], [0.1, 0.1, 0.9], [0.9, 0.9, 0.1], [0.9, 0.1, 0.9], [0.1, 0.9, 0.9]];
for (let i = 0; i < position.count; i++) color.set(faceColors[Math.floor(i / 6)], i * 3);
const arrays = [position.array, normal.array, color]; let offset = 0;
const bufferViews = arrays.map((a) => { const v = { buffer: 0, byteOffset: offset, byteLength: a.byteLength }; offset += a.byteLength; return v; });
const binary = Buffer.concat(arrays.map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength)));
const fixtureDocument = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], buffers: [{ byteLength: binary.length }], bufferViews, accessors: arrays.map((_a, i) => ({ bufferView: i, componentType: 5126, count: position.count, type: 'VEC3', ...(i === 0 ? { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() } : {}) })), meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.7, 0.8, 0.9, 1], metallicFactor: 0.2, roughnessFactor: 0.4 } }] };
const fixture = glb(fixtureDocument, binary);
assert.equal(inspectGlb(fixture).materials[0].pbrMetallicRoughness.metallicFactor, 0.2);
const legacy = structuredClone(fixtureDocument);
legacy.extensionsUsed = ['KHR_materials_pbrSpecularGlossiness'];
legacy.images = [{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6pAAAAABJRU5ErkJggg==' }];
legacy.textures = [{ source: 0 }];
legacy.materials = [{ extensions: { KHR_materials_pbrSpecularGlossiness: { diffuseFactor: [0.7, 0.8, 0.9, 1], specularFactor: [0.2, 0.2, 0.2], glossinessFactor: 0.6, diffuseTexture: { index: 0 } } } }];
// This raw matrix decomposes to near-unit scales that IO normally omits. The
// reference must preserve the exact raw transform, not loosen the comparison.
legacy.nodes[0].matrix = [0.10471285134553909, 0, -0.9945024847984314, 0, -0.9945024847984314, 0, -0.10471285134553909, 0, 0, 1, 0, 0, 0, 0, 0, 1];
const legacyBody = glb(legacy, binary);
const writerDropped = structuredClone(legacy); delete writerDropped.nodes[0].matrix;
const writerBody = glb(writerDropped, binary), restored = preserveReferenceNodeTransforms(legacyBody, writerBody);
const restoredJson = JSON.parse(restored.subarray(20, 20 + restored.readUInt32LE(12)).toString('utf8'));
assert.deepEqual(restoredJson.nodes[0].matrix, legacy.nodes[0].matrix, 'Exact raw near-unit matrix restored');
assert.deepEqual(restored.subarray(20 + restored.readUInt32LE(12)), writerBody.subarray(20 + writerBody.readUInt32LE(12)), 'All binary chunks retained byte-for-byte during transform JSON repack');
const changedGraph = structuredClone(writerDropped); changedGraph.nodes[0].mesh = 1;
assert.throws(() => preserveReferenceNodeTransforms(legacyBody, glb(changedGraph, binary)), /mapping changed/, 'Changed node/mesh graph cannot receive source transforms');
assert.deepEqual(inspectGlb(legacyBody).unsupportedAppearanceExtensions, ['KHR_materials_pbrSpecularGlossiness']);
const fixtureDir = mkdtempSync(join(tmpdir(), 'atrium-scope-material-fixture-'));
try {
  const input = join(fixtureDir, 'legacy.glb'), output = join(fixtureDir, 'reference.glb');
  writeFileSync(input, legacyBody);
  const reference = await createLegacyMaterialReference(input, output);
  assert.equal(reference.process.geometryFingerprintVerifiedBeforeAfterAndReread, true);
  assert.equal(reference.process.geometrySimplification, false);
  assert.equal(reference.process.textureCompression, false);
  assert.equal(reference.process.sourceRawNodeTransformsPreservedExactly, true);
  assert.deepEqual(reference.glb.unsupportedAppearanceExtensions, []);
  assert.deepEqual(reference.glb.materials[0].pbrMetallicRoughness.baseColorFactor, [0.7, 0.8, 0.9, 1]);
  assert.equal(reference.glb.materials[0].pbrMetallicRoughness.roughnessFactor, 0.4);
  assert.equal(reference.glb.images, 1);
  assert.equal(reference.glb.textures, 1);
  assert.equal(reference.glb.materials[0].pbrMetallicRoughness.baseColorTexture.index, 0);
  assert.deepEqual(readFileSync(input), legacyBody, 'Provider original fixture remains byte-identical');
} finally { rmSync(fixtureDir, { recursive: true, force: true }); }

if (process.env.SCOPE_BROWSER_TEST !== '1') {
  console.log('Scope renderer: camera direction/framing, input/source binding, production-adapter drift and GLB dependency tests passed. Set SCOPE_BROWSER_TEST=1 for the synthetic browser test.');
} else {
  const mime = (p) => extname(p) === '.wasm' ? 'application/wasm' : 'text/javascript';
  const server = createServer((req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    if (p === '/review.html') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    if (p === '/fixture.glb') { res.setHeader('Content-Type', 'model/gltf-binary'); res.end(fixture); return; }
    const rel = p === '/model-render-utils.js' ? 'public/model-render-utils.js' : p.replace(/^\//, '');
    if (!rel.startsWith('node_modules/three/') && rel !== 'public/model-render-utils.js' && !rel.startsWith('public/vendor/draco/')) { res.writeHead(404); res.end(); return; }
    const file = resolve(root, rel);
    if (!file.startsWith(root + sep)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime(file)); res.end(readFileSync(file));
  });
  await new Promise((yes) => server.listen(0, '127.0.0.1', yes));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), args: (process.env.CHROME_EXTRA_ARGS || '--enable-unsafe-swiftshader --use-angle=swiftshader').split(' ').filter(Boolean) });
  try {
    for (const native of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 1250 } }); const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/review.html?native=${native ? 1 : 0}`);
      await page.waitForFunction(() => window.__ready);
      await page.evaluate(async () => window.loadModel('/fixture.glb', { upAxis: 'y', yaw: 0, viewDirection: [0, 0, 1] }, JSON.stringify({ exposure: 0.7, baseColor: '#FF0000', tintStrength: 1, metalness: 1, roughness: 1, variation: 1 })));
      const state = await page.evaluate(() => window.__reviewSummary);
      assert.equal(state.after.meshCount, 1); assert.equal(state.after.faces, 12);
      const material = state.after.meshes[0].materials[0];
      assert.equal(material.metalness, 0.2); assert.equal(material.roughness, 0.4);
      assert.deepEqual(material.color, [0.7, 0.8, 0.9]);
      assert.deepEqual(state.before.meshes[0].colorRange, state.after.meshes[0].colorRange, 'Native source colors survive both review modes');
      const images = [];
      for (const view of cameraViews({ viewDirection: [0, 0, 1] })) {
        await page.evaluate((v) => window.reviewView(v), view);
        await page.evaluate(() => new Promise((yes) => requestAnimationFrame(() => requestAnimationFrame(yes))));
        images.push(createHash('sha256').update(await page.screenshot()).digest('hex'));
      }
      assert.equal(new Set(images).size, 4, 'Rendered front/reverse/above/underside are four distinct images');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Synthetic browser integration: four distinct views, no page errors, exact source COLOR_0/base/PBR preservation passed in production and native modes.');
  } finally { await browser.close(); server.closeAllConnections(); await new Promise((yes) => server.close(yes)); }
}
