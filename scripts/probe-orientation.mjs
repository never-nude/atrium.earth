// Solve modelRotation [rx,0,rz] numerically for mis-oriented scans.
// Strategies: pca (align principal axis to +Y), level (small-tilt footprint fix),
// facedown (pick best of 6 box faces, then level).
// Usage: node scripts/probe-orientation.mjs slug=strategy [slug=strategy ...]
import { readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class ProgressEvent extends Event {};
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

function samplePoints(scene, max = 4000) {
  const pts = [];
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (!obj.isMesh || /^(?:cubo|disco)(?:_|\.|$)/i.test(obj.name || '')) return;
    const pos = obj.geometry.getAttribute('position');
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / (max / 4)));
    for (let i = 0; i < pos.count; i += step) {
      pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld));
    }
  });
  return pts;
}

function principalAxis(pts) {
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
  let m = [0, 0, 0, 0, 0, 0]; // xx xy xz yy yz zz
  for (const p of pts) {
    const d = p.clone().sub(c);
    m[0] += d.x * d.x; m[1] += d.x * d.y; m[2] += d.x * d.z;
    m[3] += d.y * d.y; m[4] += d.y * d.z; m[5] += d.z * d.z;
  }
  let v = new THREE.Vector3(1, 1, 1).normalize();
  for (let i = 0; i < 60; i += 1) {
    v = new THREE.Vector3(
      m[0] * v.x + m[1] * v.y + m[2] * v.z,
      m[1] * v.x + m[3] * v.y + m[4] * v.z,
      m[2] * v.x + m[4] * v.y + m[5] * v.z,
    ).normalize();
  }
  return v;
}

function footprintScore(pts, e) {
  let minY = Infinity, maxY = -Infinity;
  const ys = new Array(pts.length);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 1) {
    const y = tmp.copy(pts[i]).applyEuler(e).y;
    ys[i] = y;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const band = minY + (maxY - minY) * 0.02;
  let n = 0;
  for (const y of ys) if (y <= band) n += 1;
  return n / pts.length;
}

const deg = THREE.MathUtils.degToRad;

for (const arg of process.argv.slice(2)) {
  const [slug, strategy] = arg.split('=');
  let file = `public/models/previews/${slug}/preview.glb`;
  let buffer = readFileSync(file);
  if (buffer.includes('KHR_draco_mesh_compression')) {
    const tmp = join(mkdtempSync(join(tmpdir(), 'probe-')), 'm.glb');
    execFileSync('npx', ['--yes', '@gltf-transform/cli', 'copy', file, tmp], { stdio: 'ignore' });
    buffer = readFileSync(tmp);
  }
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
  const pts = samplePoints(gltf.scene);

  let best = { rx: 0, rz: 0, score: -Infinity };
  if (strategy === 'pca') {
    // Search rx,rz grid for max verticality of the principal axis.
    const axis = principalAxis(pts);
    for (let rx = -180; rx < 180; rx += 2) for (let rz = -90; rz <= 90; rz += 2) {
      const v = axis.clone().applyEuler(new THREE.Euler(deg(rx), 0, deg(rz), 'XYZ'));
      if (Math.abs(v.y) > best.score) best = { rx, rz, score: Math.abs(v.y) };
    }
    // Prefer the flip that puts more mass below the midpoint (wide base down).
    const e1 = new THREE.Euler(deg(best.rx), 0, deg(best.rz), 'XYZ');
    const e2 = new THREE.Euler(deg(best.rx + 180), 0, deg(best.rz), 'XYZ');
    if (footprintScore(pts, e2) > footprintScore(pts, e1)) best.rx += 180;
  } else {
    const seeds = strategy === 'facedown'
      ? [[0, 0], [180, 0], [90, 0], [-90, 0], [0, 90], [0, -90]]
      : [[0, 0]];
    let seedBest = { seed: [0, 0], score: -Infinity };
    for (const s of seeds) {
      const sc = footprintScore(pts, new THREE.Euler(deg(s[0]), 0, deg(s[1]), 'XYZ'));
      if (sc > seedBest.score) seedBest = { seed: s, score: sc };
    }
    best = { rx: seedBest.seed[0], rz: seedBest.seed[1], score: seedBest.score };
    for (let dx = -15; dx <= 15; dx += 1) for (let dz = -15; dz <= 15; dz += 1) {
      const e = new THREE.Euler(deg(best.rx + dx), 0, deg(best.rz + dz), 'XYZ');
      const sc = footprintScore(pts, e);
      if (sc > best.score + 1e-6) best = { rx: best.rx + dx, rz: best.rz + dz, score: sc };
    }
  }
  const norm = (v) => ((v + 180) % 360 + 360) % 360 - 180;
  console.log(`${slug} ${strategy} -> [${norm(best.rx)}, 0, ${norm(best.rz)}] score=${best.score.toFixed(3)}`);
}
