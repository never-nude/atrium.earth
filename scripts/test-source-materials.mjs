import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { rememberSpatialAppearance } from '../src/lib/spatial-materials.mjs';

// Execute the production functions, including the thumbnail path, rather than
// reproducing the preservation logic in a test-only material implementation.
function productionFunctions(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const names = ['clamp01', 'noise01', 'hasAuthoredVertexColors', 'addMaterialVariation',
    'prepareMaterial', 'applyMapLift', 'hasSourceTexture', 'applyMaterialAppearance'];
  if (file.endsWith('.astro')) names.push('createWireframeMaterial');
  const declarations = names.map(name => {
    const match = new RegExp(`(^|\\n)([ \\t]*)function ${name}\\(`).exec(source);
    assert.ok(match, `${file}: ${name} exists`);
    const start = match.index + match[1].length;
    const next = new RegExp(`\\n${match[2]}(?:async )?function \\w+\\(`).exec(source.slice(start + 1));
    assert.ok(next, `${file}: ${name} boundary found`);
    return source.slice(start, start + 1 + next.index);
  }).join('\n');
  const code = transformSync(declarations, { loader: 'ts', target: 'es2022' }).code;
  const constants = source.match(/^\s*const WIREFRAME_COLOR = .*;$/m)?.[0] || '';
  const functions = new Function('THREE', 'rememberSpatialAppearance',
    `${constants}\n${code}\nreturn { ${names.join(', ')} };`)(THREE, rememberSpatialAppearance);
  const viewer = file.endsWith('.astro');
  assert.match(source, viewer ? /prepareMaterial\(THREE, m, appearance\)/ : /prepareMaterial\(material, appearance\)/);
  return {
    source, functions,
    prepare: (material, appearance) => viewer
      ? functions.prepareMaterial(THREE, material, appearance)
      : functions.prepareMaterial(material, appearance),
    apply: (mesh, material, appearance) => viewer
      ? functions.applyMaterialAppearance(THREE, mesh, material, appearance)
      : functions.applyMaterialAppearance(mesh, material, appearance),
  };
}

const appearance = {
  preserveSourceMaterials: true, baseColor: '#cc4411', secondaryColor: '#22aa77',
  tintStrength: 0.8, variation: 0.3, metalness: 0.8, roughness: 0.9,
  envMapIntensity: 0.2, emissiveIntensity: 1, mapLift: 0.4, mapFloor: 0.3,
  textureDefault: 34,
};
const state = material => JSON.stringify(material.toJSON());

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); });
  }
};
const fixture = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: '#885533' }));
const bytes = await new GLTFExporter().parseAsync(fixture, { binary: true });
const decoded = await new GLTFLoader().parseAsync(bytes, '');
const decodedUnlit = decoded.scene.children[0].material;
assert.ok(decodedUnlit.isMeshBasicMaterial, 'Real glTF unlit material decodes as Basic');

for (const file of ['../src/components/Viewer.astro', '../public/__render.html']) {
  const production = productionFunctions(file);
  const materials = [
    new THREE.MeshStandardMaterial({ color: '#34668a', roughness: 0.23, metalness: 0.41,
      emissive: '#110804', emissiveIntensity: 0.17 }),
    new THREE.MeshPhysicalMaterial({ color: '#889977', roughness: 0.33, metalness: 0.25,
      clearcoat: 0.7, clearcoatRoughness: 0.18, transmission: 0.3, ior: 1.37, thickness: 0.5 }),
    new THREE.MeshBasicMaterial({ color: '#538877', transparent: true, opacity: 0.48,
      alphaTest: 0.2, side: THREE.DoubleSide, toneMapped: false }),
    decodedUnlit.clone(),
  ];
  for (const material of materials) {
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, material);
    const before = state(material);
    assert.equal(production.prepare(material, appearance), material, `${file}: native material identity`);
    production.apply(mesh, material, appearance);
    assert.equal(state(material), before, `${file}: native shader/PBR/alpha retained`);
    assert.equal(mesh.geometry, geometry);
    assert.equal(geometry.getAttribute('color'), undefined, `${file}: no generated palette`);
    assert.equal(material.userData.atriumGeneratedAppearance, undefined);
    geometry.dispose();
  }

  const map = new THREE.Texture(), normalMap = new THREE.Texture(), alphaMap = new THREE.Texture();
  const geometry = new THREE.BoxGeometry();
  const colors = new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 4).fill(0.4), 4);
  geometry.setAttribute('color', colors);
  const authored = new THREE.MeshStandardMaterial({ map, normalMap, alphaMap, color: '#668899',
    vertexColors: true, roughness: 0.29, metalness: 0.21, transparent: true, opacity: 0.7 });
  const mesh = new THREE.Mesh(geometry, authored);
  const colorValues = colors.array.slice(), before = state(authored);
  production.apply(mesh, production.prepare(authored, appearance), appearance);
  assert.equal(state(authored), before, `${file}: authored maps/colors unchanged`);
  assert.equal(authored.map, map); assert.equal(authored.normalMap, normalMap); assert.equal(authored.alphaMap, alphaMap);
  assert.equal(geometry.getAttribute('color'), colors); assert.deepEqual(colors.array, colorValues);

  for (const flag of [undefined, false]) {
    const legacyAppearance = { ...appearance, preserveSourceMaterials: flag };
    const basic = new THREE.MeshBasicMaterial({ color: '#778899' });
    const converted = production.prepare(basic, legacyAppearance);
    assert.ok(converted.isMeshStandardMaterial, `${file}: legacy Basic conversion remains`);
    const legacyMesh = new THREE.Mesh(new THREE.BoxGeometry(), converted);
    production.apply(legacyMesh, converted, legacyAppearance);
    assert.equal(converted.roughness, appearance.roughness);
    assert.ok(legacyMesh.geometry.getAttribute('color'), `${file}: legacy palette remains`);
    legacyMesh.geometry.dispose(); basic.dispose(); converted.dispose();
  }

  if (file.endsWith('.astro')) {
    const createWire = material => production.functions.createWireframeMaterial(THREE, material);
    const wireframeMeshes = [
      { mesh, solidMaterial: authored, wireframeMaterial: createWire(authored) },
      { mesh: new THREE.Mesh(geometry, materials), solidMaterial: materials, wireframeMaterial: materials.map(createWire) },
    ];
    const setter = production.source.match(/^\s*setWireframe: (.*),$/m)?.[1];
    assert.ok(setter, 'Production wireframe setter found');
    const setWireframe = new Function('wireframeMeshes', `let wireframe = false; return ${setter};`)(wireframeMeshes);
    setWireframe(true);
    for (const item of wireframeMeshes) assert.equal(item.mesh.material, item.wireframeMaterial);
    setWireframe(false);
    for (const item of wireframeMeshes) assert.equal(item.mesh.material, item.solidMaterial);
    assert.equal(state(authored), before, 'Wireframe toggle restores exact original authored material');

    const textureCode = transformSync(readFileSync(new URL('../src/lib/viewerTexture.ts', import.meta.url), 'utf8')
      .replace('export function', 'function'), { loader: 'ts', target: 'es2022' }).code;
    const createTextureControl = new Function(`${textureCode}\nreturn createTextureControl;`)();
    const setTextureCode = production.source.match(/^\s*setTexture: (.*),$/m)?.[1];
    const textureDefaultCode = production.source.match(/defaults: \{ exposure:.*?, texture: (.*?), autoRotate:/)?.[1];
    assert.ok(setTextureCode && textureDefaultCode, 'Actual production texture setter and default found');
    const nativeMaterials = [materials[0], materials[1], materials[2]];
    const textureControl = createTextureControl(nativeMaterials);
    const setters = new Function('materials', 'appearance', 'textureControl',
      `return { set: ${setTextureCode}, initial: ${textureDefaultCode} };`)(nativeMaterials, appearance, textureControl);
    const originals = nativeMaterials.map(material => material.roughness);
    setters.set(setters.initial); // Legacy HUD initializes by calling this setter.
    assert.deepEqual(nativeMaterials.map(material => material.roughness), originals, 'HUD initialization preserves exact native roughness');
    setters.set(85);
    assert.notEqual(nativeMaterials[0].roughness, originals[0], 'Explicit visitor adjustment still works');
    assert.equal(nativeMaterials[2].roughness, undefined, 'Unlit materials get no invented roughness');
    setters.set(setters.initial);
    assert.deepEqual(nativeMaterials.map(material => material.roughness), originals, 'Returning slider to original restores every material exactly');
    const legacySurface = new THREE.MeshStandardMaterial({ roughness: 0.2 });
    const legacy = new Function('materials', 'appearance', 'textureControl',
      `return { set: ${setTextureCode}, initial: ${textureDefaultCode} };`)([legacySurface],
      { ...appearance, preserveSourceMaterials: false }, createTextureControl([legacySurface]));
    assert.equal(legacy.initial, appearance.textureDefault, 'Legacy HUD uses the existing appearance default');
    legacy.set(legacy.initial);
    assert.equal(legacySurface.roughness, 1 - appearance.textureDefault / 100, 'Legacy HUD treatment remains unchanged');
    legacySurface.dispose();
    for (const item of wireframeMeshes) for (const wire of [item.wireframeMaterial].flat()) wire.dispose();
  }
  geometry.dispose(); authored.dispose(); map.dispose(); normalMap.dispose(); alphaMap.dispose();
  for (const material of materials) material.dispose();
  console.log(`${file}: native shaders, PBR, authored maps/colors and legacy behavior pass.`);
}
fixture.geometry.dispose(); fixture.material.dispose(); decoded.scene.children[0].geometry.dispose(); decodedUnlit.dispose();
console.log('Viewer wireframe restoration and HUD native-material initialization pass.');
