/** Shortest angular path, including a stable crossing of the antimeridian. */
export function shortestLongitudeDelta(from, to) {
  return ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

export const globeTurnEase = progress => 1 - (1 - Math.max(0, Math.min(1, progress))) ** 3;

/** How far, in CSS pixels, a finger may stray and still have tapped rather than dragged. */
export const TAP_SLOP = 7;

/**
 * The fingers that came down on the stage. A touch event's `touches` lists every finger on
 * the screen, wherever it rests; `targetTouches` only those that began on one element, which
 * would split a pinch whose fingers landed on two different lights.
 */
export function touchesOn(stage, touches) {
  return Array.prototype.filter.call(touches, touch => stage.contains(touch.target));
}

/**
 * Whether a finished touch the page owned was a plain tap: it came down while the page was at
 * rest, stayed where it landed and scrolled nothing. `scrolledAt` is the time of the page's
 * latest scroll. Browsers do not report movement inside their own tap tolerance, which is
 * wider than this one, so the point of lifting is measured as well.
 */
export function plainTap(gesture, lifted, scrolledAt, slop = TAP_SLOP) {
  return !gesture.moved && !gesture.pageLocked && scrolledAt <= gesture.scrollAtStart
    && Math.hypot(lifted.clientX - gesture.x, lifted.clientY - gesture.y) <= slop;
}

/** Perspective projection of a unit sphere. Coordinates and tolerance are CSS pixels. */
export function pointOnGlobe(x, y, { left, top, width, height }, distance, fov = 42, tolerance = 6) {
  if (![x, y, left, top, width, height, distance, fov, tolerance].every(Number.isFinite)
    || width <= 0 || height <= 0 || distance <= 1 || fov <= 0 || fov >= 180) return false;
  const radius = height / (2 * Math.tan(fov * Math.PI / 360) * Math.sqrt(distance ** 2 - 1));
  return Math.hypot(x - left - width / 2, y - top - height / 2) <= radius + tolerance;
}
