import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners, setMaxListeners } from 'node:events';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createViewerRenderLoop, bindViewerRenderEvents } from '../src/lib/viewer-render-loop.mjs';
import { bindViewerInput, bindViewerZoom, createRotationHold, createTouchGesture, handleViewerKey, orbitViewer } from '../src/lib/viewer-input.mjs';
import { disposeViewerScene } from '../src/lib/viewer-resources.mjs';
import { bindSpatialViewing } from '../src/lib/spatial-viewer.mjs';
import { AUTO_START_MODEL_LIMIT, previewStartMode } from '../src/lib/viewer-preview.mjs';

test('only known model sizes at or below 3 MB can start automatically', () => {
  for (const mode of [true, 'preview', 'visible']) {
    assert.equal(previewStartMode(mode, AUTO_START_MODEL_LIMIT), mode);
    for (const size of [AUTO_START_MODEL_LIMIT + 1, undefined, 0, -1, NaN, 2.5]) {
      assert.equal(previewStartMode(mode, size), false);
    }
  }
  assert.equal(previewStartMode(false, 1), false);
});

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

test('touch direction stays vertical or sideways for the whole finger sequence', () => {
  const touch = createTouchGesture();
  touch.begin(10, 10, false);
  assert.equal(touch.move(11, 11), 'pending');
  assert.equal(touch.move(12, 18), 'page');
  assert.equal(touch.move(70, 20), 'page');
  touch.end();
  touch.begin(10, 10, false);
  assert.equal(touch.move(18, 12), 'sculpture');
  assert.equal(touch.move(20, 70), 'sculpture');
  touch.end();
  touch.begin(10, 10, false);
  assert.equal(touch.move(13, 13), 'sculpture', 'ties orbit');
});

test('two fingers, cancellation and fullscreen have explicit touch ownership', () => {
  const touch = createTouchGesture();
  touch.begin(10, 10, false);
  touch.addFinger();
  assert.equal(touch.move(10, 35), 'sculpture');
  touch.end();
  assert.equal(touch.move(10, 35), null);
  touch.begin(10, 10, true);
  assert.equal(touch.move(10, 11), 'sculpture');
  touch.end();
  touch.begin(10, 10, false);
  assert.equal(touch.move(10, 35), 'page');
});

test('rotation waits until the last input has been idle for four seconds', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const lifetime = new AbortController();
  let changes = 0;
  const hold = createRotationHold(lifetime.signal, () => changes++);
  assert.equal(hold.held, false);
  hold.setInteracting(true);
  t.mock.timers.tick(5000);
  assert.equal(hold.held, true);
  hold.setInteracting(false);
  t.mock.timers.tick(3999);
  hold.noteInput();
  t.mock.timers.tick(3999);
  assert.equal(hold.held, true);
  t.mock.timers.tick(1);
  assert.equal(hold.held, false);
  assert.equal(changes, 2);
  hold.noteInput();
  lifetime.abort();
  t.mock.timers.tick(4000);
  assert.equal(changes, 3);
});

function inputFixture(t, wheelZoom = true) {
  const document = new EventTarget();
  // Node EventTarget has no capture phase. Run document and canvas capture
  // handlers before the OrbitControls listeners to mirror browser dispatch.
  function withCapture(target) {
    const capture = new EventTarget();
    const add = target.addEventListener.bind(target);
    target.addEventListener = (type, handler, options) => (options?.capture ? capture.addEventListener(type, handler, options) : add(type, handler, options));
    return capture;
  }
  const documentCapture = withCapture(document);
  const canvas = Object.assign(new EventTarget(), {
    ownerDocument: document, style: {}, clientHeight: 300, getRootNode: () => document,
    setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture() { return false; },
  });
  const canvasCapture = withCapture(canvas);
  const lifetime = new AbortController();
  setMaxListeners(0, lifetime.signal);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 4);
  const controls = new OrbitControls(camera, canvas);
  const interactions = [], factors = [];
  let resets = 0, turns = 0, discarded = 0, time = 0;
  bindViewerZoom({ canvas, signal: lifetime.signal, canHandle: () => wheelZoom && controls.enabled, onZoom: factor => factors.push(factor) });
  const input = bindViewerInput({
    canvas, controls, signal: lifetime.signal, wheelZoom,
    onInteraction: next => interactions.push(next), onWheel() {},
    onTurn: () => turns++, onReset: () => resets++, onDiscardInertia: () => discarded++,
  });
  t.after(() => { lifetime.abort(); controls.dispose(); });
  function pointer(type, { pointerType = 'touch', id = 1, x = 10, y = 10, button = 0, elapsed = 10 } = {}) {
    time += elapsed;
    const event = Object.assign(new Event(type), { pointerType, pointerId: id, button, clientX: x, clientY: y, pageX: x, pageY: y });
    Object.defineProperty(event, 'timeStamp', { value: time });
    documentCapture.dispatchEvent(event);
    if (type === 'pointerdown' || type === 'pointercancel') {
      canvasCapture.dispatchEvent(event);
      canvas.dispatchEvent(event);
    } else document.dispatchEvent(event);
  }
  const tap = point => { pointer('pointerdown', point); pointer('pointerup', point); };
  const wheel = (modifiers = {}) => {
    const event = Object.assign(new Event('wheel', { cancelable: true }), { deltaY: 120, deltaMode: 0, clientX: 10, clientY: 10, ...modifiers });
    let stopped = false;
    const stop = event.stopImmediatePropagation.bind(event);
    event.stopImmediatePropagation = () => { stopped = true; stop(); };
    canvasCapture.dispatchEvent(event);
    if (!stopped) canvas.dispatchEvent(event);
    return event.defaultPrevented;
  };
  function touchmove(x, y, cancelable = true) {
    const event = Object.assign(new Event('touchmove', { cancelable }), { touches: [{clientX: x, clientY: y}] });
    canvas.dispatchEvent(event);
    return event.defaultPrevented;
  }
  return { canvas, canvasCapture, document, documentCapture, lifetime, controls, camera, input, interactions, factors, pointer, tap, wheel, touchmove,
    get resets() { return resets; }, get turns() { return turns; }, get discarded() { return discarded; } };
}

test('the canvas gives vertical flicks to the page and keeps a sideways turn claimed', t => {
  const v = inputFixture(t);
  const original = v.camera.position.clone();
  assert.equal(v.canvas.style.touchAction, 'pan-y');
  v.pointer('pointerdown');
  v.pointer('pointermove', { y: 40, x: 14 });
  assert.equal(v.touchmove(14, 40), false);
  assert.ok(v.camera.position.distanceTo(original) < 1e-10);
  v.pointer('pointercancel');
  assert.equal(v.discarded, 2);
  assert.deepEqual(v.interactions, [true, false]);

  v.pointer('pointerdown');
  v.pointer('pointermove', { x: 40, y: 14 });
  assert.equal(v.touchmove(40, 14), true);
  assert.ok(v.camera.position.distanceTo(original) > .01);
  const beforeTilt = v.camera.position.clone();
  v.pointer('pointermove', { x: 40, y: 60 });
  assert.equal(v.touchmove(40, 60), true);
  assert.equal(v.touchmove(40, 60, false), false, 'Do not prevent a non-cancelable touchmove');
  assert.notEqual(v.camera.position.y, beforeTilt.y);
  v.pointer('pointerup', { x: 40, y: 60 });
  assert.equal(v.resets, 0);
  assert.ok(v.turns >= 2);
});

test('only double gestures reset the sculpture', t => {
  const v = inputFixture(t);
  v.tap();
  assert.equal(v.resets, 0);
  v.tap();
  assert.equal(v.resets, 1);
  v.canvasCapture.dispatchEvent(Object.assign(new Event('dblclick'), { sourceCapabilities: { firesTouchEvents: true } }));
  assert.equal(v.resets, 1);
  v.canvasCapture.dispatchEvent(new Event('dblclick'));
  assert.equal(v.resets, 2);
  v.tap({elapsed: 400});
  v.pointer('pointerdown', {x: 80});
  v.pointer('pointermove', {x: 90});
  v.pointer('pointerup', {x: 90});
  v.tap({x: 90});
  assert.equal(v.resets, 2);
});

test('a native scroll keeps rotation on hold until the thumb lifts', t => {
  const v = inputFixture(t);
  v.pointer('pointerdown');
  v.canvasCapture.dispatchEvent(Object.assign(new Event('touchstart'), { targetTouches: [{}] }));
  v.pointer('pointermove', { y: 40 });
  v.pointer('pointercancel');
  assert.deepEqual(v.interactions, [true]);
  v.canvasCapture.dispatchEvent(Object.assign(new Event('touchend'), { targetTouches: [] }));
  assert.deepEqual(v.interactions, [true, false]);
});

test('unmodified wheel scrolls the page unless fullscreen and wheel zoom is enabled', t => {
  const v = inputFixture(t);
  assert.equal(v.wheel(), false);
  assert.equal(v.wheel({ctrlKey: true}), true);
  assert.equal(v.wheel({metaKey: true}), true);
  v.input.setFullscreen(true);
  assert.equal(v.canvas.style.touchAction, 'none');
  assert.equal(v.wheel(), true);
  const before = v.camera.position.clone();
  v.pointer('pointerdown');
  v.pointer('pointermove', {y: 40});
  assert.ok(v.camera.position.distanceTo(before) > .01);
  v.pointer('pointerup', {y: 40});
  v.input.setFullscreen(false);
  assert.equal(v.canvas.style.touchAction, 'pan-y');
  assert.equal(v.wheel(), false);

  const disabled = inputFixture(t, false);
  for (const fullscreen of [true, false]) {
    disabled.input.setFullscreen(fullscreen);
    assert.equal(disabled.wheel(), false);
    assert.equal(disabled.wheel({ctrlKey: true}), false);
    assert.equal(disabled.wheel({metaKey: true}), false);
  }
});

function dispatchGesture(target, type, scale, cancelable = true) {
  const event = Object.assign(new Event(type, { cancelable }), { scale });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

test('Safari trackpad scale zooms the sculpture without duplicate Ctrl-wheel', t => {
  const v = inputFixture(t);
  let wheelEvents = 0;
  v.canvas.addEventListener('wheel', () => wheelEvents++);
  const start = () => dispatchGesture(v.canvasCapture, 'gesturestart', 1);
  const change = scale => dispatchGesture(v.canvasCapture, 'gesturechange', scale);
  assert.equal(v.wheel({ ctrlKey: true }), true);
  assert.equal(wheelEvents, 1);
  assert.equal(start(), true);
  assert.equal(change(1.25), true);
  assert.equal(change(0), true);
  assert.equal(change(1.5), true);
  assert.deepEqual(v.factors, [.8, 1.25 / 1.5]);
  assert.equal(v.wheel({ ctrlKey: true }), true);
  assert.equal(wheelEvents, 1);
  assert.equal(dispatchGesture(v.canvasCapture, 'gestureend', 1.5), true);
  assert.equal(change(2), false);
  assert.equal(v.wheel({ ctrlKey: true }), true);
  assert.equal(wheelEvents, 2);
});

test('touchscreen pinch stays with OrbitControls, including in wheel-disabled viewers', t => {
  const v = inputFixture(t, false);
  v.pointer('pointerdown');
  v.pointer('pointerdown', { id: 2, x: 50 });
  const before = v.camera.position.distanceTo(v.controls.target);
  assert.equal(dispatchGesture(v.canvasCapture, 'gesturestart', 1), false);
  assert.equal(dispatchGesture(v.canvasCapture, 'gesturechange', 1.3), false);
  v.pointer('pointermove', { id: 2, x: 72 });
  assert.notEqual(v.camera.position.distanceTo(v.controls.target), before);
  v.pointer('pointerup', { id: 2, x: 72 });
  v.pointer('pointerup');
  assert.equal(v.resets, 0);
  v.lifetime.abort();
  assert.equal(getEventListeners(v.canvasCapture, 'gesturestart').length, 0);
  assert.equal(getEventListeners(v.canvasCapture, 'wheel').length, 0);
  assert.equal(getEventListeners(v.documentCapture, 'pointermove').length, 0);
  assert.deepEqual(v.factors, []);
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
