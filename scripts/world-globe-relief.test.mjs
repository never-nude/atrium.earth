import test from 'node:test';
import assert from 'node:assert/strict';
import { LIGHT_REFERENCE_COUNT, QUALITY_TIERS, RELIEF_SLOPE_RANGE, RELIEF_WIDTH, approach, bakeRelief, blurField, createPacingWatch, halveField, lightMetrics, softenMask, startingTier } from '../src/lib/world-globe-relief.mjs';

test('lights grow with the number of works and vanish at zero', () => {
  assert.deepEqual(lightMetrics(0), { size: 0, glow: 0, beam: 0 });
  assert.deepEqual(lightMetrics(-4), { size: 0, glow: 0, beam: 0 });
  assert.deepEqual(lightMetrics(NaN), { size: 0, glow: 0, beam: 0 });
  const one = lightMetrics(1), ten = lightMetrics(10), many = lightMetrics(LIGHT_REFERENCE_COUNT);
  for (const key of ['size', 'glow', 'beam']) {
    assert(one[key] > 0, key);
    assert(ten[key] > one[key], key);
    assert(many[key] > ten[key], key);
  }
  // A place far above the reference count is capped, never unbounded.
  assert.deepEqual(lightMetrics(LIGHT_REFERENCE_COUNT * 50), many);
  assert(many.glow <= 1 && many.size < 9 && many.beam < 0.2);
});

test('eased values settle exactly and ignore a stalled clock', () => {
  assert.equal(approach(0, 1, 8, 0), 0);
  assert.equal(approach(0, 1, 8, -1), 0);
  const step = approach(0, 1, 8, 1 / 60);
  assert(step > 0 && step < 1);
  let value = 0;
  for (let frame = 0; frame < 240; frame++) value = approach(value, 1, 8, 1 / 60);
  assert.equal(value, 1);
});

test('softening turns a hard coast into a smooth contour without moving it', () => {
  const width = 32, height = 16;
  const mask = new Uint8Array(width * height);
  // Land fills the western half and continues across the antimeridian.
  for (let y = 0; y < height; y++) for (let x = 0; x < 16; x++) mask[y * width + x] = 255;
  const before = Uint8Array.from(mask);
  for (const passes of [1, 2, 3]) {
    const soft = softenMask(mask, width, height, passes);
    assert.deepEqual(mask, before, 'the source mask must not be modified');
    assert.notEqual(soft, mask);
    const row = [...soft.subarray(8 * width, 9 * width)];
    assert.equal(row[8], 255, 'deep inland stays land');
    assert.equal(row[24], 0, 'open sea stays sea');
    // The half-way contour still falls between the last land texel and the first sea texel.
    assert(row[15] > 128 && row[16] < 128, `the coast drifted after ${passes} passes: ${row[15]}, ${row[16]}`);
    assert(row[15] < 255 && row[16] > 0, 'the coast should be a ramp');
    // The same coast exists at the wrap: column 0 is land, column 31 is sea.
    assert(row[0] > 128 && row[31] < 128 && row[31] > 0, 'the antimeridian coast must soften across the wrap');
  }
  assert.throws(() => softenMask(new Uint8Array(3), 2, 2), RangeError);
});

test('halving averages each 2 × 2 block', () => {
  const half = halveField(Uint8Array.from([0, 255, 255, 255, 0, 0, 255, 255]), 4, 2, 1 / 255);
  assert.deepEqual([half.width, half.height], [2, 1]);
  assert.deepEqual([...half.data].map(value => Math.round(value * 100) / 100), [0.25, 1]);
});

test('the blur keeps flat fields flat, conserves mass and wraps the antimeridian', () => {
  const width = 64, height = 32;
  const flat = new Float32Array(width * height).fill(0.4);
  for (const value of blurField(flat, width, height, 3)) assert(Math.abs(value - 0.4) < 1e-5);

  // One land texel at the western edge must spill onto the eastern edge.
  const edge = new Float32Array(width * height);
  const row = height / 2;
  edge[row * width] = 1;
  const blurred = blurField(edge, width, height, 2);
  assert(blurred[row * width + width - 1] > 0, 'no wrap across ±180°');
  assert(Math.abs(blurred[row * width + 1] - blurred[row * width + width - 1]) < 1e-6, 'wrap is not symmetric');
  const total = blurred.reduce((sum, value) => sum + value, 0);
  assert(Math.abs(total - 1) < 1e-3, `mass drifted to ${total}`);
  assert.equal(blurField(edge, width, height, 0)[row * width], 1);
  assert.throws(() => blurField(new Float32Array(4), 4, 4, 1), RangeError);
});

test('east–west reach widens toward the poles so bevels keep their true width', () => {
  const width = 128, height = 64;
  const reach = y => {
    const field = new Float32Array(width * height);
    field[y * width + width / 2] = 1;
    const row = blurField(field, width, height, 2, 1).subarray(y * width, (y + 1) * width);
    return row.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
  };
  assert(reach(8) > reach(height / 2), 'high latitudes must blur across more longitude');
});

test('the baked relief separates a crisp bevel from a broad shelf', () => {
  // A square continent on the equator, at a size that is baked directly…
  const direct = (() => {
    const width = 64, height = 32, mask = new Uint8Array(width * height);
    for (let y = 12; y < 20; y++) for (let x = 24; x < 40; x++) mask[y * width + x] = 255;
    return bakeRelief(mask, width, height, { bevel: 1, shelf: 5 });
  })();
  // …and the same continent in the full-size mask, which is reduced first.
  const reduced = (() => {
    const width = 2048, height = 1024, mask = new Uint8Array(width * height);
    for (let y = 12 * 32; y < 20 * 32; y++) for (let x = 24 * 32; x < 40 * 32; x++) mask[y * width + x] = 255;
    return bakeRelief(mask, width, height, { bevel: 8, shelf: 40 });
  })();
  assert.deepEqual([direct.width, direct.height, direct.data.length], [64, 32, 64 * 32 * 4]);
  assert.deepEqual([reduced.width, reduced.height, reduced.data.length], [RELIEF_WIDTH, RELIEF_WIDTH / 2, RELIEF_WIDTH * RELIEF_WIDTH * 2]);
  // Land spans [x0, x1) × [y0, y1) in relief texels; `unit` is one bevel radius.
  for (const [relief, unit, x0, x1, y0, y1] of [[direct, 1, 24, 40, 12, 20], [reduced, 8, 192, 320, 96, 160]]) {
    const at = (x, y) => {
      const i = (y * relief.width + x) * 4;
      return { height: relief.data[i], shelf: relief.data[i + 1], east: relief.data[i + 2] - 128, north: relief.data[i + 3] - 128 };
    };
    const midX = (x0 + x1) / 2, midY = (y0 + y1) / 2;
    const inland = at(midX, midY), openSea = at(2 * unit, midY), offshore = at(x0 - 4 * unit, midY);
    assert(inland.height > 250, 'the interior is a plateau');
    assert.deepEqual(openSea, { height: 0, shelf: 0, east: 0, north: 0 });
    // Inland there is no bevel left, only the gentle dome that rounds a continent.
    assert(Math.abs(inland.east) < 8 && Math.abs(inland.north) < 8, `the interior should be nearly level (${inland.east}, ${inland.north})`);
    // Four units out: beyond a one-unit bevel, still inside the waterline shelf.
    assert(offshore.height < 4, `bevel reaches too far (${offshore.height})`);
    assert(offshore.shelf > 20, `shelf should outreach the bevel (${offshore.shelf})`);
    // Each coast climbs toward the land: the slopes point inward on all four sides.
    const west = at(x0, midY), east = at(x1 - 1, midY), north = at(midX, y0), south = at(midX, y1 - 1);
    assert(west.height > 0 && west.height < inland.height, 'the coast is a slope, not a step');
    assert(west.east > 12 && Math.abs(west.north) <= 8, `west coast should rise eastward (${west.east}, ${west.north})`);
    assert(east.east < -12, `east coast should rise westward (${east.east})`);
    assert(north.north < -12 && Math.abs(north.east) <= 8, `north coast should rise southward (${north.north}, ${north.east})`);
    assert(south.north > 12, `south coast should rise northward (${south.north})`);
  }
});

test('stored slopes span the documented range and stay level at sea', () => {
  const width = 64, height = 32, mask = new Uint8Array(width * height).fill(255);
  for (let y = 0; y < height; y++) mask[y * width + 10] = 0;  // a one-texel channel: the steepest possible coast
  const relief = bakeRelief(mask, width, height);
  let low = 255, high = 0;
  for (let i = 2; i < relief.data.length; i += 4) { low = Math.min(low, relief.data[i]); high = Math.max(high, relief.data[i]); }
  assert(low > 0 && high < 255, `slopes clipped at ${low}–${high}; widen RELIEF_SLOPE_RANGE (${RELIEF_SLOPE_RANGE})`);
  assert(high - low > 60, 'a steep coast should use a healthy share of the byte range');
});

test('quality tiers only ever get lighter', () => {
  assert(QUALITY_TIERS.length >= 3);
  for (let i = 1; i < QUALITY_TIERS.length; i++) {
    assert(QUALITY_TIERS[i].pixelRatio < QUALITY_TIERS[i - 1].pixelRatio);
    assert(QUALITY_TIERS[i].detail <= QUALITY_TIERS[i - 1].detail);
  }
  assert.throws(() => { QUALITY_TIERS[0].pixelRatio = 9; }, TypeError);
});

test('software rasterisers start on a lighter tier; real and unknown GPUs start on the best', () => {
  for (const name of [
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)', 'Microsoft Basic Render Driver', 'Mesa softpipe', 'Apple Software Renderer',
  ]) assert.equal(startingTier(name), 2, name);
  for (const name of ['Apple GPU', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)', 'Adreno (TM) 740',
    'Mali-G78', 'WebKit WebGL', '', undefined, null]) assert.equal(startingTier(name), 0, String(name));
  assert(startingTier('SwiftShader') < QUALITY_TIERS.length);
});

test('the pacing watch drops a tier for sustained slow frames only', () => {
  const run = (watch, seconds, frames) => {
    let drops = 0;
    for (let i = 0; i < frames; i++) drops += watch.sample(seconds);
    return drops;
  };
  assert.equal(run(createPacingWatch(), 1 / 60, 600), 0, 'smooth frames never drop');
  assert.equal(run(createPacingWatch(), 1 / 30, 600), 0, 'a steady 30 fps cap is not a struggling renderer');
  // 12 settling frames, then one decision per 36-frame window plus 12 more to settle.
  assert.equal(run(createPacingWatch(), 1 / 22, 12 + 36), 1);
  assert.equal(run(createPacingWatch(), 1 / 22, 12 + 36 + 12 + 35), 1);
  assert.equal(run(createPacingWatch(), 1 / 22, 12 + 36 + 12 + 36), 2);
  assert.equal(run(createPacingWatch(), 1 / 10, 12 + 36), 2, 'a very slow renderer drops two tiers at once');

  // A minority of slow frames is a hitch, not a slow machine.
  const mixed = createPacingWatch({ settle: 0 });
  let drops = 0;
  for (let i = 0; i < 360; i++) drops += mixed.sample(i % 3 === 0 ? 1 / 15 : 1 / 60);
  assert.equal(drops, 0);

  // Pauses, hidden tabs and a stalled clock are not evidence.
  const paused = createPacingWatch({ settle: 0 });
  for (let i = 0; i < 35; i++) assert.equal(paused.sample(1 / 20), 0);
  assert.equal(paused.sample(2), 0, 'a long gap resets the window');
  assert.equal(paused.sample(0), 0);
  assert.equal(paused.sample(NaN), 0);
  assert.equal(run(paused, 1 / 20, 35), 0, 'the window started again after the gap');
  assert.equal(paused.sample(1 / 20), 1);
  paused.reset();
  assert.equal(run(paused, 1 / 20, 35), 0);
});
