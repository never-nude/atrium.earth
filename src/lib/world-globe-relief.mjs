// Pure helpers for the sculpted globe. Nothing here touches the DOM or WebGL,
// so the relief bake and the light scale can be checked in Node.
//
// The relief is a stylised emboss of the bundled coastline. It is not terrain
// or bathymetry: every value is derived from the land/sea mask alone.

/** Counts at or above this read as the brightest light. */
export const LIGHT_REFERENCE_COUNT = 180;

const clamp01 = value => Math.max(0, Math.min(1, value));

/**
 * Screen size, brightness and beam height for one documented origin.
 * The scale is absolute, so narrowing the period genuinely dims the world.
 */
export function lightMetrics(count) {
  const works = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (!works) return { size: 0, glow: 0, beam: 0 };
  const level = clamp01(Math.log1p(works) / Math.log1p(LIGHT_REFERENCE_COUNT));
  return {
    size: 1.5 + 3.1 * level,            // core radius in CSS pixels
    glow: 0.6 + 0.4 * level,            // 0–1 emissive strength
    beam: 0.02 + 0.125 * level * level, // globe radii
  };
}

/** Frame-rate independent approach to a target; `rate` is 1 / time-constant. */
export function approach(current, target, rate, seconds) {
  if (!(seconds > 0)) return current;
  const next = target + (current - target) * Math.exp(-rate * seconds);
  return Math.abs(next - target) < 1e-3 ? target : next;
}

/**
 * A few passes of a 1-2-1 kernel over a byte mask (longitude wraps, latitude
 * clamps). The shader draws the coast as the half-way contour of this field, so
 * a little softness is what makes the shoreline a clean curve at every size.
 */
export function softenMask(mask, width, height, passes = 2) {
  if (!(width > 1) || !(height > 1) || mask.length < width * height) throw new RangeError('Invalid land mask.');
  let from = mask;
  const across = new Uint8Array(width * height);
  let out = new Uint8Array(width * height);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      const row = y * width, last = row + width - 1;
      across[row] = (from[last] + 2 * from[row] + from[row + 1] + 2) >> 2;
      for (let i = row + 1; i < last; i++) across[i] = (from[i - 1] + 2 * from[i] + from[i + 1] + 2) >> 2;
      across[last] = (from[last - 1] + 2 * from[last] + from[row] + 2) >> 2;
    }
    for (let y = 0; y < height; y++) {
      const row = y * width, above = Math.max(0, y - 1) * width, below = Math.min(height - 1, y + 1) * width;
      for (let x = 0; x < width; x++) out[row + x] = (across[above + x] + 2 * across[row + x] + across[below + x] + 2) >> 2;
    }
    if (pass === 0 && passes > 1) { from = out; out = new Uint8Array(width * height); }
    else [from, out] = [out, from === mask ? new Uint8Array(width * height) : from];
  }
  return from;
}

/** Average 2 × 2 blocks. Odd trailing rows or columns are dropped. */
export function halveField(source, width, height, scale = 1) {
  const w = width >> 1, h = height >> 1;
  const out = new Float32Array(w * h);
  const quarter = scale * 0.25;
  for (let y = 0; y < h; y++) {
    const top = y * 2 * width, bottom = top + width;
    for (let x = 0; x < w; x++) {
      const i = x * 2;
      out[y * w + x] = (source[top + i] + source[top + i + 1] + source[bottom + i] + source[bottom + i + 1]) * quarter;
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Repeated box blur of an equirectangular field (three passes ≈ Gaussian).
 * Longitude wraps; latitude clamps at the poles. The east–west radius grows
 * with 1 / cos(latitude) so a bevel keeps its true width away from the equator.
 */
export function blurField(source, width, height, radius, iterations = 3) {
  if (!(width > 0) || !(height > 0) || source.length < width * height) throw new RangeError('Invalid relief field.');
  let from = Float32Array.from(source.subarray ? source.subarray(0, width * height) : source);
  const r = Math.max(0, Math.round(radius));
  if (!r) return from;
  let to = new Float32Array(width * height);
  const widest = Math.max(r, Math.floor(width / 6));
  const rowRadius = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    const latitude = (0.5 - (y + 0.5) / height) * Math.PI;
    rowRadius[y] = Math.min(widest, Math.max(r, Math.round(r / Math.max(0.05, Math.cos(latitude)))));
  }
  const columns = new Float64Array(width);
  const scale = 1 / (r * 2 + 1);
  for (let pass = 0; pass < iterations; pass++) {
    for (let y = 0; y < height; y++) {
      const row = y * width, rx = rowRadius[y], share = 1 / (rx * 2 + 1);
      let sum = 0;
      for (let k = -rx; k <= rx; k++) sum += from[row + ((k % width) + width) % width];
      let lead = row + (rx + 1) % width, trail = row + ((-rx % width) + width) % width;
      const end = row + width;
      for (let i = row; i < end; i++) {
        to[i] = sum * share;
        sum += from[lead] - from[trail];
        if (++lead === end) lead = row;
        if (++trail === end) trail = row;
      }
    }
    [from, to] = [to, from];
    // North–south: one running sum per column, read and written a whole row at a time.
    columns.fill(0);
    for (let k = -r; k <= r; k++) {
      const row = Math.max(0, Math.min(height - 1, k)) * width;
      for (let x = 0; x < width; x++) columns[x] += from[row + x];
    }
    for (let y = 0; y < height; y++) {
      const row = y * width, enter = Math.min(height - 1, y + r + 1) * width, leave = Math.max(0, y - r) * width;
      for (let x = 0; x < width; x++) {
        to[row + x] = columns[x] * scale;
        columns[x] += from[enter + x] - from[leave + x];
      }
    }
    [from, to] = [to, from];
  }
  return from;
}

/** The relief fields are smooth, so a small grid carries them; the coast itself stays sharp. */
export const RELIEF_WIDTH = 512;
/** Surface slopes are stored as bytes spanning ±RELIEF_SLOPE_RANGE / 2. */
export const RELIEF_SLOPE_RANGE = 2.6;
const BEVEL_SLOPE = 1.7;
const DOME_SLOPE = 1.25;

/**
 * Turn a land mask (bytes: 0 sea – 255 land, row 0 at the north pole) into the
 * one small texture the surface shader reads, four bytes per texel:
 *   R  height — a narrow blur of the mask: the plateau and its bevel;
 *   G  shelf  — a wide blur: engraved waterlines at sea;
 *   B  the eastward surface slope, A the northward slope (128 is level).
 * The slopes combine the bevel with a soft dome over the land, already
 * corrected for latitude, so one texture read lights the relief.
 * Radii are in texels of the reduced grid, at most RELIEF_WIDTH across.
 */
export function bakeRelief(mask, width, height, { bevel = 1, shelf = 5 } = {}) {
  let field;
  if (width > RELIEF_WIDTH) {
    field = halveField(mask, width, height, 1 / 255);
    while (field.width > RELIEF_WIDTH) field = halveField(field.data, field.width, field.height);
  } else {
    const data = new Float32Array(width * height);
    for (let i = 0; i < data.length; i++) data[i] = mask[i] / 255;
    field = { data, width, height };
  }
  const w = field.width, h = field.height;
  const rise = blurField(field.data, w, h, bevel);
  const reach = blurField(field.data, w, h, shelf, 2);
  const data = new Uint8Array(w * h * 4);
  const encode = 255 / RELIEF_SLOPE_RANGE;
  for (let y = 0; y < h; y++) {
    const row = y * w, above = Math.max(0, y - 1) * w, below = Math.min(h - 1, y + 1) * w;
    const latitude = (0.5 - (y + 0.5) / h) * Math.PI;
    const narrow = 1 / Math.max(0.14, Math.cos(latitude));
    for (let x = 0; x < w; x++) {
      const i = row + x, east = row + (x + 1 === w ? 0 : x + 1), west = row + (x === 0 ? w - 1 : x - 1);
      const land = clamp01(rise[i]), dome = DOME_SLOPE * land;
      // Row zero is the north pole, so north is toward the row above.
      const slopeEast = ((rise[east] - rise[west]) * BEVEL_SLOPE + (reach[east] - reach[west]) * dome) * narrow;
      const slopeNorth = (rise[above + x] - rise[below + x]) * BEVEL_SLOPE + (reach[above + x] - reach[below + x]) * dome;
      const at = i * 4;
      data[at] = Math.round(land * 255);
      data[at + 1] = Math.round(clamp01(reach[i]) * 255);
      data[at + 2] = Math.round(clamp01(slopeEast / RELIEF_SLOPE_RANGE + 0.5) * 255);
      data[at + 3] = Math.round(clamp01(slopeNorth / RELIEF_SLOPE_RANGE + 0.5) * 255);
    }
  }
  return { data, width: w, height: h };
}

/**
 * Seconds by which an eased value advances this frame. A frame clock that was just
 * restarted reports no elapsed time; a nominal frame then keeps the motion going, so
 * input that restarts the clock on every frame cannot hold it still.
 */
export function easingStep(elapsed, longest = 0.05) {
  return elapsed > 0 ? Math.min(elapsed, longest) : 1 / 60;
}

/** Rendering tiers, best first. A slow renderer steps down and never back up. */
export const QUALITY_TIERS = Object.freeze([
  Object.freeze({ pixelRatio: 2, detail: 1, sky: true }),
  Object.freeze({ pixelRatio: 1.5, detail: 1, sky: true }),
  Object.freeze({ pixelRatio: 1.15, detail: 0.6, sky: true }),
  Object.freeze({ pixelRatio: 0.85, detail: 0, sky: false }),
]);

/** The tier a renderer starts on. Software rasterisers cannot afford the full canvas. */
export function startingTier(rendererName) {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(rendererName || '')) ? 2 : 0;
}

/**
 * Watches frame pacing while the globe is turning by itself. `sample(seconds)` returns
 * how many tiers to drop (0, 1 or 2) once a full window of frames was mostly
 * slow. The threshold sits below 30 frames a second on purpose: a browser that
 * caps animation at 30 (a phone saving power) is steady, not struggling.
 */
export function createPacingWatch({ window = 36, slowAfter = 1 / 27, share = 0.6, settle = 12 } = {}) {
  let frames = 0, slow = 0, total = 0, skip = settle;
  const clear = () => { frames = slow = total = 0; };
  return {
    sample(seconds) {
      // A long gap is a pause or a hidden tab, not a slow frame.
      if (!(seconds > 0) || seconds > 0.5) { clear(); return 0; }
      if (skip > 0) { skip--; return 0; }
      frames++; total += seconds;
      if (seconds > slowAfter) slow++;
      if (frames < window) return 0;
      const drop = slow / frames >= share ? (total / frames > slowAfter * 2 ? 2 : 1) : 0;
      clear();
      if (drop) skip = settle;
      return drop;
    },
    reset() { clear(); skip = settle; },
  };
}
