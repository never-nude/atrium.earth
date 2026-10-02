type SurfaceMaterial = { roughness: number };

export function createTextureControl(materials: Iterable<SurfaceMaterial>) {
  const originals = new Map<SurfaceMaterial, number>();
  for (const material of materials) {
    if (Number.isFinite(material.roughness)) originals.set(material, material.roughness);
  }
  const meanRoughness = originals.size
    ? [...originals.values()].reduce((sum, roughness) => sum + roughness, 0) / originals.size
    : 0.5;
  const defaultValue = Math.round(100 * (1 - Math.max(0, Math.min(1, meanRoughness))));

  return {
    defaultValue,
    setValue(value: number) {
      if (!Number.isFinite(value)) return;
      const amount = Math.max(0, Math.min(100, value));
      for (const [material, original] of originals) {
        // Work from the original values, preserving differences between materials.
        // Returning to the default restores those exact values without accumulated drift.
        material.roughness = amount === defaultValue
          ? original
          : amount > defaultValue
            ? original * (100 - amount) / (100 - defaultValue)
            : 1 - (1 - original) * amount / defaultValue;
      }
    },
  };
}
