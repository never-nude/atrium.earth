import assert from 'node:assert/strict';
import test from 'node:test';
import { removeStudioMatte } from './lib/artwork-preview-matte.mjs';

// The authored backdrop in public/__render.html, before thumbnail compression.
function fixture(width = 64, height = 64, noise = 0) {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const distance = Math.hypot((x + .5 - width / 2) / (.7 * width),
      (y + .5 - .2 * height) / (.52 * height));
    const glow = .07 * Math.max(0, 1 - distance / .72);
    rgb.set([21 + 194 * glow, 36 + 186 * glow, 58 + 174 * glow]
      .map(value => Math.round(value) + noise), (y * width + x) * 3);
  }
  return { rgb, width, height };
}

function paint({ rgb, width }, x, y, w, h, colour) {
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
    rgb.set(colour, (row * width + col) * 3);
  }
}
const pixel = (rgba, width, x, y) => [...rgba.subarray((y * width + x) * 4, (y * width + x + 1) * 4)];
const remove = ({ rgb, width, height }) => removeStudioMatte(rgb, width, height);

test('erases connected studio background while preserving artwork colour and source bytes', () => {
  const image = fixture();
  paint(image, 20, 20, 24, 30, [210, 165, 110]);
  const before = image.rgb.slice();
  const result = remove(image);
  assert(result instanceof Uint8Array);
  assert.equal(result.length, image.width * image.height * 4);
  assert.deepEqual(pixel(result, image.width, 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(pixel(result, image.width, 32, 8), [0, 0, 0, 0]);
  assert.deepEqual(pixel(result, image.width, 25, 30), [210, 165, 110, 255]);
  assert.deepEqual(image.rgb, before);
});

test('preserves enclosed background-coloured regions and dark marks inside the artwork', () => {
  const image = fixture();
  const untouched = image.rgb.slice();
  paint(image, 14, 16, 36, 38, [220, 200, 170]);
  // This hole matches the original matte exactly, but has no outside connection.
  for (let y = 27; y < 38; y++) for (let x = 25; x < 39; x++) {
    const offset = (y * image.width + x) * 3;
    image.rgb.set(untouched.subarray(offset, offset + 3), offset);
  }
  paint(image, 18, 23, 4, 6, [1, 2, 3]);
  const result = remove(image);
  assert(result);
  const offset = (32 * image.width + 31) * 3;
  assert.deepEqual(pixel(result, image.width, 31, 32), [...untouched.subarray(offset, offset + 3), 255]);
  assert.deepEqual(pixel(result, image.width, 19, 25), [1, 2, 3, 255]);
  assert.equal(pixel(result, image.width, 3, 32)[3], 0);
});

test('rejects other backdrops and empty or nearly empty studio captures', () => {
  const other = fixture();
  other.rgb.fill(240);
  paint(other, 20, 20, 24, 30, [100, 75, 30]);
  assert.equal(remove(other), null);
  assert.equal(remove(fixture()), null);
  const tiny = fixture();
  paint(tiny, 32, 32, 1, 1, [200, 180, 150]);
  assert.equal(remove(tiny), null);
});

test('allows a tall subject to meet the bottom and one side without cutting it away', () => {
  const image = fixture();
  paint(image, 0, 10, 16, 54, [185, 160, 140]);
  const result = remove(image);
  assert(result);
  assert.deepEqual(pixel(result, image.width, 0, 63), [185, 160, 140, 255]);
  assert.deepEqual(pixel(result, image.width, 15, 35), [185, 160, 140, 255]);
  assert.deepEqual(pixel(result, image.width, 63, 63), [0, 0, 0, 0]);
});

test('keeps the existing four-level colour tolerance and independent calls at cached dimensions', () => {
  const image = fixture(64, 64, 4);
  paint(image, 20, 20, 24, 30, [150, 100, 60]);
  const result = remove(image);
  assert(result);
  assert.equal(pixel(result, image.width, 32, 8)[3], 0);
  assert.deepEqual(pixel(result, image.width, 25, 30), [150, 100, 60, 255]);
  const beyondTolerance = fixture(64, 64, 5);
  paint(beyondTolerance, 20, 20, 24, 30, [150, 100, 60]);
  assert.equal(remove(beyondTolerance), null);
  const differentSubject = fixture();
  paint(differentSubject, 10, 25, 35, 15, [60, 95, 160]);
  const second = remove(differentSubject);
  assert(second);
  assert.deepEqual(pixel(second, 64, 15, 30), [60, 95, 160, 255]);
  assert.equal(pixel(second, 64, 32, 45)[3], 0);
});
