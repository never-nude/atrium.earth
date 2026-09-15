// Quick Look does not import Three's renderer exposure. Apply the page's linear
// exposure to the export copy only. Native room lighting/tone mapping can still
// vary; this transfers the page adjustment, not its camera or background.
export function prepareQuickLookMaterial(source, exposure = 1) {
  const material = source.clone();
  const gain = Number.isFinite(exposure) && exposure >= 0 ? exposure : 1;
  material.color.multiplyScalar(gain);
  // USDZExporter handles emissive-map intensity, but omits intensity for a
  // constant emissive colour. Bake both paths once so a faint glow cannot
  // become full-strength emission in Apple's renderer.
  material.emissive.multiplyScalar((source.emissiveIntensity ?? 1) * gain);
  material.emissiveIntensity = 1;
  return material;
}
