import assert from 'node:assert/strict';
import * as THREE from 'three';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { makeQuickLookScene, startSpatialSession } from '../src/lib/spatial-session.mjs';
import { finishQuickLookAppearance } from '../src/lib/quick-look-appearance-export.mjs';
import { prepareQuickLookMaterial } from '../src/lib/spatial-appearance.mjs';

// Native export carries the per-work page exposure into its copied surfaces.
const source = new THREE.MeshStandardMaterial({ color: 0xddddcc, emissive: 0x444422, emissiveIntensity: 0.03, roughness: 0.82, metalness: 0 });
const originalColor = source.color.clone(), originalEmissive = source.emissive.clone();
const model = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), source);
const box = new THREE.Box3().setFromObject(model);
for (const exposure of [0.2, 0.74, 0.66, 1]) {
  const converted = makeQuickLookScene(THREE, model, box, { axis: 'y', meters: 2.42 }, { mode: 'surface' }, { exposure });
  const archive = unzipSync(await new USDZExporter().parseAsync(converted.scene));
  const text = strFromU8(archive['model.usda']);
  const values = name => text.match(new RegExp(`color3f inputs:${name} = \\(([^)]+)\\)`))[1].split(',').map(Number);
  for (const [j, channel] of ['r', 'g', 'b'].entries()) {
    assert.ok(Math.abs(values('diffuseColor')[j] - originalColor[channel] * exposure) < 1e-10);
    assert.ok(Math.abs(values('emissiveColor')[j] - originalEmissive[channel] * 0.03 * exposure) < 1e-10);
  }
  assert.match(text, /float inputs:roughness = 0.82/);
  assert.equal(converted.scene.children[0].scale.y, 2.42, 'Appearance never changes physical dimensions');
  converted.dispose();
  assert.ok(source.color.equals(originalColor)); assert.ok(source.emissive.equals(originalEmissive));
}
// STL-style procedural vertex tints must be bound to the actual USD surface,
// including the source material multiplier exactly once. Sharing a material
// with an uncolored mesh must not cause its shader to read a missing primvar.
{
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([0.3, 0.5, 0.2], i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({ color: '#6B4F31', vertexColors: true, roughness: 0.52, metalness: 0.58 });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(new THREE.BoxGeometry(), material));
  const converted = makeQuickLookScene(THREE, group, new THREE.Box3().setFromObject(group), { axis: 'y', meters: 1 }, { mode: 'surface' }, { exposure: 0.74 });
  const original = await new USDZExporter().parseAsync(converted.scene);
  const bytes = finishQuickLookAppearance(original, converted.scene);
  const archive = unzipSync(bytes), text = strFromU8(archive['model.usda']);
  assert.equal((text.match(/def Shader "AtriumVertexColor"/g) || []).length, 1);
  assert.match(text, /color3f inputs:diffuseColor.connect = <\/Materials\/Material_\d+\/AtriumVertexColor.outputs:result>/);
  assert.match(text, /string inputs:varname = "displayColor"/);
  assert.match(text, /float inputs:metallic = 0.58/);
  const surfaces = Object.entries(archive).filter(([name]) => name.startsWith('geometries/')).map(([, bytes]) => strFromU8(bytes));
  const colored = surfaces.find(text => text.includes('primvars:displayColor'));
  assert.ok(colored);
  const values = colored.match(/primvars:displayColor = \[\(([^)]+)\)/)[1].split(',').map(Number);
  for (const [i, channel] of ['r', 'g', 'b'].entries()) assert.ok(Math.abs(values[i] - colors[i] * material.color[channel] * 0.74) < 1e-6);
  assert.equal(surfaces.filter(text => text.includes('primvars:displayColor')).length, 1);
  assert.deepEqual(geometry.attributes.color.array, colors, 'Source vertex colors are unchanged');
  const before = unzipSync(original);
  for (const [name, data] of Object.entries(archive)) if (name !== 'model.usda') assert.deepEqual(data, before[name], 'Archive rewrite preserves geometry and texture payloads');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; view.getUint32(offset, true) === 0x04034b50;) {
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    assert.equal(start % 64, 0, 'USDZ payload is aligned');
    assert.equal(view.getUint16(offset + 8, true), 0, 'USDZ payload is uncompressed');
    offset = start + view.getUint32(offset + 18, true);
  }
  converted.dispose(); group.children.forEach(mesh => mesh.geometry.dispose()); material.dispose();
}
const maps = ['map', 'normalMap', 'aoMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap'];
for (const key of maps) source[key] = new THREE.Texture();
const mapped = prepareQuickLookMaterial(source, 0.66);
assert.ok(Math.abs(mapped.color.r - source.color.r * 0.66) < 1e-10);
for (const key of maps) assert.equal(mapped[key], source[key], `${key} and its colour-space/UV settings survive unchanged`);
assert.equal(mapped.emissiveIntensity, 1, 'Mapped emission is not multiplied twice by the exporter');
mapped.dispose();
for (const key of maps) source[key].dispose();
model.geometry.dispose(); source.dispose();

// WebXR already renders through the page renderer. Protect that invariant for
// both modes: do not also apply the Quick Look material compensation there.
for (const mode of ['immersive-ar', 'immersive-vr']) {
  class Session extends EventTarget {
    async end() { this.dispatchEvent(new Event('end')); }
    async requestReferenceSpace() { return {}; }
    async requestHitTestSource() { return { cancel() {} }; }
  }
  const scene = new THREE.Scene(); scene.environment = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ color: 0x778899 });
  const model = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const ground = new THREE.Object3D(), grid = new THREE.Object3D(); scene.add(model, ground, grid);
  const environment = scene.environment, color = material.color.clone();
  const renderer = { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.2,
    xr: { enabled: false, setReferenceSpaceType() {}, async setSession() {}, getReferenceSpace() { return {}; } },
    getClearColor: v => v.set(0), getClearAlpha: () => 0, setClearColor() {}, setAnimationLoop() {}, render() {} };
  const active = await startSpatialSession({ THREE, scene, model, ground, grid, box: new THREE.Box3().setFromObject(model), renderer, camera: new THREE.PerspectiveCamera(), suspend: () => () => {} }, Promise.resolve(new Session()), mode, null);
  assert.equal(renderer.toneMappingExposure, 0.2); assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(scene.environment, environment); assert.equal(model.material, material); assert.ok(material.color.equals(color));
  await active.end(); await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(renderer.toneMappingExposure, 0.2); assert.ok(material.color.equals(color));
  model.geometry.dispose(); material.dispose(); environment.dispose();
}
console.log('Spatial appearance checks passed: per-work native exposure and bound STL vertex colors, constant/mapped emission, source textures, unchanged dimensions and page materials, and per-work WebXR lighting retained.');
