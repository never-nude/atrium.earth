import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners, setMaxListeners } from 'node:events';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createViewerRenderLoop, bindViewerRenderEvents } from '../src/lib/viewer-render-loop.mjs';
import { bindViewerGestures, handleViewerKey, orbitViewer, RELEASE_AFTER_MS } from '../src/lib/viewer-input.mjs';
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

function gesturePage() {
  const observers = new Set();
  const document = Object.assign(new EventTarget(), { fullscreenElement: null });
  document.defaultView = Object.assign(new EventTarget(), {
    IntersectionObserver: class {
      constructor(callback, { threshold }) {
        assert.equal(threshold, .4);
        this.notify = ratio => callback([{ intersectionRatio: ratio }]);
      }
      observe() { observers.add(this); }
      disconnect() { observers.delete(this); }
    },
  });
  return {
    document,
    observers,
    nativeFullscreen(root) {
      document.fullscreenElement = root;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
  };
}

function gestureViewer(t, { enabled = true, wheelZoom = true, page = gesturePage() } = {}) {
  const { document } = page;
  const stage = new EventTarget(), attributes = new Set(), fading = new Set();
  const canvas = Object.assign(new EventTarget(), {
    ownerDocument: document, style: {}, clientWidth: 300, clientHeight: 300,
    setPointerCapture() {}, releasePointerCapture() {}, getRootNode: () => document,
  });
  const root = Object.assign(new EventTarget(), {
    querySelector: () => ({ classList: fading }),
    toggleAttribute: (name, active) => active ? attributes.add(name) : attributes.delete(name),
    contains: target => [root, stage, canvas].includes(target),
  });
  // DOMTokenList.remove() has the same effect as deleting this set member.
  fading.remove = name => fading.delete(name);
  const lifetime = new AbortController();
  setMaxListeners(0, lifetime.signal);
  const states = [];
  let selections = 0, resets = 0, time = 0;
  const gate = bindViewerGestures({
    canvas, stage, root, signal: lifetime.signal, wheelZoom, enabled,
    onSelect: () => { selections++; },
    onReset: () => { resets++; },
    onStateChange: state => states.push(state),
  });
  const controls = { enabled: true };
  gate.setControls(controls);
  t.after(() => lifetime.abort());

  function pointer(type, { pointerType = 'touch', id = 1, x = 0, y = 0, button = 0, delta = 20, target, ...rest } = {}) {
    time += delta;
    const event = Object.assign(new Event(type), { pointerType, pointerId: id, button, clientX: x, clientY: y, pageX: x, pageY: y, ...rest });
    Object.defineProperty(event, 'timeStamp', { value: time });
    (target ?? (type === 'pointerdown' ? canvas : document)).dispatchEvent(event);
  }
  const tap = options => { pointer('pointerdown', options); pointer('pointerup', options); };
  const wheel = (modifiers = {}) => {
    const event = Object.assign(new Event('wheel', { cancelable: true }), modifiers);
    canvas.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { page, canvas, root, stage, gate, controls, attributes, fading, states, lifetime, pointer, tap, wheel, get selections() { return selections; }, get resets() { return resets; } };
}

test('unselected wheel keeps browser defaults; selected and fullscreen grant ordinary sculpture wheel', t => {
  const v = gestureViewer(t);
  let dolly = 0;
  v.canvas.addEventListener('wheel', event => { dolly++; event.preventDefault(); });
  assert.equal(v.controls.enabled, true);
  assert.equal(v.canvas.style.touchAction, 'pan-y');
  assert.equal(v.wheel(), false);
  v.tap();
  assert.equal(v.wheel(), true);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) assert.equal(v.wheel({ [modifier]: true }), false);
  v.gate.deselect();
  v.page.nativeFullscreen({});
  assert.equal(v.wheel(), false, 'An unrelated fullscreen element should have no effect');
  v.page.nativeFullscreen(v.root);
  assert.equal(v.wheel(), true);
  v.page.nativeFullscreen(null);
  assert.equal(v.wheel(), false);
  assert.equal(dolly, 2);

  const hero = gestureViewer(t, { wheelZoom: false });
  hero.canvas.addEventListener('wheel', event => event.preventDefault());
  hero.tap();
  assert.equal(hero.wheel(), false);
  assert.equal(hero.controls.enableZoom, true, 'Keep two-finger zoom available');
});

test('OrbitControls tracks an unselected drag and receives the same pointer when handling starts', t => {
  const v = gestureViewer(t);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 4);
  const controls = new OrbitControls(camera, v.canvas);
  t.after(() => controls.dispose());
  assert.equal(v.canvas.style.touchAction, 'none', 'Three overrides touch-action when it connects');
  v.gate.setControls(controls);
  assert.equal(v.canvas.style.touchAction, 'pan-y');
  assert.equal(controls.rotateSpeed, 0);
  assert.equal(controls.enableZoom, false);
  assert.equal(controls.enablePan, false);

  v.pointer('pointerdown');
  v.pointer('pointermove', { x: 5 });
  assert.equal(v.gate.isSelected(), false);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(0, 0, 4)) < 1e-9);
  v.pointer('pointermove', { x: 10 });
  assert.equal(v.gate.isSelected(), true);
  assert.equal(controls.rotateSpeed, .9);
  assert.equal(controls.enablePan, true);
  assert.ok(Math.abs(camera.position.x) > 0, 'The threshold-crossing movement reaches OrbitControls');
  v.pointer('pointerup', { x: 10 });

  v.gate.deselect();
  v.pointer('pointerdown');
  v.pointer('pointerdown', { id: 2, x: 50 });
  assert.equal(v.gate.isSelected(), true, 'Enable dolly before Three receives finger two');
  const distance = camera.position.distanceTo(controls.target);
  v.pointer('pointermove', { id: 2, x: 75 });
  assert.notEqual(camera.position.distanceTo(controls.target), distance);
  v.pointer('pointerup', { id: 2, x: 75 });
  v.pointer('pointerup');
});

test('tap selection has no press timeout; vertical swipes and cancelled pointers cannot tap', t => {
  const v = gestureViewer(t, { enabled: false });
  v.tap();
  assert.equal(v.selections, 0, 'Do not handle the sculpture before it is live');
  v.gate.setEnabled(true);
  v.pointer('pointerdown');
  v.pointer('pointermove', { x: 4, y: 20 });
  assert.equal(v.selections, 0);
  v.pointer('pointercancel', { x: 4, y: 20 });
  v.pointer('pointerup');
  assert.equal(v.selections, 0);
  v.pointer('pointerdown');
  v.pointer('pointerup', { delta: 4000 });
  assert.equal(v.selections, 1);
  assert.equal(v.attributes.has('data-selected'), true);
  v.gate.setEnabled(false);
  assert.equal(v.attributes.has('data-selected'), false);
  assert.equal(v.canvas.style.touchAction, 'pan-y');
  assert.equal(v.controls.enabled, true, 'The gesture gate does not own OrbitControls lifecycle');
});

test('pointer double-tap and double-click reset only within the time and distance limits', t => {
  const v = gestureViewer(t);
  v.tap({ x: 15 });
  v.tap({ x: 30 });
  assert.equal(v.resets, 1);
  v.tap({ x: 15, delta: 400 });
  v.tap({ x: 56 });
  assert.equal(v.resets, 1);
  v.tap({ x: 56, delta: 350 });
  assert.equal(v.resets, 1);
  v.pointer('pointerdown', { x: 56 });
  v.pointer('pointermove', { x: 69 });
  v.pointer('pointerup', { x: 56 });
  v.tap({ x: 56 });
  assert.equal(v.resets, 1, 'A drag that returns to its start is still not a tap');
  v.gate.deselect();
  v.pointer('pointerdown', { pointerType: 'mouse' });
  v.pointer('pointermove', { pointerType: 'mouse', x: 1 });
  assert.equal(v.gate.isSelected(), true);
  v.pointer('pointerup', { pointerType: 'mouse', x: 1 });
  v.tap({ pointerType: 'mouse' });
  v.tap({ pointerType: 'mouse' });
  assert.equal(v.resets, 2);
});

test('selection is exclusive and releases on Escape, outside interaction, scroll and visibility', t => {
  const page = gesturePage();
  const first = gestureViewer(t, { page });
  const second = gestureViewer(t, { page });
  const { document } = page;
  first.tap();
  second.tap();
  assert.equal(first.gate.isSelected(), false);
  assert.equal(second.gate.isSelected(), true);

  const expectRelease = trigger => {
    first.tap();
    assert.equal(first.gate.isSelected(), true);
    trigger();
    assert.equal(first.gate.isSelected(), false);
  };
  expectRelease(() => document.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' })));
  expectRelease(() => first.pointer('pointerdown', { target: document }));
  expectRelease(() => document.defaultView.dispatchEvent(new Event('scroll')));
  expectRelease(() => { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  document.hidden = false;
  expectRelease(() => page.observers.values().next().value.notify(.39));
  expectRelease(() => first.pointer('pointerleave', { pointerType: 'mouse', target: first.root, buttons: 0 }));
  first.tap();
  first.pointer('pointerleave', { pointerType: 'mouse', target: first.stage, buttons: 0, relatedTarget: first.root });
  assert.equal(first.gate.isSelected(), true, 'Moving toward caption buttons keeps selection');
  first.pointer('pointerdown');
  document.defaultView.dispatchEvent(new Event('scroll'));
  assert.equal(first.gate.isSelected(), true, 'Scroll cannot discard a live gesture');
  first.pointer('pointercancel');
  document.defaultView.dispatchEvent(new Event('scroll'));
  assert.equal(first.gate.isSelected(), false);
});

test('selection ring fades for its final 1.5 seconds and renews on interaction until release', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const v = gestureViewer(t);
  v.tap();
  t.mock.timers.tick(RELEASE_AFTER_MS - 1500 - 1);
  assert.equal(v.fading.size, 0);
  t.mock.timers.tick(1);
  assert.equal(v.fading.has('is-fading'), true);
  v.gate.interact();
  assert.equal(v.fading.size, 0);
  t.mock.timers.tick(RELEASE_AFTER_MS - 1);
  assert.equal(v.gate.isSelected(), true);
  assert.equal(v.fading.has('is-fading'), true);
  t.mock.timers.tick(1);
  assert.equal(v.gate.isSelected(), false);
  assert.equal(v.fading.size, 0);
  v.pointer('pointerdown');
  v.pointer('pointermove', { x: 15 });
  t.mock.timers.tick(RELEASE_AFTER_MS * 2);
  assert.equal(v.gate.isSelected(), true, 'An active pointer suppresses idle release');
  v.pointer('pointerup', { x: 15 });
  t.mock.timers.tick(RELEASE_AFTER_MS);
  assert.equal(v.gate.isSelected(), false);
});

test('native and overlay fullscreen transitions are idempotent and return to unselected', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const v = gestureViewer(t);
  v.tap();
  v.page.nativeFullscreen(v.root);
  assert.deepEqual(v.states, [{ selected: true, fullscreen: false }, { selected: false, fullscreen: true }]);
  assert.equal(v.attributes.has('data-selected'), false);
  assert.equal(v.controls.rotateSpeed, .9);
  t.mock.timers.tick(RELEASE_AFTER_MS * 2);
  assert.equal(v.fading.size, 0);
  assert.equal(v.controls.enablePan, true);
  v.page.nativeFullscreen(v.root);
  v.page.nativeFullscreen(null);
  assert.deepEqual(v.states.at(-1), { selected: false, fullscreen: false });
  assert.equal(v.states.length, 3);
  assert.equal(v.canvas.style.touchAction, 'pan-y');

  v.gate.setFullscreen(true);
  v.gate.setFullscreen(true);
  v.page.nativeFullscreen({});
  v.page.nativeFullscreen(null);
  assert.equal(v.states.length, 4);
  assert.equal(v.gate.isFullscreen(), true);
  assert.equal(v.controls.enableZoom, true);
  v.gate.setFullscreen(false);
  assert.deepEqual(v.states.at(-1), { selected: false, fullscreen: false });
  assert.equal(v.states.length, 5);
  assert.equal(v.canvas.style.touchAction, 'pan-y');
});

test('disposing a viewer clears selection, ring timers, observers and input listeners', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const v = gestureViewer(t);
  v.tap();
  t.mock.timers.tick(RELEASE_AFTER_MS - 1500);
  v.lifetime.abort();
  t.mock.timers.tick(RELEASE_AFTER_MS);
  assert.equal(v.gate.isSelected(), false);
  assert.equal(v.attributes.size, 0);
  assert.equal(v.fading.size, 0);
  assert.equal(v.page.observers.size, 0);
  assert.equal(v.states.length, 1);
  assert.equal(v.canvas.style.touchAction, 'pan-y');
  for (const [target, types] of [
    [v.canvas, ['pointerdown', 'lostpointercapture', 'wheel']],
    [v.page.document, ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown', 'fullscreenchange', 'visibilitychange']],
    [v.page.document.defaultView, ['blur', 'scroll']],
    [v.stage, ['pointerleave']],
    [v.root, ['pointerleave']],
  ]) for (const type of types) assert.equal(getEventListeners(target, type).length, 0);
  v.tap();
  assert.equal(v.selections, 1);
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
