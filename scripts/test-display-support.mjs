import assert from 'node:assert/strict';
import * as THREE from 'three';
import { supportLayoutFor, createDisplaySupport } from '../src/lib/display-support.mjs';

// Mesh vertices use Float32 storage; contact tests allow less than a micron.
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} != ${expected}`);
const box = (x, y, z) => new THREE.Box3(new THREE.Vector3(-x / 2, -y / 2, -z / 2), new THREE.Vector3(x / 2, y / 2, z / 2));
const small = box(0.4, 1, 0.2);
const reference = { axis: 'y', meters: 0.09 };

assert.equal(supportLayoutFor(small, reference).visible, false, 'Surface placement is the default');
assert.equal(supportLayoutFor(small, reference, { mode: 'auto' }).visible, true, 'A calibrated small object gets a VR support');
for (const kind of ['floor', 'existing_base', 'wall_mount', 'stand', 'cradle']) {
  assert.equal(supportLayoutFor(small, reference, { mode: 'auto', recommendation: { kind } }).visible, false, 'Reviewed placement takes priority over the generic size rule');
  assert.equal(supportLayoutFor(small, reference, { mode: 'plinth', recommendation: { kind } }).visible, true, 'Visitors can explicitly choose a plinth');
}
assert.equal(supportLayoutFor(small, { axis: 'y', meters: 0.8 }, { mode: 'auto', recommendation: { kind: 'plinth' } }).visible, true, 'An individually reviewed taller bust can receive a viewing plinth');
assert.equal(supportLayoutFor(small, null, { mode: 'auto', recommendation: { kind: 'plinth' } }).visible, false, 'A display recommendation never fabricates physical calibration');
assert.equal(supportLayoutFor(small, reference, { mode: 'auto', sessionMode: 'immersive-ar', recommendation: { kind: 'plinth' } }).visible, false, 'Recommendations preserve AR real-surface placement');
for (const sessionMode of ['immersive-ar', 'quick-look']) {
  assert.equal(supportLayoutFor(small, reference, { mode: 'auto', sessionMode }).visible, false, 'Auto never assumes a detected surface is a floor');
  assert.equal(supportLayoutFor(small, null, { mode: 'plinth', sessionMode }).visible, true, 'Explicit furniture remains available without calibration');
}
for (const invalid of [null, {}, { axis: 'q', meters: 0.09 }, { axis: 'y', meters: 0 }, { axis: 'y', meters: -1 }, { axis: 'y', meters: Infinity }, { axis: 'y', meters: NaN }, { axis: 'y', meters: '0.09' }]) {
  assert.equal(supportLayoutFor(small, invalid, { mode: 'auto' }).visible, false, 'Uncalibrated normalized bounds cannot trigger an automatic stand');
}
assert.equal(supportLayoutFor(box(1, 0, 1), reference, { mode: 'auto' }).visible, false, 'A zero reference extent is invalid');
assert.equal(supportLayoutFor({ min: { x: NaN, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }, reference, { mode: 'auto' }).visible, false);
assert.equal(supportLayoutFor(small, reference, { mode: 'unknown' }).visible, false);
assert.equal(supportLayoutFor(small, { axis: 'x', meters: 0.2 }, { mode: 'auto' }).visible, true, 'A width reference also establishes physical height');
assert.equal(supportLayoutFor(small, { axis: 'z', meters: 0.3 }, { mode: 'auto' }).visible, false, 'A depth reference can establish that an object is too tall');
assert.deepEqual(supportLayoutFor(null, reference, { mode: 'plinth' }), {
  visible: true, height: 1, width: 0.28, depth: 0.28, centerX: 0, centerZ: 0,
}, 'Missing bounds produce finite conservative furniture, without claiming calibration');
for (const [dimensions, meters, expected] of [
  [[0.4, 1, 0.2], 0.7, true],
  [[0.4, 1, 0.2], 0.701, false],
  [[2.4, 1, 0.2], 0.5, true],
  [[2.402, 1, 0.2], 0.5, false],
  [[0.4, 1, 2.402], 0.5, false],
]) {
  assert.equal(supportLayoutFor(box(...dimensions), { axis: 'y', meters }, { mode: 'auto' }).visible, expected, 'Automatic support respects physical height and footprint');
}

const offsetBounds = new THREE.Box3(new THREE.Vector3(1, -2, 3), new THREE.Vector3(3, 2, 7));
const offsetReference = { axis: 'y', meters: 0.6 };
const layout = supportLayoutFor(offsetBounds, offsetReference, { mode: 'plinth', height: 0.9 });
close(layout.width, 0.42, 'Width includes six centimetres on each side');
close(layout.depth, 0.72, 'Depth includes six centimetres on each side');
close(layout.centerX, 0.3, 'Off-centre model is supported in physical coordinates');
close(layout.centerZ, 0.75, 'Depth centre uses the same reference scale');
const tiny = supportLayoutFor(small, reference, { mode: 'plinth' });
close(tiny.width, 0.28, 'Very small objects use the minimum footprint');
close(tiny.depth, 0.28, 'Minimum depth is independent of artwork height');
for (const [height, expected] of [[-1, 0.2], [0, 0.2], [0.2, 0.2], [2, 1.4], [NaN, 1], [Infinity, 1], ['0.8', 0.8]]) {
  close(supportLayoutFor(small, reference, { mode: 'plinth', height }).height, expected, 'Height is bounded');
}

const model = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.09, 0.018), new THREE.MeshStandardMaterial());
model.position.set(layout.centerX, layout.height + 0.045, layout.centerZ);
const originalScale = model.scale.clone();
const originalGeometry = model.geometry.attributes.position.array.slice();
const support = createDisplaySupport(THREE, layout);
const scene = new THREE.Scene();
scene.add(model, support.object);
const dimensions = () => new THREE.Box3().setFromObject(support.object, true);
let bounds = dimensions();
close(bounds.min.y, 0, 'Plinth base rests on the floor');
close(bounds.max.y, layout.height, 'Solid top is at the requested height');
close(bounds.getSize(new THREE.Vector3()).x, layout.width, 'World footprint matches the layout');
close(bounds.getSize(new THREE.Vector3()).z, layout.depth, 'World depth matches the layout');
close(bounds.getCenter(new THREE.Vector3()).x, layout.centerX, 'World centre matches the sculpture');
assert.deepEqual(support.object.scale.toArray(), [1, 1, 1], 'Furniture root is not scaled with artwork');
assert.deepEqual(support.object.position.toArray(), [0, 0, 0], 'Furniture coordinates are in metres from the placement origin');
assert.equal(support.object.children[0].material.isMeshStandardMaterial, true, 'Support is exportable to USDZ');
assert.equal(support.object.children[0].material.transparent, false, 'Support top is opaque');
assert.ok(support.object.children[0].material.emissiveIntensity > 0, 'Support remains visible without external lighting');
close(new THREE.Box3().setFromObject(model, true).min.y, bounds.max.y, 'Artwork meets the support top');
close(support.setHeight(1.2), 1.2, 'Height setter returns the effective height');
bounds = dimensions();
close(bounds.min.y, 0, 'Changing height leaves the base on the floor');
close(bounds.max.y, 1.2, 'Height setter moves the solid top precisely');
close(bounds.getSize(new THREE.Vector3()).x, layout.width, 'Height changes do not scale the footprint');
assert.ok(model.scale.equals(originalScale), 'Furniture never changes artwork scale');
assert.deepEqual(model.geometry.attributes.position.array, originalGeometry, 'Furniture never changes artwork geometry');
close(support.setHeight(99), 1.4, 'Runtime height is also bounded');

let geometryDisposals = 0, materialDisposals = 0;
const mesh = support.object.children[0];
mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
mesh.material.addEventListener('dispose', () => materialDisposals++);
support.dispose(); support.dispose();
assert.equal(geometryDisposals, 1, 'Owned geometry is released once');
assert.equal(materialDisposals, 1, 'Owned material is released once');
assert.equal(support.object.parent, null, 'Disposed support is detached from the scene');
assert.equal(support.object.children.length, 0, 'Disposed support retains no meshes');
assert.equal(model.parent, scene, 'Cleanup preserves the artwork');
const hidden = createDisplaySupport(THREE, supportLayoutFor(small, reference));
assert.equal(hidden.object.visible, false, 'Surface mode has no visible virtual furniture');
hidden.dispose(); model.geometry.dispose(); model.material.dispose();
console.log('Display support checks passed: calibration eligibility, floor/table choices, fixed metre furniture, exact contact height, footprint, and cleanup.');
