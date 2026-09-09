import assert from 'node:assert/strict';
import * as THREE from 'three';
import { startSpatialSession, makeQuickLookScene } from '../src/lib/spatial-session.mjs';
import { normalizeModel } from '../public/model-render-utils.js';

const tick = () => new Promise(resolve => queueMicrotask(resolve));
function fixture() {
  const scene = new THREE.Scene();
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), new THREE.MeshStandardMaterial());
  mesh.rotation.z = 0.12; model.add(mesh); scene.add(model);
  const { box } = normalizeModel(THREE, model);
  const camera = new THREE.PerspectiveCamera(35, 1.5, 0.01, 100);
  camera.position.set(1, 0.7, 3);
  const ground = new THREE.Object3D(); ground.position.y = box.min.y;
  const grid = new THREE.Object3D(); grid.position.y = box.min.y;
  scene.add(ground, grid);
  let paused = 0;
  const renderer = {
    xr: { enabled: false, setReferenceSpaceType(type) { this.type = type; }, async setSession() {}, getReferenceSpace() { return {}; } },
    getClearColor: (value) => value.set(0x123456), getClearAlpha: () => 0,
    setClearColor() {}, render() {}, setAnimationLoop(callback) { this.loop = callback; },
  };
  return {
    THREE, scene, model, camera, ground, grid, box, renderer,
    suspend: () => { paused++; return () => paused--; },
    get paused() { return paused; },
  };
}
class Session extends EventTarget {
  cancelled = 0;
  async end() { this.dispatchEvent(new Event('end')); }
  async requestReferenceSpace() { return {}; }
  async requestHitTestSource() { return { cancel: () => this.cancelled++ }; }
}
function original(context) {
  return { position: context.model.position.clone(), scale: context.model.scale.clone(), rotation: context.model.quaternion.clone(), camera: context.camera.position.clone(), ground: context.ground.position.clone() };
}
function restored(context, state) {
  assert.equal(context.model.parent, context.scene);
  assert.equal(context.ground.parent, context.scene);
  assert.ok(context.model.position.equals(state.position));
  assert.ok(context.model.scale.equals(state.scale));
  assert.ok(context.model.quaternion.equals(state.rotation));
  assert.ok(context.camera.position.equals(state.camera));
  assert.ok(context.ground.position.equals(state.ground));
  assert.equal(context.paused, 0);
  assert.equal(context.renderer.xr.enabled, false);
  assert.equal(context.renderer.loop ?? null, null);
  assert.equal(context.scene.children.length, 3);
}

{
  const context = fixture(), state = original(context), session = new Session();
  const active = await startSpatialSession(context, Promise.resolve(session), 'immersive-vr', null);
  assert.equal(context.paused, 1);
  assert.equal(context.renderer.xr.type, 'local-floor');
  assert.equal(context.model.parent.parent.position.z, -2);
  active.setScale(0.4);
  context.scene.updateMatrixWorld(true);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(context.model, true).min.y) < 1e-6, 'VR sculpture sits on the floor after scaling');
  session.dispatchEvent(new Event('select'));
  assert.equal(context.model.parent.parent.rotation.y, Math.PI / 6);
  session.inputSources = [{ gamepad: { axes: [0, 0, 0, -0.8] } }];
  context.renderer.loop(0, null); context.renderer.loop(100, null);
  assert.ok(context.model.parent.parent.scale.x > 0.4, 'VR thumbstick changes display size');
  await active.end(); await tick(); restored(context, state);
}
{
  const context = fixture(), state = original(context), session = new Session();
  const active = await startSpatialSession(context, Promise.resolve(session), 'immersive-ar', null);
  const anchor = context.model.parent.parent;
  assert.equal(anchor.visible, false);
  const wall = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const floor = new THREE.Matrix4().makeTranslation(0.5, -0.8, -2);
  const frame = (matrix) => ({ getHitTestResults: () => [{ getPose: () => ({ transform: { matrix: matrix.elements } }) }] });
  context.renderer.loop(0, frame(wall)); session.dispatchEvent(new Event('select'));
  assert.equal(anchor.visible, false, 'Wall hit cannot place an upright sculpture');
  context.renderer.loop(0, frame(floor)); session.dispatchEvent(new Event('select'));
  assert.equal(anchor.visible, true);
  assert.deepEqual(anchor.position.toArray(), [0.5, -0.8, -2]);
  active.setScale(0.5); context.scene.updateMatrixWorld(true);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(context.model, true).min.y + 0.8) < 1e-6);
  active.reposition(); assert.equal(anchor.visible, false);
  await active.end(); await tick(); restored(context, state);
  assert.equal(session.cancelled, 1);
}
{
  const context = fixture(), state = original(context);
  await assert.rejects(startSpatialSession(context, Promise.reject(new DOMException('Denied', 'NotAllowedError')), 'immersive-vr', null), { name: 'NotAllowedError' });
  restored(context, state);
}
{
  const context = fixture(), state = original(context), session = new Session();
  session.requestHitTestSource = async () => { throw new Error('No surfaces'); };
  await assert.rejects(startSpatialSession(context, Promise.resolve(session), 'immersive-ar', null), /No surfaces/);
  await tick(); restored(context, state);
}
{
  const context = fixture(), state = original(context), session = new Session();
  let resolveSpace;
  session.requestReferenceSpace = () => new Promise(resolve => { resolveSpace = resolve; });
  const promise = startSpatialSession(context, Promise.resolve(session), 'immersive-ar', null);
  await tick(); await session.end(); resolveSpace({});
  await assert.rejects(promise, { name: 'AbortError' });
  restored(context, state);
}
{
  const context = fixture(), state = original(context), session = new Session(), signal = new AbortController();
  signal.abort();
  await assert.rejects(startSpatialSession(context, Promise.resolve(session), 'immersive-vr', null, { signal: signal.signal }), { name: 'AbortError' });
  restored(context, state);
}
{
  const context = fixture();
  const originalGeometry = context.model.children[0].geometry;
  const before = originalGeometry.attributes.position.array.slice();
  const converted = makeQuickLookScene(THREE, context.model, context.box);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(converted.scene, true).min.y) < 1e-6);
  converted.dispose();
  assert.deepEqual(originalGeometry.attributes.position.array, before, 'Quick Look never changes the live mesh');
  assert.equal(context.model.parent, context.scene);
}
{
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  const model = new THREE.Group();
  model.add(new THREE.Mesh(geometry, Array(6).fill(material)));
  const box = new THREE.Box3().setFromObject(model, true);
  const converted = makeQuickLookScene(THREE, model, box);
  assert.equal(converted.scene.children.length, 6);
  assert.equal(converted.scene.children.reduce((count, mesh) => count + mesh.geometry.index.count, 0), geometry.index.count);
  converted.dispose();
}
{
  const context = fixture(), state = original(context), session = new Session();
  let ended = false;
  session.addEventListener('end', () => { ended = true; });
  context.suspend = () => { throw new Error('Another view is active'); };
  await assert.rejects(startSpatialSession(context, Promise.resolve(session), 'immersive-vr', null), /Another view/);
  assert.ok(ended, 'A conflicting operation cannot leave an immersive session open');
  restored(context, state);
}
{
  const context = fixture(); context.model.scale.x *= -1;
  const box = new THREE.Box3().setFromObject(context.model, true);
  const converted = makeQuickLookScene(THREE, context.model, box);
  const geometry = converted.scene.children[0].geometry;
  const a = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(0));
  const b = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(1));
  const c = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(2));
  const normal = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, geometry.index.getX(0));
  assert.ok(b.sub(a).cross(c.sub(a)).dot(normal) > 0, 'Mirrored meshes preserve outward-facing triangles');
  converted.dispose();
}
{
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bone = new THREE.Bone();
  const model = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  model.add(mesh, bone); model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([bone]));
  bone.position.set(0.2, 1, 0); model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const converted = makeQuickLookScene(THREE, model, box);
  const exportedBox = new THREE.Box3().setFromObject(converted.scene, true);
  assert.ok(Math.abs(exportedBox.min.y) < 1e-6, 'Skinned pose is baked, with its base on the floor');
  assert.ok(Math.abs(exportedBox.min.x - box.min.x) < 1e-6);
  converted.dispose();
}
for (const meters of [0.09, 0.595, 2.277, 8]) {
  for (const mode of ['immersive-ar', 'immersive-vr']) {
    const context = fixture(), state = original(context), session = new Session();
    const reference = { axis: 'y', meters };
    let displayed;
    const active = await startSpatialSession(context, Promise.resolve(session), mode, null, { reference, onScale: value => { displayed = value; } });
    const height = () => {
      context.scene.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(context.model, true).getSize(new THREE.Vector3()).y;
    };
    assert.ok(Math.abs(height() - meters) < 1e-6, `${mode} starts at documented size`);
    active.setScale(0.5);
    assert.ok(Math.abs(height() - meters / 2) < 1e-6);
    assert.equal(displayed, 0.5, 'UI scale is relative to the documented size');
    active.setScale(1);
    assert.ok(Math.abs(height() - meters) < 1e-6, 'Reset restores the original reference, not a one-meter default');
    await active.end(); await tick(); restored(context, state);
    const converted = makeQuickLookScene(THREE, context.model, context.box, reference);
    const box = new THREE.Box3().setFromObject(converted.scene, true);
    assert.ok(Math.abs(box.getSize(new THREE.Vector3()).y - meters) < 1e-6, 'Apple AR receives the same physical size');
    assert.ok(Math.abs(box.min.y) < 1e-6, 'Export stays on the floor after physical scaling');
    converted.dispose();
    const again = await startSpatialSession(context, Promise.resolve(new Session()), mode, null, { reference });
    assert.ok(Math.abs(height() - meters) < 1e-6, 'Repeated sessions do not compound physical scale');
    await again.end(); await tick(); restored(context, state);
  }
}
console.log('Spatial checks passed: physical size in WebXR and Quick Look, relative resizing, floor placement, return to screen, permissions and interrupted sessions.');
