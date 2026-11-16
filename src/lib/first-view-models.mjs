import { AUTO_START_MODEL_LIMIT } from './viewer-preview.mjs';

const modelOrigin = 'https://models.atrium.earth';
export const FIRST_VIEW_MAX_TEXTURE_EDGE = 2048;
const slugPattern = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const detailExceptions = new Map([['modern/triumph-republic-dalou-place-nation', 8_000_000]]);

export function firstViewMaxBytes(slug) {
  return detailExceptions.get(slug) ?? AUTO_START_MODEL_LIMIT;
}

function textureFits(texture) {
  return texture === null || (texture && [texture.width, texture.height]
    .every(edge => Number.isSafeInteger(edge) && edge > 0 && edge <= FIRST_VIEW_MAX_TEXTURE_EDGE));
}

/** A verified derivative is usable only for the original serving record it was prepared from. */
export function firstViewFor(slug, original, binding) {
  const preparedFrom = binding?.original;
  const firstView = binding?.firstView;
  if (typeof slug !== 'string' || !slugPattern.test(slug) || !preparedFrom || !firstView
    || typeof original?.url !== 'string' || !original.url || !Number.isSafeInteger(original.bytes) || original.bytes < 12
    || preparedFrom.url !== original.url || preparedFrom.bytes !== original.bytes
    || !sha256Pattern.test(preparedFrom.sha256 || '')) return;

  const originalHashPrefix = original.url.match(/\/preview-([a-f0-9]{12,64})\.glb$/)?.[1];
  if ((originalHashPrefix && !preparedFrom.sha256.startsWith(originalHashPrefix))
    || (original.sha256 && original.sha256 !== preparedFrom.sha256)) return;

  if (!sha256Pattern.test(firstView.sha256 || '') || !Number.isSafeInteger(firstView.bytes)
    || firstView.bytes < 12 || firstView.bytes > firstViewMaxBytes(slug)
    || !Number.isSafeInteger(firstView.triangles) || firstView.triangles <= 0 || !textureFits(firstView.largestTexture)) return;

  const immutablePath = `/models/first-views/${slug}/first-${firstView.sha256.slice(0, 12)}.glb`;
  if (firstView.url !== immutablePath && firstView.url !== modelOrigin + immutablePath) return;
  return firstView;
}
