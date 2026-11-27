import test from 'node:test';
import assert from 'node:assert/strict';
import { TAP_SLOP, shortestLongitudeDelta, globeTurnEase, plainTap, pointOnGlobe, touchesOn } from '../src/lib/world-globe-motion.mjs';

test('centering takes the short path across the antimeridian without changing endpoints', () => {
  const radians = degrees => degrees * Math.PI / 180;
  assert(Math.abs(shortestLongitudeDelta(radians(179), radians(-179)) - radians(2)) < 1e-12);
  assert(Math.abs(shortestLongitudeDelta(radians(-179), radians(179)) + radians(2)) < 1e-12);
  assert(Math.abs(shortestLongitudeDelta(2 * Math.PI, 0)) < 1e-12);
  assert.equal(globeTurnEase(0), 0);
  assert.equal(globeTurnEase(1), 1);
  assert(globeTurnEase(.5) > .5);
});

test('globe touch ownership follows the sphere, not its rectangular stage', () => {
  const box = { left: 20, top: 100, width: 360, height: 400 };
  assert(pointOnGlobe(200, 300, box, 4));
  assert(!pointOnGlobe(22, 102, box, 4));
  assert(!pointOnGlobe(378, 300, box, 4));
  assert(!pointOnGlobe(200, 300, box, 0));
  assert(!pointOnGlobe(NaN, 300, box, 4));
  // A closer view grows the actual silhouette and therefore its touch area.
  assert(!pointOnGlobe(370, 300, box, 4));
  assert(pointOnGlobe(370, 300, box, 2.5));
});

test('only fingers that came down on the stage take part in its gestures', () => {
  // A TouchList is array-like, not an array, and lists every finger on the screen.
  const list = (...touches) => Object.assign(Object.create(null), touches, { length: touches.length });
  const canvas = { name: 'canvas' }, light = { name: 'a light on the stage' }, heading = { name: 'the page heading' };
  const stage = { contains: target => target === canvas || target === light };
  const onGlobe = { identifier: 0, target: canvas }, onLight = { identifier: 1, target: light }, resting = { identifier: 2, target: heading };
  // A thumb resting on the page is neither the second finger of a pinch nor a reason to keep the globe held.
  assert.deepEqual(touchesOn(stage, list(resting, onGlobe)), [onGlobe]);
  assert.deepEqual(touchesOn(stage, list(resting)), []);
  // A pinch whose fingers landed on the canvas and on a light is still two fingers on the stage.
  assert.deepEqual(touchesOn(stage, list(onGlobe, resting, onLight)), [onGlobe, onLight]);
  assert.deepEqual(touchesOn(stage, list()), []);
});

test('a touch the page owned is a tap only if it stayed put on a page at rest', () => {
  const gesture = { x: 120, y: 300, moved: false, pageLocked: false, scrollAtStart: 5000 };
  const lifted = (dx = 0, dy = 0) => ({ clientX: gesture.x + dx, clientY: gesture.y + dy });
  assert.equal(TAP_SLOP, 7);
  assert(plainTap(gesture, lifted(), 5000));
  assert(plainTap(gesture, lifted(4, -5), 5000), 'A finger wobbles a few pixels as it lifts');
  // Browsers still send a click after a slide this short, without reporting the movement.
  assert(!plainTap(gesture, lifted(12, 0), 5000));
  assert(!plainTap(gesture, lifted(0, -8), 5000));
  assert(!plainTap({ ...gesture, moved: true }, lifted(), 5000), 'It travelled and came back, or a second finger joined it');
  assert(!plainTap({ ...gesture, pageLocked: true }, lifted(), 5000), 'It landed on a page that was still scrolling');
  assert(!plainTap(gesture, lifted(), 5000.1), 'The page scrolled while it was down');
});
