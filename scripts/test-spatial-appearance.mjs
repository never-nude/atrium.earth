import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { makeQuickLookScene, startSpatialSession } from '../src/lib/spatial-session.mjs';
import { finishQuickLookAppearance } from '../src/lib/quick-look-appearance-export.mjs';
import { rememberSpatialAppearance, spatialPaletteColor } from '../src/lib/spatial-materials.mjs';
import { prepareQuickLookMaterial } from '../src/lib/spatial-appearance.mjs';

// Page exposure must have no effect on native AR, even if passed by an old caller.
const source = new THREE.MeshStandardMaterial({ color: 0xddddcc, emissive: 0x444422, emissiveIntensity: 0.03, roughness: 0.82, metalness: 0 });
const originalColor = source.color.clone(), originalEmissive = source.emissive.clone();
const model = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), source);
const box = new THREE.Box3().setFromObject(model);
for (const exposure of [0.2, 0.74, 0.66, 1]) {
  const converted = makeQuickLookScene(THREE, model, box, { axis: 'y', meters: 2.42 }, { mode: 'surface' }, { exposure });
  const archive = unzipSync(finishQuickLookAppearance(await new USDZExporter().parseAsync(converted.scene), converted.scene));
  const text = strFromU8(archive['model.usda']);
  assert.match(text, /int preferredIblVersion = 2/);
  const values = name => text.match(new RegExp(`color3f inputs:${name} = \\(([^)]+)\\)`))[1].split(',').map(Number);
  for (const [j, channel] of ['r', 'g', 'b'].entries()) {
    assert.ok(Math.abs(values('diffuseColor')[j] - originalColor[channel]) < 1e-10);
    assert.ok(Math.abs(values('emissiveColor')[j] - originalEmissive[channel] * 0.03) < 1e-10);
  }
  assert.match(text, /float inputs:roughness = 0.82/);
  assert.equal(converted.scene.children[0].scale.y, 2.42, 'Appearance never changes physical dimensions');
  converted.dispose();
  assert.ok(source.color.equals(originalColor)); assert.ok(source.emissive.equals(originalEmissive));
}
// Authored (not Atrium-generated) vertex tints retain their original USD graph,
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
  for (const [i, channel] of ['r', 'g', 'b'].entries()) assert.ok(Math.abs(values[i] - colors[i] * material.color[channel]) < 1e-6);
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
// Generated palettes must survive serialization and reimport as standard USD
// materials, without depending on a custom vertex-color reader. Exercise every
// catalogue profile, with and without the optional procedural vertex attribute.
const profiles = JSON.parse(readFileSync(new URL('../src/data/material-appearances.json', import.meta.url))).profiles;
for (const appearance of Object.values(profiles)) for (const vertexColors of [true, false]) {
  const color = new THREE.Color(appearance.baseColor);
  const geometry = new THREE.BoxGeometry();
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for(let i=0;i<colors.length;i+=3)colors.set(color.toArray(),i);
  if (vertexColors) geometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(),3));
  const material = new THREE.MeshStandardMaterial({color:0x333333,vertexColors});
  rememberSpatialAppearance(material,appearance);
  const mesh = new THREE.Mesh(geometry,material);
  const converted = makeQuickLookScene(THREE,mesh,new THREE.Box3().setFromObject(mesh),null,{mode:'surface'});
  const exported = converted.scene.children[0].children[0];
  const expected = spatialPaletteColor(THREE,appearance);
  assert.ok(exported.material.color.equals(expected), 'Native palette is present in the material itself');
  assert.equal(exported.material.vertexColors, false);
  assert.equal(exported.geometry.hasAttribute('color'), false, 'No competing native vertex palette');
  const bytes = finishQuickLookAppearance(await new USDZExporter().parseAsync(converted.scene), converted.scene);
  const archive = unzipSync(bytes), usd = strFromU8(archive['model.usda']);
  assert.doesNotMatch(usd, /AtriumVertexColor|UsdPrimvarReader_float3/);
  assert.match(usd, new RegExp(`rel material:binding = </Materials/Material_${exported.material.id}>`));
  const restored = new USDLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  let restoredMesh;
  restored.traverse(object => { if (object.isMesh) restoredMesh = object; });
  assert.ok(restoredMesh, 'Serialized native model can be reimported');
  for (const channel of ['r', 'g', 'b']) assert.ok(Math.abs(restoredMesh.material.color[channel] - expected[channel]) < 1e-6, `${appearance.key}: native ${channel} survives round trip`);
  assert.equal(restoredMesh.material.metalness, appearance.metalness);
  assert.equal(restoredMesh.material.roughness, Math.max(.48, Math.min(.85, appearance.roughness)));
  assert.ok(material.color.equals(new THREE.Color(0x333333)), 'Page material stays unchanged');
  if (vertexColors) assert.deepEqual(geometry.attributes.color.array,colors,'Source geometry stays unchanged');
  restored.traverse(object => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
  converted.dispose();geometry.dispose();material.dispose();
}
const maps = ['map', 'normalMap', 'aoMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap'];
for (const key of maps) source[key] = new THREE.Texture();
const mapped = prepareQuickLookMaterial(source, 0.66);
assert.ok(Math.abs(mapped.color.r - source.color.r) < 1e-10);
for (const key of maps) assert.equal(mapped[key], source[key], `${key} and its colour-space/UV settings survive unchanged`);
assert.equal(mapped.emissiveIntensity, 1, 'Mapped emission is not multiplied twice by the exporter');
mapped.dispose();
for (const key of maps) source[key].dispose();
model.geometry.dispose(); source.dispose();

// WebXR uses its own bounded lighting/exposure while active and restores the
// exact page materials and renderer settings on exit.
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
  const originalGeometry = model.geometry;
  const light = new THREE.DirectionalLight(0xffffff, 3); scene.add(light);
  const hiddenLight = new THREE.HemisphereLight(); hiddenLight.visible = false; scene.add(hiddenLight);
  const renderer = { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.2,
    xr: { enabled: false, setReferenceSpaceType() {}, async setSession() {}, getReferenceSpace() { return {}; } },
    getClearColor: v => v.set(0), getClearAlpha: () => 0, setClearColor() {}, setAnimationLoop() {}, render() {} };
  const active = await startSpatialSession({ THREE, scene, model, ground, grid, box: new THREE.Box3().setFromObject(model), renderer, camera: new THREE.PerspectiveCamera(), suspend: () => () => {} }, Promise.resolve(new Session()), mode, null);
  assert.equal(renderer.toneMappingExposure, 0.72); assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(scene.environment, environment); assert.notEqual(model.material, material); assert.ok(material.color.equals(color));
  assert.equal(scene.environmentIntensity, 0.35);
  assert.equal(light.visible, false);
  await active.end(); await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(renderer.toneMappingExposure, 0.2); assert.ok(material.color.equals(color));
  assert.equal(model.material, material); assert.equal(scene.environmentIntensity, 1);
  assert.equal(model.geometry, originalGeometry); assert.equal(light.visible, true); assert.equal(hiddenLight.visible, false);
  assert.equal(scene.getObjectByName("Atrium spatial lighting"), undefined);
  model.geometry.dispose(); material.dispose(); environment.dispose();
}
console.log('Spatial appearance checks passed: native palette serialization/reimport for every generated profile, preserved authored colors/textures and emission, unchanged dimensions/page materials, and independent WebXR lighting with exact restoration.');
