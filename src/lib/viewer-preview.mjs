export const AUTO_START_MODEL_LIMIT = 3_000_000;
export const INLINE_AUTO_LOAD_LIMIT = 25_000_000;

export function isWithinInitialPreviewBudget(bytes) {
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= AUTO_START_MODEL_LIMIT;
}

export function requiresModelActivation(bytes) {
  return !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > INLINE_AUTO_LOAD_LIMIT;
}

export function modelSizeLabel(bytes) {
  return Number.isSafeInteger(bytes) && bytes > 0 ? `${(bytes / 1e6).toFixed(1)} MB` : 'size unavailable';
}
