import assert from 'node:assert/strict';
import * as THREE from 'three';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { makeQuickLookScene } from '../src/lib/spatial-session.mjs';

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
console.log('Actual USDZ checks passed: nine-centimetre artwork, uniform proportions, exported floor/support contact, fixed-metre stand, and no stand in Apple automatic mode.');
