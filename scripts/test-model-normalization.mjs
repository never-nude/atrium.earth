import assert from 'node:assert/strict';
import * as THREE from 'three';
import { normalizeModel } from '../public/model-render-utils.js';

function fixture() {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 16));
  mesh.rotation.z = 0.55;
  mesh.position.set(2, 3, -1);
  root.add(mesh);
  root.rotation.set(0.3, 0.4, 0.15);
  return root;
}

function verifyContact(model) {
  const { box } = normalizeModel(THREE, model);
  model.updateMatrixWorld(true);
  const actual = new THREE.Box3().setFromObject(model, true);
  assert(actual.min.distanceTo(box.min) < 1e-7, 'Floor must match the actual lowest vertex');
  assert(actual.max.distanceTo(box.max) < 1e-7);
  assert(actual.getCenter(new THREE.Vector3()).length() < 1e-7, 'Model must be centered');
  assert(Math.abs(Math.max(...actual.getSize(new THREE.Vector3()).toArray()) - 1) < 1e-7);
  const turntable = new THREE.Group();
  turntable.add(model);
  turntable.rotation.y = 1.234;
  turntable.updateMatrixWorld(true);
  assert(Math.abs(new THREE.Box3().setFromObject(turntable, true).min.y - actual.min.y) < 1e-7);
}

// Cached local bounding boxes include empty corners below a rotated cone.
const rotated = fixture();
const cached = new THREE.Box3().setFromObject(rotated);
const vertices = new THREE.Box3().setFromObject(rotated, true);
assert(vertices.min.y - cached.min.y > 0.02);
verifyContact(rotated);

const scaled = fixture();
scaled.scale.set(2, 3, 4);
verifyContact(scaled);
assert(Math.abs(scaled.scale.y / scaled.scale.x - 1.5) < 1e-7);
assert(Math.abs(scaled.scale.z / scaled.scale.x - 2) < 1e-7);

// A sibling skeleton can follow its mesh in the scene hierarchy. Refresh all
// world and bind matrices before measuring vertices after scale/position edits.
const root = new THREE.Group();
const geometry = new THREE.BoxGeometry(0.3, 0.6, 0.2);
const count = geometry.getAttribute('position').count;
geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
const weights = new Float32Array(count * 4);
for (let i = 0; i < count; i++) weights[i * 4] = 1;
geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
const bone = new THREE.Bone();
root.add(mesh, bone);
root.updateMatrixWorld(true);
mesh.bind(new THREE.Skeleton([bone]));
bone.rotation.x = 0.4;
root.rotation.set(0.3, 0.2, -0.1);
verifyContact(root);
console.log('Model normalization: rotated geometry, authored scale, articulated geometry, and turntable contact passed.');
