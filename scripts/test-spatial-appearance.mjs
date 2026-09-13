import assert from 'node:assert/strict';
import * as THREE from 'three';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { makeQuickLookScene, startSpatialSession } from '../src/lib/spatial-session.mjs';
import { prepareQuickLookMaterial } from '../src/lib/spatial-appearance.mjs';

// Laocoön's page uses 0.2 exposure. Inspect serialized material numbers, not
// just the in-memory conversion: constant emission used to lose its intensity.
const source = new THREE.MeshStandardMaterial({ color: 0xddddcc, emissive: 0x444422, emissiveIntensity: 0.03, roughness: 0.82, metalness: 0 });
const originalColor = source.color.clone(), originalEmissive = source.emissive.clone();
const model = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), source);
const box = new THREE.Box3().setFromObject(model);
for (const exposure of [0.12, 0.2, 0.44, 0.74, 1, 1.25]) {
  const converted = makeQuickLookScene(THREE, model, box, { axis: 'y', meters: 2.42 }, { mode: 'surface' }, { exposure });
  const archive = unzipSync(await new USDZExporter().parseAsync(converted.scene));
  const text = strFromU8(archive['model.usda']);
  const values = name => text.match(new RegExp(`color3f inputs:${name} = \\(([^)]+)\\)`))[1].split(',').map(Number);
  for (const [j, channel] of ['r', 'g', 'b'].entries()) {
    assert.ok(Math.abs(values('diffuseColor')[j] - originalColor[channel] * exposure) < 1e-10);
    assert.ok(Math.abs(values('emissiveColor')[j] - originalEmissive[channel] * 0.03 * exposure) < 1e-10);
  }
  assert.match(text, /float inputs:roughness = 0.82/);
  assert.equal(converted.scene.children[0].scale.y, 2.42, 'Exposure never changes physical dimensions');
  converted.dispose();
  assert.ok(source.color.equals(originalColor)); assert.ok(source.emissive.equals(originalEmissive));
}
const maps = ['map', 'normalMap', 'aoMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap'];
for (const key of maps) source[key] = new THREE.Texture();
const mapped = prepareQuickLookMaterial(source, 0.2);
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
console.log('Exposure checks passed: serialized linear colour, constant/mapped emission, source textures, unchanged dimensions and page materials, and WebXR exposure retained without double compensation.');
