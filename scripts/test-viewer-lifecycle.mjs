import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners, setMaxListeners } from 'node:events';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createViewerRenderLoop, bindViewerRenderEvents } from '../src/lib/viewer-render-loop.mjs';
import { bindViewerInput, bindViewerReset, bindViewerZoom, handleViewerKey, orbitViewer } from '../src/lib/viewer-input.mjs';
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
  const f = frames(() => { throw error; }, {
    onError: value => { failure = value; },
    onFirstFrame: () => assert.fail('A failed draw must leave the poster in place'),
  });
  f.loop.invalidate(); f.step();
  assert.equal(failure, error); assert.equal(f.queued.size, 0);
  f.loop.invalidate(); assert.equal(f.queued.size, 0);
});

test('first-frame readiness waits for a successful visible draw and fires once per viewer', () => {
  const calls = [];
  const f = frames(() => { calls.push('draw'); return true; }, {
    visible: false, onFirstFrame: () => calls.push('ready'),
  });
  f.loop.invalidate();
  assert.deepEqual(calls, []);
  f.loop.setVisible(true);
  f.step(); f.step();
  assert.deepEqual(calls, ['draw', 'ready', 'draw']);
  f.loop.destroy();
});

test('touch double-tap and native mouse double-click reset the live sculpture', () => {
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), { ownerDocument: document });
  const lifetime = new AbortController();
  let resets = 0;
  bindViewerReset(canvas, () => { resets++; }, lifetime.signal);
  const pointer = (type, time, { id = 1, x = 10, y = 10 } = {}) => {
    const event = Object.assign(new Event(type), { pointerType: 'touch', pointerId: id, button: 0, clientX: x, clientY: y });
    Object.defineProperty(event, 'timeStamp', { value: time });
    const target = type === 'pointerdown' ? canvas : document;
    target.dispatchEvent(event);
  };
  const tap = (time, point) => { pointer('pointerdown', time, point); pointer('pointerup', time + 10, point); };

  tap(10);
  tap(100);
  assert.equal(resets, 1);
  canvas.dispatchEvent(Object.assign(new Event('dblclick'), { sourceCapabilities: { firesTouchEvents: true } }));
  assert.equal(resets, 1, 'Do not reset twice on a browser-generated touch double-click');
  canvas.dispatchEvent(new Event('dblclick'));
  assert.equal(resets, 2);
  tap(500);
  tap(900);
  tap(980, { x: 70 });
  assert.equal(resets, 2, 'Ignore taps outside the time or distance threshold');

  pointer('pointerdown', 1200);
  pointer('pointermove', 1210, { x: 30 });
  pointer('pointerup', 1220);
  tap(1260);
  assert.equal(resets, 2, 'Dragging cannot be the first tap');
  pointer('pointerdown', 1300);
  pointer('pointerdown', 1310, { id: 2 });
  pointer('pointerup', 1320, { id: 2 });
  pointer('pointerup', 1330);
  tap(1380);
  assert.equal(resets, 2, 'Pinching cannot count as taps');

  lifetime.abort();
  canvas.dispatchEvent(new Event('dblclick'));
  assert.equal(resets, 2);
});

function toggleFixture(t, wheelZoom = true, initiallyActive = true) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const document = new EventTarget();
  // Node's EventTarget doesn't separate capture and target listeners. Model
  // capture-first dispatch explicitly so Three sees only unfiltered wheel events.
  const capture = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    ownerDocument: document, style: {}, clientHeight: 300,
    getRootNode: () => document, setPointerCapture() {}, releasePointerCapture() {},
  });
  canvas.addEventListener = (type, callback, options) => {
    if (type === 'wheel' && options?.capture) capture.addEventListener(type, callback, options);
    else EventTarget.prototype.addEventListener.call(canvas, type, callback, options);
  };
  const lifetime = new AbortController();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 4);
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = wheelZoom;
  controls.rotateSpeed = .9;
  const changes = [];
  let resets = 0, time = 0;
  const input = bindViewerInput({
    canvas, controls, signal: lifetime.signal, wheelZoom, initiallyActive,
    onToggle: value => changes.push(value), onReset: () => { resets++; },
  });
  t.after(() => { lifetime.abort(); controls.dispose(); });
  function pointer(type, { pointerType = 'mouse', id = 1, x = 10, y = 10, button = 0, elapsed = 10 } = {}) {
    time += elapsed;
    const event = Object.assign(new Event(type), { pointerType, pointerId: id, button, clientX: x, clientY: y, pageX: x, pageY: y });
    Object.defineProperty(event, 'timeStamp', { value: time });
    (type === 'pointerdown' ? canvas : document).dispatchEvent(event);
    // A capture-target pointercancel also reaches Three's canvas listener.
    if (type === 'pointercancel') canvas.dispatchEvent(event);
  }
  const tap = point => { pointer('pointerdown', point); pointer('pointerup', point); };
  const wheel = (modifiers = {}) => {
    const event = Object.assign(new Event('wheel', { cancelable: true }), { deltaY: 120, deltaMode: 0, clientX: 10, clientY: 10, ...modifiers });
    let stopped = false;
    event.stopImmediatePropagation = () => { stopped = true; };
    capture.dispatchEvent(event);
    if (!stopped) canvas.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { canvas, capture, document, lifetime, controls, camera, input, changes, pointer, tap, wheel, get resets() { return resets; } };
}

test('a rotating preview can start in page-scroll mode and enter handling on tap', t => {
  const v = toggleFixture(t, true, false);
  assert.equal(v.input.isActive(), false);
  assert.equal(v.canvas.style.touchAction, 'pan-y');
  assert.equal(v.wheel(), false);
  v.tap();
  t.mock.timers.tick(340);
  assert.equal(v.input.isActive(), true);
  assert.equal(v.canvas.style.touchAction, 'none');
  assert.equal(v.wheel(), true);
  assert.deepEqual(v.changes, [true]);
});

test('manual viewer clicks pause and resume handling while leaving page wheel available when paused', t => {
  const v = toggleFixture(t);
  assert.equal(v.input.isActive(), true);
  assert.equal(v.canvas.style.touchAction, 'none');
  assert.equal(v.wheel(), true);
  v.tap();
  t.mock.timers.tick(339);
  assert.equal(v.input.isActive(), true);
  t.mock.timers.tick(1);
  assert.equal(v.input.isActive(), false);
  assert.equal(v.canvas.style.touchAction, 'pan-y');
  assert.equal(v.controls.enableZoom, false);
  assert.equal(v.controls.enablePan, false);
  assert.equal(v.controls.enabled, true);
  assert.equal(v.wheel(), false);

  v.pointer('pointerdown', { pointerType: 'touch' });
  v.pointer('pointermove', { pointerType: 'touch', y: 50 });
  v.pointer('pointercancel', { pointerType: 'touch', y: 50 });
  t.mock.timers.tick(340);
  assert.equal(v.input.isActive(), false, 'Vertical swipe cannot resume handling');
  v.tap({ pointerType: 'touch' });
  t.mock.timers.tick(340);
  assert.equal(v.input.isActive(), true);
  assert.equal(v.controls.rotateSpeed, .9);
  assert.equal(v.controls.enablePan, true);
  assert.deepEqual(v.changes, [false, true]);
});

test('drag and pinch still move the sculpture and neither toggles the viewer', t => {
  const v = toggleFixture(t, false);
  assert.equal(v.wheel(), false, 'Comparison can leave the page wheel available');
  const before = v.camera.position.clone();
  v.pointer('pointerdown');
  v.pointer('pointermove', { x: 30 });
  v.pointer('pointerup', { x: 10 });
  assert.ok(v.camera.position.distanceTo(before) > .01);
  v.pointer('pointerdown', { pointerType: 'touch' });
  v.pointer('pointerdown', { pointerType: 'touch', id: 2, x: 50 });
  const distance = v.camera.position.distanceTo(v.controls.target);
  v.pointer('pointermove', { pointerType: 'touch', id: 2, x: 72 });
  assert.notEqual(v.camera.position.distanceTo(v.controls.target), distance);
  v.pointer('pointerup', { pointerType: 'touch', id: 2, x: 72 });
  v.pointer('pointerup', { pointerType: 'touch' });
  t.mock.timers.tick(340);
  assert.equal(v.resets, 0);
  assert.deepEqual(v.changes, []);
});

test('double-click and double-tap reset without toggling either handling state', t => {
  const v = toggleFixture(t);
  v.tap();
  t.mock.timers.tick(100);
  v.tap();
  v.canvas.dispatchEvent(new Event('dblclick'));
  t.mock.timers.tick(400);
  assert.equal(v.resets, 1);
  assert.deepEqual(v.changes, []);

  v.input.setActive(false);
  v.tap({ pointerType: 'touch', elapsed: 400 });
  t.mock.timers.tick(100);
  v.tap({ pointerType: 'touch' });
  t.mock.timers.tick(400);
  assert.equal(v.resets, 2);
  assert.equal(v.input.isActive(), false);
  assert.deepEqual(v.changes, [false]);
});

test('explicit mode change and disposal cancel pending single click', t => {
  const v = toggleFixture(t);
  v.tap();
  v.input.setActive(true);
  t.mock.timers.tick(400);
  assert.deepEqual(v.changes, []);
  v.tap();
  v.lifetime.abort();
  t.mock.timers.tick(400);
  v.input.setActive(false);
  assert.deepEqual(v.changes, []);
  assert.equal(getEventListeners(v.capture, 'wheel').length, 0);
  assert.equal(getEventListeners(v.canvas, 'wheel').length, 1, 'Only Three’s wheel listener remains');
  assert.equal(getEventListeners(v.document, 'pointermove').length, 0);
});

function dispatchGesture(target, type, scale, cancelable = true) {
  const event = Object.assign(new Event(type, { cancelable }), { scale });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

test('Safari trackpad scale produces incremental sculpture zoom and de-duplicates Ctrl-wheel', t => {
  const v = toggleFixture(t);
  const factors = [];
  bindViewerZoom({ canvas: v.canvas, signal: v.lifetime.signal, canHandle: v.input.isActive, onZoom: factor => factors.push(factor) });
  let wheelEvents = 0;
  v.canvas.addEventListener('wheel', () => { wheelEvents++; });
  const start = () => dispatchGesture(v.canvas, 'gesturestart', 1);
  const change = scale => dispatchGesture(v.canvas, 'gesturechange', scale);
  assert.equal(v.wheel({ ctrlKey: true }), true, 'Native Ctrl-wheel reaches OrbitControls');
  assert.equal(wheelEvents, 1);
  assert.equal(start(), true);
  assert.equal(change(1.25), true);
  assert.equal(change(1.25), true);
  assert.equal(change(0), true);
  assert.equal(change(1.5), true);
  assert.deepEqual(factors, [.8, 1.25 / 1.5]);
  assert.equal(v.wheel({ ctrlKey: true }), true, 'Duplicate Ctrl-wheel default is prevented');
  assert.equal(wheelEvents, 1, 'Duplicate Ctrl-wheel does not reach OrbitControls');
  assert.equal(v.wheel(), true);
  assert.equal(wheelEvents, 2, 'Ordinary active wheel retains original behavior');
  assert.equal(dispatchGesture(v.canvas, 'gestureend', 1.5), true);
  assert.equal(change(2), false, 'Stray change cannot acquire a gesture');
  assert.equal(v.wheel({ ctrlKey: true }), true);
  assert.equal(wheelEvents, 3);
});

test('paused and off-canvas gestures leave browser zoom available', t => {
  const v = toggleFixture(t);
  const factors = [];
  bindViewerZoom({ canvas: v.canvas, signal: v.lifetime.signal, canHandle: v.input.isActive, onZoom: factor => factors.push(factor) });
  assert.equal(dispatchGesture(v.document, 'gesturestart', 1), false);
  assert.equal(dispatchGesture(v.canvas, 'gesturechange', 1.3), false);
  assert.equal(dispatchGesture(v.canvas, 'gesturestart', 1), true);
  v.input.setActive(false);
  assert.equal(dispatchGesture(v.canvas, 'gesturechange', 1.3), false);
  assert.equal(dispatchGesture(v.canvas, 'gesturestart', 1), false);
  assert.equal(v.wheel({ ctrlKey: true }), false);
  v.input.setActive(true);
  assert.equal(dispatchGesture(v.canvas, 'gesturechange', 1.5), false, 'A paused sequence cannot resume mid-gesture');
  assert.equal(dispatchGesture(v.canvas, 'gesturestart', 1, false), false);
  assert.equal(dispatchGesture(v.canvas, 'gesturechange', 1.5), false);
  assert.deepEqual(factors, []);
});

test('Safari gesture bridge leaves touchscreen pointer pinch to Three and detaches on disposal', t => {
  const v = toggleFixture(t);
  const factors = [];
  bindViewerZoom({ canvas: v.canvas, signal: v.lifetime.signal, canHandle: v.input.isActive, onZoom: factor => factors.push(factor) });
  v.pointer('pointerdown', { pointerType: 'touch' });
  v.pointer('pointerdown', { pointerType: 'touch', id: 2, x: 50 });
  const before = v.camera.position.distanceTo(v.controls.target);
  assert.equal(dispatchGesture(v.canvas, 'gesturestart', 1), false);
  assert.equal(dispatchGesture(v.canvas, 'gesturechange', 1.3), false);
  v.pointer('pointermove', { pointerType: 'touch', id: 2, x: 72 });
  assert.notEqual(v.camera.position.distanceTo(v.controls.target), before);
  v.pointer('pointerup', { pointerType: 'touch', id: 2 });
  v.pointer('pointerup', { pointerType: 'touch' });
  assert.equal(dispatchGesture(v.canvas, 'gesturestart', 1), true);
  assert.equal(dispatchGesture(v.document, 'gestureend', 1), false, 'Ending off-canvas relinquishes ownership');
  assert.equal(dispatchGesture(v.canvas, 'gesturechange', 1.3), false);
  assert.equal(dispatchGesture(v.canvas, 'gesturestart', 1), true);
  v.lifetime.abort();
  assert.equal(dispatchGesture(v.canvas, 'gesturechange', 1.3), false);
  assert.equal(getEventListeners(v.canvas, 'gesturestart').length, 0);
  assert.equal(getEventListeners(v.document, 'gestureend').length, 0);
  assert.equal(getEventListeners(v.capture, 'wheel').length, 0);
  assert.deepEqual(factors, []);
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
