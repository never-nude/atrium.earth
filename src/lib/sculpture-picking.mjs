const TOUCH_TOLERANCE = 12;
const MASK_EDGE = 128;
const ALPHA_CUTOFF = 96; // Exclude the studio grid (.18) and cast shadow (.16), even if they overlap.

export function hitSculptureMask(mask, bounds, x, y, tolerance) {
  if (!mask) return Boolean(bounds && x >= bounds.left - tolerance && x <= bounds.right + tolerance
    && y >= bounds.top - tolerance && y <= bounds.bottom + tolerance);

  const { data, width, height, scaleX, scaleY } = mask;
  const column = Math.floor(x * scaleX), row = Math.floor(y * scaleY);
  const dx = Math.ceil(tolerance * scaleX), dy = Math.ceil(tolerance * scaleY);
  for (let tileY = Math.max(0, row - dy); tileY <= Math.min(height - 1, row + dy); tileY++) {
    for (let tileX = Math.max(0, column - dx); tileX <= Math.min(width - 1, column + dx); tileX++) {
      if (data[4 * (tileY * width + tileX) + 3] >= ALPHA_CUTOFF
        && Math.hypot((tileX - column) / scaleX, (tileY - row) / scaleY) <= tolerance) return true;
    }
  }
  return false;
}

export function createSculpturePicker(canvas, projectBounds, onMode) {
  const sample = canvas.ownerDocument.createElement('canvas');
  let context = sample.getContext('2d', { willReadFrequently: true });
  let mask, bounds, center, nextSample = 0;
  let lastWidth, lastHeight;
  let mode;

  function update(now, still) {
    const cssWidth = canvas.clientWidth, cssHeight = canvas.clientHeight;
    if (!cssWidth || !cssHeight) return;
    if (!still && now < nextSample && lastWidth === cssWidth && lastHeight === cssHeight) return;
    lastWidth = cssWidth;
    lastHeight = cssHeight;
    mask = undefined;
    bounds = undefined;
    if (context) {
      const scale = Math.min(1, MASK_EDGE / Math.max(cssWidth, cssHeight));
      const width = Math.max(1, Math.round(cssWidth * scale));
      const height = Math.max(1, Math.round(cssHeight * scale));
      if (sample.width !== width || sample.height !== height) {
        sample.width = width;
        sample.height = height;
      }
      try {
        context.globalCompositeOperation = 'copy';
        context.drawImage(canvas, 0, 0, width, height);
        const { data } = context.getImageData(0, 0, width, height);
        const scaleX = width / cssWidth, scaleY = height / cssHeight;
        let left = width, right = -1, top = height, bottom = -1;
        for (let row = 0; row < height; row++) {
          for (let col = 0; col < width; col++) {
            if (data[4 * (row * width + col) + 3] < ALPHA_CUTOFF) continue;
            left = Math.min(left, col);
            right = Math.max(right, col);
            top = Math.min(top, row);
            bottom = row;
          }
        }
        if (right >= 0) {
          mask = { data, width, height, scaleX, scaleY };
          center = { x: (left + right + 1) / (2 * width), y: (top + bottom + 1) / (2 * height) };
        }
      } catch {
        // A renderer whose output cannot be read can still use projected bounds.
        context = null;
      }
    }
    if (!mask) {
      bounds = projectBounds(cssWidth, cssHeight);
      center = bounds ? { x: (bounds.left + bounds.right) / (2 * cssWidth), y: (bounds.top + bounds.bottom) / (2 * cssHeight) } : undefined;
    }
    const nextMode = mask ? 'silhouette' : 'bounds';
    if (mode !== nextMode) { mode = nextMode; onMode(mode); }
    // Read from the frame already rendered. Landing never performs a GPU read
    // or searches the geometry. Slow readback devices sample less often.
    nextSample = now + Math.max(110, (performance.now() - now) * 12);
  }

  return {
    update,
    get center() { return center; },
    hit(clientX, clientY, isTouch) {
      const rect = canvas.getBoundingClientRect();
      return hitSculptureMask(mask, bounds, clientX - rect.left, clientY - rect.top, isTouch ? TOUCH_TOLERANCE : 0);
    },
  };
}
