export const AUTO_START_MODEL_LIMIT = 3_000_000;

export function previewStartMode(mode, bytes) {
  // Dedicated views have room for one work and show its download progress.
  if (mode === 'detail') return mode;
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= AUTO_START_MODEL_LIMIT ? mode : false;
}
