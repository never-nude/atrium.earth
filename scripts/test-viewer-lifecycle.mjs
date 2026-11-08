import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners, setMaxListeners } from 'node:events';
import * as THREE from 'three';
import { createViewerRenderLoop, bindViewerRenderEvents } from '../src/lib/viewer-render-loop.mjs';
import { handleViewerKey, orbitViewer } from '../src/lib/viewer-input.mjs';
import { disposeViewerScene } from '../src/lib/viewer-resources.mjs';
import { bindSpatialViewing } from '../src/lib/spatial-viewer.mjs';

function frames(draw, options = {}) {
  const queued = new Map(); let next = 1, time = 0;
  const loop = createViewerRenderLoop({ draw, requestFrame: callback => { const id = next++; queued.set(id, callback); return id; }, cancelFrame: id => queued.delete(id), ...options });
  return { loop, queued, step(delta = 16) {
    time += delta;
    const item = queued.entries().next().value;
    assert.ok(item, 'Expected a scheduled frame');
    queued.delete(item[0]); item[1](time);
  } };
}

test('idle viewer renders one invalidation and coalesces repeated input/appearance changes', () => {
  let draws = 0;
  const f = frames(() => { draws++; return false; });
  f.loop.invalidate(); f.loop.invalidate(); f.loop.invalidate();
  assert.equal(f.queued.size, 1); f.step();
  assert.equal(draws, 1); assert.equal(f.queued.size, 0);
  f.loop.invalidate(); f.step();
  assert.equal(draws, 2); assert.equal(f.queued.size, 0);
});

test('damping continues only until controls stop changing', () => {
  let changes = 3, draws = 0;
  const f = frames(() => { draws++; return --changes > 0; });
  f.loop.invalidate(); f.step(); f.step(); f.step();
  assert.equal(draws, 3); assert.equal(f.queued.size, 0);
});

test('a render failure stops scheduling and hands control back to the poster fallback', () => {
  const error = new Error('Context unavailable'); let failure;
  const f = frames(() => { throw error; }, { onError: value => { failure = value; } });
  f.loop.invalidate(); f.step();
  assert.equal(failure, error); assert.equal(f.queued.size, 0);
  f.loop.invalidate(); assert.equal(f.queued.size, 0);
});

test('all activation modes use the same offscreen gate and retain invalidations until visible', () => {
  for (const mode of ['true', 'false', 'visible']) {
    let draws = 0;
    const f = frames(() => { draws++; return false; }, { visible: false });
    f.loop.invalidate(); assert.equal(f.queued.size, 0, mode);
    f.loop.setVisible(true); f.step(); assert.equal(draws, 1, mode);
    f.loop.setVisible(false); f.loop.invalidate(); assert.equal(f.queued.size, 0, mode);
    f.loop.setVisible(true); f.step(); assert.equal(draws, 2, mode);
    f.loop.destroy();
  }
});

test('hidden/offscreen automatic rotation cancels RAF and resumes without a time jump', () => {
  const elapsed = [];
  const f = frames(delta => { elapsed.push(delta); return true; });
  f.loop.invalidate(); f.step(); f.step();
  assert.equal(elapsed[0], 0); assert.ok(elapsed[1] > 0);
  f.loop.setHidden(true); assert.equal(f.queued.size, 0);
  f.loop.invalidate(); assert.equal(f.queued.size, 0);
  f.loop.setHidden(false); f.step(60_000); assert.equal(elapsed.at(-1), 0);
  f.loop.setVisible(false); assert.equal(f.queued.size, 0);
  f.loop.setVisible(true); f.step(60_000); assert.equal(elapsed.at(-1), 0);
  f.loop.destroy(); assert.equal(f.queued.size, 0);
});

test('spatial suspension and restoration cannot restart a hidden or disposed viewer', () => {
  let draws = 0;
  const f = frames(() => { draws++; return false; });
  f.loop.invalidate(); f.loop.setSuspended(true); assert.equal(f.queued.size, 0);
  f.loop.invalidate(); f.loop.setVisible(false); f.loop.setSuspended(false);
  assert.equal(f.queued.size, 0);
  f.loop.setVisible(true); f.step(); assert.equal(draws, 1);
  f.loop.destroy(); f.loop.invalidate(); f.loop.setSuspended(false); f.loop.setVisible(true);
  assert.equal(f.queued.size, 0);
});

test('control input, document visibility and live reduced motion bind and clean up together', () => {
  const controls = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const media = Object.assign(new EventTarget(), { matches: false });
  const lifetime = new AbortController();
  let rotating = true, draws = 0;
  const f = frames(() => { draws++; return rotating; });
  bindViewerRenderEvents({ loop: f.loop, controls, visibilityTarget: doc, media, signal: lifetime.signal, onMotionChange() { rotating = !media.matches; f.loop.invalidate(); } });
  controls.dispatchEvent(new Event('start')); f.step(); assert.equal(f.queued.size, 1);
  media.matches = true; media.dispatchEvent(new Event('change')); f.step();
  assert.equal(f.queued.size, 0, 'Reduced motion settles automatic rotation');
  controls.dispatchEvent(new Event('change')); f.step(); assert.equal(f.queued.size, 0);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  media.matches = false; media.dispatchEvent(new Event('change')); assert.equal(f.queued.size, 0);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); f.step();
  assert.equal(f.queued.size, 1);
  lifetime.abort(); assert.equal(f.queued.size, 0);
  for (const type of ['change', 'start', 'end']) assert.equal(getEventListeners(controls, type).length, 0);
  assert.equal(getEventListeners(doc, 'visibilitychange').length, 0);
  assert.equal(getEventListeners(media, 'change').length, 0);
  const before = draws; controls.dispatchEvent(new Event('start')); media.dispatchEvent(new Event('change'));
  assert.equal(f.queued.size, 0); assert.equal(draws, before);
});

test('already-aborted render bindings register nothing and schedule nothing', () => {
  const controls = new EventTarget(), doc = new EventTarget(), media = new EventTarget();
  const lifetime = new AbortController(); lifetime.abort();
  const f = frames(() => false);
  bindViewerRenderEvents({ loop: f.loop, controls, visibilityTarget: doc, media, signal: lifetime.signal, onMotionChange() {} });
  f.loop.invalidate(); assert.equal(f.queued.size, 0);
  assert.equal(getEventListeners(controls, 'change').length, 0);
});

test('keyboard controls operate the focused surface without hijacking native controls or modifiers', () => {
  const calls = [];
  const actions = { orbit: (...args) => calls.push(['orbit', ...args]), zoom: value => calls.push(['zoom', value]), reset: () => calls.push(['reset']), toggleWireframe: () => calls.push(['wire']) };
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '0', 'Home', 'w']) {
    const event = { key, target: { closest: () => null }, preventDefault() { this.prevented = true; } };
    assert.equal(handleViewerKey(event, actions), true); assert.equal(event.prevented, true);
  }
  assert.deepEqual(calls.slice(0, 4), [['orbit', -1, 0], ['orbit', 1, 0], ['orbit', 0, -1], ['orbit', 0, 1]]);
  const before = calls.length;
  for (const options of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }, { defaultPrevented: true }, { target: { closest: () => ({}) } }]) {
    const event = { key: 'ArrowLeft', preventDefault() { assert.fail('Native input must not be consumed'); }, ...options };
    assert.equal(handleViewerKey(event, actions), false);
  }
  assert.equal(calls.length, before);
});

test('arrow orbit preserves distance/target and clamps at poles and configured angle boundaries', () => {
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1, 4);
  const controls = { enabled: true, target: new THREE.Vector3(.2, .3, .4), minPolarAngle: .2, maxPolarAngle: 2.8, minAzimuthAngle: -.5, maxAzimuthAngle: .5 };
  const target = controls.target.clone(), distance = camera.position.distanceTo(target);
  for (let index = 0; index < 100; index++) orbitViewer(THREE, camera, controls, 1, -1);
  let spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
  assert.ok(Math.abs(spherical.theta - .5) < 1e-10); assert.ok(Math.abs(spherical.phi - .2) < 1e-10);
  for (let index = 0; index < 100; index++) orbitViewer(THREE, camera, controls, -1, 1);
  spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
  assert.ok(Math.abs(spherical.theta + .5) < 1e-10); assert.ok(Math.abs(spherical.phi - 2.8) < 1e-10);
  assert.ok(Math.abs(camera.position.distanceTo(target) - distance) < 1e-10); assert.deepEqual(controls.target, target);
  const before = camera.position.clone(); controls.enabled = false; orbitViewer(THREE, camera, controls, 1, 1); assert.deepEqual(camera.position, before);
});

test('scene teardown disposes shared geometry, textures and alternate wire materials exactly once', () => {
  const calls = [];
  const geometry = { dispose: () => calls.push('geometry') };
  const texture = { isTexture: true, dispose: () => calls.push('texture') };
  const solid = { map: texture, normalMap: texture, dispose: () => calls.push('solid') };
  const wire = { dispose: () => calls.push('wire') };
  const scene = { traverse(callback) { callback({ geometry, material: solid }); callback({ geometry, material: [solid, wire] }); } };
  disposeViewerScene(scene, [solid, [wire]]);
  assert.deepEqual(calls.sort(), ['geometry', 'solid', 'texture', 'wire']);
});

test('AR and photo optional lifecycle signal removes global/control listeners and closes detached dialogs', async t => {
  class Node extends EventTarget {
    constructor() { super(); this.dataset = {}; this.value = 'auto'; this.style = {}; this.open = false; this.hidden = false; this.classList = { add() {}, remove() {} }; }
    setAttribute() {} removeAttribute() {} toggleAttribute() {} focus() {} select() {}
    close() { this.open = false; this.dispatchEvent(new Event('close')); }
  }
  const nodes = new Map(), root = new Node();
  const element = new Node(); element.dataset.title = 'Test work';
  element.querySelector = selector => { if (!nodes.has(selector)) nodes.set(selector, new Node()); return nodes.get(selector); };
  element.querySelectorAll = () => [];
  element.closest = () => root;
  const win = new Node(), xr = new Node();
  const doc = { body: new Node(), querySelector: () => ({ href: 'https://atrium.earth/works/test/' }), createElement: () => ({ relList: { supports: () => false } }) };
  const previous = new Map(['window', 'document', 'navigator', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: win, document: doc, navigator: { userAgent: 'test', platform: 'test', maxTouchPoints: 0, xr }, location: { href: 'https://atrium.earth/works/test/', hash: '' } })) Object.defineProperty(globalThis, key, { value, configurable: true });
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const lifetime = new AbortController(); setMaxListeners(0, lifetime.signal);
  bindSpatialViewing(element, () => undefined, () => {}, { signal: lifetime.signal });
  await Promise.resolve();
  assert.equal(getEventListeners(win, 'hashchange').length, 1);
  assert.equal(getEventListeners(win, 'pagehide').length, 2);
  assert.equal(getEventListeners(xr, 'devicechange').length, 1);
  assert.equal(getEventListeners(root, 'atrium:viewer-ready').length, 1);
  const dialog = element.querySelector('[data-spatial-dialog]'); dialog.open = true;
  lifetime.abort(); assert.equal(dialog.open, false);
  for (const target of [win, xr, root, ...nodes.values()]) for (const type of ['hashchange', 'pagehide', 'devicechange', 'atrium:viewer-ready', 'atrium:viewer-error', 'click', 'change', 'input', 'close', 'cancel', 'beforexrselect']) assert.equal(getEventListeners(target, type).length, 0);
  // Incomplete XR shims need not implement EventTarget at all.
  navigator.xr = {};
  const incomplete = new AbortController(); setMaxListeners(0, incomplete.signal);
  assert.doesNotThrow(() => bindSpatialViewing(element, () => undefined, () => {}, { signal: incomplete.signal }));
  incomplete.abort();
});
