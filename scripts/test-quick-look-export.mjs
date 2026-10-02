import assert from 'node:assert/strict';
import * as THREE from 'three';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { makeQuickLookScene } from '../src/lib/spatial-session.mjs';
import { displayReferenceFor, viewingReferenceFor } from '../src/lib/spatial-access.mjs';
import { readFileSync } from 'node:fs';

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} != ${expected}`);
const numbers = (text) => Array.from(text.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g), (match) => Number(match[0]));

// Inspect the exported archive, rather than the Three scene. USDZExporter omits
// the passed root's transform, so a correct in-memory Box3 is insufficient.
function primBody(text, name) {
  const start = text.indexOf(`def Xform "${name}"`);
  assert.ok(start >= 0, `Export contains ${name}`);
  const opening = text.indexOf('{', start);
  let depth = 1, end = opening + 1;
  for (; end < text.length && depth; end++) {
    if (text[end] === '{') depth++;
    if (text[end] === '}') depth--;
  }
  assert.equal(depth, 0, `${name} has a complete exported body`);
  // Include reference metadata preceding the body for mesh geometry lookup.
  return text.slice(start, end);
}

function transformFor(text, name) {
  const body = primBody(text, name);
  const declaration = body.match(/matrix4d xformOp:transform = ([^\n]+)/);
  assert.ok(declaration, `${name} carries an exported transform`);
  assert.ok(body.indexOf('matrix4d') < (body.indexOf('def Xform', 1) < 0 ? Infinity : body.indexOf('def Xform', 1)), `${name} owns its transform`);
  const matrix = numbers(declaration[1]);
  assert.equal(matrix.length, 16);
  return new THREE.Matrix4().fromArray(matrix);
}

function exportedBounds(archive, text, meshName, parentMatrix) {
  const body = primBody(text, meshName);
  const reference = body.match(/prepend references = @\.\/(geometries\/[^@]+)@/);
  assert.ok(reference, `${meshName} references geometry in the archive`);
  assert.ok(archive[reference[1]], 'Referenced geometry exists');
  const geometry = strFromU8(archive[reference[1]]);
  const points = geometry.match(/point3f\[\] points = \[([^\]]+)\]/);
  assert.ok(points, 'Exported geometry contains positions');
  const xyz = numbers(points[1]);
  assert.equal(xyz.length % 3, 0);
  const matrix = parentMatrix.clone().multiply(transformFor(text, meshName));
  const bounds = new THREE.Box3();
  for (let i = 0; i < xyz.length; i += 3) bounds.expandByPoint(new THREE.Vector3(...xyz.slice(i, i + 3)).applyMatrix4(matrix));
  return bounds;
}

const model = new THREE.Group();
const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.2), new THREE.MeshStandardMaterial());
mesh.name = 'CalibrationPiece';
model.add(mesh);
const box = new THREE.Box3().setFromObject(model, true);
const reference = { axis: 'y', meters: 0.09 };
const originalPositions = mesh.geometry.attributes.position.array.slice();

for (const [mode, height] of [['surface', 1], ['auto', 1], ['plinth', 1], ['plinth', 0.65]]) {
  const hasSupport = mode === 'plinth';
  const supportTop = hasSupport ? height : 0;
  const converted = makeQuickLookScene(THREE, model, box, reference, { mode, height });
  try {
    const archive = unzipSync(await new USDZExporter().parseAsync(converted.scene, { quickLookCompatible: true }));
    assert.ok(archive['model.usda'], 'Quick Look archive contains its primary scene');
    const text = strFromU8(archive['model.usda']);
    assert.match(text, /metersPerUnit = 1/);
    assert.match(text, /upAxis = "Y"/);
    assert.equal(converted.hasSupport, hasSupport);
    const artworkMatrix = transformFor(text, 'Artwork');
    for (const axisIndex of [0, 5, 10]) near(artworkMatrix.elements[axisIndex], 0.09, 'Artwork has a uniform exported physical scale');
    near(artworkMatrix.elements[13], supportTop + 0.045, 'Artwork carries its own exported ground/contact offset');
    const artwork = exportedBounds(archive, text, 'CalibrationPiece', artworkMatrix);
    near(artwork.getSize(new THREE.Vector3()).y, 0.09, 'Serialized artwork is exactly nine centimetres tall');
    near(artwork.getSize(new THREE.Vector3()).x, 0.036, 'Serialized artwork preserves its width proportion');
    near(artwork.getSize(new THREE.Vector3()).z, 0.018, 'Serialized artwork preserves its depth proportion');
    near(artwork.min.y, supportTop, 'Serialized artwork rests on the floor or stand');
    assert.ok(!primBody(text, 'Artwork').includes('Displayfurniture'), 'Furniture is outside the artwork scale transform');
    if (hasSupport) {
      const supportRoot = transformFor(text, 'Atriumdisplaysupport');
      assert.ok(supportRoot.equals(new THREE.Matrix4()), 'Support root uses identity room coordinates');
      const furniture = exportedBounds(archive, text, 'Displayfurniture', supportRoot);
      near(furniture.min.y, 0, 'Serialized stand base is on the floor');
      near(furniture.max.y, height, 'Serialized stand has the chosen height in metres');
      near(furniture.getSize(new THREE.Vector3()).x, 0.28, 'Serialized stand width is not multiplied by artwork scale');
      near(furniture.getSize(new THREE.Vector3()).z, 0.28, 'Serialized stand depth is not multiplied by artwork scale');
      near(furniture.max.y, artwork.min.y, 'Exported artwork and stand meet exactly');
    } else {
      assert.ok(!text.includes('Atriumdisplaysupport'), 'Surface and automatic Apple placement export no stand');
    }
  } finally {
    converted.dispose();
  }
  assert.equal(mesh.parent, model, 'Export preserves the live model hierarchy');
  assert.deepEqual(mesh.geometry.attributes.position.array, originalPositions, 'Export preserves live geometry');
}
mesh.geometry.dispose(); mesh.material.dispose();

// Preserve a captured pedestal while applying the recorded height to the
// sculpture component. Inspect the serialized USDZ, including both meshes.
const mounted = new THREE.Group();
const sculpture = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.2), new THREE.MeshStandardMaterial());
sculpture.name = 'Sculpture'; sculpture.position.y = 0.1;
const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), new THREE.MeshStandardMaterial());
pedestal.name = 'CapturedPedestal'; pedestal.position.y = -0.4;
mounted.add(sculpture, pedestal);
const mountedBox = new THREE.Box3().setFromObject(mounted, true);
const sculptureFraction = new THREE.Box3().setFromObject(sculpture, true).getSize(new THREE.Vector3()).y
  / mountedBox.getSize(new THREE.Vector3()).y;
const mountedExport = makeQuickLookScene(THREE, mounted, mountedBox,
  { axis: 'y', meters: 0.535, extentFraction: sculptureFraction }, { mode: 'surface' });
try {
  const archive = unzipSync(await new USDZExporter().parseAsync(mountedExport.scene, { quickLookCompatible: true }));
  const text = strFromU8(archive['model.usda']);
  const matrix = transformFor(text, 'Artwork');
  const objectBounds = exportedBounds(archive, text, 'Sculpture', matrix);
  const pedestalBounds = exportedBounds(archive, text, 'CapturedPedestal', matrix);
  near(objectBounds.getSize(new THREE.Vector3()).y, 0.535, 'Exported sculpture has its recorded height excluding pedestal');
  near(objectBounds.getSize(new THREE.Vector3()).x, 0.2675, 'Component reference preserves sculpture proportions');
  near(pedestalBounds.min.y, 0, 'Captured pedestal rests on floor');
  near(pedestalBounds.max.y, objectBounds.min.y, 'Captured pedestal remains attached at original relative scale');
  assert.ok(objectBounds.max.y > 0.535, 'Combined height includes the pedestal in addition to artwork height');
} finally {
  mountedExport.dispose();
  sculpture.geometry.dispose(); sculpture.material.dispose();
  pedestal.geometry.dispose(); pedestal.material.dispose();
}
console.log('Actual USDZ checks passed: physical artwork dimensions, uniform proportions, component measurement with captured pedestal, floor/support contact, fixed-metre stand, and no stand in Apple automatic mode.');

// A default uses the longest actual model dimension, without asserting that it
// is a physical measurement. Test wide, tall and deep models in serialized USDZ.
for (const axis of ['x', 'y', 'z']) {
  const sizes = {x:.4,y:.4,z:.4}; sizes[axis]=2;
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sizes.x,sizes.y,sizes.z),new THREE.MeshStandardMaterial());
  mesh.name='DefaultDisplay'; model.add(mesh);
  const bounds=new THREE.Box3().setFromObject(model,true);
  const reference=displayReferenceFor(bounds,.6);
  const converted=makeQuickLookScene(THREE,model,bounds,reference,{mode:'auto'});
  try {
    const archive=unzipSync(await new USDZExporter().parseAsync(converted.scene,{quickLookCompatible:true}));
    const text=strFromU8(archive['model.usda']);
    const actual=exportedBounds(archive,text,'DefaultDisplay',transformFor(text,'Artwork'));
    near(actual.getSize(new THREE.Vector3())[axis],.6,'Default is exactly 60 cm on its longest side');
    near(actual.min.y,0,'Default display rests on the placement surface');
    assert.equal(converted.hasSupport,false,'Automatic Apple defaults add no virtual stand');
  }finally{converted.dispose();mesh.geometry.dispose();mesh.material.dispose();}
}
console.log('Default-size USDZ checks passed: wide, tall and deep models preserve proportions at the chosen longest extent.');

// Follow the resolved references through the production exporter and inspect
// serialized points. This catches accidentally applying the former 1.5 m
// display default to an approximate reference such as La Chiffonnière.
const dimensionCoverage = JSON.parse(readFileSync(new URL('../docs/approximate-dimensions-2026-09-15/coverage.json', import.meta.url)));
for (const slug of ['modern/dubuffet-la-chiffonniere', 'asia/yunnan-drum-yale-ant052625']) {
  const row = dimensionCoverage.works.find(work => work.slug === slug);
  assert.equal(row.status, 'approximate');
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), new THREE.MeshStandardMaterial());
  mesh.name = 'EstimatedArtwork'; model.add(mesh);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const reference = viewingReferenceFor(bounds, row.reference);
  const converted = makeQuickLookScene(THREE, model, bounds, reference, { mode: 'surface' });
  try {
    const archive = unzipSync(await new USDZExporter().parseAsync(converted.scene, { quickLookCompatible: true }));
    const text = strFromU8(archive['model.usda']);
    const actual = exportedBounds(archive, text, 'EstimatedArtwork', transformFor(text, 'Artwork'));
    const size = actual.getSize(new THREE.Vector3());
    near(size[reference.axis], reference.meters, `${slug}: estimated extent survives USDZ serialization`);
    near(size.x / size.y, 2 / 3, 'Estimates preserve proportions');
    near(actual.min.y, 0, 'Estimated work rests on the placement surface');
  } finally { converted.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); }
}
console.log('Approximate-size USDZ checks passed: Dubuffet 6.7056 m height and the drum 0.254 m longest extent, with uniform proportions.');
