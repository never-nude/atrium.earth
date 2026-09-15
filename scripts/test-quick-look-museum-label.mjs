import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dev } from 'astro';
import { chromium } from 'playwright';
import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';

const output = '/tmp/atrium-upright-label-tests';
await mkdir(output, { recursive: true });
const works = new URL('../dist/works/', import.meta.url);
const records = (await Promise.all((await readdir(works, { recursive: true }))
  .filter(path => path.endsWith('/index.html')).map(async path =>
    (await readFile(new URL(path, works), 'utf8')).match(/data-museum-label-json="([^"]+)"/)?.[1]))).filter(Boolean);
const server = await dev({ root: new URL('../', import.meta.url), devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4339 }, vite: { server: { watch: null, hmr: false } }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: process.env.ATRIUM_TEST_EXECUTABLE,
  headless: true, args: ['--enable-unsafe-swiftshader'] });

const numbers = text => [...text.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)].map(match => Number(match[0]));
function prim(text, name) {
  const start = text.indexOf(`def Xform "${name}"`);
  assert.ok(start >= 0, `Export contains ${name}`);
  const open = text.indexOf('{', start);
  let depth = 1, end = open + 1;
  while (depth && end < text.length) {
    if (text[end] === '{') depth++;
    if (text[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return text.slice(start, end);
}
function matrix(text, name) {
  return new THREE.Matrix4().fromArray(numbers(prim(text, name).match(/matrix4d xformOp:transform = ([^\n]+)/)[1]));
}
function exportedPoints(archive, text, name, parent) {
  const body = prim(text, name);
  const path = body.match(/prepend references = @\.\/(geometries\/[^@]+)@/)[1];
  const xyz = numbers(strFromU8(archive[path]).match(/point3f\[\] points = \[([^\]]+)\]/)[1]);
  const transform = parent.clone().multiply(matrix(text, name));
  return Array.from({ length: xyz.length / 3 }, (_, i) => new THREE.Vector3(...xyz.slice(i * 3, i * 3 + 3)).applyMatrix4(transform));
}
const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4339/works/egyptian/seated-scribe-e3023-louvre/');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-spatial-url]')?.value));
  const tested = await page.evaluate(async records => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { USDZExporter } = await import('/node_modules/three/examples/jsm/exporters/USDZExporter.js');
    const { makeQuickLookScene } = await import('/src/lib/spatial-session.mjs');
    const { createMuseumPlacardCanvas, addQuickLookMuseumLabel } = await import('/src/lib/quick-look-museum-label.mjs');
    const { museumLabelLines } = await import('/src/lib/museum-label.mjs');
    const decode = document.createElement('textarea');
    const labels = records.map(record => { decode.innerHTML = record; return JSON.parse(decode.value); });
    for (const label of labels) {
      const { canvas, rows } = createMuseumPlacardCanvas(label);
      if (rows.map(row => row.text).join('').replace(/\s/g, '') !== museumLabelLines(label).join('').replace(/\s/g, ''))
        throw new Error(`Missing label facts: ${label.title}`);
      const ctx = canvas.getContext('2d');
      for (const row of rows) {
        ctx.font = row.font;
        if (ctx.measureText(row.text).width > 288.001 || row.y + 22 > canvas.height / 3)
          throw new Error(`Clipped label: ${label.title}`);
      }
      canvas.width = canvas.height = 1;
    }
    const scribe = JSON.parse(document.querySelector('[data-spatial]').dataset.museumLabelJson);
    if (!scribe.title.includes('Seated Scribe') || !scribe.maker || !scribe.region || !scribe.material || !scribe.period)
      throw new Error('Seated Scribe is missing a catalogue fact');
    const venus = labels.find(label => label.title === 'Venus of Willendorf');
    const cases = [
      ['scribe', [.4317, .537, .3513], scribe, 'surface'],
      ['venus', [.056, .11, .05], venus, 'surface'],
      ['stand', [.056, .11, .05], venus, 'plinth'],
      ['wide', [2.8, .8, .4], scribe, 'surface'],
      ['deep', [.4, .8, 2.8], scribe, 'surface'],
      ['flat', [.5, .001, .3], scribe, 'surface'],
      ['large', [2.2, 5, 1.6], scribe, 'surface'],
      ['corrected-scan', [.4, .8, .25], scribe, 'surface'],
    ];
    window.labelPreviews = {};
    const archives = [];
    for (const [name, size, label, mode] of cases) {
      const model = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: 0xb5a38c, roughness: 1 }));
      mesh.name = 'Sculpture';
      model.add(mesh);
      if (name === 'corrected-scan') { model.rotation.set(.1, .8, -.2); model.scale.x = -1; }
      const box = new THREE.Box3().setFromObject(model, true);
      const converted = makeQuickLookScene(THREE, model, box, { axis: 'y', meters: box.getSize(new THREE.Vector3()).y }, { mode, height: .8 });
      const before = new THREE.Box3().setFromObject(converted.scene.getObjectByName('Artwork'), true);
      const labelObject = addQuickLookMuseumLabel(THREE, converted.scene, label);
      const after = new THREE.Box3().setFromObject(converted.scene.getObjectByName('Artwork'), true);
      if (!before.equals(after)) throw new Error('Label moved the sculpture');
      const labelBounds = new THREE.Box3().setFromObject(labelObject.object, true);
      if (labelBounds.min.x <= before.max.x || labelBounds.min.y < before.min.y)
        throw new Error('Label touches the sculpture or falls below its surface');
      const bytes = await new USDZExporter().parseAsync(converted.scene, { quickLookCompatible: true });
      archives.push({ name, bytes: [...bytes], placement: labelObject.placement,
        bounds: { min: before.min.toArray(), max: before.max.toArray() } });
      window.labelPreviews[name] = { converted, labelObject };
    }
    window.labelPreviewThree = THREE;
    return { count: labels.length, archives };
  }, records);
  assert.ok(tested.count >= 1046);
  for (const item of tested.archives) {
    const bytes = Buffer.from(item.bytes), archive = unzipSync(bytes), text = strFromU8(archive['model.usda']);
    assert.match(text, /upAxis = "Y"/);
    assert.match(text, /planeAnchoring:alignment = "horizontal"/);
    assert.doesNotMatch(text, /LookAtCamera|Preliminary_Behavior|timeSamples/);
    assert.equal(Object.keys(archive).filter(path => path.startsWith('textures/')).length, 1);
    assert.ok(!prim(text, 'Artwork').includes('AtriumMuseumLabel'), 'Label is outside the artwork scale and scan transforms');
    const labelMatrix = matrix(text, 'AtriumMuseumLabel');
    const identity = new THREE.Matrix4();
    for (const index of [0,1,2,3,4,5,6,7,8,9,10,11,15])
      near(labelMatrix.elements[index], identity.elements[index], 'No label rotation, shear, or scale in the serialized USDZ');
    const front = exportedPoints(archive, text, 'MuseumLabelFront', labelMatrix);
    const back = exportedPoints(archive, text, 'MuseumLabelBack', labelMatrix);
    const labelBounds = new THREE.Box3().setFromPoints(front);
    assert.ok(labelBounds.min.x >= item.bounds.max[0] + item.placement.gap - 1e-6);
    assert.ok(labelBounds.min.y >= item.bounds.min[1]);
    near(labelBounds.max.y - labelBounds.min.y, item.placement.height, 'Serialized label keeps its height');
    near(labelBounds.max.x - labelBounds.min.x, item.placement.width, 'Serialized label keeps its width');
    for (const face of [front, back]) {
      for (const point of face) near(point.z, face[0].z, 'All corners share one upright XY plane');
      near(face[0].y, face[1].y, 'Top edge is level');
      near(face[2].y, face[3].y, 'Bottom edge is level');
      near(face[0].x, face[2].x, 'Left edge is upright');
    }
    await writeFile(`${output}/${item.name}.usdz`, bytes);
  }

  // Local visual preview of the actual scene geometry and label texture. The
  // boxes represent scan bounds, not photographs or simulated iPhone tracking.
  await page.evaluate(() => {
    document.body.innerHTML = '<canvas id="label-preview"></canvas>';
    document.body.style.cssText = 'margin:0;overflow:hidden';
    const THREE = window.labelPreviewThree;
    const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: true });
    renderer.setPixelRatio(2); renderer.setClearColor('#bdb9af');
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5c5141, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(-2, 4, 3); scene.add(light);
    const camera = new THREE.PerspectiveCamera(40, 1, .001, 100);
    window.drawLabelPreview = (name, yaw = 0, elevation = 0) => {
      const fixture = window.labelPreviews[name];
      for (const value of Object.values(window.labelPreviews)) value.converted.scene.removeFromParent();
      scene.add(fixture.converted.scene);
      const box = new THREE.Box3().setFromObject(fixture.converted.scene, true);
      const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      const distance = Math.max(size.x, size.y) / (2 * Math.tan(THREE.MathUtils.degToRad(20))) * 1.15 + size.z / 2;
      camera.position.copy(center).add(new THREE.Vector3(Math.sin(yaw) * distance, elevation * distance, Math.cos(yaw) * distance));
      camera.lookAt(center); camera.aspect = innerWidth / innerHeight;
      // Use the same short-edge lens angle in either orientation, as a rotated
      // phone sensor would. This affects this preview only, never native AR.
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) / Math.min(camera.aspect, 1)));
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight); renderer.render(scene, camera);
      const points = [new THREE.Vector3(-.5,.5,0), new THREE.Vector3(.5,.5,0)].map(point => {
        point.x *= fixture.labelObject.placement.width; point.y *= fixture.labelObject.placement.height;
        return point.applyMatrix4(fixture.labelObject.object.matrixWorld).project(camera).toArray();
      });
      return { points, matrix: fixture.labelObject.object.matrixWorld.toArray() };
    };
  });
  for (const name of ['scribe', 'venus', 'stand', 'wide']) {
    let original;
    for (const [width,height] of [[390,844],[844,390],[320,568],[568,320],[390,844]]) {
      await page.setViewportSize({ width, height });
      const result = await page.evaluate(name => window.drawLabelPreview(name), name);
      original ??= result.matrix;
      assert.deepEqual(result.matrix, original, 'Portrait/landscape never changes the world label transform');
      near(result.points[0][1], result.points[1][1], 'Frontal label is level in either orientation');
      assert.ok(result.points.every(point => Math.abs(point[0]) < 1 && Math.abs(point[1]) < 1));
      if (width >= 390) await page.screenshot({ path: `${output}/${name}-${width}.png` });
    }
  }
  for (const yaw of [-.4,.4]) {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(yaw => window.drawLabelPreview('scribe', yaw, .15), yaw);
    await page.screenshot({ path: `${output}/scribe-perspective-${yaw < 0 ? 'left' : 'right'}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(`Upright label checks passed: ${tested.count} complete catalogue labels, ${tested.archives.length} real USDZ exports, upright planes, measured gaps, unchanged sculpture transforms, front/back text, and equal portrait/landscape previews.`);
  console.log('Native iPhone tracking and camera photographs require physical-device validation.');
} finally { await browser.close(); await server.stop(); }
