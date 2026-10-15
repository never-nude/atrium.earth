import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { rememberSpatialAppearance } from '../src/lib/spatial-materials.mjs';

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
  return {
    apply: (mesh, material, appearance) => viewer
      ? functions.applyMaterialAppearance(THREE, mesh, material, appearance)
      : functions.applyMaterialAppearance(mesh, material, appearance),
    variation: (mesh, material, appearance) => viewer
      ? functions.addMaterialVariation(THREE, mesh, material, appearance)
      : functions.addMaterialVariation(mesh, material, appearance),
    prepare: source => viewer ? functions.prepareMaterial(THREE, source) : functions.prepareMaterial(source),
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

  const basic = new THREE.MeshBasicMaterial({ color: '#887766', vertexColors: true });
  const prepared = functions.prepare(basic);
  assert.equal(prepared.vertexColors, true, `${file}: nonstandard conversion keeps vertex colors`);
  assert.ok(prepared.color.equals(basic.color), `${file}: conversion keeps the source multiplier`);
  const convertedMesh = new THREE.Mesh(geometry, prepared);
  const convertedState = materialState(prepared);
  functions.apply(convertedMesh, prepared, appearance);
  assert.deepEqual(materialState(prepared), convertedState, `${file}: converted source stays authored`);

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

  for (const item of [mesh, convertedMesh, texturedMesh, legacyMesh]) item.geometry.dispose();
  for (const item of [material, basic, prepared, texturedMaterial, legacyMaterial]) item.dispose();
  texture.dispose();
  console.log(`${file}: actual functions preserve authored vertex colors, alpha, multiplier/PBR and textures; uncolored legacy treatment and conversion pass.`);
}
