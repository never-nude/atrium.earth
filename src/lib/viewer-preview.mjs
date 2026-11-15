export const AUTO_START_MODEL_LIMIT = 3_000_000;

export function previewStartMode(mode, bytes) {
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= AUTO_START_MODEL_LIMIT ? mode : false;
}
