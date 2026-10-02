// Availability and dimensional verification are separate decisions. A display
// default is an editorial starting size, never new measurement evidence.
import { approximateSizeLabel } from './approximate-dimensions.mjs';

export function spatialAccessFor(eligibility, previewUrl, displayDefault, approximation, verifiedReference) {
  const compatible = typeof previewUrl === 'string'
    && /^(?:https?:\/\/|\/)[^?#]+\.glb(?:[?#]|$)/i.test(previewUrl);
  if (!compatible) return { enabled: false, verified: false, status: 'unknown', label: 'AR / VR unavailable', sizeLabel: '', note: 'A compatible 3D model is not available.' };
  if (eligibility?.enabled) return {
    enabled: true, verified: true, status: 'verified', label: eligibility.kind === 'cast' ? 'Verified dimensions · Cast' : 'Verified dimensions',
    sizeLabel: eligibility.sizeLabel, note: eligibility.reason,
    assetSha256: eligibility.assetSha256,
    reference: verifiedReference,
  };
  if (approximation?.reference) return {
    enabled: true, verified: false, status: 'approximate', label: 'Approximate dimensions',
    sizeLabel: approximateSizeLabel(approximation),
    note: `Scaled to Atrium’s best estimate from listed dimensions and work descriptions; actual size may vary. ${approximation.scopeNote || ''}`.trim(),
    reference: approximation.reference, assetSha256: approximation.assetSha256,
    sourceText: approximation.sourceText, sourceUrl: approximation.sourceUrl,
  };
  const maxExtentMeters = Number.isFinite(displayDefault?.maxExtentMeters)
    && displayDefault.maxExtentMeters > 0 ? displayDefault.maxExtentMeters : 1;
  const dimension = maxExtentMeters < 1 ? `${Math.round(maxExtentMeters * 100)} cm` : `${maxExtentMeters} m`;
  return {
    enabled: true, verified: false, status: 'unknown', label: 'Dimensions unknown',
    sizeLabel: `Default: ${dimension} on longest side`,
    note: `${approximation?.unavailableReason || 'No usable real-world dimensions have been established for this model.'} Starts at a chosen display size of ${dimension} on its longest side. You can resize the work.`,
    defaultMaxExtentMeters: maxExtentMeters,
  };
}

export function viewingReferenceFor(box, reference, defaultMaxExtentMeters = 1) {
  if (reference?.axis === 'longest') {
    const resolved = displayReferenceFor(box, reference.meters);
    return resolved ? { axis: resolved.axis, meters: resolved.meters, estimated: true } : null;
  }
  return reference || displayReferenceFor(box, defaultMaxExtentMeters);
}

// Resolve against the actual oriented model bounds, so a wide relief is sized
// by its width and a standing figure by its height. Preserve every proportion.
export function displayReferenceFor(box, maxExtentMeters) {
  if (!Number.isFinite(maxExtentMeters) || maxExtentMeters <= 0) return null;
  const extents = ['x', 'y', 'z'].map(axis => ({ axis, extent: box?.max?.[axis] - box?.min?.[axis] }));
  if (extents.some(({ extent }) => !Number.isFinite(extent) || extent < 0)) return null;
  const longest = extents.reduce((a, b) => b.extent > a.extent ? b : a);
  return longest.extent > 0 ? { axis: longest.axis, meters: maxExtentMeters, displayDefault: true } : null;
}
