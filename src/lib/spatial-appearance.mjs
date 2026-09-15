// Native AR has its own camera and environment. Page exposure must never be
// baked into its reflectance. Limit only unusually bright untextured diffuse
// surfaces; keep hue, darker surfaces, metals and source textures intact.
export const AR_DIFFUSE_CEILING = 0.8;
export function quickLookDiffuseGain(r, g, b, material) {
  if (material.map || material.metalnessMap || material.metalness > 0.1) return 1;
  const peak = Math.max(r, g, b);
  return peak > AR_DIFFUSE_CEILING ? AR_DIFFUSE_CEILING / peak : 1;
}

export function prepareQuickLookMaterial(source) {
  const material = source.clone();
  material.color.multiplyScalar(quickLookDiffuseGain(material.color.r, material.color.g, material.color.b, material));
  // USDZExporter omits intensity for constant emission. Bake once, independent
  // of exposure; preserve source emission maps and their authored intensity.
  material.emissive.multiplyScalar(source.emissiveIntensity ?? 1);
  material.emissiveIntensity = 1;
  return material;
}
