const DEFAULT_MODEL_BYTES = 100_000_000;
const MAX_MODEL_BYTES = 250_000_000;
const MAX_TOTAL_BYTES = 2_000_000_000;
const release = /^https:\/\/github\.com\/never-nude\/atrium\.earth\/releases\/download\/[a-z0-9-]+\/[a-z0-9-]+\.glb$/;

// Validate the entire request before any downloads. Larger native models require
// explicit review/unfeatured declarations and an explicit aggregate byte budget.
export function validateReviewedPreviewManifest(input) {
  if (input?.schema !== 'atrium-reviewed-preview-upload/1'
      || !Array.isArray(input.models) || !input.models.length || input.models.length > 20) {
    throw Error('Invalid bounded model manifest');
  }
  const limit = input.max_model_bytes ?? DEFAULT_MODEL_BYTES;
  const totalLimit = input.max_total_bytes ?? MAX_TOTAL_BYTES;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_MODEL_BYTES
      || !Number.isSafeInteger(totalLimit) || totalLimit < 1 || totalLimit > MAX_TOTAL_BYTES
      || (limit > DEFAULT_MODEL_BYTES && input.max_total_bytes === undefined)) {
    throw Error('Invalid reviewed byte budget');
  }
  const seen = new Set();
  let total = 0;
  for (const model of input.models) {
    if (!/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(model?.slug || '')
        || seen.has(model.slug) || !release.test(model.url || '')
        || !/^[a-f0-9]{64}$/.test(model.sha256 || '')
        || !Number.isSafeInteger(model.bytes) || model.bytes <= 0 || model.bytes > limit) {
      throw Error('Invalid model binding');
    }
    if (model.bytes > DEFAULT_MODEL_BYTES
        && (model.nativeAndPairedReviewApproved !== true || model.unfeatured !== true)) {
      throw Error('Large native model requires completed review and unfeatured status');
    }
    total += model.bytes;
    if (total > totalLimit) throw Error('Reviewed aggregate byte budget exceeded');
    seen.add(model.slug);
  }
  return {models: input.models, totalBytes: total};
}
