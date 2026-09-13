// Availability and dimensional verification are separate decisions. A display
// default is an editorial starting size, never new measurement evidence.
export function spatialAccessFor(eligibility, previewUrl, displayDefault) {
  const compatible = typeof previewUrl === 'string'
    && /^(?:https?:\/\/|\/)[^?#]+\.glb(?:[?#]|$)/i.test(previewUrl);
  if (!compatible) return { enabled: false, verified: false, label: 'AR / VR unavailable', sizeLabel: '', note: 'A compatible 3D model is not available.' };
  if (eligibility?.enabled) return {
    enabled: true, verified: true, label: eligibility.label,
    sizeLabel: eligibility.sizeLabel, note: eligibility.reason,
    assetSha256: eligibility.assetSha256,
  };
  const maxExtentMeters = Number.isFinite(displayDefault?.maxExtentMeters)
    && displayDefault.maxExtentMeters > 0 ? displayDefault.maxExtentMeters : 1;
  const dimension = maxExtentMeters < 1 ? `${Math.round(maxExtentMeters * 100)} cm` : `${maxExtentMeters} m`;
  return {
    enabled: true, verified: false, label: 'Size unverified',
    sizeLabel: `Default: ${dimension} on longest side`,
    note: `Starts at ${dimension} on its longest side, including any base or surrounding geometry in the scan. This is a display size chosen by Atrium, not a verified real-world measurement. You can resize the work.`,
    defaultMaxExtentMeters: maxExtentMeters,
  };
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
