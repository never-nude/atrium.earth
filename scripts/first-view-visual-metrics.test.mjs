import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { measureVisualDifference } from './lib/first-view-visual-metrics.mjs';

const side = 96;

function paint(image, x, y, width, height, colour) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      image.set(colour, (row * side + column) * 4);
    }
  }
}

function fixture() {
  const image = Buffer.alloc(side ** 2 * 4);
  paint(image, 8, 8, 80, 80, [76, 96, 63, 255]);
  return image;
}

function png(image) {
  return sharp(image, { raw: { width: side, height: side, channels: 4 } }).png().toBuffer();
}

async function compare(original, candidate) {
  return measureVisualDifference(...await Promise.all([png(original), png(candidate)]));
}

test('identical pairs pass with zero difference', async () => {
  const image = fixture();
  const result = await compare(image, image);
  assert.deepEqual(result.scores, { meanColour: 0, silhouette: 0, localDetail: 0 });
  assert.deepEqual(result.exceeded, []);
});

test('an eye-sized pale mark exceeds the detail threshold even if its average difference is small', async () => {
  const original = fixture();
  const candidate = Buffer.from(original);
  for (let step = 0; step < 24; step += 1) {
    paint(candidate, 30 + step, 28 + step, 3, 1, [217, 199, 167, 255]);
  }
  const result = await compare(original, candidate);
  assert.ok(result.exceeded.includes('localDetail'), JSON.stringify(result.scores));
  assert.ok(!result.exceeded.includes('meanColour'));
  assert.ok(result.patch.x <= 50 && result.patch.x + result.patch.size >= 34);
  assert.ok(result.patch.y <= 40 && result.patch.y + result.patch.size >= 38);
});

test('a changed silhouette and a uniform palette change are detected independently', async () => {
  const original = fixture();
  const shortened = Buffer.from(original);
  paint(shortened, 62, 8, 26, 80, [0, 0, 0, 0]);
  assert.deepEqual((await compare(original, shortened)).exceeded, ['silhouette']);

  const recoloured = Buffer.from(original);
  paint(recoloured, 8, 8, 80, 80, [95, 86, 73, 255]);
  assert.deepEqual((await compare(original, recoloured)).exceeded, ['meanColour']);
});

test('pairs without shared artwork fail closed', async () => {
  await assert.rejects(compare(fixture(), Buffer.alloc(side ** 2 * 4)), /no shared foreground/);
});
