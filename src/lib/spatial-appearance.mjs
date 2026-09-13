// WebXR uses the page's renderer directly. Quick Look starts its own renderer,
// so exposure must travel in a copy of the exported surface, in linear colour.
export function quickLookExposure(value) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function prepareQuickLookMaterial(source, exposure = 1) {
  const material = source.clone();
  const gain = quickLookExposure(exposure);
  material.color.multiplyScalar(gain);
  // USDZExporter handles emissive-map intensity, but omits intensity for a
  // constant emissive colour. Bake both paths once so a faint glow cannot
  // become full-strength emission in Apple's renderer.
  material.emissive.multiplyScalar((source.emissiveIntensity ?? 1) * gain);
  material.emissiveIntensity = 1;
  return material;
}
