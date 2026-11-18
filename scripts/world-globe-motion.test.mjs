import test from 'node:test';
import assert from 'node:assert/strict';
import { shortestLongitudeDelta, globeTurnEase, pointOnGlobe } from '../src/lib/world-globe-motion.mjs';

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
