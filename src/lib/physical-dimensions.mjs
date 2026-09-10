// Catalogue text is never parsed into a scale. A physical reference requires
// both a sourced measurement and an explicit review of the displayed geometry.
export function physicalDimensionsFor(fallback, record, previewUrl, orientation) {
  const calibration = record?.spatial;
  // An explicit reviewed estimate can establish a useful starting size, but
  // remains labelled approximate and is never inferred from catalogue text.
  const estimated = record?.status === 'approximate' && calibration?.estimated === true
    && /^https?:/.test(record.sourceUrl || '');
  const matched = (record?.status === 'documented' || estimated)
    && ['original', 'object'].includes(record.basis)
    && calibration?.previewUrl === previewUrl
    && JSON.stringify(calibration?.orientation ?? null) === JSON.stringify(orientation ?? null);
  const reference = matched && ['x', 'y', 'z'].includes(calibration.axis)
    && Number.isFinite(calibration.meters) && calibration.meters > 0
    ? { axis: calibration.axis, meters: calibration.meters, ...(estimated ? { estimated: true } : {}) } : null;
  return {
    dimensions: record ? record.dimensions : (fallback || '').trim(),
    dimensionsNote: record?.note || '',
    dimensionsSourceUrl: record?.sourceUrl || '',
    dimensionsBasis: record?.basis || 'object',
    spatialReference: reference,
    spatialNote: calibration && !reference
      ? 'Physical size needs a check for this version of the model. Display size is adjustable.'
      : record?.spatialNote || 'Physical size is not yet calibrated. Display size is adjustable.',
  };
}

export function referenceScaleFor(box, reference) {
  if (!reference || !['x', 'y', 'z'].includes(reference.axis)
    || !Number.isFinite(reference.meters) || reference.meters <= 0) return 1;
  const extent = box?.max?.[reference.axis] - box?.min?.[reference.axis];
  if (!Number.isFinite(extent) || extent <= 0) return 1;
  return reference.meters / extent;
}
