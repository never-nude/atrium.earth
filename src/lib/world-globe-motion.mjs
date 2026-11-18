/** Shortest angular path, including a stable crossing of the antimeridian. */
export function shortestLongitudeDelta(from, to) {
  return ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

export const globeTurnEase = progress => 1 - (1 - Math.max(0, Math.min(1, progress))) ** 3;

/** Perspective projection of a unit sphere. Coordinates and tolerance are CSS pixels. */
export function pointOnGlobe(x, y, { left, top, width, height }, distance, fov = 42, tolerance = 6) {
  if (![x, y, left, top, width, height, distance, fov, tolerance].every(Number.isFinite)
    || width <= 0 || height <= 0 || distance <= 1 || fov <= 0 || fov >= 180) return false;
  const radius = height / (2 * Math.tan(fov * Math.PI / 360) * Math.sqrt(distance ** 2 - 1));
  return Math.hypot(x - left - width / 2, y - top - height / 2) <= radius + tolerance;
}
