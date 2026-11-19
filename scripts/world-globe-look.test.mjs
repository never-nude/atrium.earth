import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createGlobeLook } from '../src/scripts/world-globe-look.js';

const RAD = Math.PI / 180;
const at = (lat, lon, radius) => new THREE.Vector3(
  radius * Math.cos(lat * RAD) * Math.sin(lon * RAD), radius * Math.sin(lat * RAD), radius * Math.cos(lat * RAD) * Math.cos(lon * RAD));

function build(radius = 1) {
  const scene = new THREE.Scene(), earth = new THREE.Group();
  scene.add(earth);
  const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 40);
  camera.position.set(0, 0, 3.3);
  const places = [['egypt', 26.2, 29.4], ['japan', 36.2, 138.3], ['peru', -9.2, -75]].map(([id, lat, lon]) => ({ id, vector: at(lat, lon, radius) }));
  const look = createGlobeLook({ scene, earth, camera, places });
  const has = name => child => Boolean(child.geometry?.getAttribute(name));
  return { scene, earth, look, places,
    surface: earth.children.find(child => child.geometry?.type === 'SphereGeometry'),
    ring: earth.children.find(child => child.geometry?.type === 'PlaneGeometry'),
    lights: earth.children.filter(child => child.isPoints && has('aGlow')(child)),
    beams: earth.children.find(child => child.isMesh && has('aEnd')(child)) };
}

test('the selection ring lies on the surface however far the globe has turned', () => {
  for (const [x, y] of [[0, 0], [0.16, -0.32], [0.9, 2.4], [-1.2, -3]]) {
    const { scene, earth, look, places, ring } = build();
    earth.rotation.set(x, y, 0, 'XYZ');
    scene.updateMatrixWorld(true);
    for (const place of places) {
      look.setLights(() => 5, place.id);
      const outward = place.vector.clone().normalize();
      // Both are in the earth's own space, which is the space the ring is drawn in.
      const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion);
      assert.ok(facing.angleTo(outward) < 1e-6, `${place.id} ring is tilted ${facing.angleTo(outward) / RAD} degrees with the globe turned ${x}, ${y}`);
      assert.ok(ring.position.distanceTo(outward.multiplyScalar(1.004)) < 1e-6, `${place.id} ring is not centred just above its light`);
    }
  }
});

test('each light is drawn exactly at the vector its caller projects for the hit target', () => {
  for (const radius of [1, 1.025]) {
    const { places, lights, beams } = build(radius);
    assert.equal(lights.length, 2, 'a glow pass and a core pass');
    for (const drawn of [...lights, beams]) {
      const position = drawn.geometry.getAttribute('position');
      const each = position.count / places.length;
      places.forEach((place, i) => {
        for (let corner = 0; corner < each; corner++) {
          assert.ok(new THREE.Vector3().fromBufferAttribute(position, i * each + corner).distanceTo(place.vector) < 1e-6, `${place.id} is drawn away from its vector`);
        }
      });
    }
  }
});

test('without a coastline the plain sphere shows and nothing on it can be mistaken for a choice', () => {
  const { look, surface, ring, lights, beams } = build();
  look.setLights(() => 5, 'egypt');
  assert.equal(surface.visible, false, 'nothing is drawn before the land or its absence is known');
  look.showBare();
  look.frame(0, { still: true });
  assert.equal(look.ready, true);
  assert.equal(surface.visible, true);
  for (const drawn of [...lights, beams, ring]) assert.equal(drawn.visible, false);
});
