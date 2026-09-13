// Quick Look lights PBR surfaces using its own renderer and surroundings.
// Page exposure belongs to the web camera, not the material's reflectance.
// Keep each work's colour and texture intact when moving into native AR.
export function prepareQuickLookMaterial(source) {
  const material = source.clone();
  // USDZExporter handles emissive-map intensity, but omits intensity for a
  // constant emissive colour. Bake both paths once so a faint glow cannot
  // become full-strength emission in Apple's renderer.
  material.emissive.multiplyScalar(source.emissiveIntensity ?? 1);
  material.emissiveIntensity = 1;
  return material;
}
