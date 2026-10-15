import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { makeQuickLookScene } from '../src/lib/spatial-session.mjs';
import { rememberSpatialAppearance, prepareSpatialSurface } from '../src/lib/spatial-materials.mjs';

// The production native export helper works on isolated geometry copies.
// Inspect serialized archives too: GLTFExporter exports attributes regardless
// of material.vertexColors, so checking only the material flag is insufficient.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); });
  }
};
async function assertNativeColorExport(mesh, expectedColor, label) {
  const originalGeometry = mesh.geometry, originalColors = mesh.geometry.getAttribute('color');
  const originalValues = originalColors.array.slice();
  const converted = makeQuickLookScene(THREE, mesh, new THREE.Box3().setFromObject(mesh), null, { mode: 'surface' });
  try {
    const glb = await new GLTFExporter().parseAsync(converted.scene, { binary: true });
    const view = new DataView(glb);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, view.getUint32(12, true))));
    const primitives = json.meshes.flatMap(mesh => mesh.primitives);
    assert.ok(primitives.length);
    assert.ok(primitives.every(primitive => ('COLOR_0' in primitive.attributes) === expectedColor), `${label}: serialized GLB color matches explicit decision`);
    const archive = unzipSync(await new USDZExporter().parseAsync(converted.scene));
    const surfaces = Object.entries(archive).filter(([name]) => name.startsWith('geometries/')).map(([, bytes]) => strFromU8(bytes));
    assert.ok(surfaces.length);
    assert.ok(surfaces.every(text => text.includes('primvars:displayColor') === expectedColor), `${label}: serialized USDZ color matches explicit decision`);
    assert.equal(mesh.geometry, originalGeometry, `${label}: live geometry unchanged by export`);
    assert.equal(mesh.geometry.getAttribute('color'), originalColors);
    assert.deepEqual(originalColors.array, originalValues, `${label}: live source colors unchanged by export`);
  } finally { converted.dispose(); }
}

// Execute the actual page and thumbnail material functions, including the
// TypeScript viewer version, so either rendering path can regress independently.
function renderingFunctions(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const names = ['clamp01', 'noise01', 'hasAuthoredVertexColors', 'addMaterialVariation',
    'prepareMaterial', 'applyMapLift', 'hasSourceTexture', 'applyMaterialAppearance'];
  const declarations = names.map(name => {
    const match = new RegExp(`(^|\\n)([ \\t]*)function ${name}\\(`).exec(source);
    assert.ok(match, `${file}: actual ${name} function exists`);
    const start = match.index + match[1].length;
    const next = new RegExp(`\\n${match[2]}(?:async )?function \\w+\\(`).exec(source.slice(start + 1));
    assert.ok(next, `${file}: ${name} has an identifiable function boundary`);
    return source.slice(start, start + 1 + next.index);
  }).join('\n');
  const code = transformSync(declarations, { loader: 'ts', target: 'es2022' }).code;
  const functions = new Function('THREE', 'rememberSpatialAppearance',
    `${code}\nreturn { ${names.join(', ')} };`)(THREE, rememberSpatialAppearance);
  const viewer = file.endsWith('.astro');
  assert.match(source, viewer
    ? /prepareMaterial\(THREE, m, appearance\)/
    : /prepareMaterial\(material, appearance\)/, `${file}: production caller forwards the per-work appearance`);
  return {
    apply: (mesh, material, appearance) => viewer
      ? functions.applyMaterialAppearance(THREE, mesh, material, appearance)
      : functions.applyMaterialAppearance(mesh, material, appearance),
    variation: (mesh, material, appearance) => viewer
      ? functions.addMaterialVariation(THREE, mesh, material, appearance)
      : functions.addMaterialVariation(mesh, material, appearance),
    prepare: (source, appearance) => viewer ? functions.prepareMaterial(THREE, source, appearance) : functions.prepareMaterial(source, appearance),
  };
}

const appearance = {
  baseColor: '#bb8833', secondaryColor: '#227744', variation: 0.3,
  tintStrength: 0.8, metalness: 0.7, roughness: 0.9, envMapIntensity: 0.4,
  emissiveIntensity: 0.1, mapLift: 0.2, mapFloor: 0.1,
};
const materialState = material => ({
  color: material.color.toArray(), emissive: material.emissive.toArray(),
  emissiveIntensity: material.emissiveIntensity, metalness: material.metalness,
  roughness: material.roughness, envMapIntensity: material.envMapIntensity,
  opacity: material.opacity, vertexColors: material.vertexColors,
  map: material.map, userData: structuredClone(material.userData),
});

for (const file of ['../src/components/Viewer.astro', '../public/__render.html']) {
  const functions = renderingFunctions(file);
  const geometry = new THREE.BoxGeometry();
  const values = new Float32Array(geometry.attributes.position.count * 4);
  for (let i = 0; i < values.length; i += 4) values.set([0.1, 0.4, 0.8, 0.75], i);
  const sourceColors = new THREE.BufferAttribute(values, 4);
  geometry.setAttribute('color', sourceColors);
  const material = new THREE.MeshStandardMaterial({
    color: '#335577', emissive: '#112233', emissiveIntensity: 0.2,
    metalness: 0.42, roughness: 0.63, envMapIntensity: 0.8,
    opacity: 0.7, vertexColors: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const before = materialState(material);
  assert.equal(functions.prepare(material), material, `${file}: standard material retained`);
  functions.apply(mesh, material, appearance);
  functions.variation(mesh, material, appearance); // Guard also protects direct callers.
  assert.equal(mesh.geometry, geometry, `${file}: authored geometry retained`);
  assert.equal(geometry.attributes.color, sourceColors, `${file}: COLOR_0 attribute retained`);
  assert.deepEqual(sourceColors.array, values, `${file}: source RGBA values retained`);
  assert.equal(sourceColors.itemSize, 4, `${file}: source alpha retained`);
  assert.deepEqual(materialState(material), before, `${file}: authored multiplier and PBR retained`);
  assert.equal(geometry.userData.atriumPaletteBase, undefined, `${file}: source not marked generated`);

  // Uniform black is still authored by default. Only an explicit, documented
  // per-work decision can disable its shader multiplication; no color heuristic.
  const blackGeometry = new THREE.BoxGeometry();
  const blackValues = new Float32Array(blackGeometry.attributes.position.count * 4);
  for (let i = 3; i < blackValues.length; i += 4) blackValues[i] = 1;
  const blackColors = new THREE.BufferAttribute(blackValues, 4);
  blackGeometry.setAttribute('color', blackColors);
  const blackMaterial = new THREE.MeshStandardMaterial({ color: '#fefdfd', vertexColors: true, roughness: 0.6 });
  const blackMesh = new THREE.Mesh(blackGeometry, blackMaterial);
  const blackBefore = materialState(blackMaterial);
  functions.apply(blackMesh, blackMaterial, appearance);
  assert.deepEqual(materialState(blackMaterial), blackBefore, `${file}: uniform authored black remains enabled by default`);
  await assertNativeColorExport(blackMesh, true, `${file}: ordinary authored black`);
  functions.apply(blackMesh, blackMaterial, { ...appearance, sourceVertexColors: 'ignore-invalid' });
  functions.variation(blackMesh, blackMaterial, appearance);
  assert.deepEqual(materialState(blackMaterial), { ...blackBefore, vertexColors: false }, `${file}: explicit exception changes only shader multiplication`);
  assert.equal(blackMesh.geometry, blackGeometry);
  assert.equal(blackGeometry.attributes.color, blackColors);
  assert.deepEqual(blackColors.array, blackValues);
  assert.equal(blackGeometry.userData.atriumPaletteBase, undefined, `${file}: exception never generates a palette`);
  await assertNativeColorExport(blackMesh, false, `${file}: explicit neutral exception`);

  const basic = new THREE.MeshBasicMaterial({ color: '#887766', vertexColors: true });
  const prepared = functions.prepare(basic);
  assert.equal(prepared.vertexColors, true, `${file}: nonstandard conversion keeps vertex colors`);
  assert.ok(prepared.color.equals(basic.color), `${file}: conversion keeps the source multiplier`);
  const convertedMesh = new THREE.Mesh(geometry, prepared);
  const convertedState = materialState(prepared);
  functions.apply(convertedMesh, prepared, appearance);
  assert.deepEqual(materialState(prepared), convertedState, `${file}: converted source stays authored`);

  // GLTFLoader represents authored KHR_materials_unlit as MeshBasicMaterial.
  // This explicit per-work flag preserves that shader and every authored map;
  // an absent/false flag must retain the existing Standard conversion.
  const unlitMap = new THREE.Texture(), unlitAlpha = new THREE.Texture(), unlitAo = new THREE.Texture();
  const unlit = new THREE.MeshBasicMaterial({
    name: 'authored-unlit-pottery', map: unlitMap, alphaMap: unlitAlpha, aoMap: unlitAo,
    color: '#885533', opacity: 0.73, transparent: true, alphaTest: 0.19,
    side: THREE.DoubleSide, vertexColors: true, toneMapped: false,
  });
  unlit.onBeforeCompile = () => {};
  unlit.customProgramCacheKey = () => 'authored-unlit-fixture';
  const unlitState = source => ({
    type: source.type, color: source.color.toArray(), map: source.map,
    alphaMap: source.alphaMap, aoMap: source.aoMap, opacity: source.opacity,
    transparent: source.transparent, alphaTest: source.alphaTest, side: source.side,
    vertexColors: source.vertexColors, toneMapped: source.toneMapped,
    onBeforeCompile: source.onBeforeCompile, customProgramCacheKey: source.customProgramCacheKey,
    userData: structuredClone(source.userData),
  });
  const originalUnlitState = unlitState(unlit);
  const fixtureMaterial = new THREE.MeshBasicMaterial({ color: '#885533' });
  const fixtureMesh = new THREE.Mesh(new THREE.BoxGeometry(), fixtureMaterial);
  const fixtureBytes = await new GLTFExporter().parseAsync(fixtureMesh, { binary: true });
  const fixtureView = new DataView(fixtureBytes);
  const fixtureJson = JSON.parse(new TextDecoder().decode(new Uint8Array(fixtureBytes, 20, fixtureView.getUint32(12, true))));
  assert.ok(fixtureJson.extensionsUsed.includes('KHR_materials_unlit'), `${file}: fixture really carries the source unlit extension`);
  const loadedFixture = await new GLTFLoader().parseAsync(fixtureBytes, '');
  const decodedUnlit = loadedFixture.scene.children[0].material;
  assert.ok(decodedUnlit.isMeshBasicMaterial, `${file}: actual GLTFLoader decodes authored unlit shader`);
  assert.equal(functions.prepare(decodedUnlit, { preserveSourceUnlit: true }), decodedUnlit, `${file}: real decoded unlit fixture retained`);
  fixtureMesh.geometry.dispose(); fixtureMaterial.dispose();
  loadedFixture.scene.children[0].geometry.dispose(); decodedUnlit.dispose();
  const keptUnlit = functions.prepare(unlit, { ...appearance, preserveSourceUnlit: true });
  assert.equal(keptUnlit, unlit, `${file}: explicit unlit flag retains actual source material`);
  const unlitMesh = new THREE.Mesh(new THREE.BoxGeometry(), keptUnlit);
  functions.apply(unlitMesh, keptUnlit, { ...appearance, preserveSourceUnlit: true });
  assert.deepEqual(unlitState(keptUnlit), originalUnlitState, `${file}: authored unlit shader/maps/material state unchanged`);
  assert.equal(unlitMesh.geometry.getAttribute('color'), undefined, `${file}: textured unlit source gets no generated palette`);
  for (const override of [undefined, {}, { preserveSourceUnlit: false }]) {
    const baseline = functions.prepare(unlit, override);
    assert.ok(baseline.isMeshStandardMaterial, `${file}: unflagged Basic-to-Standard behavior unchanged`);
    assert.equal(baseline.map, unlitMap);
    assert.equal(baseline.alphaMap, unlitAlpha);
    assert.equal(baseline.aoMap, unlitAo);
    assert.ok(baseline.color.equals(unlit.color));
    baseline.dispose();
  }
  assert.equal(functions.prepare(material, { preserveSourceUnlit: true }), material, `${file}: Standard material unaffected by unlit flag`);
  const spatialUnlit = prepareSpatialSurface(THREE, unlit, unlitMesh.geometry).material;
  assert.ok(spatialUnlit.isMeshBasicMaterial, `${file}: spatial clone retains authored unlit shader`);
  assert.equal(spatialUnlit.map, unlitMap);
  assert.equal(spatialUnlit.alphaMap, unlitAlpha);
  assert.equal(spatialUnlit.aoMap, unlitAo);
  assert.ok(spatialUnlit.color.equals(unlit.color));
  assert.throws(() => makeQuickLookScene(THREE, unlitMesh, new THREE.Box3().setFromObject(unlitMesh), null, { mode: 'surface' }), /cannot be exported to AR/, `${file}: unsupported native AR remains held without material conversion`);
  assert.deepEqual(unlitState(unlit), originalUnlitState, `${file}: spatial/export paths leave live unlit source intact`);
  spatialUnlit.dispose(); unlitMesh.geometry.dispose(); unlit.dispose();
  unlitMap.dispose(); unlitAlpha.dispose(); unlitAo.dispose();

  const texture = new THREE.Texture();
  const texturedMaterial = new THREE.MeshStandardMaterial({ map: texture, color: '#775533', roughness: 0.27, metalness: 0.19 });
  const texturedMesh = new THREE.Mesh(new THREE.BoxGeometry(), texturedMaterial);
  const texturedBefore = materialState(texturedMaterial);
  functions.apply(texturedMesh, texturedMaterial, appearance);
  assert.deepEqual(materialState(texturedMaterial), texturedBefore, `${file}: texture/PBR retained`);
  assert.equal(texturedMesh.geometry.attributes.color, undefined, `${file}: no palette added to texture`);

  const legacyMaterial = new THREE.MeshStandardMaterial({ color: '#777777' });
  const legacyMesh = new THREE.Mesh(new THREE.BoxGeometry(), legacyMaterial);
  const legacyBefore = legacyMaterial.color.clone();
  functions.apply(legacyMesh, legacyMaterial, appearance);
  assert.ok(legacyMesh.geometry.attributes.color, `${file}: uncolored legacy palette still generated`);
  assert.equal(legacyMesh.geometry.userData.atriumPaletteBase, appearance.baseColor);
  assert.equal(legacyMaterial.vertexColors, true);
  assert.equal(legacyMaterial.roughness, appearance.roughness);
  assert.ok(!legacyMaterial.color.equals(legacyBefore));
  const firstPalette = legacyMesh.geometry.attributes.color;
  functions.variation(legacyMesh, legacyMaterial, { ...appearance, baseColor: '#eeffee' });
  assert.notEqual(legacyMesh.geometry.attributes.color, firstPalette, `${file}: generated palette remains adjustable`);
  assert.equal(legacyMesh.geometry.userData.atriumPaletteBase, '#eeffee');

  for (const item of [mesh, blackMesh, convertedMesh, texturedMesh, legacyMesh]) item.geometry.dispose();
  for (const item of [material, blackMaterial, basic, prepared, texturedMaterial, legacyMaterial]) item.dispose();
  texture.dispose();
  console.log(`${file}: actual functions preserve authored vertex colors, alpha, multiplier/PBR and textures; uncolored legacy treatment and conversion pass.`);
}
